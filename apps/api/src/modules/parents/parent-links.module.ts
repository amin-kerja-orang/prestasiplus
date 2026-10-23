import { Module } from '@nestjs/common'

import { ParentsRepository } from './parents.repository'

/**
 * Holds `ParentsRepository`, the only doorway to `parent_invites` and `parent_links` (ADR-0014), on its own so
 * that `UsersModule` (admin parent links) and `ParentsModule` (which imports `UsersModule`) can both use the
 * one instance without a module cycle.
 */
@Module({
  providers: [ParentsRepository],
  exports: [ParentsRepository],
})
export class ParentLinksModule {}
