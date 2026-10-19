/**
 * Q-M27-USAGE (SRS §18.3; BR-M27-21 to 23; FR-M27-51 to 57), screen S1.
 *
 * Build-plan M27.1 item 3: the M05 school facet exists only for the monitoring segment, so the school's
 * sessions and answers are read per pupil, windowed, through the public `practice.history` and
 * `practice.answers` (no M05 change). Computed once per request, never cached across requests.
 */

import { DAY_MS, startOfDay } from '@/lib/time'
import { practice } from '@/modules/m05-practice/mock'

import type { SchoolUsage, SchoolUsageMode, UsagePeriod } from '../../api/school-admin'
import { countOf, peopleOf } from './school-people'
import { schoolRefOf } from './school-info'
import type { SchoolViewer } from './school-scope'

export const PERIOD_LABEL: Readonly<Record<UsagePeriod, SchoolUsage['label']>> = {
  today: 'Hari Ini',
  '7days': '7 Hari',
  '30days': '30 Hari',
}

/** BR-M27-21: a missing or unknown value gives `30days`. */
export function parsePeriod(raw: string | undefined): UsagePeriod {
  return raw === 'today' || raw === '7days' || raw === '30days' ? raw : '30days'
}

/** BR-M27-21: `today` = 00:00 MYT to now; the others are the last N x 24 h. Half-open `[from, to)`. */
export function windowOf(period: UsagePeriod, now: number): { from: number; to: number } {
  const from = period === 'today' ? startOfDay(now) : now - (period === '7days' ? 7 : 30) * DAY_MS
  return { from, to: now + 1 }
}

/** BR-M27-23: the M05 S9 label of a mode. */
export function modeLabel(mode: string): string {
  switch (mode) {
    case 'chapter':
      return 'Bab'
    case 'revision':
      return 'Ulang Kaji'
    case 'ramalan':
      return 'Tracking A'
    case 'pksk':
      return 'PKSK'
    default:
      // random, past_year, latih_tubi, mission, remedial, question_set
      return 'Latihan'
  }
}

/** One decimal, half up (M05 Q-SESS-MEAN-ACC). */
export const round1 = (n: number): number => Math.round(n * 10) / 10

/** Mean of the percentages, one decimal; null when there are none. */
export function meanOf(values: readonly number[]): number | null {
  return values.length === 0 ? null : round1(values.reduce((a, b) => a + b, 0) / values.length)
}

export function buildSchoolUsage(
  viewer: SchoolViewer,
  period: UsagePeriod,
  now: number,
): SchoolUsage {
  const { schoolId } = viewer
  const { from, to } = windowOf(period, now)
  const pupils = peopleOf(schoolId, 'student')

  const accuracies: number[] = []
  const byLabel = new Map<string, { sessions: number; accuracies: number[] }>()
  let sessions = 0
  let answers = 0
  let activePupils = 0
  for (const pupil of pupils) {
    const done = practice.history(pupil.id, { from, to })
    for (const s of done) {
      sessions += 1
      const group = byLabel.get(modeLabel(s.mode)) ?? { sessions: 0, accuracies: [] }
      group.sessions += 1
      // Q-SESS-MEAN-ACC: a session with questionCount 0 is skipped in the mean.
      if (s.questionCount > 0) {
        const acc = (s.correctCount / s.questionCount) * 100
        accuracies.push(acc)
        group.accuracies.push(acc)
      }
      byLabel.set(modeLabel(s.mode), group)
    }
    const n = practice.answers(pupil.id, { from, to }).length
    answers += n
    if (n > 0) activePupils += 1
  }

  const registered = pupils.length
  const modes: SchoolUsageMode[] = [...byLabel.entries()]
    .map(([label, g]) => ({ label, sessions: g.sessions, accuracy: meanOf(g.accuracies) }))
    .sort((a, b) => b.sessions - a.sessions || a.label.localeCompare(b.label, 'ms-MY'))

  return {
    school: schoolRefOf(viewer),
    period,
    label: PERIOD_LABEL[period],
    tiles: {
      pupils: countOf(schoolId, 'student'),
      teachers: countOf(schoolId, 'teacher'),
      activePupils,
      participationPct: registered > 0 ? Math.round((activePupils / registered) * 100) : 0,
      sessions,
      answers,
      accuracy: meanOf(accuracies),
    },
    modes,
  }
}
