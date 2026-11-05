import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { TimestampSchema } from '../common/time'
import { GamesRewardSchema } from '../games/common'
import { PkskAccessSchema } from '../pksk/student'

/**
 * BE-44 (M16 part 1): wire schemas of the battle arena, standings and tournaments.
 *
 * Source of truth: the M16 mock (`src/modules/m16-battle-games/mock/handlers/{battle,standings,tournaments}.ts`,
 * repositories `battles`, `battle-pool`, `battle-standings`, `tournaments`) and the catalogue blocks
 * M16-01 to M16-21 and M16-42 to M16-45. Three response styles exist (catalogue, M16 conventions):
 *   - raw (un-enveloped, live-shaped snake_case): M16-01 to M16-14. Errors of M16-04 to M16-14 are
 *     `{ "error": "<BM text>" }`; M16-02 and M16-03 answer 422 and 403 with an empty body `{}`.
 *   - `{ data }`: M16-15 to M16-21 and M16-42 to M16-45, errors are the standard ErrorBody.
 *   - M16-01 is a bare JSON array.
 *
 * Ids are opaque strings (queue ids, user ids, school ids, subject ids, battle / invitation /
 * tournament uuids). Response objects are strict: the arena never carries an answer key before the
 * player has answered, and the challenger of a queue never carries a user id.
 */

// -------------------------------------------------------------------------------------------
// Constants and BM copy (the mock's text, verbatim)
// -------------------------------------------------------------------------------------------

/** Rules the mock fixes (`mock/data/constants.ts`, `mock/repository/common.ts`). */
export const BATTLE_RULES = {
  arenaQuestions: 10,
  questionSeconds: 15,
  /** The queue matches a bot on the third poll in `waiting` (mock constant MATCH_ON_POLL). */
  matchOnPoll: 3,
  queueExpiresSeconds: 120,
  queueAbandonedSeconds: 10,
  invitationExpiresHours: 24,
  searchMinChars: 2,
  searchMaxResults: 10,
  /** SPM battles need grade 10 or 11 (Tingkatan 4 or 5). */
  spmMinGrade: 10,
  fightersShown: 5,
  recentShown: 10,
  podiumSize: 3,
} as const

export const BATTLE_MESSAGES = {
  typeInvalid: 'Jenis soalan tidak sah.',
  subjectInvalid: 'Subjek tidak sah.',
  pkskDomainInvalid: 'Domain PKSK tidak sah.',
  pkskLevelInvalid: 'Tahap PKSK tidak sah.',
  poolTooSmall: 'Soalan tidak mencukupi.',
  spmOnly: 'Khas untuk pelajar Tingkatan 4 & 5 sahaja.',
  pkskNoAccess: 'Anda belum mempunyai akses PKSK PRO',
  noOpponent: 'Tiada lawan dijumpai.',
  queueNotFound: 'Giliran tidak dijumpai.',
  joinFailed: 'Ralat menghantar permohonan.',
  receiverInvalid: 'Penerima tidak sah.',
  invitationNotFound: 'Cabaran tidak dijumpai.',
  battleNotFound: 'Battle tidak dijumpai.',
  battleOver: 'Battle sudah tamat.',
  questionInvalid: 'Soalan tidak sah.',
  answerInvalid: 'Jawapan tidak sah.',
  timeInvalid: 'Masa tidak sah.',
  questionNotFound: 'Soalan tidak dijumpai.',
  schoolNotFound: 'Sekolah tidak dijumpai.',
  tournamentNotFound: 'Tournament tidak dijumpai.',
  titleRequired: 'Tajuk tournament diperlukan.',
  levelRequired: 'Sila pilih tahap pendidikan.',
  formatInvalid: 'Format tidak sah.',
  groupsRange: 'Bilangan kumpulan mesti antara 2 dan 8.',
  sourceRequired: 'Sila pilih sumber soalan.',
  outOfRange: 'Nilai di luar julat.',
  dateInvalid: 'Tarikh tidak sah.',
  closeBeforeOpen: 'Tarikh tutup mesti selepas tarikh buka.',
  actionInvalid: 'Tindakan tidak sah.',
  dailyLimit: 'Had battle hari ini telah dicapai. Cuba lagi esok.',
  invitationExpired: 'Cabaran tamat tempoh.',
} as const

// -------------------------------------------------------------------------------------------
// Enums
// -------------------------------------------------------------------------------------------

/** 48 GAME-01: the "Bilangan Soalan" chips; a battle has one round per question. */
export const BATTLE_QUESTION_COUNTS = [5, 10, 15, 20] as const
export const BattleQuestionCountSchema = z.literal(BATTLE_QUESTION_COUNTS).meta({ id: 'BattleQuestionCount' })
export type BattleQuestionCount = z.infer<typeof BattleQuestionCountSchema>

export const BATTLE_QUESTION_TYPES = ['biasa', 'pksk', 'spm'] as const
export const BattleQuestionTypeSchema = z.enum(BATTLE_QUESTION_TYPES).meta({ id: 'BattleQuestionType' })
export type BattleQuestionType = z.infer<typeof BattleQuestionTypeSchema>

export const BATTLE_PKSK_LEVELS = ['T1', 'T4'] as const
export const BattlePkskLevelSchema = z.enum(BATTLE_PKSK_LEVELS).meta({ id: 'BattlePkskLevel' })

export const BATTLE_STATUSES = ['active', 'finished', 'forfeited', 'abandoned'] as const
export const BattleStatusSchema = z.enum(BATTLE_STATUSES).meta({ id: 'BattleStatus' })
export type BattleStatus = z.infer<typeof BattleStatusSchema>

/** `A` or `B`; `null` is a draw (seri). */
export const BattleWinnerSchema = z.enum(['A', 'B']).nullable().meta({ id: 'BattleWinner' })

export const BATTLE_STANDING_PERIODS = ['weekly', 'monthly', 'all_time'] as const
export const BattleStandingPeriodSchema = z.enum(BATTLE_STANDING_PERIODS).meta({ id: 'BattleStandingPeriod' })
export type BattleStandingPeriod = z.infer<typeof BattleStandingPeriodSchema>

export const BATTLE_TOURNAMENT_ACTIVE_STATUSES = ['registration', 'ongoing'] as const
export const BATTLE_TOURNAMENT_STATUSES = ['draft', 'registration', 'ongoing', 'completed'] as const
export const BattleTournamentStatusSchema = z.enum(BATTLE_TOURNAMENT_STATUSES).meta({ id: 'BattleTournamentStatus' })

export const BATTLE_TOURNAMENT_LEVELS = ['tingkatan4', 'tingkatan5', 'spm'] as const
export const BATTLE_TOURNAMENT_FORMATS = ['single_match', 'knockout', 'league', 'hybrid'] as const
export const BATTLE_TOURNAMENT_QUESTION_MODES = ['subject', 'exam_paper', 'random_mix'] as const
export const BATTLE_TOURNAMENT_ACTIONS = ['draft', 'open_registration'] as const

// -------------------------------------------------------------------------------------------
// Pure rules (BR-M16-07), shared by the tests and the backend
// -------------------------------------------------------------------------------------------

/** A correct answer after `seconds` scores `1000 - round(500 * s / N)`, `s = floor(seconds)` clamped to 0..N (`battle_question_seconds`). */
export function battleArenaPoints(seconds: number, questionSeconds: number = BATTLE_RULES.questionSeconds): number {
  const s = Math.min(questionSeconds, Math.max(0, Math.floor(seconds)))
  return 1000 - Math.round((500 * s) / questionSeconds)
}

/** Higher total wins; equal totals, 0-0 included, are a draw `null` (48 section 3.4; DV-M16-35 is replaced). */
export function battleWinner(scoreA: number, scoreB: number): 'A' | 'B' | null {
  if (scoreA > scoreB) return 'A'
  if (scoreB > scoreA) return 'B'
  return null
}

// -------------------------------------------------------------------------------------------
// Error bodies of the raw routes
// -------------------------------------------------------------------------------------------

/** M16-02 / M16-03 answer 422 and 403 with an empty body (BR-M16-03: the BM text is not sent). */
export const BattleEmptyBodySchema = z.strictObject({}).meta({ id: 'BattleEmptyBody' })

/** M16-04 to M16-14 raw error body `{ "error": "<BM text>" }` (422, 403, 409 and 404 by cause). */
export const BattleRawErrorSchema = z
  .strictObject({ error: z.string().min(1).meta({ description: 'BM message, see BATTLE_MESSAGES.' }) })
  .meta({ id: 'BattleRawError' })

/** `{ success: true }` of reject, invite, decline, join-queue and forfeit. */
export const BattleSuccessSchema = z.strictObject({ success: z.literal(true) }).meta({ id: 'BattleSuccess' })

// -------------------------------------------------------------------------------------------
// Queue and matchmaking (raw)
// -------------------------------------------------------------------------------------------

const biasaFields = { question_type: z.literal('biasa'), subject_id: IdSchema }
const pkskFields = { question_type: z.literal('pksk'), pksk_domain_id: IdSchema, pksk_target_level: BattlePkskLevelSchema }
const spmFields = { question_type: z.literal('spm'), subject_id: IdSchema }
const openToAll = z
  .boolean()
  .optional()
  .meta({ description: 'Treated as true only when literally true (anything else is false). No effect on an invitation.' })

/**
 * Body of M16-02 and M16-03. `biasa`: `subject_id` is a battle subject. `pksk`: an active domain and
 * `T1|T4`. `spm`: a subject with a non-empty SPM pool; callers below grade 10 get 403 `{}`.
 */
export const BattleStartRequestSchema = z
  .discriminatedUnion('question_type', [
    z.object({ ...biasaFields, open_to_all: openToAll }),
    z.object({ ...pkskFields, open_to_all: openToAll }),
    z.object({ ...spmFields, open_to_all: openToAll }),
  ])
  .meta({ id: 'BattleStartRequest' })
export type BattleStartRequest = z.infer<typeof BattleStartRequestSchema>

/**
 * Query of M16-02, M16-03 and M16-08: the "Bilangan Soalan" chip (48 GAME-01). A query, because a new property in the `oneOf`
 * of the start body is a breaking change for the contract gate. Absent is `battle_questions_default`; anything else is refused like a bad body.
 */
export const BattleMatchQuerySchema = z
  .object({ question_count: z.enum(['5', '10', '15', '20']).optional().meta({ description: 'A pupil is matched only with the same count.' }) })
  .meta({ id: 'BattleMatchQuery' })

/** 200 of M16-02 / M16-03. */
export const BattleStartResponseSchema = z
  .strictObject({ queue_id: IdSchema.meta({ description: 'Decimal string; the wire id of the waiting queue.' }) })
  .meta({ id: 'BattleStartResponse' })

/** The challenger shown to the queue owner: name, grade label and school only (never an id). */
export const BattleChallengerSchema = z
  .strictObject({
    name: z.string(),
    grade_label: z.string().meta({ description: '"Darjah n" 1-6, "Tingkatan n" 7-11, "" otherwise.' }),
    school: z.string(),
  })
  .meta({ id: 'BattleChallenger' })

/**
 * `data` of API-GAME-14, the "Batal" of the queue overlay.
 */
export const BattleQueueCancelledSchema = z.strictObject({ cancelled: z.literal(true) }).meta({ id: 'BattleQueueCancelled' })

/**
 * 200 of M16-04. `waiting` until a human is matched or, after `battle_bot_fallback_seconds` (48 GAME-01), the robot;
 * the queue is `expired` after `battle_queue_seconds` or after more than 10 s without a poll; another user's queue is
 * `not_found` (never an HTTP error).
 */
export const BattlePollMatchResponseSchema = z
  .discriminatedUnion('status', [
    z.strictObject({ status: z.literal('waiting') }),
    z.strictObject({ status: z.literal('expired') }),
    z.strictObject({ status: z.literal('not_found') }),
    z.strictObject({ status: z.literal('incoming_challenge'), challenger: BattleChallengerSchema }),
    z.strictObject({
      status: z.literal('matched'),
      battle_uuid: IdSchema,
      robot: z.boolean().optional().meta({ description: 'True when the opponent is "Robot PrestasiPlus": the overlay says so for 2 s before the arena (48 GAME-01).' }),
    }),
  ])
  .meta({ id: 'BattlePollMatchResponse' })

/** 200 of M16-05 (accept challenger). */
export const BattleAcceptChallengerResponseSchema = z
  .strictObject({ matched: z.literal(true), battle_uuid: IdSchema })
  .meta({ id: 'BattleAcceptChallengerResponse' })

/** 200 of M16-13 (the joiner polls the owner's decision). Never an HTTP error status. */
export const BattlePollChallengerResponseSchema = z
  .discriminatedUnion('status', [
    z.strictObject({ status: z.literal('waiting') }),
    z.strictObject({ status: z.literal('rejected') }),
    z.strictObject({ status: z.literal('expired') }),
    z.strictObject({ status: z.literal('not_found') }),
    z.strictObject({ status: z.literal('matched'), battle_uuid: IdSchema }),
  ])
  .meta({ id: 'BattlePollChallengerResponse' })

// -------------------------------------------------------------------------------------------
// Invitations (raw)
// -------------------------------------------------------------------------------------------

/** Query of M16-07. Fewer than 2 trimmed characters answers `{ users: [] }`. */
export const BattleSearchQuerySchema = z
  .object({ q: z.string().max(100).optional().meta({ description: 'Name fragment, case-insensitive; from 2 trimmed characters. Longer than 100 characters answers `{ users: [] }` (the server does not reject).' }) })
  .meta({ id: 'BattleSearchQuery' })

/** One search hit: display name and school of a student (D54(d): replicate the mock; no other personal field). */
export const BattleOpponentSchema = z
  .strictObject({ id: IdSchema, name: z.string(), school: z.string(), avatar: z.string().nullable() })
  .meta({ id: 'BattleOpponent' })

/** 200 of M16-07: at most 10, sorted by name then id, the caller excluded. */
export const BattleSearchResponseSchema = z
  .strictObject({ users: z.array(BattleOpponentSchema).max(BATTLE_RULES.searchMaxResults) })
  .meta({ id: 'BattleSearchResponse' })

const receiver = { receiver_id: IdSchema.meta({ description: 'An existing student other than the sender.' }) }

/** Body of M16-08: the start body plus `receiver_id`. */
export const BattleInviteRequestSchema = z
  .discriminatedUnion('question_type', [
    z.object({ ...biasaFields, ...receiver, open_to_all: openToAll }),
    z.object({ ...pkskFields, ...receiver, open_to_all: openToAll }),
    z.object({ ...spmFields, ...receiver, open_to_all: openToAll }),
  ])
  .meta({ id: 'BattleInviteRequest' })
export type BattleInviteRequest = z.infer<typeof BattleInviteRequestSchema>

/** 200 of M16-08. `uuid` is the invitation: the sender polls it in `sent` of M16-09, and "Batal" is M16-11 on it. */
export const BattleInviteSentSchema = z.strictObject({ success: z.literal(true), uuid: IdSchema.optional() }).meta({ id: 'BattleInviteSent' })

export const BattleInvitationSchema = z
  .strictObject({ uuid: IdSchema, sender_name: z.string(), sender_school: z.string() })
  .meta({ id: 'BattleInvitation' })

/** One invitation the caller sent, as the "Menunggu Kelulusan..." overlay waits on it: `battle_uuid` once it was accepted. */
export const BattleInvitationSentSchema = z
  .strictObject({ uuid: IdSchema, status: z.enum(['pending', 'accepted', 'declined', 'expired', 'cancelled']), battle_uuid: IdSchema.optional() })
  .meta({ id: 'BattleInvitationSent' })

/** 200 of M16-09: pending invitations younger than `battle_invitation_hours`, newest first; `sent`: the caller's own of that window. */
export const BattleInvitationsResponseSchema = z
  .strictObject({ invitations: z.array(BattleInvitationSchema), sent: z.array(BattleInvitationSentSchema).optional() })
  .meta({ id: 'BattleInvitationsResponse' })

/** 200 of M16-10 (accept invitation). */
export const BattleInviteAcceptResponseSchema = z
  .strictObject({ success: z.literal(true), battle_uuid: IdSchema })
  .meta({ id: 'BattleInviteAcceptResponse' })

// -------------------------------------------------------------------------------------------
// Lobby (env)
// -------------------------------------------------------------------------------------------

export const BattleLobbySubjectSchema = z
  .strictObject({
    id: IdSchema,
    name: z.string(),
    icon: z.string().nullable(),
    colour: z.string(),
    core: z.boolean().meta({ description: 'True for the core subjects.' }),
  })
  .meta({ id: 'BattleLobbySubject' })

export const BattleLobbyPkskDomainSchema = z
  .strictObject({ id: IdSchema, name: z.string(), icon: z.string(), colour: z.string() })
  .meta({ id: 'BattleLobbyPkskDomain' })

export const BattleLobbySpmSubjectSchema = z
  .strictObject({ id: IdSchema, name: z.string() })
  .meta({ id: 'BattleLobbySpmSubject' })

/** A row of "Battle Terkini" (48 GAME-01): the caller's own latest battles, no other pupil's name. */
export const BattleLobbyRecentSchema = z
  .strictObject({ uuid: IdSchema, subject: z.string(), status: BattleStatusSchema, createdAt: TimestampSchema })
  .meta({ id: 'BattleLobbyRecent' })

/** `data` of M16-15. `spmSubjects` is present only when `spmUnlocked` (grade 10 or higher). */
export const BattleLobbySchema = z
  .strictObject({
    grade: z.number().int().nullable(),
    gradeLabel: z.string(),
    spmUnlocked: z.boolean(),
    subjects: z.array(BattleLobbySubjectSchema),
    pkskDomains: z.array(BattleLobbyPkskDomainSchema),
    /** The caller's PKSK grant per level (R1-MUR-19): the PKSK tab shows the no-access state where it is false. */
    pkskAccess: PkskAccessSchema,
    spmSubjects: z.array(BattleLobbySpmSubjectSchema).optional(),
    questionCountDefault: BattleQuestionCountSchema.optional().meta({ description: 'The chip chosen at first: `battle_questions_default`.' }),
    recentBattles: z.array(BattleLobbyRecentSchema).max(BATTLE_RULES.recentShown).optional(),
  })
  .refine((l) => l.spmUnlocked === (l.spmSubjects !== undefined), {
    message: 'spmSubjects is present exactly when spmUnlocked is true',
    path: ['spmSubjects'],
  })
  .meta({ id: 'BattleLobby' })

// -------------------------------------------------------------------------------------------
// Arena (env). No schema in this block carries an answer key before the answer is given.
// -------------------------------------------------------------------------------------------

export const BattleArenaOptionSchema = z
  .strictObject({
    id: z.number().int().min(0).max(3),
    label: z.enum(['A', 'B', 'C', 'D']),
    text: z.string(),
  })
  .meta({ id: 'BattleArenaOption' })

/** A question as the arena serves it: id, text and options only (strict: no key, no explanation). */
export const BattleArenaQuestionSchema = z
  .strictObject({ id: IdSchema, text: z.string(), options: z.array(BattleArenaOptionSchema).min(2).max(4) })
  .meta({ id: 'BattleArenaQuestion' })

const ArenaPlayerSchema = z.strictObject({
  name: z.string(),
  school: z.string(),
  isBot: z.boolean().optional().meta({ description: 'True for the robot opponent ("Robot PrestasiPlus"), shown with the chip "Latihan" (48 GAME-01).' }),
})
const ScoresSchema = z.strictObject({ A: z.number().int().min(0), B: z.number().int().min(0) })

export const BattleArenaResultSchema = z
  .strictObject({
    winner: BattleWinnerSchema,
    scoreA: z.number().int().min(0),
    scoreB: z.number().int().min(0),
    reward: GamesRewardSchema.optional().meta({ description: 'What this battle gave the caller.' }),
  })
  .meta({ id: 'BattleArenaResult' })

/**
 * What both players see when a round has closed, for 3 s (48 GAME-01). The key is here only after the round closed.
 * `endsAt` is the end of those 3 s, which is also when the next round starts.
 */
export const BattleRoundRevealSchema = z
  .strictObject({
    round: z.number().int().min(1).max(20),
    correctOptionId: z.number().int().min(0).max(3),
    you: z.strictObject({ correct: z.boolean(), points: z.number().int().min(0).max(1000) }),
    opponent: z.strictObject({ correct: z.boolean(), points: z.number().int().min(0).max(1000) }),
    totals: ScoresSchema,
    endsAt: TimestampSchema,
  })
  .meta({ id: 'BattleRoundReveal' })

/**
 * `data` of M16-16. While `active`: `question` is the question of the round (of the closed round during `reveal`);
 * otherwise `question` is null, `secondsLeft` is 0 and `result` is present.
 * `total` (always 10), `index` and `secondsLeft` keep their old ranges so the response stays additive: they are capped, and `rounds`,
 * `round` and `roundEndsAt` are the truth for a battle of another length or another `battle_question_seconds`.
 */
export const BattleArenaViewSchema = z
  .strictObject({
    uuid: IdSchema,
    status: BattleStatusSchema,
    you: z.enum(['A', 'B']),
    players: z.strictObject({ A: ArenaPlayerSchema, B: ArenaPlayerSchema }),
    scores: ScoresSchema,
    index: z.number().int().min(1).max(BATTLE_RULES.arenaQuestions),
    total: z.literal(BATTLE_RULES.arenaQuestions),
    question: BattleArenaQuestionSchema.nullable(),
    secondsLeft: z.number().int().min(0).max(BATTLE_RULES.questionSeconds),
    roundEndsAt: TimestampSchema.optional().meta({ description: 'While a round is open: when it times out, grace included (48 section 3.3). Absent during `reveal`.' }),
    result: BattleArenaResultSchema.optional(),
    round: z.number().int().min(1).max(20).optional().meta({ description: 'The current round, 1..`rounds`.' }),
    rounds: BattleQuestionCountSchema.optional().meta({ description: 'The chip this battle was started with.' }),
    totals: ScoresSchema.optional().meta({ description: 'The running totals: the opponent\'s points of an open round are not in them yet.' }),
    phase: z.enum(['answering', 'waiting', 'reveal']).optional().meta({ description: '`answering`: the caller has not answered this round; `waiting`: answered, the round is open; `reveal`: the round closed.' }),
    questionSeconds: z.number().int().min(10).max(60).optional().meta({ description: '`battle_question_seconds`: the display time, before the grace.' }),
    graceSeconds: z.number().int().min(0).max(10).optional().meta({ description: '`battle_grace_seconds`.' }),
    serverNow: TimestampSchema.optional().meta({ description: 'The server clock of this response: the client timer counts to `roundEndsAt` from it, not from the device clock.' }),
    reveal: BattleRoundRevealSchema.optional().meta({ description: 'Present while the 3 s of a closed round run.' }),
  })
  .superRefine((v, ctx) => {
    const active = v.status === 'active'
    if (active && (v.question === null || v.result !== undefined)) {
      ctx.addIssue({ code: 'custom', message: 'an active battle has a question and no result' })
    }
    if (!active && (v.question !== null || v.secondsLeft !== 0 || v.result === undefined)) {
      ctx.addIssue({ code: 'custom', message: 'a battle that is not active has no question, secondsLeft 0 and a result' })
    }
  })
  .meta({ id: 'BattleArenaView' })
export type BattleArenaView = z.infer<typeof BattleArenaViewSchema>

/** Body of M16-17. `questionId` must equal the caller's next question; `optionId` null is a timeout. */
export const BattleAnswerRequestSchema = z
  .object({
    questionId: IdSchema,
    optionId: z.number().int().min(0).max(3).nullable().optional().meta({ description: 'Omitted or null is a timeout.' }),
    seconds: z
      .number()
      .min(0)
      .max(60)
      .meta({ description: 'Seconds used, 0..`battle_question_seconds`; can only make the answer slower than the server clock.' }),
  })
  .meta({ id: 'BattleAnswerRequest' })
export type BattleAnswerRequest = z.infer<typeof BattleAnswerRequestSchema>

/**
 * `data` of M16-17. The key (`correctOptionId`) is sent only here, after the answer is stored; the client shows it at the reveal.
 * The round stays open until both players have answered or timed out (48 GAME-01):
 * - `waiting`: still open. `opponent` then holds the last closed state; its `answered` and `correct` say nothing yet.
 *   (`answered` stays `true` on the wire so the response remains additive.)
 * - `reveal`: this answer closed the round; the next question comes from M16-16 when `reveal.endsAt` has passed.
 * - `result`: the battle ended.
 * `next` is no longer sent by the API: it would show the next question before its round starts.
 */
export const BattleAnswerResultSchema = z
  .strictObject({
    correct: z.boolean(),
    correctOptionId: z.number().int().min(0).max(3),
    points: z.number().int().min(0).max(1000),
    you: z.strictObject({ score: z.number().int().min(0) }),
    opponent: z.strictObject({ answered: z.literal(true), correct: z.boolean(), score: z.number().int().min(0) }),
    next: BattleArenaQuestionSchema.optional(),
    result: BattleArenaResultSchema.optional(),
    waiting: z.literal(true).optional(),
    reveal: BattleRoundRevealSchema.optional(),
  })
  .refine((r) => !(r.next !== undefined && r.result !== undefined), { message: 'next and result never come together', path: ['next'] })
  .refine((r) => (r.waiting === true) !== (r.next !== undefined || r.result !== undefined || r.reveal !== undefined), {
    message: 'an answer either waits for the round or closes it',
    path: ['waiting'],
  })
  .meta({ id: 'BattleAnswerResult' })
export type BattleAnswerResult = z.infer<typeof BattleAnswerResultSchema>

// -------------------------------------------------------------------------------------------
// Standings and history (env)
// -------------------------------------------------------------------------------------------

/** Query of M16-18: `weekly` (default) or `monthly`; any other value is weekly. */
export const BattleStudentStandingsQuerySchema = z
  .object({ period: z.string().optional().meta({ description: 'weekly (default) or monthly; any other value is weekly.' }) })
  .meta({ id: 'BattleStudentStandingsQuery' })

/** Query of M16-19: absent is weekly; weekly, monthly, all_time; any other value is all time with `activePeriod: null`. */
export const BattleSchoolStandingsQuerySchema = z
  .object({
    period: z.string().optional().meta({ description: 'weekly (default), monthly, all_time; any other value is all time.' }),
    state: z.string().optional().meta({ description: 'Exact state name; filters rows only, never the podium.' }),
  })
  .meta({ id: 'BattleSchoolStandingsQuery' })

const nn = z.number().int().min(0)

/** Row of M16-18 (D54(d): display name and school of classmates, no other personal field). */
export const BattleStudentStandingSchema = z
  .strictObject({
    rank: z.number().int().min(1),
    userId: IdSchema.nullable().meta({ description: "Children's names rule (LEAD 2026-10-21, issue #76): null (and a first given name) unless the viewer may see this pupil." }),
    name: z.string(),
    school: z.string(),
    menang: nn,
    seri: nn,
    kalah: nn,
    ketepatan: z.number().int().min(0).max(100),
    streak: nn,
    skor: nn,
  })
  .meta({ id: 'BattleStudentStanding' })

export const BattleSchoolStandingSchema = z
  .strictObject({
    rank: z.number().int().min(1),
    schoolId: IdSchema,
    name: z.string(),
    state: z.string(),
    type: z.string(),
    battles: nn,
    menang: nn,
    seri: nn,
    kalah: nn,
    ketepatan: z.number().int().min(0).max(100),
    pelajar: nn,
    skor: nn,
  })
  .meta({ id: 'BattleSchoolStanding' })

export const BattlePodiumEntrySchema = z
  .strictObject({
    column: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    schoolId: IdSchema,
    name: z.string(),
    state: z.string(),
    skor: nn,
  })
  .meta({ id: 'BattlePodiumEntry' })

/** `data` of M16-19. `podium` is the top 3 of the national list. */
export const BattleSchoolStandingsResultSchema = z
  .strictObject({
    activePeriod: BattleStandingPeriodSchema.nullable(),
    rows: z.array(BattleSchoolStandingSchema),
    podium: z.array(BattlePodiumEntrySchema).max(BATTLE_RULES.podiumSize),
  })
  .meta({ id: 'BattleSchoolStandingsResult' })

/** A finished or forfeited battle in the history list and on the school page. */
export const BattleListRowSchema = z
  .strictObject({
    uuid: IdSchema,
    playerA: z.strictObject({ id: IdSchema.nullable().meta({ description: "Children's names rule (LEAD 2026-10-21, issue #76): null (and a first given name) unless the viewer may see this pupil." }), name: z.string(), homeHere: z.boolean() }),
    scoreA: nn,
    scoreB: nn,
    playerB: z.strictObject({ id: IdSchema.nullable().meta({ description: "Children's names rule (LEAD 2026-10-21, issue #76): null (and a first given name) unless the viewer may see this pupil." }), name: z.string() }),
    winner: BattleWinnerSchema,
    createdAt: TimestampSchema,
  })
  .meta({ id: 'BattleListRow' })

export const BattleStandingBoxSchema = z
  .strictObject({ rank: z.number().int().min(1), battles: nn, menang: nn, seri: nn, kalah: nn, skor: nn })
  .meta({ id: 'BattleStandingBox' })

/** `data` of M16-20. `fighters` are the top 5 weekly students of the school; `recent` the 10 latest finished battles. */
export const BattleSchoolDetailSchema = z
  .strictObject({
    school: z.strictObject({ id: IdSchema, name: z.string(), ppd: z.string().nullable(), state: z.string(), type: z.string() }),
    allTime: z.strictObject({ battles: nn, menang: nn, ketepatan: z.number().int().min(0).max(100), pelajar: nn }),
    week: BattleStandingBoxSchema.nullable(),
    month: BattleStandingBoxSchema.nullable(),
    fighters: z.array(z.strictObject({ userId: IdSchema.nullable().meta({ description: "Children's names rule (LEAD 2026-10-21, issue #76): null (and a first given name) unless the viewer may see this pupil." }), name: z.string(), skor: nn })).max(BATTLE_RULES.fightersShown),
    recent: z.array(BattleListRowSchema).max(BATTLE_RULES.recentShown),
  })
  .meta({ id: 'BattleSchoolDetail' })

// -------------------------------------------------------------------------------------------
// Tournaments
// -------------------------------------------------------------------------------------------

/** One element of the bare array of M16-01. `live_match` is always null today (no route or job sets it). */
export const BattleTournamentActiveSchema = z
  .strictObject({
    uuid: IdSchema,
    title: z.string(),
    status: z.enum(BATTLE_TOURNAMENT_ACTIVE_STATUSES),
    live_match: z.strictObject({ school_a: z.string(), school_b: z.string() }).nullable(),
  })
  .meta({ id: 'BattleTournamentActive' })

/** Element of `data` of M16-42. */
export const BattleTournamentListItemSchema = z
  .strictObject({ uuid: IdSchema, title: z.string(), status: z.enum(BATTLE_TOURNAMENT_ACTIVE_STATUSES) })
  .meta({ id: 'BattleTournamentListItem' })

/** `data` of M16-43 (admin). `examPapers` is always empty (no exam paper exists); `spmCounts` is keyed by subject code. */
export const BattleTournamentFormOptionsSchema = z
  .strictObject({
    educationLevels: z.array(z.strictObject({ id: z.enum(BATTLE_TOURNAMENT_LEVELS), name: z.string() })),
    subjects: z.array(z.strictObject({ id: IdSchema, name: z.string(), code: z.string() })),
    examPapers: z.array(z.strictObject({ id: IdSchema, name: z.string() })),
    spmCounts: z.record(z.string(), nn),
  })
  .meta({ id: 'BattleTournamentFormOptions' })

/** Dates are local `YYYY-MM-DDTHH:mm` text, interpreted in Asia/Kuala_Lumpur; an empty string is no date. */
const LOCAL_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/

/** Epoch-less comparable key of a valid local date-time, or NaN. */
export function battleLocalDateTimeKey(value: string): number {
  const m = LOCAL_DATETIME.exec(value)
  if (!m) return Number.NaN
  const [y, mo, d, h, mi] = m.slice(1).map(Number) as [number, number, number, number, number]
  const days = new Date(Date.UTC(y, mo - 1, d)).getUTCDate()
  if (mo < 1 || mo > 12 || d < 1 || days !== d || h > 23 || mi > 59) return Number.NaN
  return Date.UTC(y, mo - 1, d, h, mi)
}

const LocalDateTimeSchema = z
  .string()
  .refine((v) => v === '' || !Number.isNaN(battleLocalDateTimeKey(v)), { message: BATTLE_MESSAGES.dateInvalid })
  .meta({ description: 'Local YYYY-MM-DDTHH:mm in Asia/Kuala_Lumpur; "" means no date.', example: '2026-11-01T08:00' })

const rangeInt = (lo: number, hi: number) => z.number().int().min(lo).max(hi)

/**
 * Body of M16-44 (admin). Cross-field rules of the mock: `groups_count` is required for `league` and
 * `hybrid`; `subject` mode needs `subject_id`; `random_mix` needs a non-empty `mixed_subject_ids`;
 * `exam_paper` is always refused (no exam paper exists); close date strictly after the open date (table CHECK). The server
 * answers 422 with every failing field in `fields` and the first message at the top level.
 */
export const BattleTournamentCreateRequestSchema = z
  .object({
    title: z.string().trim().min(1).max(255),
    description: z.string().max(5000).optional(),
    education_level_id: z.enum(BATTLE_TOURNAMENT_LEVELS),
    format: z.enum(BATTLE_TOURNAMENT_FORMATS),
    groups_count: rangeInt(2, 8).optional(),
    question_mode: z.enum(BATTLE_TOURNAMENT_QUESTION_MODES),
    subject_id: IdSchema.optional(),
    exam_paper_id: IdSchema.optional(),
    mixed_subject_ids: z.array(IdSchema).optional(),
    total_questions: rangeInt(5, 100),
    time_window_minutes: rangeInt(10, 180),
    top_n_scoring: rangeInt(1, 50),
    min_participants: rangeInt(1, 100),
    registration_opens_at: LocalDateTimeSchema.optional(),
    registration_closes_at: LocalDateTimeSchema.optional(),
    action: z.enum(BATTLE_TOURNAMENT_ACTIONS),
  })
  .superRefine((v, ctx) => {
    const bad = (path: string, message: string) => ctx.addIssue({ code: 'custom', path: [path], message })
    if ((v.format === 'league' || v.format === 'hybrid') && v.groups_count === undefined) {
      bad('groups_count', BATTLE_MESSAGES.groupsRange)
    }
    if (v.question_mode === 'subject' && v.subject_id === undefined) bad('subject_id', BATTLE_MESSAGES.sourceRequired)
    if (v.question_mode === 'exam_paper') bad('exam_paper_id', BATTLE_MESSAGES.sourceRequired)
    if (v.question_mode === 'random_mix' && (v.mixed_subject_ids ?? []).length === 0) {
      bad('mixed_subject_ids', BATTLE_MESSAGES.sourceRequired)
    }
    const opens = v.registration_opens_at ? battleLocalDateTimeKey(v.registration_opens_at) : Number.NaN
    const closes = v.registration_closes_at ? battleLocalDateTimeKey(v.registration_closes_at) : Number.NaN
    if (!Number.isNaN(opens) && !Number.isNaN(closes) && closes <= opens) {
      bad('registration_closes_at', BATTLE_MESSAGES.closeBeforeOpen)
    }
  })
  .meta({ id: 'BattleTournamentCreateRequest' })
export type BattleTournamentCreateRequest = z.infer<typeof BattleTournamentCreateRequestSchema>

/** `data` of the 201 of M16-44. */
export const BattleTournamentCreatedSchema = z
  .strictObject({ uuid: IdSchema, status: z.enum(['draft', 'registration']) })
  .meta({ id: 'BattleTournamentCreated' })

/**
 * `data` of M16-45 (camelCase, unlike M16-01). `status` shows `registration` as `ongoing` once the
 * close date has passed. `examPaperId` is always null; `liveMatch` is always null today.
 */
export const BattleTournamentDetailSchema = z
  .strictObject({
    uuid: IdSchema,
    title: z.string(),
    description: z.string(),
    status: BattleTournamentStatusSchema,
    educationLevelId: z.enum(BATTLE_TOURNAMENT_LEVELS),
    format: z.enum(BATTLE_TOURNAMENT_FORMATS),
    groupsCount: z.number().int().nullable(),
    questionMode: z.enum(BATTLE_TOURNAMENT_QUESTION_MODES),
    subjectId: IdSchema.nullable(),
    examPaperId: z.null(),
    mixedSubjectIds: z.array(IdSchema),
    totalQuestions: z.number().int(),
    timeWindowMinutes: z.number().int(),
    topNScoring: z.number().int(),
    minParticipants: z.number().int(),
    registrationOpensAt: TimestampSchema.nullable(),
    registrationClosesAt: TimestampSchema.nullable(),
    liveMatch: z.strictObject({ schoolA: z.string(), schoolB: z.string() }).nullable(),
    createdAt: TimestampSchema,
  })
  .meta({ id: 'BattleTournamentDetail' })
