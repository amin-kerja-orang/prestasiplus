/** Security-review fixes on BE-16: marking hang (F1), scheme-then-rewrite (F2), latihan reward (F3), late photo (F4). */
import { BijakAttemptPaperViewSchema, BijakAttemptResultViewSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { defuseAnswer, defuseRootIndex, gradePart, isBlank, numericValue } from '../../src/modules/bijak/attempts/exam-core.adapter'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, correctChoice, expectError, loginAs, PAPER, questionIdsOfView, START, startAttempt, STUDENT } from './helpers'
import { makePng } from '../files/fixtures'

const GRACE = 300
const iso = (ms: number) => new Date(ms).toISOString()

describe('F1: defuse of the engine root-index hang', () => {
  const HANG = ['\\sqrt[\\sqrt[', '\\sqrt[a\\sqrt[', '\\sqrt[\\sqrt[\\sqrt[', '\\sqrt[\\sqrt[2]]', '\\sqrt[', '\\sqrt [', '\\sqrt\\,[', '\\sqrt\\left[', '$\\sqrt$[', '\\sqrt\\text{ }[', '\\text{\\sqrt[}', '\\frac{\\sqrt[2}{3]}', '{\\sqrt[}', '\\sqrt[{]}']

  it('the hang strings finish at once through the wrappers', () => {
    const t0 = Date.now()
    for (const h of HANG) {
      numericValue(h)
      isBlank({ final: h, steps: [h], text: h, unit: h, choice: h, plain: { steps: [h], final: h } })
      gradePart({ part: { id: 'p', label: 'a', prompt: '', marks: 1, kind: 'numeric' }, scheme: { kind: 'points', model: '', points: [], final: { display: '1', value: 1, tolerance: 0 } } as never, answer: { final: h, steps: [h], plain: { steps: [h], final: h } }, ctx: { finals: {} } as never })
    }
    expect(Date.now() - t0).toBeLessThan(2000)
  })

  it('a random mix of root, bracket and brace tokens never hangs', () => {
    const tokens = ['\\sqrt', '[', ']', '{', '}', '\\frac', '2', 'x', '^', '\\sqrt[', ' ', '\\,', '\\left', '$', '\\text{', '_', '(', ')']
    let seed = 12345
    const rnd = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff
    const t0 = Date.now()
    for (let n = 0; n < 2000; n++) {
      const len = 1 + Math.floor(rnd() * 14)
      let str = ''
      for (let k = 0; k < len; k++) str += tokens[Math.floor(rnd() * tokens.length)]
      const started = Date.now()
      numericValue(str)
      isBlank({ final: str })
      expect(Date.now() - started, JSON.stringify(str)).toBeLessThan(500)
    }
    expect(Date.now() - t0).toBeLessThan(8000)
  })

  it('well-formed input is unchanged and still evaluates', () => {
    expect(numericValue('\\sqrt[3]{8}')).toBe(2)
    expect(numericValue('\\sqrt{16}')).toBe(4)
    expect(defuseRootIndex('\\sqrt[3]{8} + x')).toBe('\\sqrt[3]{8} + x')
    expect(defuseRootIndex('a[1] and b')).toBe('a[1] and b')
    expect(defuseRootIndex('\\sqrt[\\sqrt[')).toBe('\\sqrt\\sqrt')
    expect(defuseAnswer({ choice: 'A', steps: ['\\sqrt['] }).steps).toEqual(['\\sqrt'])
  })

  describe('over HTTP', () => {
    let t: AttemptsTestApp
    let me: Client
    beforeAll(async () => {
      t = await bootAttemptsApp()
      me = await loginAs(t, STUDENT)
    })
    afterAll(async () => {
      await t.close()
    })
    it('autosave of an unterminated root index then submit: 200 promptly, part awarded 0', async () => {
      const id = await startAttempt(me, PAPER.matK2)
      const v = BijakAttemptPaperViewSchema.parse((await me.get(`/api/bijak/attempts/${id}`)).body.data)
      const part = 'mat2-segitiga-v1-q1-a'
      expect(v.questions.length).toBeGreaterThan(0)
      const evil = { final: '\\sqrt[\\sqrt[', steps: ['\\sqrt[a\\sqrt['], text: '\\sqrt[\\sqrt[\\sqrt[', plain: { steps: ['\\sqrt['], final: '\\sqrt[\\sqrt[' } }
      const saved = await me.put(`/api/bijak/attempts/${id}/answers`, { changes: [change(part, evil)] })
      expect(saved.status, JSON.stringify(saved.body)).toBe(200)
      const started = Date.now()
      const res = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'k', changes: [] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(Date.now() - started).toBeLessThan(5000)
      const r = BijakAttemptResultViewSchema.parse((await me.get(`/api/bijak/attempts/${id}/result`)).body.data)
      const leaf = r.result.questions.flatMap((q) => q.parts ?? []).find((p) => p.partId === part)
      expect(leaf?.awarded ?? 0).toBe(0)
    })
  })
})

describe('F2, F3, F4: closing rules', () => {
  let t: AttemptsTestApp
  let me: Client
  beforeAll(async () => {
    t = await bootAttemptsApp()
    me = await loginAs(t, STUDENT)
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(async () => {
    t.clock.set(START)
    await t.db.query('truncate exam_attempts cascade')
    t.reward.calls.length = 0
  })
  const view = async (id: string) => BijakAttemptPaperViewSchema.parse((await me.get(`/api/bijak/attempts/${id}`)).body.data)
  const result = async (id: string) => BijakAttemptResultViewSchema.parse((await me.get(`/api/bijak/attempts/${id}/result`)).body.data)
  const save = (id: string, body: object) => me.put(`/api/bijak/attempts/${id}/answers`, body)
  const submit = (id: string, body: object) => me.post(`/api/bijak/attempts/${id}/submit`, body)

  /** An exam attempt whose sweep time has passed but which nobody has touched. */
  async function swept() {
    const id = await startAttempt(me, PAPER.matK1)
    const v = await view(id)
    const q = questionIdsOfView(v)
    const deadline = new Date(v.attempt.deadline!).getTime()
    t.clock.set(iso(deadline + (GRACE + 5) * 1000))
    return { id, q, deadline }
  }
  const early = (q: string, deadline: number) => ({ changes: [change(q, { choice: correctChoice(q) }, 1, iso(deadline - 1000))] })

  it('F2a: auto:true long before the deadline is recorded as submitted and cannot be late-synced', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const v = await view(id)
    const q = questionIdsOfView(v)[0]!
    const deadline = new Date(v.attempt.deadline!).getTime()
    const out = await submit(id, { idempotencyKey: 'k', changes: [], auto: true })
    expect(out.status).toBe(200)
    expect((await t.db.query<{ status: string }>('select status from exam_attempts where id = $1', [id]))[0]!.status).toBe('submitted')
    const res = await save(id, early(q, deadline))
    expect(res.body.data.closed).toBe(true)
    expect(res.body.data.regraded).toBeUndefined()
    expect((await result(id)).result.score).toBe(0)
  })

  it('F2a: auto:true at the deadline (inside the tolerance) is still auto_submitted; latihan never is', async () => {
    const id = await startAttempt(me, PAPER.matK1)
    const v = await view(id)
    t.clock.set(iso(new Date(v.attempt.deadline!).getTime() - 29_000))
    await submit(id, { idempotencyKey: 'k', changes: [], auto: true })
    expect((await result(id)).attempt.status).toBe('auto_submitted')
    const lat = await startAttempt(me, PAPER.matK2, 'latihan')
    await submit(lat, { idempotencyKey: 'l', changes: [], auto: true })
    expect((await result(lat)).attempt.status).toBe('submitted')
  })

  it('F2b: once the result was shown, a late sync with an old savedAt is not applied', async () => {
    const { id, q, deadline } = await swept()
    expect((await result(id)).result.score).toBe(0)
    expect((await t.db.query<{ v: Date | null }>('select result_viewed_at v from exam_attempts where id = $1', [id]))[0]!.v).not.toBeNull()
    const res = await save(id, early(q[0]!, deadline))
    expect(res.body.data).toMatchObject({ closed: true })
    expect(res.body.data.regraded).toBeUndefined()
    const out = await submit(id, { idempotencyKey: 'again', changes: [], answers: { [q[0]!]: { answer: { choice: correctChoice(q[0]!) }, rev: 5, savedAt: iso(deadline - 500) } }, auto: true })
    expect(out.body.data.regraded).toBeUndefined()
    expect((await result(id)).result.score).toBe(0)
  })

  it('F2c: a newer attempt on the same paper stops the late sync of the older one', async () => {
    const { id, q, deadline } = await swept()
    expect((await view(id)).attempt.status).toBe('auto_submitted')
    await startAttempt(me, PAPER.matK1, 'latihan')
    const res = await save(id, early(q[0]!, deadline))
    expect(res.body.data.closed).toBe(true)
    expect(res.body.data.regraded).toBeUndefined()
    expect(Number((await t.db.query('select score from attempt_results where attempt_id = $1', [id]))[0]!.score)).toBe(0)
  })

  it('F2: the legitimate late sync (swept, scheme never shown, no newer attempt) still regrades', async () => {
    const { id, q, deadline } = await swept()
    const res = await save(id, early(q[0]!, deadline))
    expect(res.body.data).toMatchObject({ closed: true, regraded: true })
    expect((await result(id)).result.score).toBe(1)
  })

  it('F3: a latihan submit does not call the reward port; an exam submit calls it once', async () => {
    const lat = await startAttempt(me, PAPER.matK2, 'latihan')
    expect((await submit(lat, { idempotencyKey: 'l', changes: [] })).status).toBe(200)
    expect(t.reward.calls).toHaveLength(0)
    const ex = await startAttempt(me, PAPER.matK1)
    expect((await submit(ex, { idempotencyKey: 'e', changes: [] })).status).toBe(200)
    expect(t.reward.calls).toHaveLength(1)
    expect(t.reward.calls[0]).toMatchObject({ attemptId: ex })
    // the aggregate port still sees both
    expect(t.aggregate.calls.length).toBeGreaterThanOrEqual(2)
  })

  it('F4: a photo upload after deadline + grace closes the attempt and answers 409', async () => {
    const id = await startAttempt(me, PAPER.matK2)
    const v = await view(id)
    t.clock.set(iso(new Date(v.attempt.deadline!).getTime() + (GRACE + 5) * 1000))
    const res = await me.agent
      .post(`/api/bijak/attempts/${id}/photos`)
      .set('X-CSRF-Token', me.csrf)
      .field('partId', 'mat2-segitiga-v1-q1-a')
      .attach('file', makePng({}), 'a.png')
    expectError(res, 'CONFLICT', 'Percubaan sudah tamat')
    expect((await t.db.query<{ status: string }>('select status from exam_attempts where id = $1', [id]))[0]!.status).toBe('auto_submitted')
    expect(Number((await t.db.query('select count(*) n from attempt_results where attempt_id = $1', [id]))[0]!.n)).toBe(1)
  })
})
