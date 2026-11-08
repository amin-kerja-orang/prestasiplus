/**
 * S3-T04 (46 D-PA-13, FR-PA-16, AC-PA-11, AC-MUR-13-7): a Mod Latihan sitting credits Syiling only for the parts "Semak" never revealed; exam mode pays as before.
 * Syiling per mark = S5-T15 `coinsPerCorrect()` (1 with no `reward_settings` row; the row sets it); XP stays 10 per mark.
 * A checked question reveals the parts "Semak" shows (auto-marked kinds; an essay part waits for Hantar and stays paid); a DM-68 `revealed` flag on an answer row counts too.
 */
import { BijakAttemptPaperViewSchema, BijakAttemptResultViewSchema } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { BANK } from '../../../../src/modules/m28-bijak-spm/data/registry'
import { leavesOf, type PartAnswer, type SchemeDef, SEMAK_KINDS } from '../../src/modules/bijak/attempts/exam-core.adapter'
import { resetCoinsPresenceCache } from '../../src/modules/practice/coins'
import { type AttemptsTestApp, bootAttemptsApp, change, type Client, correctChoice, loginAs, PAPER, questionIdsOfView, startAttempt, STUDENT } from './helpers'

let t: AttemptsTestApp
let me: Client

beforeAll(async () => {
  t = await bootAttemptsApp()
  me = await loginAs(t, STUDENT)
})
afterAll(async () => {
  await t.close()
})

/** The `reward_settings` row (migration 0223) at rate `rate`, or no row at all when `null`. */
async function setRate(rate: number | null): Promise<void> {
  await t.db.query('delete from reward_settings')
  if (rate !== null) await t.db.query('insert into reward_settings (id, coins_per_correct, session_year) values (1, $1, 2026)', [rate])
  resetCoinsPresenceCache()
}

beforeEach(async () => {
  await t.db.query('truncate exam_attempts cascade')
  t.reward.calls.length = 0
  await setRate(null)
})

const view = async (id: string) => BijakAttemptPaperViewSchema.parse((await me.get(`/api/bijak/attempts/${id}`)).body.data)
const result = async (id: string) => BijakAttemptResultViewSchema.parse((await me.get(`/api/bijak/attempts/${id}/result`)).body.data).result
const questions = async (id: string) => questionIdsOfView(await view(id))
const submit = (id: string, changes: object[]) => me.post(`/api/bijak/attempts/${id}/submit`, { idempotencyKey: `k-${id}`, changes })
const check = (id: string, q: string, changes: object[]) => me.post(`/api/bijak/attempts/${id}/questions/${q}/check`, { changes })
const allCorrect = (qs: string[]) => qs.map((q) => change(q, { choice: correctChoice(q) }))

/** A correct answer for a scheme of the PoC bank (option, accepted value or keyword points). */
function correctAnswer(scheme: SchemeDef): PartAnswer | undefined {
  switch (scheme.kind) {
    case 'option':
      return { choice: scheme.correct }
    case 'accepted':
      return { text: scheme.values[0]!.v, final: scheme.values[0]!.v, ...(scheme.values[0]!.unit ? { unit: scheme.values[0]!.unit } : {}) }
    case 'points': {
      const steps = scheme.points.flatMap((p) => (p.match.type === 'step' ? [p.match.accept[0]!] : p.match.type === 'all_of' ? [p.match.items.join(' ')] : []))
      const kw = scheme.points.flatMap((p) => (p.match.type === 'keywords' ? p.match.anyOf.slice(0, 1) : []))
      const final = scheme.final?.accept[0]
      return { steps, text: kw.join(' '), ...(final !== undefined ? { final } : {}), ...(scheme.final?.unit ? { unit: scheme.final.unit } : {}) }
    }
    default:
      return undefined
  }
}

/** The leaves "Semak" reveals of a question (46 section 3.5): an essay or working leaf has no "Semak", so checking never reveals (or unpays) it. */
const semakLeaves = (qid: string): string[] => {
  const q = BANK.questions.get(qid)!
  return q.mcq ? [qid] : leavesOf(q.parts ?? []).filter((l) => SEMAK_KINDS.has(l.kind)).map((l) => l.id)
}

/** Correct answers for every leaf of the given PoC questions. */
function answersOf(questionIds: readonly string[]) {
  const out: { partId: string; answer: PartAnswer; rev: number; savedAt: string }[] = []
  for (const qid of questionIds) {
    const q = BANK.questions.get(qid)!
    for (const l of q.mcq ? [{ id: q.id }] : leavesOf(q.parts ?? [])) {
      const a = correctAnswer(BANK.schemes.get(l.id)!)
      if (a) out.push(change(l.id, a))
    }
  }
  return out
}

describe('Mod Latihan reward, rate 1 (no reward_settings row)', () => {
  it('pays only the parts never revealed: 2 checked questions are not paid, the rest are', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    const qs = await questions(id)
    expect(qs.length).toBeGreaterThanOrEqual(3)
    for (const q of qs.slice(0, 2)) expect((await check(id, q, [change(q, { choice: correctChoice(q) })])).status).toBe(200)
    expect((await submit(id, allCorrect(qs))).status).toBe(200)
    expect(t.reward.calls).toHaveLength(1)
    const call = t.reward.calls[0]!
    const unrevealed = qs.length - 2
    expect(call).toMatchObject({ attemptId: id, score: qs.length })
    expect(call.coins).toBe(unrevealed)
    expect(call.points).toBe(unrevealed * 10)
    // the result tile shows the credited amount, not score x rate
    const r = await result(id)
    expect([r.coins, r.points]).toEqual([call.coins, call.points])
  })

  it('every question revealed: the port is still called once, with 0 coins and 0 points (streak event only)', async () => {
    const all = await startAttempt(me, PAPER.matK1, 'latihan')
    const qs = await questions(all)
    for (const q of qs) await check(all, q, [change(q, { choice: correctChoice(q) })])
    expect((await submit(all, allCorrect(qs))).status).toBe(200)
    expect(t.reward.calls).toHaveLength(1)
    expect(t.reward.calls[0]).toMatchObject({ attemptId: all, coins: 0, points: 0 })
    t.reward.calls.length = 0
    const none = await startAttempt(me, PAPER.matK1, 'latihan')
    expect((await submit(none, allCorrect(await questions(none)))).status).toBe(200)
    expect(t.reward.calls).toHaveLength(1)
    expect(t.reward.calls[0]).toMatchObject({ attemptId: none, coins: qs.length })
  })

  it('exam mode is unchanged: the whole result pays, 1 Syiling and 10 XP per mark', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'exam')
    const qs = await questions(id)
    expect((await submit(id, allCorrect(qs))).status).toBe(200)
    expect(t.reward.calls).toHaveLength(1)
    expect(t.reward.calls[0]).toMatchObject({ attemptId: id, coins: qs.length, points: qs.length * 10 })
  })
})

describe('Mod Latihan reward, revealed sets', () => {
  /** Marks awarded to the counted parts of `r` that are not among `skip`. */
  const paid = (r: Awaited<ReturnType<typeof result>>, skip: ReadonlySet<string>) =>
    r.questions.filter((q) => q.counted).flatMap((q) => q.parts).filter((p) => !skip.has(p.partId)).reduce((n, p) => n + p.awarded, 0)

  it('a multi-part question checked on ONE part reveals all the parts "Semak" shows', async () => {
    await setRate(2)
    const id = await startAttempt(me, PAPER.matK2, 'latihan')
    const all = await questions(id)
    const multi = all.find((q) => semakLeaves(q).length >= 2)!
    const leaves = semakLeaves(multi)
    const first = answersOf([multi]).filter((a) => a.partId === leaves[0])
    expect((await check(id, multi, first)).status).toBe(200)
    expect((await submit(id, answersOf(all))).status).toBe(200)
    const r = await result(id)
    const expected = paid(r, new Set(leaves))
    const total = paid(r, new Set())
    expect(total).toBeGreaterThan(expected) // the checked question did earn marks, so the test is not vacuous
    expect(expected).toBeGreaterThan(0)
    expect(t.reward.calls[0]).toMatchObject({ coins: expected * 2, points: expected * 10 })
    expect([r.coins, r.points]).toEqual([expected * 2, expected * 10]) // result = credit
  })

  it('choose-N: checking the question that does NOT count leaves the pay unchanged', async () => {
    const id = await startAttempt(me, PAPER.sainsK2, 'latihan')
    const all = await questions(id)
    const answers = answersOf(['sn2-osmosis', 'sn2-fotosintesis'])
    expect((await check(id, 'sn2-fotosintesis', answers.filter((a) => a.partId === 'sn2-fotosintesis-a'))).status).toBe(200)
    expect((await submit(id, [...answersOf(all)])).status).toBe(200)
    const r = await result(id)
    const section = r.sections.find((s) => s.chooseN === 1 && s.counted.some((q) => q.startsWith('sn2-')))!
    expect(section.counted).toEqual(['sn2-osmosis']) // tie on marks: the lower position counts, so fotosintesis (checked) is dropped
    const fotoParts = new Set(['sn2-fotosintesis-a'])
    expect(t.reward.calls[0]).toMatchObject({ coins: paid(r, new Set()), points: paid(r, new Set()) * 10 })
    expect(paid(r, fotoParts)).toBe(paid(r, new Set())) // the dropped question holds no counted marks
  })

  it('union: an answer-row revealed flag on one question and a check on another are both left unpaid', async () => {
    const id = await startAttempt(me, PAPER.matK2, 'latihan')
    const all = await questions(id)
    const withMarks = all.filter((q) => answersOf([q]).length > 0 && semakLeaves(q).length > 0)
    const [flagged, checked] = [withMarks[0]!, withMarks[1]!]
    const flaggedLeaf = leavesOf(BANK.questions.get(flagged)!.parts ?? [])[0]!.id
    const checkedLeaves = semakLeaves(checked)
    await me.put(`/api/bijak/attempts/${id}/answers`, { changes: answersOf(all) })
    await t.db.query(`update attempt_answers set answer = answer || '{"revealed": true}'::jsonb where attempt_id = $1 and part_id = $2`, [id, flaggedLeaf])
    expect((await check(id, checked, [])).status).toBe(200)
    expect((await submit(id, [])).status).toBe(200)
    const r = await result(id)
    const skip = new Set([flaggedLeaf, ...checkedLeaves])
    expect(paid(r, skip)).toBeLessThan(paid(r, new Set([flaggedLeaf])))
    expect(paid(r, skip)).toBeLessThan(paid(r, new Set(checkedLeaves)))
    expect(t.reward.calls[0]).toMatchObject({ coins: paid(r, skip), points: paid(r, skip) * 10 })
  })
})

describe('the result coins/points are the credited amount (FR-PA-16)', () => {
  it('a partly revealed Latihan sitting: result.coins/points equal the reward credit and the stored columns', async () => {
    await setRate(3)
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    const qs = await questions(id)
    for (const q of qs.slice(0, 2)) expect((await check(id, q, [change(q, { choice: correctChoice(q) })])).status).toBe(200)
    expect((await submit(id, allCorrect(qs))).status).toBe(200)
    const unrevealed = qs.length - 2
    const call = t.reward.calls[0]!
    expect(call).toMatchObject({ attemptId: id, coins: unrevealed * 3, points: unrevealed * 10 })
    const r = await result(id)
    expect(r.score).toBe(qs.length) // the full score is still shown; only the pay figures drop
    expect([r.coins, r.points]).toEqual([call.coins, call.points])
    const row = (await t.db.query<{ coins: number; points: number }>('select coins, points from attempt_results where attempt_id = $1', [id]))[0]!
    expect([Number(row.coins), Number(row.points)]).toEqual([call.coins, call.points])
  })

  it('every question revealed: the result shows 0 coins and 0 points', async () => {
    const id = await startAttempt(me, PAPER.matK1, 'latihan')
    const qs = await questions(id)
    for (const q of qs) await check(id, q, [change(q, { choice: correctChoice(q) })])
    expect((await submit(id, allCorrect(qs))).status).toBe(200)
    const r = await result(id)
    expect([r.coins, r.points]).toEqual([0, 0])
  })

  it('an exam result is unchanged: score x rate and score x 10', async () => {
    await setRate(2)
    const id = await startAttempt(me, PAPER.matK1, 'exam')
    const qs = await questions(id)
    expect((await submit(id, allCorrect(qs))).status).toBe(200)
    const r = await result(id)
    expect([r.coins, r.points]).toEqual([qs.length * 2, qs.length * 10])
  })
})

describe('the rate is read at the time of each close or self-mark', () => {
  it('a rate changed between the close and a self-mark: the close pays the old rate, the self-mark carries the new one', async () => {
    await setRate(1)
    const id = await startAttempt(me, PAPER.sainsK2, 'exam', true)
    expect((await submit(id, [change('sn2-sel-q2-b', { text: 'bahan terlarut dalam sel itu' })])).status).toBe(200)
    const closed = t.reward.calls.at(-1)!
    expect(closed.coins).toBe(closed.score * 1)
    await setRate(3)
    const res = await me.post(`/api/bijak/attempts/${id}/self-mark`, { partId: 'sn2-sel-q2-b', mark: 2 })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(t.reward.selfMarkCalls.map((c) => c.coinRate)).toEqual([3])
  })
})

describe('the Syiling rate comes from coinsPerCorrect()', () => {
  it('a reward_settings row with rate 3 gives 3 Syiling per mark in exam and in Latihan; XP stays 10 per mark', async () => {
    await setRate(3)
    const ex = await startAttempt(me, PAPER.matK1, 'exam')
    const qs = await questions(ex)
    expect((await submit(ex, allCorrect(qs))).status).toBe(200)
    expect(t.reward.calls.at(-1)).toMatchObject({ attemptId: ex, coins: qs.length * 3, points: qs.length * 10 })
    expect((await result(ex)).coins).toBe(qs.length * 3)
    const lat = await startAttempt(me, PAPER.matK1, 'latihan')
    expect((await submit(lat, allCorrect(await questions(lat)))).status).toBe(200)
    expect(t.reward.calls.at(-1)).toMatchObject({ attemptId: lat, coins: qs.length * 3, points: qs.length * 10 })
  })

  it('a row at rate 1 and no row at all both give 1 per mark', async () => {
    const qsOf = async (mode: 'exam' | 'latihan') => {
      const id = await startAttempt(me, PAPER.matK1, mode)
      const qs = await questions(id)
      expect((await submit(id, allCorrect(qs))).status).toBe(200)
      return { qs, call: t.reward.calls.at(-1)! }
    }
    await setRate(1)
    const a = await qsOf('exam')
    expect(a.call.coins).toBe(a.qs.length)
    await setRate(null)
    const b = await qsOf('exam')
    expect(b.call.coins).toBe(b.qs.length)
  })
})

describe('a stored result with NULL coins and points columns', () => {
  it('shows 0 coins (no invented pay figure) and points = score x 10', async () => {
    await setRate(3)
    const id = await startAttempt(me, PAPER.matK1, 'exam')
    const qs = await questions(id)
    expect((await submit(id, allCorrect(qs))).status).toBe(200)
    await t.db.query('update attempt_results set coins = null, points = null where attempt_id = $1', [id])
    const r = await result(id)
    expect(r.coins).toBe(0)
    expect(r.points).toBe(r.score * 10)
  })
})
