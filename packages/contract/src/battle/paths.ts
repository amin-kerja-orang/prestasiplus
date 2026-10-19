import type { OpenAPIRegistry } from '@asteasolutions/zod-to-openapi'

import { z } from '../zod'
import { envelopeOf } from '../common/envelope'
import { ErrorBodySchema } from '../common/error'
import { IdSchema } from '../common/ids'
import { registerRoute } from './rate-limit'
import {
  BattleAcceptChallengerResponseSchema,
  BattleAnswerRequestSchema,
  BattleAnswerResultSchema,
  BattleArenaOptionSchema,
  BattleArenaQuestionSchema,
  BattleArenaResultSchema,
  BattleArenaViewSchema,
  BattleChallengerSchema,
  BattleEmptyBodySchema,
  BattleInvitationSchema,
  BattleInvitationsResponseSchema,
  BattleInviteAcceptResponseSchema,
  BattleInviteRequestSchema,
  BattleListRowSchema,
  BattleLobbyPkskDomainSchema,
  BattleLobbySchema,
  BattleLobbySpmSubjectSchema,
  BattleLobbySubjectSchema,
  BattleOpponentSchema,
  BattlePkskLevelSchema,
  BattlePodiumEntrySchema,
  BattlePollChallengerResponseSchema,
  BattlePollMatchResponseSchema,
  BattleQuestionTypeSchema,
  BattleRawErrorSchema,
  BattleSchoolDetailSchema,
  BattleSchoolStandingSchema,
  BattleSchoolStandingsQuerySchema,
  BattleSchoolStandingsResultSchema,
  BattleSearchQuerySchema,
  BattleSearchResponseSchema,
  BattleStandingBoxSchema,
  BattleStandingPeriodSchema,
  BattleStartRequestSchema,
  BattleStartResponseSchema,
  BattleStatusSchema,
  BattleStudentStandingSchema,
  BattleStudentStandingsQuerySchema,
  BattleSuccessSchema,
  BattleTournamentActiveSchema,
  BattleTournamentCreateRequestSchema,
  BattleTournamentCreatedSchema,
  BattleTournamentDetailSchema,
  BattleTournamentFormOptionsSchema,
  BattleTournamentListItemSchema,
  BattleTournamentStatusSchema,
  BattleWinnerSchema,
} from './schema'

/** Components contributed by BE-44 (appended to COMPONENT_SCHEMAS in openapi.ts). */
export const BATTLE_COMPONENT_SCHEMAS = {
  BattleQuestionType: BattleQuestionTypeSchema,
  BattlePkskLevel: BattlePkskLevelSchema,
  BattleStatus: BattleStatusSchema,
  BattleWinner: BattleWinnerSchema,
  BattleStandingPeriod: BattleStandingPeriodSchema,
  BattleTournamentStatus: BattleTournamentStatusSchema,
  BattleEmptyBody: BattleEmptyBodySchema,
  BattleRawError: BattleRawErrorSchema,
  BattleSuccess: BattleSuccessSchema,
  BattleStartRequest: BattleStartRequestSchema,
  BattleStartResponse: BattleStartResponseSchema,
  BattleChallenger: BattleChallengerSchema,
  BattlePollMatchResponse: BattlePollMatchResponseSchema,
  BattleAcceptChallengerResponse: BattleAcceptChallengerResponseSchema,
  BattlePollChallengerResponse: BattlePollChallengerResponseSchema,
  BattleSearchQuery: BattleSearchQuerySchema,
  BattleOpponent: BattleOpponentSchema,
  BattleSearchResponse: BattleSearchResponseSchema,
  BattleInviteRequest: BattleInviteRequestSchema,
  BattleInvitation: BattleInvitationSchema,
  BattleInvitationsResponse: BattleInvitationsResponseSchema,
  BattleInviteAcceptResponse: BattleInviteAcceptResponseSchema,
  BattleLobbySubject: BattleLobbySubjectSchema,
  BattleLobbyPkskDomain: BattleLobbyPkskDomainSchema,
  BattleLobbySpmSubject: BattleLobbySpmSubjectSchema,
  BattleLobby: BattleLobbySchema,
  BattleArenaOption: BattleArenaOptionSchema,
  BattleArenaQuestion: BattleArenaQuestionSchema,
  BattleArenaResult: BattleArenaResultSchema,
  BattleArenaView: BattleArenaViewSchema,
  BattleAnswerRequest: BattleAnswerRequestSchema,
  BattleAnswerResult: BattleAnswerResultSchema,
  BattleStudentStandingsQuery: BattleStudentStandingsQuerySchema,
  BattleSchoolStandingsQuery: BattleSchoolStandingsQuerySchema,
  BattleStudentStanding: BattleStudentStandingSchema,
  BattleSchoolStanding: BattleSchoolStandingSchema,
  BattlePodiumEntry: BattlePodiumEntrySchema,
  BattleSchoolStandingsResult: BattleSchoolStandingsResultSchema,
  BattleListRow: BattleListRowSchema,
  BattleStandingBox: BattleStandingBoxSchema,
  BattleSchoolDetail: BattleSchoolDetailSchema,
  BattleTournamentActive: BattleTournamentActiveSchema,
  BattleTournamentListItem: BattleTournamentListItemSchema,
  BattleTournamentFormOptions: BattleTournamentFormOptionsSchema,
  BattleTournamentCreateRequest: BattleTournamentCreateRequestSchema,
  BattleTournamentCreated: BattleTournamentCreatedSchema,
  BattleTournamentDetail: BattleTournamentDetailSchema,
} as const

/** Tags of the three groups; tests count operations by them. */
export const BATTLE_TAGS = {
  battle: 'battle',
  standings: 'battle-standings',
  tournaments: 'battle-tournaments',
} as const

const json = (schema: z.ZodType, description: string) => ({
  description,
  content: { 'application/json': { schema } },
})
const err = (description: string) => json(ErrorBodySchema, description)
const raw = (description: string) => json(BattleRawErrorSchema, description)
const body = (schema: z.ZodType) => ({ required: true, content: { 'application/json': { schema } } })

const csrf = z.object({
  'X-CSRF-Token': z.string().min(1).meta({ description: 'Value of Session.csrf; required on every mutating request.' }),
})
const queueParams = z.object({ queueId: IdSchema.meta({ description: 'Queue id (decimal string).' }) })
const uuidParams = z.object({ uuid: IdSchema })

const UNAUTHORIZED = err('UNAUTHORIZED "Unauthenticated." (no valid session).')
const CSRF_INVALID = err('CSRF_INVALID (missing or wrong X-CSRF-Token).')
/** 403 of M16-02 and M16-03: an empty body `{}` (SPM below grade 10), or the CSRF error body. */
const FORBIDDEN_EMPTY = json(
  z.union([BattleEmptyBodySchema, ErrorBodySchema]),
  'Empty body `{}` (SPM requested below Tingkatan 4; the text is not sent), or CSRF_INVALID (ErrorBody).',
)
const ADMIN_ONLY = err('FORBIDDEN "This action is unauthorized." (role is not admin).')

const SEARCH_NOTE =
  'D54(d): classmates and opponents are shown by display name (and school) only; no IC, e-mail, phone or birth date is ever returned. D57: this is a student-facing lookup, not the staff-only GET /students/search; it is rate-limited (429 RATE_LIMITED with retryAfter and Retry-After) because it can be used to enumerate students, and it never exposes more than the display fields above.'

/**
 * Registers the 25 M16 battle, standings and tournament routes of BE-44. Raw routes (M16-01 to
 * M16-14) answer un-enveloped bodies; the others `{ data }`. Games hub, rooms, Papan Bijak, leagues
 * and Sekolah Bersaing belong to BE-45 and are not registered here.
 *
 * D57: every write route (11 POSTs) and the student name lookup (GET /battle/search-opponent) also answer
 * 429 RATE_LIMITED with retryAfter and a Retry-After header (added by `registerRoute`). D57(b): no
 * response carries a credential or token, so none sends Cache-Control: no-store. D57(e): no route
 * assigns roles; POST /tournaments is admin only.
 */
export function registerBattlePaths(registry: OpenAPIRegistry): void {
  // -------------------------------------------------------------------------------------------
  // Queue and matchmaking (7, raw)
  // -------------------------------------------------------------------------------------------

  const startDescription = (mode: string) =>
    [
      `Joins the ${mode} queue and returns the queue id. Response is raw (un-enveloped, live-shaped).`,
      'The server first checks that 10 eligible keyless questions can be drawn; otherwise 422 with an empty body `{}`.',
      '422 `{}` also covers an invalid question_type, subject, PKSK domain or level; 403 `{}` is an SPM request from a caller below Tingkatan 4. The BM texts (see BATTLE_MESSAGES) are NOT sent on these two routes (BR-M16-03).',
      'Opponents are deterministic bots chosen by the server (D53(a)); real-time multiplayer is not part of this contract.',
    ].join('\n')

  registerRoute(registry, {
    method: 'post',
    path: '/battle/quick-match',
    tags: [BATTLE_TAGS.battle],
    summary: 'Join the quick-match queue (M16-02)',
    description: startDescription('quick-match'),
    request: { headers: [csrf], body: body(BattleStartRequestSchema) },
    responses: {
      200: json(BattleStartResponseSchema, 'A waiting queue owned by the caller.'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_EMPTY,
      422: json(BattleEmptyBodySchema, 'Empty body `{}`.'),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/battle/school-battle',
    tags: [BATTLE_TAGS.battle],
    summary: 'Join the school-battle queue (M16-03)',
    description: `${startDescription('school-battle')}\nSame body and answers as M16-02; the bot opponent must be from another school (widened when nobody fits).`,
    request: { headers: [csrf], body: body(BattleStartRequestSchema) },
    responses: {
      200: json(BattleStartResponseSchema, 'A waiting queue owned by the caller (mode school_battle).'),
      401: UNAUTHORIZED,
      403: FORBIDDEN_EMPTY,
      422: json(BattleEmptyBodySchema, 'Empty body `{}`.'),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/battle/poll-match/{queueId}',
    tags: [BATTLE_TAGS.battle],
    summary: 'Poll a queue (M16-04)',
    description: [
      'Polled every 3 s by the owner. Only the owner sees the queue; anyone else gets `{status:"not_found"}` with HTTP 200.',
      'The first two polls answer `waiting`, the third matches a bot and answers `matched` with the battle uuid; later polls repeat that answer. A queue older than 120 s, or not polled for more than 10 s, answers `expired`.',
      'A pending join request turns the queue into `incoming_challenge`, with the challenger name, grade label and school (no id).',
      'The 404 `{error:"Tiada lawan dijumpai."}` answers when no bot can be picked; the 422 `{error:"Soalan tidak mencukupi."}` when the 10 questions cannot be drawn at match time.',
    ].join('\n'),
    request: { params: queueParams },
    responses: {
      200: json(BattlePollMatchResponseSchema, 'Queue state.'),
      401: UNAUTHORIZED,
      404: raw('{error:"Tiada lawan dijumpai."}: nobody can be picked as the opponent.'),
      422: raw('{error:"Soalan tidak mencukupi."}.'),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/battle/accept-challenger/{queueId}',
    tags: [BATTLE_TAGS.battle],
    summary: 'Accept the incoming challenger (M16-05)',
    description:
      'Owner only, queue in `incoming_challenge`. Creates the battle (owner = A) and answers `{matched:true, battle_uuid}`. Two concurrent accepts create exactly one battle. 404 `{error:"Giliran tidak dijumpai."}` for an unknown, foreign or not incoming queue.',
    request: { params: queueParams, headers: [csrf] },
    responses: {
      200: json(BattleAcceptChallengerResponseSchema, 'The battle was created.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: raw('{error:"Giliran tidak dijumpai."}.'),
      422: raw('{error:"Soalan tidak mencukupi."}.'),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/battle/reject-challenger/{queueId}',
    tags: [BATTLE_TAGS.battle],
    summary: 'Reject the incoming challenger (M16-06)',
    description:
      'Owner only. The queue returns to `waiting` with the challenger cleared and the wait counter reset. Answers `{success:true}` also when the queue is not in `incoming_challenge` (no-op). 404 `{error:"Giliran tidak dijumpai."}` for an unknown or foreign queue.',
    request: { params: queueParams, headers: [csrf] },
    responses: {
      200: json(BattleSuccessSchema, 'Done (or nothing to reject).'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: raw('{error:"Giliran tidak dijumpai."}.'),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/battle/join-queue/{queueId}',
    tags: [BATTLE_TAGS.battle],
    summary: 'Ask to join someone else\'s waiting queue (M16-12)',
    description:
      'Not the owner; the queue is `waiting` or `incoming_challenge` and has no pending join. Otherwise 404 `{error:"Ralat menghantar permohonan."}` (unknown queue, own queue, queue not open, or a join already pending). The owner\'s next poll shows the joiner as the incoming challenger.',
    request: { params: queueParams, headers: [csrf] },
    responses: {
      200: json(BattleSuccessSchema, 'The join request was stored.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: raw('{error:"Ralat menghantar permohonan."}.'),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/battle/poll-challenger/{queueId}',
    tags: [BATTLE_TAGS.battle],
    summary: 'Poll the owner\'s decision as the joiner (M16-13)',
    description:
      'Only the joiner of that queue; anyone else gets `{status:"not_found"}` with HTTP 200 (never an HTTP error). When the owner accepted and no battle exists yet, the battle is created exactly once (owner = A, joiner = B).',
    request: { params: queueParams },
    responses: {
      200: json(BattlePollChallengerResponseSchema, 'Decision state; `battle_uuid` only with `matched`.'),
      401: UNAUTHORIZED,
    },
  })

  // -------------------------------------------------------------------------------------------
  // Invitations (5, raw)
  // -------------------------------------------------------------------------------------------

  registerRoute(
    registry,
    {
      method: 'get',
      path: '/battle/search-opponent',
      tags: [BATTLE_TAGS.battle],
      summary: 'Search students by name to invite (M16-07)',
      description: [
        'Query `q` shorter than 2 trimmed characters answers `{users: []}`. Otherwise students whose name contains `q` (case-insensitive), the caller excluded, sorted by name then id, at most 10.',
        SEARCH_NOTE,
      ].join('\n'),
      request: { query: BattleSearchQuerySchema },
      responses: { 200: json(BattleSearchResponseSchema, 'Matching students.'), 401: UNAUTHORIZED },
    },
    true, // D57(a): a people lookup, so it is rate-limited like a write
  )

  registerRoute(registry, {
    method: 'post',
    path: '/battle/invite',
    tags: [BATTLE_TAGS.battle],
    summary: 'Invite a student to a battle (M16-08)',
    description: [
      'Body is the M16-02 body plus `receiver_id`. A `pending` invitation valid for 24 h is stored.',
      '422 `{error}`: "Penerima tidak sah." (receiver is not an existing student, or is the sender), "Soalan tidak mencukupi.", "Jenis soalan tidak sah.", "Subjek tidak sah.", "Domain PKSK tidak sah.", "Tahap PKSK tidak sah.".',
      '403 `{error:"Khas untuk pelajar Tingkatan 4 & 5 sahaja."}` for an SPM invite from a caller below Tingkatan 4 (here the text IS sent).',
    ].join('\n'),
    request: { headers: [csrf], body: body(BattleInviteRequestSchema) },
    responses: {
      200: json(BattleSuccessSchema, 'Invitation stored.'),
      401: UNAUTHORIZED,
      403: json(
        z.union([BattleRawErrorSchema, ErrorBodySchema]),
        '`{error:"Khas untuk pelajar Tingkatan 4 & 5 sahaja."}`, or CSRF_INVALID (ErrorBody).',
      ),
      422: raw('{error:"<BM text>"} with one of the messages above.'),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/battle/invitations',
    tags: [BATTLE_TAGS.battle],
    summary: 'Own pending invitations (M16-09)',
    description: `The caller's \`pending\` invitations younger than 24 h, newest first. ${SEARCH_NOTE}`,
    responses: { 200: json(BattleInvitationsResponseSchema, 'Pending invitations.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/battle/invite/{uuid}/accept',
    tags: [BATTLE_TAGS.battle],
    summary: 'Accept an invitation (M16-10)',
    description:
      'Receiver only, pending, within 24 h; otherwise 404 `{error:"Cabaran tidak dijumpai."}`. Creates an `active` battle (sender = A, receiver = B, mode challenge).',
    request: { params: uuidParams, headers: [csrf] },
    responses: {
      200: json(BattleInviteAcceptResponseSchema, 'The battle was created.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: raw('{error:"Cabaran tidak dijumpai."}.'),
      422: raw('{error:"Soalan tidak mencukupi."}.'),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/battle/invite/{uuid}/decline',
    tags: [BATTLE_TAGS.battle],
    summary: 'Decline an invitation (M16-11)',
    description: 'Receiver only, pending; otherwise 404 `{error:"Cabaran tidak dijumpai."}`.',
    request: { params: uuidParams, headers: [csrf] },
    responses: {
      200: json(BattleSuccessSchema, 'Declined.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: raw('{error:"Cabaran tidak dijumpai."}.'),
    },
  })

  // -------------------------------------------------------------------------------------------
  // Battle (4)
  // -------------------------------------------------------------------------------------------

  registerRoute(registry, {
    method: 'post',
    path: '/battle/forfeit/{uuid}',
    tags: [BATTLE_TAGS.battle],
    summary: 'Forfeit an active battle (M16-14)',
    description:
      'A player of the battle only (raw route). Sets `forfeited`, the opponent wins. 404 `{error:"Battle tidak dijumpai."}` for an unknown or foreign battle; 409 `{error:"Battle sudah tamat."}` when it is not active.',
    request: { params: uuidParams, headers: [csrf] },
    responses: {
      200: json(BattleSuccessSchema, 'Forfeited.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: raw('{error:"Battle tidak dijumpai."}.'),
      409: raw('{error:"Battle sudah tamat."}.'),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/battle/lobby',
    tags: [BATTLE_TAGS.battle],
    summary: 'Battle lobby data (M16-15)',
    description:
      'Grade label: "Darjah n" for grades 1 to 6, "Tingkatan n" for 7 to 11, "" otherwise. `spmUnlocked` when grade is 10 or more; `spmSubjects` is present only then, with the subjects that have a non-empty SPM pool.',
    responses: { 200: json(envelopeOf(BattleLobbySchema), 'Lobby data.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/battle/arena/{uuid}',
    tags: [BATTLE_TAGS.battle],
    summary: 'Arena state of a battle (M16-16)',
    description:
      'Players of the battle only; anyone else gets 404 NOT_FOUND (never 403). The question carries id, text and options only: no answer key is ever sent before the player has answered.',
    request: { params: uuidParams },
    responses: {
      200: json(envelopeOf(BattleArenaViewSchema), 'Arena state.'),
      401: UNAUTHORIZED,
      404: err('NOT_FOUND "Battle tidak dijumpai.".'),
    },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/battle/arena/{uuid}/answer',
    tags: [BATTLE_TAGS.battle],
    summary: 'Answer the next arena question (M16-17)',
    description: [
      '`questionId` must equal the caller\'s next question. A correct answer scores `1000 - round(500 * s / 15)` with `s = floor(seconds)` clamped to 0..15; wrong or timeout scores 0.',
      'The simulated opponent\'s answer for the same question is returned in `opponent` (D53(a)). After question 10 the battle is `finished`: higher total wins, equal and non-zero is a draw (null), 0-0 is player B.',
      '404 "Battle tidak dijumpai." / "Soalan tidak dijumpai."; 409 CONFLICT "Battle sudah tamat."; 422 VALIDATION_ERROR "Soalan tidak sah." (fields.questionId), "Jawapan tidak sah." (fields.optionId), "Masa tidak sah." (fields.seconds).',
    ].join('\n'),
    request: { params: uuidParams, headers: [csrf], body: body(BattleAnswerRequestSchema) },
    responses: {
      200: json(envelopeOf(BattleAnswerResultSchema), 'Result of the answer; `next` (keyless) or, after question 10, `result`.'),
      401: UNAUTHORIZED,
      403: CSRF_INVALID,
      404: err('NOT_FOUND "Battle tidak dijumpai." or "Soalan tidak dijumpai.".'),
      409: err('CONFLICT "Battle sudah tamat.".'),
      422: err('VALIDATION_ERROR with fields.questionId, fields.optionId or fields.seconds.'),
    },
  })

  // -------------------------------------------------------------------------------------------
  // Standings and history (4)
  // -------------------------------------------------------------------------------------------

  registerRoute(registry, {
    method: 'get',
    path: '/battle/standings/students',
    tags: [BATTLE_TAGS.standings],
    summary: 'Student ranking (M16-18)',
    description: [
      'National, not paginated. Only finished and forfeited battles count; windows are weekly (from Monday) or monthly in Asia/Kuala_Lumpur. `skor` is the sum of round(score / 100) per side; `ketepatan` is round(correct / answered * 100); `streak` is consecutive wins from the newest battle. Order: skor desc, menang desc, user id. The internal school id is not in the body.',
      SEARCH_NOTE,
    ].join('\n'),
    request: { query: BattleStudentStandingsQuerySchema },
    responses: { 200: json(envelopeOf(z.array(BattleStudentStandingSchema)), 'Ranked students.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/battle/standings/schools',
    tags: [BATTLE_TAGS.standings],
    summary: 'School ranking (M16-19)',
    description:
      'Also feeds Portal Pentadbiran PG-12. `period` absent is weekly; any other unknown value is all time with `activePeriod: null`. `state` filters `rows` only; `podium` is the top 3 of the national list and "#" stays the national position. Figures are computed from battle rows.',
    request: { query: BattleSchoolStandingsQuerySchema },
    responses: { 200: json(envelopeOf(BattleSchoolStandingsResultSchema), 'Ranked schools and podium.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/battle/schools/{id}',
    tags: [BATTLE_TAGS.standings],
    summary: 'School battle page (M16-20)',
    description: `\`fighters\` are the top 5 weekly students of the school; \`recent\` the 10 latest finished battles. ${SEARCH_NOTE}`,
    request: { params: z.object({ id: IdSchema.meta({ description: 'School id.' }) }) },
    responses: {
      200: json(envelopeOf(BattleSchoolDetailSchema), 'School page.'),
      401: UNAUTHORIZED,
      404: err('NOT_FOUND "Sekolah tidak dijumpai.".'),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/battle/history',
    tags: [BATTLE_TAGS.standings],
    summary: 'Own battle history (M16-21)',
    description: 'The caller\'s finished and forfeited battles, newest first, not paginated.',
    responses: { 200: json(envelopeOf(z.array(BattleListRowSchema)), 'Own battles.'), 401: UNAUTHORIZED },
  })

  // -------------------------------------------------------------------------------------------
  // Tournaments (5)
  // -------------------------------------------------------------------------------------------

  registerRoute(registry, {
    method: 'get',
    path: '/tournament/active',
    tags: [BATTLE_TAGS.tournaments],
    summary: 'Active tournaments banner (M16-01)',
    description:
      'A bare JSON array (no `{data}`). Stored status `registration` or `ongoing`; a `registration` tournament whose close date has passed is returned as `ongoing` (derived on read). Order: registration_opens_at (null last), then creation time. Drafts and completed are excluded. `live_match` is `null` (nothing sets it). The client treats any failure as an empty list.',
    responses: { 200: json(z.array(BattleTournamentActiveSchema), 'Active tournaments.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/tournaments',
    tags: [BATTLE_TAGS.tournaments],
    summary: 'Active tournaments list (M16-42)',
    description: 'Same selection and order as M16-01 with uuid, title and status only.',
    responses: { 200: json(envelopeOf(z.array(BattleTournamentListItemSchema)), 'Active tournaments.'), 401: UNAUTHORIZED },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/tournaments/form-options',
    tags: [BATTLE_TAGS.tournaments],
    summary: 'Tournament form options (M16-43, admin)',
    description:
      'Education levels (tingkatan4 "Tingkatan 4", tingkatan5 "Tingkatan 5", spm "SPM (Tingkatan 4 & 5)"), active battle subjects sorted by name, `examPapers` always empty, `spmCounts` by subject code.',
    responses: { 200: json(envelopeOf(BattleTournamentFormOptionsSchema), 'Form options.'), 401: UNAUTHORIZED, 403: ADMIN_ONLY },
  })

  registerRoute(registry, {
    method: 'post',
    path: '/tournaments',
    tags: [BATTLE_TAGS.tournaments],
    summary: 'Create a tournament (M16-44, admin)',
    description: [
      'Creates a `draft` (action `draft`) or `registration` (action `open_registration`) tournament. No scheduling, matches, notifications or scoring exist.',
      '422 VALIDATION_ERROR collects every failing field in `fields`; the top-level message is the first field message. Messages: title "Tajuk tournament diperlukan.", education_level_id "Sila pilih tahap pendidikan.", format "Format tidak sah.", groups_count "Bilangan kumpulan mesti antara 2 dan 8." (required for league and hybrid), question_mode / subject_id / exam_paper_id / mixed_subject_ids "Sila pilih sumber soalan." (exam_paper is always refused), total_questions 5..100, time_window_minutes 10..180, top_n_scoring 1..50, min_participants 1..100 "Nilai di luar julat.", dates "Tarikh tidak sah.", registration_closes_at "Tarikh tutup mesti selepas tarikh buka.", action "Tindakan tidak sah.".',
    ].join('\n'),
    request: { headers: [csrf], body: body(BattleTournamentCreateRequestSchema) },
    responses: {
      201: json(envelopeOf(BattleTournamentCreatedSchema), 'Created.'),
      401: UNAUTHORIZED,
      403: err('FORBIDDEN "This action is unauthorized." (role is not admin), or CSRF_INVALID.'),
      422: err('VALIDATION_ERROR with fields.'),
    },
  })

  registerRoute(registry, {
    method: 'get',
    path: '/tournaments/{uuid}',
    tags: [BATTLE_TAGS.tournaments],
    summary: 'Tournament detail (M16-45)',
    description:
      'Drafts are visible to `admin` only; everyone else gets 404 NOT_FOUND "Tournament tidak dijumpai.", as for an unknown uuid. `liveMatch` here is camelCase (M16-01 is snake_case) and always null today.',
    request: { params: uuidParams },
    responses: {
      200: json(envelopeOf(BattleTournamentDetailSchema), 'Tournament.'),
      401: UNAUTHORIZED,
      404: err('NOT_FOUND "Tournament tidak dijumpai.".'),
    },
  })
}
