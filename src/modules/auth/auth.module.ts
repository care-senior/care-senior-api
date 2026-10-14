import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../../common/guards/roles.guard.js';
import { Guardian } from '../guardians/entities/guardian.entity.js';
import { MailModule } from '../../infra/mail/mail.module.js';
import { StaffMember } from '../staff/entities/staff-member.entity.js';
import { AccountsService } from './services/accounts.service.js';
import { AuthController } from './controllers/auth.controller.js';
import { AuthService } from './services/auth.service.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { AuthToken } from './entities/auth-token.entity.js';
import {
  AuthThrottlerGuard,
  keyAcrossAllRoutes,
  trackClient,
} from './guards/auth-throttler.guard.js';
import { InvitationsService } from './services/invitations.service.js';
import { JwtTokensService } from './services/jwt-tokens.service.js';
import { OneTimeTokensService } from './services/one-time-tokens.service.js';
import { PasswordService } from './services/password.service.js';
import { SessionsService } from './services/sessions.service.js';

const MINUTE_MS = 60_000;
const AUTH_ATTEMPTS_PER_MINUTE = 5;
const AUTH_ATTEMPTS_PER_CLIENT_PER_MINUTE = 20;

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffMember, Guardian, AuthSession, AuthToken]),
    JwtModule.register({}),
    ThrottlerModule.forRoot([
      { name: 'account', ttl: MINUTE_MS, limit: AUTH_ATTEMPTS_PER_MINUTE },
      {
        name: 'client',
        ttl: MINUTE_MS,
        limit: AUTH_ATTEMPTS_PER_CLIENT_PER_MINUTE,
        getTracker: trackClient,
        generateKey: keyAcrossAllRoutes,
      },
    ]),
    MailModule,
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountsService,
    PasswordService,
    JwtTokensService,
    SessionsService,
    OneTimeTokensService,
    InvitationsService,
    AuthThrottlerGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [InvitationsService, SessionsService],
})
export class AuthModule {}
