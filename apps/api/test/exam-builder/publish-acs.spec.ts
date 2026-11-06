import { BIJAK_BUILDER_BLOCKER_OVERRIDABLE as OVERRIDABLE, BIJAK_BUILDER_MESSAGES as MSG_ALL, BIJAK_BUILDER_CHECK_LINES as LINES, BIJAK_BUILDER_PLACEMENT_LINES as PLACE } from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { bootFullApp, loginFull, type FullApp, type FullClient } from '../r1/full-app'
import { giveBab } from '../support/bab'
import { NOT_SERVING, SERVING, serveSeededBlueprints } from '../support/serve-blueprints'
import { ACCOUNTS, auditRows } from './helpers'

vi.setConfig({ testTimeout: 120_000, hookTimeout: 300_000 })

/**
 * R1 T43b: the publish acceptance criteria of the Pipeline requirements (PIPE AC-07.4 to AC-07.9) as named cases on the real application
 * (every feature module, real question bank, real servability), HTTP only except where a data defect is made on purpose (SQL).
 * The structured refusal (`blockerDetails`) is asserted by code, so the specs follow the contract and not only the BM wording.
 */
interface Blocker {
  code: string
  message: string
  overridable: boolean
  section?: string
  questionId?: string
}
interface PublishData {
  ok: boolean
  errors: string[]
  blockerDetails?: Blocker[]
  canOverride?: boolean
  overridden?: string[]
}

describe('R1 T43b publish ACs (PIPE AC-07.4 to AC-07.9)', () => {
  let t: FullApp
  let admin: FullClient
  let student: FullClient
  let subject: string
  let sci: string
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
      cognitiveLevel: 'mengaplikasi', // T33 gate: approving an SPM-bound question needs a level per leaf
      kertas: '2',
      tag,
      ...over,
    })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  async function approve(ids: string[]): Promise<void> {
    await giveBab(t.db, ids) // REQ-B-071: no Bab rule at Semakan any more; kept so the fixtures keep a chapter (harmless)
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.body.data, `${action}: ${JSON.stringify(res.body.data)}`).toMatchObject({ failed: [] })
    }
  }
  const approved = async (over: Record<string, unknown> = {}): Promise<string> => {
    const id = await mk(over)
    await approve([id])
    return id
  }
  const newPaper = async (): Promise<string> => {
    const res = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const sectionsOf = async (id: string): Promise<string[]> => ((await admin.get(`/api/admin/papers/${id}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
  const place = (paper: string, sectionId: string, questionId: string) => admin.post(`/api/admin/papers/${paper}/placements`, { sectionId, questionId })
  const publish = async (paper: string, body?: unknown): Promise<PublishData> => {
    const res = await admin.post(`/api/admin/papers/${paper}/publish`, body)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return res.body.data as PublishData
  }
  const status = async (paper: string) => (await q(`select status from papers where id = $1`, [paper]))[0]?.status
  const notServing = () => q(`update blueprints set ${NOT_SERVING} where status = 'active' and kertas = 2 and subject_id = $1`, [subject])
  const serving = () => q(`update blueprints set ${SERVING} where status = 'active' and kertas = 2 and subject_id = $1`, [subject])
  const codes = (r: PublishData) => (r.blockerDetails ?? []).map((b) => b.code)

  /** A full MAT kertas 2 paper: A 3 x 1 mark, B 1 x 1, C choose 1 of 2 (2 marks each), every question tagged with its section pool. */
  async function fullPaper(): Promise<{ paper: string; ids: string[]; sections: string[] }> {
    const ids = [await approved(), await approved(), await approved(), await approved(), await approved({ pointsValue: 2 }), await approved({ pointsValue: 2 })]
    for (const [i, id] of ids.entries()) expect((await admin.put(`/api/admin/section-pools/${id}`, { pools: [i < 3 ? 'MAT2-A' : i === 3 ? 'MAT2-B' : 'MAT2-C'] })).status).toBe(200)
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
    student = await loginFull(t, ACCOUNTS.student)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    sci = await one(`select id::text id from subjects where code = 'SCI'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
  })
  afterEach(async () => {
    await serving()
  })
  afterAll(async () => {
    await t.close()
  })

  describe('AC-07.4 the publish checks list every violation', () => {
    it('at least one question: an empty paper is refused with "Kertas ini tiada soalan" first and the section gaps after it; nothing can override it', async () => {
      const paper = await newPaper()
      const res = await publish(paper)
      expect(res.ok).toBe(false)
      expect(res.errors[0]).toBe(LINES.noQuestions)
      expect(LINES.noQuestions).toBe('Kertas ini tiada soalan — tidak boleh diterbitkan.')
      expect(codes(res)).toEqual(['NO_QUESTIONS', 'COUNT_TOO_FEW', 'MARKS_MISMATCH', 'COUNT_TOO_FEW', 'MARKS_MISMATCH', 'COUNT_TOO_FEW', 'MARKS_MISMATCH'])
      expect(res.blockerDetails!.every((b) => b.overridable === false)).toBe(true)
      expect(res.canOverride).toBe(false)
      expect(await status(paper)).toBe('draft')
      // the audited override never lifts it
      const forced = await publish(paper, { override: true, reason: 'cuba paksa menerbitkan' })
      expect(forced.ok).toBe(false)
      expect(forced.overridden).toBeUndefined()
    })

    // REQ-B-068: T43b's paper checks and REQ-A-013's reference-picture blocker are separate hard blockers; both show, once each, in the code order of collectBlockers.
    it('an empty paper whose reference sheet holds a picture that is not a stored image lists NO_QUESTIONS and ONE REFERENCE_IMAGE_INVALID; neither is doubled and neither can be overridden', async () => {
      const paper = await newPaper()
      const panel = (title: string) => ({ title, items: [], imageFileId: 'bukan-fail-sebenar' })
      await q(`update papers set reference_sheets = $2::jsonb where id = $1`, [paper, JSON.stringify([panel('Rajah 1'), panel('Rajah 2')])])
      const res = await publish(paper)
      expect(res.ok).toBe(false)
      const got = codes(res)
      expect(got.filter((c) => c === 'NO_QUESTIONS')).toHaveLength(1)
      expect(got.filter((c) => c === 'REFERENCE_IMAGE_INVALID')).toHaveLength(1)
      expect(res.blockerDetails!.filter((b) => b.code === 'NO_QUESTIONS' || b.code === 'REFERENCE_IMAGE_INVALID').every((b) => b.overridable === false)).toBe(true)
      expect(res.errors.filter((e) => e === MSG_ALL.referenceImageInvalid)).toHaveLength(1)
      expect(res.canOverride).toBe(false)
      expect(await status(paper)).toBe('draft')
    })

    it('choose-N count: a "Pilih N daripada M" section with fewer questions than it needs is COUNT_TOO_FEW (hard), and a Kontrak with N above M is refused on save', async () => {
      const { paper, ids, sections } = await fullPaper()
      expect((await admin.del(`/api/admin/papers/${paper}/placements/${ids[5]}`)).status).toBe(200)
      const res = await publish(paper)
      expect(res.ok).toBe(false)
      const few = res.blockerDetails!.filter((b) => b.code === 'COUNT_TOO_FEW')
      expect(few).toEqual([expect.objectContaining({ section: 'Bahagian C', overridable: false, message: `Bahagian C: ${LINES.tooFew(2, 1)}` })])
      expect(res.canOverride).toBe(false)
      expect(sections).toHaveLength(3)
      // the Kontrak itself cannot ask for more answers than the section holds
      const head = (await admin.get('/api/admin/blueprints/MAT/2')).body.data as { code: string; durationMin: number; sections: { label: string; markBudget: number; questionCount: number }[] }
      const bad = await admin.post('/api/admin/blueprints/MAT/2/versions', {
        source: 'Spec',
        code: head.code,
        durationMin: head.durationMin,
        sections: head.sections.map((s, i) => ({ label: s.label, markBudget: s.markBudget, questionCount: s.questionCount, rule: i === 2 ? { type: 'choose', n: s.questionCount + 1 } : { type: 'all' } })),
      })
      expect(bad.status, JSON.stringify(bad.body)).toBe(422)
      expect(Object.keys(bad.body.error.fields as Record<string, string>)).toContain('sections.2.rule.n')
    })

    it('full question validation: a question that fails the Kontrak (no DSKP unit) is INELIGIBLE with its id; one archived after placement is NOT_PUBLISHED (hard)', async () => {
      const { paper, ids } = await fullPaper()
      await q(`update question_versions set unit_node_id = null where question_id = $1`, [ids[0]])
      let res = await publish(paper)
      expect(res.ok).toBe(false)
      // S3-T01: the Kontrak is Disahkan here, so INELIGIBLE is hard.
      expect(res.blockerDetails).toContainEqual(expect.objectContaining({ code: 'INELIGIBLE', questionId: ids[0], overridable: false }))
      expect(res.canOverride).toBe(false)
      await q(`update questions set is_active = false where id = $1`, [ids[1]])
      res = await publish(paper)
      expect(codes(res)).toEqual(expect.arrayContaining(['NOT_PUBLISHED']))
      expect(res.blockerDetails!.find((b) => b.code === 'NOT_PUBLISHED')).toMatchObject({ overridable: false })
      expect(res.canOverride).toBe(false)
      expect(await status(paper)).toBe('draft')
    })

    it('no zero-mark section with questions: a question without marks gives ZERO_MARK_SECTION, MARKS_MISMATCH and NO_MARKS (all hard) and the paper stays draft', async () => {
      const { paper, ids } = await fullPaper()
      await q(`update question_parts set marks = 0 where question_version_id in (select id from question_versions where question_id = $1)`, [ids[3]])
      const res = await publish(paper)
      expect(res.ok).toBe(false)
      expect(res.blockerDetails!.filter((b) => b.section === 'Bahagian B' && b.overridable === false).map((b) => b.code).sort()).toEqual(['MARKS_MISMATCH', 'NO_MARKS', 'ZERO_MARK_SECTION'])
      expect(res.canOverride).toBe(false)
      expect(await status(paper)).toBe('draft')
    })

    it('total at least 1: a Kontrak that budgets 0 marks cannot publish a paper of zero-mark questions, with or without the override', async () => {
      const made = await admin.post('/api/admin/blueprints', { subject: 'MAT', kertas: 3, source: 'Spec', code: 'MAT/Z', durationMin: 30, sections: [{ label: 'Bahagian A', markBudget: 0, questionCount: 1, rule: { type: 'all' } }] })
      expect(made.status, JSON.stringify(made.body)).toBe(201)
      await q(`insert into blueprint_verifications (blueprint_id, verified_by_id, verifier_role, structure_hash, check_result, evidence_snapshot)
        select b.id, (select min(id) from users), 'admin', b.structure_hash, '{}'::jsonb, '[]'::jsonb from blueprints b where b.code = 'MAT/Z'`)
      await q(`update blueprints b set source = 'verified', serves_students = true, verification_id = (select max(v.id) from blueprint_verifications v where v.blueprint_id = b.id) where b.code = 'MAT/Z'`)
      const id = await approved({ kertas: '3' })
      const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 3 })
      expect(created.status, JSON.stringify(created.body)).toBe(201)
      const paper = created.body.data.id as string
      expect((await place(paper, (await sectionsOf(paper))[0]!, id)).status).toBe(201)
      await q(`update question_parts set marks = 0 where question_version_id in (select id from question_versions where question_id = $1)`, [id])
      const res = await publish(paper)
      expect(res.ok).toBe(false)
      expect(res.blockerDetails).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'TOTAL_MARKS_BELOW_ONE', message: LINES.totalMarksBelowOne, overridable: false }),
          expect.objectContaining({ code: 'ZERO_MARK_SECTION', section: 'Bahagian A', message: `Bahagian A: ${LINES.zeroMarkSection}`, overridable: false }),
          expect.objectContaining({ code: 'NO_MARKS', questionId: id, overridable: false }),
        ]),
      )
      expect(res.canOverride).toBe(false)
      const forced = await publish(paper, { override: true, reason: 'cuba paksa menerbitkan' })
      expect(forced.ok).toBe(false)
      expect(forced.overridden).toBeUndefined()
      expect(await status(paper)).toBe('draft')
    })

    it('ZERO_MARK_SECTION and TOTAL_MARKS_BELOW_ONE fire on their own: a paper with no Kontrak at all is refused, and its (overridable) "Tiada blueprint" line cannot lift them', async () => {
      const paper = await newPaper()
      const [a] = await sectionsOf(paper)
      const id = await approved()
      expect((await place(paper, a!, id)).status).toBe(201)
      await q(`update papers set blueprint_id = null where id = $1`, [paper])
      await q(`update question_parts set marks = 0 where question_version_id in (select id from question_versions where question_id = $1)`, [id])
      const res = await publish(paper)
      expect(res.ok).toBe(false)
      // no Kontrak (REQ-B-079): the only Kontrak line is "Tiada blueprint ...", overridable; the two below come from the paper's own check
      expect(res.blockerDetails).toEqual(expect.arrayContaining([expect.objectContaining({ code: 'BLUEPRINT_NOT_VERIFIED', message: 'Tiada blueprint untuk subjek dan kertas ini', overridable: true })]))
      expect(res.blockerDetails).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ code: 'TOTAL_MARKS_BELOW_ONE', message: LINES.totalMarksBelowOne, overridable: false }),
          expect.objectContaining({ code: 'ZERO_MARK_SECTION', section: 'Bahagian A', message: `Bahagian A: ${LINES.zeroMarkSection}`, overridable: false }),
        ]),
      )
      expect(res.canOverride).toBe(false)
      const forced = await publish(paper, { override: true, reason: 'cuba paksa menerbitkan' })
      expect(forced.ok).toBe(false)
      expect(await status(paper)).toBe('draft')
    })

    it('same subject: a question of another subject cannot be placed (add and PUT), so a published paper has one subject', async () => {
      const paper = await newPaper()
      const [a] = await sectionsOf(paper)
      const sciUnit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${sci} and education_level_id = ${level} order by sort_order, id limit 1`)
      const sciSp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${sci} and education_level_id = ${level} order by sort_order, id limit 1`)
      const other = await approved({ subjectId: sci, tag: { unitId: sciUnit, spIds: [sciSp], tp: 3 } })
      const added = await place(paper, a!, other)
      expect(added.status, JSON.stringify(added.body)).toBe(422)
      expect(added.body.error.message).toContain(PLACE.otherSubject)
      const put = await admin.put(`/api/admin/papers/${paper}`, { sections: [{ id: a, questionIds: [other] }] })
      expect(put.status).toBe(422)
      expect((await q(`select count(*)::int n from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [paper]))[0]?.n).toBe(0)
    })

    it('total at least 1: a conforming paper publishes with marks equal to the budget', async () => {
      const { paper } = await fullPaper()
      const res = await publish(paper)
      expect(res.ok).toBe(true)
      const row = (await admin.get('/api/admin/papers?pageSize=100')).body.data.find((p: { id: string }) => p.id === paper) as { marks: number; budget: number }
      expect(row.marks).toBeGreaterThanOrEqual(1)
      expect(row.marks).toBe(row.budget)
    })

    it('the blueprint gate: a contract that is not Disahkan is BLUEPRINT_NOT_VERIFIED (overridable) and nothing else; the audited override then publishes (AC-07.5)', async () => {
      await notServing()
      const { paper } = await fullPaper()
      const refused = await publish(paper)
      expect(refused.ok).toBe(false)
      expect(codes(refused)).toEqual(['BLUEPRINT_NOT_VERIFIED'])
      expect(refused.blockerDetails![0]).toMatchObject({ overridable: true })
      expect(refused.canOverride).toBe(true)
      expect(OVERRIDABLE.BLUEPRINT_NOT_VERIFIED).toBe(true)
      const ok = await publish(paper, { override: true, reason: 'Kontrak sedang menunggu pengesahan' })
      expect(ok).toMatchObject({ ok: true, errors: [], overridden: [refused.errors[0]] })
      const audit = (await auditRows(t.db, 'bijak.paper.published_override')).filter((r) => r.target_id === paper)
      expect(audit).toHaveLength(1)
      expect(audit[0]!.detail).toMatchObject({ reason: 'Kontrak sedang menunggu pengesahan', count: 1 })
    })

    it('every violation is listed at once and the override never lifts a structural one (AC-07.5): unverified contract + a missing question stays refused', async () => {
      await notServing()
      const paper = await newPaper()
      const [a] = await sectionsOf(paper)
      expect((await place(paper, a!, await approved())).status).toBe(201)
      const res = await publish(paper)
      expect(res.ok).toBe(false)
      expect(codes(res)).toEqual(expect.arrayContaining(['COUNT_TOO_FEW', 'MARKS_MISMATCH', 'BLUEPRINT_NOT_VERIFIED']))
      expect(res.canOverride).toBe(false)
      const forced = await publish(paper, { override: true, reason: 'cuba paksa menerbitkan' })
      expect(forced.ok).toBe(false)
      expect(await status(paper)).toBe('draft')
      expect((await auditRows(t.db, 'bijak.paper.published_override')).filter((r) => r.target_id === paper)).toHaveLength(0)
    })
  })

  describe('AC-07.6 publish sets the paper published; the questions it serves are Approved', () => {
    it('a draft or in-review question cannot be placed, so every question of a Terbit paper is Approved; publish pins their versions and leaves their status alone', async () => {
      const draft = await mk()
      const review = await mk()
      await giveBab(t.db, [review])
      await admin.post('/api/questions/bulk-action', { action: 'review', ids: [review] })
      const empty = await newPaper()
      const [a] = await sectionsOf(empty)
      for (const [id, why] of [[draft, PLACE.statusDraft], [review, PLACE.statusReview]] as const) {
        const res = await place(empty, a!, id)
        expect(res.status, JSON.stringify(res.body)).toBe(422)
        expect(res.body.error.message).toBe(PLACE.notServable(id, why))
      }
      const { paper, ids } = await fullPaper()
      const before = await q(`select v.status, q.live_version_no live from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.id = any($1::bigint[]) order by q.id`, [ids])
      expect(before.every((r) => r.status === 'approved')).toBe(true)
      expect(await publish(paper)).toMatchObject({ ok: true, errors: [] })
      expect(await status(paper)).toBe('published')
      const after = await q(`select v.status, q.live_version_no live from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.id = any($1::bigint[]) order by q.id`, [ids])
      expect(after).toEqual(before)
      const pins = await q(`select pl.pinned_version_no v, pl.marks_override m from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [paper])
      expect(pins).toHaveLength(6)
      expect(pins.every((p) => p.v === 1 && Number(p.m) >= 1)).toBe(true)
      expect((await auditRows(t.db, 'bijak.paper.published')).filter((r) => r.target_id === paper)).toHaveLength(1)
      expect(((await student.get('/api/bijak/papers')).body.data as { id: string }[]).some((p) => p.id === paper)).toBe(true)
    })
  })

  describe('AC-07.7 Tarik balik: the paper returns to draft and past attempts remain', () => {
    it('a submitted attempt and its result, and an in-progress retry, survive a withdraw; the pupil no longer sees the paper nor starts or retries it', async () => {
      const { paper, ids } = await fullPaper()
      expect((await publish(paper)).ok).toBe(true)
      const start = await student.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })
      expect(start.status, JSON.stringify(start.body)).toBe(201)
      const attempt = start.body.data.attemptId as string
      const view = await student.get(`/api/bijak/attempts/${attempt}`)
      const changes = (view.body.data.questions as { id: string }[]).map((qq) => ({ partId: qq.id, answer: { choice: 'B' }, rev: 1, savedAt: '2026-10-19T09:00:00+08:00' }))
      expect((await student.put(`/api/bijak/attempts/${attempt}/answers`, { changes })).status).toBe(200)
      const sub = await student.post(`/api/bijak/attempts/${attempt}/submit`, { idempotencyKey: 'ac077-1', changes: [] })
      expect(sub.status, JSON.stringify(sub.body)).toBe(200)
      const resultBefore = (await student.get(`/api/bijak/attempts/${attempt}/result`)).body.data
      const retry = await student.post(`/api/bijak/attempts/${attempt}/retry`)
      expect(retry.status, JSON.stringify(retry.body)).toBe(201)
      const second = retry.body.data.attemptId as string

      const withdraw = await admin.post(`/api/admin/papers/${paper}/withdraw`)
      expect(withdraw.status, JSON.stringify(withdraw.body)).toBe(200)
      expect(await status(paper)).toBe('withdrawn')

      // the attempts remain, with their answers and result
      expect((await q(`select count(*)::int n from exam_attempts where paper_id = $1`, [paper]))[0]?.n).toBe(2)
      const result = await student.get(`/api/bijak/attempts/${attempt}/result`)
      expect(result.status, JSON.stringify(result.body)).toBe(200)
      expect(result.body.data).toEqual(resultBefore)
      expect((await student.get(`/api/bijak/attempts/${second}`)).status).toBe(200)
      // the questions of the paper are untouched (the bank owns them)
      expect((await q(`select count(*)::int n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.id = any($1::bigint[]) and v.status = 'approved'`, [ids]))[0]?.n).toBe(6)
      // the pupil no longer sees the paper, and cannot start or retry it
      expect(((await student.get('/api/bijak/papers')).body.data as { id: string }[]).some((p) => p.id === paper)).toBe(false)
      expect((await student.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })).status).toBeGreaterThanOrEqual(400)
      expect((await student.post(`/api/bijak/attempts/${attempt}/retry`)).status).toBeGreaterThanOrEqual(400)
      expect((await auditRows(t.db, 'bijak.paper.withdrawn')).filter((r) => r.target_id === paper)).toHaveLength(1)
    })
  })

  describe('AC-07.9 a published paper keeps its pinned snapshot; nothing can be added after Terbit', () => {
    it('a question edited after Terbit does not change what the paper serves; an addition is refused (paperLocked), so no unfrozen question exists; re-publishing after Tarik balik pins again', async () => {
      const { paper, ids, sections } = await fullPaper()
      expect((await publish(paper)).ok).toBe(true)
      const pinned = async () => (await q(`select pl.question_id::text qid, pl.pinned_version_no v, pl.marks_override m from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 order by s.position, pl.position`, [paper]))
      const snapshot = await pinned()
      expect(snapshot.every((r) => r.v === 1)).toBe(true)

      // a changed question: a new version of an approved question (the paper keeps serving version 1)
      const edit = await admin.put(`/api/questions/${ids[0]}`, {
        subjectId: subject,
        educationLevelId: level,
        difficultyLevel: 3,
        questionType: 'mcq',
        questionText: 'Soalan yang telah diubah selepas kertas diterbitkan?',
        options: ['4', '5', '6', '7'],
        correctAnswer: 1,
        kertas: '2',
        tag,
      })
      expect(edit.status, JSON.stringify(edit.body)).toBe(200)
      expect((await q(`select latest_version_no v from questions where id = $1`, [ids[0]]))[0]?.v).toBeGreaterThanOrEqual(2)
      expect(await pinned()).toEqual(snapshot)
      // what the pupil is served is the content of the pinned version, not the edited one
      const sit = async (): Promise<{ attempt: string; ids: string[]; json: string }> => {
        const started = await student.post('/api/bijak/attempts', { paperId: paper, mode: 'exam' })
        expect(started.status, JSON.stringify(started.body)).toBe(201)
        const res = await student.get(`/api/bijak/attempts/${started.body.data.attemptId as string}`)
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        return { attempt: started.body.data.attemptId as string, ids: (res.body.data.questions as { id: string }[]).map((x) => x.id), json: JSON.stringify(res.body.data) }
      }
      const first = await sit()
      expect(first.ids).toEqual(ids)
      expect(first.json).toContain('Berapakah hasil tambah 2 dan 3?')
      expect(first.json).not.toContain('Soalan yang telah diubah selepas kertas diterbitkan?')
      expect((await student.post(`/api/bijak/attempts/${first.attempt}/abandon`)).status).toBe(204)

      // an addition after Terbit is refused: the paper is read-only, so no "added after publish" question can exist
      const extra = await approved({ questionText: 'Soalan tambahan selepas tarik balik: berapakah 9 + 9?' })
      const added = await place(paper, sections[0]!, extra)
      expect(added.status).toBe(422)
      expect(added.body.error.message).toBe(MSG_ALL.paperLocked)
      expect((await q(`select count(*)::int n from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [paper]))[0]?.n).toBe(6)

      // Tarik balik, edit, Terbit again: the version goes up and every placement is pinned again
      expect((await admin.post(`/api/admin/papers/${paper}/withdraw`)).status).toBe(200)
      expect((await admin.del(`/api/admin/papers/${paper}/placements/${ids[5]}`)).status).toBe(200)
      expect((await place(paper, sections[2]!, extra)).status).toBe(201)
      expect((await publish(paper)).ok).toBe(true)
      expect((await q(`select version from papers where id = $1`, [paper]))[0]?.version).toBe(2)
      const again = await q(`select pl.question_id::text qid, pl.pinned_version_no v from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 order by s.position, pl.position`, [paper])
      expect(again.map((r) => [r.qid, r.v])).toEqual([...ids.slice(0, 5), extra].map((id) => [id, 1]))
      // the new sitting is served the re-pinned paper: the added question, no longer the removed one, and still the original content of the edited one
      const second = await sit()
      expect(second.ids).toEqual([...ids.slice(0, 5), extra])
      expect(second.json).toContain('Soalan tambahan selepas tarik balik: berapakah 9 + 9?')
      expect(second.json).not.toContain('Soalan yang telah diubah selepas kertas diterbitkan?')
    })
  })
})
