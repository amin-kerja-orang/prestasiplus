import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import { ACCOUNTS } from '../exam-builder/helpers'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { serveSeededBlueprints } from '../support/serve-blueprints'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 300_000 })

/**
 * REQ-B-052 (B3 E05B-L2, MEDIUM). A version that a Terbit paper (or a paper that has been sat) still pins must never be rewritten in place:
 * `QuestionsService.applyUpdate` adds a version n+1 (as a draft) when the latest version is `approved` or `archived`, or when
 * `QuestionsRepository.versionIsPinned` says a published (or sat, withdrawn) paper pins it; only an unpinned draft is rewritten on top. The
 * paper is Terbit and its pupils are served the pinned version, so an in-place edit would change what they sit and the marking key. The same rule
 * covers the admin `PUT /questions/:id` and the Guru `PUT` of an own question (`updateOwn`).
 *
 * The cases check the outcome, not one status code: the stored pinned version and what the pupil is served do not change, and a 200 means a
 * NEW version. The pinned clause has its own case (P1): a version restored to `draft` is neither approved nor archived, so only
 * `versionIsPinned` sends its edit to a new version; the case is red when that clause is removed.
 */
describe('REQ-B-052: an archived question pinned on a published paper cannot be rewritten in place', () => {
  let t: FullApp
  let admin: FullClient
  let guru: FullClient
  let pupil: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }
  let chapter: string

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)

  async function approve(ids: string[]): Promise<void> {
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
    questionText: 'Berapakah hasil tambah 2 dan 3?',
    options: ['4', '5', '6', '7'],
    correctAnswer: 1,
    kertas: '2',
    cognitiveLevel: 'mengaplikasi',
    curriculumChapterId: chapter,
    tag,
    ...over,
  })
  async function approved(over: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/questions', body(over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    await approve([res.body.data.id as string])
    return res.body.data.id as string
  }
  const setPool = (id: string, pools: string[]) => admin.put(`/api/admin/section-pools/${id}`, { pools })

  /** A full MAT kertas 2 paper (A 3 questions, B 1, C 2), published with the audited Kontrak override; the 6th question may be given. */
  async function publishedPaper(last?: string): Promise<{ paper: string; ids: string[] }> {
    const ids = [await approved(), await approved(), await approved(), await approved(), await approved({ pointsValue: 2 }), last ?? (await approved({ pointsValue: 2 }))]
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

  /** The whole stored content of one version: the row, its parts, the options and the answer keys. A rewrite in place changes it. */
  async function snapshot(questionId: string, versionNo: number): Promise<string> {
    const version = await q(`select to_jsonb(v)::text as j from question_versions v where v.question_id = $1 and v.version_no = $2`, [questionId, versionNo])
    const parts = await q(
      `select to_jsonb(p)::text as j from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1 and v.version_no = $2 order by p.depth, p.position`,
      [questionId, versionNo],
    )
    const options = await q(
      `select to_jsonb(o)::text as j from part_options o join question_parts p on p.id = o.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1 and v.version_no = $2 order by p.depth, p.position, o.position`,
      [questionId, versionNo],
    )
    const keys = await q(
      `select to_jsonb(k)::text as j from answer_keys k join question_parts p on p.id = k.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1 and v.version_no = $2 order by p.depth, p.position`,
      [questionId, versionNo],
    )
    return JSON.stringify({ version: version.map((r) => r.j), parts: parts.map((r) => r.j), options: options.map((r) => r.j), keys: keys.map((r) => r.j) })
  }
  const versions = async (questionId: string) => (await q(`select version_no, status from question_versions where question_id = $1 order by version_no`, [questionId])).map((r) => `${String(r.version_no)}:${String(r.status)}`)

  /** What a pupil is served for one question of an attempt: the attempt view entry (no key leaks to the pupil, the stem and options do). */
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

  it('admin PUT (update): the pinned version stays byte-identical and the pupil is served the same question', async () => {
    const { paper, ids } = await publishedPaper()
    const target = ids[0]!
    const start = await pupil.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const attempt = start.body.data.attemptId as string

    // the question is archived; its version 1 stays pinned on the Terbit paper
    const archived = await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [target] })
    expect(archived.status, JSON.stringify(archived.body)).toBe(200)
    expect(archived.body.data.failed).toEqual([])
    expect(await versions(target)).toEqual(['1:archived'])
    expect((await q(`select status from papers where id = $1`, [paper]))[0]?.status).toBe('published')
    const pinned = Number((await q(`select pinned_version_no from paper_placements where question_id = $1`, [target]))[0]!.pinned_version_no)
    expect(pinned).toBe(1)

    const rowBefore = await snapshot(target, pinned)
    const servedBefore = await served(attempt, target)

    // the edit: a new stem AND a new key (option 3 instead of option 1)
    const edit = await admin.put(`/api/questions/${target}`, body({ questionText: 'TEKS BAHARU: berapakah hasil darab 6 dan 7?', options: ['40', '41', '42', '43'], correctAnswer: 2 }))
    // done = refused (409, BM) OR a new version; never a 200 that rewrote version 1
    expect([200, 409], `edit answered ${String(edit.status)}: ${JSON.stringify(edit.body)}`).toContain(edit.status)

    expect.soft(await snapshot(target, pinned), 'the pinned version (stem, parts, options, key) must be byte-identical after the edit').toEqual(rowBefore)
    expect.soft(await served(attempt, target), 'the pupil must be served the same question after the edit').toEqual(servedBefore)
    if (edit.status === 200) expect((await versions(target)).length, 'a 200 must mean a NEW version, not a rewrite of version 1').toBeGreaterThan(1)
    else expect(await versions(target)).toEqual(['1:archived'])
    // (a NEW sitting is refused while the paper holds an archived question, before and after the edit: "Kertas ini sedang dikemas kini"; only the sittings that hold it continue)
    if (edit.status === 200) expect(await versions(target)).toEqual(['1:archived', '2:draft'])
  })

  it('an archived question that is on no paper also branches to a new draft version (an archived version is history)', async () => {
    const id = await approved()
    expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [id] })).body.data.failed).toEqual([])
    const before = await snapshot(id, 1)
    const edit = await admin.put(`/api/questions/${id}`, body({ questionText: 'Soalan diarkibkan, disunting: berapakah hasil tambah 8 dan 9?' }))
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    expect(await versions(id)).toEqual(['1:archived', '2:draft'])
    expect(await snapshot(id, 1)).toEqual(before)
    // the next edit rewrites the draft on top in place (it is not pinned anywhere)
    expect((await admin.put(`/api/questions/${id}`, body({ questionText: 'Soalan diarkibkan, disunting lagi: berapakah hasil tambah 8 dan 9?' }))).status).toBe(200)
    expect(await versions(id)).toEqual(['1:archived', '2:draft'])
    expect(await snapshot(id, 1)).toEqual(before)
  })

  it('P1 (the pinned clause): a version restored to draft but still pinned on a Terbit paper is not rewritten; the edit becomes version 2', async () => {
    const { paper, ids } = await publishedPaper()
    const target = ids[0]!
    expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [target] })).body.data.failed).toEqual([])
    // restore it to draft: version 1 is now a `draft` (not approved, not archived), yet the Terbit paper still pins it
    const restored = await admin.post(`/api/questions/${target}/status`, { to: 'draft' })
    expect(restored.status, JSON.stringify(restored.body)).toBe(200)
    expect(await versions(target)).toEqual(['1:draft'])
    expect((await q(`select status from papers where id = $1`, [paper]))[0]?.status).toBe('published')
    expect(Number((await q(`select pinned_version_no from paper_placements where question_id = $1`, [target]))[0]!.pinned_version_no)).toBe(1)
    const repo = t.app.get(QuestionsRepository)
    expect(await repo.versionIsPinned(target, 1)).toBe(true)

    const before = await snapshot(target, 1)
    const edit = await admin.put(`/api/questions/${target}`, body({ questionText: 'TEKS BAHARU selepas dipulihkan: berapakah hasil darab 6 dan 7?', options: ['40', '41', '42', '43'], correctAnswer: 2 }))
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    expect(await versions(target), 'the edit branches to version 2').toEqual(['1:draft', '2:draft'])
    expect(await snapshot(target, 1), 'version 1 (stem, parts, options, key) is byte-identical').toEqual(before)
    expect(JSON.stringify((await admin.get(`/api/questions/${target}`)).body.data)).toContain('TEKS BAHARU')
    // version 2 is not pinned anywhere: the next edit rewrites it in place
    expect((await admin.put(`/api/questions/${target}`, body({ questionText: 'TEKS BAHARU lagi: berapakah hasil darab 6 dan 7?' }))).status).toBe(200)
    expect(await versions(target)).toEqual(['1:draft', '2:draft'])
    expect(await snapshot(target, 1)).toEqual(before)
  })

  it('versionIsPinned: true on a Terbit paper and on a withdrawn paper that was sat; false on a draft paper and on a withdrawn paper nobody sat', async () => {
    const repo = t.app.get(QuestionsRepository)
    const sat = await publishedPaper()
    const quiet = await publishedPaper()
    const draft = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    const draftId = draft.body.data.id as string
    const sections = ((await admin.get(`/api/admin/papers/${draftId}`)).body.data.paper.sections as { id: string }[]).map((x) => x.id)
    const spare = await approved()
    expect((await admin.post(`/api/admin/papers/${draftId}/placements`, { sectionId: sections[0], questionId: spare })).status).toBe(201)
    expect(await repo.versionIsPinned(sat.ids[0]!, 1)).toBe(true)
    expect(await repo.versionIsPinned(quiet.ids[0]!, 1)).toBe(true)
    expect(await repo.versionIsPinned(spare, 1), 'a draft paper follows the question in force').toBe(false)
    expect(await repo.versionIsPinned(sat.ids[0]!, 2), 'only the pinned version number').toBe(false)
    expect((await pupil.post('/api/bijak/attempts', { paperId: sat.paper, mode: 'exam' })).status).toBe(201)
    for (const p of [sat.paper, quiet.paper]) expect((await admin.post(`/api/admin/papers/${p}/withdraw`)).status).toBe(200)
    expect(await repo.versionIsPinned(sat.ids[0]!, 1), 'a withdrawn paper keeps its sittings (AC-07.7)').toBe(true)
    expect(await repo.versionIsPinned(quiet.ids[0]!, 1), 'a withdrawn paper nobody sat').toBe(false)
  })

  it('a sitting frozen BEFORE the pins existed (no `versions` in its composition) still reads the archived version after the edit, not the draft on top', async () => {
    // REQ-B-032 makes a sitting serve the version its paper pinned (recorded in the frozen composition). A sitting frozen earlier has no pins and
    // falls back to "the version that was last live": the newest archived published version (never the draft the edit put on top).
    const { paper, ids } = await publishedPaper()
    const target = ids[0]!
    const start = await pupil.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const attempt = start.body.data.attemptId as string
    await q(`update exam_attempts set composition = (select coalesce(jsonb_agg(s - 'versions'), '[]'::jsonb) from jsonb_array_elements(composition) s) where id = $1`, [attempt])
    expect(String((await q(`select composition::text c from exam_attempts where id = $1`, [attempt]))[0]!.c)).not.toContain('versions')
    expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [target] })).body.data.failed).toEqual([])
    const servedBefore = await served(attempt, target)
    const edit = await admin.put(`/api/questions/${target}`, body({ questionText: 'TEKS BAHARU: berapakah hasil darab 6 dan 7?', options: ['40', '41', '42', '43'], correctAnswer: 2 }))
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    expect(await versions(target)).toEqual(['1:archived', '2:draft'])
    expect(await served(attempt, target), 'a pin-less sitting is served the archived version, not the draft on top').toEqual(servedBefore)
  })

  it('Guru PUT (updateOwn) on their own question: the pinned version stays byte-identical and the pupil is served the same question', async () => {
    // A Guru question reaches a published paper like this: the Guru submits it (saved as `review`, owner = the Guru), Admin Pusat adds the
    // DSKP tag and approves it, the builder places it and Terbit publishes; the owner stays the Guru.
    const made = await guru.post('/api/guru/questions', {
      subjectId: subject,
      educationLevelId: level,
      questionType: 'mcq',
      difficultyLevel: 3,
      questionText: 'Soalan Guru: berapakah hasil tambah 4 dan 5?',
      options: ['8', '9', '10', '11'],
      correctAnswer: 1,
    })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    const own = made.body.data.id as string
    expect(made.body.data.version?.status ?? made.body.data.status).toBe('review')
    const fix = await admin.put(`/api/questions/${own}`, body({ questionText: 'Soalan Guru: berapakah hasil tambah 4 dan 5?', options: ['8', '9', '10', '11'], correctAnswer: 1 }))
    expect(fix.status, JSON.stringify(fix.body)).toBe(200)
    // already `review` (the Guru's submission): only the approval step
    const ok = await admin.post('/api/questions/bulk-action', { action: 'approved', ids: [own] })
    expect(ok.status, JSON.stringify(ok.body)).toBe(200)
    expect(ok.body.data.failed, JSON.stringify(ok.body.data)).toEqual([])
    expect((await q(`select created_by_id::text id from questions where id = $1`, [own]))[0]?.id).toBe(guru.userId)
    const { paper } = await publishedPaper(own)

    const start = await pupil.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    const attempt = start.body.data.attemptId as string
    expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [own] })).body.data.failed).toEqual([])
    const status = await versions(own)
    expect(status.at(-1)).toMatch(/:archived$/)
    const pinned = Number((await q(`select pinned_version_no from paper_placements where question_id = $1`, [own]))[0]!.pinned_version_no)

    const rowBefore = await snapshot(own, pinned)
    const servedBefore = await served(attempt, own)

    const edit = await guru.put(`/api/guru/questions/${own}`, { questionText: 'TEKS BAHARU GURU: berapakah hasil darab 6 dan 7?', options: [{ id: 0, optionText: '40' }, { id: 1, optionText: '41' }, { id: 2, optionText: '42' }, { id: 3, optionText: '43' }], correctOptionId: 2 })
    expect([200, 409], `edit answered ${String(edit.status)}: ${JSON.stringify(edit.body)}`).toContain(edit.status)

    expect.soft(await snapshot(own, pinned), 'the pinned version (stem, parts, options, key) must be byte-identical after the Guru edit').toEqual(rowBefore)
    expect.soft(await served(attempt, own), 'the pupil must be served the same question after the Guru edit').toEqual(servedBefore)
    if (edit.status === 200) expect((await versions(own)).length, 'a 200 must mean a NEW version, not a rewrite of the pinned version').toBeGreaterThan(status.length)
    else expect(await versions(own)).toEqual(status)
  })
})
