/**
 * Copy and fixed options of the six room games (SRS M16 v1.6 §2, §8.1; URS FN-M16-5.1.x, 5.4.x; discovery
 * §2.7 / §2.8). Pure data: the lobby pages, the hub and the routes read it.
 */

import type { RoomGame, RoomSubject } from '../../api'

export interface RoomGameMeta {
  game: RoomGame
  /** Header title and tab-title prefix. */
  title: string
  emoji: string
  /** Lobby subtitle under the h1. */
  subtitle: string
  /** Rule line under the subtitle (S8–S12). */
  rule: string
  /** Leaderboard value unit ("{n} menang", "{n} kali MVP"). */
  unit: string
}

export const ROOM_GAME_META: Readonly<Record<RoomGame, RoomGameMeta>> = {
  'papan-bijak': {
    game: 'papan-bijak',
    title: 'Papan Bijak',
    emoji: '🎲',
    subtitle: 'Board game quiz multiplayer — jemput kawan, gulung dadu, jawab soalan! 🐍🪜',
    rule: '',
    unit: 'menang',
  },
  'perang-fakta': {
    game: 'perang-fakta',
    title: 'Perang Fakta',
    emoji: '⚔️',
    subtitle: 'Betul atau Salah? Vote & buktikan pengetahuan kamu!',
    rule: '2-6 pemain · 15 pusingan · 10 saat setiap soalan',
    unit: 'menang',
  },
  'benteng-ilmu': {
    game: 'benteng-ilmu',
    title: 'Benteng Ilmu',
    emoji: '🏰',
    subtitle:
      'Serang benteng lawan dengan kuasa ilmu! Jawab betul = serang, jawab salah = rosak sendiri!',
    rule: '2 pemain · HP 100 · Giliran bertukar',
    unit: 'menang',
  },
  'perlumbaan-matematik': {
    game: 'perlumbaan-matematik',
    title: 'Perlumbaan Matematik',
    emoji: '🏎️',
    subtitle: 'Jawab soalan, lari ke garisan penamat! Siapa paling pantas menang!',
    rule: '2-4 pemain · 20 langkah · Siapa sampai dulu menang',
    unit: 'menang',
  },
  'kuiz-relay': {
    game: 'kuiz-relay',
    title: 'Kuiz Relay',
    emoji: '🏃‍♂️',
    subtitle: 'Berpasukan! Jawab soalan secara bergilir-gilir. Pasukan terbaik menang!',
    rule: '4-8 pemain · 2 pasukan · 10 pusingan',
    unit: 'kali MVP',
  },
  'teka-silang-kata': {
    game: 'teka-silang-kata',
    title: 'Teka Silang Kata',
    emoji: '📝',
    subtitle: 'Isi silang kata paling pantas! Lawan masa dan lawan untuk markah tertinggi!',
    rule: '2 pemain · 5 minit · Markah tertinggi menang',
    unit: 'menang',
  },
}

/**
 * Per-game colours of the S8–S12 lobbies (live screenshots perang-fakta / benteng-ilmu /
 * perlumbaan-matematik / kuiz-relay / teka-silang-kata): the hero gradient, the solid button and the
 * leaderboard value colour (live values; the Teka Silang Kata button is an orange gradient as live).
 */
export const ROOM_THEME: Readonly<
  Record<RoomGame, { hero: string; button: string; value: string }>
> = {
  'papan-bijak': {
    hero: 'from-violet-600 to-purple-900',
    button: 'bg-linear-to-r from-violet-600 to-violet-700 hover:brightness-95',
    value: 'text-violet-700',
  },
  'perang-fakta': {
    hero: 'from-red-700 to-red-900',
    button: 'bg-linear-to-r from-red-600 to-red-700 hover:brightness-95',
    value: 'text-red-600',
  },
  'benteng-ilmu': {
    hero: 'from-emerald-600 to-emerald-900',
    button: 'bg-linear-to-r from-emerald-600 to-emerald-700 hover:brightness-95',
    value: 'text-emerald-600',
  },
  'perlumbaan-matematik': {
    hero: 'from-blue-600 to-blue-900',
    button: 'bg-linear-to-r from-blue-600 to-blue-700 hover:brightness-95',
    value: 'text-blue-600',
  },
  'kuiz-relay': {
    hero: 'from-violet-600 to-purple-900',
    button: 'bg-linear-to-r from-purple-600 to-purple-700 hover:brightness-95',
    value: 'text-purple-600',
  },
  'teka-silang-kata': {
    hero: 'from-amber-700 to-orange-900',
    button: 'bg-linear-to-r from-orange-600 to-amber-700 hover:brightness-95',
    value: 'text-amber-600',
  },
}

/** The five lobbies S8–S12 (Papan Bijak S7 has its own page), in live order. */
export const LOBBY_GAMES: readonly RoomGame[] = [
  'perang-fakta',
  'benteng-ilmu',
  'perlumbaan-matematik',
  'kuiz-relay',
  'teka-silang-kata',
]

export const ROOM_GAMES: readonly RoomGame[] = ['papan-bijak', ...LOBBY_GAMES]

export function isRoomGame(v: unknown): v is RoomGame {
  return typeof v === 'string' && (ROOM_GAMES as readonly string[]).includes(v)
}

/** Lobby path of a game. */
export const lobbyPath = (game: RoomGame): string => `/${game}`
/** Room path of a game and code. */
export const roomPath = (game: RoomGame, code: string): string => `/${game}/${code}`

/** Exact flash/refusal text of every refused join and unknown room (BR-M16-18). */
export const ROOM_NOT_FOUND = 'Bilik tidak dijumpai.'

// --- subjects -------------------------------------------------------------------------------------------------------

export const PB_SUBJECTS: readonly { value: RoomSubject; label: string; emoji: string }[] = [
  { value: 'MATEMATIK', label: 'Matematik', emoji: '🔢' },
  { value: 'BAHASA_MELAYU', label: 'Bahasa Melayu', emoji: '📝' },
  { value: 'SAINS', label: 'Sains', emoji: '🔬' },
  { value: 'BAHASA_INGGERIS', label: 'Bahasa Inggeris', emoji: '🇬🇧' },
]

/** S8–S12 "Subjek" (no emoji). */
export const LOBBY_SUBJECTS: readonly { value: RoomSubject; label: string }[] = [
  { value: 'MATEMATIK', label: 'Matematik' },
  { value: 'BAHASA_MELAYU', label: 'Bahasa Melayu' },
  { value: 'BAHASA_INGGERIS', label: 'Bahasa Inggeris' },
  { value: 'SAINS', label: 'Sains' },
  { value: 'SEJARAH', label: 'Sejarah' },
]

// --- grades -------------------------------------------------------------------------------------------------------------

export interface GradeOption {
  value: string
  label: string
}

const range = (n: number): number[] => Array.from({ length: n }, (_, i) => i + 1)

/** `grade_level` select: optgroups "Sekolah Rendah" (Darjah 1–6) and "Sekolah Menengah" (Tingkatan 1–5). */
export const GRADE_GROUPS: readonly { label: string; options: GradeOption[] }[] = [
  {
    label: 'Sekolah Rendah',
    options: range(6).map((n) => ({ value: `DARJAH_${String(n)}`, label: `Darjah ${String(n)}` })),
  },
  {
    label: 'Sekolah Menengah',
    options: range(5).map((n) => ({
      value: `TINGKATAN_${String(n)}`,
      label: `Tingkatan ${String(n)}`,
    })),
  },
]

/** Custom range 1–11 (BR-M16-02): D1–D6 = 1–6, T1–T5 = 7–11. */
export const CUSTOM_GRADE_OPTIONS: readonly { value: number; label: string }[] = range(11).map(
  (n) => ({ value: n, label: n <= 6 ? `D${String(n)}` : `T${String(n - 6)}` }),
)

/** "Maks Pemain" 2–6. */
export const MAX_PLAYER_OPTIONS: readonly number[] = [2, 3, 4, 5, 6]

/** The `same_level` label of S7 by the chosen grade (FN-M16-5.1.3; static fallback without a grade). */
export function sameLevelLabel(gradeLevel: string): string {
  if (gradeLevel.startsWith('DARJAH_')) return 'Semua Darjah (1-6)'
  if (gradeLevel.startsWith('TINGKATAN_')) return 'Semua Tingkatan (1-5)'
  return 'Semua Darjah/Tingkatan'
}

// --- Papan Bijak quick match -------------------------------------------------------------------------------------------

export const QM_MATCH_OPTIONS = [
  { value: 'same_grade', label: 'Tahap sama' },
  { value: 'same_level', label: 'Semua darjah/tingkatan' },
] as const

export const QM_MESSAGES = {
  expired: 'Tiada lawan dijumpai. Cuba lagi!',
  network: 'Ralat rangkaian. Sila cuba lagi.',
} as const

/** Papan Bijak "Cara Bermain:" lines (FN-M16-5.1.5). */
export const PB_HOW_TO = [
  '🎲 1. Gulung dadu dan bergerak di papan',
  '📝 2. Jatuh di petak kuiz — jawab soalan!',
  '🪜 3. Naik tangga untuk shortcut',
  '🐍 4. Elak ular yang menarik turun',
  '🏆 5. Sampai petak 50 dulu = MENANG!',
] as const

/** Medals of the first three ranks. */
export const MEDALS = ['🥇', '🥈', '🥉'] as const

/** Generic load failure line (INFERRED copy, as the other modules). */
export const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
