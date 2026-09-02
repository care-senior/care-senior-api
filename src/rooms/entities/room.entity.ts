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
import { Resident } from '../../residents/entities/resident.entity.js';

@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'clinic_id' })
  clinicId!: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.rooms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic!: Relation<Clinic>;

  @Column()
  number!: string;

  @Column()
  floor!: string;

  @Column({ nullable: true })
  wing?: string;

  @Column({ type: 'int' })
  capacity!: number;

  @OneToMany(() => Resident, (resident) => resident.room)
  residents!: Relation<Resident[]>;
}
