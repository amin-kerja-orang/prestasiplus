import { z } from '../zod'
import { IdSchema } from '../common/ids'
import { DateOnlySchema } from '../common/time'
import { GAMES_MESSAGES, gamesCount } from './common'

/**
 * Leagues (M16-46 to M16-49) and the Sekolah Bersaing board (API-AS-14). All bodies are `{ data }`.
 *
 * League standings are stored job output in the mock and are never recomputed (BE-45 Open question 7); league `status`
 * is stored and not moved by dates. Sekolah Bersaing is computed on request (DM-31).
 * D54(d): only the creator's display name and school names are shown (the creator's name follows the children's
 * names rule, issue #76: first name + initial unless the viewer may see it).
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

// --- create (M16-47), enrol (API-ADM-25) ---------------------------------------------------------------------------------

const required = { error: GAMES_MESSAGES.leagueRequired }

/** The create form offers `friendly` and `league` only; a tournament has its own route (API-ADM-25). */
export const GAMES_LEAGUE_CREATE_TYPES = ['friendly', 'league'] as const
/** Tingkatan ids of the create form: 1..5 = T1..T5 (`LeagueClassLevel.level`). The ONE mapper between the two. */
export const GAMES_LEAGUE_LEVEL_IDS = [1, 2, 3, 4, 5] as const
export const gamesLevelIdToClassLevel = (id: number): (typeof GAMES_LEAGUE_CLASS_LEVELS)[number] => `T${String(id)}` as (typeof GAMES_LEAGUE_CLASS_LEVELS)[number]
export const gamesClassLevelToLevelId = (level: string): number => Number(level.slice(1))

/** Missing -> "Sila lengkapkan semua medan wajib."; present but wrong -> `wrong`. */
const orRequired = (wrong: string) => ({ error: (iss: { input?: unknown }) => (iss.input === undefined ? GAMES_MESSAGES.leagueRequired : wrong) })

/**
 * Body of `POST /leagues` (API-ADM-25, Admin Pusat; 60 section 2.17.9): `{ name, type, scope, mode, scoring,
 * schoolLimit, subjectId?, levelIds, start, end }`. 422 `fields` are keyed by these names; the top-level message is the
 * first failing field in form order (P14-09..14). Missing required field "Sila lengkapkan semua medan wajib.";
 * `type`/`scope`/`mode`/`scoring` out of range "Format tidak sah."; `schoolLimit` outside 2..500 "Had sekolah mesti
 * antara 2 dan 500."; `end` before `start` "Tarikh tamat mesti selepas tarikh mula."; unknown `subjectId` "Mata
 * pelajaran tidak sah." (server check); `levelIds` outside 1..5 "Tingkatan tidak sah.".
 */
export const GamesLeagueCreateRequestSchema = z
  .object({
    name: z.string(required).trim().min(1, required).max(255, required),
    type: z.enum(GAMES_LEAGUE_CREATE_TYPES, orRequired(GAMES_MESSAGES.leagueFormat)),
    scope: z.enum(GAMES_LEAGUE_SCOPES, orRequired(GAMES_MESSAGES.leagueFormat)),
    mode: z.enum(GAMES_LEAGUE_GAME_MODES, orRequired(GAMES_MESSAGES.leagueFormat)),
    scoring: z.enum(GAMES_LEAGUE_SCORINGS, orRequired(GAMES_MESSAGES.leagueFormat)),
    schoolLimit: z
      .number(orRequired(GAMES_MESSAGES.leagueMaxSchools))
      .int({ error: GAMES_MESSAGES.leagueMaxSchools })
      .min(2, { error: GAMES_MESSAGES.leagueMaxSchools })
      .max(500, { error: GAMES_MESSAGES.leagueMaxSchools }),
    subjectId: IdSchema.nullable().optional().meta({ description: 'Existing subject; unknown 422 "Mata pelajaran tidak sah." (subjectId).' }),
    levelIds: z
      .array(z.number({ error: GAMES_MESSAGES.leagueClassLevels }).int({ error: GAMES_MESSAGES.leagueClassLevels }).min(1, { error: GAMES_MESSAGES.leagueClassLevels }).max(5, { error: GAMES_MESSAGES.leagueClassLevels }), orRequired(GAMES_MESSAGES.leagueClassLevels))
      .min(1, required)
      .meta({ description: 'Tingkatan 1..5 = T1..T5; at least one.' }),
    start: z.iso.date(required),
    end: z.iso.date(required),
  })
  .superRefine((v, ctx) => {
    if (typeof v.start === 'string' && typeof v.end === 'string' && v.end < v.start) {
      ctx.addIssue({ code: 'custom', path: ['end'], message: GAMES_MESSAGES.leagueEndBeforeStart })
    }
  })
  .meta({ id: 'GamesLeagueCreateRequest' })
export type GamesLeagueCreateRequest = z.infer<typeof GamesLeagueCreateRequestSchema>

/**
 * Body of `POST /leagues/{id}/schools` (API-ADM-25, Admin Pusat only): the schools to enrol, in order. All or nothing;
 * the first failing school decides the 422, which sits under `fields.schoolIds`.
 */
export const GamesLeagueEnrolRequestSchema = z
  .strictObject({ schoolIds: z.array(IdSchema).min(1) })
  .meta({ id: 'GamesLeagueEnrolRequest' })
export type GamesLeagueEnrolRequest = z.infer<typeof GamesLeagueEnrolRequestSchema>

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
    schools: z.array(z.strictObject({ id: IdSchema, name: z.string() })),
    standings: z
      .partialRecord(GamesLeagueClassLevelSchema, z.array(GamesLeagueStandingRowSchema))
      .meta({ description: 'Class level to rows, only for the levels that have rows (stored job output, never recomputed).' }),
  })
  .meta({ id: 'GamesLeagueDetail' })
export type GamesLeagueDetail = z.infer<typeof GamesLeagueDetailSchema>

// --- Sekolah Bersaing (API-AS-14) ----------------------------------------------------------------------------------------

/** One school of the live board, computed on request (FR-AS-45-1, DM-31). `accuracy`: one decimal on the wire (60 section 4.6). */
export const GamesSekolahBersaingBoardRowSchema = z
  .strictObject({
    rank: z.number().int().min(1),
    school: z.string(),
    state: z.string(),
    accuracy: z
      .number()
      .min(0)
      .max(100)
      .refine((n) => Math.round(n * 10) / 10 === n, { error: 'At most one decimal.' })
      .meta({ description: 'Mean of per-session accuracy of the school, percent, one decimal.' }),
    pupils: gamesCount.meta({ description: 'Distinct pupils of the school with a session.' }),
  })
  .meta({ id: 'GamesSekolahBersaingBoardRow' })
export type GamesSekolahBersaingBoardRow = z.infer<typeof GamesSekolahBersaingBoardRowSchema>

export const GamesSekolahBersaingBoardSchema = z
  .array(GamesSekolahBersaingBoardRowSchema)
  .meta({ id: 'GamesSekolahBersaingBoard', description: 'Rank order; [] when no school has a session.' })
export type GamesSekolahBersaingBoard = z.infer<typeof GamesSekolahBersaingBoardSchema>
