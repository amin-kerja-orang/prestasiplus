import { QUESTION_MESSAGES } from '@pp/contract'
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import { BuilderRepository } from '../../src/modules/exam/builder'
import { MISSING_FROM_POOL_TEXT } from '../../src/modules/exam/builder/builder.constants'
import { ACCOUNTS } from '../exam-builder/helpers'
import { serveSeededBlueprints } from '../support/serve-blueprints'
import { bootFullApp, loginFull, type FullApp, type FullClient } from './full-app'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 300_000 })

/**
 * R1 publish-lock-share (closes the KIV of delete-served-guard). `paper_placements.question_id` has no foreign key, so a hard delete that
 * commits between Terbit's read of the placements and its commit would leave a Terbit paper placing nothing. Terbit now takes
 * `FOR SHARE` on the placed question rows inside its transaction; the delete (`FOR UPDATE`) waits, then sees a held paper and answers 409.
 * The interleaving is forced: the real publish request is parked inside its transaction (a gate on the repository), the delete is fired
 * from a second connection, and only then the gate opens.
 */
describe('R1 publish-lock-share', () => {
  let t: FullApp
  let admin: FullClient
  let subject: string
  let level: string
  let tag: { unitId: string; spIds: string[]; tp: number }
  let chapter: string
  let counter = 0
  let repo: BuilderRepository
  const restore: (() => void)[] = []

  const q = (sql: string, params: unknown[] = []) => t.db.query<Record<string, unknown>>(sql, params)
  const one = async (sql: string) => String((await q(sql))[0]!.id)
  const count = async (id: string) => Number((await q(`select count(*)::int n from questions where id = $1`, [id]))[0]!.n)
  const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

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
  const statusOf = async (paper: string) => String((await q(`select status from papers where id = $1`, [paper]))[0]!.status)
  const placed = async (paper: string) => Number((await q(`select count(*)::int n from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1`, [paper]))[0]!.n)

  /** Resolves when the parked call is reached, or fails after 10 s (a lost gate must not hang the suite until the test timeout). */
  const within = (p: Promise<void>, what: string): Promise<void> =>
    Promise.race([p, new Promise<void>((_, rej) => setTimeout(() => rej(new Error(`${what}: the publish request never reached the gate`)), 10_000))])

  /** Parks the first call of a repository method until `open()`; `reached` resolves when the publish transaction is parked there. */
  function gate(method: 'updatePaper' | 'lockQuestionsShared'): { parked: () => Promise<void>; open: () => void } {
    let open!: () => void
    let hit!: () => void
    const wait = new Promise<void>((r) => (open = r))
    const reached = new Promise<void>((r) => (hit = r))
    const original = repo[method].bind(repo) as (...a: unknown[]) => Promise<unknown>
    let first = true
    const target = repo as unknown as Record<string, (...a: unknown[]) => Promise<unknown>>
    const saved = repo[method]
    target[method] = async (...args) => {
      if (first) {
        first = false
        hit()
        await wait
      }
      return original(...args)
    }
    restore.push(() => {
      target[method] = saved as never
    })
    restore.push(open) // a failed assertion must not leave the parked publish request hanging
    return { parked: () => within(reached, method), open }
  }
  /** True once some backend is waiting on a lock (the delete is queued behind the Terbit share lock). */
  async function lockWaiter(): Promise<boolean> {
    for (let i = 0; i < 100; i++) {
      const rows = await q(`select 1 from pg_stat_activity where datname = current_database() and wait_event_type = 'Lock' and pid <> pg_backend_pid()`)
      if (rows.length > 0) return true
      await sleep(100)
    }
    return false
  }

  beforeAll(async () => {
    t = await bootFullApp()
    await serveSeededBlueprints(t.db)
    admin = await loginFull(t, ACCOUNTS.admin)
    repo = t.app.get(BuilderRepository, { strict: false })
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

  it('a delete fired while Terbit is inside its transaction waits for it, then is refused 409 served; the question and the placement stay', async () => {
    const { paper, ids } = await draftPaper()
    const victim = ids[1]!
    const g = gate('updatePaper')
    const pub = Promise.resolve(publish(paper))
    await g.parked() // Terbit holds the paper lock and, with the fix, the share locks; it has not committed
    let settled = false
    const del = Promise.resolve(admin.del(`/api/questions/${victim}`)).then((r) => {
      settled = true
      return r
    })
    expect(await lockWaiter(), 'the delete is queued on a lock').toBe(true)
    await sleep(300)
    expect(settled, 'the delete has not been answered while Terbit is open').toBe(false)
    expect(await count(victim)).toBe(1)
    g.open()
    const published = await pub
    expect(published.body.data, JSON.stringify(published.body)).toMatchObject({ ok: true })
    const res = await del
    expect(res.status, JSON.stringify(res.body)).toBe(409)
    expect(res.body.error).toMatchObject({ code: 'CONFLICT', message: QUESTION_MESSAGES.deleteRefused, details: { reason: 'served' } })
    expect(await count(victim)).toBe(1)
    expect(await statusOf(paper)).toBe('published')
    expect(await placed(paper)).toBe(6)
  })

  it('the bulk delete is held back the same way (its failed list names the question), the others in the batch are not placed and go', async () => {
    const { paper, ids } = await draftPaper()
    const victim = ids[2]!
    const g = gate('updatePaper')
    const pub = Promise.resolve(publish(paper))
    await g.parked()
    const del = Promise.resolve(admin.post('/api/questions/bulk-action', { action: 'delete', ids: [victim] }))
    expect(await lockWaiter()).toBe(true)
    g.open()
    expect((await pub).body.data).toMatchObject({ ok: true })
    const res = await del
    expect(JSON.stringify(res.body)).toContain(victim)
    expect(await count(victim)).toBe(1)
    expect(await placed(paper)).toBe(6)
  })

  it('reverse order: a delete that commits first (the paper is still a draft) leaves Terbit refused, not a Terbit paper placing nothing', async () => {
    const { paper, ids } = await draftPaper()
    const victim = ids[0]!
    const del = await admin.del(`/api/questions/${victim}`)
    expect(del.status, JSON.stringify(del.body)).toBe(200)
    expect(await count(victim)).toBe(0)
    const res = await publish(paper)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.ok, JSON.stringify(res.body)).toBe(false)
    expect(res.body.data.errors.length).toBeGreaterThan(0)
    expect(await statusOf(paper)).not.toBe('published')
  })

  it('reverse order, tight: the delete commits after Terbit began but before it locks the rows: Terbit names the missing question and refuses', async () => {
    const { paper, ids } = await draftPaper()
    const victim = ids[3]!
    const g = gate('lockQuestionsShared')
    const pub = Promise.resolve(publish(paper))
    await g.parked() // Terbit is inside its transaction, the paper is locked, no question lock is taken yet
    const del = await admin.del(`/api/questions/${victim}`)
    expect(del.status, JSON.stringify(del.body)).toBe(200)
    g.open()
    const res = await pub
    expect(res.body.data.ok, JSON.stringify(res.body)).toBe(false)
    // The exact blocker: the deleted question is missing from the pool (UNKNOWN_QUESTION), named with its id.
    expect((res.body.data.errors as string[]).some((e) => e.includes(victim) && e.includes(MISSING_FROM_POOL_TEXT)), JSON.stringify(res.body.data.errors)).toBe(true)
    expect(await statusOf(paper)).not.toBe('published')
    expect(await count(victim)).toBe(0)
  })
})
