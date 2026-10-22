import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { UsersModule } from '../users'
import { FosterApplicationsRepository } from './foster-applications.repository'
import { SponsorshipController } from './sponsorship.controller'
import { SponsorshipService } from './sponsorship.service'

/**
 * Sponsorship, student side (M21, BE-47): the Mohon Keluarga Angkat application. Exports `FosterApplicationsRepository`,
 * the only doorway to `foster_applications` (ADR-0014). The Penaja role and the admin review are out of B1 (D48).
 */
@Module({
  imports: [ThrottleModule, UsersModule],
  controllers: [SponsorshipController],
  providers: [FosterApplicationsRepository, SponsorshipService],
  exports: [FosterApplicationsRepository],
})
export class SponsorshipModule {}
