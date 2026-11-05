import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { BATTLE_RULES, BattleAnswerResultSchema, BattleArenaViewSchema, ErrorBodySchema, battleArenaPoints } from '@pp/contract'

import { ArenaService } from '../../src/modules/battle/arena/arena.service'
import { BattleEngine } from '../../src/modules/battle/engine'
import { StandingsService } from '../../src/modules/battle/standings/standings.service'
import { botAnswer, botAnswers } from '../../src/modules/battle/engine'
import { addMcqs, bootBattleApp, botBattle, client, humanBattle, nextRound, parseData, roundOf, setSetting, STUDENT_G10, STUDENT_G10_B, STUDENT_G11, subjectsOf, type BattleTestApp, type Client, type Subjects } from './arena-helpers'

const FORBIDDEN_KEYS = new Set(['correct', 'correctOptionId', 'isCorrect', 'answer', 'correctAnswer', 'key', 'explanation'])

/** Keys of the arena flow that would reveal the answer key (walks the whole body). */
function leakedKeys(value: unknown, found: string[] = []): string[] {
  if (Array.isArray(value)) value.forEach((v) => leakedKeys(v, found))
  else if (typeof value === 'object' && value !== null) {
    for (const [k, v] of Object.entries(value)) {
      if (FORBIDDEN_KEYS.has(k)) found.push(k)
      leakedKeys(v, found)
    }
  }
  return found
}

describe('arena (M16-16, M16-17)', () => {
  let t: BattleTestApp
  let s: Subjects
  let a: Client
  let b: Client
  let c: Client
  const rows = <T extends Record<string, unknown>>(sql: string, params: unknown[] = []) => t.db.query<T>(sql, params)
  const setAccuracy = (p: number) => {
    vi.spyOn(t.get(BattleEngine), 'botAccuracy').mockResolvedValue(p)
  }
  const view = async (who: Client, uuid: string) => who.get(`/battle/arena/${uuid}`)
  const questionOf = async (who: Client, uuid: string): Promise<string> => parseData(BattleArenaViewSchema, await view(who, uuid)).question?.id as string
  const answer = (who: Client, uuid: string, body: object) => who.post(`/battle/arena/${uuid}/answer`, body)
  /**
   * One answer per entry of `plan`, each at the start of its round (the client's `seconds` is what scores); after each answer the
   * clock waits for the robot and the reveal like a client (`nextRound`), so the next entry is the next round.
   */
  const play = async (who: Client, uuid: string, plan: { option: number | null; seconds: number }[]) => {
    const out: ReturnType<typeof BattleAnswerResultSchema.parse>[] = []
    for (const p of plan) {
      const round = (await roundOf(t, uuid)).answered + 1
      const res = await answer(who, uuid, { questionId: await questionOf(who, uuid), optionId: p.option, seconds: p.seconds })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      out.push(parseData(BattleAnswerResultSchema, res))
      await nextRound(t, who, uuid, round)
    }
    return out
  }
  /** The finished arena of a game `play` ran to its end. */
  const finalView = async (who: Client, uuid: string) => parseData(BattleArenaViewSchema, await view(who, uuid))
  const ten = (option: number | null, seconds: number) => Array.from({ length: 10 }, () => ({ option, seconds }))

  beforeAll(async () => {
    t = await bootBattleApp()
    s = await subjectsOf(t)
    await addMcqs(t, s.math, s.t4, 24)
    ;[a, b, c] = [await client(t, STUDENT_G10), await client(t, STUDENT_G10_B), await client(t, STUDENT_G11)]
  }, 180_000)
  afterAll(async () => t.close())

  describe('view (AC 11, 15)', () => {
    it('shows the caller\'s next keyless question, four options, secondsLeft 15 and no result while active', async () => {
      setAccuracy(0)
      const uuid = await botBattle(a, s.math)
      const res = await view(a, uuid)
      expect(res.status).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      const v = parseData(BattleArenaViewSchema, res)
      expect(v).toMatchObject({ uuid, status: 'active', you: 'A', index: 1, total: 10, secondsLeft: 15, scores: { A: 0, B: 0 }, phase: 'answering' })
      expect(v.reveal).toBeUndefined()
      expect(new Date(v.roundEndsAt as string).getTime()).toBe(t.clock.now().getTime() + 18_000) // N 15 + grace 3
      expect(v.result).toBeUndefined()
      expect(v.question?.options.map((o) => [o.id, o.label])).toEqual([[0, 'A'], [1, 'B'], [2, 'C'], [3, 'D']])
      expect(v.players.A).toEqual({ name: 'Murid Demo', school: '', isBot: false }) // FR-GM-00.8: own name in full, no school
      expect(v.players.B).toEqual({ name: 'Robot PrestasiPlus', school: '', isBot: true }) // FR-MUR-21-9
      expect(leakedKeys(res.body)).toEqual([])
      const [first] = await rows<{ question_id: string }>(`select question_id::text from battle_questions where battle_id = $1 and position = 1`, [uuid])
      expect(v.question?.id).toBe(first?.question_id)
    })

    it('only the two players see a battle; anyone else (and unknown or malformed ids) gets 404 NOT_FOUND "Battle tidak dijumpai."', async () => {
      const uuid = await botBattle(a, s.math)
      for (const id of [uuid, '00000000-0000-4000-8000-000000000000', 'abc', "x' or 1=1"]) {
        const who = id === uuid ? b : a
        const res = await view(who, encodeURIComponent(id))
        expect(res.status, id).toBe(404)
        const body = ErrorBodySchema.parse(res.body)
        expect(body.error).toMatchObject({ code: 'NOT_FOUND', message: 'Battle tidak dijumpai.' })
        const post = await answer(who, encodeURIComponent(id), { questionId: '1', optionId: 1, seconds: 1 })
        expect(post.status).toBe(404)
        expect(ErrorBodySchema.parse(post.body).error.message).toBe('Battle tidak dijumpai.')
      }
    })
  })

  describe('view when the round clock fails', () => {
    it('an advance error is logged and the view is still answered (a GET never 500s on it)', async () => {
      setAccuracy(0)
      const uuid = await botBattle(a, s.math)
      const arena = t.get(ArenaService) as unknown as { advance: (...args: unknown[]) => Promise<number> }
      const spy = vi.spyOn(arena, 'advance').mockRejectedValue(new Error('clock down'))
      try {
        const res = await view(a, uuid)
        expect(res.status, JSON.stringify(res.body)).toBe(200)
        expect(parseData(BattleArenaViewSchema, res).status).toBe('active')
        expect(spy).toHaveBeenCalledTimes(1)
      } finally {
        spy.mockRestore()
      }
    })
  })

  describe('shared rounds (FR-GM-01.3, FR-GM-01.4; AC-GM-01.1, AC-GM-01.2)', () => {
    // The sweep and the polls move every active battle of the database; battles other tests left open are put away so they cannot reach the standings.
    beforeEach(() => rows(`update battles set status = 'abandoned', finished_at = created_at where status = 'active'`))
    const arenaOf = async (who: Client, uuid: string) => parseData(BattleArenaViewSchema, await view(who, uuid))
    /** Both pupils answer the round on screen (A, then B), each with its own option and claim. */
    const bothAnswer = async (uuid: string, plan: { a: [number | null, number]; b: [number | null, number] }) => {
      const qa = await questionOf(a, uuid)
      const qb = await questionOf(b, uuid)
      expect(qb).toBe(qa) // the same question for both
      const ra = await answer(a, uuid, { questionId: qa, optionId: plan.a[0], seconds: plan.a[1] })
      expect(ra.status, JSON.stringify(ra.body)).toBe(200)
      const rb = await answer(b, uuid, { questionId: qb, optionId: plan.b[0], seconds: plan.b[1] })
      expect(rb.status, JSON.stringify(rb.body)).toBe(200)
      return [parseData(BattleAnswerResultSchema, ra), parseData(BattleAnswerResultSchema, rb)] as const
    }
    const standingOf = async (who: Client): Promise<number> => {
      t.get(StandingsService).cacheTtlSeconds = 0 // the national aggregation is cached for 30 s of the clock by default
      const res = await who.get('/battle/standings/students?period=monthly')
      expect(res.status).toBe(200)
      const mine = (res.body.data as { userId: string | null; name: string; menang: number; seri: number; kalah: number }[]).find((r) => r.userId === who.id)
      return mine ? mine.menang + mine.seri + mine.kalah : 0
    }

    it('both humans see the same index and question; a round closes when both have answered, then 3 s of reveal, then the next round', async () => {
      const uuid = await humanBattle(a, b, s.math)
      const [va, vb] = [await arenaOf(a, uuid), await arenaOf(b, uuid)]
      expect([va.index, vb.index, va.total, vb.total]).toEqual([1, 1, 10, 10])
      expect(va.question?.id).toBe(vb.question?.id)
      expect(va.roundEndsAt).toBe(vb.roundEndsAt)
      t.clock.advance(4_000)
      const a1 = parseData(BattleAnswerResultSchema, await answer(a, uuid, { questionId: va.question?.id, optionId: 1, seconds: 0 }))
      expect(a1).toMatchObject({ points: battleArenaPoints(4), opponent: { answered: false } })
      // A is waiting for B: still round 1 for both, A's score not counted yet, the key not shown in the view
      expect(await arenaOf(b, uuid)).toMatchObject({ index: 1, phase: 'answering', scores: { A: 0, B: 0 } })
      expect(await roundOf(t, uuid)).toMatchObject({ answered: 0 })
      t.clock.advance(1_000)
      const b1 = parseData(BattleAnswerResultSchema, await answer(b, uuid, { questionId: vb.question?.id, optionId: 0, seconds: 0 }))
      expect(b1).toMatchObject({ correct: false, points: 0, opponent: { answered: true, correct: true, score: battleArenaPoints(4) }, you: { score: 0 } })
      // closed at B's answer: both are in the reveal of round 1 for 3 s
      const closedAt = t.clock.now().getTime()
      expect(await roundOf(t, uuid)).toMatchObject({ answered: 1, status: 'active' })
      for (const who of [a, b]) {
        const v = await arenaOf(who, uuid)
        expect(v).toMatchObject({ phase: 'reveal', index: 1, secondsLeft: 0, scores: { A: battleArenaPoints(4), B: 0 } })
        expect(new Date(v.roundEndsAt as string).getTime()).toBe(closedAt + 3_000)
        expect(v.reveal).toEqual({
          index: 1,
          correctOptionId: 1,
          you: who === a ? { optionId: 1, correct: true, points: battleArenaPoints(4) } : { optionId: 0, correct: false, points: 0 },
          opponent: who === a ? { optionId: 0, correct: false, points: 0 } : { optionId: 1, correct: true, points: battleArenaPoints(4) },
        })
      }
      // no answer during the reveal: the next question is not open
      const [second] = await rows<{ question_id: string }>(`select question_id::text from battle_questions where battle_id = $1 and position = 2`, [uuid])
      const early = await answer(a, uuid, { questionId: second?.question_id, optionId: 1, seconds: 0 })
      expect(early.status).toBe(422)
      t.clock.advance(2_999)
      expect(await arenaOf(a, uuid)).toMatchObject({ phase: 'reveal', index: 1 })
      t.clock.advance(1)
      const [na, nb] = [await arenaOf(a, uuid), await arenaOf(b, uuid)]
      expect([na.phase, na.index, nb.phase, nb.index]).toEqual(['answering', 2, 'answering', 2])
      expect(na.question?.id).toBe(second?.question_id)
      expect(nb.question?.id).toBe(second?.question_id)
      expect(na.secondsLeft).toBe(15)
      expect(new Date(na.roundEndsAt as string).getTime()).toBe(t.clock.now().getTime() + 18_000)
    })

    it('a round closes at N + grace when a pupil has not answered: a timeout for that seat only, stamped at the end of the window', async () => {
      const uuid = await humanBattle(a, b, s.math)
      const start = (await roundOf(t, uuid)).startedAt
      const q = await questionOf(a, uuid)
      t.clock.advance(2_000)
      await answer(a, uuid, { questionId: q, optionId: 1, seconds: 0 })
      t.clock.advance(16_000) // exactly 18 s after the start: still open
      expect(await arenaOf(b, uuid)).toMatchObject({ phase: 'answering', index: 1, secondsLeft: 0 })
      expect(await roundOf(t, uuid)).toMatchObject({ answered: 0 })
      t.clock.advance(1)
      expect(await arenaOf(b, uuid)).toMatchObject({ phase: 'reveal', index: 1 })
      expect(await roundOf(t, uuid)).toMatchObject({ answered: 1 })
      const stored = await rows<{ user_id: string; option_id: number | null; points: number; seconds: number; created_at: Date }>(
        `select user_id::text, option_id, points, seconds, created_at from battle_answers where battle_id = $1 order by user_id`,
        [uuid],
      )
      const timeout = stored.find((r) => r.user_id === b.id)
      expect(timeout).toMatchObject({ option_id: null, points: 0, seconds: 15 })
      expect(timeout?.created_at.toISOString()).toBe(new Date(start.getTime() + 18_000).toISOString())
      expect(stored.find((r) => r.user_id === a.id)?.points).toBe(battleArenaPoints(2))
      // the next round opens 3 s after the window ended
      expect((await roundOf(t, uuid)).startedAt.toISOString()).toBe(new Date(start.getTime() + 21_000).toISOString())
      // B's late answer after the window is refused as a replay: its timeout is already stored
      expect((await answer(b, uuid, { questionId: q, optionId: 1, seconds: 0 })).status).toBe(422)
    })

    it('AC-GM-01.1, AC-GM-01.2: points use N and grace from the settings; inside the grace window s = N, after it a timeout', async () => {
      await setSetting(t, 'battle_question_seconds', 10)
      await setSetting(t, 'battle_grace_seconds', 2)
      try {
        const uuid = await humanBattle(a, b, s.math)
        const v = await arenaOf(a, uuid)
        expect(v).toMatchObject({ secondsLeft: 10 })
        expect(new Date(v.roundEndsAt as string).getTime()).toBe(t.clock.now().getTime() + 12_000)
        // 4.9 s with N = 10: s = 4, 1000 - round(500 x 4 / 10) = 800
        t.clock.advance(4_900)
        expect(parseData(BattleAnswerResultSchema, await answer(a, uuid, { questionId: v.question?.id, optionId: 1, seconds: 0 })).points).toBe(800)
        expect(await arenaOf(a, uuid)).toMatchObject({ secondsLeft: 6 })
        // 11 s: inside the grace window, 500 points
        t.clock.advance(6_100)
        expect(parseData(BattleAnswerResultSchema, await answer(b, uuid, { questionId: v.question?.id, optionId: 1, seconds: 0 })).points).toBe(500)
        t.clock.advance(3_000)
        const second = await arenaOf(a, uuid)
        expect(second).toMatchObject({ index: 2, scores: { A: 800, B: 500 } })
        // 12.5 s: a timeout with 0 points (the seconds claim above N is refused)
        t.clock.advance(12_500)
        const late = await answer(b, uuid, { questionId: second.question?.id, optionId: 1, seconds: 10.5 })
        expect(late.status).toBe(422)
        expect(ErrorBodySchema.parse(late.body).error.fields).toEqual({ seconds: 'Masa tidak sah.' })
        const lateOk = parseData(BattleAnswerResultSchema, await answer(b, uuid, { questionId: second.question?.id, optionId: 1, seconds: 0 }))
        expect(lateOk).toMatchObject({ correct: false, points: 0 })
        expect(battleArenaPoints(18.5, 15, 3)).toBe(0)
      } finally {
        await setSetting(t, 'battle_question_seconds', 15)
        await setSetting(t, 'battle_grace_seconds', 3)
      }
    })

    it.each([5, 15, 20])('a %i-question battle runs to its count: total and index match it', async (count) => {
      const uuid = await humanBattle(a, b, s.math, { question_count: count })
      expect(await arenaOf(a, uuid)).toMatchObject({ index: 1, total: count })
      for (let round = 1; round <= count; round++) {
        const v = await arenaOf(a, uuid)
        expect([v.index, v.total]).toEqual([round, count])
        expect((await arenaOf(b, uuid)).index).toBe(round)
        await bothAnswer(uuid, { a: [1, 1], b: [1, 2] })
        if (round < count) t.clock.advance(3_000)
      }
      const [da, db] = [await arenaOf(a, uuid), await arenaOf(b, uuid)]
      expect(da).toMatchObject({ status: 'finished', phase: 'finished', index: count, total: count, result: { winner: 'A' } })
      expect(db).toMatchObject({ status: 'finished', index: count, total: count, result: { winner: 'A' } })
      expect(await roundOf(t, uuid)).toMatchObject({ answered: count, questionCount: count })
      expect((await rows(`select 1 from battle_answers where battle_id = $1`, [uuid])).length).toBe(2 * count)
    })

    it('human-vs-human completion: both humans answer every round and both get reward and answer-port rows once (GAME-R); it counts for standings', async () => {
      const [beforeA, beforeB] = [await standingOf(a), await standingOf(b)]
      const uuid = await humanBattle(a, b, s.math)
      const reportsBefore = t.reports.length
      let last: readonly [ReturnType<typeof BattleAnswerResultSchema.parse>, ReturnType<typeof BattleAnswerResultSchema.parse>] | null = null
      for (let round = 1; round <= 10; round++) {
        last = await bothAnswer(uuid, { a: [1, 2], b: [1, 5] })
        if (round < 10) t.clock.advance(3_000)
      }
      // the last answer of the last round finishes the battle once, in the same transaction
      expect(last?.[0].result).toBeUndefined() // A answered first; the round was still open
      expect(last?.[1].result).toMatchObject({ winner: 'A', scoreA: 10 * battleArenaPoints(2), scoreB: 10 * battleArenaPoints(5) })
      const [row] = await rows<{ status: string; winner: string; answered: number; counts_for_ranking: boolean }>(`select status, winner, answered, counts_for_ranking from battles where id = $1`, [uuid])
      expect(row).toEqual({ status: 'finished', winner: 'A', answered: 10, counts_for_ranking: true })
      // each pupil's rows: 10 battle answers, no simulated row for a human, 10 answer-port rows of mode battle
      const stored = await rows<{ user_id: string | null; n: string }>(`select user_id::text, count(*)::text n from battle_answers where battle_id = $1 group by user_id`, [uuid])
      expect(stored.map((r) => [r.user_id, r.n]).sort()).toEqual([[a.id, '10'], [b.id, '10']].sort())
      const port = await rows<{ user_id: string; part_ref: string; mode: string; is_correct: boolean }>(`select user_id::text, part_ref, mode, is_correct from practice_answers where attempt_id = $1::uuid order by user_id, id`, [uuid])
      expect(port).toHaveLength(20)
      for (const who of [a, b]) {
        const mine = port.filter((r) => r.user_id === who.id)
        expect(mine.map((r) => r.part_ref)).toEqual(Array.from({ length: 10 }, (_, i) => `battle#${i + 1}`))
        expect(mine.every((r) => r.mode === 'battle' && r.is_correct)).toBe(true)
      }
      // one reward each, keyed by the battle: the win for A, the play for B
      const mine = t.reports.slice(reportsBefore).filter((r) => r.session === uuid)
      expect(mine.map((r) => [r.userId, r.event, r.correct, r.total]).sort()).toEqual([[a.id, 'win', 10, 10], [b.id, 'finish', 10, 10]].sort())
      // reading the arena again, or polling, never rewards a second time
      await arenaOf(a, uuid)
      await arenaOf(b, uuid)
      await t.get(ArenaService).sweepClocks()
      expect(t.reports.slice(reportsBefore).filter((r) => r.session === uuid)).toHaveLength(2)
      expect((await arenaOf(a, uuid)).result?.reward).toBeDefined()
      expect((await arenaOf(b, uuid)).result?.reward).toBeDefined()
      // a real battle counts for both standings rows
      expect(await standingOf(a)).toBe(beforeA + 1)
      expect(await standingOf(b)).toBe(beforeB + 1)
    })

    it('a robot battle writes no robot answer-port row, is not ranked and does not move the standings', async () => {
      setAccuracy(1)
      const before = await standingOf(a)
      const uuid = await botBattle(a, s.math)
      await play(a, uuid, ten(1, 1))
      const [row] = await rows<{ counts_for_ranking: boolean; status: string }>(`select counts_for_ranking, status from battles where id = $1`, [uuid])
      expect(row).toEqual({ counts_for_ranking: false, status: 'finished' })
      expect((await rows<{ n: string }>(`select count(*)::text n from battle_answers where battle_id = $1 and user_id is null`, [uuid]))[0]?.n).toBe('10')
      const port = await rows<{ user_id: string }>(`select user_id::text from practice_answers where attempt_id = $1::uuid`, [uuid])
      expect(port).toHaveLength(10)
      expect(new Set(port.map((r) => r.user_id))).toEqual(new Set([a.id]))
      expect(await standingOf(a)).toBe(before)
      setAccuracy(0)
    })

    it('the poll, a second poll and the sweep advance a round exactly once, however they interleave', async () => {
      const uuid = await humanBattle(a, b, s.math)
      const arena = t.get(ArenaService)
      t.clock.advance(18_001)
      const settled = await Promise.all([view(a, uuid), view(b, uuid), view(a, uuid), view(b, uuid), arena.sweepClocks(), arena.sweepClocks(), arena.advance(uuid)])
      expect(settled.slice(0, 4).every((r) => (r as { status: number }).status === 200)).toBe(true)
      expect(await roundOf(t, uuid)).toMatchObject({ answered: 1, status: 'active' })
      expect((await rows<{ n: string }>(`select count(*)::text n from battle_answers where battle_id = $1`, [uuid]))[0]?.n).toBe('2') // one timeout per seat, no more
      expect((await rows<{ n: string }>(`select count(*)::text n from practice_answers where attempt_id = $1::uuid`, [uuid]))[0]?.n).toBe('2')
      // once more, closed already: nothing changes
      await Promise.all([view(a, uuid), arena.sweepClocks()])
      expect(await roundOf(t, uuid)).toMatchObject({ answered: 1 })
      expect((await rows<{ n: string }>(`select count(*)::text n from battle_answers where battle_id = $1`, [uuid]))[0]?.n).toBe('2')
    })

    it('an answer and a poll at the same moment store the answer once and close the round once', async () => {
      const uuid = await humanBattle(a, b, s.math)
      const q = await questionOf(a, uuid)
      t.clock.advance(1_000)
      const [ra, rb, , ] = await Promise.all([
        answer(a, uuid, { questionId: q, optionId: 1, seconds: 0 }),
        answer(b, uuid, { questionId: q, optionId: 1, seconds: 0 }),
        view(a, uuid),
        view(b, uuid),
      ])
      expect([ra.status, rb.status]).toEqual([200, 200])
      expect(await roundOf(t, uuid)).toMatchObject({ answered: 1 })
      const parts = await rows<{ score: number }>(`select score from battle_participants where battle_id = $1`, [uuid])
      expect(parts.map((r) => r.score)).toEqual([battleArenaPoints(1), battleArenaPoints(1)])
    })
  })

  describe('answer (AC 11)', () => {
    it('scores on the server: 1000 - round(500 s / 15), wrong and timeout 0, ten rounds end the battle', async () => {
      setAccuracy(0)
      const uuid = await botBattle(a, s.math)
      const plan = [
        { option: 1, seconds: 0 },
        { option: 1, seconds: 15 },
        { option: 1, seconds: 7.9 },
        { option: 0, seconds: 1 },
        { option: null, seconds: 3 },
        { option: 1, seconds: 14.99 },
        { option: 3, seconds: 0 },
        { option: 1, seconds: 3 },
        { option: 1, seconds: 10 },
        { option: 1, seconds: 1 },
      ]
      const results = await play(a, uuid, plan)
      const expected = plan.map((p) => (p.option === 1 ? battleArenaPoints(p.seconds) : 0))
      expect(results.map((r) => r.points)).toEqual(expected)
      expect(results.map((r) => r.correct)).toEqual(plan.map((p) => p.option === 1))
      expect(results.every((r) => r.correctOptionId === 1)).toBe(true)
      expect(results.map((r) => r.points).slice(0, 3)).toEqual([1000, 500, 767])
      const total = expected.reduce((x, y) => x + y, 0)
      // the pupil answers at the start of the round, before the robot: the round is still open, no `next` (the next question comes with the view), and the last answer has no result yet
      expect(results.every((r) => r.next === undefined && r.result === undefined && r.opponent.answered === false)).toBe(true)
      expect(results.at(-1)?.you.score).toBe(total)

      const [battle] = await rows<{ status: string; winner: string; answered: number; finished_at: Date }>(`select status, winner, answered, finished_at from battles where id = $1`, [uuid])
      expect(battle).toMatchObject({ status: 'finished', winner: 'A', answered: 10 })
      expect(battle?.finished_at.toISOString()).toBe(t.clock.now().toISOString())
      const parts = await rows<{ side: string; score: number; correct: number }>(`select side, score, correct from battle_participants where battle_id = $1 order by side`, [uuid])
      expect(parts).toEqual([{ side: 'A', score: total, correct: plan.filter((p) => p.option === 1).length }, { side: 'B', score: 0, correct: 0 }])
      const stored = await rows<{ position: number; option_id: number | null; seconds: number; points: number }>(`select position, option_id, seconds, points from battle_answers where battle_id = $1 and user_id = $2 order by position`, [uuid, a.id])
      expect(stored.map((r) => r.points)).toEqual(expected)
      expect(stored.map((r) => r.seconds)).toEqual(plan.map((p) => Math.floor(p.seconds)))
      expect(stored[4]?.option_id).toBeNull()

      // the finished arena shows the result, the last round's reveal and no question
      const done = await finalView(a, uuid)
      expect(done).toMatchObject({ status: 'finished', phase: 'finished', question: null, secondsLeft: 0, index: 10, total: 10, result: { winner: 'A', scoreA: total, scoreB: 0 } })
      expect(done.reveal).toMatchObject({ index: 10, correctOptionId: 1, you: { optionId: 1, correct: true, points: expected[9] }, opponent: { correct: false, points: 0 } })
      // FR-GM-00.3, 48 section 3.4 rule 3: against the robot 7 x 10 + the play XP, no win XP and no win bonus
      expect(t.reports.at(-1)).toEqual({ userId: a.id, game: 'battle', event: 'win', coins: 7, xp: 75, correct: 7, total: 10, session: uuid })
    })

    it('time is the server\'s: the client cannot answer faster than the clock (every round from its own start); a late answer is a timeout stamped at the end of the window', async () => {
      setAccuracy(0)
      const uuid = await botBattle(a, s.math)
      const roundNo = async () => (await roundOf(t, uuid)).answered + 1
      t.clock.advance(8_000)
      const r1 = await answer(a, uuid, { questionId: await questionOf(a, uuid), optionId: 1, seconds: 0 })
      expect(parseData(BattleAnswerResultSchema, r1).points).toBe(battleArenaPoints(8))
      await nextRound(t, a, uuid, 1)
      // a slower client claim is kept; the round clock restarted with the round, not with the previous answer
      t.clock.advance(2_000)
      const r2 = await answer(a, uuid, { questionId: await questionOf(a, uuid), optionId: 1, seconds: 6 })
      expect(parseData(BattleAnswerResultSchema, r2).points).toBe(battleArenaPoints(6))
      await nextRound(t, a, uuid, 2)
      // exactly 18 s is still an answer (15 + 3 s grace), clamped to 15
      t.clock.advance(18_000)
      const r3 = await answer(a, uuid, { questionId: await questionOf(a, uuid), optionId: 1, seconds: 0 })
      expect(parseData(BattleAnswerResultSchema, r3).points).toBe(battleArenaPoints(15))
      await nextRound(t, a, uuid, 3)
      // 19 s: a timeout, still stored, the round closes; the next one opens 3 s after the window ended
      const fourth = await questionOf(a, uuid)
      const fourthStart = (await roundOf(t, uuid)).startedAt
      expect(await roundNo()).toBe(4)
      t.clock.advance(19_000)
      const r4 = await answer(a, uuid, { questionId: fourth, optionId: 1, seconds: 0 })
      expect(parseData(BattleAnswerResultSchema, r4)).toMatchObject({ correct: false, points: 0, correctOptionId: 1 })
      const stored = await rows<{ seconds: number; points: number; option_id: number | null; created_at: Date }>(`select seconds, points, option_id, created_at from battle_answers where battle_id = $1 and user_id = $2 order by position`, [uuid, a.id])
      expect(stored.map((r) => r.seconds)).toEqual([8, 6, 15, 15])
      expect(stored[3]).toMatchObject({ points: 0, option_id: null })
      expect(stored[3]?.created_at.toISOString()).toBe(new Date(fourthStart.getTime() + 18_000).toISOString())
      // 19 s into round 4 the reveal of round 4 is on (it ends 21 s after that round opened), then round 5
      const revealing = await finalView(a, uuid)
      expect(revealing).toMatchObject({ phase: 'reveal', index: 4, secondsLeft: 0 })
      expect(revealing.reveal).toMatchObject({ index: 4, correctOptionId: 1, you: { optionId: null, correct: false, points: 0 } })
      t.clock.advance(2_000)
      expect(await finalView(a, uuid)).toMatchObject({ phase: 'answering', index: 5 })
    })

    it('an omitted optionId is a timeout', async () => {
      const uuid = await botBattle(a, s.math)
      const res = await answer(a, uuid, { questionId: await questionOf(a, uuid), seconds: 15 })
      expect(res.status).toBe(200)
      expect(parseData(BattleAnswerResultSchema, res)).toMatchObject({ correct: false, points: 0, correctOptionId: 1 })
    })

    it('winner rules: 0-0 is a draw (AC-GM-01.3), a higher total wins, equal non-zero totals are a draw (null)', async () => {
      // 0-0: nobody scores
      setAccuracy(0)
      const zero = await botBattle(a, s.math)
      await play(a, zero, ten(0, 5))
      // AC-GM-01.3: DV-M16-35 (0-0 goes to B) is replaced; equal totals, 0-0 included, are a draw
      expect((await finalView(a, zero)).result).toMatchObject({ winner: null, scoreA: 0, scoreB: 0 })
      expect(t.reports.at(-1)).toMatchObject({ event: 'finish', correct: 0 })
      // B wins: the bot answers right, the pupil wrong
      setAccuracy(1)
      const lose = await botBattle(a, s.math)
      await play(a, lose, ten(0, 5))
      const lost = (await finalView(a, lose)).result
      expect(lost?.winner).toBe('B')
      expect(lost?.scoreA).toBe(0)
      expect(lost?.scoreB).toBeGreaterThan(0)
      // draw: right answers at exactly the bot's seconds
      const draw = await botBattle(a, s.math)
      const bot = botAnswers(draw, 1)
      await play(a, draw, bot.map((x) => ({ option: 1, seconds: x.seconds })))
      const drawn = (await finalView(a, draw)).result
      expect(drawn?.winner).toBeNull()
      expect(drawn?.scoreA).toBe(drawn?.scoreB)
      expect(drawn?.scoreA).toBeGreaterThan(0)
      const [row] = await rows<{ winner: string | null; status: string }>(`select winner, status from battles where id = $1`, [draw])
      expect(row).toEqual({ winner: null, status: 'finished' })
      expect(t.reports.at(-1)).toMatchObject({ event: 'finish', correct: 10 })
      setAccuracy(0)
    })

    it('the bot\'s answers come from the stream m16:battle:<battleUuid>, one round at a time, and are returned as `opponent` once the round has both', async () => {
      setAccuracy(1)
      const uuid = await botBattle(a, s.math)
      const bot = botAnswers(uuid, 1)
      expect(botAnswers(uuid, 1)).toEqual(bot)
      bot.forEach((x, i) => expect(botAnswer(uuid, i + 1, 1)).toEqual(x)) // per round, the same stream
      expect(bot.every((x) => x.seconds >= 2 && x.seconds <= 12 && x.correct)).toBe(true)
      // the pupil answers after the robot's time: the answer closes the round and carries the opponent's
      t.clock.advance(12_000)
      const first = await answer(a, uuid, { questionId: await questionOf(a, uuid), optionId: 1, seconds: 0 })
      expect(parseData(BattleAnswerResultSchema, first).opponent).toEqual({ answered: true, correct: true, score: bot[0]?.points })
      await nextRound(t, a, uuid, 1)
      // before the robot's time the opponent has not answered, and says nothing about it
      const second = await answer(a, uuid, { questionId: await questionOf(a, uuid), optionId: 1, seconds: 0 })
      expect(parseData(BattleAnswerResultSchema, second).opponent).toEqual({ answered: false })
      await nextRound(t, a, uuid, 2)
      await play(a, uuid, ten(1, 9).slice(2))
      const stored = await rows<{ position: number; seconds: number; correct: boolean; points: number }>(
        `select position, seconds, correct, points from battle_answers where battle_id = $1 and user_id is null order by position`,
        [uuid],
      )
      expect(stored.map((r) => [r.seconds, r.correct, r.points])).toEqual(bot.map((x) => [x.seconds, x.correct, x.points]))
      expect((await finalView(a, uuid)).scores.B).toBe(bot.reduce((sum, x) => sum + x.points, 0))
      setAccuracy(0)
    })

    it('validation: questionId must be the caller\'s next question; optionId 0..3 or null; seconds 0..15 (field messages)', async () => {
      const uuid = await botBattle(a, s.math)
      const next = await questionOf(a, uuid)
      const [second] = await rows<{ question_id: string }>(`select question_id::text from battle_questions where battle_id = $1 and position = 2`, [uuid])
      const cases: [object, string, string][] = [
        [{ questionId: second?.question_id, optionId: 1, seconds: 1 }, 'questionId', 'Soalan tidak sah.'],
        [{ optionId: 1, seconds: 1 }, 'questionId', 'Soalan tidak sah.'],
        [{ questionId: Number(next), optionId: 1, seconds: 1 }, 'questionId', 'Soalan tidak sah.'],
        [{ questionId: '0', optionId: 1, seconds: 1 }, 'questionId', 'Soalan tidak sah.'],
        [{ questionId: next, optionId: 4, seconds: 1 }, 'optionId', 'Jawapan tidak sah.'],
        [{ questionId: next, optionId: -1, seconds: 1 }, 'optionId', 'Jawapan tidak sah.'],
        [{ questionId: next, optionId: '1', seconds: 1 }, 'optionId', 'Jawapan tidak sah.'],
        [{ questionId: next, optionId: 1.5, seconds: 1 }, 'optionId', 'Jawapan tidak sah.'],
        [{ questionId: next, optionId: 1, seconds: -1 }, 'seconds', 'Masa tidak sah.'],
        [{ questionId: next, optionId: 1, seconds: 15.01 }, 'seconds', 'Masa tidak sah.'],
        [{ questionId: next, optionId: 1, seconds: '3' }, 'seconds', 'Masa tidak sah.'],
        [{ questionId: next, optionId: 1 }, 'seconds', 'Masa tidak sah.'],
        [{ questionId: next, optionId: 1, seconds: null }, 'seconds', 'Masa tidak sah.'],
      ]
      for (const [body, field, message] of cases) {
        const res = await answer(a, uuid, body)
        expect(res.status, JSON.stringify(body)).toBe(422)
        const err = ErrorBodySchema.parse(res.body).error
        expect(err).toMatchObject({ code: 'VALIDATION_ERROR', message, fields: { [field]: message } })
      }
      expect((await rows(`select 1 from battle_answers where battle_id = $1 and user_id = $2`, [uuid, a.id])).length).toBe(0)
      // an array or text body is just an empty body
      const res = await a.who.agent.post(`/api/battle/arena/${uuid}/answer`).set('X-CSRF-Token', a.who.csrf).send([1, 2])
      expect(res.status).toBe(422)
    })

    it('forged scoring is impossible: extra fields are ignored and the server grades the option', async () => {
      const uuid = await botBattle(a, s.math)
      const res = await answer(a, uuid, { questionId: await questionOf(a, uuid), optionId: 0, seconds: 0, points: 1000, correct: true, correctOptionId: 0, score: 9999, userId: b.id, you: { score: 5000 }, opponent: { score: 0 } })
      expect(res.status).toBe(200)
      expect(parseData(BattleAnswerResultSchema, res)).toMatchObject({ correct: false, points: 0, correctOptionId: 1, you: { score: 0 } })
      const [p] = await rows<{ score: number }>(`select score from battle_participants where battle_id = $1 and side = 'A'`, [uuid])
      expect(p?.score).toBe(0)
      // another user's answers cannot be written either: b is not a player
      expect((await answer(b, uuid, { questionId: '1', optionId: 1, seconds: 0 })).status).toBe(404)
    })

    it('two concurrent identical answers give one success and one stored answer', async () => {
      const uuid = await botBattle(a, s.math)
      const body = { questionId: await questionOf(a, uuid), optionId: 1, seconds: 2 }
      const [r1, r2] = await Promise.all([answer(a, uuid, body), answer(a, uuid, body)])
      expect([r1.status, r2.status].sort()).toEqual([200, 422])
      const failed = r1.status === 200 ? r2 : r1
      expect(ErrorBodySchema.parse(failed.body).error.fields).toEqual({ questionId: 'Soalan tidak sah.' })
      expect((await rows<{ n: string }>(`select count(*)::text n from battle_answers where battle_id = $1 and user_id = $2`, [uuid, a.id]))[0]?.n).toBe('1')
      // the score of a round is added when the round closes (the robot's time), not before
      await nextRound(t, a, uuid, 1)
      const [p] = await rows<{ score: number }>(`select score from battle_participants where battle_id = $1 and side = 'A'`, [uuid])
      expect(p?.score).toBe(battleArenaPoints(2))
    })

    it('after the battle ended an answer is 409 CONFLICT "Battle sudah tamat."', async () => {
      const uuid = await botBattle(a, s.math)
      await play(a, uuid, ten(1, 1))
      const res = await answer(a, uuid, { questionId: '1', optionId: 1, seconds: 1 })
      expect(res.status).toBe(409)
      expect(ErrorBodySchema.parse(res.body).error).toMatchObject({ code: 'CONFLICT', message: 'Battle sudah tamat.' })
    })

    it('no response of the arena flow carries the answer key before the question is answered', async () => {
      const uuid = await botBattle(a, s.math)
      for (let i = 0; i < 10; i++) {
        const v = await view(a, uuid)
        expect(leakedKeys(v.body), `view ${i}`).toEqual([])
        const res = await answer(a, uuid, { questionId: parseData(BattleArenaViewSchema, v).question?.id, optionId: 2, seconds: 4 })
        // the key of the question just answered is the only key allowed, at the top level; there is no `next` and, with the round open, no `result`
        expect(Object.keys(res.body.data).sort()).toEqual(['correct', 'correctOptionId', 'opponent', 'points', 'you'])
        await nextRound(t, a, uuid, i + 1)
      }
      expect(leakedKeys((await view(a, uuid)).body.data.result)).toEqual([])
    })

    it('a battle against another pupil (invitation): both sides see the same round and a score is added when the round closes', async () => {
      const uuid = await humanBattle(a, b, s.math)
      const bView = parseData(BattleArenaViewSchema, await view(b, uuid))
      expect(bView.you).toBe('B')
      expect(bView.players.A.name).toBe('Murid') // FR-GM-00.8: the opponent by first given name
      expect(bView.players.B.name).toBe('Murid Demo Kosong')
      const res = await answer(b, uuid, { questionId: bView.question?.id, optionId: 1, seconds: 0 })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(parseData(BattleAnswerResultSchema, res)).toMatchObject({ points: 1000, you: { score: 1000 }, opponent: { answered: false } })
      // a third pupil is not a player
      expect((await view(c, uuid)).status).toBe(404)
      // the round is still open for A: nothing is added yet, and a human is never simulated
      expect((await rows<{ side: string; score: number }>(`select side, score from battle_participants where battle_id = $1 order by side`, [uuid])).map((r) => r.score)).toEqual([0, 0])
      expect((await rows(`select 1 from battle_answers where battle_id = $1 and user_id = $2`, [uuid, a.id])).length).toBe(0)
    })
  })

  describe('Mod Pelajar (is_test)', () => {
    it('a test battle plays the same and reports nothing (AC-GM-00.12)', async () => {
      setAccuracy(0)
      const admin = await client(t, 'admin@demo.test', { modPelajar: true })
      const uuid = await botBattle(admin, s.math)
      const before = t.reports.length
      await play(admin, uuid, ten(1, 0))
      // a staff account has no grade, so the pool is every level: the seeded questions have other keys than B
      const done = (await finalView(admin, uuid)).result
      expect(done).toMatchObject({ winner: 'A', scoreB: 0 })
      expect(done?.scoreA).toBeGreaterThan(0)
      expect(t.reports.length).toBe(before)
      const [b2] = await rows<{ is_test: boolean }>(`select is_test from battles where id = $1`, [uuid])
      expect(b2?.is_test).toBe(true)
    })
  })

  it('rules constants match the contract', () => {
    expect(BATTLE_RULES.arenaQuestions).toBe(10)
  })
})
