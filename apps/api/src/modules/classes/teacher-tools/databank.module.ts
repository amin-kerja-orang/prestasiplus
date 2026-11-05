import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { QuestionsModule } from '../../questions'
import { DatabankController } from './databank.controller'
import { DatabankService } from './databank.service'

/**
 * Databank Soalan for teachers (S6-T19). A module of its own, listed AFTER `QuestionsModule` in the registry: importing
 * `QuestionsModule` from `ClassesModule` would register the questions routes early and `GET /guru/questions/:id` would
 * capture `GET /guru/questions/template` (see the ORDER NOTE in `modules/index.ts`).
 */
@Module({
  imports: [ThrottleModule, QuestionsModule],
  controllers: [DatabankController],
  providers: [DatabankService],
})
export class DatabankModule {}
