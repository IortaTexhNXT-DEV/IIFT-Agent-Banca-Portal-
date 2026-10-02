import { Body, Controller, Get, HttpCode, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { LOGIN_ATTEMPTS_PER_MINUTE } from '../../config/app-config.js';
import {
  AllowWhilePasswordChangePending,
  CurrentUser,
  Public,
} from '../../common/security/decorators.js';
import type { SessionUser } from '../../common/security/session-user.js';
import { AuthService } from './auth.service.js';
import { ChangePasswordDto, LoginDto } from './dto/auth.dto.js';
import { SessionService } from './session.service.js';

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly sessions: SessionService,
  ) {}

  @Public()
  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: LOGIN_ATTEMPTS_PER_MINUTE, ttl: 60_000 } })
  login(@Req() request: Request, @Body() body: LoginDto) {
    return this.auth.login(request, body.username, body.password);
  }

  @Post('logout')
  @HttpCode(204)
  @AllowWhilePasswordChangePending()
  async logout(
    @Req() request: Request,
    @Res({ passthrough: true }) response: Response,
  ): Promise<void> {
    await this.auth.logout(request);
    await this.sessions.destroy(request, response);
  }

  /** Lets the SPA restore the signed-in state (and CSRF token) after a page reload. */
  @Get('me')
  @AllowWhilePasswordChangePending()
  me(@Req() request: Request, @CurrentUser() user: SessionUser) {
    return { user, csrfToken: request.session.csrfToken };
  }

  @Post('change-password')
  @HttpCode(200)
  @AllowWhilePasswordChangePending()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async changePassword(@Req() request: Request, @Body() body: ChangePasswordDto) {
    const user = await this.auth.changePassword(request, body.currentPassword, body.newPassword);
    return { user, csrfToken: request.session.csrfToken };
  }
}
