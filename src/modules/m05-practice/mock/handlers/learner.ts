/**
 * SRS M05 v1.17 §7 #11 progress (S8, BR-19), #12 history (S9, BR-21), #13 corrections (S11,
 * BR-18) and #14 mastery (S12, BR-20). Any session (A); every figure is the viewer's own, read from
 * the practice store (`practice.answers`, `practice.history`, `practice.mastery`).
 *
 * Definitions replicated from live (SRS §6.12 "Resulting anchors"): S8 answered / accuracy count
 * **all** answers (with or without a session), sessions and time count the completed sessions;
 * S9 counts sessions and their question counts only; S12 reads its own stored counters.
 */

import {
  ok,
  pageParams,
  paginate,
  queryString,
  requireAuth,
  route,
  type RouteDef,
} from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type {
  Corrections,
  HistoryItem,
  Mastery,
  MasteryCard,
  PracticeMode,
  Progress,
  ProgressPeriod,
  ProgressSubject,
} from '../../api/types'
import { DAY_MS, mytDateKey, startOfMytDay } from '../datasets/calendar'
import { practiceRepo } from '../repository/practice'
import type { SessionSummary } from '../repository/reads'
import { pct, round, monthWindow, userIdOf, weekStartOf, yearWindow } from './common'

/** §6.10 subject order key: the M03 BR-08 order. */
function subjectOrder(): Map<number, number> {
  return new Map(curriculum.subjectIds().map((id, i) => [id, i]))
}

// ---------------------------------------------------------------------------------------------
// #11 Progress
// ---------------------------------------------------------------------------------------------

const PERIOD_DAYS: Readonly<Record<string, number>> = { '7': 7, '30': 30, '90': 90 }

const dayLabel = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`

function emptyProgress(period: ProgressPeriod | null): Progress {
  return {
    period,
    answered: 0,
    accuracyPct: null,
    sessions: 0,
    minutes: 0,
    chart: { labels: [], accuracy: [], counts: [] },
    weakSubjects: [],
    subjects: [],
  }
}

function progress(userId: number, period: ProgressPeriod, now: number): Progress {
  const window =
    period === 'all'
      ? undefined
      : {
          from: startOfMytDay(now) - ((PERIOD_DAYS[period] as number) - 1) * DAY_MS,
          to: startOfMytDay(now) + DAY_MS,
        }
  const answers = practiceRepo.answers(userId, window ?? {})
  const sessions = practiceRepo.history(userId, window ?? {})

  const byDay = new Map<string, { n: number; c: number }>()
  const bySubject = new Map<
    number,
    { n: number; c: number; days: Map<string, { n: number; c: number }> }
  >()
  let correct = 0
  for (const a of answers) {
    const day = mytDateKey(a.answeredAtMs)
    const d = byDay.get(day) ?? { n: 0, c: 0 }
    d.n++
    if (a.isCorrect) {
      d.c++
      correct++
    }
    byDay.set(day, d)
    if (a.subjectId === null) continue
    const s = bySubject.get(a.subjectId) ?? { n: 0, c: 0, days: new Map() }
    s.n++
    if (a.isCorrect) s.c++
    const sd = s.days.get(day) ?? { n: 0, c: 0 }
    sd.n++
    if (a.isCorrect) sd.c++
    s.days.set(day, sd)
    bySubject.set(a.subjectId, s)
  }

  const days = [...byDay.keys()].sort()
  const order = subjectOrder()
  const subjects: ProgressSubject[] = []
  for (const [subjectId, s] of bySubject) {
    const subject = curriculum.subject(subjectId)
    if (!subject) continue
    subjects.push({
      code: subject.code,
      name: subject.name,
      color: subject.color,
      answered: s.n,
      correct: s.c,
      wrong: s.n - s.c,
      accuracyPct: round(pct(s.c, s.n), 1),
      trend: [...s.days.keys()]
        .sort()
        .map((k) =>
          round(pct((s.days.get(k) as { c: number }).c, (s.days.get(k) as { n: number }).n), 1),
        ),
    })
  }
  // INFERRED order (the live order is unobserved): most answers first, then the M03 order.
  const rank = (code: string) => order.get(curriculum.subjectByCode(code)?.id ?? -1) ?? 0
  subjects.sort((a, b) => b.answered - a.answered || rank(a.code) - rank(b.code))

  return {
    period,
    answered: answers.length,
    accuracyPct: answers.length === 0 ? null : round(pct(correct, answers.length), 1),
    sessions: sessions.length,
    minutes: Math.floor(sessions.reduce((a, s) => a + s.timeSpent, 0) / 60),
    chart: {
      labels: days.map(dayLabel),
      accuracy: days.map((k) =>
        round(pct((byDay.get(k) as { c: number }).c, (byDay.get(k) as { n: number }).n), 1),
      ),
      counts: days.map((k) => (byDay.get(k) as { n: number }).n),
    },
    // BR-19: weak ⇔ accuracy below 50 % (INFERRED threshold).
    weakSubjects: subjects
      .filter((s) => pct(s.correct, s.answered) < 50)
      .map((s) => ({
        code: s.code,
        name: s.name,
        color: s.color,
        answered: s.answered,
        accuracyPct: s.accuracyPct,
      })),
    subjects,
  }
}

// ---------------------------------------------------------------------------------------------
// #12 History
// ---------------------------------------------------------------------------------------------

const BADGE_BOOK = { label: 'Latihan', icon: 'fa-book', color: '#6B7280' }
/** §6.10 "Session types" (PROPOSED COPY except `past_year` / `latih_tubi`, OBSERVED). */
const BADGES: Readonly<Record<PracticeMode, HistoryItem['badge']>> = {
  past_year: BADGE_BOOK,
  latih_tubi: BADGE_BOOK,
  random: BADGE_BOOK,
  chapter: { label: 'Bab', icon: 'fa-layer-group', color: '#0D9488' },
  revision: { label: 'Ulang Kaji', icon: 'fa-redo-alt', color: '#EA580C' },
  ramalan: { label: 'Tracking A', icon: 'fa-book', color: '#6B7280' },
  mission: BADGE_BOOK,
  remedial: BADGE_BOOK,
  question_set: BADGE_BOOK,
  pksk: { label: 'PKSK', icon: 'fa-book', color: '#6B7280' },
}

function historyItem(s: SessionSummary): HistoryItem {
  return {
    id: s.id,
    mode: s.mode,
    badge: { ...BADGES[s.mode] },
    completedAt: s.completedAt ?? '',
    questionCount: s.questionCount,
    correctCount: s.correctCount,
    wrongCount: s.questionCount - s.correctCount,
    accuracyPct: round(pct(s.correctCount, s.questionCount), 2),
    timeSpent: s.timeSpent,
    coinsEarned: s.coinsEarned,
  }
}

const HISTORY_PAGE_SIZE = 15

// ---------------------------------------------------------------------------------------------
// #13 Corrections
// ---------------------------------------------------------------------------------------------

const MONTH_RE = /^(\d{4})-(0[1-9]|1[0-2])$/

function monthKeyOf(ms: number): string {
  return mytDateKey(ms).slice(0, 7)
}

function shiftMonth(key: string, delta: number): string {
  const [y, m] = key.split('-').map(Number) as [number, number]
  const t = y * 12 + (m - 1) + delta
  return `${String(Math.floor(t / 12)).padStart(4, '0')}-${String((t % 12) + 1).padStart(2, '0')}`
}

interface QuestionRun {
  subjectId: number
  firstMs: number
  firstCorrect: boolean
  laterCorrect: boolean
}

function corrections(userId: number, month: string, current: string): Corrections {
  // BR-18: SPM `past_year` answers are not counted.
  const skip = new Set(
    practiceRepo
      .history(userId)
      .filter((s) => s.mode === 'past_year')
      .map((s) => s.id),
  )
  const runs = new Map<number, QuestionRun>()
  for (const a of practiceRepo.answers(userId)) {
    if (a.subjectId === null || (a.sessionId !== null && skip.has(a.sessionId))) continue
    const run = runs.get(a.questionId)
    if (!run) {
      runs.set(a.questionId, {
        subjectId: a.subjectId,
        firstMs: a.answeredAtMs,
        firstCorrect: a.isCorrect,
        laterCorrect: false,
      })
    } else if (a.isCorrect) {
      run.laterCorrect = true
    }
  }

  const tally = new Map<number, { n: number; before: number; after: number }>()
  for (const run of runs.values()) {
    if (monthKeyOf(run.firstMs) !== month) continue
    const t = tally.get(run.subjectId) ?? { n: 0, before: 0, after: 0 }
    t.n++
    if (run.firstCorrect) {
      t.before++
      t.after++
    } else if (run.laterCorrect) {
      t.after++
    }
    tally.set(run.subjectId, t)
  }

  const total = [...tally.values()].reduce(
    (a, t) => ({ n: a.n + t.n, before: a.before + t.before, after: a.after + t.after }),
    { n: 0, before: 0, after: 0 },
  )
  const order = subjectOrder()
  const subjects = [...tally.entries()]
    .flatMap(([id, t]) => {
      const subject = curriculum.subject(id)
      return subject ? [{ subject, t }] : []
    })
    .sort(
      (a, b) => b.t.n - a.t.n || (order.get(a.subject.id) ?? 0) - (order.get(b.subject.id) ?? 0),
    )
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
    // DV-M05-10: › links to the next month only before the current month.
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

// ---------------------------------------------------------------------------------------------
// #14 Mastery
// ---------------------------------------------------------------------------------------------

/** BR-20 correct-answer thresholds of L0…L10 (L4+ are INFERRED placeholders, URS OQ-4). */
export const MASTERY_THRESHOLDS = [0, 10, 25, 50, 100, 200, 350, 550, 800, 1100, 1500] as const
/** §6.10 "Mastery levels". */
export const MASTERY_LABELS = [
  'Pemula',
  'Mula Belajar',
  'Aktif',
  'Tekun',
  'Mahir',
  'Pakar Muda',
  'Cemerlang',
  'Master',
  'Grandmaster',
  'Legend',
  'Mythical',
] as const

export function masteryLevel(correct: number): number {
  let level = 0
  for (const [i, t] of MASTERY_THRESHOLDS.entries()) if (correct >= t) level = i
  return level
}

function masteryCard(
  subject: { code: string; name: string; icon: string | null; color: string },
  m: { correct: number; answered: number; lastAnsweredAt: string | null },
): MasteryCard {
  const level = masteryLevel(m.correct)
  const last = level === MASTERY_THRESHOLDS.length - 1
  const from = MASTERY_THRESHOLDS[level] as number
  const to = last ? null : (MASTERY_THRESHOLDS[level + 1] as number)
  return {
    code: subject.code,
    name: subject.name,
    icon: subject.icon,
    color: subject.color,
    level,
    label: MASTERY_LABELS[level] as string,
    correct: m.correct,
    answered: m.answered,
    accuracyPct: round(pct(m.correct, m.answered), 1),
    nextLevel: last ? null : level + 1,
    nextThreshold: to,
    barPct: to === null ? 100 : round(((m.correct - from) / (to - from)) * 100, 1),
    // BR-20: x{1 + 0.05 × (L − 1)} from L2.
    xpMultiplier: level >= 2 ? round(1 + 0.05 * (level - 1), 2) : null,
    lastAnsweredAt: m.lastAnsweredAt,
  }
}

export const learnerRoutes: RouteDef[] = [
  route('GET', '/api/practice/progress', [requireAuth()], (req, ctx) => {
    // Absent → 30 days; anything else that is not 7 / 30 / 90 / all → no active chip, zero figures.
    const raw = queryString(req.query, 'period') ?? '30'
    if (raw !== 'all' && !Object.hasOwn(PERIOD_DAYS, raw)) return ok(emptyProgress(null))
    return ok(progress(userIdOf(req), raw as ProgressPeriod, ctx.clock.now()))
  }),

  route('GET', '/api/practice/history', [requireAuth()], (req, ctx) => {
    const now = ctx.clock.now()
    const all = practiceRepo.history(userIdOf(req))
    // Totals are all-time and never filtered (BR-21); sessions with no question add no accuracy.
    const accs = all
      .filter((s) => s.questionCount > 0)
      .map((s) => pct(s.correctCount, s.questionCount))
    const totals = {
      sessions: all.length,
      answered: all.reduce((a, s) => a + s.questionCount, 0),
      avgAccuracyPct:
        accs.length === 0 ? 0 : round(accs.reduce((a, b) => a + b, 0) / accs.length, 1),
      coins: all.reduce((a, s) => a + s.coinsEarned, 0),
    }
    // BR-21: week = Monday–Sunday, month / year = the calendar ones; unknown → every session.
    const period = queryString(req.query, 'period')
    let window: { from: number; to: number } | null = null
    if (period === 'week') {
      const from = weekStartOf(now)
      window = { from, to: from + 7 * DAY_MS }
    } else if (period === 'month') window = monthWindow(now)
    else if (period === 'year') window = yearWindow(now)
    const rows = window
      ? all.filter((s) => s.completedAtMs >= window.from && s.completedAtMs < window.to)
      : all
    return paginate(rows.map(historyItem), pageParams(req.query, { pageSize: HISTORY_PAGE_SIZE }), {
      totals,
    })
  }),

  route('GET', '/api/practice/corrections', [requireAuth()], (req, ctx) => {
    const current = monthKeyOf(ctx.clock.now())
    // DV-M05-13: a malformed month shows the current month.
    const asked = queryString(req.query, 'month')
    const month = asked !== undefined && MONTH_RE.test(asked) ? asked : current
    return ok(corrections(userIdOf(req), month, current))
  }),

  route('GET', '/api/practice/mastery', [requireAuth()], (req) => {
    const rank = subjectOrder()
    const cards = practiceRepo
      .mastery(userIdOf(req))
      .flatMap((m) => {
        const subject = curriculum.subject(m.subjectId)
        return subject && subject.isActive
          ? [{ order: rank.get(subject.id) ?? 0, card: masteryCard(subject, m) }]
          : []
      })
      .sort((a, b) => a.order - b.order)
      .map((x) => x.card)
    const body: Mastery = {
      scale: MASTERY_LABELS.map((label, level) => ({ level, label })),
      subjects: cards,
    }
    return ok(body)
  }),
]
