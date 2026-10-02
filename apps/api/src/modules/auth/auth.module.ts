import { Global, Module } from '@nestjs/common';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';
import { DirectoryAuthenticator } from './directory-authenticator.js';
import { AuthenticationGuard } from './guards/authentication.guard.js';
import { CsrfGuard } from './guards/csrf.guard.js';
import { PermissionsGuard } from './guards/permissions.guard.js';
import { PasswordService } from './password.service.js';
import { SessionService } from './session.service.js';
import { SessionUserFactory } from './session-user.factory.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    PasswordService,
    SessionService,
    SessionUserFactory,
    DirectoryAuthenticator,
    AuthenticationGuard,
    CsrfGuard,
    PermissionsGuard,
  ],
  exports: [PasswordService, SessionService, AuthenticationGuard, CsrfGuard, PermissionsGuard],
})
export class AuthModule {}
