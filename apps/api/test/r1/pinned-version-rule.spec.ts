import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { StimuliRepository } from '../../src/modules/questions/stimuli.repository'
import { ACCOUNTS } from '../exam-builder/helpers'
import { makePng } from '../files/fixtures'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from './full-app'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * REQ-B-032 (B3 NEW-1): a published paper serves its PINNED version (`paper_placements.pinned_version_no`), as Kuiz does, and the three places
 * that decide what a pupil may see agree on it: (1) the attempt payload and its grading, (2) the `question_image` read rule (rule B), (3) the
 * served lock of the stimuli. The scenario of the finding: a question on a published paper gets a new approved version (the old live version
 * becomes archived "superseded"), and is then deactivated by a report. Images and stimuli that exist only on the new live version must not be
 * the ones a sitting pupil is served (they used to be, and then 404ed), and those of the pinned version must stay readable and locked.
 */
describe('REQ-B-032 a published paper serves its pinned version', () => {
  let t: FullApp
  let admin: FullClient
  let pupil: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)

  async function upload(): Promise<{ id: string; url: string }> {
    // a distinct file per call: the stored bytes differ by size
    const res = await admin.upload('/api/files?purpose=question_image', makePng({ width: 4 + counter++, height: 4 }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return { id: res.body.data.id as string, url: res.body.data.url as string }
  }
  let counter = 0

  const body = (text: string, imageId: string, correct: number, extra: Record<string, unknown> = {}) => ({
    subjectId: subject,
    educationLevelId: level,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: text,
    options: ['3', '4', '5', '6'],
    correctAnswer: correct,
    explanation: 'Penjelasan ujian.',
    cognitiveLevel: 'mengaplikasi',
    kertas: '2',
    tag,
    questionImageFileId: imageId,
    ...extra,
  })
  async function advance(ids: string[]): Promise<void> {
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data, `${action}: ${JSON.stringify(res.body.data)}`).toMatchObject({ affected: ids.length, failed: [] })
    }
  }
  const stimulusOfVersion = async (questionId: string, versionNo: number): Promise<string> =>
    one(`select vs.stimulus_id::text id from question_version_stimuli vs join question_versions v on v.id = vs.question_version_id where v.question_id = ${questionId} and v.version_no = ${String(versionNo)}`)

  // scenario state
  let target = ''
  let paper = ''
  let attempt = ''
  let v1 = { text: '', image: { id: '', url: '' } }
  let v2 = { text: '', image: { id: '', url: '' } }

  beforeAll(async () => {
    t = await bootFullApp()
    await serveSeededBlueprints(t.db)
    admin = await loginFull(t, ACCOUNTS.admin)
    pupil = await loginFull(t, ACCOUNTS.student)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }

    // MAT kertas 2 (seed): A 3 x 1, B 1 x 1, C choose 1 of 2 (2 marks each). The first question of A is the target, version 1: correct answer B.
    v1 = { text: 'Versi satu: berapakah 2 + 3?', image: await upload() }
    const first = await admin.post('/api/questions', body(v1.text, v1.image.id, 1))
    expect(first.status, JSON.stringify(first.body)).toBe(201)
    target = first.body.data.id as string
    const rest: string[] = []
    for (const [i, extra] of [{}, {}, {}, { pointsValue: 2 }, { pointsValue: 2 }].entries()) {
      const img = await upload()
      const r = await admin.post('/api/questions', body(`Soalan lain ${String(i)}: berapakah ${String(i)} + 1?`, img.id, 1, extra))
      expect(r.status, JSON.stringify(r.body)).toBe(201)
      rest.push(r.body.data.id as string)
    }
    const ids = [target, ...rest]
    await advance(ids)
    for (const [i, id] of ids.entries()) expect((await admin.put(`/api/admin/section-pools/${id}`, { pools: [i < 3 ? 'MAT2-A' : i === 3 ? 'MAT2-B' : 'MAT2-C'] })).status).toBe(200)
    const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    paper = created.body.data.id as string
    const sections = ((await admin.get(`/api/admin/papers/${paper}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
    const at = [0, 0, 0, 1, 2, 2]
    for (const [i, id] of ids.entries()) {
      const placed = await admin.post(`/api/admin/papers/${paper}/placements`, { sectionId: sections[at[i]!], questionId: id })
      expect(placed.status, JSON.stringify(placed.body)).toBe(201)
    }
    const published = await admin.post(`/api/admin/papers/${paper}/publish`)
    expect(published.body.data, JSON.stringify(published.body)).toMatchObject({ ok: true, errors: [] })
  })
  afterAll(async () => {
    await t.close()
  })

  /** The stem text and the stem image URL of the target question in the attempt payload. */
  async function served(): Promise<{ stem: string; urls: string[] }> {
    const res = await pupil.get(`/api/bijak/attempts/${attempt}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const view = res.body.data as { questions: { id: string }[] }
    expect(view.questions[0]!.id).toBe(target)
    const json = JSON.stringify(res.body)
    const urls = [...json.matchAll(/\/api\/files\/[A-Za-z0-9_-]+/g)].map((m) => m[0])
    const stem = json.includes(v1.text) ? v1.text : json.includes(v2.text) ? v2.text : ''
    return { stem, urls }
  }

  it('starts a sitting: version 1 is served and pinned', async () => {
    const start = await pupil.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })
    expect(start.status, JSON.stringify(start.body)).toBe(201)
    attempt = start.body.data.attemptId as string
    v2 = { text: 'Versi dua: berapakah 7 + 8?', image: { id: '', url: '' } }
    const s = await served()
    expect(s.stem).toBe(v1.text)
    expect(s.urls).toContain(v1.image.url)
    expect((await q(`select pinned_version_no v from paper_placements where question_id = ${target} and paper_section_id in (select id from paper_sections where paper_id = ${paper})`))[0]?.v).toBe(1)
    expect((await pupil.get(v1.image.url)).status).toBe(200)
  })

  it('a new version is approved (version 1 is superseded): the sitting keeps version 1, and so does its grading', async () => {
    v2.image = await upload()
    const edit = await admin.put(`/api/questions/${target}`, body(v2.text, v2.image.id, 2))
    expect(edit.status, JSON.stringify(edit.body)).toBe(200)
    await advance([target])
    const rows = await q(`select v.version_no n, v.status, v.archive_reason from question_versions v where v.question_id = ${target} order by v.version_no`)
    expect(rows.map((r) => [r.n, r.status])).toEqual([[1, 'archived'], [2, 'approved']])
    expect(rows[0]!.archive_reason).toBe('superseded')
    expect((await q(`select live_version_no n from questions where id = ${target}`))[0]?.n).toBe(2)

    const s = await served()
    expect(s.stem, 'the sitting is served version 1').toBe(v1.text)
    expect(s.urls).toContain(v1.image.url)
    expect(s.urls).not.toContain(v2.image.url)
    // the key of version 1 is B (correct 1): answering B is right although the live key is C
    const view = (await pupil.get(`/api/bijak/attempts/${attempt}`)).body.data as { questions: { id: string; mcq?: unknown }[] }
    const changes = view.questions.map((x) => ({ partId: x.id, answer: { choice: 'B' }, rev: 1, savedAt: '2026-10-19T09:00:00+08:00' }))
    expect((await pupil.put(`/api/bijak/attempts/${attempt}/answers`, { changes })).status).toBe(200)
  })

  it('a report deactivates the question: image rule B grants the pinned version images and not the unpinned live ones; the served lock holds on the pinned version', async () => {
    await q(`update questions set is_active = false where id = ${target}`)
    // (1) the sitting still gets version 1
    const s = await served()
    expect(s.stem).toBe(v1.text)
    expect(s.urls).toContain(v1.image.url)
    // (2) the pupil reads the pinned image (rule B, active or not) and not the one that exists only on the new live version
    expect((await pupil.get(v1.image.url)).status).toBe(200)
    expect((await pupil.get(v2.image.url)).status).toBe(404)
    expect((await admin.get(v2.image.url)).status).toBe(200)
    // (3) the served lock covers the pinned version's own stimulus and not the unpinned one
    const repo = t.app.get(StimuliRepository, { strict: false })
    expect(await repo.stimulusServed(await stimulusOfVersion(target, 1))).toBe(true)
    expect(await repo.stimulusServed(await stimulusOfVersion(target, 2))).toBe(false)
    // the list flag follows the lock
    const list = await admin.get('/api/stimuli?status=served&pageSize=100')
    expect(list.status, JSON.stringify(list.body)).toBe(200)
    const servedIds = (list.body.data as { id: string }[]).map((x) => x.id)
    expect(servedIds).toContain(await stimulusOfVersion(target, 1))
    expect(servedIds).not.toContain(await stimulusOfVersion(target, 2))
  })

  it('the sitting submits and is graded on version 1 (answer B is correct)', async () => {
    const sub = await pupil.post(`/api/bijak/attempts/${attempt}/submit`, { idempotencyKey: 'reqb032-1', changes: [] })
    expect(sub.status, JSON.stringify(sub.body)).toBe(200)
    const result = (await pupil.get(`/api/bijak/attempts/${attempt}/result`)).body.data.result as { questions: { questionId: string; awarded: number; marks: number }[] }
    const row = result.questions.find((x) => x.questionId === target)!
    expect(row).toMatchObject({ awarded: 1, marks: 1 })
  })
})
