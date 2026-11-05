import { GuruStructuredDetailSchema, GuruStructuredRowSchema, ListMetaSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { z } from 'zod'

import { bootQuestionsApp, expectError, loginAs, parseData, questionIdOf, type Client, type QuestionsTestApp } from './helpers'
import { refsOf, type Refs } from './http-helpers'

const ListSchema = z.object({ data: z.array(GuruStructuredRowSchema), meta: ListMetaSchema })

/** What the teacher list serves (the pupil rule of isStructuredVisible plus takedown, PKSK and an own picture stimulus without a file), counted straight from the tables over the LIVE version: the oracle of the list total. */
const SERVED_COUNT = `
  select count(*)::int as n
    from questions q
    join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
    join education_levels el on el.id = v.education_level_id
   where q.is_active and v.status = 'approved' and v.type = 'structured' and el.code in ('T4', 'T5')
     and not (coalesce(v.import_issues, '[]'::jsonb) @> '[{"code": "legacy_image_unresolved"}]'::jsonb)
     and not exists (select 1 from question_tags pt where pt.question_id = q.id and pt.kind = 'pksk_domain')
     and not exists (select 1 from source_papers tsp where tsp.id = v.source_paper_id and tsp.takedown_at is not null)
     and not exists (select 1 from question_version_stimuli vs join stimuli s on s.id = vs.stimulus_id
                      where vs.question_version_id = v.id and s.kind in ('image', 'diagram', 'map', 'infographic', 'graph') and s.asset_file_id is null)`

describe('structured question reads (teacher mount, API-GUR-26)', () => {
  let t: QuestionsTestApp
  let teacher: Client
  let admin: Client
  let refs: Refs
  beforeAll(async () => {
    t = await bootQuestionsApp()
    teacher = await loginAs(t, 'teacher')
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const list = async (query = '') => {
    const res = await teacher.get(`/api/guru/structured-questions${query}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return ListSchema.parse(res.body)
  }
  const served = async (): Promise<number> => Number((await t.db.query<{ n: number }>(SERVED_COUNT))[0]?.n)

  it('the list total equals the dataset, 20 per page, rows numbered from 1', async () => {
    const out = await list()
    const n = await served()
    expect(n).toBeGreaterThan(0)
    expect(out.meta).toMatchObject({ page: 1, pageSize: 20, totalItems: n })
    expect(out.data).toHaveLength(Math.min(n, 20))
    expect(out.data.map((r) => r.number)).toEqual(out.data.map((_, i) => i + 1))
    expect(out.data.every((r) => r.status === 'approved' && r.marks > 0 && r.subCount > 0)).toBe(true)
    expect((await list('?page=2')).data).toHaveLength(Math.max(0, n - 20))
  })

  it('the rows are newest first (page 2 numbering starts at 21 when the dataset is larger)', async () => {
    const ids = (await list()).data.map((r) => r.id)
    expect(ids.length).toBeGreaterThan(1)
    // Make the order observable: the last listed becomes the newest; undo it afterwards.
    const last = ids[ids.length - 1]!
    const before = (await t.db.query<{ at: string }>(`select created_at::text as at from questions where id = $1`, [last]))[0]!.at
    await t.db.query(`update questions set created_at = now() + interval '1 day' where id = $1`, [last])
    try {
      const after = (await list()).data.map((r) => r.id)
      expect(after[0]).toBe(last)
      const stamps = await t.db.query<{ at: string }>(`select created_at::text as at from questions where id = any($1::bigint[]) order by array_position($1::bigint[], id)`, [after])
      const times = stamps.map((s) => new Date(s.at).getTime())
      expect([...times].sort((x, y) => y - x)).toEqual(times)
    } finally {
      await t.db.query(`update questions set created_at = $2::timestamptz where id = $1`, [last, before])
    }
    const total = await served()
    if (total > 20) expect((await list('?page=2')).data[0]?.number).toBe(21)
    else expect((await list('?page=2')).data).toHaveLength(0)
  })

  /** Runs `change`, then `check`, then puts the touched version rows back to what they were. */
  async function withVersion(id: string, set: string, params: unknown[], run: () => Promise<void>): Promise<void> {
    const keep = (await t.db.query<{ status: string; import_issues: unknown; source_paper_id: string | null }>(`select status, import_issues, source_paper_id::text from question_versions v join questions q on q.id = v.question_id and v.version_no = q.live_version_no where q.id = $1`, [id]))[0]!
    await t.db.query(`update question_versions v set ${set} from questions q where q.id = v.question_id and v.version_no = q.live_version_no and q.id = $1`, [id, ...params])
    try {
      await run()
    } finally {
      await t.db.query(
        `update question_versions v set status = $2, import_issues = $3::jsonb, source_paper_id = $4::bigint from questions q where q.id = v.question_id and v.version_no = q.live_version_no and q.id = $1`,
        [id, keep.status, JSON.stringify(keep.import_issues), keep.source_paper_id],
      )
    }
  }

  it('an approved live v1 with a newer draft v2 is listed, counted, and its detail shows the v1 content', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-ECF')
    const v1 = (await t.db.query<{ stem: string | null; subject_id: string | null; education_level_id: string | null }>(`select stem_ms as stem, subject_id::text, education_level_id::text from question_versions where question_id = $1 and version_no = 1`, [id]))[0]!
    const countBefore = (await list()).meta.totalItems
    await t.db.query(
      `insert into question_versions (question_id, version_no, status, type, stem_ms, subject_id, education_level_id) values ($1, 2, 'draft', 'structured', 'KANDUNGAN DRAF V2', $2::bigint, $3::bigint)`,
      [id, v1.subject_id, v1.education_level_id],
    )
    await t.db.query(`update questions set latest_version_no = 2 where id = $1`, [id])
    try {
      const out = await list()
      expect(out.meta.totalItems).toBe(countBefore)
      expect(out.data.some((r) => r.id === id)).toBe(true)
      expect(out.meta.totalItems).toBe(await served())
      const detail = parseData(await teacher.get(`/api/guru/structured-questions/${id}`), GuruStructuredDetailSchema)
      expect(detail.stimulus).toContain(v1.stem ?? '')
      expect(detail.stimulus).not.toContain('KANDUNGAN DRAF V2')
    } finally {
      await t.db.query(`update questions set latest_version_no = 1 where id = $1`, [id])
      await t.db.query(`delete from question_versions where question_id = $1 and version_no = 2`, [id])
    }
  })

  it('only approved, live and active questions are listed', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-ECF')
    const before = await list()
    expect(before.data.some((r) => r.id === id)).toBe(true)
    await withVersion(id, `status = 'draft'`, [], async () => {
      const after = await list()
      expect(after.meta.totalItems).toBe(before.meta.totalItems - 1)
      expect(after.data.some((r) => r.id === id)).toBe(false)
      expect((await teacher.get(`/api/guru/structured-questions/${id}`)).status).toBe(404)
    })
    await t.db.query(`update questions set is_active = false where id = $1`, [id])
    try {
      expect((await list()).data.some((r) => r.id === id)).toBe(false)
    } finally {
      await t.db.query(`update questions set is_active = true where id = $1`, [id])
    }
    expect((await list()).data.some((r) => r.id === id)).toBe(true)
  })

  it('FR-X1-4f: a question that needs a figure it lacks is not served (list and detail)', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    expect((await list()).data.some((r) => r.id === id)).toBe(true)
    const issue = JSON.stringify([{ code: 'legacy_image_unresolved', target: 'question', path: 'soalan/rajah.png' }])
    await withVersion(id, `import_issues = $2::jsonb`, [issue], async () => {
      const out = await list()
      expect(out.data.some((r) => r.id === id)).toBe(false)
      expect(out.meta.totalItems).toBe(await served())
      expectError(await teacher.get(`/api/guru/structured-questions/${id}`), 'NOT_FOUND')
    })
    expect((await list()).data.some((r) => r.id === id)).toBe(true)
  })

  it('FR-X1-4f: a linked picture stimulus with no asset_file_id leaves the question out; with the file link gone it returns', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-ECF')
    const sid = (await t.db.query<{ id: string }>(`insert into stimuli (kind, label) values ('diagram', 'Rajah') returning id::text`))[0]!.id
    const vid = (await t.db.query<{ id: string }>(`select v.id::text from question_versions v join questions q on q.id = v.question_id and v.version_no = q.live_version_no where q.id = $1`, [id]))[0]!.id
    await t.db.query(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2, 1)`, [vid, sid])
    try {
      expect((await list()).data.some((r) => r.id === id)).toBe(false)
      expectError(await teacher.get(`/api/guru/structured-questions/${id}`), 'NOT_FOUND')
      expect((await list()).meta.totalItems).toBe(await served())
    } finally {
      await t.db.query(`delete from question_version_stimuli where question_version_id = $1 and stimulus_id = $2`, [vid, sid])
      await t.db.query(`delete from stimuli where id = $1`, [sid])
    }
    expect((await list()).data.some((r) => r.id === id)).toBe(true)
  })

  it('a Tingkatan 1-3 question, a PKSK question and a taken-down source paper are left out', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-ECF')
    // Tingkatan 1-3: move the live version to a level outside T4/T5.
    const other = (await t.db.query<{ id: string }>(`select id::text from education_levels where code not in ('T4', 'T5') and stage <> 'primary' limit 1`))[0]
    const level = (await t.db.query<{ l: string }>(`select v.education_level_id::text as l from question_versions v join questions q on q.id = v.question_id and v.version_no = q.live_version_no where q.id = $1`, [id]))[0]!.l
    if (other) {
      await t.db.query(`update question_versions v set education_level_id = $2::bigint from questions q where q.id = v.question_id and v.version_no = q.live_version_no and q.id = $1`, [id, other.id])
      try {
        expect((await list()).data.some((r) => r.id === id)).toBe(false)
        expectError(await teacher.get(`/api/guru/structured-questions/${id}`), 'NOT_FOUND')
      } finally {
        await t.db.query(`update question_versions v set education_level_id = $2::bigint from questions q where q.id = v.question_id and v.version_no = q.live_version_no and q.id = $1`, [id, level])
      }
    }
    await t.db.query(`insert into question_tags (question_id, kind, code) values ($1, 'pksk_domain', 'ZZ')`, [id])
    try {
      expect((await list()).data.some((r) => r.id === id)).toBe(false)
      expectError(await teacher.get(`/api/guru/structured-questions/${id}`), 'NOT_FOUND')
    } finally {
      await t.db.query(`delete from question_tags where question_id = $1 and kind = 'pksk_domain' and code = 'ZZ'`, [id])
    }
    const sp = (await t.db.query<{ id: string }>(`insert into source_papers (year, exam_board, exam_type, rights_status, takedown_at) values (2020, 'LPM', 'sebenar', 'own', now()) returning id::text`))[0]!.id
    await withVersion(id, `source_paper_id = $2::bigint`, [sp], async () => {
      expect((await list()).data.some((r) => r.id === id)).toBe(false)
      expectError(await teacher.get(`/api/guru/structured-questions/${id}`), 'NOT_FOUND')
    })
    await t.db.query(`delete from source_papers where id = $1`, [sp])
    expect((await list()).data.some((r) => r.id === id)).toBe(true)
  })

  it('the subject filter narrows the rows and the total; unknown values match nothing', async () => {
    const out = await list(`?subjectId=${refs.sciId}`)
    expect(out.data.every((r) => r.subject?.id === refs.sciId)).toBe(true)
    expect(out.meta.totalItems).toBe(out.data.length)
    expect((await list('?subjectId=999999')).data).toHaveLength(0)
  })

  it('status=review is an empty page; status=approved is the default list; another value is 422', async () => {
    const review = await list('?status=review')
    expect(review.data).toHaveLength(0)
    expect(review.meta.totalItems).toBe(0)
    expect((await list('?status=approved')).meta.totalItems).toBe(await served())
    expect(expectError(await teacher.get('/api/guru/structured-questions?status=draft'), 'VALIDATION_ERROR').fields?.status).toBeDefined()
    expect(expectError(await teacher.get('/api/guru/structured-questions?page=0'), 'VALIDATION_ERROR').fields?.page).toBeDefined()
  })

  it('the detail shows the stimulus once above the parts, with the scheme, and the marks agree with the row', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    const res = await teacher.get(`/api/guru/structured-questions/${id}`)
    const detail = parseData(res, GuruStructuredDetailSchema)
    const row = (await list()).data.find((r) => r.id === id)!
    expect(detail.status).toBe('approved')
    expect(detail.totalMarks).toBe(row.marks)
    expect(detail.subCount).toBe(row.subCount)
    expect(detail.subQuestions.reduce((s, x) => s + x.marks, 0)).toBe(detail.totalMarks)
    expect(detail.subQuestions.some((s) => s.modelAnswer !== '')).toBe(true)
    expect(detail.stimulus).not.toBe('')
    expect(JSON.stringify(res.body).split(JSON.stringify(detail.stimulus).slice(1, -1)).length - 1).toBe(1)
  })

  it('no admin-only field is on the row or the detail', async () => {
    const id = await questionIdOf(t.db, 'SEED-STR-TREE')
    const row = (await list()).data[0] as Record<string, unknown>
    const detail = (await teacher.get(`/api/guru/structured-questions/${id}`)).body.data as Record<string, unknown>
    const forbidden = ['sourceFile', 'sourcePage', 'sourceSet', 'complianceStatus', 'visibility', 'createdBy', 'isActive', 'needsDiagram', 'subjectId', 'educationLevelId', 'dskpSpId', 'curriculumChapterId', 'stats']
    for (const key of forbidden) {
      expect(row, key).not.toHaveProperty(key)
      expect(detail, key).not.toHaveProperty(key)
    }
  })

  it('an objective question id and an unknown id are 404', async () => {
    const mcq = await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
    expectError(await teacher.get(`/api/guru/structured-questions/${mcq}`), 'NOT_FOUND')
    expectError(await teacher.get('/api/guru/structured-questions/999999999'), 'NOT_FOUND')
    expectError(await teacher.get('/api/guru/structured-questions/xyz'), 'NOT_FOUND')
  })

  it('Admin Pusat may read it too; the admin route is unchanged (25 per page)', async () => {
    expect((await admin.get('/api/guru/structured-questions')).status).toBe(200)
    const res = await admin.get('/api/structured-questions')
    expect(res.status).toBe(200)
    expect(res.body.meta.pageSize).toBe(25)
  })

  it('student and school_admin get 403 on the list and the detail; a teacher gets 403 on the admin route', async () => {
    for (const role of ['student', 'schoolAdmin'] as const) {
      const c = await loginAs(t, role)
      expectError(await c.get('/api/guru/structured-questions'), 'FORBIDDEN')
      expectError(await c.get('/api/guru/structured-questions/1'), 'FORBIDDEN')
    }
    expectError(await teacher.get('/api/structured-questions'), 'FORBIDDEN')
  })
})
