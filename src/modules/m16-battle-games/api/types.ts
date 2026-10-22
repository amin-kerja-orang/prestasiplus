/**
 * M16 API types (SRS M16 v1.6 §7 #1-#21 and #42-#50). The 13 `/api/battle/*` endpoints and the banner
 * keep the live JSON bodies (snake_case, `{error}` strings); the others use the `{data}` envelope.
 */

export type QuestionType = 'biasa' | 'pksk' | 'spm'
export type PkskLevel = 'T1' | 'T4'
export type StandingPeriod = 'weekly' | 'monthly' | 'all_time'
export type BattleStatus = 'active' | 'finished' | 'forfeited' | 'abandoned'
/** `null` = seri. */
export type Winner = 'A' | 'B' | null

/**
 * A queue id: a mock number, or the opaque decimal string of the real API (`BattleStartResponseSchema`
 * `queue_id: IdSchema`, DEMO-FIX-1 D-03).
 */
export type BattleQueueId = number | string

/** Body of #2, #3 and #8 (`receiver_id` only for #8). Ids go out as strings in http mode. */
export interface BattleStartBody {
  question_type: QuestionType
  open_to_all: boolean
  subject_id?: number | string
  pksk_domain_id?: number | string
  pksk_target_level?: PkskLevel
}

export interface BattleInviteBody extends BattleStartBody {
  receiver_id: number | string
}

/** The live start answer: `{queue_id}`, or an error body (`error` / `message`; `{}` on 422 and 403). */
export interface BattleStartResponse {
  queue_id?: BattleQueueId
  matched?: boolean
  battle_uuid?: string
  error?: string
  message?: string
}

export type PollMatchResponse =
  | { status: 'waiting' | 'expired' | 'not_found' }
  | {
      status: 'incoming_challenge'
      challenger: { name: string; grade_label: string; school: string }
    }
  | { status: 'matched'; battle_uuid: string }

export interface PollChallengerResponse {
  status: 'waiting' | 'matched' | 'rejected' | 'expired' | 'not_found'
  battle_uuid?: string
}

export interface OpponentSearchUser {
  id: number
  name: string
  school: string
  avatar: string | null
}

export interface BattleInvitation {
  uuid: string
  sender_name: string
  sender_school: string
}

export interface LobbySubject {
  id: number
  name: string
  icon: string | null
  colour: string
  core: boolean
}

export interface LobbyPkskDomain {
  id: number
  name: string
  icon: string
  colour: string
}

/** #15 `GET /api/battle/lobby`. */
export interface BattleLobby {
  grade: number | null
  gradeLabel: string
  spmUnlocked: boolean
  subjects: LobbySubject[]
  pkskDomains: LobbyPkskDomain[]
  spmSubjects?: { id: number; name: string }[]
}

export interface ArenaQuestion {
  id: number
  text: string
  options: { id: number; label: string; text: string }[]
}

/** #16 `GET /api/battle/arena/{uuid}` (PROVISIONAL). */
export interface ArenaView {
  uuid: string
  status: BattleStatus
  you: 'A' | 'B'
  players: { A: { name: string; school: string }; B: { name: string; school: string } }
  scores: { A: number; B: number }
  index: number
  total: number
  question: ArenaQuestion | null
  secondsLeft: number
  result?: { winner: Winner; scoreA: number; scoreB: number }
}

export interface ArenaAnswerBody {
  questionId: number
  optionId: number | null
  seconds: number
}

/** #17 (PROVISIONAL). */
export interface ArenaAnswerResult {
  correct: boolean
  correctOptionId: number
  points: number
  you: { score: number }
  opponent: { answered: true; correct: boolean; score: number }
  next?: ArenaQuestion | null
  result?: { winner: Winner; scoreA: number; scoreB: number }
}

export interface StudentStanding {
  rank: number
  userId: number
  name: string
  school: string
  menang: number
  seri: number
  kalah: number
  ketepatan: number
  streak: number
  skor: number
}

export interface SchoolStanding {
  rank: number
  schoolId: number
  name: string
  state: string
  type: string
  battles: number
  menang: number
  seri: number
  kalah: number
  ketepatan: number
  pelajar: number
  skor: number
}

/** #19. `activePeriod` is `null` for an unknown `period` (no pill active). */
export interface SchoolStandingsResult {
  activePeriod: StandingPeriod | null
  rows: SchoolStanding[]
  podium: { column: 1 | 2 | 3; schoolId: number; name: string; state: string; skor: number }[]
}

/** A battle row of S4 "Battle Terkini" and S5 (`createdAt` ISO; the page formats the relative time). */
export interface BattleListRow {
  uuid: string
  playerA: { id: number; name: string; homeHere: boolean }
  scoreA: number
  scoreB: number
  playerB: { id: number; name: string }
  winner: Winner
  createdAt: string
}

export interface StandingBox {
  rank: number
  battles: number
  menang: number
  seri: number
  kalah: number
  skor: number
}

/** #20 `GET /api/battle/schools/{id}`. */
export interface SchoolDetail {
  school: { id: number; name: string; ppd: string | null; state: string; type: string }
  allTime: { battles: number; menang: number; ketepatan: number; pelajar: number }
  week: StandingBox | null
  month: StandingBox | null
  fighters: { userId: number; name: string; skor: number }[]
  recent: BattleListRow[]
}

export type TournamentStatus = 'registration' | 'ongoing'

/** #1 element (the body is a bare array). */
export interface TournamentActive {
  uuid: string
  title: string
  status: TournamentStatus
  live_match: { school_a: string; school_b: string } | null
}

export interface TournamentListItem {
  uuid: string
  title: string
  status: TournamentStatus
}

export interface TournamentFormOptions {
  educationLevels: { id: string; name: string }[]
  subjects: { id: number; name: string; code: string }[]
  examPapers: { id: number; name: string }[]
  spmCounts: Record<string, number>
}

/** Body of #44 (S24 fields, live names). */
export interface TournamentBody {
  title: string
  description?: string
  education_level_id: string
  format: 'single_match' | 'knockout' | 'league' | 'hybrid'
  groups_count?: number
  question_mode: 'subject' | 'exam_paper' | 'random_mix'
  subject_id?: number
  exam_paper_id?: number
  mixed_subject_ids?: number[]
  total_questions: number
  time_window_minutes: number
  top_n_scoring: number
  min_participants: number
  registration_opens_at?: string
  registration_closes_at?: string
  action: 'draft' | 'open_registration'
}

/** #45 (PROVISIONAL). */
export interface TournamentDetail {
  uuid: string
  title: string
  description: string
  status: 'draft' | 'registration' | 'ongoing' | 'completed'
  educationLevelId: string
  format: TournamentBody['format']
  groupsCount: number | null
  questionMode: TournamentBody['question_mode']
  subjectId: number | null
  examPaperId: number | null
  mixedSubjectIds: number[]
  totalQuestions: number
  timeWindowMinutes: number
  topNScoring: number
  minParticipants: number
  registrationOpensAt: string | null
  registrationClosesAt: string | null
  liveMatch: { schoolA: string; schoolB: string } | null
  createdAt: string
}

export type LeagueStatus = 'upcoming' | 'ongoing' | 'ended'

export interface LeagueCard {
  id: number
  name: string
  status: LeagueStatus
  statusLabel: string
  scopeLabel: string
  typeLabel: string
  subjectName: string | null
  startDate: string
  endDate: string
  schools: number
}

export interface LeagueStandingRow {
  rank: number
  schoolId: number
  name: string
  ppdState: string
  peserta: number
  skor: number
  purata: number
}

export interface LeagueDetail extends Omit<LeagueCard, 'schools'> {
  scoringLabel: string
  creatorName: string
  classLevels: string[]
  inviteCode: string
  shareUrl: string
  canJoin: boolean
  schools: { id: number; name: string }[]
  /** One entry per class level that has standings. */
  standings: Record<string, LeagueStandingRow[]>
}

/** Body of #47 (S26 fields, live names). */
export interface LeagueBody {
  name: string
  type: 'friendly' | 'tournament' | 'league'
  scope: 'school' | 'district' | 'state' | 'national'
  subject_id?: number | null
  game_mode: 'mixed' | 'quiz' | 'multiplayer'
  class_levels?: string[]
  scoring_method: 'total_score' | 'avg_accuracy' | 'wins'
  start_date: string
  end_date: string
  max_schools?: number | null
}

/** #50. `rows: []` is the empty state. */
export interface SekolahBersaingResult {
  weekStart: string
  count: number
  rows: {
    rank: number
    schoolName: string
    state: string
    aktifPct: number
    streakAvg: number
    notaPer10: number
    anonymous: boolean
  }[]
}
