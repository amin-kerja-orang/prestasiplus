/**
 * M16 documented display constants (D11 exception, overview §6.6).
 *
 * - DC-M16-01 (DV-M16-32): the S3 subtitle "Ranking 10,218 sekolah seluruh Malaysia" while the M02
 *   register holds 10,220 schools (10,212 active); no M02 named query gives 10,218. Shown in that
 *   subtitle only. DC-M16-02 is retired (M04 Q-JUT-COUNT). DC-M16-03 (the stored Ketepatan and Skor of
 *   the 8 observed school standings) lives in the seed data (`data/battles.ts`, `StoredStandingRow`).
 */

import { defineDisplayConstant } from '@/mock/dataset/display-constants'

export const S3_SCHOOL_COUNT = defineDisplayConstant({
  module: 'M16',
  name: 'rankingSchoolCount',
  value: 10_218,
  dv: 'DV-M16-32',
  shownOn: ['S3'],
  note: 'S3 subtitle only; mirrored in api/constants.ts for the page header.',
})
