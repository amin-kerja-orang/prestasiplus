import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import {
  GamesKeylessOptionSchema,
  GamesKeylessQuestionSchema,
  GamesMatchModeSchema,
  GamesPapanBijakSubjectSchema,
  GamesRawErrorSchema,
  GamesRawMessageSchema,
  GamesRoomCodeSchema,
  GamesRoomGameSchema,
  GamesRoomStatusSchema,
  GamesRoomSubjectSchema,
  GamesGradeLevelSchema,
  GamesSoloGameSchema,
} from './common'
import {
  GamesAdminOverviewSchema,
  GamesAdminSettingsResultSchema,
  GamesAdminSettingsUpdateRequestSchema,
} from './admin'
import {
  GamesLeagueCardSchema,
  GamesLeagueClassLevelSchema,
  GamesLeagueCreateRequestSchema,
  GamesLeagueDetailSchema,
  GamesLeagueGameModeSchema,
  GamesLeagueIdResultSchema,
  GamesLeagueJoinRequestSchema,
  GamesLeagueListSchema,
  GamesLeagueScopeSchema,
  GamesLeagueScoringSchema,
  GamesLeagueStandingRowSchema,
  GamesLeagueStatusSchema,
  GamesLeagueTypeSchema,
  GamesSekolahBersaingQuerySchema,
  GamesSekolahBersaingRowSchema,
  GamesSekolahBersaingSchema,
} from './leagues'
import {
  GamesBoardTileSchema,
  GamesHubOpenRoomSchema,
  GamesHubSchema,
  GamesLobbyLeaderSchema,
  GamesLobbyLeadersSchema,
  GamesLobbyPapanBijakSchema,
  GamesLobbySchema,
  GamesPapanBijakTopRowSchema,
  GamesQuickMatchCancelResponseSchema,
  GamesQuickMatchPollResponseSchema,
  GamesQuickMatchStartRequestSchema,
  GamesQuickMatchStartResponseSchema,
  GamesRoomActionRequestSchema,
  GamesRoomAnswerActionSchema,
  GamesRoomRollActionSchema,
  GamesRoomCodeResultSchema,
  GamesRoomCreateRequestSchema,
  GamesRoomJoinRequestSchema,
  GamesRoomPlayerSchema,
  GamesRoomResultSchema,
  GamesRoomSettingsSchema,
  GamesRoomStateSchema,
  GamesRoomViewSchema,
} from './rooms'
import {
  GamesBetulSalahPayloadSchema,
  GamesCabaranKilatPayloadSchema,
  GamesJutawanAnswerRequestSchema,
  GamesJutawanAnswerResponseSchema,
  GamesJutawanLifelineRequestSchema,
  GamesJutawanLifelineResponseSchema,
  GamesJutawanPageSchema,
  GamesJutawanQuerySchema,
  GamesJutawanStartRequestSchema,
  GamesJutawanStartResponseSchema,
  GamesJutawanSubjectSchema,
  GamesKadMemoriPayloadSchema,
  GamesSessionIdSchema,
  GamesSoloPayloadSchema,
  GamesSoloQuerySchema,
  GAMES_SOLO_CHECK_EXAMPLES,
  GamesBetulSalahCheckResultSchema,
  GamesBetulSalahCheckSchema,
  GamesCabaranKilatCheckResultSchema,
  GamesCabaranKilatCheckSchema,
  GamesKadMemoriCheckResultSchema,
  GamesKadMemoriCheckSchema,
  GamesKadMemoriFaceSchema,
  GamesKadMemoriRevealRequestSchema,
  GamesSoloCheckRequestSchema,
  GamesSoloCheckResponseSchema,
  GamesSoloSubmitRequestSchema,
  GamesSusunJawapanCheckResultSchema,
  GamesSusunJawapanCheckSchema,
  GamesTembakJawapanCheckResultSchema,
  GamesTembakJawapanCheckSchema,
  GamesSoloSubmitResponseSchema,
  GamesSpinPageSchema,
  GamesSpinRefusedSchema,
  GamesSpinResponseSchema,
  GamesSpinSegmentSchema,
  GamesSusunJawapanPayloadSchema,
  GamesTembakJawapanPayloadSchema,
  GamesUjiMindaSchema,
  GamesWeeklyCompetitionSchema,
  GamesWeeklyRowSchema,
} from './solo'

/** Components contributed by BE-45 (appended to COMPONENT_SCHEMAS in openapi.ts). Every id starts with `Games`. */
export const GAMES_COMPONENT_SCHEMAS = {
  // shared
  GamesRoomGame: GamesRoomGameSchema,
  GamesSoloGame: GamesSoloGameSchema,
  GamesRoomSubject: GamesRoomSubjectSchema,
  GamesPapanBijakSubject: GamesPapanBijakSubjectSchema,
  GamesMatchMode: GamesMatchModeSchema,
  GamesRoomStatus: GamesRoomStatusSchema,
  GamesGradeLevel: GamesGradeLevelSchema,
  GamesRoomCode: GamesRoomCodeSchema,
  GamesKeylessOption: GamesKeylessOptionSchema,
  GamesKeylessQuestion: GamesKeylessQuestionSchema,
  GamesRawError: GamesRawErrorSchema,
  GamesRawMessage: GamesRawMessageSchema,
  // hub, lobby, rooms, quick match
  GamesHubOpenRoom: GamesHubOpenRoomSchema,
  GamesHub: GamesHubSchema,
  GamesPapanBijakTopRow: GamesPapanBijakTopRowSchema,
  GamesLobbyLeader: GamesLobbyLeaderSchema,
  GamesLobbyPapanBijak: GamesLobbyPapanBijakSchema,
  GamesLobbyLeaders: GamesLobbyLeadersSchema,
  GamesLobby: GamesLobbySchema,
  GamesRoomCreateRequest: GamesRoomCreateRequestSchema,
  GamesRoomCodeResult: GamesRoomCodeResultSchema,
  GamesRoomJoinRequest: GamesRoomJoinRequestSchema,
  GamesRoomPlayer: GamesRoomPlayerSchema,
  GamesRoomSettings: GamesRoomSettingsSchema,
  GamesBoardTile: GamesBoardTileSchema,
  GamesRoomState: GamesRoomStateSchema,
  GamesRoomResult: GamesRoomResultSchema,
  GamesRoomView: GamesRoomViewSchema,
  GamesRoomRollAction: GamesRoomRollActionSchema,
  GamesRoomAnswerAction: GamesRoomAnswerActionSchema,
  GamesRoomActionRequest: GamesRoomActionRequestSchema,
  GamesQuickMatchStartRequest: GamesQuickMatchStartRequestSchema,
  GamesQuickMatchStartResponse: GamesQuickMatchStartResponseSchema,
  GamesQuickMatchPollResponse: GamesQuickMatchPollResponseSchema,
  GamesQuickMatchCancelResponse: GamesQuickMatchCancelResponseSchema,
  // solo, spin, Jutawan, weekly, Uji Minda
  GamesSessionId: GamesSessionIdSchema,
  GamesSoloQuery: GamesSoloQuerySchema,
  GamesBetulSalahPayload: GamesBetulSalahPayloadSchema,
  GamesCabaranKilatPayload: GamesCabaranKilatPayloadSchema,
  GamesTembakJawapanPayload: GamesTembakJawapanPayloadSchema,
  GamesSusunJawapanPayload: GamesSusunJawapanPayloadSchema,
  GamesKadMemoriPayload: GamesKadMemoriPayloadSchema,
  GamesSoloPayload: GamesSoloPayloadSchema,
  GamesBetulSalahCheck: GamesBetulSalahCheckSchema,
  GamesCabaranKilatCheck: GamesCabaranKilatCheckSchema,
  GamesTembakJawapanCheck: GamesTembakJawapanCheckSchema,
  GamesSusunJawapanCheck: GamesSusunJawapanCheckSchema,
  GamesKadMemoriCheck: GamesKadMemoriCheckSchema,
  GamesBetulSalahCheckResult: GamesBetulSalahCheckResultSchema,
  GamesCabaranKilatCheckResult: GamesCabaranKilatCheckResultSchema,
  GamesTembakJawapanCheckResult: GamesTembakJawapanCheckResultSchema,
  GamesSusunJawapanCheckResult: GamesSusunJawapanCheckResultSchema,
  GamesKadMemoriCheckResult: GamesKadMemoriCheckResultSchema,
  GamesKadMemoriFace: GamesKadMemoriFaceSchema,
  GamesKadMemoriRevealRequest: GamesKadMemoriRevealRequestSchema,
  GamesSoloCheckRequest: GamesSoloCheckRequestSchema,
  GamesSoloCheckResponse: GamesSoloCheckResponseSchema,
  GamesSoloSubmitRequest: GamesSoloSubmitRequestSchema,
  GamesSoloSubmitResponse: GamesSoloSubmitResponseSchema,
  GamesSpinSegment: GamesSpinSegmentSchema,
  GamesSpinPage: GamesSpinPageSchema,
  GamesSpinResponse: GamesSpinResponseSchema,
  GamesSpinRefused: GamesSpinRefusedSchema,
  GamesJutawanQuery: GamesJutawanQuerySchema,
  GamesJutawanSubject: GamesJutawanSubjectSchema,
  GamesJutawanPage: GamesJutawanPageSchema,
  GamesJutawanStartRequest: GamesJutawanStartRequestSchema,
  GamesJutawanStartResponse: GamesJutawanStartResponseSchema,
  GamesJutawanAnswerRequest: GamesJutawanAnswerRequestSchema,
  GamesJutawanAnswerResponse: GamesJutawanAnswerResponseSchema,
  GamesJutawanLifelineRequest: GamesJutawanLifelineRequestSchema,
  GamesJutawanLifelineResponse: GamesJutawanLifelineResponseSchema,
  GamesWeeklyRow: GamesWeeklyRowSchema,
  GamesWeeklyCompetition: GamesWeeklyCompetitionSchema,
  GamesUjiMinda: GamesUjiMindaSchema,
  // leagues, Sekolah Bersaing
  GamesLeagueType: GamesLeagueTypeSchema,
  GamesLeagueScope: GamesLeagueScopeSchema,
  GamesLeagueGameMode: GamesLeagueGameModeSchema,
  GamesLeagueScoring: GamesLeagueScoringSchema,
  GamesLeagueStatus: GamesLeagueStatusSchema,
  GamesLeagueClassLevel: GamesLeagueClassLevelSchema,
  GamesLeagueCard: GamesLeagueCardSchema,
  GamesLeagueList: GamesLeagueListSchema,
  GamesLeagueCreateRequest: GamesLeagueCreateRequestSchema,
  GamesLeagueIdResult: GamesLeagueIdResultSchema,
  GamesLeagueJoinRequest: GamesLeagueJoinRequestSchema,
  GamesLeagueStandingRow: GamesLeagueStandingRowSchema,
  GamesLeagueDetail: GamesLeagueDetailSchema,
  GamesSekolahBersaingQuery: GamesSekolahBersaingQuerySchema,
  GamesSekolahBersaingRow: GamesSekolahBersaingRowSchema,
  GamesSekolahBersaing: GamesSekolahBersaingSchema,
  // admin
  GamesAdminOverview: GamesAdminOverviewSchema,
  GamesAdminSettingsUpdateRequest: GamesAdminSettingsUpdateRequestSchema,
  GamesAdminSettingsResult: GamesAdminSettingsResultSchema,
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on mutating requests.' }),
})
const GameParam = z.object({
  game: GamesRoomGameSchema.meta({ description: 'Room game key. Unknown: 404 "Permainan tidak dijumpai.".' }),
})
const RoomParams = z.object({
  game: GamesRoomGameSchema.meta({ description: 'Room game key. Unknown: 404 "Permainan tidak dijumpai.".' }),
  code: z.string().min(1).meta({ description: 'Room code (trimmed and upper-cased by the server).' }),
})
const SoloGameParam = z.object({
  game: GamesSoloGameSchema.meta({ description: 'Solo game key. Unknown: 404 "Permainan tidak dijumpai.".' }),
})
const SessionParams = z.object({ sessionId: z.string().min(1).meta({ description: 'Jutawan session id (uuid string).' }) })
const LeagueParams = z.object({
  id: z.string().min(1).meta({ description: 'League id. Digits only; a non-numeric segment does not match the route.' }),
})

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const CSRF_INVALID = err('CSRF_INVALID (missing or wrong X-CSRF-Token).')
const FORBIDDEN_CSRF_OR = (what: string) => err(`FORBIDDEN ${what}, or CSRF_INVALID (missing or wrong X-CSRF-Token).`)
const FORBIDDEN_ADMIN = err('FORBIDDEN "This action is unauthorized." (role is not admin).')
const FORBIDDEN_ADMIN_WRITE = err(
  'FORBIDDEN "This action is unauthorized." (role is not admin), or CSRF_INVALID (missing or wrong X-CSRF-Token).',
)
/**
 * D57(a): every write route (and the solo GET that creates a session row) can answer 429. Always the standard
 * `{ error }` body, even on the raw-body routes (M16-29, M16-31, M16-33, M16-35), because the mock has no limiter
 * and the live raw shape has no rate-limit case.
 */
const RATE_LIMITED = {
  description:
    'RATE_LIMITED (BM "Terlalu banyak percubaan. Sila cuba sebentar lagi."): body error.retryAfter and the Retry-After header carry the seconds to wait.',
  headers: {
    'Retry-After': {
      description: 'Seconds until a retry is allowed (same value as error.retryAfter).',
      schema: { type: 'integer' as const, minimum: 0 },
    },
  },
  content: { 'application/json': { schema: ErrorBodySchema } },
}
/** D57(b): responses that carry join codes (room code, league invite code) or answer keys (the solo check, D58a) are never cached. */
const NO_STORE_HEADERS = {
  'Cache-Control': {
    description: 'no-store: the body carries a join code or answer keys and must not be cached by browsers or proxies.',
    schema: { type: 'string' as const, enum: ['no-store'] },
  },
}
const noStore = (schema: z.ZodType, description: string) => ({ ...json(schema, description), headers: NO_STORE_HEADERS })

const GAME_404 = 'NOT_FOUND "Permainan tidak dijumpai." (unknown game).'

const TAGS = ['games']

/**
 * Registers the 29 BE-45 routes: games hub and lobbies, rooms and the Papan Bijak quick match, solo
 * games, Roda Nasib, Jutawan Ilmu, the weekly board, Uji Minda, leagues, Sekolah Bersaing and the admin
 * game settings. Bodies are `{ data }` / `{ error }` except the raw routes M16-29 to M16-31, M16-33 and
 * M16-35 whose live-shaped bodies and raw error bodies are declared per route. The battle routes (BE-44)
 * are not registered here. 401 and CSRF refusals use the standard `{ error }` body on every route.
 */
export function registerGamesPaths(registry: OpenAPIRegistry): void {
  // ---- hub, lobby -------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/games/hub',
    tags: TAGS,
    summary: 'Permainan hub: open rooms and chips (M16-22)',
    description:
      'Up to 6 newest waiting rooms with a free seat, newest first. chips.battled comes from the battle read service (BE-44). Lists open room codes: Cache-Control: no-store.',
    responses: { 200: noStore(envelopeOf(GamesHubSchema), 'Open rooms and chips; Cache-Control: no-store.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/games/{game}/lobby',
    tags: TAGS,
    summary: 'Lobby of a room game (M16-23)',
    description:
      'papan-bijak: top10 of standings with jumlah > 0 (wins desc, skor desc, creation order). Other games: leaders, top 10 with wins > 0. Names are display names only (D54(d)).',
    request: { params: GameParam },
    responses: { 200: json(envelopeOf(GamesLobbySchema), 'Lobby.'), 401: UNAUTHORIZED, 404: err(GAME_404) },
  })

  // ---- rooms -----------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'post',
    path: '/games/{game}/rooms',
    tags: TAGS,
    summary: 'Create a room (M16-24)',
    description:
      'The caller becomes host and first (human) player; the room is waiting. Success is 201. Validation order: subject, grade_level, match_mode, grade_min, max_players.',
    request: { params: GameParam, headers: [csrf], body: body(GamesRoomCreateRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      201: noStore(envelopeOf(GamesRoomCodeResultSchema), 'Room created; the code is a join code, Cache-Control: no-store.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: err(GAME_404),
      422: err(
        'VALIDATION_ERROR with fields[x] = message and the same top-level message: "Subjek tidak sah." (subject), "Tahap soalan tidak sah." (grade_level), "Julat tahap tidak sah." (match_mode or grade_min), "Bilangan pemain tidak sah." (max_players).',
      ),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/games/{game}/rooms/join',
    tags: TAGS,
    summary: 'Join a waiting room by code (M16-25)',
    description:
      'Every refusal is 404 "Bilik tidak dijumpai." (blank code, unknown room, other game, not waiting, full, grade not allowed by the match mode). Already a player: 200 with the same code, no second row.',
    request: { params: GameParam, headers: [csrf], body: body(GamesRoomJoinRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      200: noStore(envelopeOf(GamesRoomCodeResultSchema), 'Joined (or already a player); Cache-Control: no-store.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: err('NOT_FOUND "Bilik tidak dijumpai." for every refusal, or "Permainan tidak dijumpai." (unknown game).'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/games/{game}/rooms/{code}',
    tags: TAGS,
    summary: 'Room view, polled every 3 s (M16-26)',
    description:
      'Only players of the room; others get 404. SIMULATION on read (D53(a)): a poll by the host of a waiting room below the minimum players (2, Kuiz Relay 4) adds one bot; server clocks advance or finish timed games (Perang Fakta 10 s rounds, Teka Silang Kata 5 minutes) and settle rewards once. The question is keyless.',
    request: { params: RoomParams },
    responses: {
      200: noStore(envelopeOf(GamesRoomViewSchema), 'The room; Cache-Control: no-store.'),
      401: UNAUTHORIZED,
      404: err('NOT_FOUND "Bilik tidak dijumpai." (unknown, other game, or caller is not a player), or "Permainan tidak dijumpai.".'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/games/{game}/rooms/{code}/start',
    tags: TAGS,
    summary: 'Start the game (M16-27)',
    description: 'Host only. Draws the question pool for the room subject and the host level. No body.',
    request: { params: RoomParams, headers: [csrf] },
    responses: {
      429: RATE_LIMITED,
      200: json(envelopeOf(GamesRoomViewSchema), 'The playing room.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF_OR('"Hanya hos boleh memulakan permainan." (caller is not the host)'),
      404: err('NOT_FOUND "Bilik tidak dijumpai." or "Permainan tidak dijumpai.".'),
      409: err('CONFLICT "Permainan sudah dimulakan." (not waiting), "Pemain belum mencukupi." (below the minimum players) or "Soalan tidak mencukupi." (question pool).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/games/{game}/rooms/{code}/action',
    tags: TAGS,
    summary: 'Roll the dice or answer (M16-28)',
    description:
      'Only the room human (the host) acts; every other player is a bot. If a server clock ended the game just before the action, the finished room is returned instead of an error. On finish: standings and one reward report for the caller.',
    request: { params: RoomParams, headers: [csrf], body: body(GamesRoomActionRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      200: json(envelopeOf(GamesRoomViewSchema), 'The room after the action.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_CSRF_OR('"Bukan giliran anda." (caller is not the room human)'),
      404: err('NOT_FOUND "Bilik tidak dijumpai." or "Permainan tidak dijumpai.".'),
      409: err('CONFLICT "Permainan belum bermula.", "Bukan giliran anda untuk gulung dadu.", "Tiada soalan untuk dijawab." or "Tiada jam untuk permainan ini.".'),
      422: err(
        'VALIDATION_ERROR: "Soalan tidak sah." (questionId), "Pilihan tidak sah." (optionId), "Masa tidak sah." (seconds), "Tindakan tidak sah." (type), "Soalan tidak sepadan." (questionId), "Jawapan tidak sah." (value).',
      ),
    },
  })

  // ---- Papan Bijak quick match (raw bodies) -------------------------------------------------------------------

  registry.registerPath({
    method: 'post',
    path: '/papan-bijak/quick-match',
    tags: TAGS,
    summary: 'Start a Papan Bijak quick-match search (M16-29)',
    description: 'RAW live-shaped body (no `{ data }`). The 422 body is raw `{ error: "<BM>" }`, not the standard error body.',
    request: { headers: [csrf], body: body(GamesQuickMatchStartRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      200: json(GamesQuickMatchStartResponseSchema, 'Searching.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      422: json(GamesRawErrorSchema, 'Raw `{ error }`: "Subjek tidak sah." or "Padanan tidak sah.".'),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/papan-bijak/quick-match/poll',
    tags: TAGS,
    summary: 'Poll the quick match (M16-30)',
    description: 'RAW body, polled every 3 s. The third poll matches and creates the room (host = caller, 4 seats, one bot).',
    responses: { 200: json(GamesQuickMatchPollResponseSchema, 'Search state.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'post',
    path: '/papan-bijak/quick-match/cancel',
    tags: TAGS,
    summary: 'Cancel the quick match (M16-31)',
    description: 'RAW body. Always answers cancelled and turns a searching row into cancelled.',
    request: { headers: [csrf] },
    responses: { 429: RATE_LIMITED, 200: json(GamesQuickMatchCancelResponseSchema, 'Cancelled.'), 401: UNAUTHORIZED, 403: CSRF_INVALID },
  })

  // ---- single-player games --------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/games/solo/{game}',
    tags: TAGS,
    summary: 'Start a single-player game session (M16-32)',
    description:
      'Creates a session row and returns its items. D58a: the payload is keyless; no answer key (is_true, correct, answer, pair_id) is sent before the answer. Each answer is checked by POST /games/solo/{game}/check. Kad Memori: the board has only opaque card ids, the count and the layout, face-down; a face comes only from the reveal route (first card of a move) and the check response.',
    request: { params: SoloGameParam, query: GamesSoloQuerySchema },
    responses: {
      429: RATE_LIMITED,
      200: json(envelopeOf(GamesSoloPayloadSchema), 'The session id and the keyless items of the game.'),
      401: UNAUTHORIZED,
      404: err(GAME_404),
      422: err('VALIDATION_ERROR "Tahap tidak sah." (fields.darjah): darjah outside 1..11.'),
    },
  })

  const checkExamples = <K extends 'request' | 'response'>(kind: K) =>
    Object.fromEntries(
      Object.entries(GAMES_SOLO_CHECK_EXAMPLES).map(([game, ex]) => [game, { summary: `${game} (${kind === 'request' ? 'GamesXxxCheck' : 'GamesXxxCheckResult'})`, value: kind === 'request' ? ex.request : { data: ex.response } }]),
    )

  registry.registerPath({
    method: 'post',
    path: '/games/solo/{game}/check',
    tags: TAGS,
    summary: 'Check one single-player answer (D58a) [PROPOSED route, not in the mock]',
    description:
      'Modelled on the Bijak "Semak" check (/bijak/attempts/{id}/questions/{questionId}/check). Own session only. The path parameter `game` selects the body and the result: betul-salah = GamesBetulSalahCheck / GamesBetulSalahCheckResult, cabaran-kilat = GamesCabaranKilatCheck / GamesCabaranKilatCheckResult, tembak-jawapan = GamesTembakJawapanCheck / GamesTembakJawapanCheckResult, susun-jawapan = GamesSusunJawapanCheck / GamesSusunJawapanCheckResult, kad-memori = GamesKadMemoriCheck / GamesKadMemoriCheckResult (one named component each; request and response `examples` are keyed by game). A body of another game is 422. ' +
      'The server checks the answer against the stored key, stores the check, and returns correct/wrong plus the key of that item, revealed only now ({ data }). One check per item: a second check of the same item is 409 (so the key cannot be probed by retrying). ' +
      'Kad Memori: the body names two cards by opaque id; the response carries BOTH faces (the board never does), correct when they are a pair, and pair_id only on a match (null on a mismatch); a mismatch may be repeated, a card of an already matched pair is 409, and if another card is open (revealed, not checked) 409 "Sila padankan kad yang dibuka dahulu." [PROPOSED]. Every stored check feeds the final submit (moves = number of Kad Memori checks). ' +
      'Standard `{ error }` bodies. All BM texts of this route are [PROPOSED] (the mock has no check route): 404 "Sesi tidak dijumpai." and "Soalan tidak dijumpai." (copy reused from Jutawan), 409 "Soalan sudah dijawab.", "Kad sudah dipadankan.", 422 "Jawapan tidak sah." (reused). The response carries answer keys, so Cache-Control: no-store.',
    request: {
      params: SoloGameParam,
      headers: [csrf],
      body: {
        required: true,
        content: { 'application/json': { schema: GamesSoloCheckRequestSchema, examples: checkExamples('request') } },
      },
    },
    responses: {
      429: RATE_LIMITED,
      200: {
        ...noStore(envelopeOf(GamesSoloCheckResponseSchema), 'Correct or wrong plus the key of the item (per-game GamesXxxCheckResult); Cache-Control: no-store.'),
        content: { 'application/json': { schema: envelopeOf(GamesSoloCheckResponseSchema), examples: checkExamples('response') } },
      },
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: err('NOT_FOUND "Permainan tidak dijumpai." (unknown game), "Sesi tidak dijumpai." [PROPOSED] (unknown or foreign session) or "Soalan tidak dijumpai." [PROPOSED] (item or card not in the session).'),
      409: err('CONFLICT "Keputusan sudah dihantar." (session already submitted), "Soalan sudah dijawab." [PROPOSED] (item already checked), "Kad sudah dipadankan." [PROPOSED] (Kad Memori: card already matched) or "Sila padankan kad yang dibuka dahulu." [PROPOSED] (Kad Memori: another card is open).'),
      422: err('VALIDATION_ERROR "Jawapan tidak sah." [PROPOSED] (answer, option or card value, a body of another game, or the same card twice).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/games/solo/kad-memori/reveal',
    tags: TAGS,
    summary: 'Reveal one Kad Memori face (D58a) [PROPOSED route, LEAD decision pending]',
    description:
      'The mock page shows the face of the first flipped card at once, so the first card of a move needs a reveal; the second card comes with the check response. Static path: wins over `/games/solo/{game}/...`. At most one card may be open (revealed and not yet checked): a second reveal is 409 "Sila padankan kad yang dibuka dahulu." [PROPOSED], and the open card is closed by the next check naming it, so reveals never outnumber moves by more than one and the faces cannot be read without playing. A matched card is 409 "Kad sudah dipadankan." [PROPOSED]. If the LEAD prefers faces via the check response only, drop this route and the page shows the first card face-down until the second tap. Standard `{ error }` bodies; the face is not a key but is sent no-store.',
    request: { headers: [csrf], body: body(GamesKadMemoriRevealRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      200: noStore(envelopeOf(GamesKadMemoriFaceSchema), 'The face of the card; Cache-Control: no-store.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: err('NOT_FOUND "Sesi tidak dijumpai." [PROPOSED] (unknown or foreign session) or "Soalan tidak dijumpai." [PROPOSED] (card not in the session).'),
      409: err('CONFLICT "Keputusan sudah dihantar.", "Kad sudah dipadankan." [PROPOSED] or "Sila padankan kad yang dibuka dahulu." [PROPOSED].'),
      422: err('VALIDATION_ERROR "Jawapan tidak sah." [PROPOSED] (card id).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/games/solo/{game}/submit',
    tags: TAGS,
    summary: 'Submit a single-player result (M16-33)',
    description:
      'D58a: the body is only the session id; the server computes score, counts, streak, combo, level and coins from the stored checks and ignores any value the client sends. RAW live-shaped bodies; errors are raw `{ message }` (404, 409, 422), not the standard error body. Own session only, one submit per session. A first result is a record, later ones only if they exceed the stored best. The response also returns the computed values ([PROPOSED] fields).',
    request: { params: SoloGameParam, headers: [csrf], body: body(GamesSoloSubmitRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      200: json(GamesSoloSubmitResponseSchema, '{ is_new_record, syiling_awarded, score, correct_count, total_answered } or, for Kad Memori, { results: { syiling_earned, accuracy, moves, time_seconds } }.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: json(GamesRawMessageSchema, 'Raw `{ message: "Permainan tidak dijumpai." }`.'),
      409: json(GamesRawMessageSchema, 'Raw `{ message: "Keputusan sudah dihantar." }`.'),
      422: json(GamesRawMessageSchema, 'Raw `{ message: "Keputusan tidak sah." }` (unknown or foreign session, no stored check, or Kad Memori with fewer than 6 matched pairs).'),
    },
  })

  // ---- Roda Nasib ------------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/games/roda-nasib',
    tags: TAGS,
    summary: 'Roda Nasib page (M16-34)',
    responses: { 200: json(envelopeOf(GamesSpinPageSchema), 'Segments, counters and today state.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'post',
    path: '/games/roda-nasib/spin',
    tags: TAGS,
    summary: 'Spin the wheel, once per Malaysia day (M16-35)',
    description: 'RAW body. The segment is drawn server-side by the weights. A second spin the same day is 409 raw `{ success: false, message }`.',
    request: { headers: [csrf] },
    responses: {
      429: RATE_LIMITED,
      200: json(GamesSpinResponseSchema, 'Spin result.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      409: json(GamesSpinRefusedSchema, 'Raw `{ success: false, message: "Anda sudah spin hari ini." }`.'),
    },
  })

  // ---- Jutawan Ilmu -----------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/games/jutawan',
    tags: TAGS,
    summary: 'Jutawan Ilmu page (M16-36)',
    description: 'With `darjah` the page also carries `heading` and the `subjects` tiles for that level.',
    request: { query: GamesJutawanQuerySchema },
    responses: {
      200: json(envelopeOf(GamesJutawanPageSchema), 'Best level, games and optional subject tiles.'),
      401: UNAUTHORIZED,
      422: err('VALIDATION_ERROR "Tahap tidak sah." (fields.darjah).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/games/jutawan/start',
    tags: TAGS,
    summary: 'Start a Jutawan Ilmu game (M16-37)',
    description: 'Success is 200 (not 201). The first question is keyless.',
    request: { headers: [csrf], body: body(GamesJutawanStartRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      200: json(envelopeOf(GamesJutawanStartResponseSchema), 'Session, question 1 and 3 lifelines.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      422: err('VALIDATION_ERROR: "Tahap tidak sah." (darjah), "Subjek tidak sah." (subject), "Soalan tidak mencukupi." (subject; fewer than 15 questions).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/games/jutawan/{sessionId}/answer',
    tags: TAGS,
    summary: 'Answer the current Jutawan question (M16-38)',
    description:
      'Own session only. A wrong answer or level 15 ends the game with `result`; otherwise `next` is the keyless next question. On end the best level and games count are updated and one reward report is made.',
    request: { params: SessionParams, headers: [csrf], body: body(GamesJutawanAnswerRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      200: json(envelopeOf(GamesJutawanAnswerResponseSchema), 'Answer outcome.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: err('NOT_FOUND "Sesi tidak dijumpai." or "Soalan tidak dijumpai.".'),
      409: err('CONFLICT "Permainan sudah tamat.".'),
      422: err('VALIDATION_ERROR "Soalan tidak sepadan." (questionId) or "Pilihan tidak sah." (optionId).'),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/games/jutawan/{sessionId}/lifeline',
    tags: TAGS,
    summary: 'Use the 50:50 lifeline (M16-39)',
    description: 'Removes two wrong options of the current question and remembers the removal for it.',
    request: { params: SessionParams, headers: [csrf], body: body(GamesJutawanLifelineRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      200: json(envelopeOf(GamesJutawanLifelineResponseSchema), 'Removed options and lifelines left.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: err('NOT_FOUND "Sesi tidak dijumpai.".'),
      409: err('CONFLICT "Permainan sudah tamat." or "Tiada bantuan tersedia." (none left, or already used on this question).'),
      422: err('VALIDATION_ERROR "Bantuan tidak sah." (type).'),
    },
  })

  // ---- weekly competition, Uji Minda --------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/games/pertandingan',
    tags: TAGS,
    summary: 'Weekly competition board (M16-40)',
    description: '`?week=` is ignored (as live). Top 20 by the practice weekly ranking; names are display names only (D54(d)).',
    responses: { 200: json(envelopeOf(GamesWeeklyCompetitionSchema), 'Weekly board.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'get',
    path: '/games/uji-minda',
    tags: TAGS,
    summary: 'Uji Minda placeholder (M16-41)',
    description: 'Constant `{ data: { challenge: null } }`.',
    responses: { 200: json(envelopeOf(GamesUjiMindaSchema), 'No challenge.'), 401: UNAUTHORIZED },
  })

  // ---- leagues -----------------------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/leagues',
    tags: TAGS,
    summary: 'Leagues list (M16-46)',
    description: 'mine = leagues containing the caller school; open = every league that is not ended.',
    responses: { 200: json(envelopeOf(GamesLeagueListSchema), 'Mine and open leagues.'), 401: UNAUTHORIZED },
  })

  registry.registerPath({
    method: 'post',
    path: '/leagues',
    tags: TAGS,
    summary: 'Create a league (M16-47)',
    description:
      'Any signed-in role. The league is upcoming with an 8-character invite code (A-Z0-9); the creator school (if any) joins. Success is 201.',
    request: { headers: [csrf], body: body(GamesLeagueCreateRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      201: json(envelopeOf(GamesLeagueIdResultSchema), 'League created.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      422: err(
        'VALIDATION_ERROR, top-level message = the first field message: "Sila lengkapkan semua medan wajib." (name, type, scope, game_mode, scoring_method, start_date, end_date), "Tarikh tamat mesti selepas tarikh mula." (end_date), "Had sekolah mesti antara 2 dan 500." (max_schools), "Mata pelajaran tidak sah." (subject_id), "Tingkatan tidak sah." (class_levels).',
      ),
    },
  })

  registry.registerPath({
    method: 'post',
    path: '/leagues/join',
    tags: TAGS,
    summary: 'Join a league by invite code (M16-48)',
    description: 'The caller school joins. Static path: wins over `/leagues/{id}`.',
    request: { headers: [csrf], body: body(GamesLeagueJoinRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      200: json(envelopeOf(GamesLeagueIdResultSchema), 'Joined.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      422: err(
        'VALIDATION_ERROR with fields.invite_code: "Kod jemputan tidak sah.", "Liga ini sudah tamat.", "Anda perlu mempunyai sekolah untuk menyertai liga ini.", "Sekolah anda sudah menyertai liga ini.", "Liga ini sudah penuh.".',
      ),
    },
  })

  registry.registerPath({
    method: 'get',
    path: '/leagues/{id}',
    tags: TAGS,
    summary: 'League detail (M16-49)',
    description: 'The invite code and share link are visible to non-members, as live.',
    request: { params: LeagueParams },
    responses: {
      200: noStore(envelopeOf(GamesLeagueDetailSchema), 'League detail with the invite code; Cache-Control: no-store.'),
      401: UNAUTHORIZED,
      404: err('NOT_FOUND "Liga tidak dijumpai.".'),
    },
  })

  // ---- Sekolah Bersaing -----------------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/sekolah-bersaing',
    tags: TAGS,
    summary: 'Sekolah Bersaing weekly board (M16-50)',
    description:
      'National board, no school scope. `week`: a valid YYYY-MM-DD selects the Monday of that week; anything else the current week; never an error. An anonymous row shows "Sekolah anonim".',
    request: { query: GamesSekolahBersaingQuerySchema },
    responses: { 200: json(envelopeOf(GamesSekolahBersaingSchema), 'Weekly snapshot.'), 401: UNAUTHORIZED },
  })

  // ---- admin game settings -----------------------------------------------------------------------------------

  registry.registerPath({
    method: 'get',
    path: '/admin/games',
    tags: TAGS,
    summary: 'Admin game statistics and settings (M16-51)',
    description: 'Role admin only.',
    responses: { 200: json(envelopeOf(GamesAdminOverviewSchema), 'Room statistics and settings.'), 401: UNAUTHORIZED, 403: FORBIDDEN_ADMIN },
  })

  registry.registerPath({
    method: 'put',
    path: '/admin/games/settings',
    tags: TAGS,
    summary: 'Save the Papan Bijak quiz-tile count (M16-52)',
    description: 'Role admin only. The mock writes no audit event.',
    request: { headers: [csrf], body: body(GamesAdminSettingsUpdateRequestSchema) },
    responses: {
      429: RATE_LIMITED,
      200: json(envelopeOf(GamesAdminSettingsResultSchema), 'Saved.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_ADMIN_WRITE,
      422: err('VALIDATION_ERROR "Nilai mesti antara 0 dan 38." (fields.boardgame_quiz_tiles).'),
    },
  })
}
