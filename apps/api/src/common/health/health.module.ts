import { Module } from '@nestjs/common'

import { JobsConfig } from '../../modules/jobs/jobs.config'
import { HealthController } from './health.controller'
import { ReadyController } from './ready.controller'
import { ReadyService } from './ready.service'

@Module({ controllers: [HealthController, ReadyController], providers: [ReadyService, JobsConfig] })
export class HealthModule {}
