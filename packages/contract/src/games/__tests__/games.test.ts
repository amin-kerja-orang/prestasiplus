import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import {
  GAMES_COMPONENT_SCHEMAS,
} from '../paths'
import {
  GAMES_LEAGUE_LABELS,
  GAMES_MESSAGES,
  GAMES_ROOM_GAMES,
  GAMES_ROOM_LIMITS,
  GAMES_SOLO_GAMES,
  GAMES_SOLO_PAYLOAD_SCHEMAS,
  GAMES_SOLO_SUBMIT_SCHEMAS,
  GamesAdminOverviewSchema,
  GamesAdminSettingsResultSchema,
  GamesAdminSettingsUpdateRequestSchema,
  GamesHubSchema,
  GamesJutawanAnswerRequestSchema,
  GamesJutawanAnswerResponseSchema,
  GamesJutawanLifelineRequestSchema,
  GamesJutawanLifelineResponseSchema,
  GamesJutawanPageSchema,
  GamesJutawanStartRequestSchema,
  GamesJutawanStartResponseSchema,
  GamesKeylessQuestionSchema,
  GamesLeagueCreateRequestSchema,
  GamesLeagueDetailSchema,
  GamesLeagueIdResultSchema,
  GamesLeagueJoinRequestSchema,
  GamesLeagueListSchema,
  GamesLobbySchema,
  GamesQuickMatchCancelResponseSchema,
  GamesQuickMatchPollResponseSchema,
  GamesQuickMatchStartRequestSchema,
  GamesQuickMatchStartResponseSchema,
  GamesRawErrorSchema,
  GamesRawMessageSchema,
  GamesRoomActionRequestSchema,
  GamesRoomCodeResultSchema,
  GamesRoomCreateRequestSchema,
  GamesRoomJoinRequestSchema,
  GamesRoomViewSchema,
  GamesSekolahBersaingSchema,
  GamesSoloPayloadSchema,
  GamesSoloQuerySchema,
  GamesSoloSubmitRequestSchema,
  GamesSoloSubmitResponseSchema,
  GamesSpinPageSchema,
  GamesSpinRefusedSchema,
  GamesSpinResponseSchema,
  GamesUjiMindaSchema,
  GamesWeeklyCompetitionSchema,
  gamesRoomCreateRequestFor,
  gamesRoomMaxPlayers,
} from '../schema'

const SESSION = '3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f'

/** First issue message and path of a failed parse. */
const firstIssue = (schema: { safeParse: (v: unknown) => { success: boolean; error?: { issues: { message: string; path: PropertyKey[] }[] } } }, v: unknown) => {
  const r = schema.safeParse(v)
  expect(r.success).toBe(false)
  const issue = r.error?.issues[0]
  return { message: issue?.message, path: issue?.path.map(String).join('.') }
}
const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(schema.safeParse(v).success).toBe(true)
const rejected = (schema: { safeParse: (v: unknown) => { success: boolean } }, v: unknown) =>
  expect(schema.safeParse(v).success).toBe(false)

// ---- fictitious fixtures (no real names) -------------------------------------------------------------------

const question = {
  id: '9001',
  text: 'Berapakah 7 + 5?',
  options: [
    { id: 0, label: 'A', text: '10' },
    { id: 1, label: 'B', text: '12' },
    { id: 2, label: 'C', text: '13' },
    { id: 3, label: 'D', text: '15' },
  ],
}
const player = (id: string, name: string, isBot = false) => ({ id, name, grade: 'Darjah 4', points: 0, isBot })
const settings = {
  subject: 'MATEMATIK',
  gradeLevel: 'DARJAH_4',
  matchMode: 'same_grade',
  gradeMin: null,
  gradeMax: null,
  maxPlayers: 4,
  minPlayers: 2,
}
const waitingRoom = {
  code: 'PB1234',
  game: 'papan-bijak',
  status: 'waiting',
  host: { id: '101', name: 'Aiman Fiktif' },
  players: [player('101', 'Aiman Fiktif')],
  settings,
  state: null,
}
const playingRoom = {
  ...waitingRoom,
  status: 'playing',
  players: [player('101', 'Aiman Fiktif'), player('102', 'Balqis Rekaan', true)],
  state: {
    awaiting: 'roll',
    round: 1,
    total: 0,
    humanId: '101',
    board: ['start', 'plain', 'ladder:12', 'snake:7', 'bonus', 'trap', 'quiz', 'finish'],
    positions: { '101': 1, '102': 1 },
    log: [],
  },
  round: 1,
}
const finishedRoom = {
  ...playingRoom,
  status: 'finished',
  state: { ...playingRoom.state, awaiting: null },
  result: {
    winnerId: '101',
    winnerName: 'Aiman Fiktif',
    mvpId: null,
    scores: [
      { userId: '101', name: 'Aiman Fiktif', points: 60, correct: 5 },
      { userId: '102', name: 'Balqis Rekaan', points: 30, correct: 3 },
    ],
  },
}

// ---- hub, lobby ----------------------------------------------------------------------------------------------------

describe('hub and lobby (M16-22, M16-23)', () => {
  it('parses the hub and rejects more than 6 open rooms and extra fields', () => {
    const room = { game: 'papan-bijak', code: 'PB1234', host: 'Aiman Fiktif', players: 1, max: 4 }
    ok(GamesHubSchema, { openRooms: [room], chips: { papanBijakPlayed: false, battled: false } })
    ok(GamesHubSchema, { openRooms: [], chips: { papanBijakPlayed: true, battled: true } })
    rejected(GamesHubSchema, { openRooms: Array(7).fill(room), chips: { papanBijakPlayed: false, battled: false } })
    rejected(GamesHubSchema, { openRooms: [{ ...room, game: 'battle' }], chips: { papanBijakPlayed: false, battled: false } })
    rejected(GamesHubSchema, { openRooms: [{ ...room, code: 'pb12' }], chips: { papanBijakPlayed: false, battled: false } })
    rejected(GamesHubSchema, { openRooms: [], chips: { papanBijakPlayed: false } })
  })

  it('parses the Papan Bijak lobby (top10) and the other lobbies (leaders), never both', () => {
    const top = {
      rank: 1,
      userId: '101',
      name: 'Aiman Fiktif Ra...',
      initials: 'AF',
      menang: 4,
      jumlah: 6,
      kadar: 67,
      skor: 90,
      betul: 13,
    }
    ok(GamesLobbySchema, { autoGrade: 'DARJAH_4', autoGradeName: 'Darjah 4', top10: [top] })
    ok(GamesLobbySchema, { autoGrade: null, autoGradeName: null, top10: [] })
    ok(GamesLobbySchema, {
      autoGrade: 'TINGKATAN_2',
      autoGradeName: 'Tingkatan 2',
      leaders: [{ rank: 1, userId: '102', name: 'Balqis Rekaan', value: 5 }],
    })
    rejected(GamesLobbySchema, { autoGrade: 'DARJAH_4', autoGradeName: 'Darjah 4', top10: [top], leaders: [] })
    rejected(GamesLobbySchema, { autoGrade: 'DARJAH_9', autoGradeName: 'Darjah 9', leaders: [] })
    rejected(GamesLobbySchema, { autoGrade: null, autoGradeName: null })
    rejected(GamesLobbySchema, { autoGrade: null, autoGradeName: null, top10: Array(11).fill(top) })
    rejected(GamesLobbySchema, { autoGrade: null, autoGradeName: null, top10: [{ ...top, kadar: 101 }] })
  })

  it('D54(d): leaderboard rows carry a display name only, never another personal field', () => {
    const leader = { rank: 1, userId: '102', name: 'Balqis Rekaan', value: 5 }
    for (const extra of [{ email: 'a@b.my' }, { icNumber: '000000-00-0000' }, { phone: '0123456789' }, { birthDate: '2015-01-01' }]) {
      rejected(GamesLobbySchema, { autoGrade: null, autoGradeName: null, leaders: [{ ...leader, ...extra }] })
    }
  })
})

// ---- rooms ------------------------------------------------------------------------------------------------------------

describe('create room (M16-24)', () => {
  const body = { subject: 'MATEMATIK', grade_level: 'DARJAH_4', match_mode: 'same_grade', max_players: 4 }

  it('parses the base body and the per-game rules', () => {
    ok(GamesRoomCreateRequestSchema, body)
    ok(gamesRoomCreateRequestFor('papan-bijak'), body)
    ok(gamesRoomCreateRequestFor('papan-bijak'), { ...body, match_mode: 'custom', grade_min: 3, grade_max: 5 })
    ok(gamesRoomCreateRequestFor('benteng-ilmu'), { subject: 'SEJARAH', grade_level: 'TINGKATAN_1', match_mode: 'same_level' })
  })

  it('refuses with the exact BM messages, per field', () => {
    expect(firstIssue(gamesRoomCreateRequestFor('papan-bijak'), { ...body, subject: 'SEJARAH' })).toEqual({
      message: 'Subjek tidak sah.',
      path: 'subject',
    })
    expect(firstIssue(GamesRoomCreateRequestSchema, { ...body, subject: 'FIZIK' }).message).toBe('Subjek tidak sah.')
    expect(firstIssue(GamesRoomCreateRequestSchema, { ...body, grade_level: 'DARJAH_7' })).toEqual({
      message: 'Tahap soalan tidak sah.',
      path: 'grade_level',
    })
    expect(firstIssue(GamesRoomCreateRequestSchema, { ...body, grade_level: 'TINGKATAN_6' }).message).toBe('Tahap soalan tidak sah.')
    expect(firstIssue(GamesRoomCreateRequestSchema, { ...body, match_mode: 'any' })).toEqual({
      message: 'Julat tahap tidak sah.',
      path: 'match_mode',
    })
    // custom is for Papan Bijak only
    expect(firstIssue(gamesRoomCreateRequestFor('kuiz-relay'), { ...body, match_mode: 'custom', grade_min: 1, grade_max: 2 }).path).toBe('match_mode')
    expect(
      firstIssue(GamesRoomCreateRequestSchema, { ...body, match_mode: 'custom', grade_min: 5, grade_max: 3 }),
    ).toEqual({ message: 'Julat tahap tidak sah.', path: 'grade_min' })
    expect(firstIssue(GamesRoomCreateRequestSchema, { ...body, match_mode: 'custom' }).path).toBe('grade_min')
    expect(firstIssue(GamesRoomCreateRequestSchema, { ...body, match_mode: 'custom', grade_min: 0, grade_max: 3 }).message).toBe(
      'Julat tahap tidak sah.',
    )
    expect(firstIssue(GamesRoomCreateRequestSchema, { ...body, match_mode: 'custom', grade_min: 1, grade_max: 12 }).message).toBe(
      'Julat tahap tidak sah.',
    )
  })

  it('Papan Bijak needs max_players 2..6; other games ignore it', () => {
    expect(firstIssue(gamesRoomCreateRequestFor('papan-bijak'), { ...body, max_players: 1 })).toEqual({
      message: 'Bilangan pemain tidak sah.',
      path: 'max_players',
    })
    expect(firstIssue(gamesRoomCreateRequestFor('papan-bijak'), { ...body, max_players: 7 }).message).toBe('Bilangan pemain tidak sah.')
    expect(firstIssue(gamesRoomCreateRequestFor('papan-bijak'), { ...body, max_players: 2.5 }).message).toBe('Bilangan pemain tidak sah.')
    const { max_players: _omit, ...noMax } = body
    void _omit
    expect(firstIssue(gamesRoomCreateRequestFor('papan-bijak'), noMax).path).toBe('max_players')
    ok(gamesRoomCreateRequestFor('perang-fakta'), noMax)
  })

  it('fixed maximum players per game (Perang Fakta 6, Benteng Ilmu 2, Perlumbaan 4, Kuiz Relay 8, Teka Silang Kata 2)', () => {
    expect(gamesRoomMaxPlayers('perang-fakta', 3)).toBe(6)
    expect(gamesRoomMaxPlayers('benteng-ilmu')).toBe(2)
    expect(gamesRoomMaxPlayers('perlumbaan-matematik')).toBe(4)
    expect(gamesRoomMaxPlayers('kuiz-relay')).toBe(8)
    expect(gamesRoomMaxPlayers('teka-silang-kata')).toBe(2)
    expect(gamesRoomMaxPlayers('papan-bijak', 5)).toBe(5)
    expect(GAMES_ROOM_LIMITS['kuiz-relay'].minPlayers).toBe(4)
    expect(Object.keys(GAMES_ROOM_LIMITS)).toEqual([...GAMES_ROOM_GAMES])
  })

  it('answers {code} with a 6-character room code', () => {
    ok(GamesRoomCodeResultSchema, { code: 'AB12CD' })
    rejected(GamesRoomCodeResultSchema, { code: 'AB12C' })
    rejected(GamesRoomCodeResultSchema, { code: 'ab12cd' })
    rejected(GamesRoomCodeResultSchema, { code: 'AB12CD', extra: 1 })
  })
})

describe('join room (M16-25)', () => {
  it('takes room_code (the server trims and upper-cases; every refusal is 404)', () => {
    ok(GamesRoomJoinRequestSchema, { room_code: ' pb1234 ' })
    ok(GamesRoomJoinRequestSchema, { room_code: '' })
    rejected(GamesRoomJoinRequestSchema, {})
    rejected(GamesRoomJoinRequestSchema, { room_code: 1234 })
  })
})

describe('room view (M16-26 to M16-28)', () => {
  it('parses a waiting, a playing and a finished room', () => {
    ok(GamesRoomViewSchema, waitingRoom)
    ok(GamesRoomViewSchema, { ...playingRoom, question: question })
    ok(GamesRoomViewSchema, finishedRoom)
  })

  it('parses the timed games (Perang Fakta statements, Teka Silang Kata clue, Kuiz Relay teams)', () => {
    const base = { ...playingRoom, state: { awaiting: 'answer', round: 3, total: 15, humanId: '101', log: [] } }
    ok(GamesRoomViewSchema, {
      ...base,
      game: 'perang-fakta',
      state: { ...base.state, meter: { '101': 2 }, roundSecondsLeft: 7 },
      question: {
        id: '9002',
        text: 'Bumi itu leper.',
        options: [
          { id: 0, label: 'A', text: 'Betul' },
          { id: 1, label: 'B', text: 'Salah' },
        ],
      },
    })
    ok(GamesRoomViewSchema, {
      ...base,
      game: 'teka-silang-kata',
      state: { ...base.state, meter: { '101': 1 }, secondsLeft: 240 },
      question: { id: '9003', text: 'Ibu negara Malaysia?', options: [] },
    })
    ok(GamesRoomViewSchema, {
      ...base,
      game: 'kuiz-relay',
      players: [{ ...player('101', 'Aiman Fiktif'), team: 1 }],
      state: { ...base.state, teamScores: { '1': 20, '2': 10 } },
    })
  })

  it('rejects unknown tiles, statuses and extra players fields (D54(d))', () => {
    rejected(GamesRoomViewSchema, { ...playingRoom, state: { ...playingRoom.state, board: ['lava'] } })
    rejected(GamesRoomViewSchema, { ...waitingRoom, status: 'open' })
    rejected(GamesRoomViewSchema, { ...waitingRoom, players: [{ ...player('101', 'Aiman Fiktif'), email: 'x@y.my' }] })
    rejected(GamesRoomViewSchema, { ...waitingRoom, players: [{ ...player('101', 'Aiman Fiktif'), icNumber: '1' }] })
  })

  it('never carries an answer key before answering: engine internals and key fields are rejected', () => {
    // keyless question: any key-bearing field is refused (strict)
    ok(GamesKeylessQuestionSchema, question)
    for (const leak of [
      { correct: true },
      { is_correct: true },
      { isCorrect: true },
      { correctAnswer: 1 },
      { correctOptionId: 1 },
      { answer: '12' },
      { explanation: 'Kerana 7 + 5 = 12.' },
    ]) {
      rejected(GamesKeylessQuestionSchema, { ...question, ...leak })
      rejected(GamesKeylessQuestionSchema, { ...question, options: [{ ...question.options[0], ...leak }, ...question.options.slice(1)] })
      rejected(GamesRoomViewSchema, { ...playingRoom, question: { ...question, ...leak } })
    }
    // the engine document (pool, cursor, pending question, crossword words, facts) is internal
    for (const leak of [{ qIds: ['1'] }, { cursor: 2 }, { pendingQ: '9001' }, { words: [{ qId: '1', answer: 'KL' }] }, { facts: [{ qId: '1', text: 'x', isTrue: true }] }]) {
      rejected(GamesRoomViewSchema, { ...playingRoom, state: { ...playingRoom.state, ...leak } })
    }
    // at most four options, label A to D, option ids 0..3
    rejected(GamesKeylessQuestionSchema, { ...question, options: [...question.options, { id: 4, label: 'D', text: 'x' }] })
    rejected(GamesKeylessQuestionSchema, { ...question, options: [{ id: 0, label: 'E', text: 'x' }] })
  })

  it('the OpenAPI schemas of the room view and Jutawan question routes contain no answer-key property', () => {
    const doc = buildOpenApiDocument() as { components: { schemas: Record<string, unknown> } }
    const forbidden = new Set(['correct', 'is_correct', 'isCorrect', 'correctAnswer', 'correct_answer', 'correctOptionId', 'answer', 'is_true', 'explanation', 'pair_id'])
    const seen = new Set<string>()
    const props = new Set<string>()
    const walk = (node: unknown): void => {
      if (Array.isArray(node)) return void node.forEach(walk)
      if (node === null || typeof node !== 'object') return
      const rec = node as Record<string, unknown>
      if (typeof rec.$ref === 'string') {
        const name = rec.$ref.replace('#/components/schemas/', '')
        if (!seen.has(name)) {
          seen.add(name)
          walk(doc.components.schemas[name])
        }
        return
      }
      if (rec.properties && typeof rec.properties === 'object') {
        // a numeric `correct` is a count of correct answers (room result), not a key; keys are booleans or text
        for (const [k, v] of Object.entries(rec.properties as Record<string, { type?: string }>)) {
          if (!(k === 'correct' && v.type === 'integer')) props.add(k)
        }
      }
      Object.values(rec).forEach(walk)
    }
    for (const root of ['GamesRoomView', 'GamesJutawanStartResponse', 'GamesKeylessQuestion']) {
      seen.add(root)
      walk(doc.components.schemas[root])
    }
    // Jutawan answer: `correct` (boolean) describes the answer just given, so only its `next` question is checked
    walk((doc.components.schemas.GamesJutawanAnswerResponse as { properties: { next: unknown } }).properties.next)
    expect([...props].filter((p) => forbidden.has(p))).toEqual([])
    expect(props.has('options')).toBe(true) // the walk did reach the question options
  })
})

describe('room action (M16-28)', () => {
  it('parses roll and answer (perang-fakta boolean, crossword word, seconds default 15)', () => {
    ok(GamesRoomActionRequestSchema, { type: 'roll' })
    ok(GamesRoomActionRequestSchema, { type: 'answer', questionId: '9001', optionId: 1 })
    ok(GamesRoomActionRequestSchema, { type: 'answer', questionId: '9001', optionId: null, value: true, seconds: 3.5 })
    ok(GamesRoomActionRequestSchema, { type: 'answer', questionId: '9003', value: 'KUALA LUMPUR', seconds: 0 })
  })

  it('refuses with the exact BM messages', () => {
    expect(firstIssue(GamesRoomActionRequestSchema, { type: 'jump' }).message).toBe('Tindakan tidak sah.')
    expect(firstIssue(GamesRoomActionRequestSchema, {}).message).toBe('Tindakan tidak sah.')
    expect(firstIssue(GamesRoomActionRequestSchema, { type: 'answer' })).toEqual({ message: 'Soalan tidak sah.', path: 'questionId' })
    expect(firstIssue(GamesRoomActionRequestSchema, { type: 'answer', questionId: 5 }).message).toBe('Soalan tidak sah.')
    expect(firstIssue(GamesRoomActionRequestSchema, { type: 'answer', questionId: '1', optionId: 4 })).toEqual({
      message: 'Pilihan tidak sah.',
      path: 'optionId',
    })
    expect(firstIssue(GamesRoomActionRequestSchema, { type: 'answer', questionId: '1', optionId: -1 }).message).toBe('Pilihan tidak sah.')
    expect(firstIssue(GamesRoomActionRequestSchema, { type: 'answer', questionId: '1', seconds: -1 })).toEqual({
      message: 'Masa tidak sah.',
      path: 'seconds',
    })
    expect(firstIssue(GamesRoomActionRequestSchema, { type: 'answer', questionId: '1', value: 5 })).toEqual({
      message: 'Jawapan tidak sah.',
      path: 'value',
    })
  })
})

// ---- quick match (raw) --------------------------------------------------------------------------------------------

describe('Papan Bijak quick match (M16-29 to M16-31, raw bodies)', () => {
  it('validates the start body with the raw messages', () => {
    ok(GamesQuickMatchStartRequestSchema, { subject: 'SAINS', match_mode: 'same_level' })
    expect(firstIssue(GamesQuickMatchStartRequestSchema, { subject: 'SEJARAH', match_mode: 'same_grade' }).message).toBe('Subjek tidak sah.')
    expect(firstIssue(GamesQuickMatchStartRequestSchema, { subject: 'SAINS', match_mode: 'custom' }).message).toBe('Padanan tidak sah.')
    expect(firstIssue(GamesQuickMatchStartRequestSchema, {}).message).toBe('Subjek tidak sah.')
  })

  it('answers raw {status} bodies (no data envelope) and a raw {error} refusal', () => {
    ok(GamesQuickMatchStartResponseSchema, { status: 'searching' })
    rejected(GamesQuickMatchStartResponseSchema, { data: { status: 'searching' } })
    for (const status of ['searching', 'expired', 'cancelled']) ok(GamesQuickMatchPollResponseSchema, { status })
    ok(GamesQuickMatchPollResponseSchema, { status: 'matched', room_code: 'AB12CD' })
    rejected(GamesQuickMatchPollResponseSchema, { status: 'matched' })
    rejected(GamesQuickMatchPollResponseSchema, { status: 'searching', room_code: 'AB12CD' })
    ok(GamesQuickMatchCancelResponseSchema, { status: 'cancelled' })
    rejected(GamesQuickMatchCancelResponseSchema, { status: 'searching' })
    ok(GamesRawErrorSchema, { error: 'Subjek tidak sah.' })
    rejected(GamesRawErrorSchema, { error: { code: 'VALIDATION_ERROR', message: 'x' } })
  })
})

// ---- solo games (raw submit) --------------------------------------------------------------------------------------------

describe('single-player games (M16-32, M16-33)', () => {
  const base = { sessionId: SESSION, personalBest: 38, canEarnSyiling: true }
  const payloads = {
    'betul-salah': { ...base, statements: [{ id: '9001', statement: '7 + 5 → 12', is_true: true, difficulty: 1 }] },
    'cabaran-kilat': {
      ...base,
      questions: [
        {
          id: '9001',
          question_text: 'Berapakah 7 + 5?',
          difficulty: 2,
          options: [
            { id: 0, text: '10', correct: false },
            { id: 1, text: '12', correct: true },
          ],
        },
      ],
    },
    'tembak-jawapan': {
      ...base,
      questions: [{ id: '9001', question: 'Berapakah 7 + 5?', difficulty: 1, options: [{ text: '12', correct: true }, { text: '13', correct: false }] }],
    },
    'susun-jawapan': {
      ...base,
      puzzles: [{ id: '9001', question: 'Ibu negara Malaysia?', answer: 'KUALA LUMPUR', scrambled: ['LUMPUR', 'KUALA'], type: 'words', difficulty: 1, points: 6 }],
    },
    'kad-memori': {
      ...base,
      cards: [
        { id: 1, pair_id: 0, type: 'question', content: '7 + 5', difficulty: 1 },
        { id: 2, pair_id: 0, type: 'answer', content: '12', difficulty: 1 },
      ],
    },
  } as const

  it('parses each payload with its own schema and the union', () => {
    for (const game of GAMES_SOLO_GAMES) {
      ok(GAMES_SOLO_PAYLOAD_SCHEMAS[game], payloads[game])
      ok(GamesSoloPayloadSchema, payloads[game])
      for (const other of GAMES_SOLO_GAMES) if (other !== game) rejected(GAMES_SOLO_PAYLOAD_SCHEMAS[other], payloads[game])
    }
  })

  it('SEC-M16-01 (replicated, Open question 8): the answer-key fields ARE explicit in the solo payloads and required', () => {
    rejected(GAMES_SOLO_PAYLOAD_SCHEMAS['betul-salah'], { ...base, statements: [{ id: '1', statement: 's', difficulty: 1 }] })
    rejected(GAMES_SOLO_PAYLOAD_SCHEMAS['susun-jawapan'], { ...base, puzzles: [{ id: '1', question: 'q', scrambled: [], type: 'words', difficulty: 1, points: 3 }] })
    rejected(GAMES_SOLO_PAYLOAD_SCHEMAS['kad-memori'], { ...base, cards: [{ id: 1, type: 'question', content: 'c', difficulty: 1 }] })
    // and nothing else rides along
    rejected(GAMES_SOLO_PAYLOAD_SCHEMAS['betul-salah'], { ...payloads['betul-salah'], explanation: 'x' })
  })

  it('bounds item counts (40 / 30 / 30 / 20 / 12) and ids', () => {
    const s = payloads['betul-salah'].statements[0]
    rejected(GAMES_SOLO_PAYLOAD_SCHEMAS['betul-salah'], { ...base, statements: Array(41).fill(s) })
    ok(GAMES_SOLO_PAYLOAD_SCHEMAS['betul-salah'], { ...base, statements: Array(40).fill(s) })
    rejected(GAMES_SOLO_PAYLOAD_SCHEMAS['kad-memori'], { ...base, cards: Array(13).fill(payloads['kad-memori'].cards[0]) })
    rejected(GamesSoloPayloadSchema, { ...payloads['betul-salah'], sessionId: 'tf_abc' }) // uuid in v2
  })

  it('validates the darjah query (1..11) with "Tahap tidak sah."', () => {
    ok(GamesSoloQuerySchema, {})
    ok(GamesSoloQuerySchema, { darjah: '11' })
    for (const darjah of ['0', '12', '2.5', 'abc']) {
      expect(firstIssue(GamesSoloQuerySchema, { darjah })).toEqual({ message: 'Tahap tidak sah.', path: 'darjah' })
    }
  })

  it('parses a submit body per game; each game rejects the bodies of the others', () => {
    const bodies = {
      'betul-salah': { session_id: SESSION, correct_count: 8, total_answered: 10, streak: 5, score: 120, syiling_earned: 20 },
      'cabaran-kilat': { session_id: SESSION, correct_count: 8, total_answered: 10, max_combo: 5, score: 120, syiling_earned: 20 },
      'tembak-jawapan': { session_id: SESSION, correct_count: 8, total_answered: 10, max_level: 2, score: 120, syiling_earned: 12 },
      'susun-jawapan': { session_id: SESSION, solved_count: 5, total_puzzles: 8, score: 30, syiling_earned: 10 },
      'kad-memori': { session_id: SESSION, matches: 6, total_pairs: 6, moves: 9, time_seconds: 41 },
    } as const
    for (const game of GAMES_SOLO_GAMES) {
      ok(GAMES_SOLO_SUBMIT_SCHEMAS[game], bodies[game])
      ok(GamesSoloSubmitRequestSchema, bodies[game])
      for (const other of GAMES_SOLO_GAMES) if (other !== game) rejected(GAMES_SOLO_SUBMIT_SCHEMAS[other], bodies[game])
    }
    rejected(GAMES_SOLO_SUBMIT_SCHEMAS['kad-memori'], { ...bodies['kad-memori'], matches: 5 })
    rejected(GAMES_SOLO_SUBMIT_SCHEMAS['kad-memori'], { ...bodies['kad-memori'], moves: 5 })
    rejected(GAMES_SOLO_SUBMIT_SCHEMAS['betul-salah'], { ...bodies['betul-salah'], score: -1 })
    rejected(GAMES_SOLO_SUBMIT_SCHEMAS['tembak-jawapan'], { ...bodies['tembak-jawapan'], max_level: 0 })
  })

  it('answers raw bodies: {is_new_record, syiling_awarded}, Kad Memori {results}, and raw {message} refusals', () => {
    ok(GamesSoloSubmitResponseSchema, { is_new_record: true, syiling_awarded: 5 })
    ok(GamesSoloSubmitResponseSchema, { results: { syiling_earned: 6, accuracy: 67 } })
    rejected(GamesSoloSubmitResponseSchema, { data: { is_new_record: true, syiling_awarded: 5 } })
    rejected(GamesSoloSubmitResponseSchema, { results: { syiling_earned: 6, accuracy: 101 } })
    ok(GamesRawMessageSchema, { message: GAMES_MESSAGES.soloInvalidResult })
    ok(GamesRawMessageSchema, { message: GAMES_MESSAGES.soloAlreadySubmitted })
    expect(GAMES_MESSAGES.soloInvalidResult).toBe('Keputusan tidak sah.')
    expect(GAMES_MESSAGES.soloAlreadySubmitted).toBe('Keputusan sudah dihantar.')
    rejected(GamesRawMessageSchema, { error: { code: 'CONFLICT', message: 'x' } })
  })
})

// ---- Roda Nasib ------------------------------------------------------------------------------------------------------------

describe('Roda Nasib (M16-34, M16-35)', () => {
  const labels = ['1 Syiling', '3 Syiling', '5 Syiling', '10 Syiling', '20 Syiling', 'Cuba Lagi', '2 Syiling', '7 Syiling']
  const values = [1, 3, 5, 10, 20, 0, 2, 7]
  const weights = [25, 20, 15, 8, 3, 15, 10, 4]
  const segments = labels.map((label, i) => ({
    label,
    type: values[i] === 0 ? 'nothing' : 'syiling',
    value: values[i],
    weight: weights[i],
    color: '#3b82f6',
    icon: '🪙',
  }))

  it('parses the page with the 8 fixed segments (weights sum to 100)', () => {
    ok(GamesSpinPageSchema, { segments, spins: 2, won: 0, alreadySpun: false, canEarnSyiling: true })
    expect(weights.reduce((a, b) => a + b, 0)).toBe(100)
    rejected(GamesSpinPageSchema, { segments: segments.slice(1), spins: 0, won: 0, alreadySpun: false, canEarnSyiling: true })
  })

  it('answers a raw success body and a raw 409 body', () => {
    ok(GamesSpinResponseSchema, {
      success: true,
      message: '',
      result: { segment_index: 2, label: '5 Syiling', icon: '💎', type: 'syiling', value: 5 },
      coinsCredited: 5,
    })
    rejected(GamesSpinResponseSchema, {
      success: true,
      message: '',
      result: { segment_index: 8, label: 'x', icon: 'x', type: 'syiling', value: 5 },
      coinsCredited: 5,
    })
    rejected(GamesSpinResponseSchema, { data: { success: true } })
    ok(GamesSpinRefusedSchema, { success: false, message: 'Anda sudah spin hari ini.' })
    expect(GAMES_MESSAGES.spinAlreadySpun).toBe('Anda sudah spin hari ini.')
    rejected(GamesSpinRefusedSchema, { success: true, message: 'x' })
  })
})

// ---- Jutawan Ilmu ----------------------------------------------------------------------------------------------------------

describe('Jutawan Ilmu (M16-36 to M16-39)', () => {
  it('parses the page with and without darjah', () => {
    ok(GamesJutawanPageSchema, { bestLevel: 0, games: 0 })
    ok(GamesJutawanPageSchema, {
      bestLevel: 9,
      games: 3,
      heading: 'DARJAH 4',
      subjects: [{ id: '3', name: 'Matematik', emoji: '🔢', colour: '#10b981', count: 120 }],
    })
    rejected(GamesJutawanPageSchema, { bestLevel: 16, games: 0 })
  })

  it('start: body rules and a keyless first question (200)', () => {
    ok(GamesJutawanStartRequestSchema, { subject: '3', darjah: 4 })
    rejected(GamesJutawanStartRequestSchema, { subject: '3', darjah: 12 })
    rejected(GamesJutawanStartRequestSchema, { darjah: 4 })
    ok(GamesJutawanStartResponseSchema, { sessionId: SESSION, index: 1, question, lifelines: 3 })
    rejected(GamesJutawanStartResponseSchema, { sessionId: SESSION, index: 1, question: { ...question, correct: 1 }, lifelines: 3 })
    rejected(GamesJutawanStartResponseSchema, { sessionId: SESSION, index: 2, question, lifelines: 3 })
  })

  it('answer: next question is keyless; a wrong answer or level 15 ends with result; one of them only', () => {
    ok(GamesJutawanAnswerRequestSchema, { questionId: '9001', optionId: 1 })
    expect(firstIssue(GamesJutawanAnswerRequestSchema, { questionId: '9001', optionId: 4 })).toEqual({
      message: 'Pilihan tidak sah.',
      path: 'optionId',
    })
    ok(GamesJutawanAnswerResponseSchema, { correct: true, level: 3, next: question })
    ok(GamesJutawanAnswerResponseSchema, { correct: false, level: 3, result: { level: 3, credited: 0 } })
    ok(GamesJutawanAnswerResponseSchema, { correct: true, level: 15, result: { level: 15, credited: 1000 } })
    rejected(GamesJutawanAnswerResponseSchema, { correct: true, level: 3 })
    rejected(GamesJutawanAnswerResponseSchema, { correct: true, level: 3, next: question, result: { level: 3, credited: 0 } })
    rejected(GamesJutawanAnswerResponseSchema, { correct: true, level: 3, next: { ...question, answer: '12' } })
  })

  it('lifeline: only 50:50, two removed options', () => {
    ok(GamesJutawanLifelineRequestSchema, { type: '50:50' })
    expect(firstIssue(GamesJutawanLifelineRequestSchema, { type: 'phone' })).toEqual({ message: 'Bantuan tidak sah.', path: 'type' })
    ok(GamesJutawanLifelineResponseSchema, { removedOptionIds: [0, 2], lifelines: 2 })
    rejected(GamesJutawanLifelineResponseSchema, { removedOptionIds: [0, 1, 2], lifelines: 2 })
    rejected(GamesJutawanLifelineResponseSchema, { removedOptionIds: [4], lifelines: 2 })
  })
})

// ---- weekly, Uji Minda ----------------------------------------------------------------------------------------------------------

describe('weekly competition and Uji Minda (M16-40, M16-41)', () => {
  const week = {
    weekStart: '2026-10-19',
    weekEnd: '2026-10-25',
    endsAt: '2026-10-25T23:59:59+08:00',
    prizes: [100, 50, 25],
    me: { rank: 4, betul: 40 },
    rows: [{ rank: 1, userId: '101', name: 'Aiman Fiktif', sesi: 5, betul: 90, tepat: 88.5 }],
  }
  it('parses the board (top 20, me nullable) and refuses other personal fields', () => {
    ok(GamesWeeklyCompetitionSchema, week)
    ok(GamesWeeklyCompetitionSchema, { ...week, me: null, rows: [] })
    rejected(GamesWeeklyCompetitionSchema, { ...week, rows: Array(21).fill(week.rows[0]) })
    rejected(GamesWeeklyCompetitionSchema, { ...week, endsAt: '2026-10-25T15:59:59Z' })
    rejected(GamesWeeklyCompetitionSchema, { ...week, rows: [{ ...week.rows[0], email: 'x@y.my' }] })
  })
  it('Uji Minda is the constant { challenge: null }', () => {
    ok(GamesUjiMindaSchema, { challenge: null })
    rejected(GamesUjiMindaSchema, { challenge: {} })
    rejected(GamesUjiMindaSchema, {})
  })
})

// ---- leagues, Sekolah Bersaing ----------------------------------------------------------------------------------------------------

describe('leagues (M16-46 to M16-49)', () => {
  const card = {
    id: '1',
    name: 'Liga Sejarah Fiktif',
    status: 'upcoming',
    statusLabel: 'Akan Datang',
    scopeLabel: 'Sekolah',
    typeLabel: 'Persahabatan',
    subjectName: 'Sejarah',
    startDate: '2026-03-31',
    endDate: '2026-04-01',
    schools: 3,
  }
  const create = {
    name: 'Liga Fiktif',
    type: 'friendly',
    scope: 'school',
    game_mode: 'mixed',
    scoring_method: 'total_score',
    start_date: '2026-04-01',
    end_date: '2026-04-30',
  }

  it('parses the list {mine, open} and keeps the BM labels of the mock', () => {
    ok(GamesLeagueListSchema, { mine: [card], open: [card, { ...card, id: '2', subjectName: null }] })
    ok(GamesLeagueListSchema, { mine: [], open: [] })
    rejected(GamesLeagueListSchema, { mine: [{ ...card, status: 'draft' }], open: [] })
    expect(GAMES_LEAGUE_LABELS.status).toEqual({ upcoming: 'Akan Datang', ongoing: 'Sedang Berlangsung', ended: 'Tamat' })
    expect(GAMES_LEAGUE_LABELS.type.friendly).toBe('Persahabatan')
    expect(GAMES_LEAGUE_LABELS.scope.national).toBe('Kebangsaan')
    expect(GAMES_LEAGUE_LABELS.scoring.wins).toBe('Bilangan Kemenangan')
  })

  it('create: valid body; top-level message is the first field message', () => {
    ok(GamesLeagueCreateRequestSchema, create)
    ok(GamesLeagueCreateRequestSchema, { ...create, subject_id: '5', class_levels: ['T4', 'T5'], max_schools: 2 })
    ok(GamesLeagueCreateRequestSchema, { ...create, end_date: create.start_date })
    for (const field of ['name', 'type', 'scope', 'game_mode', 'scoring_method', 'start_date', 'end_date'] as const) {
      const { [field]: _omit, ...rest } = create
      void _omit
      expect(firstIssue(GamesLeagueCreateRequestSchema, rest)).toEqual({ message: 'Sila lengkapkan semua medan wajib.', path: field })
    }
    expect(firstIssue(GamesLeagueCreateRequestSchema, { ...create, name: '   ' }).message).toBe('Sila lengkapkan semua medan wajib.')
    expect(firstIssue(GamesLeagueCreateRequestSchema, { ...create, name: 'x'.repeat(256) }).message).toBe('Sila lengkapkan semua medan wajib.')
    expect(firstIssue(GamesLeagueCreateRequestSchema, { ...create, start_date: '31/03/2026' }).message).toBe('Sila lengkapkan semua medan wajib.')
    expect(firstIssue(GamesLeagueCreateRequestSchema, { ...create, end_date: '2026-03-31' })).toEqual({
      message: 'Tarikh tamat mesti selepas tarikh mula.',
      path: 'end_date',
    })
    for (const max_schools of [1, 501, 2.5]) {
      expect(firstIssue(GamesLeagueCreateRequestSchema, { ...create, max_schools })).toEqual({
        message: 'Had sekolah mesti antara 2 dan 500.',
        path: 'max_schools',
      })
    }
    expect(firstIssue(GamesLeagueCreateRequestSchema, { ...create, class_levels: ['T6'] }).message).toBe('Tingkatan tidak sah.')
    expect(firstIssue(GamesLeagueCreateRequestSchema, { ...create, class_levels: ['D0'] }).path).toContain('class_levels')
  })

  it('create and join answer { id }; join takes invite_code', () => {
    ok(GamesLeagueIdResultSchema, { id: '7' })
    rejected(GamesLeagueIdResultSchema, { id: '' })
    ok(GamesLeagueJoinRequestSchema, { invite_code: ' rmu4vcbs ' })
    rejected(GamesLeagueJoinRequestSchema, {})
    for (const m of [
      GAMES_MESSAGES.leagueInviteInvalid,
      GAMES_MESSAGES.leagueEnded,
      GAMES_MESSAGES.leagueNeedsSchool,
      GAMES_MESSAGES.leagueAlreadyIn,
      GAMES_MESSAGES.leagueFull,
    ]) {
      ok(ErrorBodySchema, { error: { code: 'VALIDATION_ERROR', message: m, fields: { invite_code: m } } })
    }
    expect(GAMES_MESSAGES.leagueInviteInvalid).toBe('Kod jemputan tidak sah.')
    expect(GAMES_MESSAGES.leagueNeedsSchool).toBe('Anda perlu mempunyai sekolah untuk menyertai liga ini.')
    expect(GAMES_MESSAGES.leagueNotFound).toBe('Liga tidak dijumpai.')
  })

  it('detail: card fields without the count, invite code, share url, canJoin, schools, standings by level', () => {
    const { schools: _count, ...cardFields } = card
    void _count
    const detail = {
      ...cardFields,
      scoringLabel: 'Jumlah Markah',
      creatorName: 'Cikgu Fiktif',
      classLevels: ['T4', 'T5'],
      inviteCode: 'TEST2026',
      shareUrl: 'https://wa.me/?text=Jom+sertai',
      canJoin: false,
      schools: [{ id: '8078', name: 'SMK Rekaan' }],
      standings: {
        T4: [{ rank: 1, schoolId: '8078', name: 'SMK Rekaan', ppdState: 'Daerah Rekaan, Negeri Rekaan', peserta: 8, skor: 2935.0, purata: 77.2 }],
      },
    }
    ok(GamesLeagueDetailSchema, detail)
    ok(GamesLeagueDetailSchema, { ...detail, standings: {} }) // only levels with rows
    rejected(GamesLeagueDetailSchema, { ...detail, schools: 3 })
    rejected(GamesLeagueDetailSchema, { ...detail, inviteCode: 'abc' })
    rejected(GamesLeagueDetailSchema, { ...detail, standings: { T9: [] } })
  })
})

describe('Sekolah Bersaing (M16-50)', () => {
  const row = { rank: 1, schoolName: 'SK Rekaan', state: 'Negeri Rekaan', aktifPct: 61.5, streakAvg: 3.2, notaPer10: 4.1, anonymous: false }

  it('parses a week and an empty week', () => {
    ok(GamesSekolahBersaingSchema, { weekStart: '2026-09-21', count: 1, rows: [row] })
    ok(GamesSekolahBersaingSchema, { weekStart: '2026-09-21', count: 0, rows: [] })
    rejected(GamesSekolahBersaingSchema, { weekStart: '2026-09-21', count: 2, rows: [row] })
  })

  it('D54(d): an anonymous row shows "Sekolah anonim", never the school name', () => {
    ok(GamesSekolahBersaingSchema, { weekStart: '2026-09-21', count: 1, rows: [{ ...row, schoolName: 'Sekolah anonim', anonymous: true }] })
    rejected(GamesSekolahBersaingSchema, { weekStart: '2026-09-21', count: 1, rows: [{ ...row, anonymous: true }] })
    expect(GAMES_MESSAGES.sekolahAnonymous).toBe('Sekolah anonim')
  })
})

describe('admin game settings (M16-51, M16-52)', () => {
  it('parses the overview and the settings result', () => {
    ok(GamesAdminOverviewSchema, { stats: { rooms: 160, playing: 0, finished: 0, players: 189 }, settings: { boardgameQuizTiles: 35 } })
    rejected(GamesAdminOverviewSchema, { stats: { rooms: 160, playing: 0, finished: 0, players: 189 }, settings: { boardgameQuizTiles: 39 } })
    ok(GamesAdminSettingsResultSchema, { boardgameQuizTiles: 0 })
  })

  it('PUT body: integer 0..38 with "Nilai mesti antara 0 dan 38."', () => {
    ok(GamesAdminSettingsUpdateRequestSchema, { boardgame_quiz_tiles: 0 })
    ok(GamesAdminSettingsUpdateRequestSchema, { boardgame_quiz_tiles: 38 })
    for (const v of [-1, 39, 3.5, '10', null]) {
      expect(firstIssue(GamesAdminSettingsUpdateRequestSchema, { boardgame_quiz_tiles: v })).toEqual({
        message: 'Nilai mesti antara 0 dan 38.',
        path: 'boardgame_quiz_tiles',
      })
    }
    expect(firstIssue(GamesAdminSettingsUpdateRequestSchema, {}).message).toBe('Nilai mesti antara 0 dan 38.')
  })
})

// ---- OpenAPI registration --------------------------------------------------------------------------------------------------------------

type Operation = {
  tags?: string[]
  parameters?: { name: string; in: string; required?: boolean }[]
  requestBody?: unknown
  responses: Record<string, { headers?: Record<string, unknown>; content?: { 'application/json': { schema: unknown } } }>
}
const doc = buildOpenApiDocument() as {
  paths: Record<string, Record<string, Operation>>
  components: { schemas: Record<string, unknown> }
}
const gamesOps = Object.entries(doc.paths).flatMap(([path, item]) =>
  Object.entries(item)
    .filter(([, op]) => op.tags?.includes('games'))
    .map(([method, op]) => ({ key: `${method.toUpperCase()} ${path}`, method, path, op })),
)

describe('openapi registration', () => {
  const EXPECTED = [
    'GET /games/hub',
    'GET /games/{game}/lobby',
    'POST /games/{game}/rooms',
    'POST /games/{game}/rooms/join',
    'GET /games/{game}/rooms/{code}',
    'POST /games/{game}/rooms/{code}/start',
    'POST /games/{game}/rooms/{code}/action',
    'POST /papan-bijak/quick-match',
    'GET /papan-bijak/quick-match/poll',
    'POST /papan-bijak/quick-match/cancel',
    'GET /games/solo/{game}',
    'POST /games/solo/{game}/submit',
    'GET /games/roda-nasib',
    'POST /games/roda-nasib/spin',
    'GET /games/jutawan',
    'POST /games/jutawan/start',
    'POST /games/jutawan/{sessionId}/answer',
    'POST /games/jutawan/{sessionId}/lifeline',
    'GET /games/pertandingan',
    'GET /games/uji-minda',
    'GET /leagues',
    'POST /leagues',
    'POST /leagues/join',
    'GET /leagues/{id}',
    'GET /sekolah-bersaing',
    'GET /admin/games',
    'PUT /admin/games/settings',
  ]

  it('registers exactly the 27 routes of the card under the games tag', () => {
    expect(gamesOps).toHaveLength(27)
    expect(gamesOps.map((o) => o.key).sort()).toEqual([...EXPECTED].sort())
  })

  it('does not register any battle, standings or tournament route (BE-44)', () => {
    for (const { path } of gamesOps) expect(path).not.toMatch(/battle|tournament|standings/)
    for (const name of Object.keys(GAMES_COMPONENT_SCHEMAS)) expect(name.startsWith('Games')).toBe(true)
    for (const name of Object.keys(GAMES_COMPONENT_SCHEMAS)) expect(name).not.toMatch(/^Games(Battle|Tournament)/)
  })

  it('every component of the domain is in the document and prefixed Games', () => {
    for (const name of Object.keys(GAMES_COMPONENT_SCHEMAS)) expect(doc.components.schemas[name], name).toBeDefined()
  })

  it('401 on every route', () => {
    for (const { key, op } of gamesOps) expect(op.responses['401'], key).toBeDefined()
  })

  it('every mutation takes the X-CSRF-Token header and declares 403', () => {
    const mutations = gamesOps.filter((o) => o.method !== 'get')
    expect(mutations).toHaveLength(14)
    for (const { key, op } of mutations) {
      expect(op.parameters?.some((p) => p.in === 'header' && p.name === 'X-CSRF-Token'), key).toBe(true)
      expect(op.responses['403'], key).toBeDefined()
      const text = JSON.stringify(op.responses['403'])
      expect(text, key).toMatch(/CSRF_INVALID/)
    }
    for (const { key, op } of gamesOps.filter((o) => o.method === 'get')) {
      expect(op.parameters?.some((p) => p.name === 'X-CSRF-Token') ?? false, key).toBe(false)
    }
  })

  it('D57(a): every write route (and the solo GET that creates a session) documents 429 RATE_LIMITED with retryAfter and Retry-After', () => {
    const writes = gamesOps.filter((o) => o.method !== 'get' || o.key === 'GET /games/solo/{game}')
    expect(writes).toHaveLength(15)
    for (const { key, op } of writes) {
      const r = op.responses['429']
      expect(r, key).toBeDefined()
      expect(JSON.stringify(r), key).toMatch(/RATE_LIMITED/)
      expect(Object.keys(r?.headers ?? {}), key).toContain('Retry-After')
      expect(JSON.stringify(r?.content?.['application/json']?.schema), key).toMatch(/ErrorBody/)
    }
    for (const { key, op } of gamesOps.filter((o) => !writes.includes(o))) expect(op.responses['429'], key).toBeUndefined()
  })

  it('D57(b): responses that carry join codes or answer keys send Cache-Control: no-store', () => {
    const noStore = (key: string, status: string) => {
      const r = gamesOps.find((o) => o.key === key)?.op.responses[status]
      expect(Object.keys(r?.headers ?? {}), `${key} ${status}`).toContain('Cache-Control')
    }
    noStore('POST /games/{game}/rooms', '201')
    noStore('POST /games/{game}/rooms/join', '200')
    noStore('GET /games/{game}/rooms/{code}', '200')
    noStore('GET /games/hub', '200')
    noStore('GET /games/solo/{game}', '200')
    noStore('GET /leagues/{id}', '200')
  })

  it('M16-51 and M16-52 are admin only: 403 "This action is unauthorized."', () => {
    for (const key of ['GET /admin/games', 'PUT /admin/games/settings']) {
      const op = gamesOps.find((o) => o.key === key)?.op
      expect(JSON.stringify(op?.responses['403']), key).toMatch(/This action is unauthorized\./)
    }
    expect(gamesOps.find((o) => o.key === 'GET /games/hub')?.op.responses['403']).toBeUndefined()
  })

  it('creation routes answer 201 (room, league); Jutawan start answers 200', () => {
    const status = (key: string) => Object.keys(gamesOps.find((o) => o.key === key)?.op.responses ?? {})
    expect(status('POST /games/{game}/rooms')).toContain('201')
    expect(status('POST /leagues')).toContain('201')
    expect(status('POST /games/jutawan/start')).toContain('200')
    expect(status('POST /games/jutawan/start')).not.toContain('201')
    expect(status('POST /games/{game}/rooms/join')).toContain('200')
    expect(status('POST /leagues/join')).toContain('200')
  })

  it('raw routes declare raw bodies and raw error bodies; the others use { data } and { error }', () => {
    const schemaOf = (key: string, code: string) => {
      const r = gamesOps.find((o) => o.key === key)?.op.responses[code]
      return JSON.stringify(r?.content?.['application/json'].schema)
    }
    // M16-29: raw 200, raw { error: string } 422
    expect(schemaOf('POST /papan-bijak/quick-match', '200')).toContain('GamesQuickMatchStartResponse')
    expect(schemaOf('POST /papan-bijak/quick-match', '422')).toContain('GamesRawError')
    expect(schemaOf('GET /papan-bijak/quick-match/poll', '200')).toContain('GamesQuickMatchPollResponse')
    expect(schemaOf('POST /papan-bijak/quick-match/cancel', '200')).toContain('GamesQuickMatchCancelResponse')
    // M16-33: raw 200, raw { message } 404 / 409 / 422
    expect(schemaOf('POST /games/solo/{game}/submit', '200')).toContain('GamesSoloSubmitResponse')
    for (const code of ['404', '409', '422']) expect(schemaOf('POST /games/solo/{game}/submit', code)).toContain('GamesRawMessage')
    // M16-35: raw 200 and raw { success: false, message } 409
    expect(schemaOf('POST /games/roda-nasib/spin', '200')).toContain('GamesSpinResponse')
    expect(schemaOf('POST /games/roda-nasib/spin', '409')).toContain('GamesSpinRefused')
    // enveloped routes: { data } with a concrete schema, standard ErrorBody for errors
    for (const key of ['GET /games/hub', 'GET /games/{game}/lobby', 'GET /games/solo/{game}', 'GET /games/pertandingan', 'GET /leagues/{id}', 'GET /sekolah-bersaing', 'GET /admin/games']) {
      const text = schemaOf(key, '200')
      expect(text, key).toContain('"data"')
    }
    expect(schemaOf('POST /games/{game}/rooms', '422')).toContain('ErrorBody')
    expect(schemaOf('POST /games/{game}/rooms/{code}/start', '409')).toContain('ErrorBody')
    expect(schemaOf('GET /leagues/{id}', '404')).toContain('ErrorBody')
    // the raw bodies carry no data envelope
    for (const key of ['GamesQuickMatchStartResponse', 'GamesQuickMatchCancelResponse', 'GamesSoloSubmitResponse', 'GamesSpinResponse']) {
      expect(JSON.stringify(doc.components.schemas[key])).not.toContain('"data"')
    }
  })

  it('declares params, query and body of the key routes', () => {
    const op = (key: string) => gamesOps.find((o) => o.key === key)?.op as Operation
    const names = (key: string) => (op(key).parameters ?? []).map((p) => `${p.in}:${p.name}`).sort()
    expect(names('GET /games/{game}/lobby')).toEqual(['path:game'])
    expect(names('POST /games/{game}/rooms/{code}/action')).toEqual(['header:X-CSRF-Token', 'path:code', 'path:game'])
    expect(names('GET /games/solo/{game}')).toEqual(['path:game', 'query:darjah'])
    expect(names('GET /games/jutawan')).toEqual(['query:darjah'])
    expect(names('POST /games/jutawan/{sessionId}/answer')).toEqual(['header:X-CSRF-Token', 'path:sessionId'])
    expect(names('GET /leagues/{id}')).toEqual(['path:id'])
    expect(names('GET /sekolah-bersaing')).toEqual(['query:week'])
    expect(op('POST /games/{game}/rooms').requestBody).toBeDefined()
    expect(op('POST /games/{game}/rooms/{code}/start').requestBody).toBeUndefined()
    expect(op('POST /papan-bijak/quick-match/cancel').requestBody).toBeUndefined()
    expect(op('POST /games/roda-nasib/spin').requestBody).toBeUndefined()
  })
})
