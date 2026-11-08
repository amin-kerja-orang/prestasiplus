import { Module } from '@nestjs/common'

import { AuditModule } from '../../common/audit'
import { ThrottleModule } from '../../common/throttle'
import { NotificationsModule } from '../notifications'
import { WalletModule } from '../wallet'
import { BOX_RANDOM, CsprngBoxRandom } from './box-random'
import { ShopAdminController } from './admin.controller'
import { ShopAdminService } from './admin.service'
import { DrawWinnersService } from './draw-winners.service'
import { RewardSettingsService } from './reward-settings.service'
import { ShopController } from './shop.controller'
import { ShopPorts } from './shop.ports'
import { ShopRepository } from './shop.repository'
import { ShopService } from './shop.service'

/**
 * M15 rewards shop (BE-23 part B): the Hadiah catalogue and its redemption queue (admin), token redemption, Kotak
 * Misteri, Cabutan Bertuah tickets and the Kedai Hadiah Digital reads. Coins and tokens move ONLY through
 * `WalletService` (BE-11), in the same transaction as the shop write. The parent approval routes are not built (UD-3).
 */
@Module({
  imports: [AuditModule, ThrottleModule, WalletModule, NotificationsModule],
  controllers: [ShopController, ShopAdminController],
  providers: [ShopRepository, ShopService, ShopAdminService, RewardSettingsService, DrawWinnersService, ShopPorts, { provide: BOX_RANDOM, useValue: CsprngBoxRandom }],
  exports: [RewardSettingsService, DrawWinnersService, ShopRepository, ShopPorts],
})
export class ShopModule {}
