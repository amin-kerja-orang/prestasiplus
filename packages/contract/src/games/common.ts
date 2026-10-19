import { z } from '../zod'
import { IdSchema } from '../common/ids'

/**
 * Shared building blocks of the games contract (BE-45, M16 part 2: Permainan hub, Papan Bijak,
 * room and solo games, Roda Nasib, Jutawan Ilmu, leagues, Sekolah Bersaing, admin game settings).
 *
 * Behavioural spec: `src/modules/m16-battle-games/mock/**` and `api/{games,game-types}.ts`.
 * Differences from the mock that apply to the whole domain:
 * - Entity ids (`userId`, `id`, `questionId`, `subject`, `schoolId`...) are opaque string `Id`s (D53 UD-1);
 *   the mock has numbers. Option ids (`0..3`) and the Kad Memori card ids are small client-side
 *   indexes, not entities, and stay integers.
 * - The solo game session id is a uuid string in v2 (the mock's `tf_`, `speed_`... prefixes are gone);
 *   clients treat it as opaque.
 * - D54(d): leaderboards, room players and the weekly board show classmates' display names only;
 *   every response object below is strict, so no other personal field (IC, e-mail, phone, birth date)
 *   can ride along.
 */

/** The six room games (mock `RoomGame`). */
export const GAMES_ROOM_GAMES = [
  'papan-bijak',
  'perang-fakta',
  'benteng-ilmu',
  'perlumbaan-matematik',
  'kuiz-relay',
  'teka-silang-kata',
] as const
export const GamesRoomGameSchema = z.enum(GAMES_ROOM_GAMES).meta({
  id: 'GamesRoomGame',
  description: 'Room game key. An unknown key in a path answers 404 NOT_FOUND "Permainan tidak dijumpai.".',
})
export type GamesRoomGame = z.infer<typeof GamesRoomGameSchema>

/** Fewest and most players per room game (mock `ROOM_GAMES`; Papan Bijak takes 2..6 from `max_players`). */
export const GAMES_ROOM_LIMITS = {
  'papan-bijak': { minPlayers: 2, maxPlayers: 6 },
  'perang-fakta': { minPlayers: 2, maxPlayers: 6 },
  'benteng-ilmu': { minPlayers: 2, maxPlayers: 2 },
  'perlumbaan-matematik': { minPlayers: 2, maxPlayers: 4 },
  'kuiz-relay': { minPlayers: 4, maxPlayers: 8 },
  'teka-silang-kata': { minPlayers: 2, maxPlayers: 2 },
} as const satisfies Record<GamesRoomGame, { minPlayers: number; maxPlayers: number }>

/** The five single-player games (mock `SoloGame`). */
export const GAMES_SOLO_GAMES = [
  'betul-salah',
  'cabaran-kilat',
  'tembak-jawapan',
  'susun-jawapan',
  'kad-memori',
] as const
export const GamesSoloGameSchema = z.enum(GAMES_SOLO_GAMES).meta({
  id: 'GamesSoloGame',
  description: 'Single-player game key. An unknown key answers 404 "Permainan tidak dijumpai.".',
})
export type GamesSoloGame = z.infer<typeof GamesSoloGameSchema>

/** Room subjects (English codes of the subject; BE-45 Open question 5). Papan Bijak excludes SEJARAH. */
export const GAMES_ROOM_SUBJECTS = ['MATEMATIK', 'BAHASA_MELAYU', 'BAHASA_INGGERIS', 'SAINS', 'SEJARAH'] as const
export const GamesRoomSubjectSchema = z.enum(GAMES_ROOM_SUBJECTS).meta({ id: 'GamesRoomSubject' })
export type GamesRoomSubject = z.infer<typeof GamesRoomSubjectSchema>

/** The four subjects Papan Bijak (rooms and quick match) offers. */
export const GAMES_PAPAN_BIJAK_SUBJECTS = ['MATEMATIK', 'BAHASA_MELAYU', 'BAHASA_INGGERIS', 'SAINS'] as const
export const GamesPapanBijakSubjectSchema = z.enum(GAMES_PAPAN_BIJAK_SUBJECTS).meta({ id: 'GamesPapanBijakSubject' })

export const GAMES_MATCH_MODES = ['same_grade', 'same_level', 'custom'] as const
export const GamesMatchModeSchema = z.enum(GAMES_MATCH_MODES).meta({
  id: 'GamesMatchMode',
  description: '`custom` (a grade range) is for Papan Bijak only.',
})
export type GamesMatchMode = z.infer<typeof GamesMatchModeSchema>

export const GAMES_ROOM_STATUSES = ['waiting', 'playing', 'finished', 'closed'] as const
export const GamesRoomStatusSchema = z.enum(GAMES_ROOM_STATUSES).meta({ id: 'GamesRoomStatus' })
export type GamesRoomStatus = z.infer<typeof GamesRoomStatusSchema>

/** `DARJAH_1..6` and `TINGKATAN_1..5` (grades 1..11; mock `gradeOfEnum`). */
export const GAMES_GRADE_LEVELS = [
  'DARJAH_1',
  'DARJAH_2',
  'DARJAH_3',
  'DARJAH_4',
  'DARJAH_5',
  'DARJAH_6',
  'TINGKATAN_1',
  'TINGKATAN_2',
  'TINGKATAN_3',
  'TINGKATAN_4',
  'TINGKATAN_5',
] as const
export const GamesGradeLevelSchema = z.enum(GAMES_GRADE_LEVELS).meta({ id: 'GamesGradeLevel' })
export type GamesGradeLevel = z.infer<typeof GamesGradeLevelSchema>

/** Grade 1..11 used by `darjah`, `grade_min`, `grade_max` (1..6 Darjah, 7..11 Tingkatan 1..5). */
export const gamesGradeNumber = z.number().int().min(1).max(11)

/** Six-character room code, A-Z and 0-9. */
export const GamesRoomCodeSchema = z
  .string()
  .regex(/^[A-Z0-9]{6}$/, 'Room code is 6 characters from A-Z and 0-9.')
  .meta({ id: 'GamesRoomCode', example: 'PB1234' })

/** Non-negative integer (counts, scores). */
export const gamesCount = z.number().int().min(0)

/** Exact BM (and generic English) messages of the mock, by use. Tests assert these. */
export const GAMES_MESSAGES = {
  unauthenticated: 'Unauthenticated.',
  unauthorized: 'This action is unauthorized.',
  gameNotFound: 'Permainan tidak dijumpai.',
  roomNotFound: 'Bilik tidak dijumpai.',
  roomSubject: 'Subjek tidak sah.',
  roomGradeLevel: 'Tahap soalan tidak sah.',
  roomRange: 'Julat tahap tidak sah.',
  roomMaxPlayers: 'Bilangan pemain tidak sah.',
  startHostOnly: 'Hanya hos boleh memulakan permainan.',
  startAlreadyStarted: 'Permainan sudah dimulakan.',
  startNotEnoughPlayers: 'Pemain belum mencukupi.',
  startNotEnoughQuestions: 'Soalan tidak mencukupi.',
  actionQuestion: 'Soalan tidak sah.',
  actionOption: 'Pilihan tidak sah.',
  actionSeconds: 'Masa tidak sah.',
  actionType: 'Tindakan tidak sah.',
  actionQuestionMismatch: 'Soalan tidak sepadan.',
  actionValue: 'Jawapan tidak sah.',
  actionNotStarted: 'Permainan belum bermula.',
  actionNotYourRoll: 'Bukan giliran anda untuk gulung dadu.',
  actionNoQuestion: 'Tiada soalan untuk dijawab.',
  actionNoClock: 'Tiada jam untuk permainan ini.',
  actionNotYourTurn: 'Bukan giliran anda.',
  quickMatchSubject: 'Subjek tidak sah.',
  quickMatchMode: 'Padanan tidak sah.',
  level: 'Tahap tidak sah.',
  soloInvalidResult: 'Keputusan tidak sah.',
  soloAlreadySubmitted: 'Keputusan sudah dihantar.',
  soloSessionNotFound: 'Sesi tidak dijumpai.', // [PROPOSED] on the check/reveal routes (copy reused from Jutawan)
  soloItemNotFound: 'Soalan tidak dijumpai.', // [PROPOSED] on the check/reveal routes (copy reused from Jutawan)
  soloAlreadyChecked: 'Soalan sudah dijawab.', // [PROPOSED]
  soloCardMatched: 'Kad sudah dipadankan.', // [PROPOSED]
  soloCardOpen: 'Sila padankan kad yang dibuka dahulu.', // [PROPOSED]
  spinAlreadySpun: 'Anda sudah spin hari ini.',
  jutawanSubject: 'Subjek tidak sah.',
  jutawanNotEnoughQuestions: 'Soalan tidak mencukupi.',
  jutawanSessionNotFound: 'Sesi tidak dijumpai.',
  jutawanQuestionNotFound: 'Soalan tidak dijumpai.',
  jutawanOver: 'Permainan sudah tamat.',
  jutawanQuestionMismatch: 'Soalan tidak sepadan.',
  jutawanOption: 'Pilihan tidak sah.',
  jutawanLifelineType: 'Bantuan tidak sah.',
  jutawanNoLifeline: 'Tiada bantuan tersedia.',
  leagueRequired: 'Sila lengkapkan semua medan wajib.',
  leagueEndBeforeStart: 'Tarikh tamat mesti selepas tarikh mula.',
  leagueMaxSchools: 'Had sekolah mesti antara 2 dan 500.',
  leagueSubject: 'Mata pelajaran tidak sah.',
  leagueClassLevels: 'Tingkatan tidak sah.',
  leagueInviteInvalid: 'Kod jemputan tidak sah.',
  leagueEnded: 'Liga ini sudah tamat.',
  leagueNeedsSchool: 'Anda perlu mempunyai sekolah untuk menyertai liga ini.',
  leagueAlreadyIn: 'Sekolah anda sudah menyertai liga ini.',
  leagueFull: 'Liga ini sudah penuh.',
  leagueNotFound: 'Liga tidak dijumpai.',
  sekolahAnonymous: 'Sekolah anonim',
  quizTiles: 'Nilai mesti antara 0 dan 38.',
} as const

/**
 * A question as a game serves it BEFORE it is answered: text and options, never a key. Strict on
 * purpose: `correct`, `is_correct`, `correctAnswer`, `answer`, `explanation`... are rejected.
 * Used by the room view (`question`) and Jutawan Ilmu (`question`, `next`).
 * Option ids are the option index 0..3. A Perang Fakta statement has two options (Betul/Salah) and
 * a Teka Silang Kata clue has none.
 */
export const GamesKeylessOptionSchema = z
  .strictObject({
    id: z.number().int().min(0).max(3).meta({ description: 'Option index 0..3 (not an entity id).' }),
    label: z.enum(['A', 'B', 'C', 'D']),
    text: z.string(),
  })
  .meta({ id: 'GamesKeylessOption' })
export type GamesKeylessOption = z.infer<typeof GamesKeylessOptionSchema>

export const GamesKeylessQuestionSchema = z
  .strictObject({
    id: IdSchema,
    text: z.string(),
    options: z.array(GamesKeylessOptionSchema).max(4),
  })
  .meta({
    id: 'GamesKeylessQuestion',
    description:
      'Question without any answer key. The correct option is never part of a question served before it is answered.',
  })
export type GamesKeylessQuestion = z.infer<typeof GamesKeylessQuestionSchema>

/** Raw error body `{ error: "<BM>" }` of the Papan Bijak quick-match start (M16-29), 422 only. */
export const GamesRawErrorSchema = z.strictObject({ error: z.string().min(1) }).meta({ id: 'GamesRawError' })
export type GamesRawError = z.infer<typeof GamesRawErrorSchema>

/** Raw error body `{ message }` of the solo submit (M16-33): 404, 409 and 422. */
export const GamesRawMessageSchema = z.strictObject({ message: z.string().min(1) }).meta({ id: 'GamesRawMessage' })
export type GamesRawMessage = z.infer<typeof GamesRawMessageSchema>
