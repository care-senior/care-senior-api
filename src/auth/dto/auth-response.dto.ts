import { AuthUserDto } from './auth-user.dto.js';

export class AuthResponseDto {
  accessToken!: string;

  /** Ausente para o web app, que recebe o refresh token num cookie httpOnly. */
  refreshToken?: string;

  /** Validade do access token, em segundos. */
  expiresIn!: number;

  user!: AuthUserDto;
}
