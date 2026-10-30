/**
 * Copy and fixed options of the six room games (SRS M16 v1.6 §2, §8.1; URS FN-M16-5.1.x, 5.4.x; discovery
 * §2.7 / §2.8). Pure data: the lobby pages, the hub and the routes read it.
 */

import type { Art3DName } from '@/ds'

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
 * Per-game look of the S8–S12 lobbies (v2 learner theme): the semantic colour of the game's button and
 * its 3D art. No palette classes; colour only at the focus point.
 */
export type RoomColor = 'primary' | 'secondary' | 'success' | 'info' | 'warning' | 'error'

export const ROOM_THEME: Readonly<Record<RoomGame, { color: RoomColor; art: Art3DName }>> = {
  'papan-bijak': { color: 'secondary', art: 'party' },
  'perang-fakta': { color: 'error', art: 'bolt' },
  'benteng-ilmu': { color: 'success', art: 'cap' },
  'perlumbaan-matematik': { color: 'info', art: 'rocket' },
  'kuiz-relay': { color: 'secondary', art: 'party' },
  'teka-silang-kata': { color: 'warning', art: 'books' },
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

/** `grade_level` select: the optgroup "Sekolah Menengah" (Tingkatan 1–5); v2 is secondary only, no Darjah group. */
export const GRADE_GROUPS: readonly { label: string; options: GradeOption[] }[] = [
  {
    label: 'Sekolah Menengah',
    options: range(5).map((n) => ({
      value: `TINGKATAN_${String(n)}`,
      label: `Tingkatan ${String(n)}`,
    })),
  },
]

/** Custom range 7–11 (BR-M16-02): T1–T5 = 7–11 (v2: no Darjah 1–6). */
export const CUSTOM_GRADE_OPTIONS: readonly { value: number; label: string }[] = range(5).map(
  (n) => ({ value: n + 6, label: `T${String(n)}` }),
)

/** "Maks Pemain" 2–6. */
export const MAX_PLAYER_OPTIONS: readonly number[] = [2, 3, 4, 5, 6]

/** The `same_level` label of S7 by the chosen grade (FN-M16-5.1.3; static fallback without a grade). */
export function sameLevelLabel(gradeLevel: string): string {
  if (gradeLevel.startsWith('TINGKATAN_')) return 'Semua Tingkatan (1-5)'
  return 'Semua Tingkatan'
}

// --- Papan Bijak quick match -------------------------------------------------------------------------------------------

export const QM_MATCH_OPTIONS = [
  { value: 'same_grade', label: 'Tahap sama' },
  { value: 'same_level', label: 'Semua tingkatan' },
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

/** `USelect` items of the grade select: a label row per group, then its options. */
export const GRADE_ITEMS: readonly (
  | { type: 'label'; label: string }
  | { value: string; label: string }
)[] = GRADE_GROUPS.flatMap((g) => [
  { type: 'label' as const, label: g.label },
  ...g.options.map((o) => ({ value: o.value, label: o.label })),
])

/** Medals of the first three ranks. */
export const MEDALS = ['🥇', '🥈', '🥉'] as const

/** Generic load failure line (INFERRED copy, as the other modules). */
export const LOAD_ERROR = 'Maaf, berlaku ralat. Sila cuba semula.'
