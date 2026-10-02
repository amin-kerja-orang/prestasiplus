/**
 * Bulk reads over a set of users (F-26c follow-up, XR-M08-M05-01 / -02; overview §6.6 budgets): one pass
 * over the session dataset or the answer log for the whole set, instead of one `history` / `answers`
 * call per user (about 1 ms each on the 32,122-session / 478,499-answer logs).
 *
 * - `sessionTotals(userIds?)` — per user: completed sessions, questions, correct answers, seconds, the
 *   sum of the session accuracies and the last completion, over all modes and over the practice modes
 *   (BR-35). One scan of the sessions on cheap fields.
 * - `answerFacts(userIds)` — the answers of the users as light facts (question, subject, correctness,
 *   selected option, session) without deriving a row; one pass over the log for the users not yet
 *   cached, then O(result). Facts are cached per user until the log or the sessions change.
 * - `subjectTotals(userIds)` and `questionTallies(userIds)` — the per-(user, subject) aggregates and the
 *   per-question tallies folded from the facts.
 *
 * Users without a session / answer are absent from the results.
 */

import { answersDataset } from '../datasets/answers'
import { deriveAnswerFact } from '../datasets/derive'
import { ANSWER_ID_MAX } from '../datasets/ids'
import { practicePrimeOrNull } from '../datasets/prime'
import { sessionsDataset } from '../datasets/sessions'
import { nextCacheKey, practiceReady } from './reads'
import { PRACTICE_MODES } from './rules'

export interface SessionTotalsBucket {
  sessions: number
  questions: number
  correct: number
  seconds: number
  /** Σ of `correctCount ÷ questionCount` over the sessions with questions (Q-SESS-MEAN-ACC numerator). */
  accSum: number
  accN: number
  lastAtMs: number
}

export interface UserSessionTotals {
  userId: number
  /** Every completed session. */
  all: SessionTotalsBucket
  /** Completed sessions of the practice modes (BR-35). */
  practice: SessionTotalsBucket
}

const bucket = (): SessionTotalsBucket => ({
  sessions: 0,
  questions: 0,
  correct: 0,
  seconds: 0,
  accSum: 0,
  accN: 0,
  lastAtMs: 0,
})

const PRACTICE_SET: ReadonlySet<string> = new Set(PRACTICE_MODES)

/** Per-user session totals; `userIds` omitted = every user with a completed session. */
export function sessionTotals(userIds?: Iterable<number>): Map<number, UserSessionTotals> {
  const out = new Map<number, UserSessionTotals>()
  if (!practiceReady()) return out
  const want = userIds ? new Set(userIds) : null
  if (want && want.size === 0) return out
  sessionsDataset.count(
    { status: 'completed' },
    (r) => {
      if (want && !want.has(r.userId)) return false
      let t = out.get(r.userId)
      if (!t) {
        t = { userId: r.userId, all: bucket(), practice: bucket() }
        out.set(r.userId, t)
      }
      const add = (b: SessionTotalsBucket) => {
        b.sessions++
        b.questions += r.questionCount
        b.correct += r.correctCount
        b.seconds += r.timeSpent
        if (r.questionCount > 0) {
          b.accSum += r.correctCount / r.questionCount
          b.accN++
        }
        if (r.completedAtMs > b.lastAtMs) b.lastAtMs = r.completedAtMs
      }
      add(t.all)
      if (PRACTICE_SET.has(r.mode)) add(t.practice)
      return false
    },
    {
      matchFields: [
        'userId',
        'mode',
        'questionCount',
        'correctCount',
        'timeSpent',
        'completedAtMs',
      ],
      cacheKey: nextCacheKey('m05-session-totals'),
    },
  )
  return out
}

// ---------------------------------------------------------------------------------------------
// Answer facts
// ---------------------------------------------------------------------------------------------

export interface AnswerFact {
  userId: number
  questionId: number
  subjectId: number | null
  isCorrect: boolean
  /** Index into the question's options (null for PKSK items without options). */
  selectedOptionId: number | null
  sessionId: string | null
}

/**
 * One scan of the answer log per log version: every answer's id, user and correctness go into typed
 * arrays grouped by user (a counting sort), so any set of users is then served from the index without a
 * scan. Generated rows read their session from the prime; anchor and runtime rows (ids above the
 * generated range) are read from the stored row.
 */
interface LogIndex {
  /** user → [from, to) in `ids` / `correct`. */
  range: Map<number, readonly [number, number]>
  ids: Int32Array
  correct: Uint8Array
}

let stamp = ''
let index: LogIndex | null = null
/** Facts per user and subject (`*` = every subject). */
const cache = new Map<string, AnswerFact[]>()

const versionStamp = () => `${String(answersDataset.version)}:${String(sessionsDataset.version)}`

/** Forgets the cached facts and the index (every seed; they also follow the datasets' versions). */
export function resetAnswerFacts(): void {
  cache.clear()
  index = null
  stamp = ''
}

function buildIndex(): LogIndex {
  const total = answersDataset.count()
  const users = new Int32Array(total)
  const ids = new Int32Array(total)
  const ok = new Uint8Array(total)
  let n = 0
  answersDataset.count(
    {},
    (r) => {
      users[n] = r.userId
      ids[n] = r.id
      ok[n] = r.isCorrect ? 1 : 0
      n++
      return false
    },
    { matchFields: ['id', 'userId', 'isCorrect'], cacheKey: nextCacheKey('m05-answer-index') },
  )
  const counts = new Map<number, number>()
  for (let i = 0; i < n; i++)
    counts.set(users[i] as number, (counts.get(users[i] as number) ?? 0) + 1)
  const range = new Map<number, readonly [number, number]>()
  const next = new Map<number, number>()
  let at = 0
  for (const [u, c] of counts) {
    range.set(u, [at, at + c])
    next.set(u, at)
    at += c
  }
  const sortedIds = new Int32Array(n)
  const sortedOk = new Uint8Array(n)
  for (let i = 0; i < n; i++) {
    const u = users[i] as number
    const p = next.get(u) as number
    next.set(u, p + 1)
    sortedIds[p] = ids[i] as number
    sortedOk[p] = ok[i] as number
  }
  return { range, ids: sortedIds, correct: sortedOk }
}

/** The answers of each user (ids ascending), as light facts; optionally one subject. */
export function answerFacts(
  userIds: Iterable<number>,
  options: { subjectId?: number } = {},
): Map<number, AnswerFact[]> {
  const out = new Map<number, AnswerFact[]>()
  if (!practiceReady()) return out
  const s = versionStamp()
  if (s !== stamp || !index) {
    cache.clear()
    index = null
    stamp = s
  }
  const ids = [...new Set(userIds)]
  const subject = options.subjectId
  const tag = subject === undefined ? '*' : String(subject)
  const keyOf = (id: number) => `${String(id)}:${tag}`
  const missing = ids.filter((id) => !cache.has(keyOf(id)))
  if (missing.length > 0) {
    const idx = index ?? (index = buildIndex())
    const prime = practicePrimeOrNull()
    for (const userId of missing) {
      const r = idx.range.get(userId)
      const list: { id: number; fact: AnswerFact }[] = []
      for (let i = r ? r[0] : 0; r && i < r[1]; i++) {
        const id = idx.ids[i] as number
        const isCorrect = idx.correct[i] === 1
        if (id > ANSWER_ID_MAX) {
          // Anchor and runtime rows: the stored row.
          const row = answersDataset.get(id)
          if (!row) continue
          if (subject !== undefined && row.subjectId !== subject) continue
          list.push({
            id,
            fact: {
              userId,
              questionId: row.questionId,
              subjectId: row.subjectId,
              isCorrect: row.isCorrect,
              selectedOptionId: row.selectedOptionId,
              sessionId: row.sessionId,
            },
          })
          continue
        }
        // A generated answer of a session has its session's subject (the pool of every session subject
        // is non-empty by construction), so other subjects are skipped without drawing their questions.
        const sess = prime ? (prime.aSess[id] as number) : 0
        if (
          subject !== undefined &&
          sess > 0 &&
          prime &&
          (prime.sSubject[sess] as number) !== subject
        ) {
          continue
        }
        const d = deriveAnswerFact(id, isCorrect)
        if (subject !== undefined && d.subjectId !== subject) continue
        list.push({
          id,
          fact: {
            userId,
            questionId: d.questionId,
            subjectId: d.subjectId,
            isCorrect,
            selectedOptionId: d.selectedOptionId,
            sessionId: sess > 0 ? `g${String(sess)}` : null,
          },
        })
      }
      cache.set(
        keyOf(userId),
        list.sort((x, y) => x.id - y.id).map((x) => x.fact),
      )
    }
  }
  for (const id of ids) {
    const rows = cache.get(keyOf(id)) ?? []
    if (rows.length > 0) out.set(id, rows)
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Folds
// ---------------------------------------------------------------------------------------------

export interface UserSubjectTotals {
  subjectId: number
  answered: number
  correct: number
  /** Distinct questions answered in the subject. */
  questions: number
}

/** Per user, per subject (answers with a subject only), by subject id. */
export function subjectTotals(userIds: Iterable<number>): Map<number, UserSubjectTotals[]> {
  const out = new Map<number, UserSubjectTotals[]>()
  for (const [userId, facts] of answerFacts(userIds)) {
    const by = new Map<number, { n: number; c: number; q: Set<number> }>()
    for (const f of facts) {
      if (f.subjectId === null) continue
      const e = by.get(f.subjectId) ?? { n: 0, c: 0, q: new Set<number>() }
      e.n++
      if (f.isCorrect) e.c++
      e.q.add(f.questionId)
      by.set(f.subjectId, e)
    }
    out.set(
      userId,
      [...by.entries()]
        .sort((a, b) => a[0] - b[0])
        .map(([subjectId, e]) => ({
          subjectId,
          answered: e.n,
          correct: e.c,
          questions: e.q.size,
        })),
    )
  }
  return out
}

export interface QuestionTally {
  questionId: number
  attempts: number
  correct: number
  /** Distinct users that attempted it. */
  students: number
  /** Wrong answers per user (userId → count). */
  wrongByUser: Map<number, number>
  /** Wrong answers per selected option index. */
  wrongOptions: Map<number, number>
}

/** Per question over a set of users (optionally one subject), by question id. */
export function questionTallies(
  userIds: Iterable<number>,
  options: { subjectId?: number } = {},
): QuestionTally[] {
  const by = new Map<number, QuestionTally & { seen: Set<number> }>()
  for (const [userId, facts] of answerFacts(userIds, options)) {
    for (const f of facts) {
      let t = by.get(f.questionId)
      if (!t) {
        t = {
          questionId: f.questionId,
          attempts: 0,
          correct: 0,
          students: 0,
          wrongByUser: new Map(),
          wrongOptions: new Map(),
          seen: new Set(),
        }
        by.set(f.questionId, t)
      }
      t.attempts++
      if (!t.seen.has(userId)) {
        t.seen.add(userId)
        t.students++
      }
      if (f.isCorrect) t.correct++
      else {
        t.wrongByUser.set(userId, (t.wrongByUser.get(userId) ?? 0) + 1)
        if (f.selectedOptionId !== null) {
          t.wrongOptions.set(f.selectedOptionId, (t.wrongOptions.get(f.selectedOptionId) ?? 0) + 1)
        }
      }
    }
  }
  return [...by.values()]
    .sort((a, b) => a.questionId - b.questionId)
    .map((t) => ({
      questionId: t.questionId,
      attempts: t.attempts,
      correct: t.correct,
      students: t.students,
      wrongByUser: t.wrongByUser,
      wrongOptions: t.wrongOptions,
    }))
}
