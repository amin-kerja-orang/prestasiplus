import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../../common/throttle'
import { IntakeDashboardController } from './intake-dashboard.controller'
import { INTAKE_DASHBOARD_SOURCE } from './intake-dashboard.ports'
import { IntakeDashboardService } from './intake-dashboard.service'
import { SqlIntakeDashboardSource } from './sql-intake-dashboard.source'

/**
 * BE-40 intake dashboard and AI cost (read models only, no table of its own). The source is bound through a token so a
 * test or a later card can swap it; the default reads the BE-36/37/38 tables and degrades per store while they are missing.
 */
@Module({
  imports: [ThrottleModule],
  controllers: [IntakeDashboardController],
  providers: [IntakeDashboardService, SqlIntakeDashboardSource, { provide: INTAKE_DASHBOARD_SOURCE, useExisting: SqlIntakeDashboardSource }],
})
export class IntakeDashboardModule {}
