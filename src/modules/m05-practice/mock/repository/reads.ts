/**
 * Read side of the practice store (SRS M05 v1.16 §6.14.2 Q-ANS-USER / Q-SESS-USER, BR-06, BR-14,
 * BR-16, BR-20; the M14 read contract of F-26b). Every read uses ids, facets and cheap fields to
 * find the rows (no derivation), then derives only the rows it returns.
 *
 * Reads made while the M05 datasets are not booted in this runtime (another module's unit test
 * without the M05 plugin) return the empty state.
 */

import { toIsoMyt } from '@/lib/time'
import { questions } from '@/modules/m04-question-bank/mock'

import { answersDataset } from '../datasets/answers'
import { mytDayStart, DAY_MS } from '../datasets/calendar'
import { practicePrimeOrNull } from '../datasets/prime'
import { sessionsDataset } from '../datasets/sessions'
import type { AnswerRow, PracticeMode, SessionRow } from '../datasets/types'
import { masteryTable, queueTable } from '../tables/tables'

/** Whether the M05 datasets are compiled and primed in this runtime. */
export function practiceReady(): boolean {
  return answersDataset.compiled && sessionsDataset.compiled && practicePrimeOrNull() !== null
}

// ---------------------------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------------------------

/**
 * A session as history lists return it: every DATA-M05-01 field, plus the M14 aliases `correct` /
 * `total`. Anchor and runtime sessions carry their stored row in full; generated sessions omit only
 * the served `questionIds` (drawn from M04 on demand; read one session with `practice.session(id)`).
 */
export type SessionSummary = Omit<SessionRow, 'questionIds'> & {
  questionIds?: number[]
  correct: number
  total: number
}

const SUMMARY_FIELDS = [
  'id',
  'seg',
  'schoolId',
  'week',
  'band',
  'inP',
  'missionId',
  'status',
  'userId',
  'mode',
  'subjectId',
  'questionCount',
  'correctCount',
  'timeSpent',
  'coinsEarned',
  'pointsEarned',
  'completedAt',
  'completedAtMs',
  'remedialTestId',
  'questionSetId',
] as const satisfies readonly (keyof SessionRow)[]

let scanSeq = 0

/** A fresh slow-path cache key (each whole-log scan is its own query; no clock, no randomness). */
export function nextCacheKey(prefix: string): string {
  return `${prefix}:${String(++scanSeq)}`
}

/** Sessions matching `where`, as summaries (derives nothing for generated rows). */
export function scanSessions(
  where: Parameters<typeof sessionsDataset.count>[0],
  keep: (s: SessionSummary) => boolean = () => true,
): SessionSummary[] {
  const out: SessionSummary[] = []
  sessionsDataset.count(
    where,
    (row) => {
      // Anchor and runtime rows arrive whole: keep every DATA-M05-01 field (incl. `questionIds`).
      if (Array.isArray((row as Partial<SessionRow>).questionIds)) {
        const summary: SessionSummary = {
          ...row,
          correct: row.correctCount,
          total: row.questionCount,
        }
        if (keep(summary)) out.push(summary)
        return false
      }
      const r = row as unknown as Record<string, unknown>
      const s = {} as Record<string, unknown>
      for (const f of SUMMARY_FIELDS) s[f] = r[f]
      // Generated rows: the few non-cheap fields, from the prime (no derivation).
      const full = row as Partial<SessionRow>
      const summary = {
        ...(s as unknown as SessionRow),
        levelId: full.levelId ?? levelOf(row.id, row.userId),
        difficulty: full.difficulty ?? null,
        chapterId: full.chapterId ?? null,
        year: full.year ?? null,
        setNo: full.setNo ?? null,
        targetQuestionId: full.targetQuestionId ?? null,
        timeLimitSec: full.timeLimitSec ?? null,
        pkskDomainId: full.pkskDomainId ?? null,
        pkskTargetLevel: full.pkskTargetLevel ?? null,
        startedAt: full.startedAt ?? startedAtOf(s),
        correct: s.correctCount as number,
        total: s.questionCount as number,
      } as SessionSummary
      delete (summary as Partial<SessionRow>).questionIds
      if (keep(summary)) out.push(summary)
      return false
    },
    { matchFields: [...SUMMARY_FIELDS], cacheKey: nextCacheKey('m05-scan') },
  )
  return out
}

function levelOf(id: string, userId: number): number | null {
  const p = practicePrimeOrNull()
  const m = /^g(\d+)$/.exec(id)
  if (p && m) return p.sLevel[Number(m[1])] ?? null
  return p?.userLevel.get(userId) ?? null
}

function startedAtOf(s: Record<string, unknown>): string {
  return toIsoMyt((s.completedAtMs as number) - (s.timeSpent as number) * 1_000)
}

/** Newest first; ties by id descending (§7 #23). */
export function byCompletedDesc(a: SessionSummary, b: SessionSummary): number {
  return b.completedAtMs - a.completedAtMs || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0)
}

export interface HistoryFilter {
  /** Local date (MYT) of `completedAt`, `YYYY-MM-DD`. */
  date?: string
  modes?: readonly string[]
  /** `completedAtMs` window `[from, to)`. */
  from?: number
  to?: number
}

/** A user's completed sessions matching the filter, newest first (unpaged). */
export function userHistory(userId: number, filter: HistoryFilter = {}): SessionSummary[] {
  if (!practiceReady()) return []
  let from = filter.from
  let to = filter.to
  if (filter.date !== undefined) {
    const start = mytDayStart(filter.date)
    if (!Number.isFinite(start)) return []
    from = Math.max(from ?? start, start)
    to = Math.min(to ?? start + DAY_MS, start + DAY_MS)
  }
  const modes = filter.modes ? new Set(filter.modes) : null
  const rows = scanSessions(
    {
      userId,
      status: 'completed',
      ...(from !== undefined || to !== undefined
        ? { completedAtMs: { gte: from ?? 0, lte: (to ?? Number.MAX_SAFE_INTEGER) - 1 } }
        : {}),
    },
    (s) => modes === null || modes.has(s.mode),
  )
  return rows.sort(byCompletedDesc)
}

// ---------------------------------------------------------------------------------------------
// Answers
// ---------------------------------------------------------------------------------------------

export interface AnswerFilter {
  /** Local date (MYT) of `answeredAt`. */
  date?: string
  from?: number
  to?: number
  sessionId?: string | null
  subjectId?: number
  chapterId?: number
}

/** Ids of a user's answers matching the id / facet / cheap-field part of a filter. */
function answerIds(userId: number, filter: AnswerFilter): number[] {
  let from = filter.from
  let to = filter.to
  if (filter.date !== undefined) {
    const start = mytDayStart(filter.date)
    if (!Number.isFinite(start)) return []
    from = Math.max(from ?? start, start)
    to = Math.min(to ?? start + DAY_MS, start + DAY_MS)
  }
  const ids: number[] = []
  answersDataset.count(
    {
      userId,
      // `hasSession` is a facet; a session id is checked on the (few) rows returned.
      ...(filter.sessionId === null ? { hasSession: false } : {}),
      ...(from !== undefined || to !== undefined
        ? { answeredAtMs: { gte: from ?? 0, lte: (to ?? Number.MAX_SAFE_INTEGER) - 1 } }
        : {}),
    },
    (row) => {
      ids.push(row.id)
      return false
    },
    { matchFields: ['id'], cacheKey: nextCacheKey('m05-ids') },
  )
  return ids
}

/** A user's answers (DATA-M05-02 rows), oldest first. */
export function userAnswers(userId: number, filter: AnswerFilter = {}): AnswerRow[] {
  if (!practiceReady()) return []
  const rows = answersDataset
    .getMany(answerIds(userId, filter))
    .filter(
      (a) =>
        (filter.sessionId === undefined || a.sessionId === filter.sessionId) &&
        (filter.subjectId === undefined || a.subjectId === filter.subjectId) &&
        (filter.chapterId === undefined || a.chapterId === filter.chapterId),
    )
  return rows.sort((a, b) => a.answeredAtMs - b.answeredAtMs || a.id - b.id)
}

// ---------------------------------------------------------------------------------------------
// Mastery (BR-20) and the revision queue (BR-14)
// ---------------------------------------------------------------------------------------------

export interface MasteryItem {
  subjectId: number
  correct: number
  answered: number
  lastAnsweredAt: string | null
}

/** Log aggregates per subject (a user without stored counters, §6.9 DATA-M05-11). */
export function masteryFromLog(userId: number): MasteryItem[] {
  const by = new Map<number, MasteryItem>()
  for (const a of userAnswers(userId)) {
    if (a.subjectId === null) continue
    const m = by.get(a.subjectId) ?? {
      subjectId: a.subjectId,
      correct: 0,
      answered: 0,
      lastAnsweredAt: null,
    }
    m.answered++
    if (a.isCorrect) m.correct++
    if (m.lastAnsweredAt === null || a.answeredAt > m.lastAnsweredAt)
      m.lastAnsweredAt = a.answeredAt
    by.set(a.subjectId, m)
  }
  return [...by.values()].sort((a, b) => a.subjectId - b.subjectId)
}

/** BR-20 counters: the stored rows, else the log aggregates. */
export function userMastery(userId: number): MasteryItem[] {
  if (!practiceReady()) return []
  const stored = masteryTable.query({ where: { userId } }).rows
  if (stored.length > 0) {
    return stored
      .map((m) => ({
        subjectId: m.subjectId,
        correct: m.correct,
        answered: m.answered,
        lastAnsweredAt: m.lastAnsweredAt,
      }))
      .sort((a, b) => a.subjectId - b.subjectId)
  }
  return masteryFromLog(userId)
}

export interface QueueItem {
  questionId: number
  subjectId: number
  wrongTimes: number
  lastWrongAt: string
}

/** BR-14 over a list of answers (oldest first): wrong → +1, correct → removed. */
export function queueFromAnswers(answers: readonly AnswerRow[]): QueueItem[] {
  const q = new Map<number, QueueItem>()
  for (const a of answers) {
    if (a.subjectId === null) continue
    if (a.isCorrect) q.delete(a.questionId)
    else {
      const cur = q.get(a.questionId)
      q.set(a.questionId, {
        questionId: a.questionId,
        subjectId: a.subjectId,
        wrongTimes: (cur?.wrongTimes ?? 0) + 1,
        lastWrongAt: a.answeredAt,
      })
    }
  }
  return [...q.values()]
}

/** Whether a user's queue is stored (seeded, anchor and runtime users) or derived (generated). */
export function hasStoredQueue(userId: number): boolean {
  return !(practicePrimeOrNull()?.generatedUsers.has(userId) ?? false)
}

/** BR-14 order: `wrongTimes` desc, then the latest wrong answer first, then question id. */
export function queueOrder(a: QueueItem, b: QueueItem): number {
  return (
    b.wrongTimes - a.wrongTimes ||
    (a.lastWrongAt < b.lastWrongAt ? 1 : a.lastWrongAt > b.lastWrongAt ? -1 : 0) ||
    a.questionId - b.questionId
  )
}

/** The whole queue of a user (eligible or not). */
export function userQueueAll(userId: number, subjectId?: number): QueueItem[] {
  if (!practiceReady()) return []
  const items = hasStoredQueue(userId)
    ? queueTable.query({ where: { userId } }).rows.map((r) => ({
        questionId: r.questionId,
        subjectId: r.subjectId,
        wrongTimes: r.wrongTimes,
        lastWrongAt: r.lastWrongAt,
      }))
    : queueFromAnswers(userAnswers(userId))
  return items.filter((i) => subjectId === undefined || i.subjectId === subjectId).sort(queueOrder)
}

/** XL-19: only questions eligible for practice (M04 BR-M04-03) are served and counted. */
export function userQueue(userId: number, subjectId?: number): QueueItem[] {
  return userQueueAll(userId, subjectId).filter((i) => questions.eligibleForPractice(i.questionId))
}

// ---------------------------------------------------------------------------------------------
// Chapter stats (BR-16)
// ---------------------------------------------------------------------------------------------

export interface ChapterStats {
  total: number
  answered: number
  correct: number
  scorePct: number
  remaining: number
  complete: boolean
}

export function chapterStats(userId: number, chapterId: number): ChapterStats {
  const total = questions.count('Q-CHAPTER', chapterId)
  const latest = new Map<number, boolean>()
  for (const a of userAnswers(userId, { chapterId })) latest.set(a.questionId, a.isCorrect)
  const answered = latest.size
  let correct = 0
  for (const v of latest.values()) if (v) correct++
  return {
    total,
    answered,
    correct,
    scorePct: answered === 0 ? 0 : (correct / answered) * 100,
    remaining: Math.max(0, total - answered),
    complete: answered >= total && total > 0,
  }
}

export type { PracticeMode }
