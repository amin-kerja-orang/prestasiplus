/**
 * Read helpers of the Command Center drill-down (SRS M17 v1.12 §6.4, BR-M17-01, BR-M17-04, BR-M17-14):
 * answer totals, activity windows and ids of the owners' stores. Every figure is read from the owners'
 * repositories (M05 `practice`, M10 `classrooms`, M01 `users`); nothing is stored here (D11, D12).
 *
 * Cost model: the answer log is never scanned per pupil for a list. `practice.answerFacts` indexes the
 * log once and then serves any set of pupils (M05 aggregates); `practice.sessionTotals` is one scan of
 * the sessions. The per-pupil scan (`practice.answers`, about 30 ms each) is kept for the S7 read of
 * one pupil; S6 places each pupil's latest answer from the answers of the latest session instead.
 */

import { DAY_MS, toIsoMyt } from '@/lib/time'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'
import { practice } from '@/modules/m05-practice/mock'

/** One decimal, half away from zero (the page prints "82.3%"). */
export const round1 = (n: number): number => Math.round(n * 10) / 10

/** Two decimals ("80.00%" in the session tables, BR-M17-06). */
export const round2 = (n: number): number => Math.round(n * 100) / 100

/** correct ÷ total × 100, 0 when nothing was answered. */
export const percent = (correct: number, total: number): number =>
  total === 0 ? 0 : (correct / total) * 100

export interface AnswerTally {
  answers: number
  correct: number
}

/** Answers and correct answers per user over the whole log (users without an answer are absent). */
export function tallyOf(userIds: readonly number[]): Map<number, AnswerTally> {
  const out = new Map<number, AnswerTally>()
  for (const [userId, facts] of practice.answerFacts(userIds)) {
    if (facts.length === 0) continue
    let correct = 0
    for (const f of facts) if (f.isCorrect) correct++
    out.set(userId, { answers: facts.length, correct })
  }
  return out
}

/** Σ over the given users of a tally map. */
export function sumTally(
  userIds: readonly number[],
  tally: ReadonlyMap<number, AnswerTally>,
): AnswerTally {
  const sum: AnswerTally = { answers: 0, correct: 0 }
  for (const id of userIds) {
    const t = tally.get(id)
    if (t) {
      sum.answers += t.answers
      sum.correct += t.correct
    }
  }
  return sum
}

/**
 * The latest answer time per user (epoch ms) for a set of users, users without an answer absent.
 * Bulk form: the latest completed session of the user, then (exactly) the answers that belong to no
 * session, which are the only ones a completed session cannot place. Used for the 30-day "Aktif"
 * counts of S4 / S5, where the session completion stands for the last answer (at most the length of
 * one session apart; INFERRED: M05 `answerFacts` carries no `answeredAt`, so the owner contract offers no
 * bulk answer timestamps, and a per-pupil `answers()` scan costs about 30 ms); S6 uses `lastAnswerOf`, S7 reads the answers.
 */
export function lastActivityMs(userIds: readonly number[]): Map<number, number> {
  const out = new Map<number, number>()
  const sessions = practice.sessionTotals(userIds)
  for (const [userId, t] of sessions) {
    if (t.all.lastAtMs > 0) out.set(userId, t.all.lastAtMs)
  }
  for (const [userId, facts] of practice.answerFacts(userIds)) {
    if (!facts.some((f) => f.sessionId === null)) continue
    for (const a of practice.answers(userId, { sessionId: null })) {
      if (a.answeredAtMs > (out.get(userId) ?? 0)) out.set(userId, a.answeredAtMs)
    }
  }
  return out
}

export interface LastAnswer {
  ms: number
  iso: string
}

/**
 * The exact latest `answeredAt` per user (S6 "Terakhir Aktif"): the latest answer of the user's latest
 * completed session, or of an answer outside any session when that is later. One scan of the sessions,
 * then the answers of one session per user.
 */
export function lastAnswerOf(userIds: readonly number[]): Map<number, LastAnswer> {
  const out = new Map<number, LastAnswer>()
  const consider = (userId: number, ms: number, iso: string): void => {
    if (ms > (out.get(userId)?.ms ?? -1)) out.set(userId, { ms, iso })
  }
  for (const [userId, t] of practice.sessionTotals(userIds)) {
    const at = t.all.lastAtMs
    if (at <= 0) continue
    // The session(s) that completed last; a session without answer rows is placed at its completion.
    let placed = false
    for (const s of practice.history(userId, { from: at, to: at + 1 })) {
      for (const a of practice.sessionAnswers(s.id)) {
        consider(userId, a.answeredAtMs, a.answeredAt)
        placed = true
      }
    }
    if (!placed) consider(userId, at, toIsoMyt(at))
  }
  for (const [userId, facts] of practice.answerFacts(userIds)) {
    if (!facts.some((f) => f.sessionId === null)) continue
    for (const a of practice.answers(userId, { sessionId: null })) {
      consider(userId, a.answeredAtMs, a.answeredAt)
    }
  }
  return out
}

/** BR-M17-01 "30d": an answer in [now − 30 days, now]. */
export function activeWithin30d(
  userIds: readonly number[],
  last: ReadonlyMap<number, number>,
  now: number,
): number {
  const from = now - 30 * DAY_MS
  let n = 0
  for (const id of userIds) {
    const at = last.get(id)
    if (at !== undefined && at >= from && at <= now) n++
  }
  return n
}

/** All students of a school, active or not (BR-M17-03 per-school counts). */
export function studentsOf(schoolId: number): UserRow[] {
  return users.adminList({ role: 'student', schoolId, page: 1, pageSize: 100_000 }).rows
}

/** All teachers of a school (S4 "Senarai Guru"). */
export function teachersOf(schoolId: number): UserRow[] {
  return users.adminList({ role: 'teacher', schoolId, page: 1, pageSize: 100_000 }).rows
}

/** Distinct active members of the classes, ids ascending. */
export function memberIdsOf(
  classes: readonly { kind: 'classroom' | 'school_class'; classId: number }[],
): number[] {
  const ids = new Set<number>()
  for (const c of classes) for (const id of classrooms.memberIds(c.kind, c.classId)) ids.add(id)
  return [...ids].sort((a, b) => a - b)
}

/** "T{n}" (Tingkatan) or "D{n}" (Darjah) from the class's education level slug. */
export function levelLabel(slug: string): string {
  const m = /^(tahun|tingkatan)-(\d+)$/.exec(slug)
  if (!m) return slug
  return `${m[1] === 'tingkatan' ? 'T' : 'D'}${m[2] as string}`
}
