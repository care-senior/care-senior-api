import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class RefreshTokenDto {
  /** Mobile clients send it here; the web app sends it in the httpOnly cookie. */
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  refreshToken?: string;
}
