/**
 * M17 display constant of the S11 "Laporan Statistik" overview (SRS M17 DC-M17-06; ADR-0013):
 * "Skor Purata" 44.6 % and the chip "Struktur: 6.7 %". Observed on live, constant across the three ranges
 * while the activity changes; no M05 / M16 score definition reproduces 44.6 %. It belongs to the PLATFORM
 * view only: a school report never carries it (M27 BR-M27-26, XR-M27-15).
 *
 * The URS has no DV id for DC-M17-06; like the S2 constants it is registered under DV-M17-24 (reported as
 * an SRS gap) so `listDisplayConstants()` lists it.
 */

import { defineDisplayConstant } from '@/mock/dataset'

export interface StatsScoreConstant {
  readonly score: number
  readonly structured: number
}

/** DC-M17-06. */
export const DC_M17_06: StatsScoreConstant = Object.freeze({ score: 44.6, structured: 6.7 })

defineDisplayConstant({
  module: 'M17',
  name: 'statsScore',
  value: `${String(DC_M17_06.score)}|${String(DC_M17_06.structured)}`,
  dv: 'DV-M17-24',
  shownOn: ['S11'],
  note: 'DC-M17-06: "Skor Purata" 44.6% and chip "Struktur: 6.7%"; platform view only.',
})
