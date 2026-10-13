import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { UserRole } from '../common/enums/index.js';
import type { Environment } from '../config/environment.js';
import { AuthService, type AuthResult } from './auth.service.js';
import { CurrentUser } from '../common/decorators/current-user.decorator.js';
import { Public } from '../common/decorators/public.decorator.js';
import type { AuthenticatedUser } from '../common/types/authenticated-user.interface.js';
import { AcceptInviteDto } from './dto/accept-invite.dto.js';
import { AuthResponseDto } from './dto/auth-response.dto.js';
import { AuthUserDto } from './dto/auth-user.dto.js';
import { ForgotPasswordDto } from './dto/forgot-password.dto.js';
import { LoginDto } from './dto/login.dto.js';
import { RefreshTokenDto } from './dto/refresh-token.dto.js';
import { ResetPasswordDto } from './dto/reset-password.dto.js';
import { AuthThrottlerGuard } from './guards/auth-throttler.guard.js';
import { JwtTokensService } from './jwt-tokens.service.js';
import {
  CLIENT_PLATFORM_HEADER,
  clearRefreshTokenCookie,
  isWebClient,
  readRefreshTokenCookie,
  setRefreshTokenCookie,
} from './refresh-token-cookie.js';

@ApiTags('Auth')
@ApiHeader({
  name: CLIENT_PLATFORM_HEADER,
  required: false,
  description: 'Send "web" to receive the refresh token as an httpOnly cookie.',
})
@Controller('auth')
export class AuthController {
  private readonly secureCookies: boolean;

  constructor(
    private readonly auth: AuthService,
    private readonly jwtTokens: JwtTokensService,
    config: ConfigService<Environment, true>,
  ) {
    this.secureCookies = config.get('COOKIE_SECURE', { infer: true });
  }

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Post('staff/login')
  @HttpCode(HttpStatus.OK)
  async loginStaff(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.login(UserRole.STAFF, dto);
    return this.deliverSession(request, response, result);
  }

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Post('guardian/login')
  @HttpCode(HttpStatus.OK)
  async loginGuardian(
    @Body() dto: LoginDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const result = await this.auth.login(UserRole.GUARDIAN, dto);
    return this.deliverSession(request, response, result);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  async refresh(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<AuthResponseDto> {
    const refreshToken = dto.refreshToken ?? readRefreshTokenCookie(request);
    if (!refreshToken) throw new UnauthorizedException('Missing refresh token');

    const result = await this.auth.refresh(refreshToken);
    return this.deliverSession(request, response, result);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(
    @Body() dto: RefreshTokenDto,
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ) {
    const refreshToken = dto.refreshToken ?? readRefreshTokenCookie(request);
    if (refreshToken) await this.auth.logout(refreshToken);
    clearRefreshTokenCookie(response, this.secureCookies);
  }

  @ApiBearerAuth()
  @Get('me')
  me(@CurrentUser() currentUser: AuthenticatedUser): Promise<AuthUserDto> {
    return this.auth.me(currentUser);
  }

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Post('staff/forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotStaffPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.requestPasswordReset(UserRole.STAFF, dto.email);
  }

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Post('guardian/forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotGuardianPassword(@Body() dto: ForgotPasswordDto) {
    await this.auth.requestPasswordReset(UserRole.GUARDIAN, dto.email);
  }

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Post('staff/accept-invite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptStaffInvite(@Body() dto: AcceptInviteDto) {
    await this.auth.acceptInvite(UserRole.STAFF, dto);
  }

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Post('guardian/accept-invite')
  @HttpCode(HttpStatus.NO_CONTENT)
  async acceptGuardianInvite(@Body() dto: AcceptInviteDto) {
    await this.auth.acceptInvite(UserRole.GUARDIAN, dto);
  }

  @Public()
  @UseGuards(AuthThrottlerGuard)
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.auth.resetPassword(dto);
  }

  private deliverSession(
    request: Request,
    response: Response,
    { refreshToken, ...result }: AuthResult,
  ): AuthResponseDto {
    if (!isWebClient(request)) return { ...result, refreshToken };

    setRefreshTokenCookie(
      response,
      refreshToken,
      this.jwtTokens.refreshTokenTtlMs,
      this.secureCookies,
    );
    return result;
  }
}
