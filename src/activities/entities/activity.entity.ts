import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity.js';
import { Medication } from '../../medications/entities/medication.entity.js';
import { Routine } from '../../routines/entities/routine.entity.js';
import { ActivityParticipant } from './activity-participant.entity.js';
import { ActivityType } from '../../common/enums/index.js';

@Entity('activities')
export class Activity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'clinic_id' })
  clinicId!: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.scheduledActivities, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic!: Relation<Clinic>;

  @Column({ type: 'enum', enum: ActivityType })
  type!: ActivityType;

  @Column()
  title!: string;

  @Column({ name: 'scheduled_time', type: 'timestamptz' })
  scheduledTime!: Date;

  @Column({ type: 'text', nullable: true })
  detail?: string;

  @Column({ name: 'photo_path', nullable: true })
  photoPath?: string;

  @Column({ name: 'medication_id', nullable: true })
  medicationId?: string;

  @ManyToOne(() => Medication, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'medication_id' })
  medication?: Relation<Medication>;

  @Column({ name: 'routine_id', nullable: true })
  routineId?: string;

  @ManyToOne(() => Routine, (routine) => routine.generatedActivities, {
    nullable: true,
    onDelete: 'SET NULL',
  })
  @JoinColumn({ name: 'routine_id' })
  routine?: Relation<Routine>;

  @OneToMany(() => ActivityParticipant, (participant) => participant.activity)
  participants!: Relation<ActivityParticipant[]>;
}
