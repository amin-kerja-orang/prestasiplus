import { Inject, Injectable } from '@nestjs/common'
import type { SchoolAdminMonthlyMonthRow, SchoolAdminMonthlyReport, SchoolAdminMonthlySubjectRow } from '@pp/contract'

import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { AnalyticsRepository } from '../../reports/analytics/analytics.repository'
import { compareIds } from '../../reports/analytics/domain/rules'
import { K_COHORT } from '../school-admin.constants'
import { SchoolPopulation } from './population'
import {
  accuracyOf,
  currentMonth,
  lastTwelve,
  minuteOf,
  monthEnd,
  monthKey,
  monthLabel,
  monthOf,
  monthStart,
  participationOf,
  round1,
  shiftMonth,
} from './windows'

/**
 * S5 monthly report (mock `monthly`): the shown month's cards, a 12-month series, and the subject strengths of the shown month.
 * A month is listed only when it has at least one completed session and at least `K_COHORT` pupils answered in it (a smaller
 * group is never shown). Subject rows are the same: a subject answered by fewer than `K_COHORT` pupils is left out.
 * Answers, correct answers, active pupils and accuracy are the XS-4 / XS-2 / XS-5 figures of `XsQueries` (answer rows, all modes, pooled),
 * per MYT calendar month; the session count of a month is a session read and stays a separately named figure.
 */
@Injectable()
export class MonthlyService {
  constructor(
    @Inject(SchoolPopulation) private readonly population: SchoolPopulation,
    @Inject(AnalyticsRepository) private readonly analytics: AnalyticsRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  async report(schoolId: string, rawBulan: string | undefined): Promise<SchoolAdminMonthlyReport> {
    const nowDate = this.clock.now()
    const now = nowDate.getTime()
    const shown = monthOf(rawBulan, now)
    const current = currentMonth(now)
    const series = lastTwelve(shown)
    const school = await this.population.school(schoolId)
    const pupils = await this.population.pupils(schoolId)
    const ids = pupils.map((p) => p.id)

    const from = monthStart(series[0] as { year: number; month: number })
    const to = monthEnd(shown)
    const [rows, answered] = await Promise.all([this.population.sessions(ids, from, to), this.population.tallyByMonth(schoolId, from, to)])
    const perMonth = new Map<string, { sessions: number; answers: number; correct: number; users: number }>()
    for (const [key, t] of answered) perMonth.set(key, { sessions: 0, answers: t.answered, correct: t.correct, users: t.pupils })
    for (const r of rows) {
      const key = r.day.slice(0, 7)
      const m = perMonth.get(key) ?? { sessions: 0, answers: 0, correct: 0, users: 0 }
      m.sessions += r.sessions
      perMonth.set(key, m)
    }

    const shownKey = monthKey(shown)
    const sm = perMonth.get(shownKey)
    const hasData = (sm?.answers ?? 0) > 0
    // A group under the cohort size is never shown: the cards keep the counts, hide the accuracy, and the month leaves the series.
    const showable = hasData && (sm?.users ?? 0) >= K_COHORT

    const months: SchoolAdminMonthlyMonthRow[] = []
    if (showable) {
      for (const ym of series) {
        const m = perMonth.get(monthKey(ym))
        if (!m || m.sessions === 0 || m.users < K_COHORT) continue
        months.push({
          month: monthKey(ym),
          label: monthLabel(ym),
          answers: m.answers,
          correct: m.correct,
          activePupils: m.users,
          perPupil: m.users > 0 ? round1(m.answers / m.users) : 0,
          accuracy: accuracyOf(m.correct, m.answers) ?? 0,
        })
      }
    }
    const totalAnswers = months.reduce((n, m) => n + m.answers, 0)
    const totalCorrect = months.reduce((n, m) => n + m.correct, 0)

    const active = sm?.users ?? 0
    const next = shifted(shown, 1, current)
    return {
      school,
      month: shownKey,
      label: monthLabel(shown),
      prev: monthKey(shiftMonth(shown, -1)),
      next,
      cards: {
        participationPct: participationOf(active, pupils.length),
        active,
        registered: pupils.length,
        answers: sm?.answers ?? 0,
        perPupil: active > 0 ? Math.round((sm?.answers ?? 0) / active) : 0,
        accuracy: showable ? accuracyOf(sm?.correct ?? 0, sm?.answers ?? 0) : null,
        sessions: sm?.sessions ?? 0,
      },
      months,
      total: months.length > 1 ? { answers: totalAnswers, correct: totalCorrect, accuracy: accuracyOf(totalCorrect, totalAnswers) } : null,
      subjects: showable ? await this.subjects(ids, shown) : { strongest: null, weakest: null, rows: [] },
      generatedAt: toMytTimestamp(new Date(minuteOf(now))),
    }
  }

  private async subjects(ids: readonly string[], shown: { year: number; month: number }): Promise<SchoolAdminMonthlyReport['subjects']> {
    const tallies = await this.population.subjectTallies(ids, monthStart(shown), monthEnd(shown))
    const per = new Map<string, { answers: number; correct: number; users: Set<string> }>()
    for (const t of tallies) {
      const s = per.get(t.subjectId) ?? { answers: 0, correct: 0, users: new Set<string>() }
      s.answers += t.answers
      s.correct += t.correct
      s.users.add(t.userId)
      per.set(t.subjectId, s)
    }
    const names = await this.analytics.subjectNames([...per.keys()])
    const rows: (SchoolAdminMonthlySubjectRow & { id: string })[] = []
    for (const [id, s] of per) {
      if (s.users.size < K_COHORT || s.answers === 0) continue
      rows.push({ id, name: names.get(id) ?? '', accuracy: accuracyOf(s.correct, s.answers) ?? 0, answers: s.answers, pupils: s.users.size })
    }
    rows.sort((a, b) => b.accuracy - a.accuracy || b.answers - a.answers || compareIds(a.id, b.id))
    const wire: SchoolAdminMonthlySubjectRow[] = rows.map((r) => ({ name: r.name, accuracy: r.accuracy, answers: r.answers, pupils: r.pupils }))
    return { strongest: wire[0] ?? null, weakest: wire.at(-1) ?? null, rows: wire }
  }
}

/** The month after `ym` as a key, or null while `ym` is the current month. */
function shifted(ym: { year: number; month: number }, n: number, current: { year: number; month: number }): string | null {
  return monthKey(ym) >= monthKey(current) ? null : monthKey(shiftMonth(ym, n))
}
