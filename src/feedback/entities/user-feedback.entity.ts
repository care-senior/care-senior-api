import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';
import { UserRole } from '../../common/enums/index.js';

// authorId é uma FK polimórfica (StaffMember ou Guardian, conforme authorRole) —
// sem relação direta possível no TypeORM, resolvida manualmente na camada de aplicação.
@Entity('user_feedback')
export class UserFeedback {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'author_id' })
  authorId!: string;

  @Column({ name: 'author_name' })
  authorName!: string;

  @Column({ name: 'author_role', type: 'enum', enum: UserRole })
  authorRole!: UserRole;

  @Column({ type: 'int' })
  rating!: number;

  @Column({ type: 'text' })
  message!: string;

  @CreateDateColumn({ name: 'sent_at' })
  sentAt!: Date;
}
