import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { UserRole } from '../../../common/enums/index.js';

@Entity('user_feedback')
export class UserFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'author_id' })
  authorId!: string;

  @Column({ name: 'author_name' })
  authorName!: string;

  @Column({
    name: 'author_role',
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
  })
  authorRole!: UserRole;

  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'text' })
  message!: string;

  /** Clinics of the author when it was sent; each one sees the feedback. */
  @Column({ name: 'clinic_ids', type: 'uuid', array: true, default: '{}' })
  clinicIds!: string[];

  @CreateDateColumn({ name: 'sent_at', type: 'timestamptz' })
  sentAt!: Date;
}
