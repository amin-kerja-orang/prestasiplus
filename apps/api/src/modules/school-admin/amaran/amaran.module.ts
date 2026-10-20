import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { ClassesModule } from '../../classes'
import { PracticeModule } from '../../practice'
import { KirkpatrickModule } from '../../reports/kirkpatrick'
import { SchoolsModule } from '../../schools'
import { UsersModule } from '../../users'
import { AmaranController } from './amaran.controller'
import { AmaranService } from './amaran.service'

/**
 * Amaran Awal early-warning routes (BE-21 Part C, 4 routes under `/amaran`). No tables of its own: pupils from the users owner,
 * classes from BE-17, practice facts from BE-12's `PracticeRepository`, interventions from BE-20's `KirkpatrickRepository`.
 */
@Module({
  imports: [AuditModule, ClassesModule, KirkpatrickModule, PracticeModule, SchoolsModule, ThrottleModule, UsersModule],
  controllers: [AmaranController],
  providers: [AmaranService],
})
export class AmaranModule {}
