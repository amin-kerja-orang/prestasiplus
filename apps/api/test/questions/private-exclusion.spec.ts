import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { PrismaService } from '../../src/db/prisma.service'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { janaEligibleScope } from '../../src/modules/questions/serving'
import { adminActor, mcqInput, tagBody, tagOf, type Tag } from './fixtures'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'

/**
 * S6-T16 (DM-42, FR-GUR-44a-4, AC-GUR-44a-4): a private version (`visibility = 'teacher_private'`, owner = a teacher) is absent from every
 * served or counted read of the bank, while a read by id (the mission path) still finds it. Needs Docker (testcontainers); the SQL-capture
 * twin that runs everywhere is `private-exclusion-sql.spec.ts`.
 */
describe('a private question never reaches a bank read (DM-42)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let prisma: PrismaService
  let tag: Tag
  let bankId: string
  let privateId: string
  let ownerId: string
  const q = (sql: string, params: unknown[] = []) => t.db.query<{ id: string }>(sql, params)

  async function approved(text: string): Promise<string> {
    const created = await svc.create(mcqInput(tag, { questionText: text, tag: tagBody(tag, 4) }), await adminActor(t.db))
    await q(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2' where question_id = $1`, [created.id])
    await q(`update questions set live_version_no = 1 where id = $1`, [created.id])
    return created.id
  }

  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    prisma = t.app.get(PrismaService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    ownerId = (await adminActor(t.db)).userId
    bankId = await approved('Soalan bank untuk ujian pengecualian soalan peribadi.')
    privateId = await approved('Soalan peribadi guru untuk ujian pengecualian soalan peribadi.')
    await q(`update question_versions set visibility = 'teacher_private', owner_user_id = $1, reference_url = 'https://example.org/rujukan' where question_id = $2`, [ownerId, privateId])
  })

  afterAll(async () => {
    await t.close()
  })

  it('the table refuses a private version without an owner and a bank version with one', async () => {
    await expect(q(`update question_versions set owner_user_id = null where question_id = $1`, [privateId])).rejects.toThrow()
    await expect(q(`update question_versions set owner_user_id = $1 where question_id = $2`, [ownerId, bankId])).rejects.toThrow()
    await expect(q(`update question_versions set reference_url = 'javascript:alert(1)' where question_id = $1`, [bankId])).rejects.toThrow()
  })

  const live = { status: 'approved', active: true } as const

  it('Latih Tubi / Databank / pickers: counts, eligible ids and the seeded draw leave it out', async () => {
    expect(await repo.eligibleIds(live)).toContain(bankId)
    expect(await repo.eligibleIds(live)).not.toContain(privateId)
    expect(await repo.sampleIds(live, 50, 1)).not.toContain(privateId)
    expect(await repo.eligibleAmong([bankId, privateId], live)).toEqual([bankId])
    const all = await repo.count({})
    const rows = await prisma.client.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no WHERE v.visibility = 'bank'`
    expect(all).toBe(rows[0]!.n)
  })

  it('the Studio list (API-Q-01) and the Jana scope leave it out', async () => {
    const page = await repo.listIds({ page: 1, pageSize: 200 } as never)
    expect(page.ids).not.toContain(privateId)
    expect(page.ids).toContain(bankId)
    const { from, where } = janaEligibleScope()
    const ids = (await prisma.client.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${where}`).map((r) => String(r.id))
    expect(ids).not.toContain(privateId)
  })

  it('the admin by-id paths treat a private question as unknown (404): get, update, status, delete', async () => {
    const actor = await adminActor(t.db)
    await expect(svc.getAdmin(privateId)).rejects.toMatchObject({ status: 404 })
    await expect(svc.update(privateId, { questionText: 'x' } as never, actor)).rejects.toMatchObject({ status: 404 })
    await expect(svc.setStatus(privateId, 'archived', actor.userId)).rejects.toMatchObject({ status: 404 })
    await expect(svc.remove(privateId, actor)).rejects.toMatchObject({ status: 404 })
    expect(await repo.eligibleForPractice(privateId)).toBe(false)
    expect(await repo.get(privateId, 'live')).not.toBeNull()
  })

  it('a new version of a question carries visibility, owner and link forward', async () => {
    const draft = (await repo.get(privateId, 'latest'))!
    expect(draft.version.visibility).toBe('teacher_private')
  })

  it('a read by id still finds it (the mission path), with the reference link', async () => {
    const record = await repo.get(privateId, 'live')
    expect(record?.version.visibility).toBe('teacher_private')
    expect(record?.version.ownerUserId).toBe(ownerId)
    expect(record?.version.referenceUrl).toBe('https://example.org/rujukan')
  })

  it('getPublicForLearner and gradeAnswer: 404 (bank-only reads)', async () => {
    await expect(svc.getPublicForLearner(privateId)).rejects.toMatchObject({ status: 404 })
    await expect(svc.gradeAnswer(privateId, [])).rejects.toMatchObject({ status: 404 })
    await expect(svc.getPublicForLearner(bankId)).resolves.toBeDefined()
  })
})
