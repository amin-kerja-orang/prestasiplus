import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { BlueprintVerificationService } from './blueprint-verification.service'
import { BlueprintViewsService } from './blueprint-views.service'
import { BlueprintsController } from './blueprints.controller'
import { BlueprintsRepository } from './blueprints.repository'
import { BlueprintsService } from './blueprints.service'
import { BlueprintLookupsController } from './lookups.controller'
import { BlueprintLookupsService } from './lookups.service'

/**
 * Blueprint ("Kontrak") admin of the Bijak SPM paper builder (BE-39, bijak-spm BJS-08/09): list, get, create,
 * new version, retire, version history, evidence, verification, and the editor pickers (DSKP units, subjects).
 */
@Module({
  imports: [AuditModule, ThrottleModule],
  controllers: [BlueprintsController, BlueprintLookupsController],
  providers: [BlueprintsRepository, BlueprintViewsService, BlueprintsService, BlueprintVerificationService, BlueprintLookupsService],
  exports: [BlueprintsRepository],
})
export class ExamBlueprintsModule {}
