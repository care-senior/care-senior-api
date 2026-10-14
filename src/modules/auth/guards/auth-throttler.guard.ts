import { type ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { normalizeEmail } from '../dto/email.transform.js';

interface ThrottledRequest {
  ip?: string;
  body?: { email?: unknown };
}

export function trackClient(request: ThrottledRequest): string {
  return request.ip ?? 'unknown';
}

export function keyAcrossAllRoutes(
  _context: ExecutionContext,
  tracker: string,
  throttlerName: string,
): string {
  return `${throttlerName}:${tracker}`;
}

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: ThrottledRequest): Promise<string> {
    const email =
      typeof request.body?.email === 'string'
        ? normalizeEmail(request.body.email)
        : '';
    return Promise.resolve(`${trackClient(request)}:${email}`);
  }
}
