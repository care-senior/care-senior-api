import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  /** Sent by the mobile app; the web app relies on the httpOnly cookie instead. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}
