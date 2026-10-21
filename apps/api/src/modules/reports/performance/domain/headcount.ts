/** Types of the headcount domain (the rules are added by BE-19 Part B in this file). */
export type HeadcountMode = 'auto' | 'manual'
export type HeadcountPairStatus = 'on' | 'below' | 'none'
export type HeadcountBand = 'above' | 'on' | 'below' | 'na'
export type HeadcountTone = 'on' | 'below' | 'noAr' | 'noTarget'

export interface LatestAr {
  /** 1-based checkpoint. */
  n: number
  ar: number
  target: number | null
}
