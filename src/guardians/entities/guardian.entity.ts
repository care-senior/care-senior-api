import {
  Column,
  Entity,
  JoinTable,
  ManyToMany,
  PrimaryGeneratedColumn,
} from 'typeorm';
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

  // Dado sensível, obrigatório em todo cadastro de responsável — criptografar em
  // repouso (equivalente ao WoobaUtilitariosCore.CriptografiaRSA) antes de persistir.
  @Column()
  cpf!: string;

  // Clínicas já contatadas enquanto o responsável ainda não tem nenhum idoso vinculado.
  @Column({ name: 'contacted_clinic_ids', type: 'text', array: true, default: '{}' })
  contactedClinicIds!: string[];

  // guardian_resident: N:N — um responsável pode acompanhar mais de um idoso (inclusive
  // em clínicas diferentes) e um idoso pode ter mais de um responsável.
  @ManyToMany(() => Resident, (resident) => resident.guardians)
  @JoinTable({
    name: 'guardian_resident',
    joinColumn: { name: 'guardian_id', referencedColumnName: 'id' },
    inverseJoinColumn: { name: 'resident_id', referencedColumnName: 'id' },
  })
  residents!: Resident[];
}
