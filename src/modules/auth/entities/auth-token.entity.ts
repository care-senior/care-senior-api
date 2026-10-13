import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { AuthTokenPurpose, UserRole } from '../../../common/enums/index.js';

@Entity('auth_tokens')
export class AuthToken {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string;

  @Column({
    name: 'user_role',
    type: 'enum',
    enum: UserRole,
    enumName: 'user_role',
  })
  userRole!: UserRole;

  @Column({
    type: 'enum',
    enum: AuthTokenPurpose,
    enumName: 'auth_token_purpose',
  })
  purpose!: AuthTokenPurpose;

  @Column({ name: 'token_hash' })
  tokenHash!: string;

  @Column({ name: 'expires_at', type: 'timestamptz' })
  expiresAt!: Date;

  @Column({ name: 'used_at', type: 'timestamptz', nullable: true })
  usedAt?: Date | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;
}
