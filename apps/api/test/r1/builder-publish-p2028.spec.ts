import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { AuditService } from '../../src/common/audit/audit.service'
import { PrismaService } from '../../src/db/prisma.service'
import { ACCOUNTS } from '../exam-builder/helpers'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from './full-app'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 300_000 })

/**
 * R2-prep open minor 12 (publish-lock-share): the Terbit transaction of the paper builder (`BuilderService.publish`) has a time budget
 * (`PUBLISH_TX` = { timeout: 20 s, maxWait: 10 s }, more than Prisma's 5 s default because Terbit waits on the FOR SHARE locks of a concurrent edit
 * or delete) and no test covered it. The P2028 (an expired interactive transaction) is forced the same way as the other P2028 specs
 * (content/articles, content/throttle-gaps, auth/login-under-load): a spy makes a call inside the transaction reject with `{ code: 'P2028' }`.
 *
 * What is pinned:
 *  1. the publish transaction is opened with the PUBLISH_TX budget (and with no other option);
 *  2. a P2028 raised AFTER the pins, the Bahagian figures and the status update were written rolls the whole Terbit back: the paper stays Draf with
 *     no `published_at`, the placements keep their pins and marks, no `bijak.paper.published` audit row exists, and a retry then publishes;
 *  3. the overload is answered 429 RATE_LIMITED with `retryAfter` 5 and the `Retry-After` header (the `isOverloadError` mapping of the other write
 *     paths: content, school-admin, auth, users), not the generic 500 it was before (D9, lead decision).
 *
 * MUTATIONS (restored afterwards): (a) the `PUBLISH_TX` argument removed from the publish transaction -> test 1 red;
 * (b) the publish body run outside any transaction (no rollback) -> test 2 red (the paper is left Terbit);
 * (c) the `isOverloadError` catch removed from `publish` -> test 2 red (500 SERVER_ERROR instead of 429).
 */
describe('R2-prep minor 12: P2028 on the builder publish transaction', () => {
  let t: FullApp
  let admin: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }
  let chapter: string
  let counter = 0
  const restore: (() => void)[] = []

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)

  const body = () => ({
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
  })
  async function approved(over: Record<string, unknown> = {}): Promise<string> {
    const made = await admin.post('/api/questions', { ...body(), ...over })
    expect(made.status, JSON.stringify(made.body)).toBe(201)
    const id = made.body.data.id as string
    for (const action of ['review', 'approved']) {
      const res = await admin.post('/api/questions/bulk-action', { action, ids: [id] })
      expect(res.body.data.failed, `${action}: ${JSON.stringify(res.body.data)}`).toEqual([])
    }
    return id
  }
  /** A full MAT kertas 2 draft paper (A 3 questions, B 1, C 2), ready for the audited Kontrak override. Returns the paper and its question ids. */
  async function draftPaper(): Promise<{ paper: string; ids: string[] }> {
    const ids = [await approved(), await approved(), await approved(), await approved(), await approved({ pointsValue: 2 }), await approved({ pointsValue: 2 })]
    for (const [i, id] of ids.entries()) {
      const res = await admin.put(`/api/admin/section-pools/${id}`, { pools: [i < 3 ? 'MAT2-A' : i === 3 ? 'MAT2-B' : 'MAT2-C'] })
      expect(res.status).toBe(200)
    }
    const created = await admin.post('/api/admin/papers', { subject: 'MAT', kertas: 2 })
    expect(created.status, JSON.stringify(created.body)).toBe(201)
    const paper = created.body.data.id as string
    const sections = ((await admin.get(`/api/admin/papers/${paper}`)).body.data.paper.sections as { id: string }[]).map((s) => s.id)
    const at = [0, 0, 0, 1, 2, 2]
    for (const [i, id] of ids.entries()) {
      const res = await admin.post(`/api/admin/papers/${paper}/placements`, { sectionId: sections[at[i]!], questionId: id })
      expect(res.status, JSON.stringify(res.body)).toBe(201)
    }
    return { paper, ids }
  }
  const publish = (paper: string) => admin.post(`/api/admin/papers/${paper}/publish`, { override: true, reason: 'Kontrak 1449/2 belum disahkan' })
  const paperRow = async (paper: string) => (await q(`select status, published_at, title from papers where id = $1`, [paper]))[0]!
  const placementRows = async (paper: string) =>
    await q(
      `select pl.question_id::text qid, pl.pinned_version_no::int v, pl.marks_override::int m from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1 order by pl.id`,
      [paper],
    )
  const publishedAudit = async (paper: string) =>
    Number((await q(`select count(*)::int n from audit_events where action = 'bijak.paper.published' and target_id = $1`, [paper]))[0]!.n)
  const p2028 = () => Object.assign(new Error('Transaction API error: Transaction already closed: A commit cannot be executed on an expired transaction.'), { code: 'P2028' })

  beforeAll(async () => {
    t = await bootFullApp()
    await serveSeededBlueprints(t.db)
    admin = await loginFull(t, ACCOUNTS.admin)
    subject = await one(`select id::text id from subjects where code = 'MATH'`)
    level = await one(`select id::text id from education_levels where code = 'T4'`)
    const unit = await one(`select id::text id from curriculum_nodes where kind = 'unit' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    const sp = await one(`select id::text id from curriculum_nodes where kind = 'sp' and subject_id = ${subject} and education_level_id = ${level} order by sort_order, id limit 1`)
    tag = { unitId: unit, spIds: [sp], tp: 3 }
    chapter = await one(`select id::text id from chapters where subject_id = ${subject} and education_level_id = ${level} order by id limit 1`)
  })
  afterEach(() => {
    while (restore.length > 0) restore.pop()!()
  })
  afterAll(async () => {
    await t.close()
  })

  it('the publish transaction is opened with the PUBLISH_TX budget (20 s timeout, 10 s maxWait), not Prisma\'s 5 s default', async () => {
    const { paper } = await draftPaper()
    const spy = vi.spyOn(t.app.get(PrismaService), 'transaction')
    restore.push(() => spy.mockRestore())
    const res = await publish(paper)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.ok).toBe(true)
    const budgets = spy.mock.calls.map((c) => c[1])
    expect(budgets).toContainEqual({ timeout: 20_000, maxWait: 10_000 })
  })

  it('a P2028 after the pins, the figures and the status update were written rolls Terbit back: the paper stays Draf, nothing is half-written, a retry publishes', async () => {
    const { paper } = await draftPaper()
    const before = { row: await paperRow(paper), placements: await placementRows(paper) }
    expect(before.row.status).toBe('draft')
    expect(before.placements.every((p) => p.m === null)).toBe(true) // no mark is frozen before Terbit
    const audit = t.app.get(AuditService)
    const original = audit.record.bind(audit)
    // The last write of the transaction is the audit row; failing it with P2028 happens after pinPlacement and updatePaper(status published).
    const spy = vi.spyOn(audit, 'record').mockImplementation(async (event) => {
      if (event.action === 'bijak.paper.published') throw p2028()
      return original(event)
    })
    restore.push(() => spy.mockRestore())
    const res = await publish(paper)
    expect(spy.mock.calls.some((c) => c[0].action === 'bijak.paper.published'), 'the failing step was reached').toBe(true)
    // an overload is retryable: 429 RATE_LIMITED with Retry-After 5, as on the other write paths (BE-05 deviation row), never a 500
    expect(res.status, JSON.stringify(res.body)).toBe(429)
    expect(res.body.error).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 5 })
    expect(res.headers['retry-after']).toBe('5')
    expect(JSON.stringify(res.body)).not.toContain('P2028')
    // nothing half-written
    expect(await paperRow(paper)).toEqual(before.row)
    expect(await placementRows(paper)).toEqual(before.placements)
    expect(await publishedAudit(paper)).toBe(0)
    // the failure left nothing locked or half-done: the same request now publishes
    spy.mockRestore()
    const retry = await publish(paper)
    expect(retry.status, JSON.stringify(retry.body)).toBe(200)
    expect(retry.body.data.ok).toBe(true)
    expect(String((await paperRow(paper)).status)).toBe('published')
    expect(await publishedAudit(paper)).toBe(1)
    expect((await placementRows(paper)).every((p) => p.m !== null)).toBe(true) // the pins are written by the committed Terbit
  })
})
