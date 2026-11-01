import { QUESTION_MESSAGES, QuestionEditAsDraftResultSchema, QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, expectError, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

/** REQ-C-012: `POST /api/questions/:id/edit-as-draft` (V2 "Edit sebagai draf"): version n+1 as a draft, copied unchanged from the live one. */
describe('edit as draft', () => {
  let t: QuestionsTestApp
  let admin: Client
  let teacher: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    teacher = await loginAs(t, 'teacher')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  const make = async (over: Record<string, unknown> = {}): Promise<string> => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
  }
  const served = (over: Record<string, unknown> = {}) => make({ status: 'approved', tag, kertas: '2', ...over })
  const versions = (id: string) =>
    t.db.query<{ version_no: number; status: string }>(`select version_no, status from question_versions where question_id = $1 order by version_no`, [id])
  const live = async (id: string) => (await t.db.query<{ l: number | null }>(`select live_version_no l from questions where id = $1`, [id]))[0]!.l

  it('copies the live version unchanged into version 2 as a draft; the live version keeps serving', async () => {
    const id = await served()
    const res = await admin.post(`/api/questions/${id}/edit-as-draft`)
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const out = mutationEnvelopeOf(QuestionEditAsDraftResultSchema).parse(res.body)
    expect(out.data).toEqual({ id, versionNo: 2 })
    expect(out.status).toBe(QUESTION_MESSAGES.editAsDraft(id))
    expect(await versions(id)).toEqual([
      { version_no: 1, status: 'approved' },
      { version_no: 2, status: 'draft' },
    ])
    expect(await live(id)).toBe(1) // served until the draft is approved
    // m3: the call is audited (QUESTION_UPDATED with mode edit_as_draft), as the other Studio writes are
    const audit = await t.db.query<{ detail: { mode?: string; versionNo?: number } | null }>(`select detail from audit_events where target_id = $1 and detail->>'mode' = 'edit_as_draft'`, [id])
    expect(audit.map((a) => a.detail?.versionNo)).toEqual([2])

    // Same content: every content column, the SP nodes and the part tree (options and keys) are equal.
    const cols = await t.db.query<Record<string, unknown>>(
      `select stem_ms, stem_en, number_label, language, explanation_ms, subject_id, education_level_id, unit_node_id, chapter_id, topic_id, form_origin,
              cognitive_level, kbat, difficulty_tp, paper_code, type from question_versions where question_id = $1 order by version_no`,
      [id],
    )
    expect(cols[1]).toEqual(cols[0])
    const shape = (vn: number) =>
      t.db.query<Record<string, unknown>>(
        `select p.label, p.position, p.depth, p.marks, p.mode, p.prompt_ms,
                (select string_agg(o.label || ':' || o.body_ms, ',' order by o.position) from part_options o where o.part_id = p.id) opts,
                (select k.kind || ':' || k.content::text from answer_keys k where k.part_id = p.id) key
           FROM question_parts p JOIN question_versions v ON v.id = p.question_version_id WHERE v.question_id = $1 AND v.version_no = $2 ORDER BY p.depth, p.position`,
        [id, vn],
      )
    const v1 = await shape(1)
    expect(v1.length).toBeGreaterThan(0)
    expect(await shape(2)).toEqual(v1)
    const sps = (vn: number) => t.db.query(`select n.node_id from question_version_sp_nodes n join question_versions v on v.id = n.question_version_id where v.question_id = $1 and v.version_no = $2 order by n.node_id`, [id, vn])
    expect(await sps(2)).toEqual(await sps(1))
    expect((await sps(1)).length).toBeGreaterThan(0)
  })

  it('a second call is 409 with the BM message and names the draft; nothing is added (also while it is in review)', async () => {
    const id = await served()
    expect((await admin.post(`/api/questions/${id}/edit-as-draft`)).status).toBe(201)
    for (const stage of ['draft', 'review']) {
      if (stage === 'review') expect((await admin.post('/api/questions/bulk-action', { action: 'review', ids: [id] })).body.data.failed).toEqual([])
      const again = await admin.post(`/api/questions/${id}/edit-as-draft`)
      const error = expectError(again, 'CONFLICT')
      expect(error.message, stage).toBe(QUESTION_MESSAGES.editAsDraftExists)
      expect((again.body as { error: { details: unknown } }).error.details).toEqual({ id, versionNo: 2 })
    }
    expect((await versions(id)).length).toBe(2)
  })

  it('two parallel calls make one draft (one 201, one 409)', async () => {
    const id = await served()
    const [a, b] = await Promise.all([admin.post(`/api/questions/${id}/edit-as-draft`), admin.post(`/api/questions/${id}/edit-as-draft`)])
    expect([a.status, b.status].sort()).toEqual([201, 409])
    expect((await versions(id)).length).toBe(2)
  })

  it('a question that is not live is 409 (a plain draft, an archived one); an unknown id is 404', async () => {
    const draft = await make()
    expectError(await admin.post(`/api/questions/${draft}/edit-as-draft`), 'CONFLICT')
    const gone = await served()
    expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [gone] })).body.data.failed).toEqual([])
    const error = expectError(await admin.post(`/api/questions/${gone}/edit-as-draft`), 'CONFLICT')
    expect(error.message).toBe(QUESTION_MESSAGES.editAsDraftNotApproved)
    expect((await versions(gone)).length).toBe(1)
    expectError(await admin.post('/api/questions/987654321/edit-as-draft'), 'NOT_FOUND')
  })

  it('an import hold on the live version goes on to version 2: the draft keeps every issue and Terbit refuses media until the picture is supplied', async () => {
    const id = await served()
    const held = '[{"code":"legacy_image_unresolved","target":"question","path":"a.png"},{"code":"html_math","target":"stem"}]'
    await t.db.query(`update question_versions set import_issues = $2::jsonb where question_id = $1::bigint and version_no = 1`, [id, held])
    expect((await admin.post(`/api/questions/${id}/edit-as-draft`)).status).toBe(201)
    const issues = (await t.db.query<{ import_issues: unknown }>(`select import_issues from question_versions where question_id = $1::bigint and version_no = 2`, [id]))[0]!.import_issues
    expect(issues).toEqual(JSON.parse(held))
    expect((await admin.post('/api/questions/bulk-action', { action: 'review', ids: [id] })).body.data.failed).toEqual([])
    const approve = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [id] })
    expect(approve.status, JSON.stringify(approve.body)).toBe(200)
    const failed = approve.body.data.failed as { id: string; code: string; fields: Record<string, string> }[]
    expect(failed.map((f) => f.id)).toEqual([id])
    expect(failed[0]!.fields).toHaveProperty('media')
    expect(await live(id)).toBe(1) // the held draft did not take over
  })

  it('the draft can be approved again: it supersedes version 1', async () => {
    const id = await served()
    expect((await admin.post(`/api/questions/${id}/edit-as-draft`)).status).toBe(201)
    for (const action of ['review', 'approved']) {
      const r = await admin.post('/api/questions/bulk-action', { action, ids: [id] })
      expect(r.body.data.failed, action).toEqual([])
    }
    expect(await live(id)).toBe(2)
    expect((await versions(id)).map((v) => v.status)).toEqual(['archived', 'approved'])
  })

  it('Admin Pusat only, with a session and a CSRF token', async () => {
    const id = await served()
    expectError(await teacher.post(`/api/questions/${id}/edit-as-draft`), 'FORBIDDEN')
    expect((await t.http().post(`/api/questions/${id}/edit-as-draft`)).status).toBe(401)
    expect((await admin.noCsrf.post(`/api/questions/${id}/edit-as-draft`)).status).toBe(403)
    expect((await versions(id)).length).toBe(1)
  })
})
