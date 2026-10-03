/**
 * Seed of the provisional stores hosted in M17 (F-33), written through their repositories only
 * (overview §3 rule 3a):
 *
 * - `seedM17Provisional()` (seed phase): tuition centres (2), observed. (Sponsors moved to M21.)
 * - `finaliseM17Provisional()` (after the users dataset has compiled): the 750 mood check-ins,
 *   drawn over active pupils, then the build check (a mismatch stops the boot).
 */

import { fnv1a32 } from '@/mock/determinism/hash'
import { mulberry32 } from '@/mock/determinism/prng'
import { users } from '@/modules/m01-authentication/mock'

import { moodCheckinsRepo, MOOD_TOTAL, MOOD_TOTALS } from '../repository/provisional-mood'
import { tuitionCentresRepo } from '../repository/provisional-tuition'
import { MOODS, type Mood, type MoodCheckinRow } from '../repository/provisional-types'
import {
  EXCLUDED_MOOD_USERS,
  MOOD_PUPILS,
  MOOD_REASONS,
  MOOD_WINDOW,
  TUITION_CENTRES,
} from './provisional-data'

const DAY_MS = 86_400_000

function isoDay(offset: number): string {
  return new Date(Date.parse(`${MOOD_WINDOW.from}T00:00:00Z`) + offset * DAY_MS)
    .toISOString()
    .slice(0, 10)
}

export function seedM17Provisional(): void {
  tuitionCentresRepo.seed(TUITION_CENTRES)
}

/** The 750 check-ins: the observed mood counts exactly, everything else INFERRED (see the data file). */
export function buildMoodCheckins(pupilIds: readonly number[]): MoodCheckinRow[] {
  if (pupilIds.length === 0) throw new Error('M17 mood seed: no pupils to attach check-ins to')
  const moods: Mood[] = []
  for (const mood of MOODS) for (let i = 0; i < MOOD_TOTALS[mood]; i++) moods.push(mood)
  const rng = mulberry32(fnv1a32('m17:mood:checkins'))
  rng.shuffle(moods)
  return moods.map((mood, i) => {
    const reasons = MOOD_REASONS[mood]
    return {
      id: i + 1,
      userId: pupilIds[i % pupilIds.length] as number,
      mood,
      reason: reasons[rng.int(0, reasons.length - 1)] ?? null,
      date: isoDay(rng.int(0, MOOD_WINDOW.days - 1)),
    }
  })
}

export function finaliseM17Provisional(): void {
  const rng = mulberry32(fnv1a32('m17:mood:pupils'))
  const excluded = new Set(EXCLUDED_MOOD_USERS)
  const pupils = users
    .sample('U-ROLE-ACTIVE', MOOD_PUPILS + excluded.size, rng, 'student', true)
    .map((u) => u.id)
    .filter((id) => !excluded.has(id))
    .slice(0, MOOD_PUPILS)
    .sort((a, b) => a - b)
  moodCheckinsRepo.seed(buildMoodCheckins(pupils))

  // Build check: the documented figures of the named queries (M17 §6.4).
  const issues: string[] = []
  const expectCount = (label: string, got: number, want: number) => {
    if (got !== want) issues.push(`${label}: ${String(got)} instead of ${String(want)}`)
  }
  expectCount('Q-M17-MOOD', moodCheckinsRepo.count('Q-M17-MOOD'), MOOD_TOTAL)
  for (const mood of MOODS) {
    expectCount(`Q-M17-MOOD ${mood}`, moodCheckinsRepo.count('Q-M17-MOOD', mood), MOOD_TOTALS[mood])
  }
  expectCount('mood pupils', pupils.length, MOOD_PUPILS)
  expectCount('mood check-ins from 2026-09-01', moodCheckinsRepo.total({ from: '2026-09-01' }), 0)
  expectCount('mood check-ins of pupil 2022', moodCheckinsRepo.total(undefined, 2022), 0)
  expectCount('Q-M17-TUITION', tuitionCentresRepo.count('Q-M17-TUITION'), 2)
  if (issues.length > 0) {
    throw new Error(
      `M17 provisional store build check failed:\n${issues.map((m) => `- ${m}`).join('\n')}`,
    )
  }
}
