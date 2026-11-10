import { Module } from '@nestjs/common'

import { AuditModule } from '../audit/audit.module'
import { FeatureFlagsController } from './feature-flags.controller'
import { FeatureFlagsService } from './feature-flags.service'

/**
 * Kawalan Ciri (S0-T10). `AuthModule` imports this module and registers `FeatureGuard` as an APP_GUARD BEFORE `AuthGuard`
 * (API-AUTH-16), and reads `FeatureFlagsService.featureMap()` for `GET /api/session`.
 */
@Module({
  imports: [AuditModule],
  controllers: [FeatureFlagsController],
  providers: [FeatureFlagsService],
  exports: [FeatureFlagsService],
})
export class FeatureFlagsModule {}
