/**
 * M16 battle, ranking, tournament, league and Sekolah Bersaing client functions (SRS M16 v1.6 §7 #1-#21
 * and #42-#50; build-plan M16-T1). UI tasks import these and do not change this file (build-plan §S.3
 * rule 5).
 *
 * The 13 `/api/battle/*` endpoints keep the live bodies, so their functions use `api.raw` and resolve
 * to `{status, body}` for any HTTP status (the page script reads `data.error` / `data.message` itself,
 * §7.1). The banner (#1) resolves to an empty list on any failure (§6.13). Every other function
 * rejects with `ApiError` (404, 403, 422 with `fields`).
 */

import { api, wireIdOpt, type RawResponse } from '@/api'

import type {
  ArenaAnswerBody,
  ArenaAnswerResult,
  ArenaView,
  BattleInviteBody,
  BattleInvitation,
  BattleListRow,
  BattleLobby,
  BattleQueueId,
  BattleStartBody,
  BattleStartResponse,
  LeagueBody,
  LeagueCard,
  LeagueDetail,
  OpponentSearchUser,
  PollChallengerResponse,
  PollMatchResponse,
  SchoolDetail,
  SchoolStandingsResult,
  SekolahBersaingResult,
  StudentStanding,
  TournamentActive,
  TournamentBody,
  TournamentDetail,
  TournamentFormOptions,
  TournamentListItem,
} from './types'

interface Signal {
  signal?: AbortSignal
}

const withSignal = (o: Signal) => (o.signal ? { signal: o.signal } : {})

// --- battle (live bodies) ---------------------------------------------------------------------------

/** #2 `POST /api/battle/quick-match` and #3 `POST /api/battle/school-battle`. */
export function startBattle(
  mode: 'quick-match' | 'school-battle',
  body: BattleStartBody,
  options: Signal = {},
): Promise<RawResponse<BattleStartResponse>> {
  return api.raw<BattleStartResponse>(
    'POST',
    `/api/battle/${mode}`,
    battleWireBody(body),
    withSignal(options),
  )
}

/**
 * The start / invite body as the active transport expects it: `subject_id`, `pksk_domain_id` and
 * `receiver_id` are string ids in http mode (`BattleStartRequestSchema`, `BattleInviteRequestSchema`;
 * a number is 422 `{}`). Absent fields stay absent.
 */
function battleWireBody(
  body: BattleStartBody & { receiver_id?: number | string },
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...body }
  for (const key of ['subject_id', 'pksk_domain_id', 'receiver_id'] as const) {
    if (key in out) out[key] = wireIdOpt(body[key])
  }
  return out
}

/** #4 `GET /api/battle/poll-match/{queueId}` (every 3 s). */
export function pollMatch(
  queueId: BattleQueueId,
  options: Signal = {},
): Promise<RawResponse<PollMatchResponse>> {
  return api.raw<PollMatchResponse>(
    'GET',
    `/api/battle/poll-match/${encodeURIComponent(String(queueId))}`,
    undefined,
    withSignal(options),
  )
}

/** #5 `POST /api/battle/accept-challenger/{queueId}`. */
export function acceptChallenger(
  queueId: BattleQueueId,
  options: Signal = {},
): Promise<RawResponse<{ matched?: boolean; battle_uuid?: string; error?: string }>> {
  return api.raw(
    'POST',
    `/api/battle/accept-challenger/${encodeURIComponent(String(queueId))}`,
    undefined,
    withSignal(options),
  )
}

/** #6 `POST /api/battle/reject-challenger/{queueId}`. */
export function rejectChallenger(
  queueId: BattleQueueId,
  options: Signal = {},
): Promise<RawResponse<{ success?: boolean; error?: string }>> {
  return api.raw(
    'POST',
    `/api/battle/reject-challenger/${encodeURIComponent(String(queueId))}`,
    undefined,
    withSignal(options),
  )
}

/** #7 `GET /api/battle/search-opponent?q=` (from 2 characters). */
export function searchOpponent(
  q: string,
  options: Signal = {},
): Promise<RawResponse<{ users: OpponentSearchUser[] }>> {
  return api.raw('GET', '/api/battle/search-opponent', undefined, {
    query: { q },
    ...withSignal(options),
  })
}

/** #8 `POST /api/battle/invite`. */
export function sendInvite(
  body: BattleInviteBody,
): Promise<RawResponse<{ success?: boolean; error?: string }>> {
  return api.raw('POST', '/api/battle/invite', battleWireBody(body))
}

/** #9 `GET /api/battle/invitations`. */
export function fetchInvitations(): Promise<RawResponse<{ invitations: BattleInvitation[] }>> {
  return api.raw('GET', '/api/battle/invitations')
}

/** #10 `POST /api/battle/invite/{uuid}/accept`. */
export function acceptInvitation(
  uuid: string,
): Promise<RawResponse<{ success?: boolean; battle_uuid?: string; error?: string }>> {
  return api.raw('POST', `/api/battle/invite/${uuid}/accept`)
}

/** #11 `POST /api/battle/invite/{uuid}/decline`. */
export function declineInvitation(
  uuid: string,
): Promise<RawResponse<{ success?: boolean; error?: string }>> {
  return api.raw('POST', `/api/battle/invite/${uuid}/decline`)
}

/** #12 `POST /api/battle/join-queue/{queueId}` (no UI caller on live, DV-M16-06). */
export function joinQueue(
  queueId: BattleQueueId,
  options: Signal = {},
): Promise<RawResponse<{ success?: boolean; error?: string }>> {
  return api.raw(
    'POST',
    `/api/battle/join-queue/${encodeURIComponent(String(queueId))}`,
    undefined,
    withSignal(options),
  )
}

/** #13 `GET /api/battle/poll-challenger/{queueId}` (every 3 s). */
export function pollChallenger(
  queueId: BattleQueueId,
  options: Signal = {},
): Promise<RawResponse<PollChallengerResponse>> {
  return api.raw(
    'GET',
    `/api/battle/poll-challenger/${encodeURIComponent(String(queueId))}`,
    undefined,
    withSignal(options),
  )
}

/** #14 `POST /api/battle/forfeit/{uuid}` (the page reloads after any response). */
export function forfeitBattle(
  uuid: string,
): Promise<RawResponse<{ success?: boolean; error?: string }>> {
  return api.raw('POST', `/api/battle/forfeit/${uuid}`)
}

// --- battle (envelope) --------------------------------------------------------------------------------

/** #15 `GET /api/battle/lobby`. */
export function fetchBattleLobby(options: Signal = {}): Promise<BattleLobby> {
  return api.get<BattleLobby>('/api/battle/lobby', withSignal(options))
}

/** #16 `GET /api/battle/arena/{uuid}` (PROVISIONAL; 404 for a battle that is not the viewer's). */
export function fetchArena(uuid: string, options: Signal = {}): Promise<ArenaView> {
  return api.get<ArenaView>(`/api/battle/arena/${uuid}`, withSignal(options))
}

/** #17 `POST /api/battle/arena/{uuid}/answer` (PROVISIONAL). */
export function answerArena(uuid: string, body: ArenaAnswerBody): Promise<ArenaAnswerResult> {
  return api.post<ArenaAnswerResult>(`/api/battle/arena/${uuid}/answer`, { body })
}

/** #18 `GET /api/battle/standings/students` (`weekly` default or `monthly`). */
export function fetchStudentStandings(
  period: 'weekly' | 'monthly' = 'weekly',
  options: Signal = {},
): Promise<StudentStanding[]> {
  return api.get<StudentStanding[]>('/api/battle/standings/students', {
    query: { period },
    ...withSignal(options),
  })
}

/** #19 `GET /api/battle/standings/schools`. */
export function fetchSchoolStandings(
  /** `period`: `weekly` (default), `monthly`, `all_time`; any other value is all time (no active pill). */
  query: { period?: string; state?: string } = {},
  options: Signal = {},
): Promise<SchoolStandingsResult> {
  return api.get<SchoolStandingsResult>('/api/battle/standings/schools', {
    query: { ...query },
    ...withSignal(options),
  })
}

/** #20 `GET /api/battle/schools/{id}` (404 for an unknown school). */
export function fetchSchoolDetail(id: number, options: Signal = {}): Promise<SchoolDetail> {
  return api.get<SchoolDetail>(`/api/battle/schools/${String(id)}`, withSignal(options))
}

/** #21 `GET /api/battle/history`. */
export function fetchBattleHistory(options: Signal = {}): Promise<BattleListRow[]> {
  return api.get<BattleListRow[]>('/api/battle/history', withSignal(options))
}

// --- tournaments -----------------------------------------------------------------------------------------

/** #1 `GET /api/tournament/active`: a bare array; any failure is an empty list (§6.13). */
export async function fetchActiveTournaments(options: Signal = {}): Promise<TournamentActive[]> {
  try {
    const res = await api.raw<TournamentActive[]>(
      'GET',
      '/api/tournament/active',
      undefined,
      withSignal(options),
    )
    return res.status >= 200 && res.status < 300 && Array.isArray(res.body) ? res.body : []
  } catch {
    return []
  }
}

/** #42 `GET /api/tournaments`. */
export function fetchTournaments(options: Signal = {}): Promise<TournamentListItem[]> {
  return api.get<TournamentListItem[]>('/api/tournaments', withSignal(options))
}

/** #43 `GET /api/tournaments/form-options` (admin). */
export function fetchTournamentFormOptions(options: Signal = {}): Promise<TournamentFormOptions> {
  return api.get<TournamentFormOptions>('/api/tournaments/form-options', withSignal(options))
}

/** #44 `POST /api/tournaments` (admin; 422 with `fields`). */
export function createTournament(body: TournamentBody): Promise<{ uuid: string; status: string }> {
  return api.post<{ uuid: string; status: string }>('/api/tournaments', { body })
}

/** #45 `GET /api/tournaments/{uuid}` (PROVISIONAL; 404 for an unknown uuid or a draft of another user). */
export function fetchTournament(uuid: string, options: Signal = {}): Promise<TournamentDetail> {
  return api.get<TournamentDetail>(`/api/tournaments/${uuid}`, withSignal(options))
}

// --- leagues and Sekolah Bersaing -------------------------------------------------------------------------

/** #46 `GET /api/leagues`. */
export function fetchLeagues(
  options: Signal = {},
): Promise<{ mine: LeagueCard[]; open: LeagueCard[] }> {
  return api.get<{ mine: LeagueCard[]; open: LeagueCard[] }>('/api/leagues', withSignal(options))
}

/** #47 `POST /api/leagues` (422 with `fields`). */
export function createLeague(body: LeagueBody): Promise<{ id: number }> {
  return api.post<{ id: number }>('/api/leagues', { body })
}

/** #48 `POST /api/leagues/join` (422 with the message under `invite_code`). */
export function joinLeague(inviteCode: string): Promise<{ id: number }> {
  return api.post<{ id: number }>('/api/leagues/join', { body: { invite_code: inviteCode } })
}

/** #49 `GET /api/leagues/{id}` (404 for an unknown id). */
export function fetchLeague(id: number, options: Signal = {}): Promise<LeagueDetail> {
  return api.get<LeagueDetail>(`/api/leagues/${String(id)}`, withSignal(options))
}

/** #50 `GET /api/sekolah-bersaing?week=` (any `week`; an invalid value shows the current week). */
export function fetchSekolahBersaing(
  week?: string,
  options: Signal = {},
): Promise<SekolahBersaingResult> {
  return api.get<SekolahBersaingResult>('/api/sekolah-bersaing', {
    ...(week === undefined ? {} : { query: { week } }),
    ...withSignal(options),
  })
}
