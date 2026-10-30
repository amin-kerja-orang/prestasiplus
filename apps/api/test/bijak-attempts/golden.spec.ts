/**
 * AC4: the stored API result equals the mock engine's output for fixed answer sets (all PoC papers),
 * including equivalence marking (LaTeX and decimal forms of the accepted final), a maths-input case
 * with working lines and a unit, choose-N, and parts that wait for a human (provisional).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BANK, PAPERS } from '../../../../src/modules/m28-bijak-spm/data/registry'
import { BijakServer, MemoryStorage } from '../../../../src/modules/m28-bijak-spm/server/store'
import { leavesOf, type PartAnswer, type SchemeDef } from '../../src/modules/bijak/attempts/exam-core.adapter'
import { AttemptsTestApp, bootAttemptsApp, change, type Client, loginAs, PAPER, startAttempt, STUDENT } from './helpers'

type Strategy = 'correct' | 'equivalent' | 'wrong' | 'blank-half'

function answerFor(scheme: SchemeDef, strategy: Strategy, unit?: string): PartAnswer | undefined {
  if (strategy === 'wrong') return scheme.kind === 'option' ? { choice: 'zzz' } : { text: 'tidak tahu', final: '999', steps: ['999'] }
  switch (scheme.kind) {
    case 'option':
      return { choice: scheme.correct }
    case 'mapping':
      return { choice: Object.values(scheme.map)[0] }
    case 'accepted':
      return { text: scheme.values[0]!.v, final: scheme.values[0]!.v, ...(scheme.values[0]!.unit ? { unit: scheme.values[0]!.unit } : {}) }
    case 'rubric':
      return { text: 'Perlembagaan menjadi asas undang-undang dan melindungi hak rakyat dalam sebuah negara yang baharu merdeka.' }
    case 'points': {
      const steps = scheme.points.flatMap((p) => (p.match.type === 'step' ? [p.match.accept[0]!] : p.match.type === 'all_of' ? [p.match.items.join(' ')] : []))
      const kw = scheme.points.flatMap((p) => (p.match.type === 'keywords' ? p.match.anyOf.slice(0, 1) : []))
      const f = scheme.final?.accept[0]
      const final = f !== undefined && strategy === 'equivalent' && /^-?\d+$/.test(f) ? `\\frac{${String(Number(f) * 2)}}{2}` : f
      return {
        steps,
        text: kw.join(' '),
        ...(final !== undefined ? { final } : {}),
        ...((scheme.final?.unit ?? unit) ? { unit: scheme.final?.unit ?? unit } : {}),
      }
    }
  }
}

function changesFor(slug: string, strategy: Strategy) {
  const def = PAPERS.find((p) => p.id === slug)!
  const out: { partId: string; answer: PartAnswer; rev: number; savedAt: string }[] = []
  let n = 0
  for (const s of def.sections)
    for (const qid of s.questionIds) {
      const q = BANK.questions.get(qid)!
      const leaves = q.mcq ? [{ id: q.id, unit: undefined as string | undefined }] : leavesOf(q.parts ?? []).map((l) => ({ id: l.id, unit: l.unit }))
      for (const l of leaves) {
        n += 1
        if (strategy === 'blank-half' && n % 2 === 0) continue
        const a = answerFor(BANK.schemes.get(l.id)!, strategy === 'blank-half' ? 'correct' : strategy, l.unit)
        if (a) out.push({ partId: l.id, answer: a, rev: 1, savedAt: '2026-10-20T09:00:00+08:00' })
      }
    }
  return out
}

let t: AttemptsTestApp
let me: Client
beforeAll(async () => {
  t = await bootAttemptsApp()
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

const CASES: [string, string][] = [
  [PAPER.matK1, 'mat-k1-2025-a'],
  [PAPER.matK2, 'mat-k2-2025-a'],
  [PAPER.sainsK2, 'sn-k2-2025-a'],
  [PAPER.sejK2, 'sej-k2-2025-a'],
]

describe('stored result equals the mock engine output', () => {
  for (const [paperId, slug] of CASES) {
    for (const strategy of ['correct', 'equivalent', 'wrong', 'blank-half'] as Strategy[]) {
      it(`${slug} / ${strategy}`, async () => {
        const changes = changesFor(slug, strategy)
        // mock
        const mock = new BijakServer({ storage: new MemoryStorage(), now: () => 1_800_000_000_000 })
        const started = await mock.startAttempt(1, slug, 'exam')
        await mock.submit(1, started.attemptId, { idempotencyKey: 'g', changes: changes.map((c) => ({ ...c, savedAt: 1 })) })
        const expected = (await mock.getResult(1, started.attemptId)).result
        // api
        t.clock.set('2026-10-20T09:00:00+08:00')
        const id = await startAttempt(me, paperId, 'exam', true)
        const res = await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'g', changes })
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        const got = (await me.get(`/api/bijak/attempts/${id}/result`)).body.data.result
        // R1-B12/B13 add `selfMarkable` and `suggestion` to written parts; the marking itself must be unchanged.
        const stripped = JSON.parse(JSON.stringify(got, (k, v) => (k === 'selfMarkable' || k === 'suggestion' ? undefined : v)))
        expect(stripped).toEqual(JSON.parse(JSON.stringify(expected)))
        if (strategy === 'correct' && slug !== 'sej-k2-2025-a') expect(got.score).toBeGreaterThan(0)
      })
    }
  }

  it('mock-test examples: the maths-input case (working lines, unit) and the provisional rubric case', async () => {
    const changes = [
      { partId: 'mat2-segitiga-v1-q1-a', answer: { steps: ['AC^2 = 12^2 + 5^2'], final: '13', unit: 'cm' }, rev: 1, savedAt: '2026-10-20T09:00:00+08:00' },
      { partId: 'mat2-garis-v1-c1', answer: { steps: ['2*4+3'], final: '11' }, rev: 1, savedAt: '2026-10-20T09:00:00+08:00' },
    ]
    const id = await startAttempt(me, PAPER.matK2, 'exam', true)
    await me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: 'm', changes })
    const { result } = (await me.get(`/api/bijak/attempts/${id}/result`)).body.data
    expect(result.questions.map((q: { awarded: number }) => q.awarded)).toEqual([2, 0, 0, 2, 0, 0])
    expect(result.max).toBe(21)

    const sn = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    await me.post(`/api/bijak/attempts/${sn}/submit`, {
      idempotencyKey: 'p',
      changes: [change('sn2-sel-q1-a', { text: 'Ia ialah bahagian yang mengawal semua aktiviti sel itu' })],
    })
    const r = (await me.get(`/api/bijak/attempts/${sn}/result`)).body.data.result
    expect(r.provisional).toBe(true)
    expect(r.pendingReview).toBe(1)
  })

  it('choose-N counts the best N attempted questions whatever was ticked; coins and points are the display values', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    await me.post(`/api/bijak/attempts/${id}/submit`, {
      idempotencyKey: 'c',
      changes: [change('sn2-osmosis-a', { text: 'Air melalui membran separa telap ke dalam sel hingga sel menjadi turgid.' })],
      picks: { 'sn-k2-2025-a-s2': ['sn2-fotosintesis'] },
    })
    const { result, attempt } = (await me.get(`/api/bijak/attempts/${id}/result`)).body.data
    const b = result.sections[1]
    expect(b).toMatchObject({ chooseN: 1, counted: ['sn2-osmosis'], awarded: 2, marks: 4 })
    expect(result).toMatchObject({ score: 2, coins: 4, points: 20 })
    expect(attempt.picks).toEqual({ 'sn-k2-2025-a-s2': ['sn2-fotosintesis'] })
  })
})
