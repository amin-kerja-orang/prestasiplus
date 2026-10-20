import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { CurriculumPorts } from '../../src/modules/curriculum/providers'
import { QuestionCountsAdapter } from '../../src/modules/questions/curriculum-bridge'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { bootQuestionsApp, loginAs, questionIdOf, type Client, type QuestionsTestApp } from './helpers'
import { adminActor, mcqInput, tagOf, type Tag } from './fixtures'

interface Counted {
  id: string
  questionCount: number
}

/** The question counts feed the M03 admin catalogue through `CurriculumPorts`, with no curriculum file edited. */
describe('QuestionCountsAdapter on CurriculumPorts', () => {
  let t: QuestionsTestApp
  let admin: Client
  let repo: QuestionsRepository
  let tag: Tag
  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    repo = t.app.get(QuestionsRepository)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
  })
  afterAll(async () => {
    await t.close()
  })

  const levels = async () => (await admin.get('/api/admin/education-levels')).body.data as Counted[]
  const subjects = async () => (await admin.get('/api/admin/subjects')).body.data as Counted[]

  it('is registered on module init in place of the empty default', () => {
    expect(t.app.get(CurriculumPorts).questionCounts).toBeInstanceOf(QuestionCountsAdapter)
  })

  it('the adapter counts published AND active questions per level and per subject (decimal-string keys)', async () => {
    const adapter = t.app.get(QuestionCountsAdapter)
    const byLevel = await adapter.activeByLevel()
    const bySubject = await adapter.activeBySubject()
    expect([...byLevel.values()].reduce((a, b) => a + b, 0)).toBe(16)
    expect([...bySubject.values()].reduce((a, b) => a + b, 0)).toBe(16)
    for (const key of [...byLevel.keys(), ...bySubject.keys()]) expect(key).toMatch(/^[1-9]\d*$/)
    expect(byLevel.get(tag.levelId)).toBeGreaterThanOrEqual(1)
  })

  it('the admin catalogue shows those counts as questionCount', async () => {
    const l = await levels()
    const s = await subjects()
    expect(l.find((x) => x.id === tag.levelId)?.questionCount).toBe((await repo.groupCount('level', { status: 'published', active: true })).get(tag.levelId))
    expect(s.find((x) => x.id === tag.subjectId)?.questionCount).toBe((await repo.groupCount('subject', { status: 'published', active: true })).get(tag.subjectId))
    expect(l.reduce((sum, x) => sum + x.questionCount, 0)).toBe(16)
    expect(s.reduce((sum, x) => sum + x.questionCount, 0)).toBe(16)
  })

  it('deactivating a question lowers the count at once; drafts and archived questions are never counted', async () => {
    const before = (await subjects()).find((x) => x.id === tag.subjectId)!.questionCount
    const id = await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
    await repo.deactivate(id)
    expect((await subjects()).find((x) => x.id === tag.subjectId)!.questionCount).toBe(before - 1)
    await repo.reactivate(id)
    expect((await subjects()).find((x) => x.id === tag.subjectId)!.questionCount).toBe(before)

    const svc = t.app.get(QuestionsService)
    const actor = await adminActor(t.db)
    await svc.create(mcqInput(tag), actor)
    expect((await subjects()).find((x) => x.id === tag.subjectId)!.questionCount).toBe(before)
    const published = await svc.create(mcqInput(tag, { status: 'published', tag: { unitId: tag.unitId, spIds: [tag.spId], tp: 2 } }), actor)
    expect((await subjects()).find((x) => x.id === tag.subjectId)!.questionCount).toBe(before + 1)
    expect((await levels()).find((x) => x.id === tag.levelId)!.questionCount).toBeGreaterThanOrEqual(before + 1)
    await svc.setStatus(published.id, 'archived', actor.userId)
    expect((await subjects()).find((x) => x.id === tag.subjectId)!.questionCount).toBe(before)
  })
})
