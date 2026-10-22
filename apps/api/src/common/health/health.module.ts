import { Module } from '@nestjs/common'

import { HealthController } from './health.controller'
import { ReadyController } from './ready.controller'
import { ReadyService } from './ready.service'

@Module({ controllers: [HealthController, ReadyController], providers: [ReadyService] })
export class HealthModule {}
