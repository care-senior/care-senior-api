import {
  Column,
  Entity,
  OneToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Resident } from '../../residents/entities/resident.entity.js';
import { StaffMember } from '../../staff/entities/staff-member.entity.js';
import { Room } from '../../rooms/entities/room.entity.js';
import { Activity } from '../../activities/entities/activity.entity.js';
import { Routine } from '../../routines/entities/routine.entity.js';

@Entity('clinics')
export class Clinic {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column()
  address!: string;

  @Column()
  phone!: string;

  @Column({ name: 'operating_hours' })
  operatingHours!: string;

  // Texto livre com os serviços/atividades oferecidos pela clínica — não confundir com a
  // relação `scheduledActivities` abaixo, que aponta para a agenda (entidade Activity).
  @Column({ type: 'text', array: true, default: '{}' })
  activities!: string[];

  @Column({ name: 'responsible_people' })
  responsiblePeople!: string;

  @Column({ name: 'whatsapp_phone' })
  whatsappPhone!: string;

  @Column({ type: 'double precision' })
  latitude!: number;

  @Column({ type: 'double precision' })
  longitude!: number;

  @Column({ name: 'photo_path', nullable: true })
  photoPath?: string;

  @OneToMany(() => Resident, (resident) => resident.clinic)
  residents!: Resident[];

  @OneToMany(() => StaffMember, (staffMember) => staffMember.clinic)
  staffMembers!: StaffMember[];

  @OneToMany(() => Room, (room) => room.clinic)
  rooms!: Room[];

  @OneToMany(() => Activity, (activity) => activity.clinic)
  scheduledActivities!: Activity[];

  @OneToMany(() => Routine, (routine) => routine.clinic)
  routines!: Routine[];
}
