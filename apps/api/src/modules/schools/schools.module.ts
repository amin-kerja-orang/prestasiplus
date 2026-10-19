import { Module } from '@nestjs/common'

import { SchoolsRepository } from './schools.repository'

/**
 * Schools, JPN and PPD (BE-05 part B). The module exports `SchoolsRepository`, the only doorway to
 * the `schools`, `jpns` and `ppds` tables.
 */
@Module({
  providers: [SchoolsRepository],
  exports: [SchoolsRepository],
})
export class SchoolsModule {}
