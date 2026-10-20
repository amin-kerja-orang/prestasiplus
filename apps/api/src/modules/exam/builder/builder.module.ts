import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit'
import { ThrottleModule } from '../../../common/throttle'
import { BuilderController } from './builder.controller'
import { BuilderRepository } from './builder.repository'
import { BuilderService } from './builder.service'
import { BijakBuilderPorts } from './ports'

/**
 * Paper builder (BE-39): the admin write side of the Bijak SPM papers. Exports `BijakBuilderPorts`
 * so the question module can provide the question source (see `ports.ts`).
 */
@Module({
  imports: [AuditModule, ThrottleModule],
  controllers: [BuilderController],
  providers: [BijakBuilderPorts, BuilderRepository, BuilderService],
  exports: [BijakBuilderPorts, BuilderRepository],
})
export class ExamBuilderModule {}
