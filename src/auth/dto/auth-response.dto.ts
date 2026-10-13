import { AuthUserDto } from './auth-user.dto.js';

export class AuthResponseDto {
  accessToken!: string;

  /** Omitted for the web app, which receives the refresh token as an httpOnly cookie. */
  refreshToken?: string;

  /** Access token lifetime, in seconds. */
  expiresIn!: number;

  user!: AuthUserDto;
}
