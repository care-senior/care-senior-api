import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { AppNotification } from './app-notification.entity.js';
import { UserRole } from '../../common/enums/index.js';

// Substitui o campo `audience` genérico do mock: `read` é por usuário, então cada
// destinatário (staff ou guardian) tem sua própria linha e seu próprio `readAt`.
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
  notification!: AppNotification;

  // FK polimórfica → StaffMember ou Guardian, conforme userRole.
  @Column({ name: 'user_id' })
  userId!: string;

  @Column({ name: 'user_role', type: 'enum', enum: UserRole })
  userRole!: UserRole;

  @Column({ name: 'read_at', type: 'timestamptz', nullable: true })
  readAt?: Date;
}
