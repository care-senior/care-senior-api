import { CreateDateColumn, Entity, PrimaryColumn } from 'typeorm';
import { NotificationType } from '../../../common/enums/index.js';

/** A reminder already sent for an activity, so the job never sends it twice. */
@Entity('activity_reminders')
export class ActivityReminder {
  @PrimaryColumn({ name: 'activity_id', type: 'uuid' })
  activityId!: string;

  @PrimaryColumn({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notification_type',
  })
  type!: NotificationType;

  @CreateDateColumn({ name: 'sent_at', type: 'timestamptz' })
  sentAt!: Date;
}
