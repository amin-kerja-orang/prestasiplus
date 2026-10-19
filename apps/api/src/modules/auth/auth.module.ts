import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { GUARD_PROVIDERS } from '../../common/guards/guards'
import { SESSION_RESOLVER } from '../../common/guards/session-resolver'
import { AccountRepository } from './account.repository'
import { AuthConfig } from './auth.config'
import { AuthController, SessionController } from './auth.controller'
import { AuthService } from './auth.service'
import { LoginThrottle } from './login-throttle.service'
import { PasswordService } from './password.service'
import { PostgresSessionResolver } from './session-resolver.service'
import { SessionStore } from './session.store'

/**
 * Authentication, the Postgres session and the six session endpoints (BE-03). It also installs the
 * global guards (`AuthGuard`, `RolesGuard`, `CapabilityGuard`): once this module is loaded every
 * route is default-deny unless it is marked `@Public()`.
 */
@Module({
  imports: [AuditModule],
  controllers: [AuthController, SessionController],
  providers: [
    AuthConfig,
    AccountRepository,
    PasswordService,
    LoginThrottle,
    SessionStore,
    PostgresSessionResolver,
    { provide: SESSION_RESOLVER, useExisting: PostgresSessionResolver },
    AuthService,
    ...GUARD_PROVIDERS,
  ],
  exports: [SESSION_RESOLVER, PasswordService, SessionStore],
})
export class AuthModule {}
