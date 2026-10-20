import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { BlueprintsController } from './blueprints.controller'
import { BlueprintsRepository } from './blueprints.repository'
import { BlueprintsService } from './blueprints.service'

/** Blueprint ("Kontrak") admin of the Bijak SPM paper builder (BE-39): list, get, create, new version, retire. */
@Module({
  imports: [AuditModule, ThrottleModule],
  controllers: [BlueprintsController],
  providers: [BlueprintsRepository, BlueprintsService],
  exports: [BlueprintsRepository],
})
export class ExamBlueprintsModule {}
