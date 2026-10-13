import type { CookieOptions, Request, Response } from 'express';
import { API_PREFIX } from '../configure-app.js';

export const REFRESH_TOKEN_COOKIE = 'care_senior_refresh_token';

// Exceção documentada à regra "nunca ramificar por cliente" (guia, seção 4):
// o header só escolhe como o refresh token é entregue ao web (cookie
// httpOnly em vez do body). Nunca decide autorização nem regra de negócio.
export const CLIENT_PLATFORM_HEADER = 'x-client-platform';
const WEB_PLATFORM = 'web';

export function isWebClient(request: Request): boolean {
  return request.headers[CLIENT_PLATFORM_HEADER] === WEB_PLATFORM;
}

export function readRefreshTokenCookie(request: Request): string | undefined {
  const cookies = request.cookies as
    Record<string, string | undefined> | undefined;
  return cookies?.[REFRESH_TOKEN_COOKIE];
}

export function refreshTokenCookieOptions(secure: boolean): CookieOptions {
  return {
    httpOnly: true,
    secure,
    sameSite: 'strict',
    path: `/${API_PREFIX}/auth`,
  };
}

export function setRefreshTokenCookie(
  response: Response,
  refreshToken: string,
  maxAgeMs: number,
  secure: boolean,
) {
  response.cookie(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...refreshTokenCookieOptions(secure),
    maxAge: maxAgeMs,
  });
}

export function clearRefreshTokenCookie(response: Response, secure: boolean) {
  response.clearCookie(REFRESH_TOKEN_COOKIE, refreshTokenCookieOptions(secure));
}
