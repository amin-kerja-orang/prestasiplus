/**
 * S10-T05 part 3 (FR-MUR-14-3) over a real database: SP tiles for a Tingkatan without Bab data, Bab tiles where an approved question
 * has a Bab, and one tile for an SP that exists in two DSKP editions. Fixtures (question, live version, `question_version_sp_nodes`)
 * are local to this spec. Runs in CI (Docker); here it only compiles.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { TestDatabase } from '../support/db'
import type { CurriculumTestApp } from '../curriculum/helpers'
import {
  addAnswers,
  addChapter,
  addSubject,
  bootHeatmapApp,
  clearAnswers,
  heatmapOf,
  loginAs,
  userIdByEmail,
  type Client,
} from './helpers'

let t: CurriculumTestApp
let pelajar: Client
let pelajarId: string

beforeAll(async () => {
  t = await bootHeatmapApp()
  pelajar = await loginAs(t, 'pelajar@demo.test')
  pelajarId = await userIdByEmail(t.db, 'pelajar@demo.test')
}, 300_000)

afterAll(async () => {
  await t?.close()
})

async function addSp(db: TestDatabase, subjectId: string, code: string, title: string, edition: string, sortOrder: number): Promise<string> {
  const rows = await db.query<{ id: string }>(
    `insert into curriculum_nodes (subject_id, education_level_id, kind, code, title, edition, sort_order)
     values ($1::bigint, (select id from education_levels where code = 'T4'), 'sp', $2, $3, $4, $5) returning id::text`,
    [subjectId, code, title, edition, sortOrder],
  )
  return rows[0]?.id as string
}

/** An active question with one live version; `chapterId` links a Bab, `spIds` the SP nodes. */
async function addQuestion(
  db: TestDatabase,
  o: { subjectId: string; status?: string; chapterId?: string | null; spIds?: string[] },
): Promise<string> {
  const q = await db.query<{ id: string }>(
    `insert into questions (source_type, live_version_no, is_active) values ('manual', 1, true) returning id::text`,
  )
  const id = q[0]?.id as string
  const v = await db.query<{ id: string }>(
    `insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id, education_level_id, chapter_id, published_at)
     values ($1::bigint, 1, $2, 'mcq', 'Soalan ujian', $3::bigint, (select id from education_levels where code = 'T4'), $4::bigint, now()) returning id::text`,
    [id, o.status ?? 'approved', o.subjectId, o.chapterId ?? null],
  )
  for (const sp of o.spIds ?? []) {
    await db.query(`insert into question_version_sp_nodes (question_version_id, node_id) values ($1::bigint, $2::bigint)`, [v[0]?.id, sp])
  }
  return id
}

describe('FR-MUR-14-3: SP fallback per subject and Tingkatan', () => {
  it('a subject without Bab data lists the SP tags of its approved questions; an unattempted SP is belum-cuba', async () => {
    await clearAnswers(t.db)
    const s = await addSubject(t.db, 'SP Sejarah', 40)
    const a = await addSp(t.db, s, '1.1.1', 'Memahami sejarah', 'DSKP 2017', 1)
    const b = await addSp(t.db, s, '1.1.2', 'Menghuraikan peristiwa', 'DSKP 2017', 2)
    const qa = await addQuestion(t.db, { subjectId: s, spIds: [a] })
    await addQuestion(t.db, { subjectId: s, spIds: [b] })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: null, questionId: qa, attempts: 7, correct: 4 })
    const data = await heatmapOf(pelajar.get)
    expect(data.subjects).toHaveLength(1)
    expect(data.subjects[0]?.chapters).toEqual([
      { id: a, number: null, name: '1.1.1 Memahami sejarah', attempts: 7, correct: 4, accuracy: 57.1, state: 'amber' },
      { id: b, number: null, name: '1.1.2 Menghuraikan peristiwa', attempts: 0, correct: 0, accuracy: null, state: 'belum-cuba' },
    ])
  })

  it('a subject with an approved Bab-linked question keeps Bab tiles and ignores SP', async () => {
    await clearAnswers(t.db)
    const s = await addSubject(t.db, 'Bab Matematik', 41)
    const c = await addChapter(t.db, s, 'Pecahan', undefined, { number: 1 })
    const sp = await addSp(t.db, s, '2.1.1', 'Mengenal pecahan', 'DSKP 2017', 1)
    const q = await addQuestion(t.db, { subjectId: s, chapterId: c, spIds: [sp] })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: c, questionId: q, attempts: 2, correct: 1 })
    const data = await heatmapOf(pelajar.get)
    expect(data.subjects[0]?.chapters.map((x) => [x.id, x.number])).toEqual([[c, 1]])
  })

  it('an SP present in two editions is one tile with pooled counts (highest node id)', async () => {
    await clearAnswers(t.db)
    const s = await addSubject(t.db, 'SP Dua Edisi', 42)
    const oldNode = await addSp(t.db, s, '3.1.1', 'Tajuk lama', 'DSKP 2017', 1)
    const newNode = await addSp(t.db, s, '3.1.1', 'Tajuk baharu', 'DSKP 2027', 1)
    const q1 = await addQuestion(t.db, { subjectId: s, spIds: [oldNode] })
    const q2 = await addQuestion(t.db, { subjectId: s, spIds: [newNode] })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: null, questionId: q1, attempts: 3, correct: 1 })
    await addAnswers(t.db, pelajarId, { subjectId: s, chapterId: null, questionId: q2, attempts: 2, correct: 2 })
    const data = await heatmapOf(pelajar.get)
    expect(data.subjects[0]?.chapters).toEqual([
      { id: newNode, number: null, name: '3.1.1 Tajuk baharu', attempts: 5, correct: 3, accuracy: 60, state: 'amber' },
    ])
  })
})
