import {
  ServabilityBatchResultSchema,
  ServabilityDatabankRowSchema,
  ServabilityOverviewSchema,
  ServabilityPaperRowSchema,
  ServabilityReportSchema,
  SERVABILITY_ACTIVITIES,
  SERVABILITY_BATCH_MAX,
} from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { ServabilityService } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, expectCsrfInvalid, expectError, loginAs, parseData, parseList, type Client, type QuestionsTestApp } from './helpers'

/**
 * R1-B11 (T30): the admin servability reads over HTTP. Admin Pusat only; the batch is capped and validated; the overview counts
 * equal what `evaluate` says (the SQL counts and the evaluator cannot drift); the lanes filter, page and carry the reasons.
 */
describe('admin servability reads (R1-T30)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let servability: ServabilityService
  let admin: Client
  let guru: Client
  let pupil: Client
  let tag: Tag
  let mathId: string
  const made: Record<string, string> = {}
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string; code: string }>(sql, params)

  async function approve(key: string, text: string, over: Record<string, unknown> = {}): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: text, tag: tagBody(tag, 4), ...over }), await adminActor(t.db))
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    made[key] = created.id
    return created.id
  }

  async function paper(title: string, status: 'draft' | 'published', questionIds: string[]): Promise<string> {
    const [p] = await q(
      `insert into papers (kind, title, subject_id, kertas, printed_duration_min, status, published_at) values ('pilihan', $1, $2, 2, 90, $3, ${status === 'published' ? 'now()' : 'null'}) returning id::text id`,
      [title, tag.subjectId, status],
    )
    const [s] = await q(`insert into paper_sections (paper_id, position, label, question_count, mark_budget) values ($1, 1, 'A', $2, $2) returning id::text id`, [p!.id, questionIds.length])
    for (const [i, id] of questionIds.entries()) await q(`insert into paper_placements (paper_section_id, question_id, pinned_version_no, position) values ($1, $2, 1, $3)`, [s!.id, id, i + 1])
    return p!.id
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    servability = t.app.get(ServabilityService)
    admin = await loginAs(t, 'admin')
    guru = await loginAs(t, 'teacher')
    pupil = await loginAs(t, 'student')
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    mathId = tag.subjectId
    await q(`insert into spm_subject_configs (subject_id, grp, display_order, databank_order) values ($1, 'teras', 1, 3) on conflict do nothing`, [mathId])

    await approve('plain', 'Soalan teks sahaja untuk bacaan kebolehhidangan.')
    await approve('second', 'Soalan kedua teks sahaja untuk bacaan kebolehhidangan.')
    const passage = await svc.createStimulus({ kind: 'passage', label: 'Petikan', bodyMs: 'Teks petikan.', bodyEn: null, altText: null, assetFileId: null })
    const groupId = await svc.createStimulusGroup({ label: 'Kumpulan', scope: 'section', stimulusIds: [passage], optionBank: [] })
    await approve('grouped', 'Ahli kumpulan untuk bacaan kebolehhidangan.', { stimulusGroupId: groupId })
    made.draft = (await svc.create(mcqInput(tag, { questionText: 'Soalan draf untuk bacaan kebolehhidangan.' }), await adminActor(t.db))).id
    // A table_fill question: the Bijak bridge refuses it (named unsupported shape).
    const tableFill = await svc.create(
      mcqInput(tag, {
        questionType: 'essay',
        options: undefined,
        correctAnswer: undefined,
        questionText: 'Soalan isi jadual untuk bacaan kebolehhidangan.',
        tag: tagBody(tag, 4),
        parts: [{ label: '', prompt: { ms: 'Isi jadual.' }, mode: 'table_fill', marks: 2, key: { kind: 'mapping', cells: { r1c1: ['x'] } } }] as never,
      }),
      await adminActor(t.db),
    )
    await q(`update question_versions set status = 'approved', published_at = now() where question_id = $1`, [tableFill.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [tableFill.id])
    made.tableFill = tableFill.id

    made.publishedPaper = await paper('Kertas terbit ujian bacaan', 'published', [made.plain!, made.tableFill!])
    made.draftPaper = await paper('Kertas draf ujian bacaan', 'draft', [made.plain!, made.second!])
    // H-A13: a question archived after its paper was published. The paper lists it, but a new sitting cannot start.
    await approve('toArchive', 'Soalan yang akan diarkibkan untuk bacaan kebolehhidangan.')
    made.archivedPaper = await paper('Kertas dengan soalan diarkib', 'published', [made.toArchive!])
    await q(`update question_versions set status = 'archived' where question_id = $1`, [made.toArchive])
    await q(`update questions set live_version_no = null where id = $1`, [made.toArchive])
  })
  afterAll(async () => {
    await t.close()
  })

  it('is Admin Pusat only: 401 without a session, 403 for a pupil and a teacher, on every route', async () => {
    const urls = [`/api/admin/servability/questions/${made.plain}`, '/api/admin/servability/overview', '/api/admin/servability/lanes/databank', '/api/admin/servability/lanes/bijak-spm']
    for (const url of urls) {
      expect((await t.http().get(url)).status, url).toBe(401)
      expectError(await pupil.get(url), 'FORBIDDEN')
      expectError(await guru.get(url), 'FORBIDDEN')
    }
    expectError(await pupil.post('/api/admin/servability/questions/batch', { ids: [made.plain] }), 'FORBIDDEN')
    expectError(await guru.post('/api/admin/servability/questions/batch', { ids: [made.plain] }), 'FORBIDDEN')
    expectCsrfInvalid(await admin.noCsrf.post('/api/admin/servability/questions/batch', { ids: [made.plain] }))
  })

  it('single read: the report of a question, 404 for an unknown or malformed id', async () => {
    const report = parseData(await admin.get(`/api/admin/servability/questions/${made.plain}`), ServabilityReportSchema)
    expect(report.questionId).toBe(made.plain)
    expect(report.activities.map((a) => a.activity)).toEqual([...SERVABILITY_ACTIVITIES])
    expect(report.activities.find((a) => a.activity === 'databank')?.served).toBe(true)
    expect(report.activities.find((a) => a.activity === 'simulasi_paper')?.served).toBe(true)
    const grouped = parseData(await admin.get(`/api/admin/servability/questions/${made.grouped}`), ServabilityReportSchema)
    expect(grouped.activities.find((a) => a.activity === 'latih_tubi_spm')?.reasons.map((r) => r.code)).toEqual(['has_stimulus'])
    const draft = parseData(await admin.get(`/api/admin/servability/questions/${made.draft}`), ServabilityReportSchema)
    expect(draft.versionNo).toBeNull()
    expect(draft.servedCount).toBe(0)
    for (const id of ['999999999', 'abc', '1;drop', '-1']) expectError(await admin.get(`/api/admin/servability/questions/${id}`), 'NOT_FOUND')
  })

  it('batch: reports in request order, duplicates once, unknown ids in notFound', async () => {
    const res = parseData(await admin.post('/api/admin/servability/questions/batch', { ids: [made.second, '999999999', made.plain, made.second] }), ServabilityBatchResultSchema)
    expect(res.reports.map((r) => r.questionId)).toEqual([made.second, made.plain])
    expect(res.notFound).toEqual(['999999999'])
    const one = parseData(await admin.get(`/api/admin/servability/questions/${made.plain}`), ServabilityReportSchema)
    expect(res.reports[1]).toEqual(one)
  })

  it('batch input is validated at the boundary: cap, empty, wrong types, extra keys, bad ids', async () => {
    const tooMany = Array.from({ length: SERVABILITY_BATCH_MAX + 1 }, (_, i) => String(i + 1))
    expect(expectError(await admin.post('/api/admin/servability/questions/batch', { ids: tooMany }), 'VALIDATION_ERROR').fields?.ids).toBe('Paling banyak 100 soalan sekali gus.')
    const atCap = Array.from({ length: SERVABILITY_BATCH_MAX }, (_, i) => String(i + 1))
    expect((await admin.post('/api/admin/servability/questions/batch', { ids: atCap })).status).toBe(200)
    expectError(await admin.post('/api/admin/servability/questions/batch', { ids: [] }), 'VALIDATION_ERROR')
    expectError(await admin.post('/api/admin/servability/questions/batch', { ids: 'abc' }), 'VALIDATION_ERROR')
    // Ids are opaque strings on the wire: one that is not a decimal id is simply not found (never reaches SQL), up to 64 characters.
    const odd = await admin.post('/api/admin/servability/questions/batch', { ids: ['1; drop table questions', made.plain] })
    expect(odd.status).toBe(200)
    expect(odd.body.data.notFound).toEqual(['1; drop table questions'])
    expect(odd.body.data.reports).toHaveLength(1)
    expectError(await admin.post('/api/admin/servability/questions/batch', { ids: ['x'.repeat(65)] }), 'VALIDATION_ERROR')
    expectError(await admin.post('/api/admin/servability/questions/batch', { ids: [1] }), 'VALIDATION_ERROR')
    expectError(await admin.post('/api/admin/servability/questions/batch', { ids: ['1'], extra: true }), 'VALIDATION_ERROR')
    expectError(await admin.post('/api/admin/servability/questions/batch', []), 'VALIDATION_ERROR')
  })

  it('overview: the SQL counts equal the evaluator over the whole bank, per activity', async () => {
    const overview = parseData(await admin.get('/api/admin/servability/overview'), ServabilityOverviewSchema)
    const allIds = (await q(`select id::text id from questions`)).map((r) => r.id)
    const reports = await servability.reports(allIds)
    const served = (a: string) => [...reports.values()].filter((r) => r.activities.find((x) => x.activity === a)?.served).length
    const by = new Map(overview.activities.map((a) => [a.activity, a]))
    expect(overview.activities.map((a) => a.activity)).toEqual([...SERVABILITY_ACTIVITIES])
    for (const activity of ['databank', 'latih_tubi_spm', 'bab', 'simulasi_kuiz', 'simulasi_paper'] as const) {
      expect(by.get(activity)?.served, activity).toBe(served(activity))
    }
    expect(by.get('simulasi_paper')).toMatchObject({ basis: 'evaluated', total: 3 })
    expect(by.get('databank')?.basis).toBe('sql')
    expect(by.get('jana_kertas')?.basis).toBe('pool')
    for (const a of overview.activities) expect(a.attention).toBe(Math.max(0, a.total - a.served))
    expect(overview.bank).toBe([...reports.values()].filter((r) => r.versionNo !== null).length - (await q(`select 1 from questions where is_active = false`)).length)
  })

  it('databank lane: Databank-subject questions with their reasons; filters and paging', async () => {
    const all = parseList(await admin.get('/api/admin/servability/lanes/databank?pageSize=100'), ServabilityDatabankRowSchema)
    const byId = new Map(all.map((r) => [r.questionId, r]))
    expect(byId.get(made.plain!)?.attention).toEqual([])
    expect(byId.get(made.grouped!)?.attention.map((r) => r.code)).toEqual(['has_stimulus'])
    expect(byId.get(made.draft!)?.attention.map((r) => r.code)).toEqual(['not_approved'])
    expect(byId.has(made.tableFill!)).toBe(false) // not an MCQ: the Databank lane lists objective questions only
    expect(byId.get(made.plain!)?.subject?.id).toBe(mathId)
    expect(byId.get(made.plain!)?.title).toContain('Soalan teks sahaja')

    const draftOnly = parseList(await admin.get('/api/admin/servability/lanes/databank?status=draft&search=draf%20untuk'), ServabilityDatabankRowSchema)
    expect(draftOnly.map((r) => r.questionId)).toEqual([made.draft])
    expect(parseList(await admin.get('/api/admin/servability/lanes/databank?status=nonsense'), ServabilityDatabankRowSchema)).toEqual([])
    expect(parseList(await admin.get('/api/admin/servability/lanes/databank?subjectId=abc'), ServabilityDatabankRowSchema)).toEqual([])
    // A search with LIKE wildcards matches literally, not everything.
    expect(parseList(await admin.get('/api/admin/servability/lanes/databank?search=%25'), ServabilityDatabankRowSchema)).toEqual([])

    const page1 = await admin.get('/api/admin/servability/lanes/databank?pageSize=2&page=1')
    expect(page1.body.data).toHaveLength(2)
    expect(page1.body.meta).toMatchObject({ page: 1, pageSize: 2, totalItems: all.length })
    const page2 = parseList(await admin.get('/api/admin/servability/lanes/databank?pageSize=2&page=2'), ServabilityDatabankRowSchema)
    expect(page2.map((r) => r.questionId)).toEqual(all.slice(2, 4).map((r) => r.questionId))
    // newest first
    const ids = all.map((r) => BigInt(r.questionId))
    expect(ids).toEqual([...ids].sort((a, b) => (a < b ? 1 : -1)))
  })

  it('lane queries are validated: bad page sizes, repeated parameters, over-long search', async () => {
    for (const bad of ['page=0', 'pageSize=101', 'page=abc', `search=${'x'.repeat(101)}`, 'search=a&search=b']) {
      expectError(await admin.get(`/api/admin/servability/lanes/databank?${bad}`), 'VALIDATION_ERROR')
      expectError(await admin.get(`/api/admin/servability/lanes/bijak-spm?${bad}`), 'VALIDATION_ERROR')
    }
  })

  it('Bijak SPM lane: papers with the count of placed questions the bridge cannot serve, by reason', async () => {
    const rows = parseList(await admin.get('/api/admin/servability/lanes/bijak-spm?pageSize=100'), ServabilityPaperRowSchema)
    const published = rows.find((r) => r.paperId === made.publishedPaper)!
    expect(published).toMatchObject({ status: 'published', questionCount: 2, attentionCount: 1 })
    expect(published.attention).toHaveLength(1)
    expect(published.attention[0]).toMatchObject({ code: 'bridge_refused', count: 1 })
    expect(published.attention[0]?.message).toContain('Tidak dihidangkan kerana')
    // A draft paper is not "not on a published paper": that reason is never counted in the lane.
    const draft = rows.find((r) => r.paperId === made.draftPaper)!
    expect(draft).toMatchObject({ status: 'draft', questionCount: 2, attentionCount: 0, attention: [] })
    expect(rows.map((r) => BigInt(r.paperId))).toEqual([...rows.map((r) => BigInt(r.paperId))].sort((a, b) => (a < b ? 1 : -1)))

    expect(parseList(await admin.get('/api/admin/servability/lanes/bijak-spm?status=draft'), ServabilityPaperRowSchema).map((r) => r.paperId)).toContain(made.draftPaper)
    expect(parseList(await admin.get('/api/admin/servability/lanes/bijak-spm?status=draft'), ServabilityPaperRowSchema).map((r) => r.paperId)).not.toContain(made.publishedPaper)
    expect(parseList(await admin.get('/api/admin/servability/lanes/bijak-spm?status=archived'), ServabilityPaperRowSchema)).toEqual([])
    expect(parseList(await admin.get('/api/admin/servability/lanes/bijak-spm?search=terbit%20ujian'), ServabilityPaperRowSchema).map((r) => r.paperId)).toEqual([made.publishedPaper])
  })

  it('Bijak SPM lane: a question archived after its paper was published is attention 1 with reason archived, and not served in the overview', async () => {
    const rows = parseList(await admin.get('/api/admin/servability/lanes/bijak-spm?pageSize=100'), ServabilityPaperRowSchema)
    const row = rows.find((r) => r.paperId === made.archivedPaper)!
    expect(row).toMatchObject({ status: 'published', questionCount: 1, attentionCount: 1 })
    expect(row.attention).toHaveLength(1)
    expect(row.attention[0]).toMatchObject({ code: 'archived', count: 1, message: 'Diarkibkan — pulihkan ke draf dahulu.' })
    const report = parseData(await admin.get(`/api/admin/servability/questions/${made.toArchive}`), ServabilityReportSchema)
    const paperResult = report.activities.find((a) => a.activity === 'simulasi_paper')!
    expect(paperResult.served).toBe(false)
    expect(paperResult.reasons.map((r) => r.code)).toEqual(['archived'])
  })

  it('sets no-store caching on the reads', async () => {
    const res = await admin.get('/api/admin/servability/overview')
    expect(String(res.headers['cache-control'])).toContain('no-store')
  })
})
