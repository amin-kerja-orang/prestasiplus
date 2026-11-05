import { z } from '../zod'
import { GAMES_MESSAGES, gamesCount } from './common'

/**
 * Tetapan Permainan (M16-51, M16-52; API-ADM-08, API-ADM-23; 30 N-05, 48 section 2). Role `admin` only; other roles 403
 * "This action is unauthorized.".
 */

/** ERR-REQ-15 in the form 48 section 2 gives it. */
export const gamesSettingRangeMessage = (min: number, max: number): string => `Nilai mesti antara ${String(min)} dan ${String(max)}.`

/**
 * The keys of 48 section 2 whose "Who may change" is Tetapan Permainan, in the order of that table, with the exact BM
 * label, default and range. The screen reads this; `GAME_SETTINGS` of the API holds the same ranges (a spec keeps them
 * equal). `oneOf` is a choice list, `toggle` is a Ya/Tidak setting stored as 1/0. `boardgame_quiz_tiles` is apart: it
 * lives in `game_settings` and has its own copy ({@link GAMES_ADMIN_QUIZ_TILES}).
 */
export const GAMES_ADMIN_SETTINGS = {
  games_daily_syiling_cap: { label: 'Had syiling permainan sehari', default: 100, min: 0, max: 1000 },
  games_daily_xp_cap: { label: 'Had mata permainan sehari', default: 500, min: 0, max: 5000 },
  game_win_xp: { label: 'Mata untuk menang', default: 20, min: 0, max: 100 },
  game_draw_xp: { label: 'Mata untuk seri', default: 10, min: 0, max: 100 },
  game_play_xp: { label: 'Mata untuk bermain', default: 5, min: 0, max: 100 },
  game_win_bonus_syiling: { label: 'Bonus syiling untuk menang', default: 5, min: 0, max: 50 },
  games_min_ms_per_answer: { label: 'Masa minimum setiap jawapan (ms)', default: 1000, min: 0, max: 5000 },
  jutawan_min_ms_per_answer: { label: 'Masa minimum setiap jawapan Jutawan (ms)', default: 2000, min: 0, max: 5000 },
  jutawan_question_seconds: { label: 'Masa setiap soalan Jutawan (saat)', default: 60, min: 10, max: 300 },
  battle_questions_default: { label: 'Bilangan soalan Battle (lalai)', default: 10, min: 5, max: 20, oneOf: [5, 10, 15, 20] },
  battle_question_seconds: { label: 'Masa setiap soalan Battle (saat)', default: 15, min: 10, max: 60 },
  battle_grace_seconds: { label: 'Masa tambahan Battle (saat)', default: 3, min: 0, max: 10 },
  battle_queue_seconds: { label: 'Tempoh menunggu lawan (saat)', default: 120, min: 30, max: 600 },
  battle_bot_fallback_seconds: { label: 'Saat sebelum Robot PrestasiPlus', default: 30, min: 0, max: 120 },
  battle_bot_accuracy_pct: { label: 'Ketepatan Robot PrestasiPlus (%)', default: 60, min: 10, max: 90 },
  battle_invitation_hours: { label: 'Tempoh cabaran kawan (jam)', default: 24, min: 1, max: 72 },
  battle_daily_max: { label: 'Had Battle sehari', default: 20, min: 1, max: 100 },
  games_room_bots_enabled: { label: 'Robot dalam bilik permainan', default: 1, min: 0, max: 1, toggle: true },
  games_absent_seconds: { label: 'Saat sebelum pemain dianggap tiada', default: 30, min: 10, max: 120 },
  room_waiting_minutes: { label: 'Tempoh bilik menunggu (minit)', default: 15, min: 5, max: 60 },
  sekolah_bersaing_min_pupils: { label: 'Pelajar minimum setiap sekolah', default: 1, min: 1, max: 50 },
  sekolah_bersaing_top_n: { label: 'Bilangan sekolah dipaparkan', default: 30, min: 10, max: 100 },
} as const

export type GamesAdminSettingKey = keyof typeof GAMES_ADMIN_SETTINGS
export const GAMES_ADMIN_SETTING_KEYS = Object.keys(GAMES_ADMIN_SETTINGS) as GamesAdminSettingKey[]

/** `boardgame_quiz_tiles` (48 section 2, 30 N05-01). The hint is the exact text of both documents. */
export const GAMES_ADMIN_QUIZ_TILES = {
  label: 'Bilangan Petak Soalan',
  unit: 'petak',
  hint: 'Maks 38 petak (48 available - 10 petak khas). Set 0 = tiada soalan.',
  default: 35,
  min: 0,
  max: 38,
} as const

/** The rest of the N-05 copy (30 N05-02, N05-03; 48 GAME-14). */
export const GAMES_ADMIN_COPY = {
  tiles: { rooms: 'Jumlah Bilik', playing: 'Sedang Aktif', finished: 'Selesai', players: 'Pemain Unik' },
  boardTitle: 'Papan Bijak',
  boardDescription: 'Tetapan papan permainan ular & tangga (50 petak)',
  breakdownTitle: 'Pecahan Papan (50 petak)',
  breakdown: {
    quiz: 'Petak soalan (quiz):',
    ladders: 'Tangga (3) + Ular (3):',
    bonus: 'Bonus (2) + Perangkap (2):',
    plain: 'Petak biasa (jalan kosong):',
    ends: 'Mula + Tamat:',
  },
  rewardsTitle: 'Ganjaran & Had Permainan',
  save: 'Simpan Tetapan',
  saved: 'Tetapan permainan disimpan.',
  segmentsTitle: 'Segmen Roda Nasib',
  segmentColumns: { position: '#', label: 'Label', syiling: 'Syiling', weight: 'Berat', active: 'Aktif' },
} as const

/** Copy with no source in 30, 48 or the ERR catalogue. [PROPOSED]: every string waits for the product owner's word. */
export const GAMES_ADMIN_PROPOSED_COPY = {
  /** [PROPOSED] 48 GAME-14 says "exactly 8 rows" and gives no message. */
  segmentsCount: 'Segmen mesti tepat 8.',
  /** [PROPOSED] the positions 1..8, each once; no source gives a message. */
  segmentsPositions: 'Kedudukan segmen mesti 1 hingga 8 tanpa ulangan.',
  /** [PROPOSED] the live total under the segments table. */
  segmentsTotal: (total: number): string => `Jumlah berat: ${String(total)} / 100`,
  /** [PROPOSED] the save button of the segments card; N05-03 names only the Papan Bijak button. */
  segmentsSave: 'Simpan Tetapan',
  /** [PROPOSED] the flash of a segments save; N05-03 gives it for the settings save only. */
  segmentsSaved: 'Tetapan permainan disimpan.',
} as const

/** Live breakdown of N05-02: special = 10; biasa = 48 - N - 10, at least 0; mula + tamat = 2. */
export function gamesBoardBreakdown(quizTiles: number): { quiz: number; ladders: number; bonus: number; special: number; plain: number; ends: number } {
  return { quiz: quizTiles, ladders: 6, bonus: 4, special: 10, plain: Math.max(0, 48 - quizTiles - 10), ends: 2 }
}

const settingInteger = (min: number, max: number) => {
  const message = gamesSettingRangeMessage(min, max)
  return z.number({ error: message }).int({ error: message }).min(min, { error: message }).max(max, { error: message })
}

/** `battle_questions_default`: 5, 10, 15 or 20, refused in the range form with 5 and 20. */
const settingFieldOf = (key: GamesAdminSettingKey) => {
  const spec = GAMES_ADMIN_SETTINGS[key]
  const field = settingInteger(spec.min, spec.max)
  return 'oneOf' in spec
    ? field
        .multipleOf(5, { error: gamesSettingRangeMessage(spec.min, spec.max) })
        .meta({ description: `One of ${spec.oneOf.join(', ')}.` })
    : field
}

const quizTilesField = z.number().int().min(GAMES_ADMIN_QUIZ_TILES.min).max(GAMES_ADMIN_QUIZ_TILES.max)

const settingFields = Object.fromEntries(GAMES_ADMIN_SETTING_KEYS.map((key) => [key, settingFieldOf(key)])) as Record<
  GamesAdminSettingKey,
  ReturnType<typeof settingInteger>
>
const optionalSettingFields = Object.fromEntries(GAMES_ADMIN_SETTING_KEYS.map((key) => [key, settingFields[key].optional()])) as Record<
  GamesAdminSettingKey,
  z.ZodOptional<ReturnType<typeof settingInteger>>
>

/** Every setting of the screen: today's `boardgameQuizTiles` key, the others under their snake_case key. */
export const GamesAdminSettingsResultSchema = z
  .strictObject({ boardgameQuizTiles: quizTilesField, ...settingFields })
  .meta({ id: 'GamesAdminSettingsResult' })
export type GamesAdminSettingsResult = z.infer<typeof GamesAdminSettingsResultSchema>

export const GamesAdminOverviewSchema = z
  .strictObject({
    stats: z.strictObject({
      rooms: gamesCount,
      playing: gamesCount,
      finished: gamesCount,
      players: gamesCount.meta({ description: 'Distinct users in rooms.' }),
    }),
    settings: GamesAdminSettingsResultSchema,
  })
  .meta({ id: 'GamesAdminOverview' })
export type GamesAdminOverview = z.infer<typeof GamesAdminOverviewSchema>

/**
 * Partial body: a key left out keeps its value. Out of range is 422 VALIDATION_ERROR with `fields.<key>` and ERR-REQ-15;
 * `boardgame_quiz_tiles` above 38 is "Maksimum 38 petak soalan.", a non-integer or below 0 "Bilangan petak tidak sah.".
 * The server parses this schema strictly: an unknown key is a 422 on that key. One bad value saves nothing.
 */
export const GamesAdminSettingsUpdateRequestSchema = z
  .object({
    boardgame_quiz_tiles: z
      .number({ error: GAMES_MESSAGES.quizTilesInvalid })
      .int({ error: GAMES_MESSAGES.quizTilesInvalid })
      .min(GAMES_ADMIN_QUIZ_TILES.min, { error: GAMES_MESSAGES.quizTilesInvalid })
      .max(GAMES_ADMIN_QUIZ_TILES.max, { error: GAMES_MESSAGES.quizTilesMax })
      .optional(),
    ...optionalSettingFields,
  })
  .meta({ id: 'GamesAdminSettingsUpdateRequest' })
export type GamesAdminSettingsUpdateRequest = z.infer<typeof GamesAdminSettingsUpdateRequestSchema>

// --- Segmen Roda Nasib (API-ADM-23, DM-64) ------------------------------------------------------------------------

export const GAMES_SPIN_SEGMENT_COUNT = 8
export const GAMES_SPIN_WEIGHT_TOTAL = 100

/** One row of `spin_segments`. The label takes the ERR-REQ-10 and ERR-REQ-12 patterns; syiling and weight ERR-REQ-15. */
export const GamesAdminSpinSegmentSchema = z
  .strictObject({
    position: settingInteger(1, GAMES_SPIN_SEGMENT_COUNT),
    label: z
      .string({ error: 'Sila isi label.' })
      .trim()
      .min(1, { error: 'Sila isi label.' })
      .max(20, { error: 'Label tidak boleh melebihi 20 aksara.' }),
    syiling: settingInteger(0, 100),
    weight: settingInteger(0, 100),
    active: z.boolean({ error: 'Nilai tidak sah.' }),
  })
  .meta({ id: 'GamesAdminSpinSegment' })
export type GamesAdminSpinSegment = z.infer<typeof GamesAdminSpinSegmentSchema>

export const GamesAdminSpinSegmentsSchema = z
  .array(GamesAdminSpinSegmentSchema)
  .length(GAMES_SPIN_SEGMENT_COUNT)
  .meta({ id: 'GamesAdminSpinSegments' })
export type GamesAdminSpinSegments = z.infer<typeof GamesAdminSpinSegmentsSchema>

/**
 * Exactly 8 rows, positions 1..8 once each, integer weights totalling 100 ("Jumlah berat mesti 100.", fields.segments).
 * All 8 rows count towards the total, an inactive one too (48 GAME-14 names no exception).
 */
export const GamesAdminSpinSegmentsUpdateRequestSchema = z
  .strictObject({
    segments: z
      .array(GamesAdminSpinSegmentSchema, { error: GAMES_ADMIN_PROPOSED_COPY.segmentsCount })
      .length(GAMES_SPIN_SEGMENT_COUNT, { error: GAMES_ADMIN_PROPOSED_COPY.segmentsCount })
      .superRefine((rows, ctx) => {
        if (new Set(rows.map((r) => r.position)).size !== rows.length) {
          ctx.addIssue({ code: 'custom', message: GAMES_ADMIN_PROPOSED_COPY.segmentsPositions })
          return
        }
        if (rows.reduce((sum, r) => sum + r.weight, 0) !== GAMES_SPIN_WEIGHT_TOTAL) {
          ctx.addIssue({ code: 'custom', message: GAMES_MESSAGES.spinWeightsTotal })
        }
      }),
  })
  .meta({ id: 'GamesAdminSpinSegmentsUpdateRequest' })
export type GamesAdminSpinSegmentsUpdateRequest = z.infer<typeof GamesAdminSpinSegmentsUpdateRequestSchema>
