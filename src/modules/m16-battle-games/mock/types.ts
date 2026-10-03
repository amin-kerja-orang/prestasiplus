/**
 * Row types of the M16 stores (SRS M16 v1.6 §6.2–§6.9). M16-T1 owns the battle, tournament, league
 * and Sekolah Bersaing stores; the single-player `GameSession` table is defined here only so the
 * 47 seeded results and the repository reads of §7.2 exist (the game handlers are M16-T2).
 */

export type BattleMode = 'quick_match' | 'school_battle' | 'challenge' | 'queue_join'
export type QuestionType = 'biasa' | 'pksk' | 'spm'
export type PkskLevel = 'T1' | 'T4'
export type BattleStatus = 'active' | 'finished' | 'forfeited' | 'abandoned'
export type Winner = 'A' | 'B' | null

/** DATA-M16-01 Battle. The id is the battle uuid. */
export interface BattleRow {
  id: string
  mode: BattleMode
  questionType: QuestionType
  subjectId: number | null
  pkskDomainId: number | null
  pkskTargetLevel: PkskLevel | null
  /** M03 education level of the question pool (the queue owner's grade), or null. */
  levelId: number | null
  playerA: number
  playerB: number
  /** Schools of the players when the battle was created (null = no school). */
  schoolAId: number | null
  schoolBId: number | null
  scoreA: number
  scoreB: number
  correctA: number
  correctB: number
  answered: number
  winner: Winner
  status: BattleStatus
  createdAt: string
  createdAtMs: number
  finishedAt: string | null
  /** The 10 question ids of the arena (drawn once at creation); empty for the seed rows. */
  questionIds: number[]
  /** Seed rows (stored job figures DC-M16-03 already include them). */
  seeded: boolean
}

export type QueueStatus = 'waiting' | 'incoming_challenge' | 'matched' | 'expired' | 'abandoned'

/** `battleSim` hook modes (SRS §6.14). */
export type SimMode = 'match' | 'incoming' | 'never' | 'expired' | 'not_found' | 'error'

export interface SimSpec {
  mode: SimMode
  /** `match`: the poll that matches (default 3); `incoming`: the poll that shows the challenge (2). */
  afterPolls?: number
  /** `error`: the HTTP status the polls answer. */
  status?: number
}

export interface Challenger {
  userId: number
  name: string
  grade_label: string
  school: string
}

export type JoinOutcome = 'pending' | 'matched' | 'rejected' | 'expired'

/** DATA-M16-02 BattleQueue. */
export interface BattleQueueRow {
  id: number
  ownerId: number
  mode: 'quick_match' | 'school_battle'
  questionType: QuestionType
  subjectId: number | null
  pkskDomainId: number | null
  pkskTargetLevel: PkskLevel | null
  openToAll: boolean
  status: QueueStatus
  challenger: Challenger | null
  battleUuid: string | null
  polls: number
  /** Polls since the queue last returned to `waiting` (the 3rd one matches, BR-M16-05). */
  waitPolls: number
  lastPolledAtMs: number
  createdAtMs: number
  sim: SimSpec
  /** A join request on this queue (`POST /api/battle/join-queue`), DV-M16-06. */
  joiner: { userId: number; outcome: JoinOutcome } | null
}

export type InvitationStatus = 'pending' | 'accepted' | 'declined' | 'expired'

/** DATA-M16-03 BattleInvitation. The id is the invitation uuid. */
export interface BattleInvitationRow {
  id: string
  senderId: number
  receiverId: number
  questionType: QuestionType
  subjectId: number | null
  pkskDomainId: number | null
  pkskTargetLevel: PkskLevel | null
  status: InvitationStatus
  createdAtMs: number
}

/** DATA-M16-04 BattleAnswer (arena, provisional). */
export interface BattleAnswerRow {
  id: number
  battleUuid: string
  playerId: number
  index: number
  questionId: number
  optionId: number | null
  correct: boolean
  seconds: number
  points: number
}

/** The stored job figures of the 8 observed school standings (DC-M16-03). */
export interface StoredStandingRow {
  id: number
  /** `all_time` or `monthly:YYYY-MM`. */
  periodKey: string
  schoolId: number
  ketepatan: number
  skor: number
  orderKey: number
}

export type TournamentStatus = 'draft' | 'registration' | 'ongoing' | 'completed'

/** DATA-M16-11 Tournament. The id is the tournament uuid. */
export interface TournamentRow {
  id: string
  title: string
  description: string
  educationLevelId: string
  format: 'single_match' | 'knockout' | 'league' | 'hybrid'
  groupsCount: number | null
  questionMode: 'subject' | 'exam_paper' | 'random_mix'
  subjectId: number | null
  examPaperId: number | null
  mixedSubjectIds: number[]
  totalQuestions: number
  timeWindowMinutes: number
  topNScoring: number
  minParticipants: number
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  status: TournamentStatus
  liveMatch: { schoolA: string; schoolB: string } | null
  createdBy: number
  createdAt: string
  createdAtMs: number
  /** Creation order (ties of `createdAtMs` under a frozen clock). */
  seq: number
}

export type LeagueStatus = 'upcoming' | 'ongoing' | 'ended'
export type LeagueType = 'friendly' | 'tournament' | 'league'
export type LeagueScope = 'school' | 'district' | 'state' | 'national'
export type LeagueScoring = 'total_score' | 'avg_accuracy' | 'wins'
export type LeagueGameMode = 'mixed' | 'quiz' | 'multiplayer'

/** DATA-M16-12 League. */
export interface LeagueRow {
  id: number
  name: string
  type: LeagueType
  scope: LeagueScope
  subjectId: number | null
  gameMode: LeagueGameMode
  /** `D1`…`D6`, `T1`…`T5`. */
  classLevels: string[]
  scoringMethod: LeagueScoring
  startDate: string
  endDate: string
  maxSchools: number | null
  inviteCode: string
  creatorId: number
  status: LeagueStatus
  createdAt: string
}

export interface LeagueSchoolRow {
  id: number
  leagueId: number
  schoolId: number
  joinedAt: string
}

export interface LeagueStandingRow {
  id: number
  leagueId: number
  level: string
  schoolId: number
  peserta: number
  skor: number
  purata: number
  order: number
}

/** DATA-M16-13 SekolahBersaingWeek, one row per ranked school (the week is the Monday key). */
export interface SekolahBersaingRow {
  id: number
  /** Monday of the week, `YYYY-MM-DD` (MYT). */
  weekStart: string
  rank: number
  schoolId: number
  aktifPct: number
  streakAvg: number
  notaPer10: number
  anonymous: boolean
}

export type GameKey =
  'betul-salah' | 'cabaran-kilat' | 'tembak-jawapan' | 'susun-jawapan' | 'kad-memori'

/** Jutawan play state of a `jut_` session (PROVISIONAL, BR-M16-30). */
export interface JutawanPlay {
  subjectId: number
  level: number
  /** Correct answers in a row so far (= the level reached). */
  answered: number
  lifelines: number
  /** Option ids already removed by 50:50 on the current question. */
  removed: number[]
  over: boolean
}

/**
 * DATA-M16-08 GameSession: the single-player sessions (`tf_`, `speed_`, `shoot_`, `ws_`, `mem_`) and
 * the Jutawan games (`jut_`). Payload items are not stored (re-derived from the stream); `itemCount`
 * and `maxScore` keep what a submit is checked against (BR-M16-27). The 47 seed rows leave them unset.
 */
export interface GameSessionRow {
  id: string
  userId: number
  game: string
  darjah: number | null
  createdAtMs: number
  submittedAtMs: number | null
  score: number
  coinsComputed: number
  coinsCredited: number
  isNewRecord: boolean
  itemIds?: number[]
  itemCount?: number
  maxScore?: number
  jutawan?: JutawanPlay
}

// --- rooms (DATA-M16-06/07), spins (DATA-M16-10), settings (DATA-M16-14) ---------------------------

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

/** The game state of a room (PROVISIONAL rules, BR-M16-20); JSON-able. */
export interface RoomState {
  round: number
  total: number
  /** The question pool drawn at start. */
  qIds: number[]
  /** Next unused pool index. */
  cursor: number
  /** The viewer whose action is awaited (the host). */
  humanId: number
  awaiting: 'roll' | 'answer' | null
  /** The pending question id. */
  pendingQ: number | null
  /** Papan Bijak: the 50 tile kinds. */
  board: string[]
  /** Papan Bijak positions by user id. */
  positions: Record<string, number>
  /** Benteng Ilmu HP / Perlumbaan steps / crossword words by user id. */
  meter: Record<string, number>
  /** Crossword words: question id and answer text. */
  words: { qId: number; answer: string }[]
  /** Perang Fakta statements `"{question} → {option}"` and whether each is true. */
  facts: { qId: number; text: string; isTrue: boolean }[]
  /** Papan Bijak turn index (join order). */
  turn: number
  /** Kuiz Relay team scores `{1: n, 2: n}`. */
  teamScores: Record<string, number>
  winnerId: number | null
  mvpId: number | null
  /** Draw counter of the room's dice and bot streams. */
  draws: number
  log: string[]
}

/** DATA-M16-06 GameRoom. The id is the 6-character code. */
export interface GameRoomRow {
  id: string
  game: RoomGame
  subject: RoomSubject
  gradeLevel: string
  matchMode: MatchMode
  gradeMin: number | null
  gradeMax: number | null
  maxPlayers: number
  hostId: number
  status: RoomStatus
  createdAtMs: number
  startedAtMs: number | null
  finishedAtMs: number | null
  state: RoomState | null
}

export interface RoomPlayerRow {
  id: number
  roomCode: string
  userId: number
  team: number | null
  points: number
  correct: number
  isBot: boolean
  joinedAtMs: number
}

/** DATA-M16-07 GameStanding: lobby `wins` (Kuiz Relay `mvp`); Papan Bijak also `jumlah`, `skor`, `betul`. */
export interface GameStandingRow {
  id: number
  game: RoomGame
  userId: number
  wins: number
  jumlah: number
  skor: number
  betul: number
  /** Stored order (seed: the observed order; runtime rows come after). */
  orderKey: number
  /** When the value was last raised (DV-M16-08 tie order). */
  reachedAtMs: number
}

export interface PersonalBestRow {
  id: number
  userId: number
  game: string
  bestScore: number
}

export interface JutawanStatsRow {
  id: number
  userId: number
  bestLevel: number
  games: number
}

export interface SpinRow {
  id: number
  userId: number
  /** MYT `YYYY-MM-DD`. */
  date: string
  segmentIndex: number
  type: string
  value: number
  credited: number
  createdAtMs: number
}

export interface SpinStatsRow {
  id: number
  userId: number
  spins: number
  won: number
  lastSpinDate: string | null
}

export interface PbSearchRow {
  id: number
  userId: number
  subject: RoomSubject
  matchMode: MatchMode
  status: 'searching' | 'matched' | 'expired' | 'cancelled'
  polls: number
  roomCode: string | null
  createdAtMs: number
  /** Hook: `expired` makes the first poll answer `expired`. */
  sim: 'match' | 'expired'
}

export interface GameSettingsRow {
  id: number
  boardgameQuizTiles: number
}
