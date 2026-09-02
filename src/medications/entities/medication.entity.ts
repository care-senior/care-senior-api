import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Resident } from '../../residents/entities/resident.entity.js';
import { MedicationForm } from '../../common/enums/index.js';

// Prescrição estruturada, separada da agenda — cada dose agendada é uma Activity do
// tipo 'medication' que referencia esta prescrição via Activity.medicationId.
@Entity('medications')
export class Medication {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'resident_id' })
  residentId!: string;

  @ManyToOne(() => Resident, (resident) => resident.medications, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resident_id' })
  resident!: Resident;

  @Column()
  name!: string;

  @Column()
  dosage!: string;

  @Column({ type: 'enum', enum: MedicationForm })
  form!: MedicationForm;

  @Column()
  frequency!: string;

  @Column({ type: 'text', nullable: true })
  instructions?: string;

  @Column({ name: 'prescribed_by', nullable: true })
  prescribedBy?: string;

  @Column({ name: 'start_date', type: 'timestamptz' })
  startDate!: Date;

  // Nulo enquanto for tratamento contínuo.
  @Column({ name: 'end_date', type: 'timestamptz', nullable: true })
  endDate?: Date;

  @Column({ default: true })
  active!: boolean;
}
