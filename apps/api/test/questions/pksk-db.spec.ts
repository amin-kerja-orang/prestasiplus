import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fnv1a32, mulberry32 } from '../../src/db/prng'
import { PkskQuestionsService, QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * BE-42 on the real database (needs Docker): a PKSK question lives in the one bank, tagged, and is invisible to every
 * M04 list, count, source and write; migration 0031 lets the PKSK leaf in and nothing else.
 */
describe('PKSK questions in the question bank', () => {
  let t: QuestionsTestApp
  let pksk: PkskQuestionsService
  let repo: QuestionsRepository
  let svc: QuestionsService
  let adminId: string
  const write = (over: Record<string, unknown> = {}) => ({
    domainCode: 'PKSK_MATH',
    targetLevel: 'T1' as const,
    status: 'approved' as const,
    questionText: 'Soalan PKSK ujian satu',
    difficultyLevel: 3,
    explanation: null,
    options: [{ text: 'a', isCorrect: true }, { text: 'b', isCorrect: true }, { text: 'c', isCorrect: false }],
    ...over,
  })

  beforeAll(async () => {
    t = await bootQuestionsApp()
    pksk = t.app.get(PkskQuestionsService)
    repo = t.app.get(QuestionsRepository)
    svc = t.app.get(QuestionsService)
    adminId = (await t.db.query<{ id: string }>(`select id::text from users where lower(email) = 'admin@demo.test'`))[0]?.id as string
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('migration 0031 widened the two checks by one value each', async () => {
    const rows = await t.db.query<{ def: string }>(
      `select pg_get_constraintdef(oid) as def from pg_constraint where conname in ('ck_question_parts_mode', 'ck_answer_keys_kind')`,
    )
    expect(rows.map((r) => r.def).join(' ')).toContain('pksk_choice')
    expect(rows.map((r) => r.def).join(' ')).toContain("'options'")
  })

  it('create stores the tags, one pksk_choice part, an options key and no curriculum tag; approved is live', async () => {
    const before = await repo.count()
    const q = await pksk.create(write(), adminId)
    expect(q).toMatchObject({ status: 'approved', targetLevel: 'T1', domainCode: 'PKSK_MATH', difficultyLevel: 3 })
    expect(q.options.map((o) => o.isCorrect)).toEqual([true, true, false])
    const tags = await t.db.query<{ kind: string; code: string }>(`select kind, code from question_tags where question_id = $1 order by kind`, [q.id])
    expect(tags).toEqual([{ kind: 'pksk_domain', code: 'PKSK_MATH' }, { kind: 'pksk_level', code: 'T1' }])
    const [row] = await t.db.query<{ mode: string; kind: string; subject_id: string | null; live: number | null }>(
      `select p.mode, k.kind, v.subject_id::text, qq.live_version_no as live
         from questions qq join question_versions v on v.question_id = qq.id join question_parts p on p.question_version_id = v.id
         join answer_keys k on k.part_id = p.id where qq.id = $1`,
      [q.id],
    )
    expect(row).toEqual({ mode: 'pksk_choice', kind: 'options', subject_id: null, live: 1 })
    expect(await repo.count()).toBe(before)
  })

  it('M04 never sees it: lists, summary, counts, eligibility, sampling, reads by id and writes', async () => {
    const q = await pksk.create(write({ questionText: 'Soalan PKSK tersembunyi' }), adminId)
    const list = await svc.list({ page: 1, pageSize: 50 })
    expect(list.rows.map((r) => r.id)).not.toContain(q.id)
    expect((await svc.summary()).total).toBe(await repo.count())
    expect(await repo.eligibleIds()).not.toContain(q.id)
    expect(await repo.sample({}, 1000, mulberry32(fnv1a32('x')))).not.toContain(q.id)
    expect(await repo.eligibleForPractice(q.id)).toBe(false)
    expect(await repo.get(q.id)).toBeNull()
    expect(await repo.get(q.id, 'latest')).toBeNull()
    await expect(svc.getAdmin(q.id)).rejects.toMatchObject({ status: 404 })
    await expect(svc.remove(q.id, { userId: adminId, role: 'admin' })).rejects.toMatchObject({ status: 404 })
    await expect(svc.setStatus(q.id, 'archived', adminId)).rejects.toMatchObject({ status: 404 })
    expect(await repo.deactivate(q.id)).toBe(false)
    expect(await pksk.get(q.id)).not.toBeNull()
  })

  it('the general create refuses a pksk_choice part with 422 and writes nothing', async () => {
    const before = (await t.db.query<{ n: string }>(`select count(*)::text n from questions`))[0]?.n
    const leaf = { label: '1', prompt: { ms: 'S' }, marks: 1, mode: 'pksk_choice', options: [{ label: 'A', body: { ms: 'a' } }, { label: 'B', body: { ms: 'b' } }], key: { kind: 'options', correct: ['A'] } }
    await expect(svc.create({ questionType: 'mcq', questionText: 'S', parts: [leaf] } as never, { userId: adminId, role: 'admin' })).rejects.toMatchObject({ status: 422 })
    expect((await t.db.query<{ n: string }>(`select count(*)::text n from questions`))[0]?.n).toBe(before)
  })

  it('status mapping, list order and filters, stats, learner reads and the PKSK-only delete', async () => {
    const a = await pksk.create(write({ questionText: 'Alfa PKSK', domainCode: 'PKSK_SCI' }), adminId)
    const b = await pksk.create(write({ questionText: 'Beta PKSK', domainCode: 'PKSK_SCI', targetLevel: 'T4' }), adminId)
    expect((await pksk.update(a.id, write({ questionText: 'Alfa PKSK', domainCode: 'PKSK_SCI', status: 'pending' })))?.status).toBe('pending')
    expect((await t.db.query<{ status: string; live: number | null }>(`select v.status, q.live_version_no as live from questions q join question_versions v on v.question_id = q.id where q.id = $1`, [a.id]))[0]).toEqual({ status: 'review', live: null })
    expect((await pksk.update(a.id, write({ questionText: 'Alfa PKSK', domainCode: 'PKSK_SCI', status: 'rejected' })))?.status).toBe('rejected')
    expect((await t.db.query<{ status: string; reason: string | null }>(`select status, archive_reason as reason from question_versions where question_id = $1`, [a.id]))[0]).toEqual({ status: 'archived', reason: 'withdrawn' })

    const sci = await pksk.list({ domainCodes: ['PKSK_SCI'], page: 1, pageSize: 20 })
    expect(sci.rows.map((r) => r.id)).toEqual([b.id, a.id])
    expect((await pksk.list({ domainCodes: ['PKSK_SCI'], status: 'rejected', page: 1, pageSize: 20 })).rows.map((r) => r.id)).toEqual([a.id])
    expect((await pksk.list({ level: 'T4', search: 'beta', page: 1, pageSize: 20 })).total).toBe(1)
    expect((await pksk.stats()).total).toBeGreaterThanOrEqual(3)

    expect((await pksk.countApproved('T4'))['PKSK_SCI']).toBe(1)
    const pool = await pksk.approvedPool('T4', ['PKSK_SCI'])
    expect(pool.map((p) => p.id)).toEqual([b.id])
    expect(JSON.stringify(pool)).not.toMatch(/correct/i)
    expect(await pksk.answerKeys('T4', [a.id, b.id])).toEqual([{ id: b.id, domainCode: 'PKSK_SCI', optionCount: 3, correctIndexes: [0, 1] }])
    expect(await pksk.answerKeys('T1', [b.id])).toEqual([])

    const ordinary = (await t.db.query<{ id: string }>(`select q.id::text from questions q where not exists (select 1 from question_tags g where g.question_id = q.id and g.kind = 'pksk_domain') limit 1`))[0]?.id as string
    expect(await pksk.remove([ordinary])).toBe(0)
    expect(await pksk.pkskIds([ordinary, a.id])).toEqual([a.id])
    expect(await pksk.remove([a.id, b.id])).toBe(2)
    expect(await repo.get(ordinary, 'latest')).not.toBeNull()
  })
})
