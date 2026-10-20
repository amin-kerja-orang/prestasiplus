import type { Type } from '@nestjs/common'

import { AccountModule } from './account'
import { AuthModule } from './auth'
import { ParentsModule } from './parents'
import { FilesModule } from './files'
import { NotificationsModule } from './notifications'
import { SchoolsModule } from './schools'
import { SubscriptionsModule } from './subscriptions'
import { UsersModule } from './users'
import { CurriculumModule } from './curriculum'
import { WalletModule } from './wallet'

/**
 * Module registry. Each lane adds ONE import and ONE array entry for its Nest module
 * (append-only; never reorder). `app.module.ts` imports this list.
 */
export const featureModules: Type<unknown>[] = [AuthModule, SchoolsModule, UsersModule, FilesModule, ParentsModule, SubscriptionsModule, NotificationsModule, AccountModule, CurriculumModule, WalletModule]
