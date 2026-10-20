import type { TestDatabase } from '../support/db'
import { idOf } from '../curriculum/helpers'

export interface Refs {
  mathId: string
  sciId: string
  t4Id: string
  t5Id: string
}

export async function refsOf(db: TestDatabase): Promise<Refs> {
  return {
    mathId: await idOf(db, 'subjects', 'MATH'),
    sciId: await idOf(db, 'subjects', 'SCI'),
    t4Id: await idOf(db, 'education_levels', 'T4'),
    t5Id: await idOf(db, 'education_levels', 'T5'),
  }
}

/** A valid curriculum tag (unit, one SP, TP) of a subject and level of the curriculum seed. */
export async function tagOf(db: TestDatabase, subjectId: string, levelId: string): Promise<{ unitId: string; spIds: string[]; tp: number }> {
  const node = async (kind: string): Promise<string> => {
    const rows = await db.query<{ id: string }>(
      `select id::text from curriculum_nodes where kind = $1 and subject_id = $2 and education_level_id = $3 order by sort_order, id limit 1`,
      [kind, subjectId, levelId],
    )
    const row = rows[0]
    if (!row) throw new Error(`no ${kind} node for subject ${subjectId} level ${levelId}`)
    return row.id
  }
  return { unitId: await node('unit'), spIds: [await node('sp')], tp: 3 }
}

/** A valid flat MCQ create body (admin). */
export function mcqBody(refs: Pick<Refs, 'mathId' | 't4Id'>, over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    subjectId: refs.mathId,
    educationLevelId: refs.t4Id,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: 'Berapakah hasil tambah 2 dan 3?',
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
    ...over,
  }
}

export const countOf = async (db: TestDatabase, sql: string, params: unknown[] = []): Promise<number> =>
  Number((await db.query<{ n: string }>(sql, params))[0]?.n)
