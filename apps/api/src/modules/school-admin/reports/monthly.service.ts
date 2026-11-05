import { Inject, Injectable } from '@nestjs/common'
import type { SchoolAdminMonthlyMonthRow, SchoolAdminMonthlyReport, SchoolAdminMonthlySubjectRow } from '@pp/contract'

import { toMytTimestamp } from '../../../common/time/myt'
import { CLOCK, type Clock } from '../../../db/clock'
import { AnalyticsRepository } from '../../reports/analytics/analytics.repository'
import { compareIds } from '../../reports/analytics/domain/rules'
import { SchoolPopulation } from './population'
import {
  accuracyOf,
  currentMonth,
  daysInMonth,
  lastTwelve,
  minuteOf,
  monthEnd,
  monthKey,
  monthLabel,
  monthOf,
  monthShort,
  monthStart,
  monthsOfYear,
  participationOf,
  round1,
  shiftMonth,
  type YearMonth,
} from './windows'

/**
 * S5 monthly report (mock `monthly`): the shown month's cards, a 12-month series, and the subject strengths of the shown month.
 * A month is listed when it has answers; subject rows likewise. There is no minimum cohort on this staff screen (PO decision
 * 2026-11-05, #503 batch 3).
 * Answers, correct answers, active pupils and accuracy are the XS-4 / XS-2 / XS-5 figures of `XsQueries` (answer rows, all modes, pooled),
 * per MYT calendar month; the session count of a month is a session read and stays a separately named figure.
 * R1-AS-50 adds the Guru card (XS-3), "Bulan Paling Aktif" and "Trend Penggunaan Bulanan {tahun}" (completed sessions per month, Jan to
 * Dis of the shown year), "Trend Harian" (XS-4 rows per MYT day of the shown month) and the subject rows by sessions (top 10).
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
    const yearMonths = monthsOfYear(shown.year)
    const yearFrom = monthStart(yearMonths[0] as YearMonth)
    const yearTo = monthEnd(yearMonths[11] as YearMonth)
    const [rows, answered, daily, teachers] = await Promise.all([
      // Sessions for the table window and for the whole shown year ("Trend Penggunaan Bulanan"): one read over the union.
      this.population.sessions(ids, Math.min(from, yearFrom), Math.max(to, yearTo)),
      this.population.tallyByMonth(schoolId, from, to),
      this.population.tallyByDay(schoolId, monthStart(shown), to),
      this.population.teachers(schoolId),
    ])
    const perMonth = new Map<string, { sessions: number; answers: number; correct: number; users: number }>()
    for (const [key, t] of answered) perMonth.set(key, { sessions: 0, answers: t.answered, correct: t.correct, users: t.pupils })
    const yearSessions = new Map<string, number>()
    for (const r of rows) {
      const key = r.day.slice(0, 7)
      yearSessions.set(key, (yearSessions.get(key) ?? 0) + r.sessions)
      if (key < monthKey(series[0] as YearMonth) || key > monthKey(shown)) continue
      const m = perMonth.get(key) ?? { sessions: 0, answers: 0, correct: 0, users: 0 }
      m.sessions += r.sessions
      perMonth.set(key, m)
    }

    const shownKey = monthKey(shown)
    const sm = perMonth.get(shownKey)
    const hasData = (sm?.answers ?? 0) > 0
    // Staff screen: no minimum cohort (PO decision 2026-11-05, #503 batch 3).
    const showable = hasData

    const months: SchoolAdminMonthlyMonthRow[] = []
    if (showable) {
      for (const ym of series) {
        const m = perMonth.get(monthKey(ym))
        if (!m || m.answers === 0) continue
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
    // The total is XS-4 / XS-5 of the whole 12-month window (not a sum of the listed rows), so it equals every other screen.
    const total = months.length > 1 ? await this.population.answerTotals(schoolId, from, to) : null

    const yearBars = yearMonths.map((ym) => ({ month: monthKey(ym), label: monthShort(ym), sessions: yearSessions.get(monthKey(ym)) ?? 0 }))
    // "Bulan Paling Aktif": the month of the shown year with the most completed sessions (the earliest on a tie); null without any.
    const top = yearBars.reduce((best, b) => (b.sessions > best.sessions ? b : best), { month: '', label: '', sessions: 0 })
    const busiestMonth = top.sessions > 0 ? top : null
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
        teachers: teachers.length,
        busiestMonth,
      },
      daily: Array.from({ length: daysInMonth(shown) }, (_, i) => ({
        day: i + 1,
        answers: daily.get(`${shownKey}-${String(i + 1).padStart(2, '0')}`) ?? 0,
      })),
      yearly: { year: shown.year, months: yearBars },
      months,
      total: total ? { answers: total.answered, correct: total.correct, accuracy: total.accuracy } : null,
      subjects: showable ? await this.subjects(schoolId, ids, shown) : { strongest: null, weakest: null, rows: [] },
      generatedAt: toMytTimestamp(new Date(minuteOf(now))),
    }
  }

  /**
   * Subject rows from the XS answer rows (all modes, unfinished sessions included), so they sum to XS-4 when every answer has a subject.
   * `rows` is the top 10 by completed sessions ("{n} sesi · {x}%"); strongest / weakest are taken over every listed subject by accuracy.
   */
  private async subjects(schoolId: string, ids: readonly string[], shown: YearMonth): Promise<SchoolAdminMonthlyReport['subjects']> {
    const [tallies, sessions] = await Promise.all([
      this.population.tallyBySubject(schoolId, monthStart(shown), monthEnd(shown)),
      this.population.sessionsBySubject(ids, monthStart(shown), monthEnd(shown)),
    ])
    const per = new Map<string, { answers: number; correct: number; users: { size: number } }>()
    for (const [id, t] of tallies) per.set(id, { answers: t.answered, correct: t.correct, users: { size: t.pupils } })
    const names = await this.analytics.subjectNames([...per.keys()])
    const rows: (SchoolAdminMonthlySubjectRow & { id: string })[] = []
    for (const [id, s] of per) {
      if (s.answers === 0) continue
      rows.push({
        id,
        name: names.get(id) ?? '',
        accuracy: accuracyOf(s.correct, s.answers) ?? 0,
        answers: s.answers,
        pupils: s.users.size,
        sessions: sessions.get(id) ?? 0,
      })
    }
    const wire = (r: SchoolAdminMonthlySubjectRow & { id: string }): SchoolAdminMonthlySubjectRow => ({
      name: r.name,
      accuracy: r.accuracy,
      answers: r.answers,
      pupils: r.pupils,
      sessions: r.sessions,
    })
    const byAccuracy = [...rows].sort((a, b) => b.accuracy - a.accuracy || b.answers - a.answers || compareIds(a.id, b.id))
    const bySessions = [...rows].sort((a, b) => b.sessions - a.sessions || b.answers - a.answers || compareIds(a.id, b.id))
    const strongest = byAccuracy[0]
    const weakest = byAccuracy.at(-1)
    return {
      strongest: strongest ? wire(strongest) : null,
      weakest: weakest ? wire(weakest) : null,
      rows: bySessions.slice(0, 10).map(wire),
    }
  }
}

/** The month after `ym` as a key, or null while `ym` is the current month. */
function shifted(ym: { year: number; month: number }, n: number, current: { year: number; month: number }): string | null {
  return monthKey(ym) >= monthKey(current) ? null : monthKey(shiftMonth(ym, n))
}
