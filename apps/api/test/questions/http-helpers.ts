import type { TestDatabase } from '../support/db'
import { idOf } from '../curriculum/helpers'

export interface Refs {
  mathId: string
  sciId: string
  t4Id: string
  t5Id: string
  /** A chapter of MATH Tingkatan 4: `mcqBody` sends it, because Semakan (the submit gate) asks for a Bab. */
  chapterId?: string
}

export async function refsOf(db: TestDatabase): Promise<Refs> {
  return {
    mathId: await idOf(db, 'subjects', 'MATH'),
    sciId: await idOf(db, 'subjects', 'SCI'),
    t4Id: await idOf(db, 'education_levels', 'T4'),
    t5Id: await idOf(db, 'education_levels', 'T5'),
    chapterId: (await db.query<{ id: string }>(`select c.id::text id from chapters c join subjects s on s.id = c.subject_id join education_levels l on l.id = c.education_level_id where s.code = 'MATH' and l.code = 'T4' order by c.id limit 1`))[0]?.id as string,
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
export function mcqBody(refs: Pick<Refs, 'mathId' | 't4Id' | 'chapterId'>, over: Record<string, unknown> = {}): Record<string, unknown> {
  // The Bab: Semakan (draft to review) asks for it on every path. It is only the default for the default subject and level.
  const chapter = refs.chapterId !== undefined && over.subjectId === undefined && over.educationLevelId === undefined ? { curriculumChapterId: refs.chapterId } : {}
  return {
    ...chapter,
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
