import { Module } from '@nestjs/common'

import { VirusScanModule } from '../../modules/files/virus-scan'
import { JobsConfig } from '../../modules/jobs/jobs.config'
import { HealthController } from './health.controller'
import { ReadyController } from './ready.controller'
import { ReadyService } from './ready.service'

@Module({ imports: [VirusScanModule], controllers: [HealthController, ReadyController], providers: [ReadyService, JobsConfig] })
export class HealthModule {}
