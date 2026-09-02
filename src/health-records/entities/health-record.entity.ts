import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Resident } from '../../residents/entities/resident.entity.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';

@Entity('health_records')
export class HealthRecord {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'resident_id' })
  residentId!: string;

  @ManyToOne(() => Resident, (resident) => resident.healthRecords, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resident_id' })
  resident!: Resident;

  @Column()
  type!: string;

  // Texto livre proposital (ex.: "130/85 mmHg") — separar valor+unidade só quando
  // alertas automáticos de saúde precisarem comparar valores numericamente.
  @Column()
  value!: string;

  @Column({ name: 'recorded_at', type: 'timestamptz' })
  recordedAt!: Date;

  @Column({ name: 'recorded_by_staff_id' })
  recordedByStaffId!: string;

  @ManyToOne(() => StaffMember, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'recorded_by_staff_id' })
  recordedBy!: StaffMember;
}
