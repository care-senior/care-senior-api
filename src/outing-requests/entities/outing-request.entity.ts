import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Resident } from '../../residents/entities/resident.entity.js';
import { Guardian } from '../../guardians/entities/guardian.entity.js';
import { OutingRequestStatus } from '../../common/enums/index.js';

@Entity('outing_requests')
export class OutingRequest {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'resident_id' })
  residentId!: string;

  @ManyToOne(() => Resident, (resident) => resident.outingRequests, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resident_id' })
  resident!: Resident;

  @Column({ name: 'guardian_id' })
  guardianId!: string;

  @ManyToOne(() => Guardian, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'guardian_id' })
  guardian!: Guardian;

  @Column({ name: 'departure_at', type: 'timestamptz' })
  departureAt!: Date;

  @Column({ name: 'return_at', type: 'timestamptz' })
  returnAt!: Date;

  @Column({ type: 'text', nullable: true })
  notes?: string;

  @Column({
    type: 'enum',
    enum: OutingRequestStatus,
    default: OutingRequestStatus.PENDING,
  })
  status!: OutingRequestStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt!: Date;

  @Column({ name: 'responded_at', type: 'timestamptz', nullable: true })
  respondedAt?: Date;

  // Só preenchido quando status == 'rejected' — visível ao responsável.
  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason?: string;
}
