import { type EntityManager, In } from 'typeorm';
import { ActivityStatus } from '../../../common/enums/index.js';
import { ActivityParticipant } from '../entities/activity-participant.entity.js';
import { Activity } from '../entities/activity.entity.js';

/** Statuses a participant can still leave; `late` is never stored. */
export const OPEN_STATUSES = [
  ActivityStatus.PENDING,
  ActivityStatus.IN_PROGRESS,
  ActivityStatus.LATE,
];

/** Reason the guardians see on a dose of a treatment that ended. */
export const ENDED_TREATMENT_REASON = 'Tratamento encerrado';

/**
 * A prescription that ends takes its doses scheduled after `after` off the
 * agenda: each participant still open is cancelled, like `cancel` does, so
 * nobody gets reminded of a medication that was stopped. Doses already
 * registered keep their outcome.
 */
export async function cancelDosesAfter(
  manager: EntityManager,
  medicationId: string,
  after: Date,
  registeredByStaffId: string | null,
): Promise<void> {
  // Locked like every change to an activity, so an outcome being registered
  // right now either lands first (and is kept) or finds the dose cancelled.
  const doses = await manager
    .getRepository(Activity)
    .createQueryBuilder('activity')
    .setLock('pessimistic_write')
    .select('activity.id')
    .where('activity.medicationId = :medicationId', { medicationId })
    .andWhere('activity.scheduledTime > :after', { after })
    .getMany();
  if (doses.length === 0) return;

  await manager.update(
    ActivityParticipant,
    {
      activityId: In(doses.map(({ id }) => id)),
      status: In(OPEN_STATUSES),
    },
    {
      status: ActivityStatus.CANCELLED,
      rating: null,
      comment: null,
      notes: ENDED_TREATMENT_REASON,
      statusChangedAt: new Date(),
      registeredByStaffId,
    },
  );
}
