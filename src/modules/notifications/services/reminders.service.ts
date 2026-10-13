import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  ActivityStatus,
  ActivityType,
  NotificationType,
} from '../../../common/enums/index.js';
import { Activity } from '../../activities/entities/activity.entity.js';
import { ActivityReminder } from '../entities/activity-reminder.entity.js';
import { formatTime } from '../utils/notification-text.js';
import { NotifierService } from './notifier.service.js';

const MINUTE_MS = 60 * 1000;
export const UPCOMING_WINDOW_MS = 30 * MINUTE_MS;
export const OVERDUE_AFTER_MS = 30 * MINUTE_MS;
const OVERDUE_LOOKBACK_MS = 12 * 60 * MINUTE_MS;

/**
 * Reminds the clinic staff of activities about to start and of medication
 * doses still not registered after their time. Each reminder is sent once
 * per activity, even with several API instances running the job.
 */
@Injectable()
export class RemindersService {
  private readonly logger = new Logger(RemindersService.name);

  constructor(
    @InjectRepository(Activity)
    private readonly activityRepository: Repository<Activity>,
    @InjectRepository(ActivityReminder)
    private readonly reminderRepository: Repository<ActivityReminder>,
    private readonly notifier: NotifierService,
  ) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async sendDueReminders(now = new Date()): Promise<void> {
    const upcoming = await this.activitiesWithParticipantsIn(
      [ActivityStatus.PENDING],
      now,
      new Date(now.getTime() + UPCOMING_WINDOW_MS),
    );
    for (const activity of upcoming) {
      await this.remind(
        activity,
        activity.type === ActivityType.MEDICATION
          ? NotificationType.MEDICATION_UPCOMING
          : NotificationType.UPCOMING_EVENT,
      );
    }

    const overdue = await this.activitiesWithParticipantsIn(
      [ActivityStatus.PENDING, ActivityStatus.IN_PROGRESS],
      new Date(now.getTime() - OVERDUE_LOOKBACK_MS),
      new Date(now.getTime() - OVERDUE_AFTER_MS),
      ActivityType.MEDICATION,
    );
    for (const activity of overdue) {
      await this.remind(activity, NotificationType.MEDICATION_OVERDUE);
    }
  }

  private activitiesWithParticipantsIn(
    statuses: ActivityStatus[],
    from: Date,
    to: Date,
    type?: ActivityType,
  ): Promise<Activity[]> {
    const queryBuilder = this.activityRepository
      .createQueryBuilder('activity')
      .innerJoinAndSelect(
        'activity.participants',
        'participant',
        'participant.status IN (:...statuses)',
        { statuses },
      )
      .innerJoin('participant.resident', 'resident')
      .addSelect(['resident.id', 'resident.name'])
      .where('activity.scheduledTime > :from', { from })
      .andWhere('activity.scheduledTime <= :to', { to })
      .orderBy('activity.scheduledTime', 'ASC');
    if (type) {
      queryBuilder.andWhere('activity.type = :type', { type });
    }
    return queryBuilder.getMany();
  }

  private async remind(activity: Activity, type: NotificationType) {
    try {
      if (!(await this.claim(activity.id, type))) return;
      await this.notifier.notify(reminderContent(activity, type), {
        staffOf: { clinicId: activity.clinicId },
      });
    } catch (error) {
      this.logger.error(`Reminder for activity ${activity.id} failed`, error);
    }
  }

  // The insert is the lock: only the instance whose row went in sends it.
  private async claim(activityId: string, type: NotificationType) {
    const result = await this.reminderRepository
      .createQueryBuilder()
      .insert()
      .values({ activityId, type })
      .orIgnore()
      .returning(['activityId'])
      .execute();
    return (result.raw as unknown[]).length > 0;
  }
}

function reminderContent(activity: Activity, type: NotificationType) {
  const time = formatTime(activity.scheduledTime);
  const residents = activity.participants
    .map(({ resident }) => resident.name)
    .sort((first, second) => first.localeCompare(second))
    .join(', ');
  switch (type) {
    case NotificationType.MEDICATION_OVERDUE:
      return {
        type,
        title: `Medicação atrasada: ${activity.title}`,
        message: `${activity.title} de ${residents} estava marcada para ${time} e ainda não foi registrada.`,
      };
    case NotificationType.MEDICATION_UPCOMING:
      return {
        type,
        title: `Medicação às ${time}: ${activity.title}`,
        message: `Para ${residents}.`,
      };
    default:
      return {
        type,
        title: `${activity.title} às ${time}`,
        message: `Participantes: ${residents}.`,
      };
  }
}
