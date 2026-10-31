import { QUESTION_STATUSES, QuestionStatusSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsService } from '../../src/modules/questions'
import { QuestionsRepository } from '../../src/modules/questions/questions.repository'
import { parseBulk } from '../../src/modules/questions/http/parse'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'
import { adminActor, apiError, mcqInput, tagBody, tagOf, type Tag } from './fixtures'

/** R1-B01 / ADR-0027: `approved` is the one servable status. */
describe('approved = servable (R1-B01)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let repo: QuestionsRepository
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    repo = t.app.get(QuestionsRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  const served = async (id: string): Promise<boolean> => (await repo.eligibleIds({ subjectId: tag.subjectId, educationLevelId: tag.levelId })).includes(id)

  it('the status list has no published', () => {
    expect([...QUESTION_STATUSES]).toEqual(['draft', 'review', 'approved', 'archived'])
  })

  it('draft and review are not served; review to approved (Terbitkan) serves at once; archive stops it', async () => {
    const q = await svc.create(mcqInput(tag, { tag: tagBody(tag, 3) }), admin)
    expect(await served(q.id)).toBe(false)
    await svc.setStatus(q.id, 'review', admin.userId)
    expect(await served(q.id)).toBe(false)
    expect(await repo.eligibleForPractice(q.id)).toBe(false)
    await svc.setStatus(q.id, 'approved', admin.userId)
    expect(await served(q.id)).toBe(true)
    expect(await repo.eligibleForPractice(q.id)).toBe(true)
    expect(await svc.getStatus(q.id)).toMatchObject({ status: 'approved', liveVersionNo: 1 })
    await svc.setStatus(q.id, 'archived', admin.userId)
    expect(await served(q.id)).toBe(false)
  })

  it('approved to draft and the old published code are refused', async () => {
    const q = await svc.create(mcqInput(tag, { tag: tagBody(tag, 3) }), admin)
    await svc.setStatus(q.id, 'review', admin.userId)
    await svc.setStatus(q.id, 'approved', admin.userId)
    const err = await apiError(() => svc.setStatus(q.id, 'draft', admin.userId))
    expect(err.code).toBe('CONFLICT')
    expect(QuestionStatusSchema.safeParse('published').success).toBe(false) // the HTTP contract refuses the removed code
  })

  it('versioning: editing an approved question keeps v1 serving; approving v2 archives v1 (superseded)', async () => {
    const q = await svc.create(mcqInput(tag, { status: 'approved', tag: tagBody(tag, 3) }), admin)
    expect(await served(q.id)).toBe(true)
    await svc.update(q.id, { ...mcqInput(tag, { tag: tagBody(tag, 3) }), questionText: 'Versi dua?' } as never, admin)
    expect(await served(q.id)).toBe(true)
    const rows = await t.db.query<{ version_no: number; status: string }>('select version_no, status from question_versions where question_id = $1::bigint order by version_no', [q.id])
    expect(rows).toEqual([{ version_no: 1, status: 'approved' }, { version_no: 2, status: 'draft' }])
    await svc.setStatus(q.id, 'review', admin.userId)
    await svc.setStatus(q.id, 'approved', admin.userId)
    const after = await t.db.query<{ version_no: number; status: string; archive_reason: string | null }>('select version_no, status, archive_reason from question_versions where question_id = $1::bigint order by version_no', [q.id])
    expect(after).toEqual([{ version_no: 1, status: 'archived', archive_reason: 'superseded' }, { version_no: 2, status: 'approved', archive_reason: null }])
    expect(await svc.getStatus(q.id)).toMatchObject({ liveVersionNo: 2 })
  })

  it('bulk: approved applies the gate per id and reports failures; the published alias is accepted as approved', async () => {
    const bare = (await svc.create(mcqInput(tag), admin)).id
    const ok = (await svc.create(mcqInput(tag, { tag: tagBody(tag, 3) }), admin)).id
    await svc.bulkAction('review', [bare, ok], admin)
    const res = await svc.bulkAction('approved', [bare, ok], admin)
    expect(res.ids).toEqual([ok])
    expect(res.failed).toHaveLength(1)
    expect(await served(ok)).toBe(true)
    expect(await served(bare)).toBe(false)
    expect(parseBulk({ action: 'published', ids: ['1'] }).action).toBe('approved')
    expect(() => parseBulk({ action: 'zzz', ids: ['1'] })).toThrow()
  })

  it('the database refuses a published version and keeps one approved version per question', async () => {
    const q = await svc.create(mcqInput(tag, { status: 'approved', tag: tagBody(tag, 3) }), admin)
    await expect(t.db.query(`update question_versions set status = 'published' where question_id = $1::bigint`, [q.id])).rejects.toThrow()
    await expect(
      t.db.query(`insert into question_versions (question_id, version_no, status, type, stem_ms) values ($1::bigint, 2, 'approved', 'mcq', 'x')`, [q.id]),
    ).rejects.toThrow()
  })
})
