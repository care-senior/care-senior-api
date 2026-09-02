import { Column, CreateDateColumn, Entity, OneToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { NotificationRecipient } from './notification-recipient.entity.js';
import { NotificationType } from '../../common/enums/index.js';

@Entity('app_notifications')
export class AppNotification {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'enum', enum: NotificationType })
  type!: NotificationType;

  @Column()
  title!: string;

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @OneToMany(() => NotificationRecipient, (recipient) => recipient.notification)
  recipients!: Relation<NotificationRecipient[]>;
}
