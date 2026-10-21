import { describe, expect, it } from 'vitest'

import { prngStream, type Prng } from '../../../src/db/prng'
import {
  BENTENG_DAMAGE,
  BENTENG_HP,
  BOARD_SIZE,
  CROSSWORD_MS,
  EngineRefusal,
  KR_ROUNDS,
  MATHRACE_STEPS,
  PF_ROUNDS,
  PF_ROUND_MS,
  POOL_SIZE,
  applyAction,
  applyTimeout,
  buildBoard,
  clocksOf,
  computeSettlement,
  questionView,
  resolveClocks,
  startGame,
  stateView,
  type EngineOut,
  type EnginePlayer,
  type EngineRoom,
  type PoolQuestion,
  type RoomAction,
  type RoomState,
  type StreamFactory,
} from '../../../src/modules/games/rooms/engine'

/* Pure engine tests: boards, every game's rules, the server clocks, settlement and the keyless views.
   Replays the behaviour of the mock `room-clocks.test.ts` (10 s Perang Fakta rounds, 5 minute crossword). */

const HOST = '10'
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => String(10 + i))
const players = (n: number, bots = true): EnginePlayer[] =>
  ids(n).map((userId, i) => ({ userId, team: null, points: 0, correct: 0, isBot: bots && i > 0 }))

function pool(n: number, shortKeys = true): PoolQuestion[] {
  return Array.from({ length: n }, (_, i) => {
    const keyIndex = i % 4
    const options = (['A', 'B', 'C', 'D'] as const).map((label, k) => ({
      id: k,
      label,
      text: `Opsyen ${label}${shortKeys ? '' : ' yang sangat panjang sekali untuk soalan'}`,
    }))
    return {
      id: String(1000 + i),
      text: `Soalan ${String(i)}`,
      options,
      keyIndex,
      keyText: (options[keyIndex] as { text: string }).text,
    }
  })
}

const room = (game: EngineRoom['game'], code = 'AB12CD'): EngineRoom => ({
  code,
  game,
  subject: 'MATEMATIK',
  gradeLevel: 'TINGKATAN_4',
})
const T0 = Date.parse('2026-10-19T09:00:00+08:00')

function start(
  game: EngineRoom['game'],
  n: number,
  p: number,
  opts: { code?: string; seed?: string; quiz?: number; streams?: StreamFactory } = {},
) {
  return startGame({
    room: room(game, opts.code),
    players: players(n),
    humanId: HOST,
    seed: opts.seed ?? 'seed-a',
    pool: pool(POOL_SIZE[game]),
    quizTiles: opts.quiz ?? 35,
    p,
    nowMs: T0,
    ...(opts.streams ? { streams: opts.streams } : {}),
  })
}

const answerRight = (
  s: RoomState,
  extra: Partial<Extract<RoomAction, { type: 'answer' }>> = {},
): RoomAction => ({
  type: 'answer',
  questionId: s.pendingQ as string,
  optionId: (s.qs[s.pendingQ as string] as { keyIndex: number }).keyIndex,
  value: undefined,
  seconds: 15,
  ...extra,
})
const answerWrong = (s: RoomState): RoomAction => ({
  type: 'answer',
  questionId: s.pendingQ as string,
  optionId: ((s.qs[s.pendingQ as string] as { keyIndex: number }).keyIndex + 1) % 4,
  value: undefined,
  seconds: 15,
})

function step(
  room_: EngineRoom,
  o: EngineOut,
  action: RoomAction,
  p: number,
  nowMs = T0,
): EngineOut {
  return applyAction({ room: room_, players: o.players, state: o.state, action, p, nowMs })
}

function refusal(fn: () => unknown): EngineRefusal {
  try {
    fn()
  } catch (e) {
    if (e instanceof EngineRefusal) return e
    throw e
  }
  throw new Error('expected an EngineRefusal')
}

describe('board (BR-M16-20)', () => {
  const count = (b: string[], kind: string): number =>
    b.filter((t) => t === kind || t.startsWith(`${kind}:`)).length

  it('50 tiles: start, finish, 3 ladders, 3 snakes, 2 bonus, 2 traps, quiz tiles, the rest plain', () => {
    const b = buildBoard(35, prngStream('m16:room:AB12CD:board'))
    expect(b).toHaveLength(BOARD_SIZE)
    expect(b[0]).toBe('start')
    expect(b[49]).toBe('finish')
    expect(count(b, 'ladder')).toBe(3)
    expect(count(b, 'snake')).toBe(3)
    expect(count(b, 'bonus')).toBe(2)
    expect(count(b, 'trap')).toBe(2)
    expect(count(b, 'quiz')).toBe(35)
    expect(count(b, 'plain')).toBe(Math.max(0, 48 - 10 - 35))
    b.forEach((tile, i) => {
      const [kind, to] = tile.split(':')
      if (kind === 'ladder') expect(Number(to)).toBeGreaterThan(i + 1)
      if (kind === 'snake') expect(Number(to)).toBeLessThan(i + 1)
      expect(Number(to ?? 1)).toBeLessThanOrEqual(49)
      expect(Number(to ?? 2)).toBeGreaterThanOrEqual(2)
    })
  })

  it('quiz tiles follow the setting (0..38) and plain tiles are 48 - 10 - quiz', () => {
    for (const q of [0, 1, 20, 38]) {
      const b = buildBoard(q, prngStream(`m16:room:Q${String(q)}:board`))
      expect(count(b, 'quiz')).toBe(q)
      expect(count(b, 'plain')).toBe(38 - q)
    }
  })

  it('is deterministic under the stream name and differs between rooms', () => {
    const a = buildBoard(35, prngStream('m16:room:AAAAAA:board'))
    expect(buildBoard(35, prngStream('m16:room:AAAAAA:board'))).toEqual(a)
    expect(buildBoard(35, prngStream('m16:room:BBBBBB:board'))).not.toEqual(a)
  })
})

describe('determinism (named streams m16:room:<code>:<secret seed>:...)', () => {
  it('the public room code alone does not fix the game: another seed gives another board, facts and dice', () => {
    const a = start('perang-fakta', 2, 0.5, { code: 'AAAAAA', seed: 'one' })
    const b = start('perang-fakta', 2, 0.5, { code: 'AAAAAA', seed: 'two' })
    const again = start('perang-fakta', 2, 0.5, { code: 'AAAAAA', seed: 'one' })
    expect(again.state).toEqual(a.state)
    expect(b.state.facts.map((f) => f.isTrue)).not.toEqual(a.state.facts.map((f) => f.isTrue))
    const pa = start('papan-bijak', 2, 0.5, { code: 'AAAAAA', seed: 'one' })
    const pb = start('papan-bijak', 2, 0.5, { code: 'AAAAAA', seed: 'two' })
    expect(pb.state.board).not.toEqual(pa.state.board)
  })

  it('the same room and the same actions give the same game; another code gives another game', () => {
    const play = (code: string): RoomState => {
      let o = start('papan-bijak', 3, 0.5, { code })
      for (let i = 0; i < 12 && !o.finished; i++) {
        o = step(
          room('papan-bijak', code),
          o,
          o.state.awaiting === 'roll' ? { type: 'roll' } : answerRight(o.state),
          0.5,
        )
      }
      return o.state
    }
    expect(play('AAAAAA')).toEqual(play('AAAAAA'))
    expect(play('AAAAAA')).not.toEqual(play('ZZZZZZ'))
  })

  it('draw streams are opened by name and counted in the state', () => {
    const opened: string[] = []
    const streams: StreamFactory = (name) => {
      opened.push(name)
      return prngStream(name)
    }
    const o = start('perang-fakta', 2, 0.5, { code: 'ZZ99ZZ', streams })
    expect(opened.every((n) => n.startsWith('m16:room:ZZ99ZZ:'))).toBe(true)
    expect(opened).toContain('m16:room:ZZ99ZZ:seed-a:d0')
    expect(o.state.draws).toBe(PF_ROUNDS)
  })

  it('bots answer correctly with probability p: p = 1 always, p = 0 never', () => {
    for (const [p, expected] of [
      [1, PF_ROUNDS],
      [0, 0],
    ] as const) {
      let o = start('perang-fakta', 2, p)
      while (!o.finished)
        o = step(
          room('perang-fakta'),
          o,
          {
            type: 'answer',
            questionId: o.state.pendingQ as string,
            optionId: null,
            value: undefined,
            seconds: 0,
          },
          p,
        )
      expect(o.players.find((x) => x.isBot)?.correct).toBe(expected)
    }
  })

  it('bot accuracy near p over many draws (statistical sanity)', () => {
    let right = 0
    const rounds = 400
    for (let i = 0; i < rounds; i++) {
      let o = start('perang-fakta', 2, 0.7, { code: `S${String(i).padStart(5, '0')}` })
      o = step(
        room('perang-fakta', `S${String(i).padStart(5, '0')}`),
        o,
        {
          type: 'answer',
          questionId: o.state.pendingQ as string,
          optionId: null,
          value: undefined,
          seconds: 0,
        },
        0.7,
      )
      right += o.players.find((x) => x.isBot)?.correct ?? 0
    }
    expect(right / rounds).toBeGreaterThan(0.6)
    expect(right / rounds).toBeLessThan(0.8)
  })
})

describe('Papan Bijak', () => {
  const r = room('papan-bijak')

  it('starts on tile 1 for everyone and waits for the host to roll', () => {
    const o = start('papan-bijak', 4, 0.5)
    expect(o.finished).toBe(false)
    expect(o.state.awaiting).toBe('roll')
    expect(o.state.total).toBe(50)
    expect(Object.values(o.state.positions)).toEqual([1, 1, 1, 1])
    expect(o.state.pendingQ).toBeNull()
  })

  it('refuses the wrong action for the phase', () => {
    const o = start('papan-bijak', 2, 0.5)
    expect(
      refusal(() => step(r, o, answerRight({ ...o.state, pendingQ: '1000' }), 0.5)),
    ).toMatchObject({ kind: 'conflict', message: 'Tiada soalan untuk dijawab.' })
    let q = o
    for (let i = 0; i < 80 && q.state.awaiting !== 'answer'; i++)
      q = step(r, q, { type: 'roll' }, 0.5)
    expect(q.state.awaiting).toBe('answer')
    expect(refusal(() => step(r, q, { type: 'roll' }, 0.5))).toMatchObject({
      kind: 'conflict',
      message: 'Bukan giliran anda untuk gulung dadu.',
    })
    expect(
      refusal(() =>
        step(
          r,
          q,
          { type: 'answer', questionId: 'salah', optionId: 0, value: undefined, seconds: 15 },
          0.5,
        ),
      ),
    ).toMatchObject({
      kind: 'validation',
      message: 'Soalan tidak sepadan.',
      field: 'questionId',
    })
  })

  it('a quiz tile asks a question; a right answer keeps the tile, a wrong one goes back where the roll started', () => {
    for (const right of [true, false]) {
      let o = start('papan-bijak', 2, 0.5, { quiz: 38 }) // every interior tile is a quiz or special tile
      let from = 1
      for (let i = 0; i < 80 && o.state.awaiting !== 'answer'; i++) {
        from = o.state.positions[HOST] as number
        o = step(r, o, { type: 'roll' }, 0.5)
      }
      expect(o.state.awaiting).toBe('answer')
      const onTile = o.state.positions[HOST] as number
      const after = step(r, o, right ? answerRight(o.state) : answerWrong(o.state), 0.5)
      expect(after.players.find((x) => x.userId === HOST)?.correct).toBe(right ? 1 : 0)
      if (!right) expect(after.state.positions[HOST]).toBe(from)
      else expect(after.state.positions[HOST]).toBe(onTile)
    }
  })

  it('plays to the finish tile: winner gets 50 + 10 per correct answer, everyone else 10 per correct answer', () => {
    let o = start('papan-bijak', 3, 1)
    for (let i = 0; i < 600 && !o.finished; i++) {
      o = step(r, o, o.state.awaiting === 'roll' ? { type: 'roll' } : answerRight(o.state), 1)
    }
    expect(o.finished).toBe(true)
    expect(o.state.winnerId).not.toBeNull()
    for (const pl of o.players)
      expect(pl.points).toBe(pl.correct * 10 + (pl.userId === o.state.winnerId ? 50 : 0))
    expect(o.state.awaiting).toBeNull()
    expect(o.state.pendingQ).toBeNull()
  })

  it('the answer keys live in the state, never in the keyless view', () => {
    let o = start('papan-bijak', 2, 0.5, { quiz: 38 })
    for (let i = 0; i < 80 && o.state.awaiting !== 'answer'; i++)
      o = step(r, o, { type: 'roll' }, 0.5)
    const q = questionView('papan-bijak', 'playing', o.state)
    expect(q).toBeDefined()
    expect(Object.keys(q as object).sort()).toEqual(['id', 'options', 'text'])
    expect(JSON.stringify(q)).not.toMatch(/keyIndex|keyText|correct|answer/)
    const view = stateView('papan-bijak', 'playing', o.state, T0, T0)
    expect(Object.keys(view)).not.toContain('qs')
    expect(Object.keys(view)).not.toContain('qIds')
    expect(Object.keys(view)).not.toContain('pendingQ')
  })
})

describe('Perang Fakta secret truth bits', () => {
  it('use the injected secret source when given (not the stream hash), and stay valid facts', () => {
    const calls: number[] = []
    let flip = 0
    const o = startGame({
      room: room('perang-fakta'),
      players: players(2),
      humanId: HOST,
      seed: 'seed-a',
      secretInt: (max) => {
        calls.push(max)
        return flip++ % max
      },
      pool: pool(PF_ROUNDS),
      quizTiles: 35,
      p: 0,
      nowMs: T0,
    })
    expect(calls.length).toBeGreaterThanOrEqual(PF_ROUNDS)
    expect(o.state.facts).toHaveLength(PF_ROUNDS)
    expect(o.state.facts.some((f) => f.isTrue)).toBe(true)
    expect(o.state.facts.some((f) => !f.isTrue)).toBe(true)
  })
})

describe('Perang Fakta (15 rounds, 10 s)', () => {
  const r = room('perang-fakta')
  const vote = (o: EngineOut, value: unknown): RoomAction => ({
    type: 'answer',
    questionId: o.state.pendingQ as string,
    optionId: null,
    value,
    seconds: 3,
  })

  it('15 rounds; the question is a statement with Betul/Salah; a vote scores when it matches the truth', () => {
    let o = start('perang-fakta', 2, 0)
    expect(o.state.total).toBe(PF_ROUNDS)
    expect(o.state.round).toBe(1)
    expect(o.state.facts).toHaveLength(PF_ROUNDS)
    const q = questionView('perang-fakta', 'playing', o.state)
    expect(q?.options.map((x) => x.text)).toEqual(['Betul', 'Salah'])
    expect(q?.text).toContain(' → ')
    const truth = (o.state.facts[0] as { isTrue: boolean }).isTrue
    o = step(r, o, vote(o, truth), 0)
    expect(o.players.find((x) => x.userId === HOST)?.points).toBe(1)
    const wrong = step(r, start('perang-fakta', 2, 0), vote(start('perang-fakta', 2, 0), !truth), 0)
    expect(wrong.players.find((x) => x.userId === HOST)?.points).toBe(0)
    expect(wrong.state.round).toBe(2)
  })

  it('optionId 0 = Betul and 1 = Salah are votes; null is an explicit no-vote; anything else is refused', () => {
    const o = start('perang-fakta', 2, 0)
    const truth = (o.state.facts[0] as { isTrue: boolean }).isTrue
    const viaOption = step(
      r,
      o,
      {
        type: 'answer',
        questionId: o.state.pendingQ as string,
        optionId: truth ? 0 : 1,
        value: undefined,
        seconds: 1,
      },
      0,
    )
    expect(viaOption.players.find((x) => x.userId === HOST)?.points).toBe(1)
    const noVote = step(
      r,
      o,
      {
        type: 'answer',
        questionId: o.state.pendingQ as string,
        optionId: null,
        value: undefined,
        seconds: 0,
      },
      0,
    )
    expect(noVote.players.find((x) => x.userId === HOST)?.points).toBe(0)
    expect(refusal(() => step(r, o, vote(o, 'mungkin'), 0))).toMatchObject({
      kind: 'validation',
      message: 'Jawapan tidak sah.',
      field: 'value',
    })
    expect(
      refusal(() =>
        step(
          r,
          o,
          {
            type: 'answer',
            questionId: o.state.pendingQ as string,
            optionId: 3,
            value: undefined,
            seconds: 1,
          },
          0,
        ),
      ),
    ).toMatchObject({
      field: 'value',
    })
  })

  it('finishes after round 15; the top scorer wins and a tie has no winner', () => {
    let o = start('perang-fakta', 2, 0)
    while (!o.finished)
      o = step(r, o, vote(o, (o.state.facts[o.state.round - 1] as { isTrue: boolean }).isTrue), 0)
    expect(o.players.find((x) => x.userId === HOST)?.points).toBe(PF_ROUNDS)
    expect(o.state.winnerId).toBe(HOST)
    let tie = start('perang-fakta', 2, 0)
    while (!tie.finished)
      tie = step(
        r,
        tie,
        {
          type: 'answer',
          questionId: tie.state.pendingQ as string,
          optionId: null,
          value: undefined,
          seconds: 0,
        },
        0,
      )
    expect(tie.state.winnerId).toBeNull() // 0 - 0
  })
})

describe('Perang Fakta server clock (replay of room-clocks.test.ts)', () => {
  const r = room('perang-fakta')
  const clock = (o: EngineOut, nowMs: number) =>
    resolveClocks({ room: r, players: o.players, state: o.state, startedAtMs: T0, nowMs, p: 0 })

  it('starts a round at 10 s and counts down on the server clock; a reload does not reset it', () => {
    const o = start('perang-fakta', 2, 0)
    expect(o.state.round).toBe(1)
    expect(o.state.roundStartedMs).toBe(T0)
    expect(clocksOf('perang-fakta', 'playing', o.state, T0, T0)).toEqual({ roundSecondsLeft: 10 })
    expect(clocksOf('perang-fakta', 'playing', o.state, T0, T0 + 4000)).toEqual({
      roundSecondsLeft: 6,
    })
    expect(clocksOf('perang-fakta', 'playing', o.state, T0, T0 + 7000)).toEqual({
      roundSecondsLeft: 3,
    })
    expect(clock(o, T0 + 4000).changed).toBe(false)
    expect(clocksOf('perang-fakta', 'finished', o.state, T0, T0)).toEqual({})
  })

  it('advances a round that is 10 s old as a no-vote (the host scored nothing), idempotently', () => {
    const o = start('perang-fakta', 2, 0)
    const c = clock(o, T0 + PF_ROUND_MS)
    expect(c.changed).toBe(true)
    expect(c.state.round).toBe(2)
    expect(c.state.roundStartedMs).toBe(T0 + PF_ROUND_MS)
    expect(c.state.pendingQ).not.toBe(o.state.pendingQ)
    expect(c.players.find((x) => x.userId === HOST)?.points).toBe(0)
    expect(clocksOf('perang-fakta', 'playing', c.state, T0, T0 + PF_ROUND_MS)).toEqual({
      roundSecondsLeft: 10,
    })
    const again = resolveClocks({
      room: r,
      players: c.players,
      state: c.state,
      startedAtMs: T0,
      nowMs: T0 + PF_ROUND_MS,
      p: 0,
    })
    expect(again.changed).toBe(false)
  })

  it('resolves several elapsed rounds after a long absence (35 s: round 4, 5 s left)', () => {
    const o = start('perang-fakta', 2, 0)
    const c = clock(o, T0 + 35_000)
    expect(c.state.round).toBe(4)
    expect(clocksOf('perang-fakta', 'playing', c.state, T0, T0 + 35_000)).toEqual({
      roundSecondsLeft: 5,
    })
  })

  it('a host who never comes back: all 15 rounds pass, the game finishes once with the host on 0', () => {
    const o = start('perang-fakta', 2, 0)
    const c = clock(o, T0 + PF_ROUNDS * PF_ROUND_MS + 7000)
    expect(c.finished).toBe(true)
    expect(c.players.find((x) => x.userId === HOST)?.points).toBe(0)
    expect(c.state.awaiting).toBeNull()
    expect(clocksOf('perang-fakta', 'finished', c.state, T0, T0 + 999_999)).toEqual({})
  })

  it('a vote restarts the round clock; a later clock tick counts from the new round start', () => {
    const o = start('perang-fakta', 2, 0)
    const voted = applyAction({
      room: r,
      players: o.players,
      state: o.state,
      action: {
        type: 'answer',
        questionId: o.state.pendingQ as string,
        optionId: 0,
        value: undefined,
        seconds: 6,
      },
      p: 0,
      nowMs: T0 + 6000,
    })
    expect(voted.state.round).toBe(2)
    expect(voted.state.roundStartedMs).toBe(T0 + 6000)
    expect(clocksOf('perang-fakta', 'playing', voted.state, T0, T0 + 6000)).toEqual({
      roundSecondsLeft: 10,
    })
  })

  it('applyTimeout refuses games without a clock', () => {
    const o = start('benteng-ilmu', 2, 0)
    expect(
      refusal(() =>
        applyTimeout({
          room: room('benteng-ilmu'),
          players: o.players,
          state: o.state,
          p: 0,
          roundStartMs: T0,
        }),
      ),
    ).toMatchObject({
      message: 'Tiada jam untuk permainan ini.',
    })
  })
})

describe('Teka Silang Kata (8 words, 5 minutes)', () => {
  const r = room('teka-silang-kata')

  it('8 words, the clue has no options, the answer is typed (trim and case ignored)', () => {
    let o = start('teka-silang-kata', 2, 0)
    expect(o.state.total).toBe(8)
    expect(o.state.words).toHaveLength(8)
    expect(questionView('teka-silang-kata', 'playing', o.state)?.options).toEqual([])
    const word = (o.state.words[0] as { answer: string }).answer
    o = step(
      r,
      o,
      {
        type: 'answer',
        questionId: o.state.pendingQ as string,
        optionId: null,
        value: `  ${word.toUpperCase()} `,
        seconds: 5,
      },
      0,
    )
    expect(o.players.find((x) => x.userId === HOST)?.points).toBe(1)
    expect(o.state.meter[HOST]).toBe(1)
    expect(o.state.round).toBe(2)
    o = step(
      r,
      o,
      {
        type: 'answer',
        questionId: o.state.pendingQ as string,
        optionId: null,
        value: 'salah',
        seconds: 5,
      },
      0,
    )
    expect(o.players.find((x) => x.userId === HOST)?.points).toBe(1)
  })

  it('finishes after the 8th word; a tie has no winner', () => {
    let o = start('teka-silang-kata', 2, 0)
    while (!o.finished)
      o = step(
        r,
        o,
        {
          type: 'answer',
          questionId: o.state.pendingQ as string,
          optionId: null,
          value: (o.state.words[o.state.round - 1] as { answer: string }).answer,
          seconds: 1,
        },
        0,
      )
    expect(o.state.winnerId).toBe(HOST)
    expect(o.players.find((x) => x.userId === HOST)?.points).toBe(8)
  })

  it('counts 300 s down from the start; at 299 s it plays on; at 301 s it ends once with the words found so far', () => {
    const o = start('teka-silang-kata', 2, 0)
    expect(clocksOf('teka-silang-kata', 'playing', o.state, T0, T0)).toEqual({ secondsLeft: 300 })
    expect(clocksOf('teka-silang-kata', 'playing', o.state, T0, T0 + 120_000)).toEqual({
      secondsLeft: 180,
    })
    const at = (nowMs: number) =>
      resolveClocks({ room: r, players: o.players, state: o.state, startedAtMs: T0, nowMs, p: 0 })
    expect(at(T0 + CROSSWORD_MS - 1000).changed).toBe(false)
    const end = at(T0 + CROSSWORD_MS + 1000)
    expect(end.finished).toBe(true)
    expect(end.state.awaiting).toBeNull()
    expect(clocksOf('teka-silang-kata', 'finished', end.state, T0, T0 + 999_999)).toEqual({})
  })
})

describe('Benteng Ilmu (100 HP, 20 damage)', () => {
  const r = room('benteng-ilmu')

  it('both start on 100 HP; a right answer hits the opponent, a wrong one hurts the host', () => {
    const o = start('benteng-ilmu', 2, 1)
    expect(o.state.meter).toEqual({ '10': BENTENG_HP, '11': BENTENG_HP })
    const hit = step(r, o, answerRight(o.state), 0) // bot answers wrong (p = 0): hits itself too
    expect(hit.state.meter['11']).toBe(BENTENG_HP - 2 * BENTENG_DAMAGE)
    expect(hit.state.meter['10']).toBe(BENTENG_HP)
    expect(hit.players.find((x) => x.userId === HOST)).toMatchObject({ correct: 1, points: 10 })
    const miss = step(r, o, answerWrong(o.state), 1) // the bot answers right: the host takes two hits
    expect(miss.state.meter['10']).toBe(BENTENG_HP - 2 * BENTENG_DAMAGE)
  })

  it('wins by knocking the opponent out; loses when the host runs out of HP', () => {
    let o = start('benteng-ilmu', 2, 0)
    while (!o.finished) o = step(r, o, answerRight(o.state), 0)
    expect(o.state.winnerId).toBe(HOST)
    expect(o.state.meter['11']).toBeLessThanOrEqual(0)
    let l = start('benteng-ilmu', 2, 1)
    while (!l.finished) l = step(r, l, answerWrong(l.state), 1)
    expect(l.state.winnerId).toBe('11')
    expect(l.state.meter['10']).toBeLessThanOrEqual(0)
  })
})

describe('Perlumbaan Matematik (20 steps)', () => {
  const r = room('perlumbaan-matematik')

  it('a right answer is one step; first to 20 wins; points are the steps', () => {
    let o = start('perlumbaan-matematik', 3, 0)
    expect(o.state.total).toBe(MATHRACE_STEPS)
    for (let i = 0; i < MATHRACE_STEPS; i++) {
      expect(o.finished).toBe(false)
      o = step(r, o, answerRight(o.state), 0)
    }
    expect(o.finished).toBe(true)
    expect(o.state.winnerId).toBe(HOST)
    expect(o.state.meter[HOST]).toBe(20)
    expect(o.players.map((x) => x.points)).toEqual([20, 0, 0])
  })

  it('a bot can win the race; wrong answers move nobody (p = 1)', () => {
    let o = start('perlumbaan-matematik', 2, 1)
    for (let i = 0; i < MATHRACE_STEPS && !o.finished; i++) o = step(r, o, answerWrong(o.state), 1)
    expect(o.finished).toBe(true)
    expect(o.state.winnerId).toBe('11')
    expect(o.state.meter[HOST]).toBe(0)
  })
})

describe('Kuiz Relay (10 rounds, two teams)', () => {
  const r = room('kuiz-relay')

  it('players alternate teams 1 and 2; the host answers on its own turns; bots play theirs', () => {
    const o = startGame({
      room: r,
      players: players(4),
      humanId: HOST,
      seed: 'seed-a',
      pool: pool(KR_ROUNDS),
      quizTiles: 35,
      p: 1,
      nowMs: T0,
    })
    expect(o.players.map((x) => x.team)).toEqual([1, 2, 1, 2])
    expect(o.state.teamScores).toEqual({ '1': 0, '2': 0 })
    expect(o.state.round).toBe(1) // the host is player 1: round 1 is the host's
    expect(o.state.awaiting).toBe('answer')
  })

  it('plays 10 rounds, scores 10 + (10 - seconds) per right answer, and names the MVP of the winning team', () => {
    let o = startGame({
      room: r,
      players: players(4),
      humanId: HOST,
      seed: 'seed-a',
      pool: pool(KR_ROUNDS),
      quizTiles: 35,
      p: 1,
      nowMs: T0,
    })
    while (!o.finished) o = step(r, o, answerRight(o.state, { seconds: 4 }), 1)
    expect(o.state.round).toBeGreaterThan(KR_ROUNDS)
    const mvp = o.players.find((x) => x.userId === o.state.mvpId)
    expect(mvp).toBeDefined()
    const t1 = o.state.teamScores['1'] as number
    const t2 = o.state.teamScores['2'] as number
    expect(mvp?.team).toBe(t2 > t1 ? 2 : 1)
    expect(o.players.reduce((s, x) => s + x.correct, 0)).toBe(KR_ROUNDS)
    // the host answered 3 of the 10 rounds with 4 s: 16 points each
    expect(o.players.find((x) => x.userId === HOST)?.points).toBe(16 * 3)
  })
})

describe('refusals and purity', () => {
  it('does not mutate its inputs', () => {
    const o = start('benteng-ilmu', 2, 0.5)
    const frozen = structuredClone(o)
    step(room('benteng-ilmu'), o, answerRight(o.state), 0.5)
    expect(o).toEqual(frozen)
  })

  it('the pool sizes of the games', () => {
    expect(POOL_SIZE).toEqual({
      'papan-bijak': 40,
      'perang-fakta': 15,
      'benteng-ilmu': 30,
      'perlumbaan-matematik': 40,
      'kuiz-relay': 10,
      'teka-silang-kata': 8,
    })
  })

  it('PRNG streams used by the engine are independent of call order of other rooms', () => {
    const a: Prng = prngStream('m16:room:AAAAAA:d0')
    const first = a.next()
    prngStream('m16:room:BBBBBB:d0').next()
    expect(prngStream('m16:room:AAAAAA:d0').next()).toBe(first)
  })
})

describe('settlement (AC10)', () => {
  const finishedState = (over: Partial<RoomState>): RoomState => ({
    ...start('benteng-ilmu', 2, 0).state,
    awaiting: null,
    pendingQ: null,
    ...over,
  })
  const ps = (over: Partial<EnginePlayer>[]): EnginePlayer[] =>
    over.map((o, i) => ({
      userId: String(10 + i),
      team: null,
      points: 0,
      correct: 0,
      isBot: i > 0,
      ...o,
    }))

  it('Papan Bijak: wins/jumlah/betul/skor for the acting human only (not a joined human); coins are left to the tier rates', () => {
    const st = finishedState({ winnerId: '10', total: 50 })
    const s = computeSettlement({
      code: 'AB12CD',
      game: 'papan-bijak',
      state: st,
      players: ps([
        { correct: 4, points: 90 },
        { correct: 2, points: 20 },
        { userId: '12', isBot: false, correct: 1, points: 10 },
      ]),
    })
    expect(s.standings).toEqual([{ userId: '10', wins: 1, jumlah: 1, betul: 4, skor: 90 }])
    expect(s.report).toMatchObject({
      userId: '10',
      game: 'papan_bijak',
      event: 'win',
      won: true,
      correct: 4,
      total: 50,
      detail: { roomCode: 'AB12CD' },
    })
    expect(s.report?.coins).toBeUndefined()
    const lost = computeSettlement({
      code: 'AB12CD',
      game: 'papan-bijak',
      state: finishedState({ winnerId: '11' }),
      players: ps([{ correct: 1 }, {}]),
    })
    expect(lost.report).toMatchObject({ event: 'correct', won: false })
    expect(lost.standings).toEqual([{ userId: '10', wins: 0, jumlah: 1, betul: 1, skor: 0 }]) // the bot winner has no standing
  })

  it('a joined human the engine simulated never gets a standing, even as the winner or the MVP', () => {
    const joined = { userId: '11', isBot: false }
    for (const game of ['benteng-ilmu', 'perang-fakta', 'perlumbaan-matematik', 'teka-silang-kata'] as const) {
      const s = computeSettlement({ code: 'X', game, state: finishedState({ winnerId: '11' }), players: ps([{}, joined]) })
      expect(s.standings).toEqual([])
      expect(s.report).toMatchObject({ userId: '10', won: false })
    }
    const relay = computeSettlement({
      code: 'X',
      game: 'kuiz-relay',
      state: finishedState({ mvpId: '11' }),
      players: ps([{ team: 0 }, { ...joined, team: 0 }]),
    })
    expect(relay.standings).toEqual([])
    expect(relay.report).toMatchObject({ userId: '10', won: true }) // same team as the MVP: the host's team won
  })

  it('Benteng Ilmu 35 on a win / 8 played; Perang Fakta 10 on a win only; Perlumbaan 5 with the rank; relay and crossword 0', () => {
    const coins = (
      game: Parameters<typeof computeSettlement>[0]['game'],
      st: Partial<RoomState>,
      pl = ps([{}, {}]),
    ) => computeSettlement({ code: 'X', game, state: finishedState(st), players: pl }).report
    expect(coins('benteng-ilmu', { winnerId: '10' })).toMatchObject({ coins: 35, event: 'win' })
    expect(coins('benteng-ilmu', { winnerId: '11' })).toMatchObject({ coins: 8, event: 'play' })
    expect(coins('perang-fakta', { winnerId: '10' })).toMatchObject({
      coins: 10,
      event: 'win',
      game: 'perang_fakta',
    })
    expect(coins('perang-fakta', { winnerId: null })).toMatchObject({ coins: 0, event: 'finish' })
    expect(
      coins(
        'perlumbaan-matematik',
        { winnerId: '11', meter: { '10': 3, '11': 20, '12': 5 } },
        ps([{}, {}, { userId: '12' }]),
      ),
    ).toMatchObject({ coins: 5, event: 'play', game: 'mathrace', detail: { rank: 3 } })
    expect(coins('teka-silang-kata', { winnerId: '10' })).toMatchObject({ coins: 0 })
  })

  it('Kuiz Relay: the acting MVP gets the win, the MVP team counts as winners; bots and joined humans get nothing', () => {
    const players4 = ps([{ team: 1 }, { team: 2 }, { team: 1, isBot: false }, { team: 2 }])
    const s = computeSettlement({
      code: 'X',
      game: 'kuiz-relay',
      state: finishedState({ mvpId: '12' }),
      players: players4,
    })
    expect(s.standings).toEqual([]) // the MVP is a joined human the engine simulated
    expect(s.report).toMatchObject({ userId: '10', won: true, event: 'win', coins: 0 })
    const hostMvp = computeSettlement({
      code: 'X',
      game: 'kuiz-relay',
      state: finishedState({ mvpId: '10' }),
      players: players4,
    })
    expect(hostMvp.standings).toEqual([{ userId: '10', wins: 1, jumlah: 0, betul: 0, skor: 0 }])
    const miss = computeSettlement({
      code: 'X',
      game: 'kuiz-relay',
      state: finishedState({ mvpId: '13' }),
      players: players4,
    })
    expect(miss.standings).toEqual([]) // the MVP is a bot
    expect(miss.report).toMatchObject({ won: false })
  })
})
