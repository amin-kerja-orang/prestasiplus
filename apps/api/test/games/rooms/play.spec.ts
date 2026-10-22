import { GAMES_MESSAGES, type GamesRoomView } from '@pp/contract'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import {
  ACCOUNTS,
  FakeRewards,
  bootGamesApp,
  expectError,
  loginAs,
  type Client,
  type GamesTestApp,
} from '../helpers'
import {
  FORM,
  FixedAccuracy,
  ListBots,
  P,
  PB_FORM,
  createRoom,
  demo001Students,
  fillAndStart,
  insertShortMcqs,
  parseRoom,
  roomOf,
  stateOf,
} from './support'

const M = GAMES_MESSAGES

/** Key-bearing names that must never appear in any room response (they live in `game_rooms.state` only). */
const SECRET_KEYS = [
  'keyIndex',
  'keyText',
  'isTrue',
  'correct_answer',
  'correctAnswer',
  'correctOption',
  'is_correct',
  'qs',
  'qIds',
  'pendingQ',
  'facts',
  'words',
  'cursor',
  'draws',
  'answer',
  'explanation',
]

function walk(value: unknown, visit: (key: string, parent: string) => void, parent = ''): void {
  if (Array.isArray(value)) value.forEach((v) => walk(v, visit, parent))
  else if (value && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      visit(k, parent)
      walk(v, visit, k)
    }
  }
}

describe('start, actions, clocks and settlement (M16-26..28)', () => {
  let t: GamesTestApp
  let student: Client
  let student2: Client
  let rewards: FakeRewards
  let accuracy: FixedAccuracy
  let mathIds: string[]
  let sejIds: string[]

  beforeAll(async () => {
    rewards = new FakeRewards()
    accuracy = new FixedAccuracy(0)
    t = await bootGamesApp({ ports: { rewards, platformAccuracy: accuracy } })
    student = await loginAs(t, ACCOUNTS.student)
    student2 = await loginAs(t, ACCOUNTS.student2)
    const kids = await demo001Students(t.db)
    t.ports.provideBotPool(
      new ListBots(kids.map((k) => ({ id: k.id, name: k.name, grade: k.grade }))),
    )
    mathIds = (
      await insertShortMcqs(t.db, { subject: 'MATH', level: 'T4', count: 60, prefix: 'RM' })
    ).map((q) => q.id)
    sejIds = (
      await insertShortMcqs(t.db, { subject: 'SEJ', level: 'T4', count: 20, prefix: 'RS' })
    ).map((q) => q.id)
    await insertShortMcqs(t.db, { subject: 'BI', level: 'T4', count: 20, prefix: 'RB' })
  })
  afterAll(async () => {
    await t.close()
  })
  beforeEach(() => {
    rewards.calls.length = 0
    accuracy.p = 0
  })

  const act = async (
    c: Client,
    game: string,
    code: string,
    body: object,
  ): Promise<GamesRoomView> => {
    const res = await c.post(P(game, code, '/action'), body)
    return parseRoom(res)
  }
  const view = async (c: Client, game: string, code: string) =>
    parseRoom(await c.get(P(game, code)))
  const started = async (game: string, form?: object, c: Client = student) => {
    const code = await createRoom(c, game, form)
    const res = await fillAndStart(c, game, code, game === 'kuiz-relay' ? 3 : 1)
    return { code, view: parseRoom(res) }
  }
  const standing = async (game: string, userId: string) =>
    (
      await t.db.query<{ wins: number; jumlah: number; skor: number; betul: number }>(
        'select wins, jumlah, skor, betul from game_standings where game = $1 and user_id = $2',
        [game, userId],
      )
    )[0]

  async function answerRight(
    game: string,
    code: string,
    extra: object = {},
  ): Promise<GamesRoomView> {
    const st = await stateOf(t.db, code)
    if (game === 'perang-fakta') {
      return act(student, game, code, {
        type: 'answer',
        questionId: st.pendingQ,
        value: (st.facts[st.round - 1] as { isTrue: boolean }).isTrue,
        ...extra,
      })
    }
    if (game === 'teka-silang-kata') {
      return act(student, game, code, {
        type: 'answer',
        questionId: st.pendingQ,
        value: (st.words[st.round - 1] as { answer: string }).answer,
        ...extra,
      })
    }
    const key = (st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex
    return act(student, game, code, {
      type: 'answer',
      questionId: st.pendingQ,
      optionId: key,
      ...extra,
    })
  }

  describe('start', () => {
    it('refusals: non-player 404, non-host 403, too few players 409, started 409', async () => {
      const code = await createRoom(student, 'benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      expectError(
        await student2.post(P('benteng-ilmu', code, '/start')),
        'NOT_FOUND',
        M.roomNotFound,
      )
      expectError(
        await student.post(P('benteng-ilmu', 'ZZZZZZ', '/start')),
        'NOT_FOUND',
        M.roomNotFound,
      )
      expectError(await student.post(P('catur', code, '/start')), 'NOT_FOUND', M.gameNotFound)
      expectError(
        await student.post(P('benteng-ilmu', code, '/start')),
        'CONFLICT',
        M.startNotEnoughPlayers,
      )
      await student2.post(P('benteng-ilmu', undefined, '/join'), { room_code: code })
      expectError(
        await student2.post(P('benteng-ilmu', code, '/start')),
        'FORBIDDEN',
        M.startHostOnly,
      )
      const ok = await student.post(P('benteng-ilmu', code, '/start'))
      expect(parseRoom(ok).status).toBe('playing')
      expectError(
        await student.post(P('benteng-ilmu', code, '/start')),
        'CONFLICT',
        M.startAlreadyStarted,
      )
      expectError(
        await student2.post(P('benteng-ilmu', code, '/start')),
        'FORBIDDEN',
        M.startHostOnly,
      ) // host check precedes the status check
    })

    it('409 "Soalan tidak mencukupi." when the bank has fewer questions than the game needs', async () => {
      const code = await createRoom(student, 'perang-fakta')
      await student.get(P('perang-fakta', code))
      await t.db.query('update questions set is_active = false')
      try {
        expectError(
          await student.post(P('perang-fakta', code, '/start')),
          'CONFLICT',
          M.startNotEnoughQuestions,
        )
        expect(await roomOf(t.db, code)).toMatchObject({
          status: 'waiting',
          state: { seed: expect.any(String) },
        })
      } finally {
        await t.db.query('update questions set is_active = true')
      }
      expect(parseRoom(await student.post(P('perang-fakta', code, '/start'))).status).toBe(
        'playing',
      )
    })

    it('the pool is drawn through BE-09 for the room subject and level', async () => {
      const subjectOf = async (ids: string[]): Promise<string[]> =>
        (
          await t.db.query<{ code: string }>(
            `select distinct s.code from question_versions v join subjects s on s.id = v.subject_id where v.question_id = any($1::bigint[])`,
            [ids],
          )
        ).map((r) => r.code)
      const { code } = await started('benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      const st = await stateOf(t.db, code)
      expect(st.qIds.length).toBe(30)
      expect(await subjectOf(st.qIds)).toEqual(['MATH'])
      expect(st.qIds.filter((id) => mathIds.includes(id)).length).toBeGreaterThanOrEqual(28)
      const sej = await started('perang-fakta', { ...FORM, subject: 'SEJARAH' })
      const st2 = await stateOf(t.db, sej.code)
      expect(st2.qIds).toHaveLength(15)
      expect(await subjectOf(st2.qIds)).toEqual(['SEJ'])
      expect(sejIds.length).toBe(20)
    })

    it('Papan Bijak: 50-tile board, everyone on tile 1, the host rolls first, no question yet', async () => {
      const { view: v } = await started('papan-bijak')
      expect(v.status).toBe('playing')
      expect(v.state).toMatchObject({
        awaiting: 'roll',
        round: 1,
        total: 50,
        humanId: student.userId,
      })
      expect(v.state?.board).toHaveLength(50)
      expect(v.state?.board?.filter((x) => x === 'quiz')).toHaveLength(35)
      expect(Object.values(v.state?.positions ?? {})).toEqual([1, 1])
      expect(v.question).toBeUndefined()
      expect(v.round).toBe(1)
    })

    it('every game starts with its own state shape', async () => {
      const pf = (await started('perang-fakta')).view
      expect(pf.state).toMatchObject({
        awaiting: 'answer',
        round: 1,
        total: 15,
        roundSecondsLeft: 10,
      })
      expect(pf.question?.options).toEqual([
        { id: 0, label: 'A', text: 'Betul' },
        { id: 1, label: 'B', text: 'Salah' },
      ])
      const bi = (await started('benteng-ilmu', { ...FORM, match_mode: 'same_level' })).view
      expect(bi.state?.meter).toEqual({ [student.userId]: 100, [bi.players[1]?.id as string]: 100 })
      expect(bi.question?.options).toHaveLength(4)
      const pm = (await started('perlumbaan-matematik')).view
      expect(pm.state).toMatchObject({ total: 20 })
      expect(Object.values(pm.state?.meter ?? {})).toEqual([0, 0])
      const kr = (await started('kuiz-relay')).view
      expect(kr.players.map((p) => p.team)).toEqual([1, 2, 1, 2])
      expect(kr.state?.teamScores).toEqual({ '1': 0, '2': 0 })
      expect(kr.state?.total).toBe(10)
      expect(kr.question).toBeDefined() // the host is player 1: it answers round 1
      const tk = (await started('teka-silang-kata', { ...FORM, subject: 'BAHASA_INGGERIS' })).view
      expect(tk.state).toMatchObject({ total: 8, secondsLeft: 300 })
      expect(tk.question?.options).toEqual([])
    })
  })

  describe('keyless views', () => {
    it('no response carries a key, truth value, pool or pending id; the keys exist only in the stored state', async () => {
      for (const [game, form] of [
        ['papan-bijak', { ...PB_FORM, match_mode: 'same_grade' }],
        ['perang-fakta', FORM],
        ['benteng-ilmu', { ...FORM, match_mode: 'same_level' }],
        ['perlumbaan-matematik', FORM],
        ['kuiz-relay', FORM],
        ['teka-silang-kata', { ...FORM, subject: 'BAHASA_INGGERIS' }],
      ] as const) {
        const { code } = await started(game, form)
        const responses = [await student.get(P(game, code))]
        const st = await stateOf(t.db, code)
        // the stored document does hold keys (the oracle for these tests)
        expect(Object.keys(st)).toContain('qs')
        const first = Object.values(st.qs)[0] as { keyIndex: number; keyText: string }
        expect(typeof first.keyIndex).toBe('number')
        if (game === 'papan-bijak') {
          // push to a quiz tile so a question is on the wire
          for (let i = 0; i < 60; i++) {
            const v = await view(student, game, code)
            if (v.question) break
            await act(student, game, code, { type: 'roll' })
          }
          responses.push(await student.get(P(game, code)))
        }
        for (const res of responses) {
          parseRoom(res) // the strict contract schema rejects any extra field
          const text = JSON.stringify(res.body)
          walk(res.body, (key, parent) => {
            expect(SECRET_KEYS, `${game}: key "${key}" in ${parent}`).not.toContain(key)
          })
          for (const q of Object.values(st.qs)) {
            // a stored key text may equal an option text, but the id of a key is never exposed on its own
            expect(text).not.toContain(`"keyText"`)
            expect(q).toBeDefined()
          }
        }
        // the question options are exactly {id,label,text}
        const v = await view(student, game, code)
        for (const o of v.question?.options ?? [])
          expect(Object.keys(o).sort()).toEqual(['id', 'label', 'text'])
      }
    })

    it('a started room is never cacheable and never shows the seed', async () => {
      const { code } = await started('perang-fakta')
      const seed = (await stateOf(t.db, code)).seed
      expect(seed).toMatch(/^[0-9a-f]{32}$/)
      const res = await student.get(P('perang-fakta', code))
      expect(res.headers['cache-control']).toBe('no-store')
      expect(JSON.stringify(res.body)).not.toContain(seed)
      expect(JSON.stringify(res.body)).not.toContain('seed')
      const st = await stateOf(t.db, code)
      const act2 = await student.post(P('perang-fakta', code, '/action'), {
        type: 'answer',
        questionId: st.pendingQ,
        value: true,
      })
      expect(act2.headers['cache-control']).toBe('no-store')
      expect(JSON.stringify(act2.body)).not.toContain(seed)
      const again = await started('benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      const startRes = await student.get(P('benteng-ilmu', again.code))
      expect(startRes.headers['cache-control']).toBe('no-store')
    })
  })

  describe('action validation (V-M16-xx)', () => {
    let code: string
    let qid: string
    beforeAll(async () => {
      const s = await started('benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      code = s.code
      qid = s.view.question?.id as string
    })
    const cases: [string, object, string, string][] = [
      ['no type', {}, 'type', M.actionType],
      ['unknown type', { type: 'dance' }, 'type', M.actionType],
      ['no questionId', { type: 'answer' }, 'questionId', M.actionQuestion],
      ['questionId number', { type: 'answer', questionId: 5 }, 'questionId', M.actionQuestion],
      ['questionId empty', { type: 'answer', questionId: '' }, 'questionId', M.actionQuestion],
      ['optionId 4', { type: 'answer', questionId: 'x', optionId: 4 }, 'optionId', M.actionOption],
      [
        'optionId -1',
        { type: 'answer', questionId: 'x', optionId: -1 },
        'optionId',
        M.actionOption,
      ],
      [
        'optionId text',
        { type: 'answer', questionId: 'x', optionId: 'a' },
        'optionId',
        M.actionOption,
      ],
      [
        'optionId fraction',
        { type: 'answer', questionId: 'x', optionId: 1.5 },
        'optionId',
        M.actionOption,
      ],
      [
        'seconds negative',
        { type: 'answer', questionId: 'x', optionId: 1, seconds: -1 },
        'seconds',
        M.actionSeconds,
      ],
      [
        'seconds text',
        { type: 'answer', questionId: 'x', optionId: 1, seconds: 'cepat' },
        'seconds',
        M.actionSeconds,
      ],
      [
        'value number',
        { type: 'answer', questionId: 'x', optionId: 1, value: 5 },
        'value',
        M.actionValue,
      ],
    ]
    for (const [name, body, field, message] of cases) {
      it(name, async () => {
        const err = expectError(
          await student.post(P('benteng-ilmu', code, '/action'), body),
          'VALIDATION_ERROR',
          message,
        )
        expect(err.fields).toEqual({ [field]: message })
      })
    }

    it('question mismatch 422, roll in a game without dice 409, and the state is untouched by refusals', async () => {
      const before = await stateOf(t.db, code)
      const err = expectError(
        await student.post(P('benteng-ilmu', code, '/action'), {
          type: 'answer',
          questionId: `${qid}9`,
          optionId: 0,
        }),
        'VALIDATION_ERROR',
        M.actionQuestionMismatch,
      )
      expect(err.fields).toEqual({ questionId: M.actionQuestionMismatch })
      expectError(
        await student.post(P('benteng-ilmu', code, '/action'), { type: 'roll' }),
        'CONFLICT',
        M.actionNotYourRoll,
      )
      expect(await stateOf(t.db, code)).toEqual(before)
    })

    it('Papan Bijak: an answer while the dice are awaited is 409; Perang Fakta refuses a vote that is neither', async () => {
      const pb = await started('papan-bijak')
      expectError(
        await student.post(P('papan-bijak', pb.code, '/action'), {
          type: 'answer',
          questionId: '1',
          optionId: 0,
        }),
        'CONFLICT',
        M.actionNoQuestion,
      )
      const pf = await started('perang-fakta')
      const err = expectError(
        await student.post(P('perang-fakta', pf.code, '/action'), {
          type: 'answer',
          questionId: pf.view.question?.id,
          value: 'mungkin',
        }),
        'VALIDATION_ERROR',
        M.actionValue,
      )
      expect(err.fields).toEqual({ value: M.actionValue })
    })

    it('not started 409; non-player 404; non-host player 403 "Bukan giliran anda."', async () => {
      const waiting = await createRoom(student, 'benteng-ilmu', {
        ...FORM,
        match_mode: 'same_level',
      })
      expectError(
        await student.post(P('benteng-ilmu', waiting, '/action'), { type: 'roll' }),
        'CONFLICT',
        M.actionNotStarted,
      )
      expectError(
        await student2.post(P('benteng-ilmu', code, '/action'), { type: 'roll' }),
        'NOT_FOUND',
        M.roomNotFound,
      )
      await student2.post(P('benteng-ilmu', undefined, '/join'), { room_code: waiting })
      await student.post(P('benteng-ilmu', waiting, '/start'))
      const q = (await stateOf(t.db, waiting)).pendingQ
      const err = expectError(
        await student2.post(P('benteng-ilmu', waiting, '/action'), {
          type: 'answer',
          questionId: q,
          optionId: 0,
        }),
        'FORBIDDEN',
        M.actionNotYourTurn,
      )
      expect(err.code).toBe('FORBIDDEN')
      // validation precedes ownership: a bad body is 422 even for a non-player
      expectError(
        await student2.post(P('benteng-ilmu', code, '/action'), { type: 'dance' }),
        'VALIDATION_ERROR',
        M.actionType,
      )
    })
  })

  describe('settlement', () => {
    it('Benteng Ilmu win: standings +1 win for the host, one reward report (35, key = room code), settled once', async () => {
      const { code, view: v0 } = await started('benteng-ilmu', {
        ...FORM,
        match_mode: 'same_level',
      })
      const bot = v0.players.find((p) => p.isBot)
      expect(bot).toBeDefined()
      let v = v0
      while (v.status === 'playing') v = await answerRight('benteng-ilmu', code)
      expect(v.status).toBe('finished')
      expect(v.result).toMatchObject({
        winnerId: student.userId,
        winnerName: 'Murid Demo',
        mvpId: null,
      })
      expect(v.result?.scores.map((s) => s.userId)).toEqual(v.players.map((p) => p.id))
      expect(v.question).toBeUndefined()
      expect(await standing('benteng-ilmu', student.userId)).toMatchObject({ wins: 1, jumlah: 0 })
      expect(await standing('benteng-ilmu', bot?.id as string)).toBeUndefined()
      expect(rewards.calls).toHaveLength(1)
      expect(rewards.calls[0]).toMatchObject({
        userId: student.userId,
        isTest: false,
        input: {
          game: 'benteng_ilmu',
          event: 'win',
          coins: 35,
          xp: 0,
          key: code,
          correct: 3,
          total: 30,
          detail: { rank: 1, roomCode: code },
        },
      })
      const room = await roomOf(t.db, code)
      expect(room.settled_at).not.toBeNull()
      expect(room.finished_at).not.toBeNull()
      expect(room.status).toBe('finished')
      expect(room.result).toMatchObject({ winnerId: student.userId })
    })

    it('replay: polling and acting after the finish never settles again (settle-once)', async () => {
      const { code } = await started('benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      let v: GamesRoomView = await view(student, 'benteng-ilmu', code)
      while (v.status === 'playing') v = await answerRight('benteng-ilmu', code)
      const settledAt = (await roomOf(t.db, code)).settled_at
      for (let i = 0; i < 3; i++) expect(await view(student, 'benteng-ilmu', code)).toEqual(v)
      t.clock.advance(3_600_000)
      expect(await view(student, 'benteng-ilmu', code)).toEqual(v)
      expectError(
        await student.post(P('benteng-ilmu', code, '/action'), {
          type: 'answer',
          questionId: '1',
          optionId: 0,
        }),
        'CONFLICT',
        M.actionNotStarted,
      )
      expect(rewards.calls).toHaveLength(1)
      expect(await standing('benteng-ilmu', student.userId)).toMatchObject({ wins: 2 }) // this room + the previous test's room
      expect((await roomOf(t.db, code)).settled_at).toEqual(settledAt)
      expect(
        await t.db.query(
          `select count(*)::int as n from game_standings where game = 'benteng-ilmu'`,
        ),
      ).toEqual([{ n: 1 }])
    })

    it('Benteng Ilmu loss: 8 coins, event play; a bot winner gets no standing', async () => {
      accuracy.p = 1
      const { code, view: v0 } = await started('benteng-ilmu', {
        ...FORM,
        match_mode: 'same_level',
      })
      const before = (
        await t.db.query<{ n: number }>(`select count(*)::int as n from game_standings`)
      )[0]?.n
      let v = v0
      for (let i = 0; v.status === 'playing' && i < 20; i++) {
        const st = await stateOf(t.db, code)
        const key = (st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex
        v = await act(student, 'benteng-ilmu', code, {
          type: 'answer',
          questionId: st.pendingQ,
          optionId: (key + 1) % 4,
        })
      }
      expect(v.status).toBe('finished')
      expect(v.result?.winnerId).not.toBe(student.userId)
      expect(rewards.calls).toHaveLength(1)
      expect(rewards.calls[0]?.input).toMatchObject({ event: 'play', coins: 8 })
      expect(
        (await t.db.query<{ n: number }>(`select count(*)::int as n from game_standings`))[0]?.n,
      ).toBe(before)
    })

    it('Papan Bijak: wins/jumlah/betul/skor for the acting host only, none for a joined human or bots; coins from the tier rates', async () => {
      accuracy.p = 1
      const code = await createRoom(student, 'papan-bijak', {
        ...PB_FORM,
        match_mode: 'same_level',
      })
      expect(
        (await student2.post(P('papan-bijak', undefined, '/join'), { room_code: code })).status,
      ).toBe(200)
      await student.get(P('papan-bijak', code))
      let v = parseRoom(await student.post(P('papan-bijak', code, '/start')))
      const bot = v.players.find((p) => p.isBot)
      expect(v.players).toHaveLength(2 + (bot ? 1 : 0))
      for (let i = 0; i < 700 && v.status === 'playing'; i++) {
        v =
          v.state?.awaiting === 'roll'
            ? await act(student, 'papan-bijak', code, { type: 'roll' })
            : await answerRight('papan-bijak', code)
      }
      expect(v.status).toBe('finished')
      const humans = v.players.filter((p) => !p.isBot)
      const winnerId = v.result?.winnerId as string
      expect(humans.map((h) => h.id)).toContain(student2.userId)
      for (const h of humans) {
        const row = await standing('papan-bijak', h.id)
        const score = v.result?.scores.find((s) => s.userId === h.id)
        if (h.id !== student.userId) {
          // The joined human never acts (the engine simulates them): no standing from a game they did not play.
          expect(row).toBeUndefined()
          continue
        }
        expect(row).toMatchObject({
          jumlah: 1,
          wins: h.id === winnerId ? 1 : 0,
          skor: score?.points,
        })
      }
      for (const b of v.players.filter((p) => p.isBot))
        expect(await standing('papan-bijak', b.id)).toBeUndefined()
      const mine = v.result?.scores.find((s) => s.userId === student.userId)
      expect(rewards.calls).toHaveLength(1)
      expect(rewards.calls[0]).toMatchObject({
        userId: student.userId,
        isTest: false,
        input: {
          game: 'papan_bijak',
          event: winnerId === student.userId ? 'win' : 'correct',
          coins:
            (mine?.correct ?? 0) * rewards.rates.correct +
            (winnerId === student.userId ? rewards.rates.win : 0),
          xp: 0,
          key: code,
        },
      })
      // points rule: 10 per correct answer + 50 for the winner
      for (const s of v.result?.scores ?? [])
        expect(s.points).toBe(s.correct * 10 + (s.userId === winnerId ? 50 : 0))
    })

    it('Perlumbaan Matematik: 20 right answers win; 5 coins with the rank; players score their steps', async () => {
      const { code } = await started('perlumbaan-matematik')
      let v: GamesRoomView = await view(student, 'perlumbaan-matematik', code)
      for (let i = 0; i < 20 && v.status === 'playing'; i++)
        v = await answerRight('perlumbaan-matematik', code)
      expect(v.status).toBe('finished')
      expect(v.result).toMatchObject({ winnerId: student.userId })
      expect(v.players.find((p) => p.id === student.userId)?.points).toBe(20)
      expect(rewards.calls[0]?.input).toMatchObject({
        game: 'mathrace',
        event: 'play',
        coins: 5,
        detail: { rank: 1 },
      })
      expect(await standing('perlumbaan-matematik', student.userId)).toMatchObject({ wins: 1 })
    })

    it('Perang Fakta: 15 rounds, the host wins with the truth; 10 coins on a win', async () => {
      const { code } = await started('perang-fakta')
      let v: GamesRoomView = await view(student, 'perang-fakta', code)
      for (let i = 0; i < 15 && v.status === 'playing'; i++)
        v = await answerRight('perang-fakta', code)
      expect(v.status).toBe('finished')
      expect(v.players.find((p) => p.id === student.userId)?.points).toBe(15)
      expect(v.state?.roundSecondsLeft).toBeUndefined()
      expect(rewards.calls[0]?.input).toMatchObject({
        game: 'perang_fakta',
        event: 'win',
        coins: 10,
        correct: 15,
        total: 15,
      })
    })

    it('Teka Silang Kata: 8 words typed; 0 coins; the win is recorded', async () => {
      const { code } = await started('teka-silang-kata', { ...FORM, subject: 'BAHASA_INGGERIS' })
      let v: GamesRoomView = await view(student, 'teka-silang-kata', code)
      for (let i = 0; i < 8 && v.status === 'playing'; i++)
        v = await answerRight('teka-silang-kata', code)
      expect(v.status).toBe('finished')
      expect(v.state?.secondsLeft).toBeUndefined()
      expect(rewards.calls[0]?.input).toMatchObject({ game: 'teka_silang_kata', coins: 0 })
      expect(await standing('teka-silang-kata', student.userId)).toMatchObject({ wins: 1 })
    })

    it('Kuiz Relay: 10 rounds over 2 teams; the MVP of the leading team gets the win; 0 coins', async () => {
      accuracy.p = 1
      const { code } = await started('kuiz-relay')
      let v: GamesRoomView = await view(student, 'kuiz-relay', code)
      for (let i = 0; i < 12 && v.status === 'playing'; i++) {
        v = await answerRight('kuiz-relay', code, { seconds: 4 })
      }
      expect(v.status).toBe('finished')
      expect(v.result?.mvpId).not.toBeNull()
      expect(v.state?.teamScores).toBeDefined()
      expect(rewards.calls).toHaveLength(1)
      expect(rewards.calls[0]?.input).toMatchObject({ game: 'kuiz_relay', coins: 0 })
      const mvp = v.result?.mvpId as string
      expect(await standing('kuiz-relay', mvp)).toEqual(
        mvp === student.userId ? expect.objectContaining({ wins: 1 }) : undefined,
      )
    })

    it('Mod Pelajar: the test host never earns (no reward call at all), no standings; rows stay is_test', async () => {
      const mod = await loginAs(t, ACCOUNTS.admin, { mod: true })
      const code = await createRoom(mod, 'benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      await mod.get(P('benteng-ilmu', code))
      let v = parseRoom(await mod.post(P('benteng-ilmu', code, '/start')))
      while (v.status === 'playing') {
        const st = await stateOf(t.db, code)
        const key = (st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex
        v = await act(mod, 'benteng-ilmu', code, {
          type: 'answer',
          questionId: st.pendingQ,
          optionId: key,
        })
      }
      expect(v.result?.winnerId).toBe(mod.userId)
      expect(rewards.calls).toHaveLength(0)
      expect(await standing('benteng-ilmu', mod.userId)).toBeUndefined()
      expect(
        await t.db.query(
          'select is_test, settled_at is not null as settled from game_rooms where code = $1',
          [code],
        ),
      ).toEqual([{ is_test: true, settled: true }])
    })
  })

  describe('server clocks through the API (replay of room-clocks.test.ts)', () => {
    const advance = (seconds: number) => t.clock.advance(seconds * 1000)

    it('Perang Fakta: 10 s round counts down on the server clock; a reload does not reset it', async () => {
      const { code, view: s } = await started('perang-fakta')
      expect(s.state).toMatchObject({ round: 1, roundSecondsLeft: 10 })
      advance(4)
      const a = await view(student, 'perang-fakta', code)
      expect(a.state).toMatchObject({ round: 1, roundSecondsLeft: 6 })
      advance(3)
      const b = await view(student, 'perang-fakta', code)
      expect(b.state?.roundSecondsLeft).toBe(3)
      expect(await view(student, 'perang-fakta', code)).toEqual(b)
    })

    it('a 10 s old round advances as a no-vote on the poll; several rounds after a long absence', async () => {
      const one = await started('perang-fakta')
      advance(10)
      const v = await view(student, 'perang-fakta', one.code)
      expect(v.state).toMatchObject({ round: 2, roundSecondsLeft: 10 })
      expect(v.question?.id).not.toBe(one.view.question?.id)
      expect(v.players.find((p) => p.id === student.userId)?.points).toBe(0)
      expect(await view(student, 'perang-fakta', one.code)).toEqual(v)
      const long = await started('perang-fakta')
      advance(35)
      const l = await view(student, 'perang-fakta', long.code)
      expect(l.state).toMatchObject({ round: 4, roundSecondsLeft: 5 })
    })

    it('a host who never comes back: the room finishes once with a result and settles once, under concurrent polls', async () => {
      const { code } = await started('perang-fakta')
      advance(15 * 10 + 7)
      const polls = await Promise.all([1, 2, 3, 4].map(() => student.get(P('perang-fakta', code))))
      const views = polls.map(parseRoom)
      for (const v of views) {
        expect(v.status).toBe('finished')
        expect(v.result).toBeDefined()
        expect(v.state?.roundSecondsLeft).toBeUndefined()
        expect(v.result?.scores.find((s) => s.userId === student.userId)?.points).toBe(0)
        expect(v).toEqual(views[0])
      }
      advance(60)
      expect(await view(student, 'perang-fakta', code)).toEqual(views[0])
      expect(rewards.calls).toHaveLength(1) // exactly one report for the acting human
      expect(rewards.calls[0]?.input).toMatchObject({ game: 'perang_fakta', correct: 0 })
      expect(rewards.calls[0]?.input.key).toBe(code)
    })

    it('optionId null is the explicit no-vote and restarts the round clock; a real vote scores', async () => {
      const { code, view: s } = await started('perang-fakta')
      const r = await act(student, 'perang-fakta', code, {
        type: 'answer',
        questionId: s.question?.id,
        optionId: null,
        seconds: 0,
      })
      expect(r.state).toMatchObject({ round: 2, roundSecondsLeft: 10 })
      expect(r.players.find((p) => p.id === student.userId)?.points).toBe(0)
      advance(6)
      const st = await stateOf(t.db, code)
      const voted = await act(student, 'perang-fakta', code, {
        type: 'answer',
        questionId: st.pendingQ,
        value: (st.facts[1] as { isTrue: boolean }).isTrue,
        seconds: 6,
      })
      expect(voted.state).toMatchObject({ round: 3, roundSecondsLeft: 10 })
      expect(voted.players.find((p) => p.id === student.userId)?.points).toBe(1)
    })

    it('an answer that arrives after the clock ended the game gets the finished room; a later action is refused', async () => {
      const { code, view: s } = await started('perang-fakta')
      advance(15 * 10 + 1)
      const late = await act(student, 'perang-fakta', code, {
        type: 'answer',
        questionId: s.question?.id,
        optionId: 0,
        seconds: 3,
      })
      expect(late.status).toBe('finished')
      expect(late.result).toBeDefined()
      expectError(
        await student.post(P('perang-fakta', code, '/action'), {
          type: 'answer',
          questionId: s.question?.id,
          optionId: 0,
          seconds: 3,
        }),
        'CONFLICT',
        M.actionNotStarted,
      )
      expect(rewards.calls).toHaveLength(1)
    })

    it('Teka Silang Kata: 300 s from the start; plays on at 299 s; ends once at 301 s with the words found so far', async () => {
      const { code, view: s } = await started('teka-silang-kata', {
        ...FORM,
        subject: 'BAHASA_INGGERIS',
      })
      expect(s.state?.secondsLeft).toBe(300)
      advance(120)
      expect(await view(student, 'teka-silang-kata', code)).toMatchObject({
        status: 'playing',
        state: { secondsLeft: 180 },
      })
      advance(179)
      expect((await view(student, 'teka-silang-kata', code)).status).toBe('playing')
      advance(2)
      const v = await view(student, 'teka-silang-kata', code)
      expect(v.status).toBe('finished')
      expect(v.result).toBeDefined()
      expect(v.state?.secondsLeft).toBeUndefined()
      expect(await view(student, 'teka-silang-kata', code)).toEqual(v)
      expect(rewards.calls).toHaveLength(1)
    })

    it('a word typed after 0:00 gets the finished room (200), not "Permainan belum bermula."', async () => {
      const { code, view: s } = await started('teka-silang-kata', {
        ...FORM,
        subject: 'BAHASA_INGGERIS',
      })
      advance(301)
      const late = await act(student, 'teka-silang-kata', code, {
        type: 'answer',
        questionId: s.question?.id,
        value: 'cat',
        seconds: 0,
      })
      expect(late.status).toBe('finished')
      expect(late.result).toBeDefined()
    })

    it('games without a clock never change on read', async () => {
      const { code, view: s } = await started('benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      advance(3600)
      expect(await view(student, 'benteng-ilmu', code)).toEqual(s)
    })
  })

  describe('concurrency', () => {
    it('two simultaneous answers to the same question: exactly one is applied', async () => {
      const { code } = await started('benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      const st = await stateOf(t.db, code)
      const body = {
        type: 'answer',
        questionId: st.pendingQ,
        optionId: (st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex,
      }
      const res = await Promise.all([
        student.post(P('benteng-ilmu', code, '/action'), body),
        student.post(P('benteng-ilmu', code, '/action'), body),
      ])
      expect(res.map((r) => r.status).sort()).toEqual([200, 422])
      const loser = res.find((r) => r.status === 422)
      expectError(loser as never, 'VALIDATION_ERROR', M.actionQuestionMismatch)
      const after = await stateOf(t.db, code)
      expect(after.round).toBe(2)
    })

    it('two simultaneous winning answers: one settlement, one reward report, one standing win', async () => {
      const { code } = await started('benteng-ilmu', { ...FORM, match_mode: 'same_level' })
      const st = await stateOf(t.db, code)
      const foe = Object.keys(st.meter).find((k) => k !== student.userId) as string
      st.meter[foe] = 20 // one hit from defeat
      await t.db.query('update game_rooms set state = $2::jsonb where code = $1', [
        code,
        JSON.stringify(st),
      ])
      const body = {
        type: 'answer',
        questionId: st.pendingQ,
        optionId: (st.qs[st.pendingQ as string] as { keyIndex: number }).keyIndex,
      }
      const res = await Promise.all(
        [1, 2, 3].map(() => student.post(P('benteng-ilmu', code, '/action'), body)),
      )
      expect(res.filter((r) => r.status === 200)).toHaveLength(1)
      for (const r of res.filter((x) => x.status !== 200)) expect([409, 422]).toContain(r.status)
      expect(parseRoom(res.find((r) => r.status === 200) as never).status).toBe('finished')
      expect(rewards.calls.filter((c) => c.input.key === code)).toHaveLength(1)
      expect(
        await t.db.query(
          `select count(*)::int as n from game_rooms where code = $1 and settled_at is not null`,
          [code],
        ),
      ).toEqual([{ n: 1 }])
    })
  })
})
