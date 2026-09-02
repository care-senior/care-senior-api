import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity.js';
import { Resident } from '../../residents/entities/resident.entity.js';

// Sem equivalente no app mobile — usado só pelo backend/web app (mapa de ocupação,
// troca de quarto). O mobile continua enxergando `Resident.roomNumber` como texto solto.
@Entity('rooms')
export class Room {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'clinic_id' })
  clinicId!: string;

  @ManyToOne(() => Clinic, (clinic) => clinic.rooms, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinic_id' })
  clinic!: Clinic;

  @Column()
  number!: string;

  @Column()
  floor!: string;

  @Column({ nullable: true })
  wing?: string;

  @Column({ type: 'int' })
  capacity!: number;

  @OneToMany(() => Resident, (resident) => resident.room)
  residents!: Resident[];
}
