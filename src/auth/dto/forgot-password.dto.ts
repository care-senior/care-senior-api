import { IsEmail } from 'class-validator';
import { NormalizeEmail } from './email.transform.js';

export class ForgotPasswordDto {
  @NormalizeEmail()
  @IsEmail()
  email!: string;
}
