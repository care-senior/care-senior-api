import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { Relation } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity.js';
import { StaffRole } from '../../common/enums/index.js';
import { encryptedColumn } from '../../common/crypto/field-encryption.js';

@Entity('staff_members')
export class StaffMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({
    name: 'staff_role',
    type: 'enum',
    enum: StaffRole,
    enumName: 'staff_role',
  })
  staffRole!: StaffRole;

  @Column({ name: 'clinic_id' })
  clinicId!: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.staffMembers, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic!: Relation<Clinic>;

  @Column({ name: 'photo_path', nullable: true })
  photoPath?: string;

  @Column({ type: 'varchar', nullable: true, transformer: encryptedColumn })
  cpf?: string;

  @Column({ type: 'varchar', nullable: true, select: false })
  password?: string | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @Column({ name: 'deactivated_at', type: 'timestamptz', nullable: true })
  deactivatedAt?: Date | null;
}
