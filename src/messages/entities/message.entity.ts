import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { Resident } from '../../residents/entities/resident.entity.js';
import { UserRole } from '../../common/enums/index.js';

// Recado pontual entre equipe e responsável sobre um idoso — não é chat em tempo real.
@Entity('messages')
export class Message {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'resident_id' })
  residentId!: string;

  @ManyToOne(() => Resident, (resident) => resident.messages, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'resident_id' })
  resident!: Resident;

  @Column({ name: 'sender_role', type: 'enum', enum: UserRole })
  senderRole!: UserRole;

  @Column({ name: 'sender_name' })
  senderName!: string;

  @Column({ type: 'text' })
  text!: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt!: Date;
}
