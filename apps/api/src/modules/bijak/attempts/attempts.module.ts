import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { FilesModule } from '../../files'
import { AttemptSweeper } from './attempt-sweeper'
import { BijakAttemptsController, PhotoInterceptor } from './attempts.controller'
import { AttemptsRepository } from './attempts.repository'
import { BijakAttemptsService } from './attempts.service'
import { BijakAttemptPorts } from './ports'

/**
 * Bijak SPM attempts (M28, BE-16): start and resume, the attempt view without keys, autosave,
 * server deadline and sweeper, submit, "Semak", marking, results, history and working photos.
 *
 * It exports `BijakAttemptPorts`. Other cards plug their adapters in from their own `onModuleInit`
 * (see `ports.ts`): BE-15 `providePaperSource`, BE-09 `provideQuestionSource`, BE-11 `provideReward`,
 * the practice-store owner `provideAggregate`. Until then the defaults answer "no paper", "no
 * question", and the reward and aggregate ports do nothing.
 */
@Module({
  imports: [AuditModule, ThrottleModule, FilesModule],
  controllers: [BijakAttemptsController],
  providers: [BijakAttemptPorts, AttemptsRepository, BijakAttemptsService, AttemptSweeper, PhotoInterceptor],
  exports: [BijakAttemptPorts, BijakAttemptsService],
})
export class BijakAttemptsModule {}
