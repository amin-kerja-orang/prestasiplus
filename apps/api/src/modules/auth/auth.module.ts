import { Module } from '@nestjs/common'
import { APP_GUARD } from '@nestjs/core'

import { AuditModule } from '../../common/audit/audit.module'
import { FeatureFlagsModule } from '../../common/feature-flags/feature-flags.module'
import { FeatureGuard } from '../../common/feature-flags/feature.guard'
import { GUARD_PROVIDERS } from '../../common/guards/guards'
import { SESSION_RESOLVER } from '../../common/guards/session-resolver'
import { AccountRepository } from './account.repository'
import { AuthConfig } from './auth.config'
import { AuthController, SessionController } from './auth.controller'
import { AuthService } from './auth.service'
import { LegacyBcryptPool } from './legacy-bcrypt'
import { LoginThrottle } from './login-throttle.service'
import { PasswordService } from './password.service'
import { PasswordChangeGuard } from './password-change.guard'
import { AuthPortsModule } from './ports'
import { PostgresSessionResolver } from './session-resolver.service'
import { SessionStore } from './session.store'

/**
 * Authentication, the Postgres session and the six session endpoints (BE-03). It also installs the
 * global guards (`AuthGuard`, `RolesGuard`, `CapabilityGuard`): once this module is loaded every
 * route is default-deny unless it is marked `@Public()`.
 */
@Module({
  imports: [AuditModule, AuthPortsModule, FeatureFlagsModule],
  controllers: [AuthController, SessionController],
  providers: [
    AuthConfig,
    AccountRepository,
    LegacyBcryptPool,
    PasswordService,
    LoginThrottle,
    SessionStore,
    PostgresSessionResolver,
    { provide: SESSION_RESOLVER, useExisting: PostgresSessionResolver },
    AuthService,
    // Order matters: FeatureGuard (API-AUTH-16: 404 for an OFF feature, even anonymous) first, then AuthGuard, then the forced-password-change guard, then Roles and Capability.
    { provide: APP_GUARD, useClass: FeatureGuard },
    ...GUARD_PROVIDERS.slice(0, 1),
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
    ...GUARD_PROVIDERS.slice(1),
  ],
  exports: [SESSION_RESOLVER, PasswordService, SessionStore, AuthConfig],
})
export class AuthModule {}
