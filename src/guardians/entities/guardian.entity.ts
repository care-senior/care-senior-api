import { Column, Entity, JoinTable, ManyToMany, PrimaryGeneratedColumn } from 'typeorm';
import type { Relation } from 'typeorm';
import { Resident } from '../../residents/entities/resident.entity.js';

@Entity('guardians')
export class Guardian {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ unique: true })
  email!: string;

  @Column({ name: 'photo_path', nullable: true })
  photoPath?: string;

  @Column()
  cpf!: string;

  @Column({ name: 'contacted_clinic_ids', type: 'text', array: true, default: '{}' })
  contactedClinicIds!: string[];

  @ManyToMany(() => Resident, (resident) => resident.guardians)
  @JoinTable({
    name: 'guardian_resident',
    joinColumn: { name: 'guardian_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'resident_id', referencedColumnName: 'id' },
  })
  residents!: Relation<Resident[]>;
}
