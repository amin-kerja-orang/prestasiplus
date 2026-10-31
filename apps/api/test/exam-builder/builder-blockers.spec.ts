import { BIJAK_BUILDER_BLOCKER_OVERRIDABLE, BijakBuilderReviewSchema, BijakBuilderPublishResultSchema, type BijakBuilderBlocker } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { NOT_SERVING, serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { ACCOUNTS, auditRows } from './helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * R1-T34 follow-up: the structured Terbit blockers (`blockerDetails`, `canOverride`) of the review and of the publish refusal. One rule decides
 * `overridable`; the review and the publish must agree. Real BE-09 bank and ServabilityService; HTTP only except where a legacy defect is made on purpose.
 */
describe('R1-T34 structured blockers: review and publish agree', () => {
  let t: FullApp
  let admin: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)

  async function mk(over: Record<string, unknown> = {}): Promise<string> {
    const res = await admin.post('/api/questions', {
      subjectId: subject,
      educationLevelId: level,
      difficultyLevel: 3,
      questionType: 'mcq',
      questionText: 'Berapakah hasil tambah 2 dan 3?',
      options: ['4', '5', '6', '7'],
      correctAnswer: 1,
      kertas: '2',
      tag,
      ...over,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  async function approve(ids: string[]): Promise<void> {
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
    }
  }
  const approved = async (over: Record<string, unknown> = {}): Promise<string> => {
    const id = await mk(over)
    await approve([id])
    return id
  }
  const setPool = (id: string, pools: string[]) => admin.put(`/api/admin/section-pools/${id}`, { pools })
  const newPaper = async (): Promise<string> => {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const sectionsOf = async (id: string): Promise<string[]> => ((await admin.get(`/api/admin/papers/${id}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
  const place = (paper: string, sectionId: string, questionId: string) => admin.post(`/api/admin/papers/${paper}/placements`, { sectionId, questionId })
  /** A full MAT kertas 2 paper: A 3 questions, B 1, C 2 (as the PoC blueprint); every question is tagged with its section pool. */
  async function fullPaper(opts: { tagged?: boolean; last?: string } = {}): Promise<{ paper: string; ids: string[]; sections: string[] }> {
    const ids = [await approved(), await approved(), await approved(), await approved(), await approved({ pointsValue: 2 }), opts.last ?? (await approved({ pointsValue: 2 }))]
    if (opts.tagged !== false) {
      for (const [i, id] of ids.entries()) expect((await setPool(id, [i < 3 ? 'MAT2-A' : i === 3 ? 'MAT2-B' : 'MAT2-C'])).status).toBe(200)
    }
    const paper = await newPaper()
    const sections = await sectionsOf(paper)
    const at = [0, 0, 0, 1, 2, 2]
    for (const [i, id] of ids.entries()) expect((await place(paper, sections[at[i]!]!, id)).status).toBe(201)
    return { paper, ids, sections }
  }

  beforeAll(async () => {
    t = await bootFullApp()
    await serveSeededBlueprints(t.db)
    admin = await loginFull(t, ACCOUNTS.admin)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
  })
  afterAll(async () => {
    await t.close()
  })

  type Detail = { code: string; message: string; overridable: boolean; section?: string; questionId?: string }
  const reviewOf = async (paper: string) => (await admin.get(`/api/admin/papers/${paper}/review`)).body.data as { ok: boolean; blockers: string[]; blockerDetails: Detail[]; canOverride: boolean }
  const publishOf = async (paper: string, body?: Record<string, unknown>) => {
    const res = await admin.post(`/api/admin/papers/${paper}/publish`, body)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return res.body.data as { ok: boolean; errors: string[]; blockerDetails: Detail[]; canOverride: boolean; overridden?: string[] }
  }
  /** The review and the publish refusal carry the same lines, the same structured list and the same verdict. */
  async function expectAgree(paper: string) {
    const review = await reviewOf(paper)
    const pub = await publishOf(paper)
    expect(pub.ok).toBe(false)
    expect(pub.errors).toEqual(review.blockers)
    expect(pub.blockerDetails).toEqual(review.blockerDetails)
    expect(pub.canOverride).toBe(review.canOverride)
    expect(review.blockerDetails.map((b) => b.message)).toEqual(review.blockers)
    expect(BijakBuilderReviewSchema.safeParse({ ...review, paperId: paper, status: 'draf', notes: [], blueprintNeedsReview: false, visibleToStudents: false, totalMarks: 0, totalBudget: 0, rows: [] }).success).toBe(true)
    for (const b of review.blockerDetails) expect(b.overridable, b.code).toBe(BIJAK_BUILDER_BLOCKER_OVERRIDABLE[b.code as keyof typeof BIJAK_BUILDER_BLOCKER_OVERRIDABLE])
    return review
  }

  it('a paper without blockers: empty list, canOverride false; Terbit answers a plain ok result', async () => {
    const { paper } = await fullPaper()
    const review = await reviewOf(paper)
    expect(review).toMatchObject({ ok: true, blockers: [], blockerDetails: [], canOverride: false })
    const pub = await publishOf(paper)
    expect(pub).toMatchObject({ ok: true, errors: [] })
    expect(BijakBuilderPublishResultSchema.safeParse(pub).success).toBe(true)
  })

  it('a structural blueprint blocker (INELIGIBLE, a legacy question without a DSKP unit) is overridable and names the question', async () => {
    const { paper, ids } = await fullPaper()
    await q(`update question_versions set unit_node_id = null where question_id = $1`, [ids[0]])
    const review = await expectAgree(paper)
    expect(review.canOverride).toBe(true)
    expect(review.blockerDetails).toEqual([{ code: 'INELIGIBLE', message: expect.stringContaining(`Soalan ${ids[0]} tidak layak`), overridable: true, section: 'Bahagian A', questionId: ids[0] }])
    const ok = await publishOf(paper, { override: true, reason: 'Soalan lama menunggu tag DSKP' })
    expect(ok).toMatchObject({ ok: true, errors: [] })
    expect(ok.overridden).toHaveLength(1)
  })

  it('an extra question is a hard COUNT_TOO_MANY with its section; the override cannot lift it', async () => {
    const { paper, sections } = await fullPaper()
    expect((await place(paper, sections[0]!, await approved())).status).toBe(201)
    const review = await expectAgree(paper)
    expect(review.canOverride).toBe(false)
    expect(review.blockerDetails).toEqual([
      { code: 'COUNT_TOO_MANY', message: 'Bahagian A: Lebih 1 soalan (perlu 3, ada 4)', overridable: false, section: 'Bahagian A' },
      { code: 'MARKS_MISMATCH', message: 'Bahagian A: Markah 4 tidak sama dengan bajet 3', overridable: false, section: 'Bahagian A' },
    ])
    const forced = await publishOf(paper, { override: true, reason: 'sebab yang sah' })
    expect(forced).toMatchObject({ ok: false, canOverride: false })
    expect(forced.overridden).toBeUndefined()
  })

  it('a missing-from-pool question (UNKNOWN_QUESTION) is hard even next to an overridable blocker', async () => {
    const { paper, ids } = await fullPaper()
    await q(`update question_versions set unit_node_id = null where question_id = $1`, [ids[0]])
    expect((await admin.post('/api/questions/bulk-action', { action: 'archived', ids: [ids[1]] })).status).toBe(200)
    const review = await expectAgree(paper)
    expect(review.canOverride).toBe(false)
    const missing = review.blockerDetails.find((b) => b.code === 'UNKNOWN_QUESTION')
    expect(missing).toMatchObject({ overridable: false, questionId: ids[1], section: 'Bahagian A' })
    expect(review.blockerDetails.find((b) => b.code === 'INELIGIBLE')).toMatchObject({ overridable: true, questionId: ids[0] })
    const forced = await publishOf(paper, { override: true, reason: 'sebab yang sah' })
    expect(forced).toMatchObject({ ok: false, canOverride: false })
    expect(forced.blockerDetails).toEqual(review.blockerDetails)
  })

  it('R1E2E-06: a question pupils cannot be served is a hard NOT_SERVABLE with its id', async () => {
    const res = await admin.post('/api/questions', {
      subjectId: subject,
      educationLevelId: level,
      difficultyLevel: 3,
      questionType: 'essay',
      questionText: 'Terangkan cara mengira luas segi empat tepat.',
      kertas: '2',
      tag,
      parts: [{ label: 'a', mode: 'working', prompt: { ms: 'Kira luas segi empat tepat itu.' }, marks: 2, reveal: 'never', key: { kind: 'points', marks: 2, points: [{ id: 'p1', code: 'M', label: 'Darabkan', marks: 2, text: { ms: 'panjang darab lebar' } }] } }],
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const bad = res.body.data.id as string
    await approve([bad])
    expect((await setPool(bad, ['MAT2-C'])).status).toBe(200)
    const { paper } = await fullPaper({ last: bad })
    const review = await expectAgree(paper)
    expect(review.canOverride).toBe(false)
    expect(review.blockerDetails).toEqual([{ code: 'NOT_SERVABLE', message: expect.stringContaining(`Soalan ${bad} tidak dapat dihidangkan kepada murid`), overridable: false, questionId: bad }])
  })

  it('D93: a one-member group is a hard GROUP_MIN_MEMBERS (paper-wide, exact line)', async () => {
    const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan satu', body: { ms: 'Petikan ujian dengan satu soalan.' } })
    expect(stim.status, JSON.stringify(stim.body)).toBe(201)
    const lone = await approved()
    const other = await approved()
    const group = await admin.post('/api/stimulus-groups', { label: 'Petikan satu', stimulusIds: [stim.body.data.id], questionIds: [lone, other] })
    expect(group.status, JSON.stringify(group.body)).toBe(201)
    await q(`update questions set group_id = null, group_position = null where id = $1`, [other])
    const paper = await newPaper()
    const sections = await sectionsOf(paper)
    expect((await place(paper, sections[0]!, lone)).status).toBe(201)
    const review = await expectAgree(paper)
    expect(review.canOverride).toBe(false)
    expect(review.blockerDetails).toContainEqual({ code: 'GROUP_MIN_MEMBERS', message: 'Kumpulan perlu sekurang-kurangnya 2 soalan.', overridable: false })
    expect(review.blockerDetails.some((b) => b.overridable)).toBe(false)
  })

  describe('R1E2E-07: the Kontrak is not Disahkan', () => {
    it('as the only blocker it is overridable and canOverride is true; next to a hard blocker canOverride is false but its row stays overridable', async () => {
      await q(`update blueprints set ${NOT_SERVING} where status = 'active' and kertas = 2 and subject_id = $1`, [subject])
      const { paper, sections } = await fullPaper()
      const sole = await expectAgree(paper)
      expect(sole.canOverride).toBe(true)
      expect(sole.blockerDetails).toEqual([{ code: 'BLUEPRINT_NOT_VERIFIED', message: expect.stringMatching(/^Kontrak Simulasi 1449\/2 .*belum Disahkan \(status: Spec\)/), overridable: true }])

      const extra = await approved()
      expect((await place(paper, sections[0]!, extra)).status).toBe(201)
      const mixed = await expectAgree(paper)
      expect(mixed.canOverride).toBe(false)
      expect(mixed.blockerDetails.map((b) => [b.code, b.overridable])).toEqual([
        ['COUNT_TOO_MANY', false],
        ['MARKS_MISMATCH', false],
        ['BLUEPRINT_NOT_VERIFIED', true],
      ])
      const forced = await publishOf(paper, { override: true, reason: 'sebab yang sah' })
      expect(forced).toMatchObject({ ok: false, canOverride: false })
      expect((await q(`select status from papers where id = $1`, [paper]))[0]?.status).toBe('draft')

      expect((await admin.del(`/api/admin/papers/${paper}/placements/${extra}`)).status).toBe(200)
      expect((await reviewOf(paper)).canOverride).toBe(true)
      const done = await publishOf(paper, { override: true, reason: 'Kontrak sedang menunggu pengesahan' })
      expect(done).toMatchObject({ ok: true, errors: [] })
      expect(done.overridden).toHaveLength(1)
      expect((await auditRows(t.db, 'bijak.paper.published_override')).filter((r) => r.target_id === paper)).toHaveLength(1)
      // a repeated Terbit of the (overridden) paper stays ok
      expect(await publishOf(paper)).toMatchObject({ ok: true, errors: [] })
    })
  })

  it('every code of the contract has an overridable flag; only the three blueprint codes are overridable', () => {
    const overridable = Object.entries(BIJAK_BUILDER_BLOCKER_OVERRIDABLE).filter(([, v]) => v).map(([k]) => k).sort()
    expect(overridable).toEqual(['BLUEPRINT_NOT_VERIFIED', 'GROUP_BROKEN', 'INELIGIBLE'])
    const sample: BijakBuilderBlocker = { code: 'NOT_SERVABLE', message: 'x', overridable: false }
    expect(sample.overridable).toBe(false)
  })
})
