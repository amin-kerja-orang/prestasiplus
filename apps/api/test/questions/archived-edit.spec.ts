import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { ACCOUNTS } from '../exam-builder/helpers'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { serveSeededBlueprints } from '../support/serve-blueprints'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 300_000 })

/**
 * REQ-B-052 (B3 E05B-L2, MEDIUM) - SPEC-FIRST REPRO, RED TODAY. An `archived` version that is still pinned on a published paper must not be
 * rewritten: `QuestionsService.applyUpdate` adds a version only when the latest version is `approved`, otherwise `rewriteVersion` replaces the
 * stem, parts, options, key and stimulus links IN PLACE; `statusAfterEdit('archived')` stays archived and there is no status or pin guard on
 * `update` (admin) or `updateOwn` (Guru). The paper is Terbit and its pupils are served the pinned version, so an edit changes what they sit and
 * the marking key. Done = the edit is refused (409, BM) OR it branches to a new version, and the pinned version row stays byte-identical.
 *
 * The spec accepts either fix: it checks the outcome (the stored pinned version and what the pupil is served do not change, and a 200 means a
 * NEW version), not one status code.
 */
describe('REQ-B-052: an archived question pinned on a published paper cannot be rewritten in place', () => {
  let t: FullApp
  let admin: FullClient
  let guru: FullClient
  let pupil: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }

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
