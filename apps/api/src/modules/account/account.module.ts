import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { AccountRepository as AuthAccountRepository } from '../auth/account.repository'
import { AuthModule, AuthPortsModule } from '../auth'
import { ClassesModule } from '../classes'
import { FilesModule } from '../files'
import { NotificationsModule } from '../notifications'
import { PracticeModule } from '../practice'
import { SchoolsModule } from '../schools'
import { IcService } from '../users/credentials'
import { UsersModule } from '../users'
import { WalletModule } from '../wallet'
import { NotificationsAdapter } from './notifications.adapter'
import { AccountPublicController, MeController, PictureInterceptor, PublicStatsController } from './account.controller'
import { AccountDataRepository } from './account-data.repository'
import { AccountThrottle } from './account-throttle.service'
import { AccountPortsModule } from './registration-ports'
import { PasswordResetService } from './password-reset.service'
import { LoggingMailPort, MAIL_PORT, NOTIFICATION_PORT } from './ports'
import { ProfileActivityService } from './profile-activity.service'
import { ProfileService } from './profile.service'
import { RegistrationService } from './registration.service'
import { SessionIssuer } from './session-issuer.service'
import { SettingsService, StatsService } from './settings.service'
import { TeacherCardController, TeacherProfileController } from './teacher-profile.controller'
import { TeacherProfileService } from './teacher-profile.service'

/**
 * M01 account basics, part A of BE-06: self-registration, password reset (e-mail link and IC),
 * `/me`, password change, picture, personal settings and the public counters.
 *
 * Seams the LEAD wires later (override the provider, or replace `useClass`):
 * - `MAIL_PORT`: logging only in B1 (OD-7); nothing is e-mailed.
 * - `NOTIFICATION_PORT`: bound to part B's `NotificationsService.push` (D59a); sent after commit.
 *
 * API-MUR-02 (`GET /me/profile-activity`) reads wallet/streak (M14 `WalletModule`), the badge catalogue (M14
 * `GamificationModule`, resolved lazily) and sessions (M05 `PracticeModule`) through their exported services, read-only.
 * `GamificationModule` is NOT imported here: it pulls `QuestionsModule` in through `GamesCoreModule`, and this module is listed early in
 * `modules/index.ts`, so `GET /guru/questions/:id` would register before `/guru/questions/template` (see the ORDER NOTE there).
 *
 * API-GUR-22 (`/account/teacher-profile`, `/public/teachers/:id`) lives in `teacher-profile.{controller,service}.ts`; the teaching
 * details are read and written through `ClassesRepository` (M10 owns `teacher_profiles`).
 *
 * The auth `AccountRepository` is stateless and not exported by `AuthModule`,
 * so it is provided here again.
 */
@Module({
  imports: [AuditModule, ThrottleModule, AccountPortsModule, AuthModule, AuthPortsModule, UsersModule, SchoolsModule, FilesModule, NotificationsModule, WalletModule, PracticeModule, ClassesModule],
  controllers: [AccountPublicController, MeController, PublicStatsController, TeacherProfileController, TeacherCardController],
  providers: [
    AccountDataRepository,
    AccountThrottle,
    SessionIssuer,
    RegistrationService,
    PasswordResetService,
    ProfileService,
    ProfileActivityService,
    TeacherProfileService,
    SettingsService,
    StatsService,
    PictureInterceptor,
    IcService,
    AuthAccountRepository,
    { provide: MAIL_PORT, useClass: LoggingMailPort },
    { provide: NOTIFICATION_PORT, useClass: NotificationsAdapter },
  ],
  exports: [MAIL_PORT, NOTIFICATION_PORT],
})
export class AccountModule {}
