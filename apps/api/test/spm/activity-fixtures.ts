import type { TestDatabase } from '../support/db'

/** Row fixtures of the "Prestasi SPM Anda" tiles and the Sejarah list (S3-T07 part F): answers, sessions, sittings and ledger rows. */

export interface AnswerSeed {
  user: string
  /** `practice_answers.mode` (one of the 19 registry values). */
  mode: string
  /** Rows to insert. */
  n: number
  /** How many of them are correct (the first ones). */
  correct: number
  subjectId: string
  isTest?: boolean
  /** A part that carries marks (a self-marked part). */
  marks?: { awarded: number; max: number }
}

/** Inserts `n` answer rows of one mode with no session (an answer outside a session is a valid row). */
export async function addAnswers(db: TestDatabase, a: AnswerSeed): Promise<void> {
  for (let i = 0; i < a.n; i++) {
    await db.query(
      `insert into practice_answers (user_id, subject_id, is_correct, answered_at, mode, is_test, marks_awarded, marks_max)
       values ($1, $2, $3, '2026-10-18T01:00:00Z', $4, $5, $6, $7)`,
      [a.user, a.subjectId, i < a.correct, a.mode, a.isTest ?? false, a.marks?.awarded ?? null, a.marks?.max ?? null],
    )
  }
}

export interface SessionSeed {
  user: string
  mode: string
  status?: 'completed' | 'abandoned' | 'in_progress'
  questions?: number
  correct?: number
  coins?: number
  seconds?: number
  /** ISO instant; a completed session needs one, an abandoned or in-progress one has none. */
  completedAt?: string | null
  subjectId?: string | null
  isTest?: boolean
  /** `legacy_paper` (`bijak_kuiz` marks a Simulasi Kuiz session). */
  origin?: string | null
}

/** Inserts a practice session; returns its uuid. */
export async function addSession(db: TestDatabase, s: SessionSeed): Promise<string> {
  const status = s.status ?? 'completed'
  const completedAt = status === 'completed' ? (s.completedAt ?? '2026-10-18T01:10:00Z') : null
  const startedAt = completedAt ? new Date(new Date(completedAt).getTime() - 600_000).toISOString() : '2026-10-18T01:00:00Z'
  const rows = await db.query<{ id: string }>(
    `insert into practice_sessions (user_id, mode, subject_id, question_count, correct_count, coins_earned, time_spent_sec, status, started_at, completed_at, is_test, legacy_paper)
     values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) returning id::text`,
    [s.user, s.mode, s.subjectId ?? null, s.questions ?? 10, s.correct ?? 5, s.coins ?? 0, s.seconds ?? 600, status, startedAt, completedAt, s.isTest ?? false, s.origin ?? null],
  )
  return rows[0]?.id as string
}

export interface AttemptSeed {
  user: string
  /** `exam_attempts.paper_kind`: pilihan, jana, subjektif or structured. */
  kind: string
  status: 'submitted' | 'auto_submitted' | 'abandoned' | 'in_progress'
  subject: string
  subjectName: string
  startedAt: string
  /** Null for an open or abandoned attempt. */
  submittedAt?: string | null
  deadlineAt?: string | null
  score?: number
  max?: number
  coins?: number
  isTest?: boolean
}

/** Inserts a Bijak attempt (with a result row when `score` is given); returns its uuid. */
export async function addAttempt(db: TestDatabase, a: AttemptSeed): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into exam_attempts (user_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, status, started_at, deadline_at, duration_min, submitted_at, is_test)
     values ($1, $2, 'Kertas ujian', $3, $4, 1, '1449/1', 'exam', $5, $6, $7, 60, $8, $9) returning id::text`,
    [a.user, a.kind, a.subject, a.subjectName, a.status, a.startedAt, a.deadlineAt ?? null, a.submittedAt ?? null, a.isTest ?? false],
  )
  const id = rows[0]?.id as string
  if (a.score !== undefined) {
    await db.query(`insert into attempt_results (attempt_id, score, max_score, coins, graded) values ($1::uuid, $2, $3, $4, '{}'::jsonb)`, [id, a.score, a.max ?? a.score, a.coins ?? null])
  }
  return id
}

let ledgerSeq = 0

/** Inserts one M14 ledger credit (type `earn`). */
export async function addLedger(db: TestDatabase, user: string, source: string, amount: number, isTest = false): Promise<void> {
  await db.query(
    `insert into coin_ledger (user_id, type, source, source_id, amount, balance_after, description, is_test)
     values ($1, 'earn', $2, $3, $4, $4, 'Ujian', $5)`,
    [user, source, `${source}-${String(++ledgerSeq)}`, amount, isTest],
  )
}
