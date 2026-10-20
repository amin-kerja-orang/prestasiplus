import { randomInt } from 'node:crypto'

import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit/audit.module'
import { ThrottleModule } from '../../common/throttle'
import { PracticeModule } from '../practice'
import { UsersModule } from '../users'
import { PkskPracticeAdapter } from './practice.adapter'
import { PkskAccessRepository } from './pksk-access.repository'
import { PkskAccessService } from './pksk-access.service'
import { PkskAdminAccessController, PkskAdminQuestionsController, PkskPackagesController } from './pksk-admin.controller'
import { PkskAdminAccessService } from './pksk-admin-access.service'
import { PkskAdminQuestionsService } from './pksk-admin-questions.service'
import { PkskDomainsRepository } from './pksk-domains.repository'
import { PkskProgressRepository } from './pksk-progress.repository'
import { PkskStudentController } from './pksk-student.controller'
import { PkskStudentService } from './pksk-student.service'
import {
  NoPkskSubscription,
  PKSK_PRACTICE_PORT,
  PKSK_QUESTIONS_PORT,
  PKSK_SHUFFLE,
  PKSK_SUBSCRIPTION_PORT,
  UnavailablePkskQuestions,
  type Shuffle,
} from './ports'

/** Fisher-Yates over a copy, with the OS CSPRNG (the exam order must not be guessable). Tests override `PKSK_SHUFFLE`. */
export const shuffleCopy: Shuffle = <T>(items: readonly T[]): T[] => {
  const out = [...items]
  for (let i = out.length - 1; i > 0; i--) {
    const j = randomInt(i + 1)
    ;[out[i], out[j]] = [out[j] as T, out[i] as T]
  }
  return out
}

/**
 * PKSK (M07, BE-42): the learner area, the PKSK question bank screens, the access grants and the packages.
 * Exports `PkskAccessService` (the level gate) for other modules.
 *
 * Seams: the practice completion is the real BE-12 adapter. The PKSK questions (BE-09) and the PKSK subscription flag
 * (BE-25) keep FAIL-CLOSED defaults (see ports.ts and the BE-42 report); when an owner lands its adapter, only the
 * `useClass` of that provider below changes.
 */
@Module({
  imports: [AuditModule, ThrottleModule, UsersModule, PracticeModule],
  controllers: [PkskStudentController, PkskAdminQuestionsController, PkskAdminAccessController, PkskPackagesController],
  providers: [
    PkskDomainsRepository,
    PkskAccessRepository,
    PkskProgressRepository,
    PkskAccessService,
    PkskStudentService,
    PkskAdminAccessService,
    PkskAdminQuestionsService,
    { provide: PKSK_QUESTIONS_PORT, useClass: UnavailablePkskQuestions },
    { provide: PKSK_PRACTICE_PORT, useClass: PkskPracticeAdapter },
    { provide: PKSK_SUBSCRIPTION_PORT, useClass: NoPkskSubscription },
    { provide: PKSK_SHUFFLE, useValue: shuffleCopy },
  ],
  exports: [PkskAccessService],
})
export class PkskModule {}
