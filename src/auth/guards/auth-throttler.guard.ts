import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

interface ThrottledRequest {
  ip?: string;
  body?: { email?: unknown };
}

@Injectable()
export class AuthThrottlerGuard extends ThrottlerGuard {
  protected override getTracker(request: ThrottledRequest): Promise<string> {
    const email =
      typeof request.body?.email === 'string' ? request.body.email : '';
    return Promise.resolve(`${request.ip ?? 'unknown'}:${email.toLowerCase()}`);
  }
}
