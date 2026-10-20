/**
 * Shared fixtures of the Part B specs (BE-09): service-level inputs built on the seeded curriculum.
 * Not a spec; the HTTP helpers are in `helpers.ts`.
 */
import type { QuestionPart } from '@pp/contract'

import { ApiError } from '../../src/common/errors/api-error'
import type { QuestionActor, QuestionCreateInput } from '../../src/modules/questions'
import type { TestDatabase } from '../support/db'

export interface Tag {
  subjectId: string
  levelId: string
  unitId: string
  spId: string
}

/** Subject, level, unit and SP of a seeded question (by `number_label`). */
export async function tagOf(db: TestDatabase, ref: string): Promise<Tag> {
  const row = (
    await db.query<{ s: string; l: string; u: string; sp: string }>(
      `select v.subject_id::text s, v.education_level_id::text l, v.unit_node_id::text u,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id order by id limit 1) sp
         from question_versions v where v.number_label = $1`,
      [ref],
    )
  )[0]
  if (!row) throw new Error(`seeded question ${ref} not found`)
  return { subjectId: row.s, levelId: row.l, unitId: row.u, spId: row.sp }
}

export async function userIdOf(db: TestDatabase, email: string): Promise<string> {
  const row = (await db.query<{ id: string }>(`select id::text id from users where email = $1`, [email]))[0]
  if (!row) throw new Error(`user ${email} not found`)
  return row.id
}

export async function adminActor(db: TestDatabase): Promise<QuestionActor> {
  return { userId: await userIdOf(db, 'admin@demo.test'), role: 'admin' }
}

export const TEXT = 'Soalan ujian BE-09: yang manakah jawapan yang betul?'

/** A flat MCQ create body; answer B. */
export function mcqInput(tag: Tag, over: Partial<QuestionCreateInput> = {}): QuestionCreateInput {
  return {
    subjectId: tag.subjectId,
    educationLevelId: tag.levelId,
    difficultyLevel: 3,
    questionText: TEXT,
    questionType: 'mcq',
    options: ['Satu', 'Dua', 'Tiga', 'Empat'],
    correctAnswer: 1,
    ...over,
  } as QuestionCreateInput
}

/** `tag` of the contract: unit + one SP + TP. */
export const tagBody = (tag: Tag, tp = 3) => ({ unitId: tag.unitId, spIds: [tag.spId], tp })

export const rich = (ms: string) => ({ ms })

/** A leaf `short_text` part. */
export const shortLeaf = (label: string, marks: number, values: string[], extra: Record<string, unknown> = {}): QuestionPart =>
  ({ label, prompt: rich(`Soalan ${label}`), mode: 'short_text', marks, key: { kind: 'accepted', values, ...extra } }) as QuestionPart

/** Runs `fn`, returns the thrown `ApiError` (fails the test when nothing is thrown). */
export async function apiError(fn: () => Promise<unknown>): Promise<ApiError> {
  try {
    await fn()
  } catch (e) {
    if (e instanceof ApiError) return e
    throw e
  }
  throw new Error('expected an ApiError')
}
