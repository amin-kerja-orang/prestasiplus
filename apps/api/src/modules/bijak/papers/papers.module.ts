import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { BijakPapersAttemptSource } from './attempt-source'
import { PapersController } from './papers.controller'
import { PapersRepository } from './papers.repository'
import { PapersService } from './papers.service'
import { BijakPapersPorts } from './ports'

/**
 * Bijak SPM papers and blueprints (M28, BE-15): the read side of the Kertas Pilihan list, the paper
 * cover, the Kontrak list, the subject hub and "Jana Kertas". Exports `PapersService`
 * (`getSittablePaper` for the attempts card BE-16), `PapersRepository` (BE-39 writes through it) and
 * `BijakPapersPorts` (BE-09 provides the question source, BE-16 the progress and served sources, see
 * `ports.ts`). Neither card edits this file.
 *
 * `BijakPapersAttemptSource` is registered with `BijakAttemptPorts.providePaperSource(...)` by
 * `BijakIntegrationModule` (`bijak/integration`), so this module's own test app stays standalone.
 */
@Module({
  imports: [ThrottleModule],
  controllers: [PapersController],
  providers: [PapersRepository, PapersService, BijakPapersPorts, BijakPapersAttemptSource],
  exports: [PapersService, PapersRepository, BijakPapersPorts, BijakPapersAttemptSource],
})
export class BijakPapersModule {}
