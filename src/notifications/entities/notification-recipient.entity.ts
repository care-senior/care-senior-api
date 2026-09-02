import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { AppNotification } from './app-notification.entity.js';
import { UserRole } from '../../common/enums/index.js';

@Entity('notification_recipients')
@Unique(['notificationId', 'userId'])
export class NotificationRecipient {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'notification_id' })
  notificationId!: string;

  @ManyToOne(() => AppNotification, (notification) => notification.recipients, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'notification_id' })
  notification!: Relation<AppNotification>;

  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'user_role', type: 'enum', enum: UserRole })
  userRole!: UserRole;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;
}
