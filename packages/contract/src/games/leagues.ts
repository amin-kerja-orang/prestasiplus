import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { DateOnlySchema } from '../common/time'
import { GAMES_MESSAGES, gamesCount } from './common'

/**
 * Leagues (M16-46 to M16-49) and the Sekolah Bersaing weekly board (M16-50). All bodies are `{ data }`.
 *
 * League standings and Sekolah Bersaing rows are stored job output in the mock and are never recomputed
 * (BE-45 Open question 7); league `status` is stored and not moved by dates.
 * D54(d): only the creator's display name and school names are shown (the creator's name follows the children's
 * names rule, issue #76: first name + initial unless the viewer may see it); an `anonymous` Sekolah Bersaing row
 * shows "Sekolah anonim".
 */

export const GAMES_LEAGUE_TYPES = ['friendly', 'tournament', 'league'] as const
export const GAMES_LEAGUE_SCOPES = ['school', 'district', 'state', 'national'] as const
export const GAMES_LEAGUE_GAME_MODES = ['mixed', 'quiz', 'multiplayer'] as const
export const GAMES_LEAGUE_SCORINGS = ['total_score', 'avg_accuracy', 'wins'] as const
export const GAMES_LEAGUE_STATUSES = ['upcoming', 'ongoing', 'ended'] as const
/** Class levels a league can include: Darjah 1..6 (D1..D6) and Tingkatan 1..5 (T1..T5). */
export const GAMES_LEAGUE_CLASS_LEVELS = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'T1', 'T2', 'T3', 'T4', 'T5'] as const

/** BM labels of the mock, by code (the card and detail fields `typeLabel`, `scopeLabel`, `statusLabel`, `scoringLabel`). */
export const GAMES_LEAGUE_LABELS = {
  type: { friendly: 'Persahabatan', tournament: 'Kejohanan', league: 'Liga' },
  scope: { school: 'Sekolah', district: 'Daerah', state: 'Negeri', national: 'Kebangsaan' },
  scoring: { total_score: 'Jumlah Markah', avg_accuracy: 'Purata Ketepatan', wins: 'Bilangan Kemenangan' },
  status: { upcoming: 'Akan Datang', ongoing: 'Sedang Berlangsung', ended: 'Tamat' },
} as const

export const GamesLeagueTypeSchema = z.enum(GAMES_LEAGUE_TYPES).meta({ id: 'GamesLeagueType' })
export const GamesLeagueScopeSchema = z.enum(GAMES_LEAGUE_SCOPES).meta({ id: 'GamesLeagueScope' })
export const GamesLeagueGameModeSchema = z.enum(GAMES_LEAGUE_GAME_MODES).meta({ id: 'GamesLeagueGameMode' })
export const GamesLeagueScoringSchema = z.enum(GAMES_LEAGUE_SCORINGS).meta({ id: 'GamesLeagueScoring' })
export const GamesLeagueStatusSchema = z.enum(GAMES_LEAGUE_STATUSES).meta({ id: 'GamesLeagueStatus' })
export const GamesLeagueClassLevelSchema = z.enum(GAMES_LEAGUE_CLASS_LEVELS).meta({ id: 'GamesLeagueClassLevel' })
export type GamesLeagueStatus = z.infer<typeof GamesLeagueStatusSchema>

// --- cards, list (M16-46) -------------------------------------------------------------------------------------------

const cardFields = {
  id: IdSchema,
  name: z.string().min(1).max(255),
  status: GamesLeagueStatusSchema,
  statusLabel: z.string(),
  scopeLabel: z.string(),
  typeLabel: z.string(),
  subjectName: z.string().nullable(),
  startDate: DateOnlySchema,
  endDate: DateOnlySchema,
}

export const GamesLeagueCardSchema = z
  .strictObject({ ...cardFields, schools: gamesCount.meta({ description: 'Number of participating schools.' }) })
  .meta({ id: 'GamesLeagueCard' })
export type GamesLeagueCard = z.infer<typeof GamesLeagueCardSchema>

/** `mine` = leagues containing the caller's school; `open` = every league that is not `ended`. */
export const GamesLeagueListSchema = z
  .strictObject({ mine: z.array(GamesLeagueCardSchema), open: z.array(GamesLeagueCardSchema) })
  .meta({ id: 'GamesLeagueList' })
export type GamesLeagueList = z.infer<typeof GamesLeagueListSchema>

// --- create (M16-47), join (M16-48) ---------------------------------------------------------------------------------

const required = { error: GAMES_MESSAGES.leagueRequired }

/**
 * Body of `POST /leagues`. 422 top-level message = the first field message. Required fields:
 * "Sila lengkapkan semua medan wajib."; `end_date` before `start_date` "Tarikh tamat mesti selepas
 * tarikh mula."; `max_schools` outside 2..500 "Had sekolah mesti antara 2 dan 500."; unknown
 * `subject_id` "Mata pelajaran tidak sah." (server check); `class_levels` "Tingkatan tidak sah.".
 */
export const GamesLeagueCreateRequestSchema = z
  .object({
    name: z.string(required).trim().min(1, required).max(255, required),
    type: z.enum(GAMES_LEAGUE_TYPES, required),
    scope: z.enum(GAMES_LEAGUE_SCOPES, required),
    subject_id: IdSchema.nullable().optional().meta({ description: 'Existing subject; unknown 422 "Mata pelajaran tidak sah." (subject_id).' }),
    game_mode: z.enum(GAMES_LEAGUE_GAME_MODES, required),
    class_levels: z.array(z.enum(GAMES_LEAGUE_CLASS_LEVELS, { error: GAMES_MESSAGES.leagueClassLevels }), {
      error: GAMES_MESSAGES.leagueClassLevels,
    }).optional(),
    scoring_method: z.enum(GAMES_LEAGUE_SCORINGS, required),
    start_date: z.iso.date(required),
    end_date: z.iso.date(required),
    max_schools: z
      .number({ error: GAMES_MESSAGES.leagueMaxSchools })
      .int({ error: GAMES_MESSAGES.leagueMaxSchools })
      .min(2, { error: GAMES_MESSAGES.leagueMaxSchools })
      .max(500, { error: GAMES_MESSAGES.leagueMaxSchools })
      .nullable()
      .optional(),
  })
  .superRefine((v, ctx) => {
    if (typeof v.start_date === 'string' && typeof v.end_date === 'string' && v.end_date < v.start_date) {
      ctx.addIssue({ code: 'custom', path: ['end_date'], message: GAMES_MESSAGES.leagueEndBeforeStart })
    }
  })
  .meta({ id: 'GamesLeagueCreateRequest' })
export type GamesLeagueCreateRequest = z.infer<typeof GamesLeagueCreateRequestSchema>

/** `{ data: { id } }` of create (201) and join (200). */
export const GamesLeagueIdResultSchema = z.strictObject({ id: IdSchema }).meta({ id: 'GamesLeagueIdResult' })
export type GamesLeagueIdResult = z.infer<typeof GamesLeagueIdResultSchema>

/** `invite_code` is trimmed and upper-cased. Refusals are 422 with `fields.invite_code` (see the route). */
export const GamesLeagueJoinRequestSchema = z
  .object({ invite_code: z.string() })
  .meta({ id: 'GamesLeagueJoinRequest' })
export type GamesLeagueJoinRequest = z.infer<typeof GamesLeagueJoinRequestSchema>

// --- detail (M16-49) ----------------------------------------------------------------------------------------------------

export const GamesLeagueStandingRowSchema = z
  .strictObject({
    rank: z.number().int().min(1),
    schoolId: IdSchema,
    name: z.string().meta({ description: 'School name.' }),
    ppdState: z.string().meta({ description: '"District, State" of the school.' }),
    peserta: gamesCount,
    skor: z.number().min(0),
    purata: z.number().min(0),
  })
  .meta({ id: 'GamesLeagueStandingRow' })
export type GamesLeagueStandingRow = z.infer<typeof GamesLeagueStandingRowSchema>

export const GamesLeagueDetailSchema = z
  .strictObject({
    ...cardFields,
    scoringLabel: z.string(),
    creatorName: z.string().meta({ description: 'Display name of the creator.' }),
    classLevels: z.array(GamesLeagueClassLevelSchema),
    inviteCode: z.string().regex(/^[A-Z0-9]{8}$/).meta({ description: 'Visible to non-members, as live.' }),
    shareUrl: z.string().meta({ description: 'WhatsApp share link (https://wa.me/?text=...).' }),
    canJoin: z.boolean().meta({ description: 'Not ended, the caller school is not in, and not full.' }),
    schools: z.array(z.strictObject({ id: IdSchema, name: z.string() })),
    standings: z
      .partialRecord(GamesLeagueClassLevelSchema, z.array(GamesLeagueStandingRowSchema))
      .meta({ description: 'Class level to rows, only for the levels that have rows (stored job output, never recomputed).' }),
  })
  .meta({ id: 'GamesLeagueDetail' })
export type GamesLeagueDetail = z.infer<typeof GamesLeagueDetailSchema>

// --- Sekolah Bersaing (M16-50) ------------------------------------------------------------------------------------------

/** `week`: a valid YYYY-MM-DD selects the Monday of that week; anything else the current week; never an error. */
export const GamesSekolahBersaingQuerySchema = z
  .object({ week: z.string().optional().meta({ description: 'Any text; an invalid value is ignored.' }) })
  .meta({ id: 'GamesSekolahBersaingQuery' })

export const GamesSekolahBersaingRowSchema = z
  .strictObject({
    rank: z.number().int().min(1),
    schoolName: z.string(),
    state: z.string(),
    aktifPct: z.number().min(0).max(100),
    streakAvg: z.number().min(0),
    notaPer10: z.number().min(0),
    anonymous: z.boolean(),
  })
  .refine((r) => !r.anonymous || r.schoolName === GAMES_MESSAGES.sekolahAnonymous, {
    path: ['schoolName'],
    error: 'An anonymous row shows "Sekolah anonim".',
  })
  .meta({ id: 'GamesSekolahBersaingRow' })
export type GamesSekolahBersaingRow = z.infer<typeof GamesSekolahBersaingRowSchema>

export const GamesSekolahBersaingSchema = z
  .strictObject({
    weekStart: DateOnlySchema.meta({ description: 'Monday of the selected week.' }),
    count: gamesCount,
    rows: z.array(GamesSekolahBersaingRowSchema).meta({ description: 'Stored rank order; [] for an empty week.' }),
  })
  .refine((v) => v.count === v.rows.length, { path: ['count'], error: 'count equals the number of rows.' })
  .meta({ id: 'GamesSekolahBersaing' })
export type GamesSekolahBersaing = z.infer<typeof GamesSekolahBersaingSchema>
