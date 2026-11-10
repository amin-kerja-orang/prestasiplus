import { Module } from '@nestjs/common'

import { VirusScanConfig } from './virus-scan.config'
import { VirusScanService } from './virus-scan.service'

@Module({ providers: [VirusScanConfig, VirusScanService], exports: [VirusScanService, VirusScanConfig] })
export class VirusScanModule {}
