import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootWorkflowApp, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * REQ-B-017 / REQ-B-037: a new version made by editing an approved question keeps the declaration and provenance of the version it came from
 * (asserted on the columns themselves). D99 (user, 2026-11-01): V2 asks for source and rights once, at the intake batch, and has no per-question
 * gate, so a question declared `unclear` (migrated or new) is submitted, approved and published like any other.
 */
describe('editing keeps the rights declaration and provenance (REQ-B-017)', () => {
  let t: WorkflowTestApp
  let admin: Client
  let tag: { subjectId: string; levelId: string; unitId: string; spId: string; chapterId: string }

  beforeAll(async () => {
    t = await bootWorkflowApp({ bank: 'real', env: { THROTTLE_QUESTIONS_WRITE_PER_MINUTE: '100000' } })
    admin = (await loginAll(t)).admin
    const [row] = await t.db.query<{ subject_id: string; education_level_id: string; unit_node_id: string; sp: string }>(
      `select v.subject_id::text, v.education_level_id::text, v.unit_node_id::text,
              (select node_id::text from question_version_sp_nodes where question_version_id = v.id limit 1) as sp
         from question_versions v where v.number_label = 'SEED-MCQ-MATH-T4'`,
    )
    const [ch] = await t.db.query<{ id: string }>('select id::text from chapters where subject_id = $1::bigint and education_level_id = $2::bigint limit 1', [row!.subject_id, row!.education_level_id])
    tag = { subjectId: row!.subject_id, levelId: row!.education_level_id, unitId: row!.unit_node_id, spId: row!.sp, chapterId: ch!.id }
  })
  afterAll(async () => {
    await t.close()
  })

  const body = (over: Record<string, unknown> = {}) => ({
    questionType: 'mcq',
    questionText: 'Berapakah hasil tambah dua dan tiga?',
    subjectId: tag.subjectId,
    educationLevelId: tag.levelId,
    difficultyLevel: 2,
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
    tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    ...over,
  })
  const move = (id: string, to: string) => admin.post(`/api/questions/${id}/status`, { to })
  const columns = async (id: string, versionNo: number) =>
    (
      await t.db.query<Record<string, unknown>>(
        `select rights_status, source_kind, year, exam_type, exam_board, textbook_bab, textbook_tingkatan, textbook_page, ai_model from question_versions where question_id = $1::bigint and version_no = $2`,
        [id, versionNo],
      )
    )[0]!

  /** An approved question whose v1 declares `unclear` rights (a legacy import), then edited into a draft v2. */
  async function editedFromUnclear(): Promise<string> {
    const res = await admin.post('/api/questions', body({ status: 'approved' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [tag.chapterId, id])
    await t.db.query(
      `update question_versions set rights_status = 'unclear', source_kind = 'lpm_official', year = 2019, exam_type = 'sebenar', exam_board = 'LPM', textbook_bab = 3, textbook_tingkatan = 4, textbook_page = 17, ai_model = 'model-contoh' where question_id = $1::bigint`,
      [id],
    )
    const edit = await admin.put(`/api/questions/${id}`, body({ questionText: 'Berapakah hasil tambah empat dan lima?' }))
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    return id
  }

  it('the new version carries the rights declaration and the provenance columns of the one it was made from', async () => {
    const id = await editedFromUnclear()
    expect(await columns(id, 2)).toEqual(await columns(id, 1))
    expect((await columns(id, 2)).rights_status).toBe('unclear')
  })

  it('D99: a NEW question with rights unclear is submitted, approved and published; nothing asks for a source or rights per question', async () => {
    const res = await admin.post('/api/questions', body({ status: 'draft' }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    await t.db.query(`update question_versions set rights_status = 'unclear', chapter_id = $2::bigint where question_id = $1::bigint`, [id, tag.chapterId])
    await t.db.query(`update questions set created_by_id = null, source_type = null where id = $1::bigint`, [id]) // no author, no source: nothing is declared at all
    expect((await move(id, 'review')).status).toBe(200) // Semakan: no "Sila nyatakan sumber soalan."
    expect((await move(id, 'approved')).status).toBe(200) // Terbitkan: no rights check
    expect((await t.db.query<{ status: string; live: number }>(`select v.status, q.live_version_no live from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.id = $1::bigint`, [id]))[0]).toEqual({ status: 'approved', live: 1 })
  })

  it('D99: a MIGRATED question (legacy id, rights unclear) is editable, submittable, approvable and publishable again, single and bulk', async () => {
    const id = await editedFromUnclear()
    await t.db.query(`update questions set legacy_source = 'cloud', legacy_id = $2 where id = $1::bigint`, [id, `q-${id}`])
    expect((await move(id, 'review')).status).toBe(200)
    expect((await move(id, 'approved')).status).toBe(200)
    // a second edit and the bulk Terbitkan
    expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Berapakah hasil tambah sepuluh dan satu?' }))).status).toBe(200)
    expect((await move(id, 'review')).status).toBe(200)
    const bulk = (await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [id] })).body.data
    expect(bulk).toMatchObject({ affected: 1, failed: [] })
    expect((await columns(id, 3)).rights_status).toBe('unclear') // and the declaration still travels with the content
  })

  it('a question with no declaration stays undeclared (null counts as own) and keeps going through', async () => {
    const res = await admin.post('/api/questions', body({ status: 'approved' }))
    const id = res.body.data.id as string
    await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [tag.chapterId, id])
    expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Berapakah hasil tambah enam dan tujuh?' }))).status).toBe(200)
    expect((await columns(id, 2)).rights_status).toBeNull()
    expect((await move(id, 'review')).status).toBe(200)
    expect((await move(id, 'approved')).status).toBe(200)
  })

  describe('REQ-B-037: every provenance column and every write path', () => {
    const PROVENANCE = `rights_status, source_kind, contributor_id::text, year, exam_type, exam_board, textbook_bab, textbook_tingkatan, textbook_page,
      source_paper_id::text, source_file_id::text, source_region, ai_run_id::text, ai_model, intake_item_id::text`
    const provenance = async (id: string, versionNo: number) =>
      (await t.db.query<Record<string, unknown>>(`select ${PROVENANCE} from question_versions where question_id = $1::bigint and version_no = $2`, [id, versionNo]))[0]!

    /** An approved question whose v1 carries a full provenance (source paper with year, type and board; file; region; AI run; intake item). */
    async function withProvenance(): Promise<{ id: string; paperId: string }> {
      const paperId = (
        await t.db.query<{ id: string }>(
          `insert into source_papers (natural_key, subject_id, kertas, year, exam_type, exam_board, rights_status)
           values ($1, $2::bigint, 'K1', 2019, 'sebenar', 'Johor', 'own') returning id::text id`,
          [`prov|${String(Math.random())}`, tag.subjectId],
        )
      )[0]!.id
      const res = await admin.post('/api/questions', body({ status: 'approved', kertas: '1' }))
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const id = res.body.data.id as string
      const adminId = (await t.db.query<{ id: string }>(`select id::text id from users where lower(email) = 'admin@demo.test'`))[0]!.id
      await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [tag.chapterId, id])
      await t.db.query(
        `update question_versions set rights_status = 'own', source_kind = 'lpm_official', contributor_id = $2::bigint, year = 2019, exam_type = 'sebenar', exam_board = 'Johor',
           textbook_bab = 3, textbook_tingkatan = 4, textbook_page = 17, source_paper_id = $3::bigint, source_file_id = 777, source_region = '{"page":2,"x":1,"y":2,"w":3,"h":4}'::jsonb,
           ai_run_id = 55, ai_model = 'model-contoh', intake_item_id = 66 where question_id = $1::bigint`,
        [id, adminId, paperId],
      )
      return { id, paperId }
    }

    it('PUT on an approved question (addVersion): v2 has every provenance column of v1', async () => {
      const { id } = await withProvenance()
      expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Berapakah hasil tambah lapan dan sembilan?' }))).status).toBe(200)
      const v1 = await provenance(id, 1)
      expect(v1.exam_board).toBe('Johor')
      expect(await provenance(id, 2)).toEqual(v1)
    })

    it('a second edit chain: approve v2, edit again (v3): still the same provenance', async () => {
      const { id } = await withProvenance()
      expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Soalan versi dua yang disunting?' }))).status).toBe(200)
      expect((await move(id, 'review')).status).toBe(200)
      expect((await move(id, 'approved')).status).toBe(200)
      expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Soalan versi tiga yang disunting?' }))).status).toBe(200)
      expect(await provenance(id, 3)).toEqual(await provenance(id, 1))
    })

    it('an in-place edit of a draft (rewriteVersion) leaves the provenance of that version alone', async () => {
      const { id } = await withProvenance()
      await admin.put(`/api/questions/${id}`, body({ questionText: 'Soalan versi dua?' })) // v2 draft
      const before = await provenance(id, 2)
      expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Soalan versi dua disunting lagi?' }))).status).toBe(200)
      expect(await provenance(id, 2)).toEqual(before)
    })

    it('the Guru update path (updateOwn on an approved question) copies it as well', async () => {
      const teacher = (await loginAll(t)).teacher
      const created = await teacher.post('/api/guru/questions', { questionType: 'mcq', questionText: 'Soalan guru untuk ujian asal usul?', options: ['1', '2', '3', '4'], correctAnswer: 1, subjectId: tag.subjectId, educationLevelId: tag.levelId, difficultyLevel: 3 })
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      const id = created.body.data.id as string
      await t.db.query(`update question_versions set status = 'approved', rights_status = 'school', exam_type = 'percubaan', exam_board = 'Selangor', year = 2021 where question_id = $1::bigint`, [id])
      await t.db.query(`update questions set live_version_no = 1 where id = $1::bigint`, [id])
      const edit = await teacher.put(`/api/guru/questions/${id}`, { questionText: 'Soalan guru yang disunting selepas diluluskan?' })
      expect(edit.status, JSON.stringify(edit.body)).toBe(200)
      expect(await provenance(id, 2)).toEqual(await provenance(id, 1))
      expect((await provenance(id, 2)).exam_board).toBe('Selangor')
    })

    it('the Studio filters keep matching the edited question: Tahun, Negeri, Jenis, and it is not "missing source"', async () => {
      const { id } = await withProvenance()
      expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Soalan untuk penapis selepas suntingan?' }))).status).toBe(200)
      const listed = async (query: string) => ((await admin.get(`/api/questions?${query}&pageSize=100`)).body.data as { id: string }[]).map((r) => r.id)
      for (const query of ['tahun=2019', 'negeri=johor', 'jenis=sebenar', 'kertas=1']) expect(await listed(query), query).toContain(id)
      expect(await listed('complianceFilter=missing_source')).not.toContain(id)
    })
  })
})
