import { Module } from '@nestjs/common'

import { ThrottleModule } from '../../common/throttle'
import { MarketplaceController } from './marketplace.controller'
import { MarketplaceRepository } from './marketplace.repository'
import { MarketplaceService } from './marketplace.service'

/** M20 Marketplace, buyer slice (BE-46). Owns the five `marketplace_*` tables; exports nothing yet. */
@Module({
  imports: [ThrottleModule],
  controllers: [MarketplaceController],
  providers: [MarketplaceRepository, MarketplaceService],
})
export class MarketplaceModule {}
