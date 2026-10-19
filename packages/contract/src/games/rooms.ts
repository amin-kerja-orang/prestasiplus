import { z } from '../zod'
import { IdSchema } from '../common/ids'
import {
  GAMES_GRADE_LEVELS,
  GAMES_MATCH_MODES,
  GAMES_MESSAGES,
  GAMES_PAPAN_BIJAK_SUBJECTS,
  GAMES_ROOM_LIMITS,
  GAMES_ROOM_SUBJECTS,
  GamesGradeLevelSchema,
  GamesKeylessQuestionSchema,
  GamesMatchModeSchema,
  GamesRoomCodeSchema,
  GamesRoomGameSchema,
  GamesRoomStatusSchema,
  GamesRoomSubjectSchema,
  gamesCount,
  gamesGradeNumber,
  type GamesRoomGame,
} from './common'

/**
 * Hub, lobbies, rooms (create, join, view, start, action) and the Papan Bijak quick match
 * (M16-22 to M16-31). All room routes use `{ data }`; the quick match keeps the live raw bodies.
 *
 * Players are deterministic bots in the mock (D53(a)): only the room host acts. `isBot` is on the wire
 * as in the mock (BE-45 Open question 3).
 */

// --- hub (M16-22) -----------------------------------------------------------------------------------------

export const GamesHubOpenRoomSchema = z
  .strictObject({
    game: GamesRoomGameSchema,
    code: GamesRoomCodeSchema,
    host: z.string().meta({ description: 'Display name of the host.' }),
    players: gamesCount,
    max: gamesCount,
  })
  .meta({ id: 'GamesHubOpenRoom' })
export type GamesHubOpenRoom = z.infer<typeof GamesHubOpenRoomSchema>

export const GamesHubSchema = z
  .strictObject({
    openRooms: z.array(GamesHubOpenRoomSchema).max(6).meta({
      description: 'Up to 6 newest `waiting` rooms with a free seat, newest first (code ascending as tie-break).',
    }),
    chips: z.strictObject({
      papanBijakPlayed: z.boolean().meta({ description: 'The caller has a Papan Bijak standing with jumlah > 0.' }),
      battled: z.boolean().meta({ description: 'The caller has a finished or forfeited battle (BE-44 read).' }),
    }),
  })
  .meta({ id: 'GamesHub' })
export type GamesHub = z.infer<typeof GamesHubSchema>

// --- lobby (M16-23) -----------------------------------------------------------------------------------------

const lobbyBase = {
  autoGrade: GamesGradeLevelSchema.nullable().meta({ description: 'The caller grade, null without a grade.' }),
  autoGradeName: z.string().nullable().meta({ description: '"Darjah n" or "Tingkatan n", null without a grade.' }),
}

/** One Papan Bijak Top 10 row. Display name only (D54(d)); `name` is cut to 15 characters plus "...". */
export const GamesPapanBijakTopRowSchema = z
  .strictObject({
    rank: z.number().int().min(1),
    userId: IdSchema,
    name: z.string().max(18).meta({ description: 'Truncated to 15 characters + "...".' }),
    initials: z.string().max(2).meta({ description: 'First letters of up to two words, upper case.' }),
    menang: gamesCount,
    jumlah: gamesCount,
    kadar: z.number().int().min(0).max(100).meta({ description: 'round(menang / jumlah * 100), 0 when jumlah is 0.' }),
    skor: gamesCount,
    betul: gamesCount,
  })
  .meta({ id: 'GamesPapanBijakTopRow' })
export type GamesPapanBijakTopRow = z.infer<typeof GamesPapanBijakTopRowSchema>

/** One leader of the five other lobbies: wins (Kuiz Relay: MVP count). */
export const GamesLobbyLeaderSchema = z
  .strictObject({
    rank: z.number().int().min(1),
    userId: IdSchema,
    name: z.string(),
    value: gamesCount,
  })
  .meta({ id: 'GamesLobbyLeader' })
export type GamesLobbyLeader = z.infer<typeof GamesLobbyLeaderSchema>

export const GamesLobbyPapanBijakSchema = z
  .strictObject({ ...lobbyBase, top10: z.array(GamesPapanBijakTopRowSchema).max(10) })
  .meta({ id: 'GamesLobbyPapanBijak' })
export const GamesLobbyLeadersSchema = z
  .strictObject({ ...lobbyBase, leaders: z.array(GamesLobbyLeaderSchema).max(10) })
  .meta({ id: 'GamesLobbyLeaders' })

/** `top10[]` for `papan-bijak`, `leaders[]` for the other five games (never both). */
export const GamesLobbySchema = z
  .union([GamesLobbyPapanBijakSchema, GamesLobbyLeadersSchema])
  .meta({ id: 'GamesLobby' })
export type GamesLobby = z.infer<typeof GamesLobbySchema>

// --- create room (M16-24) -------------------------------------------------------------------------------------

/**
 * The mock throws the first failing field in this order: subject, grade_level, match_mode, grade_min,
 * max_players. Messages are the mock's; zod reports them per field.
 */
function roomCreate(
  subjects: readonly [string, ...string[]],
  modes: readonly [string, ...string[]],
  maxPlayersRequired: boolean,
) {
  const maxPlayers = z
    .number({ error: GAMES_MESSAGES.roomMaxPlayers })
    .int({ error: GAMES_MESSAGES.roomMaxPlayers })
    .min(2, { error: GAMES_MESSAGES.roomMaxPlayers })
    .max(6, { error: GAMES_MESSAGES.roomMaxPlayers })
  return z
    .object({
      subject: z.enum(subjects, { error: GAMES_MESSAGES.roomSubject }),
      grade_level: z.enum(GAMES_GRADE_LEVELS, { error: GAMES_MESSAGES.roomGradeLevel }),
      match_mode: z.enum(modes, { error: GAMES_MESSAGES.roomRange }),
      grade_min: gamesGradeNumber.optional(),
      grade_max: gamesGradeNumber.optional(),
      max_players: maxPlayersRequired ? maxPlayers : maxPlayers.optional(),
    })
    .superRefine((v, ctx) => {
      if (v.match_mode !== 'custom') return
      const lo = v.grade_min
      const hi = v.grade_max
      if (lo === undefined || hi === undefined || lo > hi) {
        ctx.addIssue({ code: 'custom', path: ['grade_min'], message: GAMES_MESSAGES.roomRange })
      }
    })
}

/**
 * Body of `POST /games/{game}/rooms` as the OpenAPI document shows it (any room game).
 * Game-specific rules (Papan Bijak excludes SEJARAH, allows `custom` and needs `max_players` 2..6;
 * other games use their fixed maximum and ignore `max_players`) are in `gamesRoomCreateRequestFor`.
 */
export const GamesRoomCreateRequestSchema = roomCreate(GAMES_ROOM_SUBJECTS, GAMES_MATCH_MODES, false).meta({
  id: 'GamesRoomCreateRequest',
  description:
    '422 messages (field): "Subjek tidak sah." (subject), "Tahap soalan tidak sah." (grade_level), "Julat tahap tidak sah." (match_mode, grade_min), "Bilangan pemain tidak sah." (max_players). `custom` needs integer grade_min <= grade_max within 1..11. Papan Bijak: SEJARAH not allowed, max_players required (2..6). Other games: match_mode same_grade or same_level only, max_players ignored.',
})
export type GamesRoomCreateRequest = z.infer<typeof GamesRoomCreateRequestSchema>

const papanBijakCreate = roomCreate(GAMES_PAPAN_BIJAK_SUBJECTS, GAMES_MATCH_MODES, true)
const otherCreate = roomCreate(GAMES_ROOM_SUBJECTS, ['same_grade', 'same_level'], false)

/** The create-room body schema of one game (validation order and messages of the mock). */
export function gamesRoomCreateRequestFor(game: GamesRoomGame) {
  return game === 'papan-bijak' ? papanBijakCreate : otherCreate
}

/** Maximum players a created room gets: Papan Bijak the `max_players` of the body, others the fixed maximum. */
export function gamesRoomMaxPlayers(game: GamesRoomGame, maxPlayers?: number): number {
  return game === 'papan-bijak' ? (maxPlayers ?? GAMES_ROOM_LIMITS[game].maxPlayers) : GAMES_ROOM_LIMITS[game].maxPlayers
}

/** `{ data: { code } }` of create (201) and join (200). */
export const GamesRoomCodeResultSchema = z.strictObject({ code: GamesRoomCodeSchema }).meta({ id: 'GamesRoomCodeResult' })
export type GamesRoomCodeResult = z.infer<typeof GamesRoomCodeResultSchema>

// --- join (M16-25) -----------------------------------------------------------------------------------------------

/** `room_code` is trimmed and upper-cased by the server; every refusal (including blank) is 404 "Bilik tidak dijumpai.". */
export const GamesRoomJoinRequestSchema = z
  .object({ room_code: z.string() })
  .meta({ id: 'GamesRoomJoinRequest' })
export type GamesRoomJoinRequest = z.infer<typeof GamesRoomJoinRequestSchema>

// --- room view (M16-26, 27, 28) -------------------------------------------------------------------------------

export const GamesRoomPlayerSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string().meta({ description: 'Display name only (D54(d)).' }),
    grade: z.string().meta({ description: '"Darjah n", "Tingkatan n" or "" without a grade.' }),
    team: z.number().int().optional().meta({ description: 'Kuiz Relay team number, once teams are set.' }),
    points: z.number().int(),
    isBot: z.boolean(),
  })
  .meta({ id: 'GamesRoomPlayer' })
export type GamesRoomPlayer = z.infer<typeof GamesRoomPlayerSchema>

export const GamesRoomSettingsSchema = z
  .strictObject({
    subject: GamesRoomSubjectSchema,
    gradeLevel: GamesGradeLevelSchema,
    matchMode: GamesMatchModeSchema,
    gradeMin: gamesGradeNumber.nullable(),
    gradeMax: gamesGradeNumber.nullable(),
    maxPlayers: z.number().int().min(2).max(8),
    minPlayers: z.number().int().min(2).max(4),
  })
  .meta({ id: 'GamesRoomSettings' })
export type GamesRoomSettings = z.infer<typeof GamesRoomSettingsSchema>

/** A Papan Bijak tile: plain, start, finish, bonus, trap, quiz, or ladder:N / snake:N (target tile). */
export const GamesBoardTileSchema = z
  .string()
  .regex(/^(plain|start|finish|bonus|trap|quiz|(ladder|snake):\d+)$/, 'Unknown board tile.')
  .meta({ id: 'GamesBoardTile' })

/**
 * Engine state exposed to players. Strict: the pool of question ids, the cursor, the pending question
 * id, the crossword answers and the Perang Fakta truth values are internal and never appear.
 */
export const GamesRoomStateSchema = z
  .strictObject({
    awaiting: z.enum(['roll', 'answer']).nullable(),
    round: z.number().int().min(0),
    total: z.number().int().min(0),
    humanId: IdSchema.meta({ description: 'The only player who may act (the host; every other player is a bot).' }),
    board: z.array(GamesBoardTileSchema).optional().meta({ description: 'Papan Bijak: the 50 tiles.' }),
    positions: z.record(z.string(), z.number().int()).optional().meta({ description: 'Papan Bijak: tile by user id.' }),
    meter: z
      .record(z.string(), z.number().int())
      .optional()
      .meta({ description: 'Benteng Ilmu HP, Perlumbaan Matematik steps or Teka Silang Kata words, by user id.' }),
    teamScores: z.record(z.string(), z.number().int()).optional().meta({ description: 'Kuiz Relay: score by team number.' }),
    log: z.array(z.string()),
    roundSecondsLeft: z.number().int().min(0).optional().meta({ description: 'Perang Fakta: seconds left in the 10 s round (server clock).' }),
    secondsLeft: z.number().int().min(0).optional().meta({ description: 'Teka Silang Kata: seconds left of the 5 minutes (server clock).' }),
  })
  .meta({ id: 'GamesRoomState' })
export type GamesRoomState = z.infer<typeof GamesRoomStateSchema>

export const GamesRoomResultSchema = z
  .strictObject({
    winnerId: IdSchema.nullable(),
    winnerName: z.string().nullable(),
    mvpId: IdSchema.nullable(),
    scores: z.array(
      z.strictObject({ userId: IdSchema, name: z.string(), points: z.number().int(), correct: gamesCount }),
    ),
  })
  .meta({ id: 'GamesRoomResult' })
export type GamesRoomResult = z.infer<typeof GamesRoomResultSchema>

/**
 * The room as polled every 3 seconds. `state` is null while waiting. `question` is present only while
 * playing and is keyless. `result` only when finished. A poll by the host of a waiting room below the
 * minimum players adds one bot (simulation, D53(a)); server clocks advance timed games on read.
 */
export const GamesRoomViewSchema = z
  .strictObject({
    code: GamesRoomCodeSchema,
    game: GamesRoomGameSchema,
    status: GamesRoomStatusSchema,
    host: z.strictObject({ id: IdSchema, name: z.string() }),
    players: z.array(GamesRoomPlayerSchema),
    settings: GamesRoomSettingsSchema,
    state: GamesRoomStateSchema.nullable(),
    round: z.number().int().min(0).optional().meta({ description: 'Present with `state`.' }),
    question: GamesKeylessQuestionSchema.optional(),
    result: GamesRoomResultSchema.optional(),
  })
  .meta({ id: 'GamesRoomView' })
export type GamesRoomView = z.infer<typeof GamesRoomViewSchema>

// --- action (M16-28) ----------------------------------------------------------------------------------------------

export const GamesRoomRollActionSchema = z.object({ type: z.literal('roll') }).meta({ id: 'GamesRoomRollAction' })
export const GamesRoomAnswerActionSchema = z
  .object({
    type: z.literal('answer'),
    questionId: z
      .string({ error: GAMES_MESSAGES.actionQuestion })
      .min(1, { error: GAMES_MESSAGES.actionQuestion })
      .max(64, { error: GAMES_MESSAGES.actionQuestion })
      .meta({ description: 'Id of the pending question; a different one is 422 "Soalan tidak sepadan.".' }),
    optionId: z
      .number({ error: GAMES_MESSAGES.actionOption })
      .int({ error: GAMES_MESSAGES.actionOption })
      .min(0, { error: GAMES_MESSAGES.actionOption })
      .max(3, { error: GAMES_MESSAGES.actionOption })
      .nullable()
      .optional(),
    value: z
      .union([z.boolean(), z.string()], { error: GAMES_MESSAGES.actionValue })
      .optional()
      .meta({ description: 'Perang Fakta true / false; Teka Silang Kata the typed word.' }),
    seconds: z
      .number({ error: GAMES_MESSAGES.actionSeconds })
      .min(0, { error: GAMES_MESSAGES.actionSeconds })
      .optional()
      .meta({ description: 'Default 15.', default: 15 }),
  })
  .meta({ id: 'GamesRoomAnswerAction' })

/** `{type:'roll'}` or `{type:'answer', questionId, optionId?, value?, seconds?}`; anything else 422 "Tindakan tidak sah." (type). */
export const GamesRoomActionRequestSchema = z
  .discriminatedUnion('type', [GamesRoomRollActionSchema, GamesRoomAnswerActionSchema], {
    error: GAMES_MESSAGES.actionType,
  })
  .meta({ id: 'GamesRoomActionRequest' })
export type GamesRoomActionRequest = z.infer<typeof GamesRoomActionRequestSchema>

// --- Papan Bijak quick match (M16-29 to M16-31), raw bodies -------------------------------------------------------

export const GamesQuickMatchStartRequestSchema = z
  .object({
    subject: z.enum(GAMES_PAPAN_BIJAK_SUBJECTS, { error: GAMES_MESSAGES.quickMatchSubject }),
    match_mode: z.enum(['same_grade', 'same_level'], { error: GAMES_MESSAGES.quickMatchMode }),
  })
  .meta({
    id: 'GamesQuickMatchStartRequest',
    description: 'Refusals are raw `{ error }` 422: "Subjek tidak sah." then "Padanan tidak sah.".',
  })
export type GamesQuickMatchStartRequest = z.infer<typeof GamesQuickMatchStartRequestSchema>

export const GamesQuickMatchStartResponseSchema = z
  .strictObject({ status: z.literal('searching') })
  .meta({ id: 'GamesQuickMatchStartResponse' })

export const GamesQuickMatchPollResponseSchema = z
  .union([
    z.strictObject({ status: z.enum(['searching', 'expired', 'cancelled']) }),
    z.strictObject({ status: z.literal('matched'), room_code: GamesRoomCodeSchema }),
  ])
  .meta({
    id: 'GamesQuickMatchPollResponse',
    description:
      'The caller latest search: none or cancelled = cancelled; older than 120 s = expired; the third poll matches (a Papan Bijak room, 4 seats, caller grade level, one bot) and answers matched with room_code; before that searching.',
  })
export type GamesQuickMatchPollResponse = z.infer<typeof GamesQuickMatchPollResponseSchema>

export const GamesQuickMatchCancelResponseSchema = z
  .strictObject({ status: z.literal('cancelled') })
  .meta({ id: 'GamesQuickMatchCancelResponse' })
