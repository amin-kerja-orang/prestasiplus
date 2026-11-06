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
  cmpId,
  computeSettlement,
  handOverSeat,
  pbPoints,
  mathraceSettleDefault,
  pbSettleDefault,
  shouldWritePoll,
  questionView,
  seatOf,
  seatPresent,
  skipSeat,
  youAnswered,
  resolveClocks,
  startGame,
  stateView,
  type EngineOut,
  type EnginePlayer,
  type EngineRoom,
  type PoolQuestion,
  type RoomPlayAction,
  type RoomState,
  type StreamFactory,
} from '../../../src/modules/games/rooms/engine'

/* Pure engine tests: boards, every game's rules, the server clocks, settlement and the keyless views.
   Replays the behaviour of the mock `room-clocks.test.ts` (10 s Perang Fakta rounds, 5 minute crossword). */

const HOST = '10'
const ids = (n: number): string[] => Array.from({ length: n }, (_, i) => String(10 + i))
const players = (n: number, bots = true): EnginePlayer[] =>
  ids(n).map((userId, i) => ({ userId, team: null, points: 0, correct: 0, isBot: bots && i > 0, lastPolledMs: null, consecutiveTimeouts: 0 }))

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
  extra: Partial<Extract<RoomPlayAction, { type: 'answer' }>> = {},
): RoomPlayAction => ({
  type: 'answer',
  questionId: s.pendingQ as string,
  optionId: (s.qs[s.pendingQ as string] as { keyIndex: number }).keyIndex,
  value: undefined,
  seconds: 15,
  ...extra,
})
const answerWrong = (s: RoomState): RoomPlayAction => ({
  type: 'answer',
  questionId: s.pendingQ as string,
  optionId: ((s.qs[s.pendingQ as string] as { keyIndex: number }).keyIndex + 1) % 4,
  value: undefined,
  seconds: 15,
})

function step(
  room_: EngineRoom,
  o: EngineOut,
  action: RoomPlayAction,
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
  const vote = (o: EngineOut, value: unknown): RoomPlayAction => ({
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

  it('applyTimeout refuses a game that awaits nothing', () => {
    const o = start('benteng-ilmu', 2, 0)
    expect(
      refusal(() =>
        applyTimeout({
          room: room('benteng-ilmu'),
          players: o.players,
          state: { ...o.state, awaiting: null, pendingQ: null },
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

describe('Perlumbaan Matematik pool wrap (GAME-05, DOC DEFECT 63: per-player reshuffle)', () => {
  const r = room('perlumbaan-matematik')
  const run = (seed: string, humanId: string, n: number): string[] => {
    let o = startGame({ room: r, players: players(2), humanId, seed, pool: pool(40), quizTiles: 35, p: 0, nowMs: T0 })
    const ids: string[] = []
    for (let i = 0; i < n; i++) {
      ids.push(o.state.pendingQ as string)
      o = step(r, o, answerWrong(o.state), 0)
    }
    return ids
  }

  it('the first 40 questions are distinct; 41-80 are the same set in a different order', () => {
    const ids = run('seed-a', HOST, 80)
    expect(new Set(ids.slice(0, 40)).size).toBe(40)
    expect(new Set(ids.slice(40)).size).toBe(40)
    expect([...ids.slice(40)].sort()).toEqual([...ids.slice(0, 40)].sort())
    expect(ids.slice(40)).not.toEqual(ids.slice(0, 40))
  })

  it('two players restart in different orders, and the same seed replays identically', () => {
    const a = run('seed-a', HOST, 80)
    const b = run('seed-a', '11', 80)
    expect(b.slice(40)).not.toEqual(a.slice(40))
    expect(run('seed-a', HOST, 80)).toEqual(a)
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
    // 48 GAME-06: the seconds are the SERVER's (4 s after the turn began), not the `seconds` the client sends.
    let now = T0
    while (!o.finished) {
      now += 4_000
      o = step(r, o, answerRight(o.state, { seconds: 0 }), 1, now)
    }
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

describe('settlement (AC10, FR-GM-R.6)', () => {
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
      lastPolledMs: null,
      consecutiveTimeouts: 0,
      ...o,
    }))
  const human = (userId: string, over: Partial<EnginePlayer> = {}): Partial<EnginePlayer> => ({ userId, isBot: false, ...over })

  it('Papan Bijak: wins/jumlah/betul/skor and one report for EVERY human; a robot gets neither', () => {
    const st = finishedState({ winnerId: '10', total: 50, startHumans: 2 })
    const s = computeSettlement({
      code: 'AB12CD',
      game: 'papan-bijak',
      state: st,
      players: ps([
        { correct: 4, points: 90 },
        { userId: 'robot-1', correct: 2, points: 20 },
        human('12', { correct: 1, points: 10 }),
      ]),
    })
    expect(s.standings).toEqual([
      { userId: '10', wins: 1, jumlah: 1, betul: 4, skor: 90 },
      { userId: '12', wins: 0, jumlah: 1, betul: 1, skor: 10 },
    ])
    expect(s.reports.map((r) => r.userId)).toEqual(['10', '12'])
    expect(s.reports[0]).toMatchObject({ game: 'papan_bijak', event: 'win', won: true, correct: 4, total: 50, outcome: 'win', robotsOnly: false, detail: { roomCode: 'AB12CD' } })
    expect(s.reports[1]).toMatchObject({ event: 'correct', won: false, outcome: 'play', robotsOnly: false })
  })

  it('a robot-only game and a single-human game change no standing (FR-PA-29, AC-GM-R.5), but the human still gets a report', () => {
    for (const game of ['papan-bijak', 'kuiz-relay', 'benteng-ilmu'] as const) {
      const one = computeSettlement({ code: 'X', game, state: finishedState({ winnerId: '10', mvpId: '10', startHumans: 1 }), players: ps([{ correct: 1 }, { userId: 'robot-1' }]) })
      expect(one.standings).toEqual([])
      expect(one.reports).toHaveLength(1)
      expect(one.reports[0]).toMatchObject({ robotsOnly: true })
    }
    const none = computeSettlement({ code: 'X', game: 'papan-bijak', state: finishedState({ winnerId: 'robot-1', startHumans: 0 }), players: ps([{ isBot: true, lastPolledMs: null, consecutiveTimeouts: 0 }, { userId: 'robot-1' }]) })
    expect(none).toEqual({ standings: [], reports: [] })
  })

  it('two humans started and one left: the last human still has the standing and the report (the leaver was settled at the leave)', () => {
    const s = computeSettlement({ code: 'X', game: 'papan-bijak', state: finishedState({ winnerId: '10', startHumans: 2 }), players: ps([{ correct: 3 }, { userId: 'robot-1' }]) })
    expect(s.standings).toEqual([{ userId: '10', wins: 1, jumlah: 1, betul: 3, skor: 0 }])
    expect(s.reports).toHaveLength(1)
  })

  it('OWN PART (GAME-03/04/05/07): a joined human the engine still simulates gets no standing and no report, even as the winner', () => {
    for (const game of ['benteng-ilmu', 'perang-fakta', 'perlumbaan-matematik', 'teka-silang-kata'] as const) {
      const s = computeSettlement({ code: 'X', game, state: finishedState({ winnerId: '11', startHumans: 2 }), players: ps([{}, human('11')]) })
      expect(s.standings).toEqual([{ userId: '10', wins: 0, jumlah: 1, betul: 0, skor: 0 }]) // jumlah + 1 (R1 Q2), menang 0
      expect(s.reports).toHaveLength(1)
      expect(s.reports[0]).toMatchObject({ userId: '10', won: false })
    }
  })

  it('the report says the outcome and whether only robots played; the amounts are the reward formula, no constants here', () => {
    const report = (
      game: Parameters<typeof computeSettlement>[0]['game'],
      st: Partial<RoomState>,
      pl = ps([{}, {}]),
    ) => computeSettlement({ code: 'X', game, state: finishedState(st), players: pl }).reports[0]
    expect(report('benteng-ilmu', { winnerId: '10' })).toMatchObject({ event: 'win', outcome: 'win', robotsOnly: true })
    expect(report('benteng-ilmu', { winnerId: '11' })).toMatchObject({ event: 'play', outcome: 'play', robotsOnly: true })
    expect(report('perang-fakta', { winnerId: '10' })).toMatchObject({ event: 'win', game: 'perang_fakta' })
    expect(report('perang-fakta', { winnerId: null })).toMatchObject({ event: 'finish', outcome: 'draw' })
    expect(
      report('perlumbaan-matematik', { winnerId: '11', meter: { '10': 3, '11': 20, '12': 5 } }, ps([{}, {}, { userId: '12' }])),
    ).toMatchObject({ event: 'play', game: 'mathrace', detail: { rank: 3 } })
    expect(report('teka-silang-kata', { winnerId: '10' })).toMatchObject({ outcome: 'win' })
    expect(report('kuiz-relay', { winnerId: null, mvpId: null })).toMatchObject({ outcome: 'play' })
    expect(report('benteng-ilmu', { winnerId: '10', startHumans: 2 }, ps([{}, human('12')]))).toMatchObject({ robotsOnly: false })
  })

  it('Kuiz Relay: the MVP gets the win, the MVP team counts as winners; every human gets a report; bots get nothing', () => {
    const four = ps([{ team: 1, isBot: false }, { team: 2 }, { team: 1, isBot: false }, { team: 2 }])
    const humanMvp = computeSettlement({ code: 'X', game: 'kuiz-relay', state: finishedState({ mvpId: '12', startHumans: 2 }), players: four })
    expect(humanMvp.standings).toEqual([
      { userId: '10', wins: 0, jumlah: 1, betul: 0, skor: 0 },
      { userId: '12', wins: 1, jumlah: 1, betul: 0, skor: 0 },
    ])
    expect(humanMvp.reports.map((r) => [r.userId, r.won, r.outcome])).toEqual([['10', true, 'win'], ['12', true, 'win']])
    const botMvp = computeSettlement({ code: 'X', game: 'kuiz-relay', state: finishedState({ mvpId: '13', startHumans: 2 }), players: four })
    expect(botMvp.standings.map((d) => d.wins)).toEqual([0, 0]) // the MVP is a robot: nobody's win
    expect(botMvp.reports.every((r) => !r.won)).toBe(true)
  })
})

describe('FR-GM-00.7: the clock of each room game', () => {
  const room = (game: EngineRoom['game']): EngineRoom => ({ code: 'CLOCK1', game, subject: 'MATEMATIK', gradeLevel: 'TINGKATAN_4' })
  const seats: EnginePlayer[] = [
    { userId: '10', team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
    { userId: 'robot-1', team: null, points: 0, correct: 0, isBot: true, lastPolledMs: null, consecutiveTimeouts: 0 },
  ]
  const pool: PoolQuestion[] = Array.from({ length: 40 }, (_, i) => ({
    id: String(i + 1),
    text: `Soalan ${String(i + 1)}`,
    options: (['A', 'B', 'C', 'D'] as const).map((label, id) => ({ id, label, text: `Pilihan ${label}` })),
    keyIndex: 0,
    keyText: 'Pilihan A',
  }))
  const begin = (game: EngineRoom['game']) => startGame({ room: room(game), players: seats, humanId: '10', seed: 'clock-seed', pool, quizTiles: 35, p: 0, nowMs: 0 })
  const tick = (game: EngineRoom['game'], o: EngineOut, nowMs: number) => resolveClocks({ room: room(game), players: o.players, state: o.state, startedAtMs: 0, nowMs, p: 0 })

  it.each([
    ['benteng-ilmu', 15_000],
    ['perlumbaan-matematik', 20_000],
    ['perang-fakta', 10_000],
  ] as const)('%s: a question lasts %i ms, then it is a wrong answer and the next round', (game, ms) => {
    const o = begin(game)
    expect(tick(game, o, ms - 1).changed).toBe(false)
    const due = tick(game, o, ms)
    expect(due.changed).toBe(true)
    expect(due.state.round).toBe(2)
    expect(due.answered).toEqual([expect.objectContaining({ position: 1, correct: false, atMs: ms })])
    expect(due.state.seats?.['10']?.answerMs ?? []).toEqual([]) // a timeout is no answer for the pace guard
    expect(due.state.roundStartedMs).toBe(ms)
  })

  it('Kuiz Relay: the human seat has 15 s', () => {
    const relaySeats = [...seats, { ...seats[1], userId: 'robot-2' } as EnginePlayer, { ...seats[1], userId: 'robot-3' } as EnginePlayer]
    const o = startGame({ room: room('kuiz-relay'), players: relaySeats, humanId: '10', seed: 'clock-seed', pool, quizTiles: 0, p: 0, nowMs: 0 })
    expect(tick('kuiz-relay', o, 14_999).changed).toBe(false)
    expect(tick('kuiz-relay', o, 15_000).answered).toEqual([expect.objectContaining({ position: 1, correct: false })])
  })

  it('Papan Bijak: a roll not made in 30 s rolls itself; a quiz tile gives 20 s and returns the token', () => {
    const o = begin('papan-bijak')
    expect(o.state.awaiting).toBe('roll')
    expect(tick('papan-bijak', o, 29_999).changed).toBe(false)
    const rolled = applyTimeout({ room: room('papan-bijak'), players: o.players, state: o.state, p: 0, roundStartMs: 30_000 })
    expect(rolled.state.log[0]).toMatch(/^roll:[1-6]$/)
    const quiz = { ...o.state, awaiting: 'answer' as const, pendingQ: '1', positions: { '10': 13, 'robot-1': 1 }, meter: { '10': 10 } }
    const out = applyTimeout({ room: room('papan-bijak'), players: o.players, state: quiz, p: 0, roundStartMs: 20_000 })
    expect(out.state.positions['10']).toBe(10)
    expect(out.answered).toEqual([expect.objectContaining({ questionId: '1', correct: false })])
  })

  it('Papan Bijak: 200 rounds with nobody on tile 50 end the game: the highest tile wins, equal tiles draw (48 GAME-02)', () => {
    const o = begin('papan-bijak')
    const late = (a: number, b: number) => ({ ...o.state, turn: 400, positions: { '10': a, 'robot-1': b } })
    const settle = (a: number, b: number) => applyTimeout({ room: room('papan-bijak'), players: o.players, state: { ...late(a, b), awaiting: 'answer', pendingQ: '1', meter: { '10': a } }, p: 0, roundStartMs: 1 })
    expect(settle(30, 20)).toMatchObject({ finished: true, state: { winnerId: '10' } })
    expect(settle(20, 30)).toMatchObject({ finished: true, state: { winnerId: 'robot-1' } })
    expect(settle(20, 20)).toMatchObject({ finished: true, state: { winnerId: null } })
  })

  it('a robot seat sorts after the pupils and never breaks a tie-break', () => {
    expect(cmpId('10', 'robot-1')).toBeLessThan(0)
    expect(cmpId('robot-2', 'robot-1')).toBeGreaterThan(0)
    expect(cmpId('9', '10')).toBeLessThan(0)
  })
})

describe('multi-human seats: Papan Bijak (GAME-02) and Kuiz Relay (GAME-06)', () => {
  const A = '10'
  const B = '11'
  const seatsOf = (game: EngineRoom['game']): EnginePlayer[] =>
    game === 'kuiz-relay'
      ? [
          { userId: A, team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
          { userId: B, team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
          { userId: 'robot-1', team: null, points: 0, correct: 0, isBot: true, lastPolledMs: null, consecutiveTimeouts: 0 },
          { userId: 'robot-2', team: null, points: 0, correct: 0, isBot: true, lastPolledMs: null, consecutiveTimeouts: 0 },
        ]
      : [
          { userId: A, team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
          { userId: B, team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
          { userId: 'robot-1', team: null, points: 0, correct: 0, isBot: true, lastPolledMs: null, consecutiveTimeouts: 0 },
        ]
  const begin = (game: EngineRoom['game'], p = 0.5) =>
    startGame({ room: room(game), players: seatsOf(game), humanId: A, seed: 'seed-m', pool: pool(POOL_SIZE[game]), quizTiles: 35, p, nowMs: T0 })

  it('both humans are awaited on their own turn; the other seat is refused by the route (humanId names the seat)', () => {
    let o = begin('papan-bijak')
    expect(o.state).toMatchObject({ humanId: A, awaiting: 'roll', startHumans: 2 })
    const seen = new Set<string>([o.state.humanId])
    for (let i = 0; i < 400 && !o.finished; i++) {
      o = step(room('papan-bijak'), o, o.state.awaiting === 'roll' ? { type: 'roll' } : answerRight(o.state), 0.5, T0 + i * 1000)
      seen.add(o.state.humanId)
    }
    expect([...seen].sort()).toEqual([A, B]) // never the robot
    expect(o.finished).toBe(true)
  })

  it('Papan Bijak plays to the end with two humans and a robot; each human has their own answer count and pace', () => {
    let o = begin('papan-bijak', 1)
    for (let i = 0; i < 800 && !o.finished; i++) {
      o = step(room('papan-bijak'), o, o.state.awaiting === 'roll' ? { type: 'roll' } : answerRight(o.state), 1, T0 + i * 2000)
    }
    expect(o.finished).toBe(true)
    const a = o.state.seats?.[A]
    const b = o.state.seats?.[B]
    expect(a?.answerCount).toBe(o.players.find((x) => x.userId === A)?.correct)
    expect(b?.answerCount).toBe(o.players.find((x) => x.userId === B)?.correct)
    expect((a?.answerMs.length ?? 0) + (b?.answerMs.length ?? 0)).toBeGreaterThan(0)
    expect(o.state.seats?.['robot-1']).toBeUndefined() // a robot keeps no seat state and writes no answer rows
  })

  it('Papan Bijak: a timeout belongs to the seat whose turn ran out and counts one miss for that seat only', () => {
    const o = begin('papan-bijak')
    const t = applyTimeout({ room: room('papan-bijak'), players: o.players, state: o.state, p: 0, roundStartMs: T0 + 30_000 })
    expect(t.players.find((x) => x.userId === A)?.consecutiveTimeouts).toBe(1)
    expect(t.players.find((x) => x.userId === B)?.consecutiveTimeouts ?? 0).toBe(0)
    expect(t.state.humanId === B || t.state.humanId === A).toBe(true)
  })

  it('Kuiz Relay: humans answer on their rounds only (seat of round r), robots on theirs, to the end', () => {
    let o = begin('kuiz-relay', 1)
    const who: string[] = []
    let now = T0
    while (!o.finished) {
      who.push(`${String(o.state.round)}:${o.state.humanId}`)
      now += 3_000
      o = step(room('kuiz-relay'), o, answerRight(o.state), 1, now)
    }
    // seats A, B, robot-1, robot-2 repeat over 10 rounds: A on 1, 5, 9; B on 2, 6, 10
    expect(who).toEqual(['1:10', '2:11', '5:10', '6:11', '9:10', '10:11'])
    expect(o.state.seats?.[A]?.answerCount).toBe(3)
    expect(o.state.seats?.[B]?.answerCount).toBe(3)
    expect(o.state.mvpId).not.toBeNull()
  })

  it('Kuiz Relay: the seconds are the server clock (a client claiming 0 s after 9 s gets 10 + 1)', () => {
    const o = begin('kuiz-relay', 1)
    const r = step(room('kuiz-relay'), o, answerRight(o.state, { seconds: 0 }), 1, T0 + 9_900)
    expect(r.players.find((x) => x.userId === A)?.points).toBe(11) // floor(9.9) = 9 s: 10 + max(0, 10 - 9)
  })

  it('shouldWritePoll writes the first poll and then at most once per gap; youAnswered is true only for the question the seat answered', () => {
    const o = begin('papan-bijak')
    const st = structuredClone(o.state)
    expect(shouldWritePoll(null, T0, 5_000)).toBe(true) // never polled: writes
    expect(shouldWritePoll(T0, T0 + 4_999, 5_000)).toBe(false) // inside the gap
    expect(shouldWritePoll(T0, T0 + 5_000, 5_000)).toBe(true) // past the gap
    const q = { ...st, awaiting: 'answer' as const, pendingQ: '1000' }
    expect(youAnswered(q, A)).toBe(false)
    seatOf(q, A).answeredAt = `${String(q.round)}:${String(q.turn)}:1000`
    expect(youAnswered(q, A)).toBe(true)
    expect(youAnswered({ ...q, turn: q.turn + 1 }, A)).toBe(false)
  })
})

describe('robots off: a leaver\'s seat is skipped (ruling 50.1)', () => {
  const seats3 = (): EnginePlayer[] => ['10', '11', '12'].map((userId) => ({ userId, team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 }))
  it('Papan Bijak: the next seat in line stays next, whoever left', () => {
    const o = startGame({ room: room('papan-bijak'), players: seats3(), humanId: '10', seed: 's', pool: pool(40), quizTiles: 35, p: 0, nowMs: T0 })
    // turn 1 is seat 11's; seat 10 (before it) leaves: 11 is still on turn; seat 12 (after it) leaves: still 11
    const mid = { ...o.state, turn: 1, humanId: '11', positions: { '10': 4, '11': 5, '12': 6 } }
    const without = (gone: string) => seats3().filter((x) => x.userId !== gone)
    const a = skipSeat({ room: room('papan-bijak'), players: without('10'), state: mid, leaver: '10', leaverIndex: 0, oldCount: 3, p: 0, nowMs: T0 })
    expect(a.state.humanId).toBe('11')
    expect(a.state.turn % 2).toBe(0) // index of 11 among [11, 12]... after the skip it is 11 again
    expect(a.state.positions).toEqual({ '11': 5, '12': 6 })
    const b2 = skipSeat({ room: room('papan-bijak'), players: without('12'), state: mid, leaver: '12', leaverIndex: 2, oldCount: 3, p: 0, nowMs: T0 })
    expect(b2.state.humanId).toBe('11')
    expect(b2.state.turn % 2).toBe(1)
  })
  it('Papan Bijak: the seat on turn leaves: the following seat is on turn and its clock starts', () => {
    const o = startGame({ room: room('papan-bijak'), players: seats3(), humanId: '10', seed: 's', pool: pool(40), quizTiles: 35, p: 0, nowMs: T0 })
    const h = skipSeat({ room: room('papan-bijak'), players: seats3().slice(1), state: o.state, leaver: '10', leaverIndex: 0, oldCount: 3, p: 0, nowMs: T0 + 9_000 })
    expect(h.state).toMatchObject({ humanId: '11', awaiting: 'roll', roundStartedMs: T0 + 9_000 })
    expect(h.state.positions['10']).toBeUndefined()
  })
  it('Kuiz Relay: the formula runs over the seats left; the answerer of the round on the table is re-read', () => {
    const four = ['10', '11', '12', '13'].map((userId, i) => ({ userId, team: (i % 2) + 1, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 }))
    const o = startGame({ room: room('kuiz-relay'), players: four, humanId: '10', seed: 's', pool: pool(10), quizTiles: 0, p: 0, nowMs: T0 })
    expect(o.state).toMatchObject({ humanId: '10', round: 1 })
    const h = skipSeat({ room: room('kuiz-relay'), players: four.slice(1), state: o.state, leaver: '10', leaverIndex: 0, oldCount: 4, p: 0, nowMs: T0 + 4_000 })
    expect(h.state).toMatchObject({ humanId: '11', round: 1, awaiting: 'answer', roundStartedMs: T0 + 4_000 }) // (1 - 1) mod 3 = seat 11
    expect(h.players).toHaveLength(3)
  })
})

describe('presence window (ruling 50)', () => {
  it('a seat is present up to absence limit + the write gap (last_polled_at is written at most every 5 s), and not a ms later', () => {
    const limit = 30_000 + 5_000
    expect(seatPresent(T0, T0 + limit, limit)).toBe(true)
    expect(seatPresent(T0, T0 + limit + 1, limit)).toBe(false)
    expect(seatPresent(null, T0, limit)).toBe(false) // never seen
  })
})

describe('a human leaves a game in play: a robot takes the seat (ruling 50)', () => {
  const room_ = room('papan-bijak')
  const seats3 = (): EnginePlayer[] => [
    { userId: '10', team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
    { userId: '11', team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
    { userId: '12', team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
  ]
  const begin = () => startGame({ room: room_, players: seats3(), humanId: '10', seed: 'seed-l', pool: pool(40), quizTiles: 35, p: 0.5, nowMs: T0 })

  it('the leaver was on turn: the robot plays that turn at once and the room waits for the next human', () => {
    const o = begin()
    expect(o.state.humanId).toBe('10')
    const after = seats3().map((x) => (x.userId === '10' ? { ...x, userId: 'robot-1', isBot: true } : x))
    const h = handOverSeat({ room: room_, players: after, state: o.state, remap: { '10': 'robot-1' }, leaver: '10', p: 0.5, nowMs: T0 + 5_000 })
    expect(h.state.humanId).toBe('11')
    expect(h.state.positions['robot-1']).toBeDefined()
    expect(h.state.positions['10']).toBeUndefined()
    expect(h.state.seats?.['10']).toBeUndefined()
    expect(h.state.roundStartedMs).toBe(T0 + 5_000)
  })

  it('the leaver was not on turn: only the keys change and the turn stays', () => {
    const o = begin()
    const after = seats3().map((x) => (x.userId === '12' ? { ...x, userId: 'robot-1', isBot: true } : x))
    const h = handOverSeat({ room: room_, players: after, state: o.state, remap: { '12': 'robot-1' }, leaver: '12', p: 0.5, nowMs: T0 + 5_000 })
    expect(h.state.humanId).toBe('10')
    expect(h.state.awaiting).toBe('roll')
    expect(h.state.positions).toEqual({ '10': 1, '11': 1, 'robot-1': 1 })
    expect(h.finished).toBe(false)
  })

  it('the robots are renumbered when a middle seat becomes a robot: every key follows', () => {
    const o = begin()
    const st = { ...o.state, positions: { '10': 4, '11': 5, '12': 6, 'robot-1': 7 } }
    const after: EnginePlayer[] = [
      { userId: 'robot-1', team: null, points: 0, correct: 0, isBot: true, lastPolledMs: null, consecutiveTimeouts: 0 },
      { userId: '11', team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
      { userId: '12', team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
      { userId: 'robot-2', team: null, points: 0, correct: 0, isBot: true, lastPolledMs: null, consecutiveTimeouts: 0 },
    ]
    const h = handOverSeat({ room: room_, players: after, state: { ...st, humanId: '11' }, remap: { '10': 'robot-1', 'robot-1': 'robot-2' }, leaver: '10', p: 0.5, nowMs: T0 })
    expect(h.state.positions).toEqual({ 'robot-1': 4, '11': 5, '12': 6, 'robot-2': 7 })
  })

  it('Kuiz Relay: the human on turn leaves; the robot plays that pending turn and the clock restarts', () => {
    const seats4 = (): EnginePlayer[] => [
      { userId: '10', team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
      { userId: '11', team: null, points: 0, correct: 0, isBot: false, lastPolledMs: null, consecutiveTimeouts: 0 },
      { userId: 'robot-1', team: null, points: 0, correct: 0, isBot: true, lastPolledMs: null, consecutiveTimeouts: 0 },
      { userId: 'robot-2', team: null, points: 0, correct: 0, isBot: true, lastPolledMs: null, consecutiveTimeouts: 0 },
    ]
    const rr = room('kuiz-relay')
    const o = startGame({ room: rr, players: seats4(), humanId: '10', seed: 's', pool: pool(10), quizTiles: 0, p: 1, nowMs: T0 })
    expect(o.state).toMatchObject({ humanId: '10', round: 1 })
    const after = seats4().map((x) => (x.userId === '10' ? { ...x, userId: 'robot-1', isBot: true } : x.userId === 'robot-1' ? { ...x, userId: 'robot-2' } : x.userId === 'robot-2' ? { ...x, userId: 'robot-3' } : x))
    const h = handOverSeat({ room: rr, players: after, state: o.state, remap: { '10': 'robot-1', 'robot-1': 'robot-2', 'robot-2': 'robot-3' }, leaver: '10', p: 1, nowMs: T0 + 7_000 })
    expect(h.state).toMatchObject({ humanId: '11', round: 2, awaiting: 'answer' }) // round 1 was played by the robot, the room waits for the next human
    expect(h.players.find((x) => x.userId === 'robot-1')?.correct).toBe(1) // p = 1: the robot answered the pending round
    expect(h.state.roundStartedMs).toBe(T0 + 7_000)
    expect(h.state.seats?.['10']).toBeUndefined()
  })

  it('OWN PART: the acting seat passes to the next human', () => {
    const own = startGame({ room: room('benteng-ilmu'), players: [seats3()[0] as EnginePlayer, seats3()[1] as EnginePlayer], humanId: '10', seed: 's', pool: pool(30), quizTiles: 0, p: 0, nowMs: T0 })
    const after = [{ userId: 'robot-1', team: null, points: 0, correct: 0, isBot: true, lastPolledMs: null, consecutiveTimeouts: 0 }, seats3()[1] as EnginePlayer]
    const h = handOverSeat({ room: room('benteng-ilmu'), players: after, state: own.state, remap: { '10': 'robot-1' }, leaver: '10', p: 0, nowMs: T0 })
    expect(h.state.humanId).toBe('11')
  })
})

describe('seat presence and the consecutive timeouts (DM-90, rulings 49 and 54)', () => {
  const A = '10'
  const B = '11'
  const two = (lastA: number | null, lastB: number | null): EnginePlayer[] => [
    { userId: A, team: null, points: 0, correct: 0, isBot: false, lastPolledMs: lastA, consecutiveTimeouts: 0 },
    { userId: B, team: null, points: 0, correct: 0, isBot: false, lastPolledMs: lastB, consecutiveTimeouts: 0 },
  ]
  const begin = (game: EngineRoom['game'], seats: EnginePlayer[]) =>
    startGame({ room: room(game), players: seats, humanId: A, seed: 'seed-p', pool: pool(POOL_SIZE[game]), quizTiles: 35, p: 0, nowMs: T0 })
  const count = (o: EngineOut, id: string): number => o.players.find((x) => x.userId === id)?.consecutiveTimeouts ?? 0
  const timeout = (o: EngineOut, nowMs: number): EngineOut =>
    applyTimeout({ room: room('papan-bijak'), players: o.players, state: o.state, p: 0, roundStartMs: nowMs })
  const act = (o: EngineOut, nowMs: number): EngineOut =>
    step(room('papan-bijak'), o, o.state.awaiting === 'roll' ? { type: 'roll' } : answerRight(o.state), 0, nowMs)
  /** Plays the other seat's turns until `id` is on turn. */
  const toTurn = (o: EngineOut, id: string, nowMs: number): EngineOut => {
    let cur = o
    for (let i = 0; i < 20 && cur.state.humanId !== id; i++) cur = act(cur, nowMs)
    return cur
  }

  it('a timeout of the seat\'s own turn counts one; an action resets it to 0; 2 timeouts, an action, 2 timeouts is 2 (never 3)', () => {
    let o = begin('papan-bijak', two(T0, T0))
    let now = T0
    for (let n = 1; n <= 2; n++) {
      o = toTurn(o, A, now)
      now += 30_000
      o = timeout(o, now)
      expect(count(o, A)).toBe(n) // the other seat's count is untouched
      expect(count(o, B)).toBe(0)
    }
    o = toTurn(o, A, now)
    o = act(o, now)
    expect(count(o, A)).toBe(0) // an action reset it
    for (let n = 1; n <= 2; n++) {
      o = toTurn(o, A, now)
      now += 30_000
      o = timeout(o, now)
    }
    expect(count(o, A)).toBe(2)
    expect(count(o, B)).toBe(0) // B acted on every turn it was awaited
  })

  it('a real answer and a roll reset the count; the explicit "time ran out" answer is a timeout in Papan Bijak and Kuiz Relay and neither in an own-part game', () => {
    const noPickOf = (o: EngineOut): RoomPlayAction => ({ type: 'answer', questionId: o.state.pendingQ as string, optionId: null, value: undefined, seconds: 0 })
    const seated = (o: EngineOut): EngineOut => ({ ...o, players: o.players.map((x) => (x.userId === A ? { ...x, consecutiveTimeouts: 1 } : x)) })
    // Papan Bijak: A on a question with 1 timeout already, then each kind of action
    const pb = begin('papan-bijak', two(T0, T0))
    const onQuestion: EngineOut = seated({ ...pb, state: { ...pb.state, awaiting: 'answer', pendingQ: pb.state.qIds[0] as string } })
    expect(count(step(room('papan-bijak'), onQuestion, noPickOf(onQuestion), 0, T0 + 20_000), A)).toBe(2) // explicit "time ran out": +1
    expect(count(step(room('papan-bijak'), onQuestion, answerRight(onQuestion.state), 0, T0 + 1_000), A)).toBe(0) // a real answer: reset
    expect(count(step(room('papan-bijak'), seated(pb), { type: 'roll' }, 0, T0 + 1_000), A)).toBe(0) // a roll: reset
    // Kuiz Relay (A answers round 1)
    const kr = seated(begin('kuiz-relay', two(T0, T0)))
    expect(count(step(room('kuiz-relay'), kr, noPickOf(kr), 0, T0 + 15_000), A)).toBe(2)
    // Benteng Ilmu (own part): the no-pick answer neither increments nor resets; a real answer resets
    const bn = seated(begin('benteng-ilmu', two(T0, T0)))
    expect(count(step(room('benteng-ilmu'), bn, noPickOf(bn), 0, T0 + 15_000), A)).toBe(1)
    expect(count(step(room('benteng-ilmu'), bn, answerRight(bn.state), 0, T0 + 1_000), A)).toBe(0)
  })

  const tick = (game: EngineRoom['game'], o: EngineOut, nowMs: number, absentMs: number | undefined) =>
    resolveClocks({ room: room(game), players: o.players, state: o.state, startedAtMs: T0, nowMs, p: 0, ...(absentMs === undefined ? {} : { absentMs }) })

  it('an absent seat\'s turn closes at last_polled_at + games_absent_seconds (+ the write gap), a present seat\'s runs the full clock', () => {
    const absent = begin('papan-bijak', two(T0, T0 + 14_000)) // B keeps polling, so only A is absent
    // games_absent_seconds = 10 s, the limit as presence reads it is 15 s (10 + the 5 s write gap); the roll clock is 30 s
    expect(tick('papan-bijak', absent, T0 + 14_999, 10_000).changed).toBe(false)
    const closed = tick('papan-bijak', absent, T0 + 15_000, 10_000)
    expect(closed.changed).toBe(true)
    expect(closed.state.log.filter((l) => l.startsWith('roll:'))).toHaveLength(1) // the roll timed out at 15 s, not 30 s
    expect(closed.players.find((x) => x.userId === A)?.consecutiveTimeouts).toBeGreaterThanOrEqual(1)
    const present = begin('papan-bijak', two(T0 + 10_000, T0 + 24_000))
    expect(tick('papan-bijak', present, T0 + 24_999, 10_000).changed).toBe(false) // polled at 10 s: absent only from 25 s
    expect(tick('papan-bijak', present, T0 + 25_000, 10_000).changed).toBe(true)
    const polling = begin('papan-bijak', two(T0 + 29_000, T0 + 29_000))
    expect(tick('papan-bijak', polling, T0 + 29_999, 10_000).changed).toBe(false) // the full clock still ends the turn
    expect(tick('papan-bijak', polling, T0 + 30_000, 10_000).changed).toBe(true)
    expect(tick('papan-bijak', absent, T0 + 29_999, undefined).changed).toBe(false) // no absence rule given: the full clock only
  })

  it('a seat already absent when its turn begins is timed out at once, and the catch-up stops at 3 timeouts for the service to remove the seat', () => {
    const seats = two(T0, null).map((x, i) => (i === 1 ? { ...x, isBot: true, userId: 'robot-1' } : x)) // A last polled at the start; a robot is the other seat
    const o = begin('papan-bijak', seats)
    const r = tick('papan-bijak', o, T0 + 10 * 60_000, 10_000)
    expect(r.changed).toBe(true)
    expect(r.players.find((x) => x.userId === A)?.consecutiveTimeouts).toBe(3)
    expect(r.finished).toBe(false)
    expect(r.state.humanId).toBe(A) // stopped on A's turn with 3 timeouts
  })

  it('the calling seat is present on its own request: the open turn is not early-closed for it, but a turn whose full clock ran out still times out', () => {
    const o = begin('papan-bijak', two(T0, T0 + 14_000)) // A last polled at the start; 10 s limit = 15 s window
    const asA = (nowMs: number) => resolveClocks({ room: room('papan-bijak'), players: o.players, state: o.state, startedAtMs: T0, nowMs, p: 0, absentMs: 10_000, callerSeat: A })
    expect(asA(T0 + 20_000).changed).toBe(false) // A's own request at 20 s: its open 30 s roll turn stays open
    expect(asA(T0 + 29_999).changed).toBe(false)
    expect(asA(T0 + 30_000).changed).toBe(true) // the full clock ran out before this request: still a timeout
    const asB = resolveClocks({ room: room('papan-bijak'), players: o.players, state: o.state, startedAtMs: T0, nowMs: T0 + 20_000, p: 0, absentMs: 10_000, callerSeat: B })
    expect(asB.changed).toBe(true) // B's request does not make A present
  })

  it('a seat with no last_polled_at (a room from before DM-90) counts as present: no early close, no crash on old seat state', () => {
    const o = begin('papan-bijak', two(null, null))
    const legacy = structuredClone(o.state)
    Object.assign(legacy.seats?.[A] as object, { seenMs: T0, missed: 2 }) // the R2 fields are ignored
    const run = (nowMs: number) => resolveClocks({ room: room('papan-bijak'), players: o.players, state: legacy, startedAtMs: T0, nowMs, p: 0, absentMs: 10_000 })
    expect(run(T0 + 29_000).changed).toBe(false)
    expect(run(T0 + 30_000).changed).toBe(true)
  })

  it('Kuiz Relay closes an absent seat\'s turn early too; an own-part game (Benteng Ilmu) does not (via its GAME-0x part)', () => {
    const relay = begin('kuiz-relay', two(T0, T0))
    expect(tick('kuiz-relay', relay, T0 + 14_999, 10_000).changed).toBe(false)
    expect(tick('kuiz-relay', relay, T0 + 15_000, 10_000).changed).toBe(true) // the 15 s answer clock and the limit meet here
    const relay2 = begin('kuiz-relay', two(T0 - 100_000, T0))
    expect(tick('kuiz-relay', relay2, T0, 10_000).changed).toBe(true) // already absent: closes at once, before the 15 s clock
    const benteng = begin('benteng-ilmu', two(T0 - 100_000, T0))
    expect(tick('benteng-ilmu', benteng, T0 + 14_999, 10_000).changed).toBe(false) // own part: only the full 15 s clock
  })
})

describe('Papan Bijak literal acceptance criteria (GAME-02 A)', () => {
  const r = room('papan-bijak')
  const fixedDie = (next: number): StreamFactory => (name) => {
    const base = prngStream(name)
    return name.includes(':d') ? { ...base, next: () => next } : base
  }
  /** `n` human seats on a custom board and tiles; roll `next` gives the die: 0.5 -> 4, 0.34 -> 3. */
  function setup(n: number, board: Record<number, string>, at: Record<string, number>, correct = 0) {
    const o = startGame({
      room: r,
      players: players(n, false).map((x) => ({ ...x, correct })),
      humanId: HOST,
      seed: 'ac',
      pool: pool(40),
      quizTiles: 0,
      p: 0.5,
      nowMs: T0,
    })
    const b = o.state.board.map(() => 'plain')
    b[0] = 'start'
    b[49] = 'finish'
    for (const [tile, kind] of Object.entries(board)) b[Number(tile) - 1] = kind
    return { ...o, state: { ...o.state, board: b, positions: { ...o.state.positions, ...at } } }
  }
  const roll = (o: EngineOut, die: number): EngineOut =>
    applyAction({ room: r, players: o.players, state: o.state, action: { type: 'roll' }, p: 0.5, nowMs: T0, streams: fixedDie(die === 4 ? 0.5 : 0.34) })

  it('AC-GM-02.1: a pupil on tile 48 who rolls 4 finishes and wins', () => {
    const o = roll(setup(2, {}, { [HOST]: 48 }), 4)
    expect(o.finished).toBe(true)
    expect(o.state.winnerId).toBe(HOST)
    expect(o.state.positions[HOST]).toBe(50)
  })

  it('AC-GM-02.2: on tile 10, a roll of 3 lands on quiz tile 13; a WRONG answer returns the token to tile 10', () => {
    const o = roll(setup(2, { 13: 'quiz' }, { [HOST]: 10 }), 3)
    expect(o.state.positions[HOST]).toBe(13)
    expect(o.state.awaiting).toBe('answer')
    const after = applyAction({ room: r, players: o.players, state: o.state, action: answerWrong(o.state), p: 0.5, nowMs: T0 })
    expect(after.state.positions[HOST]).toBe(10)
    expect(after.players.find((x) => x.userId === HOST)?.correct).toBe(0)
  })

  it('AC-GM-02.4: a winner with 4 correct answers has 4 x 10 + 50 = 90 points; the other seat has 10 x correct', () => {
    const s = setup(2, {}, { [HOST]: 48 }, 4)
    const o = roll(s, 4)
    expect(o.players.find((x) => x.userId === HOST)?.points).toBe(90)
    expect(o.players.find((x) => x.userId !== HOST)?.points).toBe(40)
  })

  it('FR-GM-02.5: pbSettleDefault uses the same formula (winner +50, others none) and does not mutate', () => {
    const ps = players(3, false).map((x, i) => ({ ...x, correct: i + 1 }))
    const done = pbSettleDefault(ps, '11')
    expect(done.map((x) => x.points)).toEqual([10, 70, 30])
    expect(ps.every((x) => x.points === 0)).toBe(true)
    expect(pbSettleDefault(ps, null).map((x) => x.points)).toEqual([10, 20, 30])
    expect(pbPoints(4, true)).toBe(90)
  })

  it('GAME-05: mathraceSettleDefault sets each seat points to its steps (0 when absent) and does not mutate', () => {
    const ps = players(3, false)
    const done = mathraceSettleDefault(ps, { [ps[0]!.userId]: 5, [ps[1]!.userId]: 12 })
    expect(done.map((x) => x.points)).toEqual([5, 12, 0])
    expect(ps.every((x) => x.points === 0)).toBe(true)
  })

  it('FR-GM-02.3: a landing effect whose target is a special tile is not applied again', () => {
    // ladder 20 -> 30, and tile 30 is a ladder to 40: the token stays on 30
    let o = roll(setup(2, { 20: 'ladder:30', 30: 'ladder:40' }, { [HOST]: 17 }), 3)
    expect(o.state.positions[HOST]).toBe(30)
    // bonus on 20 (+3 = 23) with a quiz on 23: no question is asked
    o = roll(setup(2, { 20: 'bonus', 23: 'quiz' }, { [HOST]: 17 }), 3)
    expect(o.state.positions[HOST]).toBe(23)
    expect(o.state.awaiting).toBe('roll')
    expect(o.state.pendingQ).toBeNull()
    // trap on 20 (-3 = 17) is not a snake or a ladder target
    o = roll(setup(2, { 20: 'trap', 17: 'snake:5' }, { [HOST]: 17 }), 3)
    expect(o.state.positions[HOST]).toBe(17)
  })

  it('FR-GM-02.2: over many seeds the die always gives 1 to 6 and every face shows', () => {
    const seen = new Set<number>()
    for (let i = 0; i < 300; i++) {
      const o = startGame({ room: r, players: players(1, false), humanId: HOST, seed: `die-${String(i)}`, pool: pool(40), quizTiles: 0, p: 0.5, nowMs: T0 })
      const after = applyAction({ room: r, players: o.players, state: o.state, action: { type: 'roll' }, p: 0.5, nowMs: T0 })
      const die = Number((after.state.log.find((l) => l.startsWith('roll:')) as string).slice(5))
      expect(Number.isInteger(die) && die >= 1 && die <= 6).toBe(true)
      seen.add(die)
    }
    expect([...seen].sort()).toEqual([1, 2, 3, 4, 5, 6])
  })

  describe('FR-GM-02.4 / ruling 56: the pool restarts reshuffled after the 40th question', () => {
    /** One human, every interior tile a quiz tile, always a wrong answer: the token never gets far and the cursor keeps moving. */
    function asked(seed: string, n: number): string[] {
      let o = startGame({ room: r, players: players(1, false), humanId: HOST, seed, pool: pool(40), quizTiles: 0, p: 0.5, nowMs: T0 })
      o = { ...o, state: { ...o.state, board: o.state.board.map((_, i) => (i === 0 ? 'start' : i === 49 ? 'finish' : 'quiz')) } }
      const ids: string[] = []
      while (ids.length < n) {
        o = applyAction({ room: r, players: o.players, state: o.state, action: { type: 'roll' }, p: 0.5, nowMs: T0 })
        ids.push(o.state.pendingQ as string)
        o = applyAction({ room: r, players: o.players, state: o.state, action: answerWrong(o.state), p: 0.5, nowMs: T0 })
      }
      return ids
    }
    it('the next 40 are the same set in a different order, and the same seed replays the same order', () => {
      const ids = asked('reshuffle', 80)
      const first = ids.slice(0, 40)
      const second = ids.slice(40)
      expect(new Set(first).size).toBe(40)
      expect([...second].sort()).toEqual([...first].sort())
      expect(second).not.toEqual(first)
      expect(asked('reshuffle', 80)).toEqual(ids)
    })
  })
})
