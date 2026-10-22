import { Inject, Injectable } from '@nestjs/common'
import {
  PRACTICE_READS_HISTORY_PAGE_SIZE,
  PRACTICE_READS_MASTERY_LABELS,
  PRACTICE_READS_MESSAGES,
  type PracticeReadCorrectionsSchema,
  type PracticeReadHistoryItem,
  type PracticeReadMastery,
  type PracticeReadProgress,
} from '@pp/contract'
import type { z } from 'zod'

import { ApiError } from '../../../../common/errors/api-error'
import { listMeta } from '../../../../common/http/respond'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import {
  DAY_MS,
  dayLabel,
  historyBadge,
  masteryCard,
  MONTH_RE,
  monthKeyOf,
  monthKeyWindow,
  monthWindow,
  pct,
  round,
  shiftMonth,
  startOfMytDay,
  weekStartOf,
  yearWindow,
  type Window,
} from './analytics.calc'
import { PracticeAnalyticsRepository, type SubjectRow } from './analytics.repository'

type Corrections = z.infer<typeof PracticeReadCorrectionsSchema>

const PERIOD_DAYS: Readonly<Record<string, number>> = { '7': 7, '30': 30, '90': 90 }

const notFound = (): ApiError => ApiError.of('NOT_FOUND', { message: PRACTICE_READS_MESSAGES.notFound })

const emptyProgress = (): PracticeReadProgress => ({
  period: null,
  answered: 0,
  accuracyPct: null,
  sessions: 0,
  minutes: 0,
  chart: { labels: [], accuracy: [], counts: [] },
  weakSubjects: [],
  subjects: [],
})

/** Analytics views of the signed-in user (S6 to S9, S11, S12): always the caller's own data. */
@Injectable()
export class PracticeAnalyticsService {
  constructor(
    @Inject(PracticeAnalyticsRepository) private readonly repo: PracticeAnalyticsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** S6. Distinct queued questions per active subject (BR-01 order); `total` counts every eligible queue row. */
  async revisionOverview(userId: string) {
    const [subjects, bySubject] = await Promise.all([this.repo.subjects(), this.repo.eligibleQueueBySubject(userId)])
    let total = 0
    for (const n of bySubject.values()) total += n
    return {
      total,
      subjects: subjects.flatMap((s) => {
        const count = s.isActive ? (bySubject.get(s.id) ?? 0) : 0
        return count > 0 ? [{ code: s.code, name: s.name, nameEn: s.nameEn, icon: s.icon, color: s.color, count }] : []
      }),
    }
  }

  /** S7 guard. Unknown or inactive code is 404; a count of 0 is still 200. */
  async revisionSubject(userId: string, code: string) {
    const subject = (await this.repo.subjects()).find((s) => s.isActive && s.code === code.toUpperCase())
    if (!subject) throw notFound()
    const bySubject = await this.repo.eligibleQueueBySubject(userId)
    return {
      subject: { id: subject.id, code: subject.code, name: subject.name, color: subject.color },
      count: bySubject.get(subject.id) ?? 0,
    }
  }

  /** S8 (BR-19). An unknown period is a 200 with period null and zero figures. */
  async progress(userId: string, rawPeriod: string | undefined): Promise<PracticeReadProgress> {
    const period = rawPeriod ?? '30'
    if (period !== 'all' && !Object.hasOwn(PERIOD_DAYS, period)) return emptyProgress()
    const now = this.clock.now().getTime()
    let from: Date | null = null
    let to: Date | null = null
    if (period !== 'all') {
      from = new Date(startOfMytDay(now) - ((PERIOD_DAYS[period] as number) - 1) * DAY_MS)
      to = new Date(startOfMytDay(now) + DAY_MS)
    }
    const [groups, totals, subjectRows] = await Promise.all([
      this.repo.answerDays(userId, from, to),
      this.repo.sessionTotals(userId, from, to),
      this.repo.subjects(),
    ])

    const byDay = new Map<string, { n: number; c: number }>()
    const bySubject = new Map<string, { n: number; c: number; days: Map<string, { n: number; c: number }> }>()
    let answered = 0
    let correct = 0
    for (const g of groups) {
      answered += g.n
      correct += g.c
      const d = byDay.get(g.day) ?? { n: 0, c: 0 }
      d.n += g.n
      d.c += g.c
      byDay.set(g.day, d)
      if (g.subjectId === null) continue
      const s = bySubject.get(g.subjectId) ?? { n: 0, c: 0, days: new Map() }
      s.n += g.n
      s.c += g.c
      s.days.set(g.day, { n: g.n, c: g.c })
      bySubject.set(g.subjectId, s)
    }

    const order = new Map(subjectRows.map((s, i) => [s.id, i]))
    const byId = new Map(subjectRows.map((s) => [s.id, s]))
    const subjects = [...bySubject.entries()]
      .flatMap(([id, s]) => {
        const subject = byId.get(id)
        if (!subject) return []
        return [
          {
            id,
            row: {
              code: subject.code,
              name: subject.name,
              color: subject.color,
              answered: s.n,
              correct: s.c,
              wrong: s.n - s.c,
              accuracyPct: round(pct(s.c, s.n), 1),
              trend: [...s.days.keys()].sort().map((k) => round(pct((s.days.get(k) as { c: number }).c, (s.days.get(k) as { n: number }).n), 1)),
            },
          },
        ]
      })
      .sort((a, b) => b.row.answered - a.row.answered || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
    const days = [...byDay.keys()].sort()

    return {
      period: period as PracticeReadProgress['period'],
      answered,
      accuracyPct: answered === 0 ? null : round(pct(correct, answered), 1),
      sessions: totals.sessions,
      minutes: Math.floor(totals.seconds / 60),
      chart: {
        labels: days.map(dayLabel),
        accuracy: days.map((k) => round(pct((byDay.get(k) as { c: number }).c, (byDay.get(k) as { n: number }).n), 1)),
        counts: days.map((k) => (byDay.get(k) as { n: number }).n),
      },
      weakSubjects: subjects
        .filter((s) => pct(s.row.correct, s.row.answered) < 50)
        .map((s) => ({ code: s.row.code, name: s.row.name, color: s.row.color, answered: s.row.answered, accuracyPct: s.row.accuracyPct })),
      subjects: subjects.map((s) => s.row),
    }
  }

  /** S9 (BR-21). Totals are all-time; the period only narrows the page. Page size is fixed at 15. */
  async history(userId: string, rawPeriod: string | undefined, rawPage: string | undefined) {
    const now = this.clock.now().getTime()
    let window: Window | null = null
    if (rawPeriod === 'week') {
      const from = weekStartOf(now)
      window = { from, to: from + 7 * DAY_MS }
    } else if (rawPeriod === 'month') window = monthWindow(now)
    else if (rawPeriod === 'year') window = yearWindow(now)
    const from = window ? new Date(window.from) : null
    const to = window ? new Date(window.to) : null
    const page = positiveInt(rawPage) ?? 1
    const size = PRACTICE_READS_HISTORY_PAGE_SIZE

    const [totals, count, rows] = await Promise.all([
      this.repo.historyTotals(userId),
      this.repo.historyCount(userId, from, to),
      this.repo.historyPage(userId, from, to, size, (page - 1) * size),
    ])
    const data: PracticeReadHistoryItem[] = rows.map((s) => ({
      id: s.id,
      mode: s.mode,
      badge: historyBadge(s.mode),
      completedAt: toMytTimestamp(s.completedAt),
      questionCount: s.questionCount,
      correctCount: s.correctCount,
      wrongCount: s.questionCount - s.correctCount,
      accuracyPct: round(pct(s.correctCount, s.questionCount), 2),
      timeSpent: s.timeSpentSec,
      coinsEarned: s.coinsEarned,
    }))
    return { data, meta: { ...listMeta(page, size, count), totals } }
  }

  /** S11 (BR-18). A missing or malformed month shows the current one. */
  async corrections(userId: string, asked: string | undefined): Promise<Corrections> {
    const current = monthKeyOf(this.clock.now().getTime())
    const month = asked !== undefined && MONTH_RE.test(asked) ? asked : current
    const win = monthKeyWindow(month)
    const [runs, subjectRows] = await Promise.all([
      this.repo.correctionRuns(userId, new Date(win.from), new Date(win.to)),
      this.repo.subjects(),
    ])
    const tally = new Map<string, { n: number; before: number; after: number }>()
    for (const run of runs) {
      const t = tally.get(run.subjectId) ?? { n: 0, before: 0, after: 0 }
      t.n++
      if (run.firstCorrect) {
        t.before++
        t.after++
      } else if (run.laterCorrect) t.after++
      tally.set(run.subjectId, t)
    }
    const total = [...tally.values()].reduce((a, t) => ({ n: a.n + t.n, before: a.before + t.before, after: a.after + t.after }), { n: 0, before: 0, after: 0 })
    const order = new Map(subjectRows.map((s, i) => [s.id, i]))
    const byId = new Map<string, SubjectRow>(subjectRows.map((s) => [s.id, s]))
    const subjects = [...tally.entries()]
      .flatMap(([id, t]) => {
        const subject = byId.get(id)
        return subject ? [{ id, subject, t }] : []
      })
      .sort((a, b) => b.t.n - a.t.n || (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0))
      .map(({ subject, t }) => ({
        name: subject.name,
        color: subject.color,
        questions: t.n,
        before: round(pct(t.before, t.n), 1),
        after: round(pct(t.after, t.n), 1),
        delta: round(pct(t.after, t.n) - pct(t.before, t.n), 1),
      }))
    return {
      month,
      prevMonth: shiftMonth(month, -1),
      nextMonth: month < current ? shiftMonth(month, 1) : null,
      summary:
        total.n === 0
          ? null
          : {
              before: round(pct(total.before, total.n), 1),
              after: round(pct(total.after, total.n), 1),
              delta: round(pct(total.after, total.n) - pct(total.before, total.n), 1),
              questions: total.n,
            },
      subjects,
    }
  }

  /** S12 (BR-20). One card per answered active subject, M03 order. */
  async mastery(userId: string): Promise<PracticeReadMastery> {
    const [rows, subjectRows] = await Promise.all([this.repo.mastery(userId), this.repo.subjects()])
    const byId = new Map(rows.map((r) => [r.subjectId, r]))
    return {
      scale: PRACTICE_READS_MASTERY_LABELS.map((label, level) => ({ level, label })),
      subjects: subjectRows.flatMap((s) => {
        const m = byId.get(s.id)
        return m && s.isActive ? [masteryCard(s, m)] : []
      }),
    }
  }
}

function positiveInt(value: string | undefined): number | undefined {
  if (value === undefined || !/^\d+$/.test(value.trim())) return undefined
  const n = Number(value.trim())
  return Number.isSafeInteger(n) && n >= 1 && n <= 1_000_000_000 ? n : undefined
}
