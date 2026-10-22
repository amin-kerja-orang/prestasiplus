import { expect } from 'vitest'

import type { TestDatabase } from '../../support/db'
import type { InsertedMcq } from '../helpers'

export interface DbItem {
  position: number
  question_id: string
  key_index: number | null
  statement_true: boolean | null
  difficulty: number | null
  points: number | null
  card_id: string | null
  face: string | null
  pair_key: number | null
  matched: boolean
  checked_seq: number | null
  correct: boolean | null
}

/** The server-side facts of a session (the oracle of the tests; the API never sends them before the answer). */
export async function itemRows(db: TestDatabase, sessionId: string): Promise<DbItem[]> {
  return db.query<DbItem>(
    `select position, question_id::text as question_id, key_index, statement_true, difficulty, points, card_id, face, pair_key, matched, checked_seq, correct
       from game_session_items where session_id = $1::uuid order by position`,
    [sessionId],
  )
}

/**
 * Shortens the option texts of the first `count` questions so they fit Susun Jawapan (answer of at most 20 characters).
 * Even index: one word (letters puzzle), odd index: three words (words puzzle). Returns question id -> answer.
 */
export async function shortenAnswers(db: TestDatabase, questions: readonly InsertedMcq[], count: number): Promise<Map<string, string>> {
  const answers = new Map<string, string>()
  for (const [i, q] of questions.slice(0, count).entries()) {
    const answer = i % 2 === 0 ? `RUMAH${String(i)}` : `KATA ${String(i)} DUA`
    const [part] = await db.query<{ id: string }>(
      `select p.id::text as id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1::bigint`,
      [q.id],
    )
    const partId = (part as { id: string }).id
    for (const [k, label] of ['A', 'B', 'C', 'D'].entries()) {
      await db.query(`update part_options set body_ms = $3 where part_id = $1::bigint and label = $2`, [partId, label, k === q.keyIndex ? answer : `Salah ${label}${String(i)}`])
    }
    answers.set(q.id, answer)
  }
  return answers
}

/** No answer key may appear in a keyless payload (D58a). */
export function expectKeyless(body: unknown): void {
  const text = JSON.stringify(body)
  for (const key of ['is_true', 'is_correct', 'correct', 'correctAnswer', 'correct_option', 'pair_id', 'key_index', 'keyIndex', 'statement_true', '"answer"']) {
    expect(text, `payload must not carry ${key}`).not.toContain(key)
  }
}

/** The text of the key option of a question, read from the question tables (oracle for Susun Jawapan). */
export async function keyTextOf(db: TestDatabase, questionId: string, keyIndex: number): Promise<string> {
  const [row] = await db.query<{ body_ms: string }>(
    `select o.body_ms from part_options o join question_parts p on p.id = o.part_id join question_versions v on v.id = p.question_version_id
      where v.question_id = $1::bigint and o.label = $2`,
    [questionId, 'ABCD'[keyIndex]],
  )
  return (row as { body_ms: string }).body_ms.trim()
}
