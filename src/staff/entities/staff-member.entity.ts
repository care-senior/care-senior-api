import { Column, Entity, JoinColumn, ManyToOne, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity.js';
import { StaffRole } from '../../common/enums/index.js';

@Entity('staff_members')
export class StaffMember {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ type: 'enum', enum: StaffRole })
  role!: StaffRole;

  @Column({ name: 'clinic_id' })
  clinicId!: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.staffMembers, {
    onDelete: 'RESTRICT',
  })
  @JoinColumn({ name: 'clinic_id' })
  clinic!: Relation<Clinic>;

  @Column({ name: 'photo_path', nullable: true })
  photoPath?: string;

  @Column({ nullable: true })
  cpf?: string;
}
