import { describe, expect, it } from 'vitest'

import { ErrorBodySchema } from '../../common/error'
import { buildOpenApiDocument } from '../../openapi'
import { BATTLE_COMPONENT_SCHEMAS, BATTLE_TAGS } from '../paths'
import {
  BATTLE_MESSAGES,
  BATTLE_RULES,
  BattleAcceptChallengerResponseSchema,
  BattleAnswerRequestSchema,
  BattleAnswerResultSchema,
  BattleArenaQuestionSchema,
  BattleArenaViewSchema,
  BattleEmptyBodySchema,
  BattleInvitationsResponseSchema,
  BattleInviteAcceptResponseSchema,
  BattleInviteRequestSchema,
  BattleListRowSchema,
  BattleLobbySchema,
  BattlePollChallengerResponseSchema,
  BattlePollMatchResponseSchema,
  BattleRawErrorSchema,
  BattleSchoolDetailSchema,
  BattleSchoolStandingsResultSchema,
  BattleSearchResponseSchema,
  BattleStartRequestSchema,
  BattleStartResponseSchema,
  BattleStudentStandingSchema,
  BattleSuccessSchema,
  BattleTournamentActiveSchema,
  BattleTournamentCreateRequestSchema,
  BattleTournamentCreatedSchema,
  BattleTournamentDetailSchema,
  BattleTournamentFormOptionsSchema,
  BattleTournamentListItemSchema,
  battleArenaPoints,
  battleLocalDateTimeKey,
  battleWinner,
} from '../schema'

const AT = '2026-10-16T09:30:00+08:00'

// Mock-shaped payloads (ids as strings, fictitious names).
const question = {
  id: '5001',
  text: 'Berapakah 7 x 8?',
  options: [
    { id: 0, label: 'A', text: '54' },
    { id: 1, label: 'B', text: '56' },
    { id: 2, label: 'C', text: '58' },
    { id: 3, label: 'D', text: '64' },
  ],
}
const activeArena = {
  uuid: 'b1',
  status: 'active',
  you: 'A',
  players: { A: { name: 'Aina Contoh', school: 'SMK Contoh' }, B: { name: 'Budi Ujian', school: 'SMK Ujian' } },
  scores: { A: 0, B: 0 },
  index: 1,
  total: 10,
  question,
  secondsLeft: 15,
}
const finishedArena = {
  ...activeArena,
  status: 'finished',
  question: null,
  secondsLeft: 0,
  result: { winner: 'A', scoreA: 5200, scoreB: 4800 },
}
const answerNext = {
  correct: true,
  correctOptionId: 1,
  points: 833,
  you: { score: 833 },
  opponent: { answered: true, correct: false, score: 0 },
  next: { ...question, id: '5002' },
}
const standing = {
  rank: 1,
  userId: '21',
  name: 'Aina Contoh',
  school: 'SMK Contoh',
  menang: 3,
  seri: 1,
  kalah: 0,
  ketepatan: 72,
  streak: 3,
  skor: 120,
}
const row = {
  uuid: 'b9',
  playerA: { id: '21', name: 'Aina Contoh', homeHere: true },
  scoreA: 5200,
  scoreB: 4800,
  playerB: { id: '22', name: 'Budi Ujian' },
  winner: 'A',
  createdAt: AT,
}
const tournamentBody = {
  title: 'Piala Contoh',
  description: 'Pertandingan sekolah',
  education_level_id: 'spm',
  format: 'hybrid',
  groups_count: 4,
  question_mode: 'subject',
  subject_id: '3',
  total_questions: 40,
  time_window_minutes: 60,
  top_n_scoring: 20,
  min_participants: 10,
  registration_opens_at: '2026-11-01T08:00',
  registration_closes_at: '2026-11-08T17:30',
  action: 'open_registration',
}
const detail = {
  uuid: 't1',
  title: 'Piala Contoh',
  description: '',
  status: 'registration',
  educationLevelId: 'spm',
  format: 'hybrid',
  groupsCount: 4,
  questionMode: 'subject',
  subjectId: '3',
  examPaperId: null,
  mixedSubjectIds: [],
  totalQuestions: 40,
  timeWindowMinutes: 60,
  topNScoring: 20,
  minParticipants: 10,
  registrationOpensAt: '2026-11-01T08:00:00+08:00',
  registrationClosesAt: null,
  liveMatch: null,
  createdAt: AT,
}

describe('queue and matchmaking (raw)', () => {
  it('parses start bodies of the three question types and strips nothing needed', () => {
    expect(BattleStartRequestSchema.safeParse({ question_type: 'biasa', open_to_all: false, subject_id: '3' }).success).toBe(true)
    expect(BattleStartRequestSchema.safeParse({ question_type: 'pksk', pksk_domain_id: '4', pksk_target_level: 'T4' }).success).toBe(true)
    expect(BattleStartRequestSchema.safeParse({ question_type: 'spm', open_to_all: true, subject_id: '3' }).success).toBe(true)
  })

  it('rejects a start body missing the fields of its type, a bad level, a numeric id or an unknown type', () => {
    expect(BattleStartRequestSchema.safeParse({ question_type: 'biasa' }).success).toBe(false)
    expect(BattleStartRequestSchema.safeParse({ question_type: 'pksk', pksk_domain_id: '4' }).success).toBe(false)
    expect(BattleStartRequestSchema.safeParse({ question_type: 'pksk', pksk_domain_id: '4', pksk_target_level: 'T2' }).success).toBe(false)
    expect(BattleStartRequestSchema.safeParse({ question_type: 'biasa', subject_id: 3 }).success).toBe(false)
    expect(BattleStartRequestSchema.safeParse({ question_type: 'campuran', subject_id: '3' }).success).toBe(false)
    expect(BattleStartRequestSchema.safeParse({ subject_id: '3' }).success).toBe(false)
  })

  it('answers the queue id as a string; 422 and 403 of M16-02/03 are the empty body', () => {
    expect(BattleStartResponseSchema.safeParse({ queue_id: '17' }).success).toBe(true)
    expect(BattleStartResponseSchema.safeParse({ queue_id: 17 }).success).toBe(false)
    expect(BattleEmptyBodySchema.safeParse({}).success).toBe(true)
    expect(BattleEmptyBodySchema.safeParse({ error: BATTLE_MESSAGES.typeInvalid }).success).toBe(false)
  })

  it('parses every poll-match state and never an id of the challenger', () => {
    for (const status of ['waiting', 'expired', 'not_found']) {
      expect(BattlePollMatchResponseSchema.safeParse({ status }).success).toBe(true)
    }
    expect(BattlePollMatchResponseSchema.safeParse({ status: 'matched', battle_uuid: 'b1' }).success).toBe(true)
    const incoming = { status: 'incoming_challenge', challenger: { name: 'Budi Ujian', grade_label: 'Tingkatan 4', school: 'SMK Ujian' } }
    expect(BattlePollMatchResponseSchema.safeParse(incoming).success).toBe(true)
    expect(
      BattlePollMatchResponseSchema.safeParse({ ...incoming, challenger: { ...incoming.challenger, userId: '22' } }).success,
    ).toBe(false)
    expect(BattlePollMatchResponseSchema.safeParse({ status: 'matched' }).success).toBe(false)
    expect(BattlePollMatchResponseSchema.safeParse({ status: 'waiting', battle_uuid: 'b1' }).success).toBe(false)
    expect(BattlePollMatchResponseSchema.safeParse({ status: 'error' }).success).toBe(false)
  })

  it('parses accept, reject and poll-challenger answers', () => {
    expect(BattleAcceptChallengerResponseSchema.safeParse({ matched: true, battle_uuid: 'b1' }).success).toBe(true)
    expect(BattleAcceptChallengerResponseSchema.safeParse({ matched: false, battle_uuid: 'b1' }).success).toBe(false)
    expect(BattleSuccessSchema.safeParse({ success: true }).success).toBe(true)
    expect(BattleSuccessSchema.safeParse({ success: false }).success).toBe(false)
    for (const status of ['waiting', 'rejected', 'expired', 'not_found']) {
      expect(BattlePollChallengerResponseSchema.safeParse({ status }).success).toBe(true)
    }
    expect(BattlePollChallengerResponseSchema.safeParse({ status: 'matched', battle_uuid: 'b1' }).success).toBe(true)
    expect(BattlePollChallengerResponseSchema.safeParse({ status: 'matched' }).success).toBe(false)
  })

  it('carries the raw error bodies of M16-04 to M16-14 with the BM texts of the mock', () => {
    for (const text of [
      BATTLE_MESSAGES.queueNotFound,
      BATTLE_MESSAGES.joinFailed,
      BATTLE_MESSAGES.noOpponent,
      BATTLE_MESSAGES.invitationNotFound,
      BATTLE_MESSAGES.battleNotFound,
      BATTLE_MESSAGES.battleOver,
      BATTLE_MESSAGES.receiverInvalid,
      BATTLE_MESSAGES.spmOnly,
    ]) {
      expect(BattleRawErrorSchema.safeParse({ error: text }).success).toBe(true)
    }
    expect(BATTLE_MESSAGES.queueNotFound).toBe('Giliran tidak dijumpai.')
    expect(BATTLE_MESSAGES.joinFailed).toBe('Ralat menghantar permohonan.')
    expect(BATTLE_MESSAGES.spmOnly).toBe('Khas untuk pelajar Tingkatan 4 & 5 sahaja.')
    // The raw error is not the standard ErrorBody, and the reverse.
    expect(BattleRawErrorSchema.safeParse({ error: { code: 'NOT_FOUND', message: 'x' } }).success).toBe(false)
    expect(ErrorBodySchema.safeParse({ error: BATTLE_MESSAGES.queueNotFound }).success).toBe(false)
  })
})

describe('invitations (raw)', () => {
  it('parses search results: at most 10, display fields only', () => {
    const user = { id: '22', name: 'Budi Ujian', school: 'SMK Ujian', avatar: null }
    expect(BattleSearchResponseSchema.safeParse({ users: [] }).success).toBe(true)
    expect(BattleSearchResponseSchema.safeParse({ users: [user, { ...user, id: '23', avatar: '/a.png' }] }).success).toBe(true)
    expect(BattleSearchResponseSchema.safeParse({ users: Array(11).fill(user) }).success).toBe(false)
    expect(BattleSearchResponseSchema.safeParse({ users: [{ ...user, email: 'x@example.test' }] }).success).toBe(false)
    expect(BattleSearchResponseSchema.safeParse({ users: [{ ...user, ic: '010101-01-0101' }] }).success).toBe(false)
    expect(BattleSearchResponseSchema.safeParse({ users: [{ ...user, id: 22 }] }).success).toBe(false)
  })

  it('parses invite bodies: start body plus receiver_id', () => {
    expect(BattleInviteRequestSchema.safeParse({ question_type: 'biasa', subject_id: '3', receiver_id: '22' }).success).toBe(true)
    expect(
      BattleInviteRequestSchema.safeParse({ question_type: 'pksk', pksk_domain_id: '4', pksk_target_level: 'T1', receiver_id: '22' }).success,
    ).toBe(true)
    expect(BattleInviteRequestSchema.safeParse({ question_type: 'biasa', subject_id: '3' }).success).toBe(false)
    expect(BattleInviteRequestSchema.safeParse({ question_type: 'biasa', subject_id: '3', receiver_id: 22 }).success).toBe(false)
  })

  it('parses the invitation list and the accept answer', () => {
    const inv = { uuid: 'i1', sender_name: 'Aina Contoh', sender_school: 'SMK Contoh' }
    expect(BattleInvitationsResponseSchema.safeParse({ invitations: [inv] }).success).toBe(true)
    expect(BattleInvitationsResponseSchema.safeParse({ invitations: [{ ...inv, sender_id: '21' }] }).success).toBe(false)
    expect(BattleInviteAcceptResponseSchema.safeParse({ success: true, battle_uuid: 'b1' }).success).toBe(true)
    expect(BattleInviteAcceptResponseSchema.safeParse({ success: true }).success).toBe(false)
  })
})

describe('lobby', () => {
  const lobby = {
    grade: 10,
    gradeLabel: 'Tingkatan 4',
    spmUnlocked: true,
    subjects: [{ id: '1', name: 'Matematik', icon: 'calculator', colour: '#2563eb', core: true }],
    pkskDomains: [{ id: '2', name: 'Kejujuran', icon: 'heart', colour: '#16a34a' }],
    spmSubjects: [{ id: '1', name: 'Matematik' }],
  }

  it('parses the unlocked and the locked lobby', () => {
    expect(BattleLobbySchema.safeParse(lobby).success).toBe(true)
    expect(BattleLobbySchema.safeParse({ ...lobby, grade: 4, gradeLabel: 'Darjah 4', spmUnlocked: false, spmSubjects: undefined }).success).toBe(true)
    expect(BattleLobbySchema.safeParse({ ...lobby, grade: null, gradeLabel: '', spmUnlocked: false, spmSubjects: undefined }).success).toBe(true)
  })

  it('requires spmSubjects exactly when spmUnlocked', () => {
    expect(BattleLobbySchema.safeParse({ ...lobby, spmSubjects: undefined }).success).toBe(false)
    expect(BattleLobbySchema.safeParse({ ...lobby, spmUnlocked: false }).success).toBe(false)
  })
})

describe('arena', () => {
  it('parses an active and a finished arena', () => {
    expect(BattleArenaViewSchema.safeParse(activeArena).success).toBe(true)
    expect(BattleArenaViewSchema.safeParse(finishedArena).success).toBe(true)
    expect(BattleArenaViewSchema.safeParse({ ...finishedArena, result: { winner: null, scoreA: 4000, scoreB: 4000 } }).success).toBe(true)
  })

  it('keeps the state rules: active has a question, 15 s and no result; others the reverse', () => {
    expect(BattleArenaViewSchema.safeParse({ ...activeArena, question: null }).success).toBe(false)
    expect(BattleArenaViewSchema.safeParse({ ...activeArena, secondsLeft: 0 }).success).toBe(false)
    expect(BattleArenaViewSchema.safeParse({ ...activeArena, result: finishedArena.result }).success).toBe(false)
    expect(BattleArenaViewSchema.safeParse({ ...finishedArena, result: undefined }).success).toBe(false)
    expect(BattleArenaViewSchema.safeParse({ ...finishedArena, question }).success).toBe(false)
    expect(BattleArenaViewSchema.safeParse({ ...finishedArena, secondsLeft: 15 }).success).toBe(false)
    expect(BattleArenaViewSchema.safeParse({ ...activeArena, index: 11 }).success).toBe(false)
    expect(BattleArenaViewSchema.safeParse({ ...activeArena, total: 12 }).success).toBe(false)
    expect(BattleArenaViewSchema.safeParse({ ...activeArena, status: 'waiting' }).success).toBe(false)
  })

  it('never leaks an answer key before answering: the question schema is strict', () => {
    expect(BattleArenaQuestionSchema.safeParse(question).success).toBe(true)
    for (const key of ['correctOptionId', 'correct', 'answer', 'isCorrect', 'explanation', 'answerKey']) {
      expect(BattleArenaQuestionSchema.safeParse({ ...question, [key]: 1 }).success, key).toBe(false)
      const opts = question.options.map((o, i) => (i === 1 ? { ...o, [key]: true } : o))
      expect(BattleArenaQuestionSchema.safeParse({ ...question, options: opts }).success, `option ${key}`).toBe(false)
      expect(BattleArenaViewSchema.safeParse({ ...activeArena, question: { ...question, [key]: 1 } }).success, `view ${key}`).toBe(false)
    }
    expect(BattleArenaViewSchema.safeParse({ ...activeArena, correctOptionId: 1 }).success).toBe(false)
  })

  it('declares no key property in the generated question and view components', () => {
    const doc = buildOpenApiDocument() as { components: { schemas: Record<string, { properties?: Record<string, unknown>; additionalProperties?: unknown }> } }
    for (const name of ['BattleArenaQuestion', 'BattleArenaOption', 'BattleArenaView']) {
      const schema = doc.components.schemas[name]
      expect(schema, name).toBeDefined()
      expect(schema?.additionalProperties, name).toBe(false)
      for (const forbidden of ['correctOptionId', 'correct', 'answer', 'isCorrect', 'answerKey', 'explanation']) {
        expect(Object.keys(schema?.properties ?? {}), `${name}.${forbidden}`).not.toContain(forbidden)
      }
    }
  })

  it('validates the answer body: id string, option 0..3 or null, seconds 0..15', () => {
    expect(BattleAnswerRequestSchema.safeParse({ questionId: '5001', optionId: 1, seconds: 4 }).success).toBe(true)
    expect(BattleAnswerRequestSchema.safeParse({ questionId: '5001', optionId: null, seconds: 15 }).success).toBe(true)
    expect(BattleAnswerRequestSchema.safeParse({ questionId: '5001', seconds: 0 }).success).toBe(true)
    expect(BattleAnswerRequestSchema.safeParse({ questionId: '5001', optionId: 3, seconds: 7.5 }).success).toBe(true)
    expect(BattleAnswerRequestSchema.safeParse({ questionId: 5001, optionId: 1, seconds: 4 }).success).toBe(false)
    expect(BattleAnswerRequestSchema.safeParse({ questionId: '5001', optionId: 4, seconds: 4 }).success).toBe(false)
    expect(BattleAnswerRequestSchema.safeParse({ questionId: '5001', optionId: -1, seconds: 4 }).success).toBe(false)
    expect(BattleAnswerRequestSchema.safeParse({ questionId: '5001', optionId: 1.5, seconds: 4 }).success).toBe(false)
    expect(BattleAnswerRequestSchema.safeParse({ questionId: '5001', optionId: 1, seconds: 16 }).success).toBe(false)
    expect(BattleAnswerRequestSchema.safeParse({ questionId: '5001', optionId: 1, seconds: -1 }).success).toBe(false)
    expect(BattleAnswerRequestSchema.safeParse({ optionId: 1, seconds: 4 }).success).toBe(false)
  })

  it('parses an answer result with next, or with result after question 10, never both or neither', () => {
    expect(BattleAnswerResultSchema.safeParse(answerNext).success).toBe(true)
    const last = { ...answerNext, next: undefined, result: { winner: 'B', scoreA: 0, scoreB: 0 } }
    expect(BattleAnswerResultSchema.safeParse(last).success).toBe(true)
    expect(BattleAnswerResultSchema.safeParse({ ...answerNext, result: last.result }).success).toBe(false)
    expect(BattleAnswerResultSchema.safeParse({ ...answerNext, next: undefined }).success).toBe(false)
    expect(BattleAnswerResultSchema.safeParse({ ...answerNext, opponent: { answered: false, correct: true, score: 1 } }).success).toBe(false)
    expect(BattleAnswerResultSchema.safeParse({ ...answerNext, next: { ...question, correctOptionId: 2 } }).success).toBe(false)
  })

  it('carries the validation errors of the arena in the standard body with fields', () => {
    for (const [field, message] of [
      ['questionId', BATTLE_MESSAGES.questionInvalid],
      ['optionId', BATTLE_MESSAGES.answerInvalid],
      ['seconds', BATTLE_MESSAGES.timeInvalid],
    ] as const) {
      const body = { error: { code: 'VALIDATION_ERROR', message, fields: { [field]: message } } }
      expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    }
    expect(BATTLE_MESSAGES.questionInvalid).toBe('Soalan tidak sah.')
    expect(BATTLE_MESSAGES.answerInvalid).toBe('Jawapan tidak sah.')
    expect(BATTLE_MESSAGES.timeInvalid).toBe('Masa tidak sah.')
    expect(BATTLE_MESSAGES.battleOver).toBe('Battle sudah tamat.')
  })
})

describe('rules', () => {
  it('scores a correct answer as 1000 - round(500 * s / 15) with s clamped to 0..15', () => {
    expect(battleArenaPoints(0)).toBe(1000)
    expect(battleArenaPoints(3)).toBe(900)
    expect(battleArenaPoints(7.9)).toBe(767)
    expect(battleArenaPoints(15)).toBe(500)
    expect(battleArenaPoints(40)).toBe(500)
    expect(battleArenaPoints(-5)).toBe(1000)
  })

  it('picks the winner: higher total, draw when equal and non-zero, 0-0 is player B', () => {
    expect(battleWinner(10, 5)).toBe('A')
    expect(battleWinner(5, 10)).toBe('B')
    expect(battleWinner(700, 700)).toBeNull()
    expect(battleWinner(0, 0)).toBe('B')
  })

  it('fixes the simulation constants of the mock', () => {
    expect(BATTLE_RULES.matchOnPoll).toBe(3)
    expect(BATTLE_RULES.queueExpiresSeconds).toBe(120)
    expect(BATTLE_RULES.queueAbandonedSeconds).toBe(10)
    expect(BATTLE_RULES.invitationExpiresHours).toBe(24)
    expect(BATTLE_RULES.arenaQuestions).toBe(10)
    expect(BATTLE_RULES.questionSeconds).toBe(15)
  })
})

describe('standings and history', () => {
  it('parses a student standing without any internal or personal field', () => {
    expect(BattleStudentStandingSchema.safeParse(standing).success).toBe(true)
    expect(BattleStudentStandingSchema.safeParse({ ...standing, schoolId: '8106' }).success).toBe(false)
    expect(BattleStudentStandingSchema.safeParse({ ...standing, email: 'a@example.test' }).success).toBe(false)
    expect(BattleStudentStandingSchema.safeParse({ ...standing, userId: 21 }).success).toBe(false)
    expect(BattleStudentStandingSchema.safeParse({ ...standing, ketepatan: 101 }).success).toBe(false)
  })

  it('parses school standings with activePeriod null and a podium of at most 3', () => {
    const school = {
      rank: 1, schoolId: '8106', name: 'SMK Contoh', state: 'Selangor', type: 'SMK',
      battles: 12, menang: 7, seri: 1, kalah: 4, ketepatan: 64, pelajar: 9, skor: 410,
    }
    const podium = { column: 1, schoolId: '8106', name: 'SMK Contoh', state: 'Selangor', skor: 410 }
    const ok = { activePeriod: 'weekly', rows: [school], podium: [podium] }
    expect(BattleSchoolStandingsResultSchema.safeParse(ok).success).toBe(true)
    expect(BattleSchoolStandingsResultSchema.safeParse({ ...ok, activePeriod: null }).success).toBe(true)
    expect(BattleSchoolStandingsResultSchema.safeParse({ ...ok, activePeriod: 'yearly' }).success).toBe(false)
    expect(BattleSchoolStandingsResultSchema.safeParse({ ...ok, podium: Array(4).fill(podium) }).success).toBe(false)
    expect(BattleSchoolStandingsResultSchema.safeParse({ ...ok, podium: [{ ...podium, column: 4 }] }).success).toBe(false)
  })

  it('parses the history row with an +08:00 timestamp and a draw', () => {
    expect(BattleListRowSchema.safeParse(row).success).toBe(true)
    expect(BattleListRowSchema.safeParse({ ...row, winner: null }).success).toBe(true)
    expect(BattleListRowSchema.safeParse({ ...row, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
    expect(BattleListRowSchema.safeParse({ ...row, winner: 'C' }).success).toBe(false)
    expect(BattleListRowSchema.safeParse({ ...row, playerB: { id: '22', name: 'Budi Ujian', homeHere: false } }).success).toBe(false)
  })

  it('parses the school page: top 5 fighters, 10 recent, week and month may be null', () => {
    const box = { rank: 2, battles: 5, menang: 3, seri: 0, kalah: 2, skor: 150 }
    const page = {
      school: { id: '8106', name: 'SMK Contoh', ppd: null, state: 'Selangor', type: 'SMK' },
      allTime: { battles: 12, menang: 7, ketepatan: 64, pelajar: 9 },
      week: box,
      month: null,
      fighters: [{ userId: '21', name: 'Aina Contoh', skor: 120 }],
      recent: [row],
    }
    expect(BattleSchoolDetailSchema.safeParse(page).success).toBe(true)
    expect(BattleSchoolDetailSchema.safeParse({ ...page, fighters: Array(6).fill(page.fighters[0]) }).success).toBe(false)
    expect(BattleSchoolDetailSchema.safeParse({ ...page, recent: Array(11).fill(row) }).success).toBe(false)
    expect(BattleSchoolDetailSchema.safeParse({ ...page, school: { ...page.school, id: 8106 } }).success).toBe(false)
  })

  it('carries the 404 of an unknown school', () => {
    const body = { error: { code: 'NOT_FOUND', message: BATTLE_MESSAGES.schoolNotFound } }
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    expect(BATTLE_MESSAGES.schoolNotFound).toBe('Sekolah tidak dijumpai.')
  })
})

describe('tournaments', () => {
  it('parses the banner array element with snake_case live_match', () => {
    const t = { uuid: 't1', title: 'Piala Contoh', status: 'registration', live_match: null }
    expect(BattleTournamentActiveSchema.safeParse(t).success).toBe(true)
    expect(BattleTournamentActiveSchema.safeParse({ ...t, status: 'ongoing', live_match: { school_a: 'SMK Contoh', school_b: 'SMK Ujian' } }).success).toBe(true)
    expect(BattleTournamentActiveSchema.safeParse({ ...t, status: 'draft' }).success).toBe(false)
    expect(BattleTournamentActiveSchema.safeParse({ ...t, status: 'completed' }).success).toBe(false)
    expect(BattleTournamentActiveSchema.safeParse({ ...t, live_match: { schoolA: 'a', schoolB: 'b' } }).success).toBe(false)
    expect(BattleTournamentListItemSchema.safeParse({ uuid: 't1', title: 'Piala Contoh', status: 'ongoing' }).success).toBe(true)
  })

  it('parses form options', () => {
    const options = {
      educationLevels: [
        { id: 'tingkatan4', name: 'Tingkatan 4' },
        { id: 'tingkatan5', name: 'Tingkatan 5' },
        { id: 'spm', name: 'SPM (Tingkatan 4 & 5)' },
      ],
      subjects: [{ id: '3', name: 'Bahasa Inggeris', code: 'BI' }],
      examPapers: [],
      spmCounts: { BM: 25, BI: 40 },
    }
    expect(BattleTournamentFormOptionsSchema.safeParse(options).success).toBe(true)
    expect(BattleTournamentFormOptionsSchema.safeParse({ ...options, educationLevels: [{ id: 'tingkatan1', name: 'x' }] }).success).toBe(false)
  })

  it('parses a create body and rejects each out-of-range number', () => {
    expect(BattleTournamentCreateRequestSchema.safeParse(tournamentBody).success).toBe(true)
    const bad = (patch: Record<string, unknown>) => BattleTournamentCreateRequestSchema.safeParse({ ...tournamentBody, ...patch }).success
    expect(bad({ total_questions: 4 })).toBe(false)
    expect(bad({ total_questions: 101 })).toBe(false)
    expect(bad({ time_window_minutes: 9 })).toBe(false)
    expect(bad({ time_window_minutes: 181 })).toBe(false)
    expect(bad({ top_n_scoring: 0 })).toBe(false)
    expect(bad({ top_n_scoring: 51 })).toBe(false)
    expect(bad({ min_participants: 0 })).toBe(false)
    expect(bad({ min_participants: 101 })).toBe(false)
    expect(bad({ groups_count: 1 })).toBe(false)
    expect(bad({ groups_count: 9 })).toBe(false)
    expect(bad({ total_questions: 5, time_window_minutes: 10, top_n_scoring: 1, min_participants: 1, groups_count: 2 })).toBe(true)
    expect(bad({ total_questions: 100, time_window_minutes: 180, top_n_scoring: 50, min_participants: 100, groups_count: 8 })).toBe(true)
  })

  it('applies the cross-field rules of the mock', () => {
    const bad = (patch: Record<string, unknown>) => BattleTournamentCreateRequestSchema.safeParse({ ...tournamentBody, ...patch }).success
    expect(bad({ title: '   ' })).toBe(false)
    expect(bad({ title: 'x'.repeat(256) })).toBe(false)
    expect(bad({ title: 'x'.repeat(255) })).toBe(true)
    expect(bad({ education_level_id: 'tingkatan1' })).toBe(false)
    expect(bad({ format: 'ladder' })).toBe(false)
    expect(bad({ action: 'publish' })).toBe(false)
    // groups_count is required for league and hybrid only.
    expect(bad({ groups_count: undefined })).toBe(false)
    expect(bad({ format: 'league', groups_count: undefined })).toBe(false)
    expect(bad({ format: 'knockout', groups_count: undefined })).toBe(true)
    expect(bad({ format: 'single_match', groups_count: undefined })).toBe(true)
    // Question source.
    expect(bad({ subject_id: undefined })).toBe(false)
    expect(bad({ question_mode: 'random_mix', subject_id: undefined, mixed_subject_ids: ['1', '3'] })).toBe(true)
    expect(bad({ question_mode: 'random_mix', subject_id: undefined, mixed_subject_ids: [] })).toBe(false)
    expect(bad({ question_mode: 'random_mix', subject_id: undefined })).toBe(false)
    expect(bad({ question_mode: 'exam_paper', subject_id: undefined, exam_paper_id: '1' })).toBe(false)
    expect(bad({ subject_id: 3 })).toBe(false)
  })

  it('validates local dates: YYYY-MM-DDTHH:mm, "" is none, close not before open', () => {
    const bad = (patch: Record<string, unknown>) => BattleTournamentCreateRequestSchema.safeParse({ ...tournamentBody, ...patch }).success
    expect(bad({ registration_opens_at: undefined, registration_closes_at: undefined })).toBe(true)
    expect(bad({ registration_opens_at: '', registration_closes_at: '' })).toBe(true)
    expect(bad({ registration_opens_at: '2026-02-30T08:00' })).toBe(false)
    expect(bad({ registration_opens_at: '2026-11-01 08:00' })).toBe(false)
    expect(bad({ registration_opens_at: '2026-11-01T25:00' })).toBe(false)
    expect(bad({ registration_closes_at: '2026-10-31T08:00' })).toBe(false)
    expect(bad({ registration_closes_at: '2026-11-01T08:00' })).toBe(true)
    expect(battleLocalDateTimeKey('2026-11-01T08:00')).toBeLessThan(battleLocalDateTimeKey('2026-11-01T08:01'))
    expect(battleLocalDateTimeKey('nope')).toBeNaN()
  })

  it('carries the validation error of a create with several fields', () => {
    const body = {
      error: {
        code: 'VALIDATION_ERROR',
        message: BATTLE_MESSAGES.titleRequired,
        fields: { title: BATTLE_MESSAGES.titleRequired, total_questions: BATTLE_MESSAGES.outOfRange },
      },
    }
    expect(ErrorBodySchema.safeParse(body).success).toBe(true)
    expect(BATTLE_MESSAGES.outOfRange).toBe('Nilai di luar julat.')
    expect(BATTLE_MESSAGES.closeBeforeOpen).toBe('Tarikh tutup mesti selepas tarikh buka.')
    expect(BATTLE_MESSAGES.tournamentNotFound).toBe('Tournament tidak dijumpai.')
  })

  it('parses the created and detail bodies, camelCase, examPaperId always null', () => {
    expect(BattleTournamentCreatedSchema.safeParse({ uuid: 't1', status: 'draft' }).success).toBe(true)
    expect(BattleTournamentCreatedSchema.safeParse({ uuid: 't1', status: 'registration' }).success).toBe(true)
    expect(BattleTournamentCreatedSchema.safeParse({ uuid: 't1', status: 'ongoing' }).success).toBe(false)
    expect(BattleTournamentDetailSchema.safeParse(detail).success).toBe(true)
    expect(BattleTournamentDetailSchema.safeParse({ ...detail, status: 'draft', groupsCount: null, liveMatch: { schoolA: 'a', schoolB: 'b' } }).success).toBe(true)
    expect(BattleTournamentDetailSchema.safeParse({ ...detail, examPaperId: '3' }).success).toBe(false)
    expect(BattleTournamentDetailSchema.safeParse({ ...detail, liveMatch: { school_a: 'a', school_b: 'b' } }).success).toBe(false)
    expect(BattleTournamentDetailSchema.safeParse({ ...detail, createdAt: '2026-10-16T09:30:00' }).success).toBe(false)
  })
})

describe('openapi registration', () => {
  const doc = buildOpenApiDocument() as {
    paths: Record<string, Record<string, { tags?: string[]; parameters?: { name: string; in: string }[]; responses: Record<string, unknown> }>>
    components: { schemas: Record<string, unknown> }
  }
  const ops = Object.entries(doc.paths).flatMap(([path, methods]) =>
    Object.entries(methods).map(([method, op]) => ({ path, method, op })),
  )
  const own = ops.filter(({ op }) => op.tags?.some((t) => Object.values(BATTLE_TAGS).includes(t as never)))
  const get = (method: string, path: string) => doc.paths[path]?.[method]

  const ROUTES: [string, string][] = [
    ['post', '/battle/quick-match'],
    ['post', '/battle/school-battle'],
    ['get', '/battle/poll-match/{queueId}'],
    ['post', '/battle/accept-challenger/{queueId}'],
    ['post', '/battle/reject-challenger/{queueId}'],
    ['post', '/battle/join-queue/{queueId}'],
    ['get', '/battle/poll-challenger/{queueId}'],
    ['get', '/battle/search-opponent'],
    ['post', '/battle/invite'],
    ['get', '/battle/invitations'],
    ['post', '/battle/invite/{uuid}/accept'],
    ['post', '/battle/invite/{uuid}/decline'],
    ['post', '/battle/forfeit/{uuid}'],
    ['get', '/battle/lobby'],
    ['get', '/battle/arena/{uuid}'],
    ['post', '/battle/arena/{uuid}/answer'],
    ['get', '/battle/standings/students'],
    ['get', '/battle/standings/schools'],
    ['get', '/battle/schools/{id}'],
    ['get', '/battle/history'],
    ['get', '/tournament/active'],
    ['get', '/tournaments'],
    ['get', '/tournaments/form-options'],
    ['post', '/tournaments'],
    ['get', '/tournaments/{uuid}'],
  ]

  it('registers exactly the 25 BE-44 operations under the three battle tags', () => {
    expect(own).toHaveLength(25)
    expect(ops.filter(({ op }) => op.tags?.includes(BATTLE_TAGS.battle))).toHaveLength(16)
    expect(ops.filter(({ op }) => op.tags?.includes(BATTLE_TAGS.standings))).toHaveLength(4)
    expect(ops.filter(({ op }) => op.tags?.includes(BATTLE_TAGS.tournaments))).toHaveLength(5)
    for (const [method, path] of ROUTES) expect(get(method, path), `${method} ${path}`).toBeDefined()
  })

  it('does not register the BE-45 routes (games hub, rooms, papan-bijak, leagues, sekolah-bersaing, admin games)', () => {
    const paths = Object.keys(doc.paths)
    const forbidden = paths.filter((p) => /^\/(games|papan-bijak|leagues|sekolah-bersaing|admin\/games)/.test(p))
    expect(forbidden).toEqual([])
  })

  it('every mutating operation declares the X-CSRF-Token header and a 403 CSRF response', () => {
    const mutating = own.filter(({ method }) => method !== 'get')
    expect(mutating).toHaveLength(11)
    for (const { path, method, op } of mutating) {
      const headers = (op.parameters ?? []).filter((p) => p.in === 'header').map((p) => p.name)
      expect(headers, `${method} ${path}`).toContain('X-CSRF-Token')
      expect(op.responses['403'], `${method} ${path}`).toBeDefined()
    }
    for (const { path, method, op } of own.filter(({ method }) => method === 'get')) {
      const headers = (op.parameters ?? []).filter((p) => p.in === 'header')
      expect(headers, `${method} ${path}`).toEqual([])
    }
  })

  it('every operation declares 401, and admin routes declare 403', () => {
    for (const { path, method, op } of own) expect(op.responses['401'], `${method} ${path}`).toBeDefined()
    expect(get('get', '/tournaments/form-options')?.responses['403']).toBeDefined()
    expect(get('post', '/tournaments')?.responses['201']).toBeDefined()
  })

  it('declares the empty 422/403 of M16-02 and M16-03 and the raw 4xx of the other raw routes', () => {
    const empty = { $ref: '#/components/schemas/BattleEmptyBody' }
    for (const path of ['/battle/quick-match', '/battle/school-battle']) {
      const r = get('post', path)?.responses as Record<string, { content: { 'application/json': { schema: unknown } } }>
      expect(r['422']?.content['application/json'].schema).toEqual(empty)
      expect(JSON.stringify(r['403']?.content['application/json'].schema)).toContain('BattleEmptyBody')
    }
    const forfeit = get('post', '/battle/forfeit/{uuid}')?.responses as Record<string, { content: { 'application/json': { schema: unknown } } }>
    expect(forfeit['404']?.content['application/json'].schema).toEqual({ $ref: '#/components/schemas/BattleRawError' })
    expect(forfeit['409']?.content['application/json'].schema).toEqual({ $ref: '#/components/schemas/BattleRawError' })
  })

  it('declares the bare array of the banner and the {data} envelope of the arena', () => {
    const banner = get('get', '/tournament/active')?.responses as Record<string, { content: { 'application/json': { schema: { type?: string } } } }>
    expect(banner['200']?.content['application/json'].schema.type).toBe('array')
    const arena = get('get', '/battle/arena/{uuid}')?.responses as Record<string, { content: { 'application/json': { schema: { properties?: Record<string, unknown> } } } }>
    expect(Object.keys(arena['200']?.content['application/json'].schema.properties ?? {})).toEqual(['data'])
  })

  it('contains every battle component, under its own meta id, with the Battle prefix', () => {
    for (const [name, schema] of Object.entries(BATTLE_COMPONENT_SCHEMAS)) {
      expect(doc.components.schemas, name).toHaveProperty(name)
      expect((schema as { meta(): { id?: string } }).meta().id, name).toBe(name)
      expect(name, name).toMatch(/^Battle[A-Z]/)
    }
  })

  it('keeps ids as strings in the document', () => {
    const start = doc.components.schemas.BattleStartResponse as { properties: { queue_id: { type: string } } }
    expect(start.properties.queue_id.type).toBe('string')
  })
})
