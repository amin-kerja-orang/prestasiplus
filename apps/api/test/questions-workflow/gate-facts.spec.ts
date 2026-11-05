import { QuestionGateCheckSchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GATE_MESSAGES } from '../../src/modules/questions/workflow/lifecycle/gates'
import { QuestionsRepository } from '../../src/modules/questions'
import { bootWorkflowApp, expectError, loginAll, type Client, type WorkflowTestApp } from './helpers'

/**
 * R1-H-A18: the submit and approve gates read real facts (open duplicate, unconfirmed low-confidence fields, media, who edited last, declared
 * marks) through ONE loader, `QuestionsRepository.gateFacts`, instead of "satisfied" defaults. Real bank, real routes.
 */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('gate facts (real bank): duplicate, low confidence, media, AI editor, declared marks', () => {
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
    cognitiveLevel: 'mengaplikasi',
    curriculumChapterId: tag.chapterId,
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
    tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 3 },
    ...over,
  })
  /** A question in `status` (draft or review) with a chapter (not required by any gate since REQ-B-071; the practice reads count only chaptered questions). */
  async function make(status: 'draft' | 'review' = 'review', over: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/questions', body({ status, ...over }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = res.body.data.id as string
    await t.db.query('update question_versions set chapter_id = $1::bigint where question_id = $2::bigint', [tag.chapterId, id])
    return id
  }
  const move = (id: string, to: string) => admin.post(`/api/questions/${id}/status`, { to })
  const check = async (id: string, gate = 'approve') => envelopeOf(QuestionGateCheckSchema).parse((await admin.get(`/api/questions/${id}/gate-check?gate=${gate}`)).body).data
  const fieldsOf = (res: { body: { error?: { fields?: Record<string, string> } } }) => res.body.error?.fields ?? {}
  const statusOf = async (id: string) => (await t.db.query<{ status: string }>(`select status from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [id]))[0]!.status
  /** An accepted intake item for the question, with an optional duplicate link and low-confidence fields. */
  async function intakeItem(questionId: string, opts: { duplicate?: string; kind?: 'exact' | 'near' | 'variant'; low?: string[]; confirmed?: string[]; marks?: number } = {}): Promise<string> {
    const batch = (await t.db.query<{ id: string }>(`insert into intake_batches (paper_type, subject, kertas, year, source_text, rights_status) values ('trial', 'MAT', 1, 2025, 'x', 'own') returning id::text`))[0]!.id
    const item = (
      await t.db.query<{ id: string }>(
        `insert into intake_items (batch_id, position, item_type, payload, low_fields, confirmed_fields, question_id, review_state)
         values ($1::bigint, 1, 'mcq', $2::jsonb, $3::text[], $4::text[], $5::bigint, 'accepted') returning id::text`,
        [batch, JSON.stringify({ marks: opts.marks ?? 1 }), opts.low ?? [], opts.confirmed ?? [], questionId],
      )
    )[0]!.id
    await t.db.query(`update question_versions set intake_item_id = $1::bigint where question_id = $2::bigint`, [item, questionId])
    if (opts.duplicate) await t.db.query(`insert into duplicate_links (item_id, matched_question_id, kind, decision) values ($1::bigint, (select min(id) from questions where id <> $3::bigint), $4, $2)`, [item, opts.duplicate, questionId, opts.kind ?? 'near'])
    return item
  }

  it('1. an open duplicate link blocks Terbit (single and bulk); "Bukan pendua" and a linked variant close it', async () => {
    const id = await make()
    await intakeItem(id, { duplicate: 'pending' })
    const single = await move(id, 'approved')
    expect(single.status, JSON.stringify(single.body)).toBe(422)
    expect(fieldsOf(single).duplicate).toBe(GATE_MESSAGES.duplicate)
    const bulk = (await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [id] })).body.data
    expect(bulk.affected).toBe(0)
    expect(bulk.failed[0]).toMatchObject({ id, code: 'VALIDATION_ERROR', fields: { duplicate: GATE_MESSAGES.duplicate } })
    expect(await statusOf(id)).toBe('review')
    for (const decision of ['not_duplicate', 'linked_variant']) {
      await t.db.query(`update duplicate_links set decision = $2 where item_id = (select intake_item_id from question_versions where question_id = $1::bigint and version_no = 1)`, [id, decision])
      expect((await check(id)).ok, decision).toBe(true)
    }
    expect((await move(id, 'approved')).status).toBe(200)
  })

  it('1b. REQ-B-057: only an open exact or near link counts; a pending VARIANT link (informational) never blocks Semakan or Terbit, single or bulk', async () => {
    for (const kind of ['exact', 'near'] as const) {
      const blocked = await make('draft')
      await intakeItem(blocked, { duplicate: 'pending', kind })
      const refused = await move(blocked, 'review')
      expect(refused.status, `${kind}: ${JSON.stringify(refused.body)}`).toBe(422)
      expect(fieldsOf(refused).duplicate, kind).toBe(GATE_MESSAGES.duplicate)
      expect((await check(blocked, 'submit')).ok, kind).toBe(false)
    }
    const id = await make('draft')
    await intakeItem(id, { duplicate: 'pending', kind: 'variant' })
    expect((await check(id, 'submit')).ok).toBe(true)
    expect((await move(id, 'review')).status).toBe(200)
    expect((await check(id)).ok).toBe(true)
    expect((await move(id, 'approved')).status).toBe(200)

    const viaBulk = await make('draft')
    await intakeItem(viaBulk, { duplicate: 'pending', kind: 'variant' })
    const bulk = (await admin.post('/api/questions/bulk-action', { action: 'review', ids: [viaBulk] })).body.data
    expect(bulk.failed, JSON.stringify(bulk)).toEqual([])
    expect(await statusOf(viaBulk)).toBe('review')
  })

  it('2. an unconfirmed low-confidence field blocks Semakan (the submit gate); a confirmed one does not', async () => {
    const id = await make('draft')
    await intakeItem(id, { low: ['stem', 'options'], confirmed: ['stem'] })
    const refused = await move(id, 'review')
    expect(refused.status, JSON.stringify(refused.body)).toBe(422)
    expect(fieldsOf(refused)).toEqual({ options: GATE_MESSAGES.lowConfidence })
    expect((await check(id, 'submit')).issues.map((i) => i.path)).toEqual(['options'])
    await t.db.query(`update intake_items set confirmed_fields = array['stem','options'] where question_id = $1::bigint`, [id])
    expect((await move(id, 'review')).status).toBe(200)
  })

  it('3. media: a picture stimulus with no file, a table with no grid, a passage with no text and a legacy image hold each block Terbit', async () => {
    const cases: [string, string, string | null][] = [
      ['image with no file', `insert into stimuli (kind, label) values ('image', 'Gambar') returning id::text`, null],
      ['table with no grid', `insert into stimuli (kind, label) values ('table', 'Jadual') returning id::text`, null],
      ['empty passage', `insert into stimuli (kind, label, body_ms) values ('passage', 'Petikan', '  ') returning id::text`, null],
    ]
    for (const [name, insert] of cases.map(([n, i]) => [n, i] as const)) {
      const id = await make()
      const sid = (await t.db.query<{ id: string }>(insert))[0]!.id
      const group = (await t.db.query<{ id: string }>(`insert into stimulus_groups (scope) values ('section') returning id::text`))[0]!.id
      await t.db.query(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1)`, [group, sid])
      await t.db.query(`update questions set group_id = $1::bigint, group_position = 1 where id = $2::bigint`, [group, id])
      const res = await move(id, 'approved')
      expect(res.status, name).toBe(422)
      expect(fieldsOf(res).media, name).toBe(GATE_MESSAGES.media)
      // the stimulus gets its content: the gate lets the question through
      await t.db.query(`update stimuli set body_ms = 'Isi petikan.', kind = 'passage' where id = $1::bigint`, [sid])
      expect((await move(id, 'approved')).status, `${name} fixed`).toBe(200)
    }
    const held = await make()
    await t.db.query(`update question_versions set import_issues = '[{"code":"legacy_image_unresolved","target":"question"}]'::jsonb where question_id = $1::bigint`, [held])
    expect(fieldsOf(await move(held, 'approved')).media).toBe(GATE_MESSAGES.media)
  })

  it('4. the AI as last editor blocks Terbit; a person edit, or any status move by a person, clears it', async () => {
    const id = await make()
    await t.db.query(`update question_versions set last_editor = 'ai' where question_id = $1::bigint`, [id])
    const refused = await move(id, 'approved')
    expect(refused.status).toBe(422)
    expect(fieldsOf(refused).reviewer).toBe(GATE_MESSAGES.reviewerAi)
    // a person edit: the question is edited in place (review) and the flag is cleared
    expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Berapakah hasil tambah empat dan lima?' }))).status).toBe(200)
    expect((await t.db.query<{ e: string }>(`select last_editor e from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [id]))[0]!.e).toBe('person')
    expect((await move(id, 'approved')).status).toBe(200)
    // a person moving draft to review clears it too
    const draft = await make('draft')
    await t.db.query(`update question_versions set last_editor = 'ai' where question_id = $1::bigint`, [draft])
    expect((await move(draft, 'review')).status).toBe(200)
    expect((await t.db.query<{ e: string }>(`select last_editor e from question_versions where question_id = $1::bigint`, [draft]))[0]!.e).toBe('person')
    expect((await move(draft, 'approved')).status).toBe(200)
  })

  it('5. declared marks: a total that differs from the sum of the leaf marks blocks Terbit; equal or none passes', async () => {
    const id = await make()
    await t.db.query(`update question_versions set declared_marks = 5 where question_id = $1::bigint`, [id])
    const refused = await move(id, 'approved')
    expect(refused.status).toBe(422)
    expect(fieldsOf(refused).marks).toBe(GATE_MESSAGES.marksTotal)
    expect((await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [id] })).body.data.failed[0].fields.marks).toBe(GATE_MESSAGES.marksTotal)
    await t.db.query(`update question_versions set declared_marks = 1 where question_id = $1::bigint`, [id])
    expect((await check(id)).ok).toBe(true)
    const none = await make()
    expect((await move(none, 'approved')).status).toBe(200) // null declared marks passes
  })

  it('6. gate-check lists exactly what the transition refuses (parity), with every fact failing at once', async () => {
    const id = await make()
    await intakeItem(id, { duplicate: 'pending' })
    await t.db.query(`update question_versions set last_editor = 'ai', declared_marks = 9, import_issues = '[{"code":"legacy_image_unresolved"}]'::jsonb where question_id = $1::bigint`, [id])
    const gate = await check(id)
    expect(gate.ok).toBe(false)
    const refused = await move(id, 'approved')
    expect(refused.status).toBe(422)
    expect(Object.keys(fieldsOf(refused)).sort()).toEqual(['duplicate', 'marks', 'media', 'reviewer'])
    expect(gate.issues.map((i) => i.path).sort()).toEqual(Object.keys(fieldsOf(refused)).sort())
    expect(await statusOf(id)).toBe('review')
    // a clean question: both agree it passes
    const clean = await make()
    expect((await check(clean)).ok).toBe(true)
    expect((await move(clean, 'approved')).status).toBe(200)
  })

  it('7. the AI explanation writer marks its write, so a person must act before Terbit', async () => {
    const id = await make()
    expect((await t.db.query<{ e: string }>(`select last_editor e from question_versions where question_id = $1::bigint`, [id]))[0]!.e).toBe('person')
    const adapter = await import('../../src/modules/questions/workflow/bank-adapter')
    const bank = t.app.get(adapter.QuestionBankAdapter)
    expect(await bank.setExplanation(id, 'Penjelasan automatik.')).toBe(true)
    expect(fieldsOf(await move(id, 'approved')).reviewer).toBe(GATE_MESSAGES.reviewerAi)
  })

  it('7b. a question created already approved runs the same facts: a group stimulus with no picture refuses it and nothing is stored', async () => {
    const sid = (await t.db.query<{ id: string }>(`insert into stimuli (kind, label) values ('diagram', 'Rajah') returning id::text`))[0]!.id
    const group = (await t.db.query<{ id: string }>(`insert into stimulus_groups (scope) values ('section') returning id::text`))[0]!.id
    await t.db.query(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1)`, [group, sid])
    const before = Number((await t.db.query<{ n: string }>('select count(*) n from questions'))[0]!.n)
    const refused = await admin.post(`/api/stimulus-groups/${group}/questions`, body({ status: 'approved' }))
    expect(refused.status, JSON.stringify(refused.body)).toBe(422)
    expect(fieldsOf(refused).media).toBe(GATE_MESSAGES.media)
    expect(Number((await t.db.query<{ n: string }>('select count(*) n from questions'))[0]!.n)).toBe(before)
    await t.db.query(`update stimuli set kind = 'passage', body_ms = 'Isi.' where id = $1::bigint`, [sid])
    expect((await admin.post(`/api/stimulus-groups/${group}/questions`, body({ status: 'approved' }))).status).toBe(201)
  })

  it('9. the bulk Semakan runs the submit gate per row: a refused draft is a failed[] entry, a clean one moves', async () => {
    const clean = await make('draft')
    const lowField = await make('draft')
    await intakeItem(lowField, { low: ['stem'], confirmed: [] })
    const noChapter = await make('draft')
    await t.db.query('update question_versions set chapter_id = null where question_id = $1::bigint', [noChapter])
    const res = await admin.post('/api/questions/bulk-action', { action: 'review', ids: [clean, lowField, noChapter] })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.affected).toBe(2)
    const failed = res.body.data.failed as { id: string; code: string; fields: Record<string, string> }[]
    // REQ-B-071 (Q17): the Bab is not asked at Semakan, so the chapterless draft moves with the clean one.
    expect(failed.map((f) => f.id)).toEqual([lowField])
    expect(failed.find((f) => f.id === lowField)).toMatchObject({ code: 'VALIDATION_ERROR', fields: { stem: GATE_MESSAGES.lowConfidence } })
    expect(await statusOf(clean)).toBe('review')
    expect(await statusOf(lowField)).toBe('draft')
    expect(await statusOf(noChapter)).toBe('review')
  })

  it('10. an edit that does not supply the legacy image keeps the import hold on the new version; one that supplies it drops that issue', async () => {
    const id = await make('review')
    await t.db.query(`update question_versions set import_issues = '[{"code":"legacy_image_unresolved","target":"question","path":"a.png"},{"code":"html_math","target":"stem"}]'::jsonb where question_id = $1::bigint`, [id])
    expect((await move(id, 'approved')).status).toBe(422) // the hold shows as media while it is in force
    await t.db.query(`update question_versions set import_issues = null where question_id = $1::bigint`, [id])
    expect((await move(id, 'approved')).status).toBe(200)
    // an approved question that still carries its hold: an edit without the picture keeps every issue on the new version
    const makeHeld = async (): Promise<string> => {
      const q = await make('review')
      await t.db.query(`update question_versions set import_issues = '[{"code":"legacy_image_unresolved","target":"question","path":"b.png"},{"code":"html_math","target":"stem"}]'::jsonb where question_id = $1::bigint`, [q])
      await t.db.query(`update question_versions set status = 'approved' where question_id = $1::bigint`, [q])
      await t.db.query(`update questions set live_version_no = 1 where id = $1::bigint`, [q])
      return q
    }
    const issuesOf = async (q: string, versionNo: number) =>
      (await t.db.query<{ import_issues: { code: string }[] | null }>(`select import_issues from question_versions where question_id = $1::bigint and version_no = $2`, [q, versionNo]))[0]!.import_issues?.map((i) => i.code) ?? null
    const kept = await makeHeld()
    expect((await admin.put(`/api/questions/${kept}`, body({ questionText: 'Berapakah hasil tambah sembilan dan satu?' }))).status).toBe(200)
    expect(await issuesOf(kept, 2)).toEqual(['legacy_image_unresolved', 'html_math'])
    // an edit that supplies the picture drops the image issue and keeps the other one
    const supplied = await makeHeld()
    const up = await admin.post('/api/files?purpose=question_image').attach('file', Buffer.from(PNG, 'base64'), { filename: 'rajah.png', contentType: 'image/png' })
    expect(up.status, JSON.stringify(up.body)).toBe(201)
    const withImage = await admin.put(`/api/questions/${supplied}`, body({ questionText: 'Berapakah hasil tambah sembilan dan satu, ada rajah?', questionImageFileId: up.body.data.id }))
    expect(withImage.status, JSON.stringify(withImage.body)).toBe(200)
    expect(await issuesOf(supplied, 2)).toEqual(['html_math'])
    // the original version keeps its own record
    expect(await issuesOf(supplied, 1)).toEqual(['legacy_image_unresolved', 'html_math'])
  })

  it('10b. a draft edited twice: the import hold stays while the picture is missing and is released by the edit that supplies it (the draft is rewritten in place)', async () => {
    const id = await make('draft')
    await t.db.query(`update question_versions set import_issues = '[{"code":"legacy_image_unresolved","target":"question","path":"c.png"},{"code":"html_math","target":"stem"}]'::jsonb where question_id = $1::bigint`, [id])
    const issues = async () =>
      (await t.db.query<{ import_issues: { code: string }[] | null }>(`select import_issues from question_versions where question_id = $1::bigint and version_no = 1`, [id]))[0]!.import_issues?.map((i) => i.code) ?? null
    // the first edit does not supply the picture: the draft is rewritten and keeps the hold
    expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Berapakah hasil tambah sembilan dan dua?' }))).status).toBe(200)
    expect(await issues()).toEqual(['legacy_image_unresolved', 'html_math'])
    // the second edit supplies it: the image issue goes, the other one stays
    const up = await admin.post('/api/files?purpose=question_image').attach('file', Buffer.from(PNG, 'base64'), { filename: 'rajah.png', contentType: 'image/png' })
    expect(up.status, JSON.stringify(up.body)).toBe(201)
    const second = await admin.put(`/api/questions/${id}`, body({ questionText: 'Berapakah hasil tambah sembilan dan dua, ada rajah?', questionImageFileId: up.body.data.id }))
    expect(second.status, JSON.stringify(second.body)).toBe(200)
    expect(await issues()).toEqual(['html_math'])
    // so Terbit no longer refuses media
    expect((await move(id, 'review')).status).toBe(200)
    const approved = await move(id, 'approved')
    expect(approved.status, JSON.stringify(approved.body)).toBe(200)
  })

  it('8. regression: the seeded approved questions are untouched by the new facts, and the loader reads them as clean', async () => {
    const counts = await t.db.query<{ last_editor: string; n: string; declared: string }>(`select last_editor, count(*) n, count(declared_marks) declared from question_versions where number_label like 'SEED-%' group by last_editor`)
    expect(counts.find((c) => c.last_editor === 'ai')).toBeUndefined()
    expect(counts.every((c) => c.declared === '0')).toBe(true)
    const repo = t.app.get(QuestionsRepository)
    const approved = await t.db.query<{ id: string; version_no: number }>(`select q.id::text id, q.live_version_no version_no from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where v.status = 'approved' and v.number_label like 'SEED-%' limit 25`)
    expect(approved.length).toBeGreaterThan(5)
    for (const a of approved) {
      const f = await repo.gateFacts(a.id, a.version_no)
      expect(f, a.id).toMatchObject({ hasOpenDuplicateFlag: false, lastEditedByAi: false, declaredMarks: null, unconfirmedLowConfidenceFields: [] })
    }
    // still approved and listed
    expect((await t.db.query<{ n: string }>(`select count(*) n from question_versions where status = 'approved' and number_label like 'SEED-%'`))[0]!.n).not.toBe('0')
    expectError(await admin.get('/api/questions/999999999/gate-check'), 'NOT_FOUND')
  })
})
