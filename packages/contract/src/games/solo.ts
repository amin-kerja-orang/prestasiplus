import { z } from '../zod'
import { DateOnlySchema, TimestampSchema } from '../common/time'
import { IdSchema } from '../common/ids'
import {
  GAMES_MESSAGES,
  GamesKeylessQuestionSchema,
  gamesCount,
  gamesGradeNumber,
  type GamesSoloGame,
} from './common'

/**
 * Single-player games (M16-32, M16-33), Roda Nasib (M16-34, M16-35), Jutawan Ilmu (M16-36 to M16-39),
 * the weekly competition (M16-40) and Uji Minda (M16-41).
 *
 * SECURITY (SEC-M16-01, SEC-M16-11, BE-45 Open question 8): as in the mock and the card, the five
 * single-player payloads DO ship their answer keys (`is_true`, `correct`, `answer`, `pair_id`) and the
 * client posts its own score and coins; the server only bounds the values (AC 12). These key fields are
 * declared explicitly below so the exception is visible and testable. Room games and Jutawan Ilmu serve
 * keyless questions (`GamesKeylessQuestion`).
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

/** Betul / Salah: 40 statements. `is_true` is the key (SEC-M16-01). */
export const GamesBetulSalahPayloadSchema = z
  .strictObject({
    ...soloBase,
    statements: z
      .array(
        z.strictObject({
          id: IdSchema,
          statement: z.string(),
          is_true: z.boolean().meta({ description: 'ANSWER KEY shipped to the client by design (SEC-M16-01).' }),
          difficulty,
        }),
      )
      .max(40),
  })
  .meta({ id: 'GamesBetulSalahPayload' })

/** Cabaran Kilat: 30 questions. `options[].correct` is the key (SEC-M16-01). */
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
              correct: z.boolean().meta({ description: 'ANSWER KEY shipped to the client by design (SEC-M16-01).' }),
            }),
          ),
        }),
      )
      .max(30),
  })
  .meta({ id: 'GamesCabaranKilatPayload' })

/** Tembak Jawapan: 30 questions. `options[].correct` is the key (SEC-M16-01). */
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
              correct: z.boolean().meta({ description: 'ANSWER KEY shipped to the client by design (SEC-M16-01).' }),
            }),
          ),
        }),
      )
      .max(30),
  })
  .meta({ id: 'GamesTembakJawapanPayload' })

/** Susun Jawapan: 20 puzzles. `answer` is the key (SEC-M16-01). */
export const GamesSusunJawapanPayloadSchema = z
  .strictObject({
    ...soloBase,
    puzzles: z
      .array(
        z.strictObject({
          id: IdSchema,
          question: z.string(),
          answer: z.string().meta({ description: 'ANSWER KEY shipped to the client by design (SEC-M16-01).' }),
          scrambled: z.array(z.string()),
          type: z.enum(['letters', 'words']),
          difficulty,
          points: z.number().int().min(1),
        }),
      )
      .max(20),
  })
  .meta({ id: 'GamesSusunJawapanPayload' })

/** Kad Memori: 12 cards (6 pairs). `pair_id` is the key (SEC-M16-01). `id` and `pair_id` are client-side indexes. */
export const GamesKadMemoriPayloadSchema = z
  .strictObject({
    ...soloBase,
    cards: z
      .array(
        z.strictObject({
          id: z.number().int().min(1).max(12),
          pair_id: z.number().int().min(0).max(5).meta({ description: 'ANSWER KEY shipped to the client by design (SEC-M16-01).' }),
          type: z.enum(['question', 'answer']),
          content: z.string(),
          difficulty,
        }),
      )
      .max(12),
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
      'The payload of the requested game: statements (betul-salah), questions (cabaran-kilat, tembak-jawapan), puzzles (susun-jawapan) or cards (kad-memori). A session row is created by the GET.',
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

// --- solo submit (M16-33), raw bodies --------------------------------------------------------------------------

const submitBase = {
  session_id: GamesSessionIdSchema,
  score: gamesCount,
  syiling_earned: gamesCount,
}
const counted = { correct_count: gamesCount, total_answered: gamesCount }

export const GamesBetulSalahSubmitSchema = z
  .object({ session_id: submitBase.session_id, ...counted, streak: gamesCount, score: submitBase.score, syiling_earned: submitBase.syiling_earned })
  .meta({ id: 'GamesBetulSalahSubmit' })
export const GamesCabaranKilatSubmitSchema = z
  .object({ session_id: submitBase.session_id, ...counted, max_combo: gamesCount, score: submitBase.score, syiling_earned: submitBase.syiling_earned })
  .meta({ id: 'GamesCabaranKilatSubmit' })
export const GamesTembakJawapanSubmitSchema = z
  .object({
    session_id: submitBase.session_id,
    ...counted,
    max_level: z.number().int().min(1),
    score: submitBase.score,
    syiling_earned: submitBase.syiling_earned,
  })
  .meta({ id: 'GamesTembakJawapanSubmit' })
export const GamesSusunJawapanSubmitSchema = z
  .object({
    session_id: submitBase.session_id,
    solved_count: gamesCount,
    total_puzzles: gamesCount,
    score: submitBase.score,
    syiling_earned: submitBase.syiling_earned,
  })
  .meta({ id: 'GamesSusunJawapanSubmit' })
export const GamesKadMemoriSubmitSchema = z
  .object({
    session_id: submitBase.session_id,
    matches: z.literal(6),
    total_pairs: z.literal(6),
    moves: z.number().int().min(6),
    time_seconds: gamesCount,
  })
  .meta({ id: 'GamesKadMemoriSubmit' })

/**
 * Body per game. The server bounds (counts at most the items served, streak / combo at most correct,
 * max level within 1..1 + floor(correct / 5), score and syiling_earned at most what that many correct
 * answers can reach) answer 422 raw `{ message: "Keputusan tidak sah." }`; a second submit is 409
 * raw `{ message: "Keputusan sudah dihantar." }`.
 */
export const GamesSoloSubmitRequestSchema = z
  .union([
    GamesBetulSalahSubmitSchema,
    GamesCabaranKilatSubmitSchema,
    GamesTembakJawapanSubmitSchema,
    GamesSusunJawapanSubmitSchema,
    GamesKadMemoriSubmitSchema,
  ])
  .meta({ id: 'GamesSoloSubmitRequest' })
export type GamesSoloSubmitRequest = z.infer<typeof GamesSoloSubmitRequestSchema>

export const GAMES_SOLO_SUBMIT_SCHEMAS = {
  'betul-salah': GamesBetulSalahSubmitSchema,
  'cabaran-kilat': GamesCabaranKilatSubmitSchema,
  'tembak-jawapan': GamesTembakJawapanSubmitSchema,
  'susun-jawapan': GamesSusunJawapanSubmitSchema,
  'kad-memori': GamesKadMemoriSubmitSchema,
} as const satisfies Record<GamesSoloGame, z.ZodType>

/** 200 raw body: `{ is_new_record, syiling_awarded }`, or for Kad Memori `{ results: { syiling_earned, accuracy } }`. */
export const GamesSoloSubmitResponseSchema = z
  .union([
    z.strictObject({ is_new_record: z.boolean(), syiling_awarded: gamesCount }),
    z.strictObject({
      results: z.strictObject({
        syiling_earned: gamesCount,
        accuracy: z.number().int().min(0).max(100).meta({ description: 'round(6 / moves * 100); coins 6.' }),
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
    userId: IdSchema,
    name: z.string().meta({ description: 'Display name only (D54(d)).' }),
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
