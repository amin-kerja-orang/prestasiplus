/**
 * M14 keeps a read-only copy of the M05 BR-20 mastery scale (see data/mastery.ts). This pins the
 * two together so they cannot drift: thresholds, labels and the level function.
 */

import { describe, expect, it } from 'vitest'

// Deliberate deep import: M05 exports the scale only from its handlers (not its mock entry), and
// this test exists precisely to pin M14's copy to it.
/* eslint-disable no-restricted-imports */
// Evaluate M05's entry first so its handlers' import cycle resolves in the right order.
import '@/modules/m05-practice/mock'
import {
  MASTERY_LABELS as M05_LABELS,
  MASTERY_THRESHOLDS as M05_THRESHOLDS,
  masteryLevel as m05Level,
} from '@/modules/m05-practice/mock/handlers/learner'

import { MASTERY_LABELS, MASTERY_THRESHOLDS, masteryLevel } from '../../mock/data/mastery'

describe('M14 mastery scale equals M05 #14', () => {
  it('thresholds and labels are identical', () => {
    expect([...MASTERY_THRESHOLDS]).toEqual([...M05_THRESHOLDS])
    expect([...MASTERY_LABELS]).toEqual([...M05_LABELS])
  })

  it('masteryLevel agrees with M05 at every boundary and one either side', () => {
    const probes = new Set<number>([0, 1, 5000])
    for (const t of M05_THRESHOLDS) for (const d of [-1, 0, 1]) probes.add(Math.max(0, t + d))
    for (const n of probes) expect(masteryLevel(n)).toBe(m05Level(n))
  })
})
