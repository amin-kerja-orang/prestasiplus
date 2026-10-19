/**
 * The class dashboard read model (S5; SRS M08 v1.13 §7 #5; BR-M08-05, -08, -10): computed per request
 * from the owners' stores (M10 members, M05 sessions, M01 names, the M08 headcount repository).
 * Figures cover the members' practice-mode sessions (BR-M08-11) in the class subject, all subjects for
 * a class without subject. Every unobserved rule is marked INFERRED where it is used.
 *
 * Performance (overview §6.6): a class without subject takes its totals from the M05 bulk read
 * (`sessionTotals`, through `reads.totalsOf`); a class with a subject needs the session rows of its
 * members, read per member from M05 `history` once and memoised until the log changes (the same stamp as
 * the class item analysis).
 */

import { formatDateKey, startOfDay, toIsoMyt } from '@/lib/time'
import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { practice } from '@/modules/m05-practice/mock'
import { classrooms, type ClassroomRow } from '@/modules/m10-teacher-class/mock'

import type { ClassDashboard } from '../../api/types'
import { headcountRepo } from './headcount'
import { bandStatus, latestAr } from './headcount-port'
import { rosterOf, summaryOf } from './headcount-views'
import { PRACTICE_MODE_SET, checkStamp, classAnalysisMemo, totalsOf } from './reads'
import { capPercent, pct, round } from './rules'

const DAY = 86_400_000

interface MemberFigures {
  userId: number
  sessions: number
  answered: number
  correct: number
  seconds: number
  lastAtMs: number
}

interface SessionPoint {
  userId: number
  completedAtMs: number
  questions: number
  correct: number
  seconds: number
}

/** The practice-mode sessions of a member in the class subject (`null` = every subject). */
function memberSessions(userId: number, subjectId: number | null): SessionPoint[] {
  const out: SessionPoint[] = []
  for (const s of practice.history(userId)) {
    if (!PRACTICE_MODE_SET.has(s.mode)) continue
    if (subjectId !== null && s.subjectId !== subjectId) continue
    out.push({
      userId,
      completedAtMs: s.completedAtMs,
      questions: s.questionCount,
      correct: s.correctCount,
      seconds: s.timeSpent,
    })
  }
  return out
}

/** Sessions of the members from `fromMs` on (the 30-day trend window and the 7-day activity count). */
function recentSessions(
  userId: number,
  subjectId: number | null,
  fromMs: number,
  now: number,
): SessionPoint[] {
  const out: SessionPoint[] = []
  for (const s of practice.history(userId, { from: fromMs, to: now + 1 })) {
    if (!PRACTICE_MODE_SET.has(s.mode)) continue
    if (subjectId !== null && s.subjectId !== subjectId) continue
    out.push({
      userId,
      completedAtMs: s.completedAtMs,
      questions: s.questionCount,
      correct: s.correctCount,
      seconds: s.timeSpent,
    })
  }
  return out
}

/**
 * Per-member figures and the sessions of the trend window. A class without subject reads the bulk totals
 * and only the recent rows; a class with a subject reads every row once and derives both.
 */
function collect(
  members: readonly number[],
  subjectId: number | null,
  now: number,
  windowStart: number,
): { figures: MemberFigures[]; recent: SessionPoint[] } {
  const figures: MemberFigures[] = []
  const recent: SessionPoint[] = []
  for (const userId of members) {
    if (subjectId === null) {
      const t = totalsOf(userId).practice
      figures.push({
        userId,
        sessions: t.sessions,
        answered: t.questions,
        correct: t.correct,
        seconds: t.seconds,
        lastAtMs: t.lastAtMs,
      })
      if (t.sessions > 0) recent.push(...recentSessions(userId, null, windowStart, now))
      continue
    }
    const all = memberSessions(userId, subjectId)
    const f: MemberFigures = {
      userId,
      sessions: all.length,
      answered: 0,
      correct: 0,
      seconds: 0,
      lastAtMs: 0,
    }
    for (const s of all) {
      f.answered += s.questions
      f.correct += s.correct
      f.seconds += s.seconds
      if (s.completedAtMs > f.lastAtMs) f.lastAtMs = s.completedAtMs
      if (s.completedAtMs >= windowStart && s.completedAtMs <= now) recent.push(s)
    }
    figures.push(f)
  }
  return { figures, recent }
}

const nameOf = (userId: number): string => users.get(userId)?.name ?? `Murid ${String(userId)}`

/** BR-M08-08 rule (2) per member on the class's latest-updated config (INFERRED config choice). */
function headcountBlock(cls: ClassroomRow): {
  block: ClassDashboard['headcount']
  badges: Map<number, 'on' | 'below' | 'na'>
} {
  const badges = new Map<number, 'on' | 'below' | 'na'>()
  const config = headcountRepo
    .configsOfClass(cls.classId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt) || b.id - a.id)[0]
  if (!config) return { block: null, badges }

  let on = 0
  let below = 0
  let none = 0
  const lines = rosterOf(config).filter((l) => !l.dropped)
  for (const line of lines) {
    const l = latestAr(line.view)
    const s = l === null ? 'na' : bandStatus(l.ar, l.target)
    // S5 counts Above + On Track as "On Track" (BR-M08-08 rule 2).
    const badge = s === 'above' || s === 'on' ? 'on' : s === 'below' ? 'below' : 'na'
    badges.set(line.studentId, badge)
    if (badge === 'on') on++
    else if (badge === 'below') below++
    else none++
  }
  const total = on + below + none
  const sum = summaryOf(config)
  return {
    block: {
      configId: config.id,
      onTrack: on,
      below,
      noData: none,
      pct: {
        on: total === 0 ? 0 : (on / total) * 100,
        below: total === 0 ? 0 : (below / total) * 100,
        none: total === 0 ? 0 : (none / total) * 100,
      },
      avgTov: sum.avgTov,
      avgEtr: sum.avgEtr,
    },
    badges,
  }
}

/** #5: the class dashboard; memoised until the M05 log changes (the key holds the day and the member set). */
export function classDashboard(cls: ClassroomRow, now: number): ClassDashboard {
  checkStamp()
  const members = classrooms.memberIds(cls.kind, cls.classId)
  const headcountStamp = headcountRepo
    .configsOfClass(cls.classId)
    .map((c) => `${String(c.id)}@${c.updatedAt}`)
    .join(',')
  const key = `s5:${String(cls.classId)}:${String(Math.floor(now / 60_000))}:${String(members.length)}:${headcountStamp}`
  const hit = classAnalysisMemo.get(key) as ClassDashboard | undefined
  if (hit) return hit
  const out = computeClassDashboard(cls, members, now)
  classAnalysisMemo.set(key, out)
  return out
}

function computeClassDashboard(
  cls: ClassroomRow,
  members: readonly number[],
  now: number,
): ClassDashboard {
  const windowStart = startOfDay(now - 29 * DAY)
  const { figures, recent } = collect(members, cls.subjectId, now, windowStart)

  let sessions = 0
  let answered = 0
  let correct = 0
  let seconds = 0
  for (const f of figures) {
    sessions += f.sessions
    answered += f.answered
    correct += f.correct
    seconds += f.seconds
  }
  const sevenDaysAgo = now - 7 * DAY
  const active7d = new Set(
    recent.filter((s) => s.completedAtMs >= sevenDaysAgo).map((s) => s.userId),
  ).size

  // Trend: one point per local date with sessions in the last 30 days (INFERRED window: today and the
  // 29 days before; the day accuracy = Σ correct ÷ Σ answered of that day).
  const byDay = new Map<string, { sessions: number; q: number; c: number; users: Set<number> }>()
  for (const s of recent) {
    const key = formatDateKey(s.completedAtMs)
    const d = byDay.get(key) ?? { sessions: 0, q: 0, c: 0, users: new Set<number>() }
    d.sessions++
    d.q += s.questions
    d.c += s.correct
    d.users.add(s.userId)
    byDay.set(key, d)
  }
  const trend = [...byDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, d]) => ({
      date,
      sessions: d.sessions,
      avgAccuracy: round(capPercent(pct(d.c, d.q)), 1),
      activeStudents: d.users.size,
    }))

  const { block, badges } = headcountBlock(cls)

  // Ranking: accuracy descending (uncapped for the order, DV-07), ties by user id (INFERRED); members
  // without practice last, by id. Perlu Perhatian: accuracy < 50 by accuracy descending, then members
  // without practice (OBSERVED order).
  const raw = (f: MemberFigures): number | null =>
    f.sessions === 0 ? null : pct(f.correct, f.answered)
  const order = [...figures].sort((a, b) => {
    const ra = raw(a)
    const rb = raw(b)
    if (ra === null && rb === null) return a.userId - b.userId
    if (ra === null) return 1
    if (rb === null) return -1
    return rb - ra || a.userId - b.userId
  })
  const ranking = order.map((f, i) => {
    const r = raw(f)
    return {
      rank: i + 1,
      userId: f.userId,
      name: nameOf(f.userId),
      sessions: f.sessions,
      answered: f.answered,
      accuracy: r === null ? null : round(capPercent(r), 1),
      headcount: badges.get(f.userId) ?? ('na' as const),
      lastActiveAt: f.lastAtMs > 0 ? toIsoMyt(f.lastAtMs) : null,
    }
  })
  const low = order.filter((f) => {
    const r = raw(f)
    return r !== null && r < 50
  })
  const idle = figures.filter((f) => f.sessions === 0).sort((a, b) => a.userId - b.userId)
  const attention = [
    ...low.map((f) => ({
      userId: f.userId,
      name: nameOf(f.userId),
      sessions: f.sessions,
      accuracy: round(capPercent(raw(f) as number), 1),
    })),
    ...idle.map((f) => ({
      userId: f.userId,
      name: nameOf(f.userId),
      sessions: 0,
      accuracy: null,
    })),
  ]

  return {
    class: {
      id: cls.classId,
      name: cls.name,
      school: cls.schoolId === null ? '' : (schools.get(cls.schoolId)?.name ?? ''),
      subject: cls.subjectId === null ? null : (curriculum.subject(cls.subjectId)?.name ?? null),
      year: cls.academicYear,
      joinCode: cls.joinCode,
    },
    stats: {
      students: members.length,
      accuracy: round(capPercent(pct(correct, answered)), 1),
      sessions,
      answered,
      avgMinutes: sessions === 0 ? 0 : round(seconds / sessions / 60, 1),
      active7d,
    },
    headcount: block,
    attention,
    trend,
    ranking,
  }
}
