import { QUESTION_MESSAGES } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import { StimuliRepository } from '../../src/modules/questions/stimuli.repository'
import { ACCOUNTS } from '../exam-builder/helpers'
import { makePng } from '../files/fixtures'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from './full-app'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 300_000 })

/**
 * R1 delete-served-guard (B3 review of REQ-B-052). Four holes around "what a pupil is served must not change under a sitting":
 *   1. a Guru could hard-delete their own approved question that sits on a Terbit paper (200, rows gone, the sitting answered 500);
 *   2. so could an admin (route and bulk `delete`);
 *   3. the served lock of groups and stimuli ignored a withdrawn paper that still has sittings, while `versionIsPinned` did not;
 *   4. the AI explanation write rewrote an approved or pinned version in place.
 * Plus the B-052 gap: an archived pinned question restored to draft and then edited must still branch.
 */
describe('R1 delete-served-guard', () => {
  let t: FullApp
  let admin: FullClient
  let guru: FullClient
  let pupil: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }
  let chapter: string
  let counter = 0

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)
  const count = async (id: string) => Number((await q(`select count(*)::int n from questions where id = $1`, [id]))[0]!.n)

  async function advance(ids: string[]): Promise<void> {
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.failed, `${action}: ${JSON.stringify(res.body.data)}`).toEqual([])
    }
  }
  const body = (over: Record<string, unknown> = {}) => ({
    subjectId: subject,
    educationLevelId: level,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: `Berapakah hasil tambah ${String(2 + counter++)} dan 3?`,
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
    explanation: 'Penjelasan ujian.',
    kertas: '2',
    cognitiveLevel: 'mengaplikasi',
    curriculumChapterId: chapter,
    tag,
    ...over,
  })
  async function create(over: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/questions', body(over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  async function approved(over: Record<string, unknown> = {}): Promise<string> {
    const id = await create(over)
    await advance([id])
    return id
  }
  /** A Guru-owned question that Admin Pusat fixed up and approved (the owner stays the Guru). */
  async function guruApproved(): Promise<string> {
    const text = `Soalan Guru: berapakah hasil tambah ${String(4 + counter++)} dan 5?`
    const made = await guru.post('/api/guru/questions', { subjectId: subject, educationLevelId: level, questionType: 'mcq', difficultyLevel: 3, questionText: text, options: ['8', '9', '10', '11'], correctAnswer: 1 })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    const own = made.body.data.id as string
    expect((await admin.put(`/api/questions/${own}`, body({ questionText: text, options: ['8', '9', '10', '11'], correctAnswer: 1 }))).status).toBe(200)
    const ok = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [own] })
    expect(ok.body.data.failed, JSON.stringify(ok.body.data)).toEqual([])
    expect((await q(`select created_by_id::text id from questions where id = $1`, [own]))[0]?.id).toBe(guru.userId)
    return own
  }
  const setPool = (id: string, pools: string[]) => admin.put(`/api/admin/section-pools/${id}`, { pools })

  /** A full MAT kertas 2 paper (A 3 questions, B 1, C 2), published with the audited Kontrak override. `first` replaces the first question. */
  async function publishedPaper(first?: string[]): Promise<{ paper: string; ids: string[] }> {
    const ids = [...(first ?? []), ...[await approved(), await approved(), await approved(), await approved(), await approved({ pointsValue: 2 }), await approved({ pointsValue: 2 })]].slice(0, 6)
    for (const [i, id] of ids.entries()) expect((await setPool(id, [i < 3 ? 'MAT2-A' : i === 3 ? 'MAT2-B' : 'MAT2-C'])).status).toBe(200)
    const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const paper = created.body.data.id as string
    const sections = ((await admin.get(`/api/admin/papers/${paper}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
    const at = [0, 0, 0, 1, 2, 2]
    for (const [i, id] of ids.entries()) {
      const res = await admin.post(`/api/admin/papers/${paper}/placements`, { sectionId: sections[at[i]!], questionId: id })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
    }
    const pub = await admin.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'Kontrak 1449/2 belum disahkan' })
    expect(pub.body.data, JSON.stringify(pub.body)).toMatchObject({ ok: true })
    return { paper, ids }
  }
  async function sit(paper: string): Promise<string> {
    const start = await pupil.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    return start.body.data.attemptId as string
  }

  async function snapshot(questionId: string, versionNo: number): Promise<string> {
    const version = await q(`select to_jsonb(v)::text as j from question_versions v where v.question_id = $1 and v.version_no = $2`, [questionId, versionNo])
    const parts = await q(`select to_jsonb(p)::text as j from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1 and v.version_no = $2 order by p.depth, p.position`, [questionId, versionNo])
    const options = await q(`select to_jsonb(o)::text as j from part_options o join question_parts p on p.id = o.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1 and v.version_no = $2 order by p.depth, p.position, o.position`, [questionId, versionNo])
    const keys = await q(`select to_jsonb(k)::text as j from answer_keys k join question_parts p on p.id = k.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1 and v.version_no = $2 order by p.depth, p.position`, [questionId, versionNo])
    return JSON.stringify({ version: version.map((r) => r.j), parts: parts.map((r) => r.j), options: options.map((r) => r.j), keys: keys.map((r) => r.j) })
  }
  /** The stored content of a version without ids, timestamps, version bookkeeping, explanation_ms and last_editor: the row, the part bodies, options and answer keys. */
  async function contentOf(questionId: string, versionNo: number): Promise<string> {
    const version = await q(`select (to_jsonb(v) - 'id' - 'version_no' - 'status' - 'explanation_ms' - 'last_editor' - 'created_at' - 'updated_at' - 'published_at')::text as j from question_versions v where v.question_id = $1 and v.version_no = $2`, [questionId, versionNo])
    const parts = await q(`select (to_jsonb(p) - 'id' - 'question_version_id' - 'parent_part_id' - 'created_at' - 'updated_at')::text as j from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1 and v.version_no = $2 order by p.depth, p.position`, [questionId, versionNo])
    const options = await q(`select (to_jsonb(o) - 'id' - 'part_id' - 'created_at' - 'updated_at')::text as j from part_options o join question_parts p on p.id = o.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1 and v.version_no = $2 order by p.depth, p.position, o.position`, [questionId, versionNo])
    const keys = await q(`select (to_jsonb(k) - 'id' - 'part_id' - 'created_at' - 'updated_at')::text as j from answer_keys k join question_parts p on p.id = k.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1 and v.version_no = $2 order by p.depth, p.position`, [questionId, versionNo])
    expect(parts.length, 'the version has parts').toBeGreaterThan(0)
    expect(keys.length, 'the version has an answer key').toBeGreaterThan(0)
    return JSON.stringify({ version: version.map((r) => r.j), parts: parts.map((r) => r.j), options: options.map((r) => r.j), keys: keys.map((r) => r.j) })
  }
  const versions = async (id: string) => (await q(`select version_no, status from question_versions where question_id = $1 order by version_no`, [id])).map((r) => `${String(r.version_no)}:${String(r.status)}`)
  async function served(attempt: string, questionId: string): Promise<string> {
    const res = await pupil.get(`/api/bijak/attempts/${attempt}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const entry = (res.body.data.questions as { id: string }[]).find((x) => x.id === questionId)
    expect(entry, `question ${questionId} in the attempt view`).toBeDefined()
    return JSON.stringify(entry)
  }

  beforeAll(async () => {
    t = await bootFullApp()
    await serveSeededBlueprints(t.db)
    admin = await loginFull(t, ACCOUNTS.admin)
    guru = await loginFull(t, ACCOUNTS.teacher)
    pupil = await loginFull(t, ACCOUNTS.student)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
    chapter = await one(`select id::text id from chapters where subject_id = ${subject} and education_level_id = ${level} order by id limit 1`)
  })
  afterAll(async () => {
    await t.close()
  })

  describe('1. Guru DELETE (removeOwn)', () => {
    it('a Guru-owned approved question on a Terbit paper with a running sitting: 409 in BM, the rows stay, the sitting still answers 200', async () => {
      const own = await guruApproved()
      const { paper } = await publishedPaper([own])
      const attempt = await sit(paper)
      const before = await served(attempt, own)
      const res = await guru.del(`/api/guru/questions/${own}`)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: QUESTION_MESSAGES.deleteRefused, details: { reason: 'served' } })
      expect(await count(own)).toBe(1)
      expect(await versions(own)).toEqual(['1:approved'])
      expect(await served(attempt, own)).toEqual(before) // GET /bijak/attempts/:id is 200 with the same question
    })

    it('a Guru question that is archived but still pinned by the Terbit paper: 409 as well', async () => {
      const own = await guruApproved()
      const { paper } = await publishedPaper([own])
      const attempt = await sit(paper)
      expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [own] })).body.data.failed).toEqual([])
      const res = await guru.del(`/api/guru/questions/${own}`)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error.details.reason).toBe('served') // an archived version a Terbit paper pins is still shown to pupils
      expect(await count(own)).toBe(1)
      expect((await pupil.get(`/api/bijak/attempts/${attempt}`)).status).toBe(200)
    })

    it('a Guru question that was never placed and is in review (what the Guru route creates) is deleted: 200', async () => {
      const made = await guru.post('/api/guru/questions', { subjectId: subject, educationLevelId: level, questionType: 'mcq', difficultyLevel: 3, questionText: 'Soalan Guru yang belum digunakan di mana-mana kertas?', options: ['1', '2', '3', '4'], correctAnswer: 1 })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      const id = made.body.data.id as string
      const res = await guru.del(`/api/guru/questions/${id}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(await count(id)).toBe(0)
    })

    it('a Guru-owned APPROVED question that no held paper places is deleted: 200 (as on the live site)', async () => {
      const own = await guruApproved()
      const res = await guru.del(`/api/guru/questions/${own}`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(await count(own)).toBe(0)
    })

    it('another teacher\'s question is still 404 (no probing), and an unknown id is 404', async () => {
      const mine = await create()
      expect((await guru.del(`/api/guru/questions/${mine}`)).status).toBe(404)
      expect((await guru.del('/api/guru/questions/987654321')).status).toBe(404)
      expect(await count(mine)).toBe(1)
    })
  })

  describe('2. admin DELETE (route and bulk)', () => {
    it('DELETE /questions/:id on a served question: 409, nothing deleted, the sitting is fine; archived and still pinned by the Terbit paper: 409', async () => {
      const { paper, ids } = await publishedPaper()
      const attempt = await sit(paper)
      const res = await admin.del(`/api/questions/${ids[1]!}`)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: QUESTION_MESSAGES.deleteRefused, details: { reason: 'served' } })
      expect(await count(ids[1]!)).toBe(1)
      expect((await pupil.get(`/api/bijak/attempts/${attempt}`)).status).toBe(200)

      expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [ids[2]!] })).body.data.failed).toEqual([])
      const pinned = await admin.del(`/api/questions/${ids[2]!}`)
      expect(pinned.status).toBe(409)
      expect(pinned.body.error.details.reason).toBe('served')
    })

    it('every other state is deleted as on the live site: an approved question and an archived one that no held paper places, a draft, one in review', async () => {
      const live = await approved()
      const archived = await approved()
      expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [archived] })).body.data.failed).toEqual([])
      for (const id of [live, archived]) {
        expect((await admin.del(`/api/questions/${id}`)).status, id).toBe(200)
        expect(await count(id)).toBe(0)
      }
    })

    it('an archived question that a Terbit paper pins, restored to draft: the pin alone refuses the delete (reason pinned)', async () => {
      const { paper, ids } = await publishedPaper()
      await sit(paper)
      expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [ids[0]!] })).body.data.failed).toEqual([])
      expect((await admin.post(`/api/questions/${ids[0]!}/status`, { to: 'draft' })).status).toBe(200)
      const res = await admin.del(`/api/questions/${ids[0]!}`)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error.details.reason).toBe('pinned')
      expect(await count(ids[0]!)).toBe(1)
    })

    it('a draft and a question in review that no paper holds are deleted (200); an unknown id is 404', async () => {
      const draft = await create()
      const review = await create()
      expect((await admin.post('/api/questions/bulk-action', { action: 'review', ids: [review] })).body.data.failed).toEqual([])
      expect((await admin.del(`/api/questions/${draft}`)).status).toBe(200)
      expect((await admin.del(`/api/questions/${review}`)).status).toBe(200)
      expect(await count(draft)).toBe(0)
      expect(await count(review)).toBe(0)
      expect((await admin.del('/api/questions/987654321')).status).toBe(404)
    })

    it('a question that only a DRAFT paper places is not held (the paper re-pins at Terbit): it is deleted, even approved and live', async () => {
      const spare = await approved()
      expect((await setPool(spare, ['MAT2-A'])).status).toBe(200)
      const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
      const paper = created.body.data.id as string
      const sections = ((await admin.get(`/api/admin/papers/${paper}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
      expect((await admin.post(`/api/admin/papers/${paper}/placements`, { sectionId: sections[0], questionId: spare })).status).toBe(201)
      expect((await admin.del(`/api/questions/${spare}`)).status).toBe(200)
      expect(await count(spare)).toBe(0)
    })

    it('bulk action delete reports a refused id in failed[] (CONFLICT, BM) and deletes the others', async () => {
      const { ids } = await publishedPaper()
      const draft = await create()
      const res = await admin.post('/api/questions/bulk-action', { action: 'delete', ids: [ids[0]!, draft, '987654321'] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data.affected).toBe(1)
      expect(res.body.data.failed).toEqual([
        { id: ids[0]!, code: 'CONFLICT', message: QUESTION_MESSAGES.deleteRefused, fields: {} },
        { id: '987654321', code: 'NOT_FOUND', message: QUESTION_MESSAGES.notFound, fields: {} },
      ])
      expect(await count(ids[0]!)).toBe(1)
      expect(await count(draft)).toBe(0)
    })
  })

  describe('3. one served rule: a withdrawn paper that still has sittings serves its pins', () => {
    it('the stimulus (stem picture) of a pinned archived version stays locked after the paper is withdrawn WITH a sitting, and is released when nobody sat it', async () => {
      const stimuli = t.app.get(StimuliRepository)
      const repo = t.app.get(QuestionsRepository)
      const upload = await admin.upload('/api/files?purpose=question_image', makePng({ width: 4 + counter++, height: 4 }))
      expect(upload.status, JSON.stringify(upload.body)).toBe(201)
      const withImage = async (): Promise<string> => approved({ questionImageFileId: upload.body.data.id as string })
      const stimulusOf = async (id: string) => one(`select vs.stimulus_id::text id from question_version_stimuli vs join question_versions v on v.id = vs.question_version_id where v.question_id = ${id} and v.version_no = 1`)

      const sat = await publishedPaper([await withImage()])
      const quiet = await publishedPaper([await withImage()])
      await sit(sat.paper)
      for (const id of [sat.ids[0]!, quiet.ids[0]!]) expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [id] })).body.data.failed).toEqual([])
      const satStimulus = await stimulusOf(sat.ids[0]!)
      const quietStimulus = await stimulusOf(quiet.ids[0]!)
      // Terbit: both are held
      expect(await stimuli.stimulusServed(satStimulus)).toBe(true)
      expect(await stimuli.stimulusServed(quietStimulus)).toBe(true)
      for (const p of [sat.paper, quiet.paper]) expect((await admin.post(`/api/admin/papers/${p}/withdraw`)).status).toBe(200)
      // withdrawn: held only where sittings exist, the same rule as versionIsPinned
      expect(await repo.versionIsPinned(sat.ids[0]!, 1)).toBe(true)
      expect(await stimuli.stimulusServed(satStimulus)).toBe(true)
      expect(await repo.versionIsPinned(quiet.ids[0]!, 1)).toBe(false)
      expect(await stimuli.stimulusServed(quietStimulus)).toBe(false)
      // the Studio route agrees: editing the picture's stimulus is a 409 while the sittings hold it
      const edit = await admin.put(`/api/stimuli/${satStimulus}`, { caption: 'Sumber lain' })
      expect(edit.status, JSON.stringify(edit.body)).toBe(409)
      expect((await admin.put(`/api/stimuli/${quietStimulus}`, { caption: 'Sumber lain' })).status).toBe(200)
    })

    it('a stimulus GROUP whose member sits on a withdrawn paper with a sitting cannot be reordered or dissolved (409)', async () => {
      const passage = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan A', body: { ms: 'Teks petikan untuk kumpulan yang dipaparkan.' } })
      expect(passage.status, JSON.stringify(passage.body)).toBe(201)
      const m1 = await create()
      const m2 = await create()
      const group = await admin.post('/api/stimulus-groups', { label: 'Petikan A', scope: 'section', stimulusIds: [passage.body.data.id], questionIds: [m1, m2] })
      expect(group.status, JSON.stringify(group.body)).toBe(201)
      const groupId = group.body.data.id as string
      await advance([m1, m2])
      const rest = [await approved(), await approved(), await approved({ pointsValue: 2 }), await approved({ pointsValue: 2 })]
      for (const [i, id] of [m1, m2, ...rest].entries()) expect((await setPool(id, [i < 3 ? 'MAT2-A' : i === 3 ? 'MAT2-B' : 'MAT2-C'])).status).toBe(200)
      const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
      const paper = created.body.data.id as string
      const sections = ((await admin.get(`/api/admin/papers/${paper}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
      const g = await admin.post(`/api/admin/papers/${paper}/placements`, { sectionId: sections[0], questionId: m1 })
      expect(g.status, JSON.stringify(g.body)).toBe(201)
      for (const [sec, id] of [[0, rest[0]!], [1, rest[1]!], [2, rest[2]!], [2, rest[3]!]] as const) expect((await admin.post(`/api/admin/papers/${paper}/placements`, { sectionId: sections[sec], questionId: id })).status).toBe(201)
      const pub = await admin.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'Kontrak 1449/2 belum disahkan' })
      expect(pub.body.data, JSON.stringify(pub.body)).toMatchObject({ ok: true })
      await sit(paper)
      // the members are archived (pinned versions only), then the paper is withdrawn: only the sitting holds them
      expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [m1, m2] })).body.data.failed).toEqual([])
      expect((await admin.post(`/api/admin/papers/${paper}/withdraw`)).status).toBe(200)
      const reorder = await admin.put(`/api/stimulus-groups/${groupId}/members/order`, { questionIds: [m2, m1] })
      expect(reorder.status, JSON.stringify(reorder.body)).toBe(409)
      const dissolve = await admin.del(`/api/stimulus-groups/${groupId}`)
      expect(dissolve.status, JSON.stringify(dissolve.body)).toBe(409)
      expect((await q(`select group_id::text g from questions where id = $1`, [m1]))[0]?.g).toBe(groupId)
    })
  })

  describe('4. the AI explanation write follows the edit rule', () => {
    const explanationOf = async (id: string, versionNo: number) => (await q(`select explanation_ms as e, last_editor as l from question_versions where question_id = $1 and version_no = $2`, [id, versionNo]))[0]!
    const PROVENANCE = 'rights_status, source_kind, year, exam_type, exam_board, textbook_bab, textbook_tingkatan, textbook_page, ai_model, source_region'

    it('an approved live question: version 1 stays byte-identical and keeps serving; the text goes to version 2 as a draft marked as the AI\'s, with the provenance', async () => {
      const id = await approved()
      await q(`update question_versions set rights_status = 'unclear', source_kind = 'lpm_official', year = 2019, exam_type = 'sebenar', exam_board = 'LPM', textbook_bab = 3, textbook_tingkatan = 4, textbook_page = 17, ai_model = 'model-contoh', source_region = '{"page":2}'::jsonb where question_id = $1`, [id])
      const before = await snapshot(id, 1)
      const res = await admin.post(`/api/questions/${id}/ai-explanation?force=1`)
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(await versions(id)).toEqual(['1:approved', '2:draft'])
      expect(await snapshot(id, 1)).toEqual(before)
      expect((await q(`select live_version_no l from questions where id = $1`, [id]))[0]!.l).toBe(1)
      const v2 = await explanationOf(id, 2)
      expect(v2.l).toBe('ai')
      expect(String(v2.e).length).toBeGreaterThan(10)
      expect(v2.e).not.toBe((await explanationOf(id, 1)).e)
      const cols = (v: number) => q(`select ${PROVENANCE} from question_versions where question_id = $1 and version_no = $2`, [id, v])
      expect(await cols(2)).toEqual(await cols(1))
      // the stem (part prompts), the options and the answer keys are unchanged on the draft: only explanation_ms, last_editor and the bookkeeping differ
      expect(await contentOf(id, 2)).toEqual(await contentOf(id, 1))
      // a second press rewrites the draft on top in place (it is not served or pinned)
      expect((await admin.post(`/api/questions/${id}/ai-explanation?force=1`)).status).toBe(200)
      expect(await versions(id)).toEqual(['1:approved', '2:draft'])
    })

    it('an archived question pinned by a Terbit paper: the pinned version is untouched and the pupil is served the same question', async () => {
      const { paper, ids } = await publishedPaper()
      const attempt = await sit(paper)
      const target = ids[0]!
      expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [target] })).body.data.failed).toEqual([])
      const before = await snapshot(target, 1)
      const servedBefore = await served(attempt, target)
      expect((await admin.post(`/api/questions/${target}/ai-explanation?force=1`)).status).toBe(200)
      expect(await versions(target)).toEqual(['1:archived', '2:draft'])
      expect(await snapshot(target, 1)).toEqual(before)
      expect(await served(attempt, target)).toEqual(servedBefore)
    })

    it('a draft that nobody is served is updated in place, marked as the AI\'s', async () => {
      const id = await create()
      expect((await admin.post(`/api/questions/${id}/ai-explanation?force=1`)).status).toBe(200)
      expect(await versions(id)).toEqual(['1:draft'])
      expect((await explanationOf(id, 1)).l).toBe('ai')
    })
  })

  describe('5. question_image read rule B keeps the pictures of a running sitting on a withdrawn paper', () => {
    it('Terbit: readable; withdrawn WITH the pupil\'s sitting: still readable (200); the pupil who never sat it, and a withdrawn paper nobody sat: 404', async () => {
      const other = await loginFull(t, 'pelajarmaju@demo.test')
      const upload = async (): Promise<{ id: string; url: string }> => {
        const res = await admin.upload('/api/files?purpose=question_image', makePng({ width: 4 + counter++, height: 4 }))
        expect(res.status, JSON.stringify(res.body)).toBe(201)
        return { id: res.body.data.id as string, url: res.body.data.url as string }
      }
      const sitImg = await upload()
      const quietImg = await upload()
      const sat = await publishedPaper([await approved({ questionImageFileId: sitImg.id })])
      const quiet = await publishedPaper([await approved({ questionImageFileId: quietImg.id })])
      await sit(sat.paper)
      // the question leaves the live path (archived): only the paper's pin can grant the picture now
      for (const id of [sat.ids[0]!, quiet.ids[0]!]) expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [id] })).body.data.failed).toEqual([])
      expect((await pupil.get(sitImg.url)).status).toBe(200)
      expect((await pupil.get(quietImg.url)).status).toBe(200)
      // regression guard: while the papers are PUBLISHED, a pupil with no sitting reads the pictures too (the narrowing applies to withdrawn papers only)
      expect((await other.get(sitImg.url)).status, 'published paper, a pupil with no sitting').toBe(200)
      expect((await other.get(quietImg.url)).status, 'published paper, a pupil with no sitting').toBe(200)
      for (const p of [sat.paper, quiet.paper]) expect((await admin.post(`/api/admin/papers/${p}/withdraw`)).status).toBe(200)
      expect((await pupil.get(sitImg.url)).status, 'the pupil\'s running sitting keeps its picture').toBe(200)
      expect((await other.get(sitImg.url)).status, 'a pupil who never sat the withdrawn paper').toBe(404)
      expect((await pupil.get(quietImg.url)).status, 'a withdrawn paper nobody sat').toBe(404)
    })
  })

  describe('6. a delete that a foreign key refuses is a 409 in_use, never a 500', () => {
    it('a question in a teacher\'s set (question_set_items, ON DELETE RESTRICT): admin, bulk and Guru', async () => {
      const inSet = await approved()
      const [header] = await q(`insert into question_sets (teacher_id, title, legacy_source, legacy_id, needs_rebuild) values ($1, 'Set ujian FK', 'cloud', $2, true) returning id::text id`, [guru.userId, `fk-${String(counter++)}`])
      await q(`insert into question_set_items (question_set_id, position, question_id, question_version_no) values ($1::bigint, 1, $2::bigint, 1)`, [header!.id, inSet])
      const res = await admin.del(`/api/questions/${inSet}`)
      expect(res.status, JSON.stringify(res.body)).toBe(409)
      expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: QUESTION_MESSAGES.deleteInUse, details: { reason: 'in_use' } })
      expect(await count(inSet)).toBe(1)

      const inSet2 = await approved()
      await q(`insert into question_set_items (question_set_id, position, question_id, question_version_no) values ($1::bigint, 3, $2::bigint, 1)`, [header!.id, inSet2])

      const bulk = await admin.post('/api/questions/bulk-action', { action: 'delete', ids: [inSet, inSet2] })
      expect(bulk.status, JSON.stringify(bulk.body)).toBe(200)
      expect(bulk.body.data.affected).toBe(0)
      expect(bulk.body.data.failed).toEqual([
        { id: inSet, code: 'CONFLICT', message: QUESTION_MESSAGES.deleteInUse, fields: {} },
        { id: inSet2, code: 'CONFLICT', message: QUESTION_MESSAGES.deleteInUse, fields: {} },
      ])

      // a Guru-owned one in a set: the same 409 on the Guru route
      const own = await guruApproved()
      await q(`insert into question_set_items (question_set_id, position, question_id, question_version_no) values ($1::bigint, 2, $2::bigint, 1)`, [header!.id, own])
      const g = await guru.del(`/api/guru/questions/${own}`)
      expect(g.status, JSON.stringify(g.body)).toBe(409)
      expect(g.body.error.details.reason).toBe('in_use')
      expect(await count(own)).toBe(1)

      // the 409 rolled everything back: once the set no longer uses it, the delete goes through
      await q(`delete from question_set_items where question_id = $1::bigint`, [inSet])
      expect((await admin.del(`/api/questions/${inSet}`)).status).toBe(200)
      expect(await count(inSet)).toBe(0)
    })
  })
})
