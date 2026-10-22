import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { CurriculumModule } from '../curriculum'
import { SubscriptionsModule } from '../subscriptions'
import { PracticeAggregateService } from './aggregate'
import { PracticePorts } from './ports'
import { PracticeController } from './practice.controller'
import { PracticeRepository } from './practice.repository'
import { PracticeService } from './practice.service'
import { PracticeStartPlanner } from './start.planner'

/**
 * Practice (M05 write path, BE-12): start, check-answer, submit and the caller's own history, plus the
 * US-33 aggregate service (BE-16 calls it). Exports `PracticeRepository` (the only doorway to the practice
 * tables: `history`, `answers`, `queue`, `mastery`), `PracticePorts` (BE-09 / BE-18 / BE-41 / BE-11 plug
 * their adapters in from their own `onModuleInit`, see `ports.ts`) and `PracticeAggregateService`.
 */
@Module({
  imports: [ThrottleModule, CurriculumModule, SubscriptionsModule],
  controllers: [PracticeController],
  providers: [PracticeRepository, PracticeStartPlanner, PracticeService, PracticePorts, PracticeAggregateService],
  exports: [PracticeRepository, PracticePorts, PracticeAggregateService, PracticeService],
})
export class PracticeModule {}
