/**
 * M16 game API types (SRS M16 v1.6 §7 #22-#41 and #51-#52; M16-T2). The quick match, the submits and the
 * spin keep the live JSON bodies; the others use the `{data}` envelope (the client functions unwrap it).
 */

export type RoomGame =
  | 'papan-bijak'
  | 'perang-fakta'
  | 'benteng-ilmu'
  | 'perlumbaan-matematik'
  | 'kuiz-relay'
  | 'teka-silang-kata'
export type RoomSubject = 'MATEMATIK' | 'BAHASA_MELAYU' | 'BAHASA_INGGERIS' | 'SAINS' | 'SEJARAH'
export type MatchMode = 'same_grade' | 'same_level' | 'custom'
export type RoomStatus = 'waiting' | 'playing' | 'finished' | 'closed'
export type SoloGame =
  'betul-salah' | 'cabaran-kilat' | 'tembak-jawapan' | 'susun-jawapan' | 'kad-memori'

/** #22 `GET /api/games/hub`. */
export interface GamesHub {
  openRooms: { game: RoomGame; code: string; host: string; players: number; max: number }[]
  chips: { papanBijakPlayed: boolean; battled: boolean }
}

/** #23 lobby: `leaders` for the five lobbies, `top10` for Papan Bijak. */
export interface GameLobby {
  /** `DARJAH_4` etc., or null for a user without a grade. */
  autoGrade: string | null
  autoGradeName: string | null
  leaders?: { rank: number; userId: number; name: string; value: number }[]
  top10?: {
    rank: number
    userId: number
    /** Truncated to 15 characters + "...". */
    name: string
    initials: string
    menang: number
    jumlah: number
    kadar: number
    skor: number
    betul: number
  }[]
}

/** #24 body: S7 sends every field, S8–S12 `subject`, `grade_level` and `match_mode`. */
export interface RoomCreateBody {
  subject: RoomSubject
  grade_level: string
  match_mode: MatchMode
  grade_min?: number
  grade_max?: number
  max_players?: number
}

export interface RoomQuestion {
  id: number
  text: string
  options: { id: number; label: string; text: string }[]
}

/** #26–#28 the room (PROVISIONAL rules, polled every 3 s). */
export interface RoomView {
  code: string
  game: RoomGame
  status: RoomStatus
  host: { id: number; name: string }
  players: {
    id: number
    name: string
    grade: string
    team?: number
    points: number
    isBot: boolean
  }[]
  settings: {
    subject: RoomSubject
    gradeLevel: string
    matchMode: MatchMode
    gradeMin: number | null
    gradeMax: number | null
    maxPlayers: number
    minPlayers: number
  }
  state: {
    awaiting: 'roll' | 'answer' | null
    round: number
    total: number
    humanId: number
    board?: string[]
    positions?: Record<string, number>
    meter?: Record<string, number>
    teamScores?: Record<string, number>
    log: string[]
    /** Perang Fakta: seconds left in the round, from the server clock (BR-M16-20). */
    roundSecondsLeft?: number
    /** Teka Silang Kata: seconds left of the 5 minutes, from the server clock. */
    secondsLeft?: number
  } | null
  round?: number
  question?: RoomQuestion
  result?: {
    winnerId: number | null
    winnerName: string | null
    mvpId: number | null
    scores: { userId: number; name: string; points: number; correct: number }[]
  }
}

export type RoomActionBody =
  | { type: 'roll' }
  | {
      type: 'answer'
      questionId: number
      optionId?: number | null
      /** Perang Fakta `true` / `false`; Teka Silang Kata the typed word. */
      value?: boolean | string
      seconds?: number
    }

/** #29–#31 live bodies. */
export type PbQuickMatchStart = { status: 'searching' } | { error: string }
export type PbQuickMatchPoll =
  { status: 'searching' | 'expired' | 'cancelled' } | { status: 'matched'; room_code: string }

/** #32 payload: `sessionId`, `personalBest`, `canEarnSyiling` and the items of the game. */
export interface SoloPayloadBase {
  sessionId: string
  personalBest: number
  canEarnSyiling: boolean
}
export interface BetulSalahPayload extends SoloPayloadBase {
  statements: { id: number; statement: string; is_true: boolean; difficulty: number }[]
}
export interface CabaranKilatPayload extends SoloPayloadBase {
  questions: {
    id: number
    question_text: string
    difficulty: number
    options: { id: number; text: string; correct: boolean }[]
  }[]
}
export interface TembakJawapanPayload extends SoloPayloadBase {
  questions: {
    id: number
    question: string
    difficulty: number
    options: { text: string; correct: boolean }[]
  }[]
}
export interface SusunJawapanPayload extends SoloPayloadBase {
  puzzles: {
    id: number
    question: string
    answer: string
    scrambled: string[]
    type: 'letters' | 'words'
    difficulty: number
    points: number
  }[]
}
export interface KadMemoriPayload extends SoloPayloadBase {
  cards: {
    id: number
    pair_id: number
    type: 'question' | 'answer'
    content: string
    difficulty: number
  }[]
}
export interface SoloPayloads {
  'betul-salah': BetulSalahPayload
  'cabaran-kilat': CabaranKilatPayload
  'tembak-jawapan': TembakJawapanPayload
  'susun-jawapan': SusunJawapanPayload
  'kad-memori': KadMemoriPayload
}

/** #33 bodies (BR-M16-27). */
export type SoloSubmitBody =
  | {
      session_id: string
      correct_count: number
      total_answered: number
      streak: number
      score: number
      syiling_earned: number
    }
  | {
      session_id: string
      correct_count: number
      total_answered: number
      max_combo: number
      score: number
      syiling_earned: number
    }
  | {
      session_id: string
      correct_count: number
      total_answered: number
      max_level: number
      score: number
      syiling_earned: number
    }
  | {
      session_id: string
      solved_count: number
      total_puzzles: number
      score: number
      syiling_earned: number
    }
  | {
      session_id: string
      matches: number
      total_pairs: number
      moves: number
      time_seconds: number
    }

/** #33 live answer: `{message}` on 409 / 422. */
export interface SoloSubmitResponse {
  is_new_record?: boolean
  syiling_awarded?: number
  results?: { syiling_earned: number; accuracy: number }
  message?: string
}

/** #34 `GET /api/games/roda-nasib`. */
export interface SpinPage {
  segments: {
    label: string
    type: 'syiling' | 'nothing'
    value: number
    weight: number
    color: string
    icon: string
  }[]
  spins: number
  won: number
  alreadySpun: boolean
  canEarnSyiling: boolean
}

/** #35 live body (409 `{success: false, message}`). */
export interface SpinResponse {
  success: boolean
  message: string
  result?: { segment_index: number; label: string; icon: string; type: string; value: number }
  coinsCredited?: number
}

/** #36 `GET /api/games/jutawan`. */
export interface JutawanPage {
  bestLevel: number
  games: number
  /** `DARJAH n` / `TINGKATAN n`, present with `?darjah=`. */
  heading?: string
  subjects?: { id: number; name: string; emoji: string; colour: string; count: number }[]
}

/** #37–#39 (PROVISIONAL). */
export interface JutawanStart {
  sessionId: string
  index: number
  question: RoomQuestion
  lifelines: number
}
export interface JutawanAnswerResult {
  correct: boolean
  level: number
  next?: RoomQuestion
  result?: { level: number; credited: number }
}
export interface JutawanLifelineResult {
  removedOptionIds: number[]
  lifelines: number
}

/** #40 `GET /api/games/pertandingan`. */
export interface WeeklyCompetition {
  weekStart: string
  weekEnd: string
  /** Sunday 23:59:59 MYT. */
  endsAt: string
  prizes: number[]
  me: { rank: number; betul: number } | null
  rows: { rank: number; userId: number; name: string; sesi: number; betul: number; tepat: number }[]
}

/** #51 `GET /api/admin/games`. */
export interface AdminGames {
  stats: { rooms: number; playing: number; finished: number; players: number }
  settings: { boardgameQuizTiles: number }
}
