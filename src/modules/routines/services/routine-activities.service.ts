import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { DataSource, type EntityManager } from 'typeorm';
import { ActivityStatus, RoutineScope } from '../../../common/enums/index.js';
import { Routine } from '../entities/routine.entity.js';
import {
  GENERATION_WINDOW_MS,
  occurrencesBetween,
} from '../utils/routine-schedule.js';

const CLAIM_RETENTION_MS = 24 * 60 * 60 * 1000;

/**
 * Keeps the agenda filled with the activities of each active routine for the
 * next 7 days. A generated activity is managed by its routine while it is in
 * the future, nobody started it and nobody edited it by hand: only those are
 * rebuilt when the routine changes and get their participants synced with
 * the residents the routine covers.
 */
@Injectable()
export class RoutineActivitiesService {
  private readonly logger = new Logger(RoutineActivitiesService.name);

  constructor(private readonly dataSource: DataSource) {}

  @Cron(CronExpression.EVERY_HOUR)
  async generateAll(now = new Date()): Promise<void> {
    // Claims are only needed for slots that can still be generated; keeping
    // a day of margin covers instances whose clocks drift a little ahead.
    await this.dataSource.query(
      'DELETE FROM routine_occurrences WHERE occurs_at <= $1',
      [new Date(now.getTime() - CLAIM_RETENTION_MS)],
    );
    const routines = (await this.dataSource.query(
      'SELECT id FROM routines WHERE active',
    )) as { id: string }[];
    for (const { id } of routines) {
      try {
        await this.dataSource.transaction(async (manager) => {
          const routine = await lockRoutine(manager, id);
          if (routine?.active) {
            await this.generate(manager, routine, now);
          }
        });
      } catch (error) {
        this.logger.error(`Generating routine ${id} failed`, error);
      }
    }
  }

  /** After the routine changed: its managed activities follow the change. */
  async rebuild(manager: EntityManager, routine: Routine, now: Date) {
    await this.removeManagedActivities(manager, routine.id, now);
    if (routine.active) {
      await this.generate(manager, routine, now);
    }
  }

  async removeManagedActivities(
    manager: EntityManager,
    routineId: string,
    now: Date,
  ) {
    const activityIds = await this.managedActivityIds(manager, routineId, now);
    if (activityIds.length === 0) return;
    await manager.query(
      `DELETE FROM routine_occurrences WHERE activity_id = ANY($1)`,
      [activityIds],
    );
    await manager.query('DELETE FROM activities WHERE id = ANY($1)', [
      activityIds,
    ]);
  }

  private async generate(manager: EntityManager, routine: Routine, now: Date) {
    const residentIds = await this.coveredResidentIds(manager, routine);
    if (residentIds.length === 0) {
      await this.removeManagedActivities(manager, routine.id, now);
      return;
    }
    await this.syncParticipants(manager, routine.id, residentIds, now);

    const occurrences = occurrencesBetween(
      routine.time,
      routine.weekdays,
      now,
      new Date(now.getTime() + GENERATION_WINDOW_MS),
    );
    if (occurrences.length === 0) return;
    // A slot is generated only once: the occurrence insert is the claim.
    const claimed = (await manager.query(
      `INSERT INTO routine_occurrences (routine_id, occurs_at)
       SELECT $1::uuid, occurs_at FROM unnest($2::timestamptz[]) occurs_at
       ON CONFLICT DO NOTHING
       RETURNING occurs_at`,
      [routine.id, occurrences],
    )) as { occurs_at: Date }[];
    for (const { occurs_at: occursAt } of claimed) {
      const [activity] = (await manager.query(
        `INSERT INTO activities (clinic_id, type, title, scheduled_time, detail, routine_id)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id`,
        [
          routine.clinicId,
          routine.activityType,
          routine.title,
          occursAt,
          routine.instructions ?? null,
          routine.id,
        ],
      )) as { id: string }[];
      await manager.query(
        `INSERT INTO activity_participants (activity_id, resident_id)
         SELECT $1::uuid, resident_id FROM unnest($2::uuid[]) resident_id`,
        [activity!.id, residentIds],
      );
      await manager.query(
        `UPDATE routine_occurrences SET activity_id = $3
         WHERE routine_id = $1 AND occurs_at = $2`,
        [routine.id, occursAt, activity!.id],
      );
    }
  }

  // Residents who left the clinic or the room leave the upcoming activities;
  // the ones who arrived join them.
  private async syncParticipants(
    manager: EntityManager,
    routineId: string,
    residentIds: string[],
    now: Date,
  ) {
    const activityIds = await this.managedActivityIds(manager, routineId, now);
    if (activityIds.length === 0) return;
    await manager.query(
      `DELETE FROM activity_participants
       WHERE activity_id = ANY($1) AND NOT (resident_id = ANY($2))`,
      [activityIds, residentIds],
    );
    await manager.query(
      `INSERT INTO activity_participants (activity_id, resident_id)
       SELECT activity_id, resident_id
       FROM unnest($1::uuid[]) activity_id CROSS JOIN unnest($2::uuid[]) resident_id
       ON CONFLICT DO NOTHING`,
      [activityIds, residentIds],
    );
  }

  // Locks the activities first, so a participant being started at the same
  // time either finishes before (and the activity is kept) or waits.
  private async managedActivityIds(
    manager: EntityManager,
    routineId: string,
    now: Date,
  ): Promise<string[]> {
    const locked = (await manager.query(
      `SELECT activity.id FROM activities activity
       JOIN routine_occurrences occurrence ON occurrence.activity_id = activity.id
       WHERE occurrence.routine_id = $1 AND occurrence.occurs_at > $2
       FOR UPDATE OF activity`,
      [routineId, now],
    )) as { id: string }[];
    if (locked.length === 0) return [];
    const untouched = (await manager.query(
      `SELECT candidate.id FROM unnest($1::uuid[]) AS candidate (id)
       WHERE NOT EXISTS (
         SELECT 1 FROM activity_participants participant
         WHERE participant.activity_id = candidate.id
           AND participant.status <> $2
       )`,
      [locked.map(({ id }) => id), ActivityStatus.PENDING],
    )) as { id: string }[];
    return untouched.map(({ id }) => id);
  }

  private async coveredResidentIds(
    manager: EntityManager,
    routine: Routine,
  ): Promise<string[]> {
    const [query, parameters] = {
      [RoutineScope.ALL_RESIDENTS]: [
        'SELECT id FROM residents WHERE clinic_id = $1',
        [routine.clinicId],
      ],
      [RoutineScope.SPECIFIC_RESIDENTS]: [
        `SELECT resident.id FROM routine_residents link
         JOIN residents resident ON resident.id = link.resident_id
         WHERE resident.clinic_id = $1 AND link.routine_id = $2`,
        [routine.clinicId, routine.id],
      ],
      [RoutineScope.SPECIFIC_ROOM]: [
        `SELECT resident.id FROM routine_rooms link
         JOIN residents resident ON resident.room_id = link.room_id
         WHERE resident.clinic_id = $1 AND link.routine_id = $2`,
        [routine.clinicId, routine.id],
      ],
    }[routine.scope] as [string, string[]];
    const rows = (await manager.query(query, parameters)) as { id: string }[];
    return rows.map(({ id }) => id);
  }
}

export function lockRoutine(
  manager: EntityManager,
  id: string,
): Promise<Routine | null> {
  return manager
    .createQueryBuilder(Routine, 'routine')
    .setLock('pessimistic_write')
    .where('routine.id = :id', { id })
    .getOne();
}
