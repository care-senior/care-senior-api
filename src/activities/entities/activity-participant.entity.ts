import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
} from 'typeorm';
import { Activity } from './activity.entity.js';
import { Resident } from '../../residents/entities/resident.entity.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';
import { ActivityStatus } from '../../common/enums/index.js';

// Vínculo entre uma Activity e um Resident, com status individual de presença/execução.
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
  activity!: Activity;

  @Column({ name: 'resident_id' })
  residentId!: string;

  @ManyToOne(() => Resident, (resident) => resident.activityParticipations, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resident_id' })
  resident!: Resident;

  @Column({
    type: 'enum',
    enum: ActivityStatus,
    default: ActivityStatus.PENDING,
  })
  status!: ActivityStatus;

  // Timestamp da última mudança de status (iniciar/concluir/pular).
  @Column({ name: 'status_changed_at', type: 'timestamptz', nullable: true })
  statusChangedAt?: Date;

  // Motivo de ter sido pulada — visível ao responsável.
  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({ name: 'registered_by_staff_id', nullable: true })
  registeredByStaffId?: string;

  // NUNCA retornar este campo (nem via `registeredByStaffId`) numa resposta de API
  // consumida por um usuário `guardian` — filtrar num DTO de saída distinto por papel.
  @ManyToOne(() => StaffMember, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'registered_by_staff_id' })
  registeredBy?: StaffMember;

  // Nota de 1 a 5 dada pela equipe ao concluir — visível ao responsável.
  @Column({ type: 'int', nullable: true })
  rating?: number;

  @Column({ type: 'text', nullable: true })
  comment?: string;
}
