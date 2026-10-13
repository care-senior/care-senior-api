import type { CookieOptions, Request, Response } from 'express';
import { API_PREFIX, API_VERSION } from '../configure-app.js';

export const REFRESH_TOKEN_COOKIE = 'care_senior_refresh_token';

/** The web app identifies itself with this header to get the refresh token as a cookie. */
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
    path: `/${API_PREFIX}/v${API_VERSION}/auth`,
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
