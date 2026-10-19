import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { AccountRepository as AuthAccountRepository } from '../auth/account.repository'
import { LoginThrottle } from '../auth/login-throttle.service'
import { AuthModule } from '../auth'
import { FilesModule } from '../files'
import { NotificationsModule } from '../notifications'
import { SchoolsModule } from '../schools'
import { IcService } from '../users/credentials'
import { UsersModule } from '../users'
import { NotificationsAdapter } from './notifications.adapter'
import { AccountPublicController, MeController, PictureInterceptor, PublicStatsController } from './account.controller'
import { AccountDataRepository } from './account-data.repository'
import { AccountThrottle } from './account-throttle.service'
import { PasswordResetService } from './password-reset.service'
import { LoggingMailPort, MAIL_PORT, NOTIFICATION_PORT } from './ports'
import { ProfileService } from './profile.service'
import { RegistrationService } from './registration.service'
import { SessionIssuer } from './session-issuer.service'
import { SettingsService, StatsService } from './settings.service'

/**
 * M01 account basics, part A of BE-06: self-registration, password reset (e-mail link and IC),
 * `/me`, password change, picture, personal settings and the public counters.
 *
 * Seams the LEAD wires later (override the provider, or replace `useClass`):
 * - `MAIL_PORT`: logging only in B1 (OD-7); nothing is e-mailed.
 * - `NOTIFICATION_PORT`: bound to part B's `NotificationsService.push` (D59a); sent after commit.
 *
 * `LoginThrottle` and the auth `AccountRepository` are stateless and not exported by `AuthModule`,
 * so they are provided here again (same code, same counters in `login_attempts`).
 */
@Module({
  imports: [AuditModule, ThrottleModule, AuthModule, UsersModule, SchoolsModule, FilesModule, NotificationsModule],
  controllers: [AccountPublicController, MeController, PublicStatsController],
  providers: [
    AccountDataRepository,
    AccountThrottle,
    SessionIssuer,
    RegistrationService,
    PasswordResetService,
    ProfileService,
    SettingsService,
    StatsService,
    PictureInterceptor,
    IcService,
    LoginThrottle,
    AuthAccountRepository,
    { provide: MAIL_PORT, useClass: LoggingMailPort },
    { provide: NOTIFICATION_PORT, useClass: NotificationsAdapter },
  ],
  exports: [MAIL_PORT, NOTIFICATION_PORT],
})
export class AccountModule {}
