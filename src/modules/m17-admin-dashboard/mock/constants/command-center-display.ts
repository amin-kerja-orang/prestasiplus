/**
 * M17 display constants of the Command Center S2 board (SRS M17 v1.13 §6.3; ADR-0013 `DISPLAY_CONSTANT`):
 * observed figures that no definition on the owners' datasets reproduces. They belong to the PLATFORM view
 * only: a school admin never receives them (BR-M17-29, FR-M17-111, SEC-M17-13), the live-data builder returns
 * zeros and the 7-day school trend instead.
 *
 * - DC-M17-03 `899` records · `+0.0%` average improvement · `0%` good rate ("Pembetulan"): the correction
 *   definition is unobservable (M05 derives corrections per user and month, BR-M05-18);
 * - DC-M17-05 Champion 29 · Konsisten 11 · Berkembang 43 · Minimum 3 · Disengaged 2,229 ("Engagement" and the
 *   ALESA AI active ratio): bucket rules and population are unobservable (Σ 2,315 matches no population).
 *
 * The URS has no DV id for DC-M17-03; it is registered under DV-M17-24 (the other S2 constant panel, "replicate
 * live") so `listDisplayConstants()` lists both (reported as an SRS gap).
 */

import { defineDisplayConstant } from '@/mock/dataset'

export interface CorrectionConstant {
  readonly total: number
  readonly avgImprovement: number
  readonly improvedCount: number
}

export interface EngagementConstant {
  readonly champion: number
  readonly consistent: number
  readonly developing: number
  readonly minimum: number
  readonly disengaged: number
}

const CORRECTION: CorrectionConstant = Object.freeze({
  total: 899,
  avgImprovement: 0,
  improvedCount: 0,
})

const ENGAGEMENT: EngagementConstant = Object.freeze({
  champion: 29,
  consistent: 11,
  developing: 43,
  minimum: 3,
  disengaged: 2229,
})

defineDisplayConstant({
  module: 'M17',
  name: 'correctionPanel',
  value: `${String(CORRECTION.total)}|${String(CORRECTION.avgImprovement)}|${String(CORRECTION.improvedCount)}`,
  dv: 'DV-M17-24',
  shownOn: ['S2'],
  note: 'DC-M17-03: "899" Rekod · "+0.0%" Purata Naik · "0%" Kadar Baik; platform view only.',
})

defineDisplayConstant({
  module: 'M17',
  name: 'engagementBuckets',
  value: [
    ENGAGEMENT.champion,
    ENGAGEMENT.consistent,
    ENGAGEMENT.developing,
    ENGAGEMENT.minimum,
    ENGAGEMENT.disengaged,
  ].join('|'),
  dv: 'DV-M17-24',
  shownOn: ['S2'],
  note: 'DC-M17-05: Champion 29 · Konsisten 11 · Berkembang 43 · Minimum 3 · Disengaged 2,229; platform view only.',
})

/** DC-M17-03 (platform "Pembetulan"). */
export const DC_M17_03: CorrectionConstant = CORRECTION

/** DC-M17-05 (platform "Engagement" buckets). */
export const DC_M17_05: EngagementConstant = ENGAGEMENT
