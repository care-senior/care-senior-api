import {
  Column,
  Entity,
  JoinColumn,
  JoinTable,
  ManyToMany,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { Room } from '../../rooms/entities/room.entity.js';
import { Activity } from '../../activities/entities/activity.entity.js';
import { ActivityType, RoutineScope, Weekday } from '../../common/enums/index.js';

@Entity('routines')
export class Routine {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'clinic_id' })
  clinicId!: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.routines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic!: Relation<Clinic>;

  @Column()
  title!: string;

  @Column({ name: 'activity_type', type: 'enum', enum: ActivityType })
  activityType!: ActivityType;

  @Column()
  time!: string;

  @Column({ type: 'enum', enum: Weekday, array: true })
  weekdays!: Weekday[];

  @Column({ type: 'enum', enum: RoutineScope })
  scope!: RoutineScope;

  @ManyToMany(() => Resident)
  @JoinTable({
    name: 'routine_residents',
    joinColumn: { name: 'routine_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'resident_id', referencedColumnName: 'id' },
  })
  residents?: Relation<Resident[]>;

  @ManyToMany(() => Room)
  @JoinTable({
    name: 'routine_rooms',
    joinColumn: { name: 'routine_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'room_id', referencedColumnName: 'id' },
  })
  rooms?: Relation<Room[]>;

  @Column({ type: 'text', nullable: true })
  instructions?: string;

  @Column({ default: true })
  active!: boolean;

  @OneToMany(() => Activity, (activity) => activity.routine)
  generatedActivities!: Relation<Activity[]>;
}
