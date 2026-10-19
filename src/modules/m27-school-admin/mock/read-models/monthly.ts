/**
 * Q-M27-MONTH (SRS §18.3; BR-M27-28, 29; FR-M27-81 to 87), screen S5.
 *
 * One windowed read per pupil over the 12 months ending with the shown month (the same per-pupil approach
 * as S1, build-plan M27.1 item 3), bucketed in memory by calendar month in Asia/Kuala_Lumpur.
 * "Statistik Bulanan" counts answers from the answer log (so answers without a session count) and lists a
 * month only when it has at least one completed session (M18 FN-M18-2.9.6).
 */

import { fromMytParts, monthName, mytParts, toIsoMyt } from '@/lib/time'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice } from '@/modules/m05-practice/mock'

import type { MonthlyMonthRow, MonthlyReport, MonthlySubjectRow } from '../../api/school-admin'
import { schoolRefOf } from './school-info'
import { peopleOf } from './school-people'
import type { SchoolViewer } from './school-scope'
import { round1 } from './usage'

const pad2 = (n: number) => String(n).padStart(2, '0')
const keyOf = (year: number, month: number) => `${String(year)}-${pad2(month)}`

/** Shifts a `YYYY-MM` key by whole months. */
function shift(year: number, month: number, by: number): { year: number; month: number } {
  const index = year * 12 + (month - 1) + by
  return { year: Math.floor(index / 12), month: (index % 12) + 1 }
}

const labelOf = (year: number, month: number) => `${monthName(month)} ${String(year)}`

/** BR-M27-28: `YYYY-MM`, not after the current month, else the current month. */
export function parseMonth(
  raw: string | undefined,
  now: number,
): { year: number; month: number; current: boolean } {
  const cur = mytParts(now)
  const m = raw === undefined ? null : /^(\d{4})-(0[1-9]|1[0-2])$/.exec(raw)
  if (m) {
    const year = Number(m[1])
    const month = Number(m[2])
    if (year * 12 + month <= cur.year * 12 + cur.month) {
      return { year, month, current: year === cur.year && month === cur.month }
    }
  }
  return { year: cur.year, month: cur.month, current: true }
}

interface Bucket {
  answers: number
  correct: number
  pupils: Set<number>
  sessions: number
}

const emptyBucket = (): Bucket => ({ answers: 0, correct: 0, pupils: new Set(), sessions: 0 })

export function buildMonthlyReport(
  viewer: SchoolViewer,
  rawMonth: string | undefined,
  now: number,
): MonthlyReport {
  const shown = parseMonth(rawMonth, now)
  const first = shift(shown.year, shown.month, -11)
  const after = shift(shown.year, shown.month, 1)
  const from = fromMytParts({ year: first.year, month: first.month, day: 1 })
  const to = fromMytParts({ year: after.year, month: after.month, day: 1 })
  const shownFrom = fromMytParts({ year: shown.year, month: shown.month, day: 1 })
  const shownKey = keyOf(shown.year, shown.month)

  const pupils = peopleOf(viewer.schoolId, 'student')
  const months = new Map<string, Bucket>()
  const bucketOf = (ms: number): Bucket => {
    const p = mytParts(ms)
    const key = keyOf(p.year, p.month)
    const b = months.get(key) ?? emptyBucket()
    months.set(key, b)
    return b
  }
  const subjects = new Map<number, Bucket>()

  for (const pupil of pupils) {
    for (const s of practice.history(pupil.id, { from, to })) {
      bucketOf(s.completedAtMs).sessions += 1
    }
    for (const a of practice.answers(pupil.id, { from, to })) {
      const b = bucketOf(a.answeredAtMs)
      b.answers += 1
      if (a.isCorrect) b.correct += 1
      b.pupils.add(pupil.id)
      if (a.answeredAtMs >= shownFrom && a.subjectId !== null) {
        const sb = subjects.get(a.subjectId) ?? emptyBucket()
        sb.answers += 1
        if (a.isCorrect) sb.correct += 1
        sb.pupils.add(pupil.id)
        subjects.set(a.subjectId, sb)
      }
    }
  }

  const cur = months.get(shownKey) ?? emptyBucket()
  const active = cur.pupils.size
  const registered = pupils.length
  const hasAnswers = cur.answers > 0

  const rows: MonthlyMonthRow[] = hasAnswers
    ? [...months.entries()]
        .filter(([, b]) => b.sessions > 0)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, b]) => {
          const [y, m] = key.split('-').map(Number) as [number, number]
          return {
            month: key,
            label: labelOf(y, m),
            answers: b.answers,
            correct: b.correct,
            activePupils: b.pupils.size,
            perPupil: b.pupils.size > 0 ? round1(b.answers / b.pupils.size) : 0,
            accuracy: b.answers > 0 ? round1((b.correct / b.answers) * 100) : 0,
          }
        })
    : []

  const totalAnswers = rows.reduce((a, r) => a + r.answers, 0)
  const totalCorrect = rows.reduce((a, r) => a + r.correct, 0)

  const subjectRows: (MonthlySubjectRow & { id: number })[] = hasAnswers
    ? [...subjects.entries()].map(([id, b]) => ({
        id,
        name: curriculum.subject(id)?.name ?? `Subjek ${String(id)}`,
        accuracy: round1((b.correct / b.answers) * 100),
        answers: b.answers,
        pupils: b.pupils.size,
      }))
    : []
  // BR-M27-29: ties by more answers, then subject id.
  const tie = (a: { answers: number; id: number }, b: { answers: number; id: number }) =>
    b.answers - a.answers || a.id - b.id
  const byStrong = [...subjectRows].sort((a, b) => b.accuracy - a.accuracy || tie(a, b))
  const byWeak = [...subjectRows].sort((a, b) => a.accuracy - b.accuracy || tie(a, b))
  const strip = ({ name, accuracy, answers, pupils: p }: MonthlySubjectRow): MonthlySubjectRow => ({
    name,
    accuracy,
    answers,
    pupils: p,
  })

  const prev = shift(shown.year, shown.month, -1)
  const minute = Math.floor(now / 60_000) * 60_000

  return {
    school: schoolRefOf(viewer),
    month: shownKey,
    label: labelOf(shown.year, shown.month),
    prev: keyOf(prev.year, prev.month),
    next: shown.current ? null : keyOf(after.year, after.month),
    cards: {
      participationPct: registered > 0 ? Math.round((active / registered) * 100) : 0,
      active,
      registered,
      answers: cur.answers,
      perPupil: active > 0 ? Math.round(cur.answers / active) : 0,
      accuracy: hasAnswers ? round1((cur.correct / cur.answers) * 100) : null,
      sessions: cur.sessions,
    },
    months: rows,
    total:
      rows.length > 1
        ? {
            answers: totalAnswers,
            correct: totalCorrect,
            accuracy: totalAnswers > 0 ? round1((totalCorrect / totalAnswers) * 100) : null,
          }
        : null,
    subjects: {
      strongest: byStrong[0] ? strip(byStrong[0]) : null,
      weakest: byWeak[0] ? strip(byWeak[0]) : null,
      rows: byStrong.map(strip),
    },
    generatedAt: toIsoMyt(minute),
  }
}
