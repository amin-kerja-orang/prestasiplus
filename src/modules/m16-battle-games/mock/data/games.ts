/**
 * Fixed data of the M16 games (SRS M16 v1.6 §6.11.3, §6.11.0, BR-M16-18/20/29/36; discovery A.1, A.5):
 * the room games and their rules, the observed game standings, the Roda Nasib segments, the
 * single-player games and the seed settings. Observed values are kept exactly; PROPOSED ones are marked.
 */

import type { GameKey, RoomGame, RoomSubject } from '../types'

export interface RoomGameInfo {
  game: RoomGame
  title: string
  /** Fewest players before the host may start (BR-M16-19). */
  minPlayers: number
  /** Most players the room takes (Papan Bijak: the form's `max_players`). */
  maxPlayers: number
  /** The M14 `onGameResult` game token. */
  token: string
}

export const ROOM_GAMES: readonly RoomGameInfo[] = [
  { game: 'papan-bijak', title: 'Papan Bijak', minPlayers: 2, maxPlayers: 6, token: 'papan_bijak' },
  {
    game: 'perang-fakta',
    title: 'Perang Fakta',
    minPlayers: 2,
    maxPlayers: 6,
    token: 'perang_fakta',
  },
  { game: 'benteng-ilmu', title: 'Benteng Ilmu', minPlayers: 2, maxPlayers: 2, token: 'benteng' },
  {
    game: 'perlumbaan-matematik',
    title: 'Perlumbaan Matematik',
    minPlayers: 2,
    maxPlayers: 4,
    token: 'mathrace',
  },
  { game: 'kuiz-relay', title: 'Kuiz Relay', minPlayers: 4, maxPlayers: 8, token: 'kuiz_relay' },
  {
    game: 'teka-silang-kata',
    title: 'Teka Silang Kata',
    minPlayers: 2,
    maxPlayers: 2,
    token: 'teka_silang_kata',
  },
]

export const roomGameInfo = (game: string): RoomGameInfo | undefined =>
  ROOM_GAMES.find((g) => g.game === game)

/** Room subjects and the M03 subject each draws questions from (discovery A.1 ids). */
export const ROOM_SUBJECTS: Readonly<Record<RoomSubject, number>> = {
  MATEMATIK: 3,
  BAHASA_MELAYU: 1,
  SAINS: 4,
  BAHASA_INGGERIS: 2,
  SEJARAH: 5,
}
/** Papan Bijak offers four of them (V-M16-01). */
export const PAPAN_BIJAK_SUBJECTS: readonly RoomSubject[] = [
  'MATEMATIK',
  'BAHASA_MELAYU',
  'SAINS',
  'BAHASA_INGGERIS',
]

/** Papan Bijak board (BR-M16-20): 3 ladders, 3 snakes, 2 bonus, 2 traps, the quiz tiles, the rest plain. */
export const BOARD_SIZE = 50
export const BOARD_FIXED = { ladders: 3, snakes: 3, bonus: 2, traps: 2 } as const
export const BOARD_STEP = 3

/** Room rules (PROVISIONAL, BR-M16-20). */
export const PF_ROUNDS = 15
export const KR_ROUNDS = 10
export const BENTENG_HP = 100
export const BENTENG_DAMAGE = 20
export const MATHRACE_STEPS = 20
export const CROSSWORD_WORDS = 8

/** The M14 ledger rates of the room games (BR-M16-28): benteng 8 / 35, perang fakta win 10, mathrace 5. */
export const ROOM_COINS = {
  bentengPlay: 8,
  bentengWin: 35,
  perangFaktaWin: 10,
  mathracePlay: 5,
} as const

/** Seed value of `boardgame_quiz_tiles` and its limits (BR-M16-36). */
export const SEED_QUIZ_TILES = 35
export const MAX_QUIZ_TILES = 38
export const BOARD_NON_PLAIN = 10

/** Seed rooms (§6.11.0): 160 rooms over 189 distinct users, 38 of them the standing users. */
export const SEED_ROOMS = 160
export const SEED_ROOM_PLAYERS = 189

// --- single-player games (BR-M16-25/26) ---------------------------------------------------------------

export interface SoloInfo {
  game: GameKey
  /** Session id prefix (BR-M16-25). */
  prefix: string
  /** The M14 `onGameResult` game token. */
  token: string
  /** Items per payload. */
  items: number
}

export const SOLO_GAMES: readonly SoloInfo[] = [
  { game: 'betul-salah', prefix: 'tf_', token: 'betul_salah', items: 40 },
  { game: 'cabaran-kilat', prefix: 'speed_', token: 'cabaran_kilat', items: 30 },
  { game: 'tembak-jawapan', prefix: 'shoot_', token: 'tembak_jawapan', items: 30 },
  { game: 'susun-jawapan', prefix: 'ws_', token: 'susun_jawapan', items: 20 },
  { game: 'kad-memori', prefix: 'mem_', token: 'kad_memori', items: 6 },
]

export const soloInfo = (game: string): SoloInfo | undefined =>
  SOLO_GAMES.find((g) => g.game === game)

/** Kad Memori: 6 questions, 12 cards (BR-M16-25). */
export const MEMORY_PAIRS = 6
/** Susun Jawapan keeps questions whose correct option has at most this many characters. */
export const SUSUN_MAX_ANSWER = 20
/** Solo draws oversample by this factor, then keep the questions that fit the game. */
export const SOLO_OVERSAMPLE = 8

// --- Roda Nasib (BR-M16-29; discovery A.5, 0-based segment_index) ---------------------------------

export interface SpinSegment {
  label: string
  type: 'syiling' | 'nothing'
  value: number
  weight: number
  color: string
  icon: string
}

export const SPIN_SEGMENTS: readonly SpinSegment[] = [
  { label: '1 Syiling', type: 'syiling', value: 1, weight: 25, color: '#3b82f6', icon: '🪙' },
  { label: '3 Syiling', type: 'syiling', value: 3, weight: 20, color: '#8b5cf6', icon: '💰' },
  { label: '5 Syiling', type: 'syiling', value: 5, weight: 15, color: '#10b981', icon: '💎' },
  { label: '10 Syiling', type: 'syiling', value: 10, weight: 8, color: '#f59e0b', icon: '🏆' },
  { label: '20 Syiling', type: 'syiling', value: 20, weight: 3, color: '#ef4444', icon: '🔥' },
  { label: 'Cuba Lagi', type: 'nothing', value: 0, weight: 15, color: '#6b7280', icon: '😅' },
  { label: '2 Syiling', type: 'syiling', value: 2, weight: 10, color: '#ec4899', icon: '✨' },
  { label: '7 Syiling', type: 'syiling', value: 7, weight: 4, color: '#14b8a6', icon: '🎁' },
]

/** PROPOSED refusal copy (V-M16-20). */
export const SPIN_REFUSED = 'Anda sudah spin hari ini.'

// --- Jutawan Ilmu (BR-M16-30) ----------------------------------------------------------------------------

export const JUTAWAN_QUESTIONS = 15
export const JUTAWAN_LIFELINES = 3
/** Difficulty of question n (1-based): 1 for 1-4, 2 for 5-8, 3 for 9-12, 4 for 13-15 (PROPOSED). */
export const jutawanDifficulty = (n: number): number => (n <= 4 ? 1 : n <= 8 ? 2 : n <= 12 ? 3 : 4)
/** Coins of the level reached: L15 = 1,000, L10 = 50, otherwise 0 (PROPOSED ladder; +50 / +1,000 observed). */
export const jutawanCoins = (level: number): number => (level >= 15 ? 1000 : level >= 10 ? 50 : 0)

/** S19 tile emojis and colours of the 10 observed subjects (discovery A.7); others get the fallback. */
export const JUTAWAN_TILES: Readonly<Record<number, { emoji: string; colour: string }>> = {
  1: { emoji: '📝', colour: '#3b82f6' },
  2: { emoji: '🇬🇧', colour: '#8b5cf6' },
  3: { emoji: '🔢', colour: '#10b981' },
  4: { emoji: '🔬', colour: '#06b6d4' },
  5: { emoji: '📜', colour: '#f59e0b' },
  6: { emoji: '☪️', colour: '#059669' },
  7: { emoji: '💛', colour: '#ec4899' },
  12: { emoji: '🌍', colour: '#0ea5e9' },
  18: { emoji: '🕌', colour: '#047857' },
  26: { emoji: '📖', colour: '#64748b' },
}
export const JUTAWAN_TILE_FALLBACK = { emoji: '📚', colour: '#64748b' }

/** Weekly competition prizes (copy: +100 / +50 / +25 🪙). */
export const WEEKLY_PRIZES: readonly number[] = [100, 50, 25]

// --- seed: personal bests, spins, standings (SRS §6.5, §6.6, §6.11.3) -------------------------------------

export const SEED_PERSONAL_BESTS = [
  { userId: 1, game: 'betul-salah', bestScore: 38 },
  { userId: 1, game: 'cabaran-kilat', bestScore: 40 },
]

/** User 1: 2 spins, 0 won; `lastSpinDate` 2026-09-24 (PROPOSED: before the clock day, so SPIN is enabled). */
export const SEED_SPIN_STATS = { userId: 1, spins: 2, won: 0, lastSpinDate: '2026-09-24' }

type Standing = readonly (readonly [userId: number, value: number])[]

/** Observed lobby standings in the observed order (`wins`; Kuiz Relay `mvp`). */
export const LOBBY_STANDINGS: Readonly<Record<Exclude<RoomGame, 'papan-bijak'>, Standing>> = {
  'perang-fakta': [
    [4326, 5],
    [4327, 4],
    [4328, 3],
    [4329, 3],
    [4330, 3],
    [4331, 3],
    [4302, 3],
    [4332, 2],
    [4333, 2],
    [4334, 2],
  ],
  'benteng-ilmu': [
    [4335, 2],
    [4301, 1],
    [4336, 1],
    [4320, 1],
    [4337, 1],
    [4331, 1],
    [4338, 1],
    [4339, 1],
  ],
  'perlumbaan-matematik': [
    [4330, 2],
    [4302, 2],
    [4340, 1],
    [4341, 1],
    [4342, 1],
    [4343, 1],
    [4344, 1],
    [4325, 1],
    [4345, 1],
    [4346, 1],
  ],
  'kuiz-relay': [[4331, 1]],
  'teka-silang-kata': [
    [4332, 1],
    [4347, 1],
    [4348, 1],
    [4349, 1],
    [4350, 1],
    [4328, 1],
  ],
}

/** Observed Papan Bijak Top 10 in rank order: user, menang, jumlah, skor, betul. */
export const PAPAN_BIJAK_STANDINGS: readonly (readonly [number, number, number, number, number])[] =
  [
    [1, 4, 6, 90, 13],
    [4320, 3, 4, 170, 9],
    [4352, 2, 4, 230, 18],
    [4353, 2, 8, 225, 46],
    [4354, 2, 6, 185, 26],
    [4355, 2, 2, 185, 11],
    [4356, 2, 3, 165, 19],
    [4321, 2, 5, 100, 14],
    [4357, 2, 6, 65, 13],
    [4358, 2, 3, 60, 10],
  ]

/** Every user of the seed game standings (38, §6.11.3). */
export function standingUserIds(): number[] {
  const ids = new Set<number>()
  for (const rows of Object.values(LOBBY_STANDINGS)) for (const [u] of rows) ids.add(u)
  for (const [u] of PAPAN_BIJAK_STANDINGS) ids.add(u)
  return [...ids]
}
