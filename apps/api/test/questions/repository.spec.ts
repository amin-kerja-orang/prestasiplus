import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { fnv1a32, mulberry32 } from '../../src/db/prng'
import { QuestionsRepository, QuestionsService } from '../../src/modules/questions'
import { bootQuestionsApp, questionIdOf, type QuestionsTestApp } from './helpers'
import { apiError } from './fixtures'

/** AC 6: one test per repository method other cards rely on (ADR-0014). */
describe('QuestionsRepository contract', () => {
  let t: QuestionsTestApp
  let repo: QuestionsRepository
  let svc: QuestionsService
  let mathT4: string
  let draft: string
  let archived: string
  beforeAll(async () => {
    t = await bootQuestionsApp()
    repo = t.app.get(QuestionsRepository)
    svc = t.app.get(QuestionsService)
    mathT4 = await questionIdOf(t.db, 'SEED-MCQ-MATH-T4')
    draft = await questionIdOf(t.db, 'SEED-DRAFT-BM-T4')
    archived = await questionIdOf(t.db, 'SEED-ARCHIVED-MATH-T4')
  })
  afterAll(async () => {
    await t.close()
  })

  it('get returns the live version tree with decimal-string ids, null for unknown or malformed ids', async () => {
    const q = await repo.get(mathT4)
    expect(q?.id).toBe(mathT4)
    expect(q?.version.status).toBe('approved')
    expect(q?.version.versionNo).toBe(q?.liveVersionNo)
    expect(q?.version.parts[0]).toMatchObject({ mode: 'mcq' })
    expect(typeof q?.version.subjectId).toBe('string')
    expect(await repo.get('999999999')).toBeNull()
    expect(await repo.get('abc')).toBeNull()
    expect(await repo.get('-1')).toBeNull()
  })

  it('get(live) hides a question with no live version; get(latest) shows it', async () => {
    expect(await repo.get(draft)).toBeNull()
    expect(await repo.get(archived)).toBeNull()
    expect((await repo.get(draft, 'latest'))?.version.status).toBe('draft')
    expect((await repo.get(archived, 'latest'))?.version.status).toBe('archived')
  })

  it('getMany keeps the requested order, drops unknown ids and duplicates', async () => {
    const other = await questionIdOf(t.db, 'SEED-MCQ-SCI-T4')
    const rows = await repo.getMany([other, 'x', mathT4, other, '999999999'])
    expect(rows.map((r) => r.id)).toEqual([other, mathT4])
    expect(await repo.getMany([])).toEqual([])
  })

  it('count and groupCount use the live version for status published', async () => {
    expect(await repo.count({ status: 'approved' })).toBe(16)
    expect(await repo.count({ status: 'approved', type: 'mcq' })).toBeGreaterThanOrEqual(6)
    const bySubject = await repo.groupCount('subject', { status: 'approved' })
    expect([...bySubject.values()].reduce((a, b) => a + b, 0)).toBe(16)
    const byLevel = await repo.groupCount('level', { status: 'approved', active: true })
    expect([...byLevel.values()].reduce((a, b) => a + b, 0)).toBe(16)
    for (const key of [...bySubject.keys(), ...byLevel.keys()]) expect(key).toMatch(/^[1-9]\d*$/)
    expect((await repo.groupCount('status', {})).get('approved')).toBe(16)
  })

  it('count narrows by subject, level, excluded ids', async () => {
    const tag = (await t.db.query<{ s: string; l: string }>(`select subject_id::text s, education_level_id::text l from question_versions where number_label = 'SEED-MCQ-MATH-T4'`))[0]!
    const inSubject = await repo.count({ subjectId: tag.s, status: 'approved' })
    expect(inSubject).toBeGreaterThanOrEqual(2)
    expect(await repo.count({ subjectId: tag.s, educationLevelId: tag.l, status: 'approved', excludeIds: [mathT4] })).toBe(
      (await repo.count({ subjectId: tag.s, educationLevelId: tag.l, status: 'approved' })) - 1,
    )
    expect(await repo.count({ subjectId: '999999999' })).toBe(0)
  })

  it('eligibleForPractice is true only for published AND active', async () => {
    expect(await repo.eligibleForPractice(mathT4)).toBe(true)
    expect(await repo.eligibleForPractice(draft)).toBe(false)
    expect(await repo.eligibleForPractice(archived)).toBe(false)
    expect(await repo.eligibleForPractice('999999999')).toBe(false)
    expect(await repo.eligibleForPractice('nope')).toBe(false)
  })

  it('eligibleIds lists the published, active ids in ascending order and honours excludeIds', async () => {
    const ids = await repo.eligibleIds()
    expect(ids).toHaveLength(16)
    expect(ids.map(BigInt)).toEqual([...ids.map(BigInt)].sort((a, b) => (a < b ? -1 : 1)))
    expect(ids).not.toContain(draft)
    expect(ids).not.toContain(archived)
    expect(await repo.eligibleIds({ excludeIds: [mathT4] })).toHaveLength(15)
  })

  it('sample is deterministic for a seed, bounded by n and inside the eligible set', async () => {
    const eligible = new Set(await repo.eligibleIds())
    const a = await repo.sample({}, 5, mulberry32(fnv1a32('be09:a')))
    const b = await repo.sample({}, 5, mulberry32(fnv1a32('be09:a')))
    const c = await repo.sample({}, 5, mulberry32(fnv1a32('be09:other')))
    expect(a).toEqual(b)
    expect(a).toHaveLength(5)
    expect(new Set(a).size).toBe(5)
    for (const id of [...a, ...c]) expect(eligible.has(id)).toBe(true)
    expect(c).not.toEqual(a)
    expect(await repo.sample({}, 0, mulberry32(1))).toEqual([])
    expect(await repo.sample({}, 500, mulberry32(1))).toHaveLength(16)
  })

  it('deactivate leaves eligibility at once and reactivate restores it; unknown id is false', async () => {
    expect(await repo.deactivate(mathT4)).toBe(true)
    expect(await repo.eligibleForPractice(mathT4)).toBe(false)
    expect(await repo.eligibleIds()).not.toContain(mathT4)
    expect(await repo.count({ status: 'approved', active: true })).toBe(15)
    expect(await repo.sample({}, 500, mulberry32(3))).not.toContain(mathT4)
    expect((await repo.get(mathT4))?.isActive).toBe(false)
    expect((await apiError(() => svc.getPublicForLearner(mathT4))).getStatus()).toBe(404)
    expect(await repo.reactivate(mathT4)).toBe(true)
    expect(await repo.eligibleForPractice(mathT4)).toBe(true)
    expect(await repo.deactivate('999999999')).toBe(false)
    expect(await repo.deactivate('zz')).toBe(false)
  })

  it('groupOf returns the stimulus once and the member ids in order; null outside a group', async () => {
    const first = await questionIdOf(t.db, 'SEED-GRP-PASAR-1')
    const group = await repo.groupOf(first)
    expect(group?.stimuli).toHaveLength(1)
    expect(group?.questionIds).toEqual([
      first,
      await questionIdOf(t.db, 'SEED-GRP-PASAR-2'),
      await questionIdOf(t.db, 'SEED-GRP-PASAR-3'),
    ])
    expect(await repo.groupOf(mathT4)).toBeNull()
    expect(await repo.groupOf('999999999')).toBeNull()
  })

  it('ownerStatusCounts and listOwn are scoped to the owner', async () => {
    const teacher = (await t.db.query<{ id: string }>(`select id::text id from users where email = 'guru@demo.test'`))[0]!.id
    expect((await repo.ownerStatusCounts(teacher)).review).toBe(1)
    const page = await repo.listOwn({ ownerId: teacher, page: 1, pageSize: 20 })
    expect(page.total).toBe(1)
    expect(page.rows[0]?.version.status).toBe('review')
    expect((await repo.listOwn({ ownerId: 'nope', page: 1, pageSize: 20 })).total).toBe(0)
  })
})
