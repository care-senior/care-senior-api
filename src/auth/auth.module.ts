import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Guardian } from '../guardians/entities/guardian.entity.js';
import { MailModule } from '../mail/mail.module.js';
import { StaffMember } from '../staff/entities/staff-member.entity.js';
import { AccountsService } from './accounts.service.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { AuthSession } from './entities/auth-session.entity.js';
import { AuthToken } from './entities/auth-token.entity.js';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard.js';
import { JwtAuthGuard } from './guards/jwt-auth.guard.js';
import { RolesGuard } from './guards/roles.guard.js';
import { JwtTokensService } from './jwt-tokens.service.js';
import { OneTimeTokensService } from './one-time-tokens.service.js';
import { PasswordService } from './password.service.js';
import { SessionsService } from './sessions.service.js';

const AUTH_ATTEMPTS_PER_MINUTE = 5;

@Module({
  imports: [
    TypeOrmModule.forFeature([StaffMember, Guardian, AuthSession, AuthToken]),
    JwtModule.register({}),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: AUTH_ATTEMPTS_PER_MINUTE }]),
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
    AuthThrottlerGuard,
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AuthModule {}
