import { Module } from '@nestjs/common'

import { GamesCoreModule } from '../core/core.module'

/**
 * Leagues area (agent D): leagues (list/create/join/detail; declare `join` before `:id`) and Sekolah Bersaing.
 * Fill `controllers` and `providers`; do not edit any other module file.
 */
@Module({
  imports: [GamesCoreModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class LeaguesModule {}
