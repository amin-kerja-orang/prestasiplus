import type { QuestionPart } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { checkKeysGate, checkTagGate, QuestionsService, TRANSITION_CONFLICT_MESSAGE } from '../../src/modules/questions'
import { bootQuestionsApp, type QuestionsTestApp } from './helpers'
import { adminActor, apiError, mcqInput, tagBody, tagOf, type Tag } from './fixtures'

const rich = (ms: string) => ({ ms })

describe('checkTagGate (pure)', () => {
  const full = { subjectId: '1', educationLevelId: '2', unitId: '3', spIds: ['4'], tp: 3 }
  it('holds when subject, level, unit, SP and TP are set', () => {
    expect(checkTagGate(full)).toEqual({})
  })
  it('names every missing field with the contract keys', () => {
    const fields = checkTagGate({ subjectId: null, educationLevelId: null, unitId: null, spIds: [], tp: null })
    expect(Object.keys(fields).sort()).toEqual(['educationLevelId', 'spIds', 'subjectId', 'tp', 'unitId'])
    for (const m of Object.values(fields)) expect(m.length).toBeGreaterThan(5)
  })
  it('one missing field yields exactly that key; TP outside 1..6 fails', () => {
    expect(Object.keys(checkTagGate({ ...full, unitId: null }))).toEqual(['unitId'])
    expect(Object.keys(checkTagGate({ ...full, spIds: [] }))).toEqual(['spIds'])
    expect(Object.keys(checkTagGate({ ...full, tp: 0 }))).toEqual(['tp'])
    expect(Object.keys(checkTagGate({ ...full, tp: 7 }))).toEqual(['tp'])
    expect(checkTagGate({ ...full, tp: 6 })).toEqual({})
  })
})

describe('checkKeysGate (pure)', () => {
  const working = (marks: number, keyMarks: number, pointMarks: number): QuestionPart =>
    ({
      label: 'a', prompt: rich('x'), mode: 'working', marks,
      key: { kind: 'points', marks: keyMarks, points: [{ id: 'p1', code: 'K', label: 'k', marks: pointMarks }] },
    }) as unknown as QuestionPart
  it('accepts a key whose marks equal the leaf marks and the sum of its points', () => {
    expect(checkKeysGate([working(3, 3, 3)])).toEqual({})
  })
  it('flags a key total that differs from the leaf marks or from its points', () => {
    expect(Object.keys(checkKeysGate([working(3, 2, 2)]))).toEqual(['parts.a.key'])
    expect(Object.keys(checkKeysGate([working(3, 3, 2)]))).toEqual(['parts.a.key'])
  })
  it('counts "any N of M" at N times the group mark', () => {
    const part = {
      label: 'a', prompt: rich('x'), mode: 'working', marks: 4,
      key: {
        kind: 'points', marks: 4,
        points: [1, 2, 3].map((n) => ({ id: `p${String(n)}`, code: 'K', label: 'k', marks: 2 })),
        groups: [{ id: 'g', anyN: 2, eachMarks: 2, pointIds: ['p1', 'p2', 'p3'] }],
      },
    } as unknown as QuestionPart
    expect(checkKeysGate([part])).toEqual({})
  })
})

describe('setStatus publish gate (service, real database)', () => {
  let t: QuestionsTestApp
  let svc: QuestionsService
  let tag: Tag
  let admin: Awaited<ReturnType<typeof adminActor>>
  beforeAll(async () => {
    t = await bootQuestionsApp()
    svc = t.app.get(QuestionsService)
    tag = await tagOf(t.db, 'SEED-MCQ-MATH-T4')
    admin = await adminActor(t.db)
  })
  afterAll(async () => {
    await t.close()
  })

  /** A question waiting for Terbitkan (review to approved is the one gate step, ADR-0027). */
  async function inReview(over: Parameters<typeof mcqInput>[1] = {}): Promise<string> {
    const q = await svc.create(mcqInput(tag, over), admin)
    await svc.setStatus(q.id, 'review', admin.userId)
    return q.id
  }

  it('publishing without unit and SP is 422 with the offending fields, and nothing changes', async () => {
    const id = await inReview()
    const err = await apiError(() => svc.setStatus(id, 'approved', admin.userId))
    expect(err.getStatus()).toBe(422)
    expect(err.code).toBe('VALIDATION_ERROR')
    expect(Object.keys(err.fields ?? {}).sort()).toEqual(['spIds', 'unitId'])
    expect(await svc.getStatus(id)).toMatchObject({ status: 'review', liveVersionNo: null })
  })

  it('publishing a fully tagged question sets live_version_no and published_at', async () => {
    const id = await inReview({ tag: tagBody(tag, 4) })
    const view = await svc.setStatus(id, 'approved', admin.userId)
    expect(view.version.status).toBe('approved')
    expect(view.liveVersionNo).toBe(1)
    expect(view.version.publishedAt).toBeInstanceOf(Date)
    expect(await svc.getStatus(id)).toMatchObject({ status: 'approved', latestVersionNo: 1, liveVersionNo: 1, isActive: true })
  })

  it('create with status published runs the same gate (422) and passes when tagged', async () => {
    const before = (await t.db.query<{ n: string }>(`select count(*) n from questions`))[0]?.n
    const err = await apiError(() => svc.create(mcqInput(tag, { status: 'approved' }), admin))
    expect(err.getStatus()).toBe(422)
    expect(Object.keys(err.fields ?? {}).sort()).toEqual(['spIds', 'unitId'])
    expect((await t.db.query<{ n: string }>(`select count(*) n from questions`))[0]?.n).toBe(before)
    const ok = await svc.create(mcqInput(tag, { status: 'approved', tag: tagBody(tag, 2) }), admin)
    expect(ok.version.status).toBe('approved')
    expect(ok.liveVersionNo).toBe(1)
  })

  it('a pair outside the contract table is 409 CONFLICT with the BM message', async () => {
    const q = await svc.create(mcqInput(tag), admin)
    const err = await apiError(() => svc.setStatus(q.id, 'approved', admin.userId))
    expect(err.getStatus()).toBe(409)
    expect(err.code).toBe('CONFLICT')
    expect(err.message).toBe(TRANSITION_CONFLICT_MESSAGE('draft', 'approved'))
    const same = await apiError(() => svc.setStatus(q.id, 'draft', admin.userId))
    expect(same.getStatus()).toBe(409)
  })

  it('unknown or malformed ids are 404', async () => {
    expect((await apiError(() => svc.setStatus('999999999', 'review', admin.userId))).getStatus()).toBe(404)
    expect((await apiError(() => svc.setStatus('abc', 'review', admin.userId))).getStatus()).toBe(404)
    expect((await apiError(() => svc.getStatus('999999999'))).getStatus()).toBe(404)
  })

  it('republishing an edited version archives the superseded one in the same step', async () => {
    const id = await inReview({ tag: tagBody(tag, 3) })
    await svc.setStatus(id, 'approved', admin.userId)
    // Q-5: editing a published question makes version 2 as a draft; version 1 keeps serving.
    await svc.update(id, { subjectId: tag.subjectId, educationLevelId: tag.levelId, difficultyLevel: 3, questionText: 'Soalan yang telah disunting untuk versi dua.' }, admin)
    expect(await svc.getStatus(id)).toMatchObject({ status: 'draft', latestVersionNo: 2, liveVersionNo: 1 })
    await svc.setStatus(id, 'review', admin.userId)
    await svc.setStatus(id, 'approved', admin.userId)
    const rows = await t.db.query<{ version_no: number; status: string; archive_reason: string | null }>(
      `select version_no, status, archive_reason from question_versions where question_id = $1 order by version_no`,
      [id],
    )
    expect(rows).toEqual([
      { version_no: 1, status: 'archived', archive_reason: 'superseded' },
      { version_no: 2, status: 'approved', archive_reason: null },
    ])
    expect(await svc.getStatus(id)).toMatchObject({ status: 'approved', liveVersionNo: 2 })
  })

  it('taking a published question down ends its serving at once', async () => {
    const id = await inReview({ tag: tagBody(tag, 3) })
    await svc.setStatus(id, 'approved', admin.userId)
    await svc.setStatus(id, 'archived', admin.userId)
    expect(await svc.getStatus(id)).toMatchObject({ status: 'archived', liveVersionNo: null })
    expect((await apiError(() => svc.getPublicForLearner(id))).getStatus()).toBe(404)
  })
})
