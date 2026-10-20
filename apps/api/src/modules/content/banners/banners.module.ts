import { Module } from '@nestjs/common'

import { AuditModule } from '../../../common/audit/audit.module'
import { ThrottleModule } from '../../../common/throttle'
import { AuthModule } from '../../auth'
import { ActiveBannersController, AdminBannersController } from './banners.controller'
import { BannersRepository } from './banners.repository'
import { BannersService } from './banners.service'

/** Banners: the admin CRUD and the dashboard carousel (BE-24 part A). */
@Module({
  imports: [AuditModule, AuthModule, ThrottleModule],
  controllers: [AdminBannersController, ActiveBannersController],
  providers: [BannersRepository, BannersService],
  exports: [BannersRepository],
})
export class BannersModule {}
