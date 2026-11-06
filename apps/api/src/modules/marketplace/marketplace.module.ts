import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit'
import { ThrottleModule } from '../../common/throttle'
import { FilesModule } from '../files'
import { MarketplaceAdminController } from './marketplace-admin.controller'
import { MarketplaceAdminRepository } from './marketplace-admin.repository'
import { MarketplaceAdminService } from './marketplace-admin.service'
import { MarketplaceController } from './marketplace.controller'
import { MarketplaceRepository } from './marketplace.repository'
import { MarketplaceService } from './marketplace.service'

/** M20 Marketplace: the buyer slice (BE-46) and the admin Produk/Penjual slice (S7-T08). Owns the five `marketplace_*` tables; exports nothing yet. */
@Module({
  imports: [AuditModule, FilesModule, ThrottleModule],
  controllers: [MarketplaceController, MarketplaceAdminController],
  providers: [MarketplaceRepository, MarketplaceService, MarketplaceAdminRepository, MarketplaceAdminService],
})
export class MarketplaceModule {}
