import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Activity } from './activity.entity.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';
import { ActivityStatus } from '../../common/enums/index.js';

@Entity('activity_participants')
@Unique(['activityId', 'residentId'])
export class ActivityParticipant {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'activity_id' })
  activityId!: string;

  @ManyToOne(() => Activity, (activity) => activity.participants, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'activity_id' })
  activity!: Relation<Activity>;

  @Column({ name: 'resident_id' })
  residentId!: string;

  @ManyToOne(() => Resident, (resident) => resident.activityParticipations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resident_id' })
  resident!: Relation<Resident>;

  @Column({
    type: 'enum',
    enum: ActivityStatus,
    default: ActivityStatus.PENDING,
  })
  status!: ActivityStatus;

  @Column({ name: 'status_changed_at', type: 'timestamptz', nullable: true })
  statusChangedAt?: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'registered_by_staff_id', nullable: true })
  registeredByStaffId?: string;

  @ManyToOne(() => StaffMember, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registered_by_staff_id' })
  registeredBy?: Relation<StaffMember>;

  @Column({ type: 'int', nullable: true })
  rating?: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;
}
