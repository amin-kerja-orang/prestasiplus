import { z } from '../zod'
import { DateOnlySchema, TimestampSchema } from '../common/time'
import { IdSchema } from '../common/ids'
import {
  GAMES_MESSAGES,
  GAMES_NAME_RULE,
  GamesKeylessQuestionSchema,
  gamesCount,
  gamesGradeNumber,
  type GamesSoloGame,
} from './common'

/**
 * Single-player games (M16-32, M16-33), Roda Nasib (M16-34, M16-35), Jutawan Ilmu (M16-36 to M16-39),
 * the weekly competition (M16-40) and Uji Minda (M16-41).
 *
 * SECURITY (D58a, replaces SEC-M16-01 / BE-45 Open question 8): the games award coins, so no answer key
 * reaches the client before the answer. The five solo payloads are keyless (no `is_true`, `correct`,
 * `answer`, `pair_id`). The client posts each answer to the check route ([PROPOSED] route, not in the
 * mock); the server checks it, stores the check and returns correct/wrong plus the key (as the Bijak
 * "Semak", US-15). The final submit carries only the session id: the server computes score, counts,
 * streak, combo, level and coins from the stored checks and never trusts client-posted values.
 * Room games and Jutawan Ilmu already serve keyless questions (`GamesKeylessQuestion`).
 */

/** Session id of a single-player game or Jutawan run: a uuid string (opaque to the client). */
export const GamesSessionIdSchema = z.uuid().meta({ id: 'GamesSessionId', description: 'Opaque game session id (uuid).' })

// --- solo payloads (M16-32) ---------------------------------------------------------------------------------------

/** `darjah` 1..11 (default the caller's grade, else 4; ignored by kad-memori). Else 422 "Tahap tidak sah." (darjah). */
export const GamesSoloQuerySchema = z
  .object({
    darjah: z.coerce
      .number({ error: GAMES_MESSAGES.level })
      .int({ error: GAMES_MESSAGES.level })
      .min(1, { error: GAMES_MESSAGES.level })
      .max(11, { error: GAMES_MESSAGES.level })
      .optional()
      .meta({ description: 'Grade 1..11 (7..11 are Tingkatan 1..5).' }),
  })
  .meta({ id: 'GamesSoloQuery' })

const soloBase = {
  sessionId: GamesSessionIdSchema,
  personalBest: gamesCount,
  canEarnSyiling: z.boolean(),
}
const difficulty = z.number().int().min(1)

/** Betul / Salah: 40 statements, keyless (the key `is_true` is returned by the check route). */
export const GamesBetulSalahPayloadSchema = z
  .strictObject({
    ...soloBase,
    statements: z
      .array(
        z.strictObject({
          id: IdSchema,
          statement: z.string(),
          difficulty,
        }),
      )
      .max(40),
  })
  .meta({ id: 'GamesBetulSalahPayload' })

/** Cabaran Kilat: 30 questions, keyless (the correct option id is returned by the check route). */
export const GamesCabaranKilatPayloadSchema = z
  .strictObject({
    ...soloBase,
    questions: z
      .array(
        z.strictObject({
          id: IdSchema,
          question_text: z.string(),
          difficulty,
          options: z.array(
            z.strictObject({
              id: z.number().int().min(0).max(3),
              text: z.string(),
            }),
          ),
        }),
      )
      .max(30),
  })
  .meta({ id: 'GamesCabaranKilatPayload' })

/** Tembak Jawapan: 30 questions, keyless; an option is identified by its position (0..3). */
export const GamesTembakJawapanPayloadSchema = z
  .strictObject({
    ...soloBase,
    questions: z
      .array(
        z.strictObject({
          id: IdSchema,
          question: z.string(),
          difficulty,
          options: z.array(
            z.strictObject({
              text: z.string(),
            }),
          ),
        }),
      )
      .max(30),
  })
  .meta({ id: 'GamesTembakJawapanPayload' })

/** Susun Jawapan: 20 puzzles, keyless (the `answer` is returned by the check route). */
export const GamesSusunJawapanPayloadSchema = z
  .strictObject({
    ...soloBase,
    puzzles: z
      .array(
        z.strictObject({
          id: IdSchema,
          question: z.string(),
          scrambled: z.array(z.string()),
          type: z.enum(['letters', 'words']),
          difficulty,
          points: z.number().int().min(1),
        }),
      )
      .max(20),
  })
  .meta({ id: 'GamesSusunJawapanPayload' })

/**
 * Kad Memori: 12 face-down cards (6 pairs). D58a (LEAD review): the board carries NO face (no question or answer
 * text, no `type`, no `pair_id`), because the faces would let a client pair the cards offline. `cards[].id` is an
 * opaque per-session id (never a pair index) and the array order is the board order. A face is revealed only by
 * `POST /games/solo/kad-memori/reveal` (the first card of a move) and by the check response (both faces of a move).
 */
export const GamesKadMemoriPayloadSchema = z
  .strictObject({
    ...soloBase,
    cards: z
      .array(z.strictObject({ id: IdSchema.meta({ description: 'Opaque card id of this session (not a pair index).' }) }))
      .max(12),
    count: z.literal(12).meta({ description: '[PROPOSED] Number of cards (6 pairs).' }),
    layout: z
      .strictObject({ columns: z.number().int().min(1).max(12), rows: z.number().int().min(1).max(12) })
      .meta({ description: '[PROPOSED] Default board grid (4 x 3); the client may reflow it responsively.' }),
  })
  .meta({ id: 'GamesKadMemoriPayload' })

export const GamesSoloPayloadSchema = z
  .union([
    GamesBetulSalahPayloadSchema,
    GamesCabaranKilatPayloadSchema,
    GamesTembakJawapanPayloadSchema,
    GamesSusunJawapanPayloadSchema,
    GamesKadMemoriPayloadSchema,
  ])
  .meta({
    id: 'GamesSoloPayload',
    description:
      'The keyless payload of the requested game: statements (betul-salah), questions (cabaran-kilat, tembak-jawapan), puzzles (susun-jawapan) or cards (kad-memori). A session row is created by the GET. No answer key is present (D58a).',
  })
export type GamesSoloPayload = z.infer<typeof GamesSoloPayloadSchema>

/** The payload schema of one solo game. */
export const GAMES_SOLO_PAYLOAD_SCHEMAS = {
  'betul-salah': GamesBetulSalahPayloadSchema,
  'cabaran-kilat': GamesCabaranKilatPayloadSchema,
  'tembak-jawapan': GamesTembakJawapanPayloadSchema,
  'susun-jawapan': GamesSusunJawapanPayloadSchema,
  'kad-memori': GamesKadMemoriPayloadSchema,
} as const satisfies Record<GamesSoloGame, z.ZodType>

// --- solo check ([PROPOSED] route, D58a) -------------------------------------------------------------------------------

/** Item id: the statement, question or puzzle id of the payload. */
const itemId = IdSchema.meta({ description: 'Id of the statement, question or puzzle in the payload of this session.' })
const optionIndex = z.number().int().min(0).max(3)

export const GamesBetulSalahCheckSchema = z
  .object({ session_id: GamesSessionIdSchema, item_id: itemId, answer: z.boolean({ error: GAMES_MESSAGES.actionValue }) })
  .meta({ id: 'GamesBetulSalahCheck' })
export const GamesCabaranKilatCheckSchema = z
  .object({ session_id: GamesSessionIdSchema, item_id: itemId, option_id: optionIndex.meta({ description: 'The id (0..3) of the chosen option.' }) })
  .meta({ id: 'GamesCabaranKilatCheck' })
export const GamesTembakJawapanCheckSchema = z
  .object({ session_id: GamesSessionIdSchema, item_id: itemId, option_index: optionIndex.meta({ description: 'The position (0..3) of the chosen option.' }) })
  .meta({ id: 'GamesTembakJawapanCheck' })
export const GamesSusunJawapanCheckSchema = z
  .object({ session_id: GamesSessionIdSchema, item_id: itemId, answer: z.string({ error: GAMES_MESSAGES.actionValue }).min(1).max(200) })
  .meta({ id: 'GamesSusunJawapanCheck' })
export const GamesKadMemoriCheckSchema = z
  .object({
    session_id: GamesSessionIdSchema,
    card_id: IdSchema.meta({ description: 'Opaque card id from the payload.' }),
    other_card_id: IdSchema.meta({ description: 'The second flipped card (must differ).' }),
  })
  .refine((v) => v.card_id !== v.other_card_id, { error: GAMES_MESSAGES.actionValue, path: ['other_card_id'] })
  .meta({ id: 'GamesKadMemoriCheck' })

/**
 * Body of `POST /games/solo/{game}/check` per game ([PROPOSED]; the mock has no such route). The path parameter
 * `game` selects the body: it is `GAMES_SOLO_CHECK_SCHEMAS[game]` (component `Games<Game>Check`), and the 200 is
 * `GAMES_SOLO_CHECK_RESULT_SCHEMAS[game]` (component `Games<Game>CheckResult`). One check per item (a second check
 * of the same item is 409, so the key cannot be probed); Kad Memori: one check per flipped pair, a mismatch may be
 * repeated, a card of an already matched pair is 409.
 */
export const GamesSoloCheckRequestSchema = z
  .union([
    GamesBetulSalahCheckSchema,
    GamesCabaranKilatCheckSchema,
    GamesTembakJawapanCheckSchema,
    GamesSusunJawapanCheckSchema,
    GamesKadMemoriCheckSchema,
  ])
  .meta({
    id: 'GamesSoloCheckRequest',
    description:
      'One of the per-game bodies; the path parameter `game` decides which: betul-salah = GamesBetulSalahCheck, cabaran-kilat = GamesCabaranKilatCheck, tembak-jawapan = GamesTembakJawapanCheck, susun-jawapan = GamesSusunJawapanCheck, kad-memori = GamesKadMemoriCheck. A body of another game is 422 "Jawapan tidak sah." [PROPOSED].',
  })
export type GamesSoloCheckRequest = z.infer<typeof GamesSoloCheckRequestSchema>

export const GAMES_SOLO_CHECK_SCHEMAS = {
  'betul-salah': GamesBetulSalahCheckSchema,
  'cabaran-kilat': GamesCabaranKilatCheckSchema,
  'tembak-jawapan': GamesTembakJawapanCheckSchema,
  'susun-jawapan': GamesSusunJawapanCheckSchema,
  'kad-memori': GamesKadMemoriCheckSchema,
} as const satisfies Record<GamesSoloGame, z.ZodType>

/** One revealed Kad Memori face. */
export const GamesKadMemoriFaceSchema = z
  .strictObject({
    id: IdSchema.meta({ description: 'The opaque card id.' }),
    type: z.enum(['question', 'answer']),
    content: z.string(),
  })
  .meta({ id: 'GamesKadMemoriFace' })
export type GamesKadMemoriFace = z.infer<typeof GamesKadMemoriFaceSchema>

export const GamesBetulSalahCheckResultSchema = z
  .strictObject({ correct: z.boolean(), is_true: z.boolean() })
  .meta({ id: 'GamesBetulSalahCheckResult' })
export const GamesCabaranKilatCheckResultSchema = z
  .strictObject({ correct: z.boolean(), correct_option_id: optionIndex })
  .meta({ id: 'GamesCabaranKilatCheckResult' })
export const GamesTembakJawapanCheckResultSchema = z
  .strictObject({ correct: z.boolean(), correct_option_index: optionIndex })
  .meta({ id: 'GamesTembakJawapanCheckResult' })
export const GamesSusunJawapanCheckResultSchema = z
  .strictObject({ correct: z.boolean(), answer: z.string() })
  .meta({ id: 'GamesSusunJawapanCheckResult' })
/** Kad Memori: both faces of the move plus the verdict; `pair_id` only on a match (null otherwise). */
export const GamesKadMemoriCheckResultSchema = z
  .strictObject({
    correct: z.boolean().meta({ description: 'true when the two cards are a pair.' }),
    pair_id: z.number().int().min(0).max(5).nullable().meta({ description: 'The pair id, only when the cards match; null on a mismatch.' }),
    cards: z.tuple([GamesKadMemoriFaceSchema, GamesKadMemoriFaceSchema]).meta({ description: 'The faces of card_id and other_card_id, in that order.' }),
  })
  .meta({ id: 'GamesKadMemoriCheckResult' })

export const GAMES_SOLO_CHECK_RESULT_SCHEMAS = {
  'betul-salah': GamesBetulSalahCheckResultSchema,
  'cabaran-kilat': GamesCabaranKilatCheckResultSchema,
  'tembak-jawapan': GamesTembakJawapanCheckResultSchema,
  'susun-jawapan': GamesSusunJawapanCheckResultSchema,
  'kad-memori': GamesKadMemoriCheckResultSchema,
} as const satisfies Record<GamesSoloGame, z.ZodType>

/** `{ data }` of the check: correct/wrong plus the key of that item, revealed only now (as Bijak "Semak"). */
export const GamesSoloCheckResponseSchema = z
  .union([
    GamesBetulSalahCheckResultSchema,
    GamesCabaranKilatCheckResultSchema,
    GamesTembakJawapanCheckResultSchema,
    GamesSusunJawapanCheckResultSchema,
    GamesKadMemoriCheckResultSchema,
  ])
  .meta({
    id: 'GamesSoloCheckResponse',
    description:
      'The result of the requested game: betul-salah = GamesBetulSalahCheckResult { correct, is_true }; cabaran-kilat = GamesCabaranKilatCheckResult { correct, correct_option_id }; tembak-jawapan = GamesTembakJawapanCheckResult { correct, correct_option_index }; susun-jawapan = GamesSusunJawapanCheckResult { correct, answer }; kad-memori = GamesKadMemoriCheckResult { correct, pair_id | null, cards: [face, face] }.',
  })
export type GamesSoloCheckResponse = z.infer<typeof GamesSoloCheckResponseSchema>

/** Per-game examples of the check body and result (OpenAPI request/response `examples`). */
export const GAMES_SOLO_CHECK_EXAMPLES = {
  'betul-salah': {
    request: { session_id: '3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f', item_id: '9001', answer: true },
    response: { correct: true, is_true: true },
  },
  'cabaran-kilat': {
    request: { session_id: '3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f', item_id: '9001', option_id: 1 },
    response: { correct: true, correct_option_id: 1 },
  },
  'tembak-jawapan': {
    request: { session_id: '3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f', item_id: '9001', option_index: 0 },
    response: { correct: false, correct_option_index: 1 },
  },
  'susun-jawapan': {
    request: { session_id: '3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f', item_id: '9001', answer: 'KUALA LUMPUR' },
    response: { correct: true, answer: 'KUALA LUMPUR' },
  },
  'kad-memori': {
    request: { session_id: '3f2b8a6e-5c1d-4e7a-9b0f-1a2b3c4d5e6f', card_id: 'c7', other_card_id: 'c2' },
    response: {
      correct: true,
      pair_id: 3,
      cards: [
        { id: 'c7', type: 'question', content: '7 + 5' },
        { id: 'c2', type: 'answer', content: '12' },
      ],
    },
  },
} as const

/**
 * Kad Memori only ([PROPOSED] route, D58a; LEAD decision pending: per-flip reveal vs. faces via check only).
 * Reveals the face of ONE face-down card, so the first card of a move can show its face as the mock page does.
 * At most one card may be open (revealed, not yet checked); a second reveal while one is open is 409, and the open
 * card is closed by the next check that names it. So a client cannot read the faces without making moves.
 */
export const GamesKadMemoriRevealRequestSchema = z
  .object({ session_id: GamesSessionIdSchema, card_id: IdSchema.meta({ description: 'Opaque card id from the payload.' }) })
  .meta({ id: 'GamesKadMemoriRevealRequest' })
export type GamesKadMemoriRevealRequest = z.infer<typeof GamesKadMemoriRevealRequestSchema>

// --- solo submit (M16-33), raw bodies --------------------------------------------------------------------------

/**
 * D58a: the body is only the session id. The server computes correct_count, total_answered, streak,
 * max_combo, max_level, solved_count, score, syiling_earned (and for Kad Memori matches, moves = number
 * of pair checks and time_seconds = now - session start) from the stored checks. Score, coin or count
 * fields sent by a client are ignored. A session without any check, or a Kad Memori session with fewer
 * than 6 matched pairs, is 422 raw `{ message: "Keputusan tidak sah." }`; a second submit is 409 raw
 * `{ message: "Keputusan sudah dihantar." }`.
 */
export const GamesSoloSubmitRequestSchema = z
  .object({ session_id: GamesSessionIdSchema })
  .meta({ id: 'GamesSoloSubmitRequest' })
export type GamesSoloSubmitRequest = z.infer<typeof GamesSoloSubmitRequestSchema>

/**
 * 200 raw body: `{ is_new_record, syiling_awarded, score, correct_count, total_answered }`, or for Kad Memori
 * `{ results: { syiling_earned, accuracy, moves, time_seconds } }`. The fields `score`, `correct_count`,
 * `total_answered`, `moves` and `time_seconds` are [PROPOSED]: the client no longer posts them, so the server
 * returns the values it computed.
 */
export const GamesSoloSubmitResponseSchema = z
  .union([
    z.strictObject({
      is_new_record: z.boolean(),
      syiling_awarded: gamesCount,
      score: gamesCount.meta({ description: '[PROPOSED] Server-computed score.' }),
      correct_count: gamesCount.meta({ description: '[PROPOSED] Correct checks (solved puzzles for susun-jawapan).' }),
      total_answered: gamesCount.meta({ description: '[PROPOSED] Checks stored for the session.' }),
    }),
    z.strictObject({
      results: z.strictObject({
        syiling_earned: gamesCount,
        accuracy: z.number().int().min(0).max(100).meta({ description: 'round(6 / moves * 100); coins 6.' }),
        moves: z.number().int().min(6).meta({ description: '[PROPOSED] Pair checks stored for the session.' }),
        time_seconds: gamesCount.meta({ description: '[PROPOSED] Server clock: submit time minus session start.' }),
      }),
    }),
  ])
  .meta({ id: 'GamesSoloSubmitResponse' })
export type GamesSoloSubmitResponse = z.infer<typeof GamesSoloSubmitResponseSchema>

// --- Roda Nasib (M16-34, M16-35) -----------------------------------------------------------------------------------

export const GamesSpinSegmentSchema = z
  .strictObject({
    label: z.string(),
    type: z.enum(['syiling', 'nothing']),
    value: gamesCount,
    weight: z.number().int().min(1),
    color: z.string(),
    icon: z.string(),
  })
  .meta({ id: 'GamesSpinSegment' })
export type GamesSpinSegment = z.infer<typeof GamesSpinSegmentSchema>

export const GamesSpinPageSchema = z
  .strictObject({
    segments: z.array(GamesSpinSegmentSchema).length(8).meta({
      description:
        'The 8 fixed segments in order: 1 Syiling, 3 Syiling, 5 Syiling, 10 Syiling, 20 Syiling, Cuba Lagi, 2 Syiling, 7 Syiling (weights 25/20/15/8/3/15/10/4).',
    }),
    spins: gamesCount,
    won: gamesCount,
    alreadySpun: z.boolean().meta({ description: 'A spin exists on today\'s Malaysia date.' }),
    canEarnSyiling: z.boolean(),
  })
  .meta({ id: 'GamesSpinPage' })
export type GamesSpinPage = z.infer<typeof GamesSpinPageSchema>

/** 200 raw body of a spin. One spin per Malaysia day; a second is 409 raw `{ success: false, message }`. */
export const GamesSpinResponseSchema = z
  .strictObject({
    success: z.literal(true),
    message: z.literal(''),
    result: z.strictObject({
      segment_index: z.number().int().min(0).max(7),
      label: z.string(),
      icon: z.string(),
      type: z.enum(['syiling', 'nothing']),
      value: gamesCount,
    }),
    coinsCredited: gamesCount,
  })
  .meta({ id: 'GamesSpinResponse' })
export type GamesSpinResponse = z.infer<typeof GamesSpinResponseSchema>

/** 409 raw body of a second spin on the same day: `{ success: false, message: "Anda sudah spin hari ini." }`. */
export const GamesSpinRefusedSchema = z
  .strictObject({ success: z.literal(false), message: z.string().min(1) })
  .meta({ id: 'GamesSpinRefused' })

// --- Jutawan Ilmu (M16-36 to M16-39) -------------------------------------------------------------------------------

export const GamesJutawanQuerySchema = GamesSoloQuerySchema.meta({ id: 'GamesJutawanQuery' })

export const GamesJutawanSubjectSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string(),
    emoji: z.string(),
    colour: z.string(),
    count: z.number().int().min(1).meta({ description: 'Questions available at that level.' }),
  })
  .meta({ id: 'GamesJutawanSubject' })

/** `heading` and `subjects` are present only when `darjah` was given. */
export const GamesJutawanPageSchema = z
  .strictObject({
    bestLevel: z.number().int().min(0).max(15),
    games: gamesCount,
    heading: z.string().optional().meta({ description: '"DARJAH n" for 1 to 6, "TINGKATAN n" for 7 to 11.' }),
    subjects: z.array(GamesJutawanSubjectSchema).optional(),
  })
  .meta({ id: 'GamesJutawanPage' })
export type GamesJutawanPage = z.infer<typeof GamesJutawanPageSchema>

export const GamesJutawanStartRequestSchema = z
  .object({
    subject: IdSchema.meta({ description: 'Subject id (opaque; the mock sends a number). Unknown or too few questions: 422 "Subjek tidak sah." / "Soalan tidak mencukupi." (subject).' }),
    darjah: gamesGradeNumber.meta({ description: 'Else 422 "Tahap tidak sah." (darjah).' }),
  })
  .meta({ id: 'GamesJutawanStartRequest' })
export type GamesJutawanStartRequest = z.infer<typeof GamesJutawanStartRequestSchema>

/** 200 (not 201). Question 1 of 15; difficulty ladder 1 for Q1-4, 2 for Q5-8, 3 for Q9-12, 4 for Q13-15. */
export const GamesJutawanStartResponseSchema = z
  .strictObject({
    sessionId: GamesSessionIdSchema,
    index: z.literal(1),
    question: GamesKeylessQuestionSchema,
    lifelines: z.literal(3),
  })
  .meta({ id: 'GamesJutawanStartResponse' })
export type GamesJutawanStartResponse = z.infer<typeof GamesJutawanStartResponseSchema>

export const GamesJutawanAnswerRequestSchema = z
  .object({
    questionId: IdSchema.meta({ description: 'Must be the current question: else 422 "Soalan tidak sepadan." (questionId).' }),
    optionId: z
      .number({ error: GAMES_MESSAGES.jutawanOption })
      .int({ error: GAMES_MESSAGES.jutawanOption })
      .min(0, { error: GAMES_MESSAGES.jutawanOption })
      .max(3, { error: GAMES_MESSAGES.jutawanOption }),
  })
  .meta({ id: 'GamesJutawanAnswerRequest' })
export type GamesJutawanAnswerRequest = z.infer<typeof GamesJutawanAnswerRequestSchema>

/** A wrong answer or level 15 ends the game with `result`; otherwise `next` is the keyless next question. */
export const GamesJutawanAnswerResponseSchema = z
  .strictObject({
    correct: z.boolean(),
    level: z.number().int().min(0).max(15),
    next: GamesKeylessQuestionSchema.optional(),
    result: z.strictObject({ level: z.number().int().min(0).max(15), credited: gamesCount }).optional(),
  })
  .refine((v) => (v.next === undefined) !== (v.result === undefined), {
    error: 'Exactly one of next and result is present.',
  })
  .meta({ id: 'GamesJutawanAnswerResponse' })
export type GamesJutawanAnswerResponse = z.infer<typeof GamesJutawanAnswerResponseSchema>

/** Only the 50:50 lifeline exists; any other type is 422 "Bantuan tidak sah." (type). */
export const GamesJutawanLifelineRequestSchema = z
  .object({ type: z.literal('50:50', { error: GAMES_MESSAGES.jutawanLifelineType }) })
  .meta({ id: 'GamesJutawanLifelineRequest' })

export const GamesJutawanLifelineResponseSchema = z
  .strictObject({
    removedOptionIds: z.array(z.number().int().min(0).max(3)).max(2).meta({
      description: 'Two wrong option indexes of the current question (remembered for it).',
    }),
    lifelines: z.number().int().min(0).max(3),
  })
  .meta({ id: 'GamesJutawanLifelineResponse' })
export type GamesJutawanLifelineResponse = z.infer<typeof GamesJutawanLifelineResponseSchema>

// --- weekly competition (M16-40) and Uji Minda (M16-41) -----------------------------------------------------

export const GamesWeeklyRowSchema = z
  .strictObject({
    rank: z.number().int().min(1),
    userId: IdSchema.nullable().meta({ description: GAMES_NAME_RULE }),
    name: z.string().meta({ description: 'Display name only (D54(d)); first name + initial outside the viewer\'s scope (children\'s names rule).' }),
    sesi: gamesCount,
    betul: gamesCount,
    tepat: z.number().min(0).max(100),
  })
  .meta({ id: 'GamesWeeklyRow' })

/** Weekly board from the practice owner's weekly ranking read. `?week=` is ignored (as live). */
export const GamesWeeklyCompetitionSchema = z
  .strictObject({
    weekStart: DateOnlySchema,
    weekEnd: DateOnlySchema,
    endsAt: TimestampSchema.meta({ description: 'Sunday 23:59:59 +08:00.' }),
    prizes: z.array(z.number().int().min(0)).meta({ description: '[100, 50, 25] syiling for ranks 1 to 3.' }),
    me: z.strictObject({ rank: z.number().int().min(1), betul: gamesCount }).nullable(),
    rows: z.array(GamesWeeklyRowSchema).max(20),
  })
  .meta({ id: 'GamesWeeklyCompetition' })
export type GamesWeeklyCompetition = z.infer<typeof GamesWeeklyCompetitionSchema>

/** Constant `{ challenge: null }`: no Uji Minda challenge exists. */
export const GamesUjiMindaSchema = z.strictObject({ challenge: z.null() }).meta({ id: 'GamesUjiMinda' })
