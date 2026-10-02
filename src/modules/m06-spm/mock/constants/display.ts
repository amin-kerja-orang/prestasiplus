/**
 * Documented display constants of M06 (D11 exception, overview §6.6; SRS M06 BR-M06-01, DV-M06-01):
 * the S1 hub figures that no named query on the dataset reproduces (Σ `spmPool` = 21,033). They sit
 * outside the dataset fit, store changes never move them, and S1 never shows them next to a
 * contradicting computed figure (both chips are <= the total).
 */

import { defineDisplayConstant } from '@/mock/dataset/display-constants'

/** S1 "Jumlah Soalan" (observed live). */
export const HUB_TOTAL_QUESTIONS = defineDisplayConstant({
  module: 'M06',
  name: 'hubTotalQuestions',
  value: 20529,
  dv: 'DV-M06-01',
  shownOn: ['S1'],
  note: 'Observed live; no definition reproduces it.',
})

/** S1 chips "Databank Soalan" and "Latih Tubi SPM" (observed live, both 14,673). */
export const HUB_POOL_CHIP = defineDisplayConstant({
  module: 'M06',
  name: 'hubPoolChip',
  value: 14673,
  dv: 'DV-M06-01',
  shownOn: ['S1'],
  note: 'Observed live (both chips); S2-S4 count from the dataset instead.',
})
