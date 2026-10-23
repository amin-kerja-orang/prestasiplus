/**
 * M16 game client functions (SRS M16 v1.6 §7 #22-#41 and #51-#52; build-plan M16-T2). UI tasks (M16-T4/T5/T6b)
 * import these and do not change this file (build-plan §S.3 rule 5).
 *
 * The quick match, the submit and the spin keep the live bodies, so their functions use `api.raw` and resolve
 * to `{status, body}` for any HTTP status (the page script reads `data.error` / `data.message`, §7.1). Every
 * other function unwraps the `{data}` envelope and rejects with `ApiError` (404, 403, 409, 422 with `fields`).
 */

import { api, type RawResponse } from '@/api'

import type {
  AdminGames,
  GameLobby,
  GamesHub,
  JutawanAnswerResult,
  JutawanLifelineResult,
  JutawanPage,
  JutawanStart,
  KadMemoriFace,
  PbQuickMatchPoll,
  PbQuickMatchStart,
  RoomActionBody,
  RoomCreateBody,
  RoomGame,
  RoomView,
  SoloCheckBodies,
  SoloCheckResults,
  SoloGame,
  SoloPayloads,
  SoloSubmitBody,
  SoloSubmitResponse,
  SpinPage,
  SpinResponse,
  WeeklyCompetition,
} from './game-types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

/** #22 `GET /api/games/hub`. */
export function fetchGamesHub(options: Signal = {}): Promise<GamesHub> {
  return api.get<GamesHub>('/api/games/hub', withSignal(options))
}

// --- room games (S7–S12) --------------------------------------------------------------------------------

/** #23 `GET /api/games/{game}/lobby` (404 for an unknown game). */
export function fetchGameLobby(game: RoomGame, options: Signal = {}): Promise<GameLobby> {
  return api.get<GameLobby>(`/api/games/${game}/lobby`, withSignal(options))
}

/** #24 `POST /api/games/{game}/rooms` (422 with `fields`). */
export function createRoom(game: RoomGame, body: RoomCreateBody): Promise<{ code: string }> {
  return api.post<{ code: string }>(`/api/games/${game}/rooms`, { body })
}

/** #25 `POST /api/games/{game}/rooms/join` (404 "Bilik tidak dijumpai." for every refusal). */
export function joinRoom(game: RoomGame, roomCode: string): Promise<{ code: string }> {
  return api.post<{ code: string }>(`/api/games/${game}/rooms/join`, {
    body: { room_code: roomCode },
  })
}

/** #26 `GET /api/games/{game}/rooms/{code}` (poll every 3 s; 404 for a user who is not a player). */
export function fetchRoom(game: RoomGame, code: string, options: Signal = {}): Promise<RoomView> {
  return api.get<RoomView>(`/api/games/${game}/rooms/${code}`, withSignal(options))
}

/** #27 `POST /api/games/{game}/rooms/{code}/start` (host; 409 without enough players). */
export function startRoom(game: RoomGame, code: string): Promise<RoomView> {
  return api.post<RoomView>(`/api/games/${game}/rooms/${code}/start`)
}

/** #28 `POST /api/games/{game}/rooms/{code}/action` (a roll or an answer). */
export function roomAction(game: RoomGame, code: string, body: RoomActionBody): Promise<RoomView> {
  return api.post<RoomView>(`/api/games/${game}/rooms/${code}/action`, { body })
}

// --- Papan Bijak quick match (live bodies) ----------------------------------------------------------------

/** #29 `POST /api/papan-bijak/quick-match`. */
export function startPbQuickMatch(body: {
  subject: string
  match_mode: 'same_grade' | 'same_level'
}): Promise<RawResponse<PbQuickMatchStart>> {
  return api.raw<PbQuickMatchStart>('POST', '/api/papan-bijak/quick-match', body)
}

/** #30 `GET /api/papan-bijak/quick-match/poll` (every 3 s). */
export function pollPbQuickMatch(options: Signal = {}): Promise<RawResponse<PbQuickMatchPoll>> {
  return api.raw<PbQuickMatchPoll>(
    'GET',
    '/api/papan-bijak/quick-match/poll',
    undefined,
    withSignal(options),
  )
}

/** #31 `POST /api/papan-bijak/quick-match/cancel`. */
export function cancelPbQuickMatch(): Promise<RawResponse<{ status: 'cancelled' }>> {
  return api.raw<{ status: 'cancelled' }>('POST', '/api/papan-bijak/quick-match/cancel')
}

// --- single-player games (S13–S17) ---------------------------------------------------------------------------

/** #32 `GET /api/games/solo/{game}?darjah=` (a new session; 422 for a `darjah` outside 1-11). */
export function fetchSoloGame<G extends SoloGame>(
  game: G,
  darjah?: number,
  options: Signal = {},
): Promise<SoloPayloads[G]> {
  return api.get<SoloPayloads[G]>(`/api/games/solo/${game}`, {
    ...(darjah === undefined ? {} : { query: { darjah } }),
    ...withSignal(options),
  })
}

/**
 * #33 `POST /api/games/solo/{game}/submit` (409 already submitted, 422 impossible values). D58a, http mode:
 * the body is only `{ session_id }` (the server computes the result from the stored checks).
 */
export function submitSoloGame(
  game: SoloGame,
  body: SoloSubmitBody | { session_id: string },
): Promise<RawResponse<SoloSubmitResponse>> {
  return api.raw<SoloSubmitResponse>('POST', `/api/games/solo/${game}/submit`, body)
}

/**
 * D58a `POST /api/games/solo/{game}/check` (http mode only; the mock has no such route): one answer checked by
 * the server, which returns correct/wrong plus the key of that item. One check per item (409 on a second one);
 * Kad Memori: one check per flipped pair.
 */
export function checkSoloAnswer<G extends SoloGame>(
  game: G,
  body: SoloCheckBodies[G],
): Promise<SoloCheckResults[G]> {
  return api.post<SoloCheckResults[G]>(`/api/games/solo/${game}/check`, { body })
}

/** D58a `POST /api/games/solo/kad-memori/reveal` (http mode only): the face of the first card of a move. */
export function revealKadMemoriCard(body: {
  session_id: string
  card_id: string
}): Promise<KadMemoriFace> {
  return api.post<KadMemoriFace>('/api/games/solo/kad-memori/reveal', { body })
}

// --- Roda Nasib (S18) ---------------------------------------------------------------------------------------------

/** #34 `GET /api/games/roda-nasib`. */
export function fetchSpinPage(options: Signal = {}): Promise<SpinPage> {
  return api.get<SpinPage>('/api/games/roda-nasib', withSignal(options))
}

/** #35 `POST /api/games/roda-nasib/spin` (409 `{success: false, message}` on a second spin that day). */
export function spinWheel(): Promise<RawResponse<SpinResponse>> {
  return api.raw<SpinResponse>('POST', '/api/games/roda-nasib/spin')
}

// --- Jutawan Ilmu (S19 and the provisional game) -------------------------------------------------------------

/** #36 `GET /api/games/jutawan?darjah=` (422 for a `darjah` outside 1-11). */
export function fetchJutawanPage(darjah?: number, options: Signal = {}): Promise<JutawanPage> {
  return api.get<JutawanPage>('/api/games/jutawan', {
    ...(darjah === undefined ? {} : { query: { darjah } }),
    ...withSignal(options),
  })
}

/** #37 `POST /api/games/jutawan/start` (PROVISIONAL). */
export function startJutawan(body: { subject: number; darjah: number }): Promise<JutawanStart> {
  return api.post<JutawanStart>('/api/games/jutawan/start', { body })
}

/** #38 `POST /api/games/jutawan/{sessionId}/answer` (PROVISIONAL). */
export function answerJutawan(
  sessionId: string,
  body: { questionId: number; optionId: number },
): Promise<JutawanAnswerResult> {
  return api.post<JutawanAnswerResult>(`/api/games/jutawan/${sessionId}/answer`, { body })
}

/** #39 `POST /api/games/jutawan/{sessionId}/lifeline` (PROVISIONAL; 409 when none is left). */
export function lifelineJutawan(sessionId: string): Promise<JutawanLifelineResult> {
  return api.post<JutawanLifelineResult>(`/api/games/jutawan/${sessionId}/lifeline`, {
    body: { type: '50:50' },
  })
}

// --- weekly competition, Uji Minda, settings --------------------------------------------------------------------

/** #40 `GET /api/games/pertandingan` (`?week=` is ignored, as live). */
export function fetchWeeklyCompetition(options: Signal = {}): Promise<WeeklyCompetition> {
  return api.get<WeeklyCompetition>('/api/games/pertandingan', withSignal(options))
}

/** #41 `GET /api/games/uji-minda`. */
export function fetchUjiMinda(options: Signal = {}): Promise<{ challenge: null }> {
  return api.get<{ challenge: null }>('/api/games/uji-minda', withSignal(options))
}

/** #51 `GET /api/admin/games` (admin). */
export function fetchAdminGames(options: Signal = {}): Promise<AdminGames> {
  return api.get<AdminGames>('/api/admin/games', withSignal(options))
}

/** #52 `PUT /api/admin/games/settings` (admin; 422 with the message under `boardgame_quiz_tiles`). */
export function saveGameSettings(
  boardgameQuizTiles: number,
): Promise<{ boardgameQuizTiles: number }> {
  return api.put<{ boardgameQuizTiles: number }>('/api/admin/games/settings', {
    body: { boardgame_quiz_tiles: boardgameQuizTiles },
  })
}
