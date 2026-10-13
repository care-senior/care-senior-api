import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  /** Enviado pelo app mobile; o web app usa o cookie httpOnly. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}
