/**
 * Battle parameters, question pools and bots (SRS M16 v1.6 BR-M16-03, BR-M16-05, BR-M16-07/08).
 * Pure helpers over the owners' repositories: M04 questions (pools, grading), M03 levels, M01 users
 * (bots) and M05 platform accuracy (bot answers).
 */

import type { Prng, PrngRegistry } from '@/mock/determinism'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { curriculum } from '@/modules/m03-curriculum/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { practiceAnswers } from '@/modules/m05-practice/mock'

import { PKSK_DOMAINS } from '../data/constants'
import type { PkskLevel, QuestionType } from '../types'
import { ARENA_QUESTIONS, arenaPoints, M16Error } from './common'

export interface BattleParams {
  questionType: QuestionType
  subjectId: number | null
  pkskDomainId: number | null
  pkskTargetLevel: PkskLevel | null
  openToAll: boolean
}

type SampleFilter = Parameters<typeof questions.sampleKeyless>[0]

const isInt = (v: unknown): v is number => typeof v === 'number' && Number.isInteger(v)

/** The M03 education level of a user's grade (BR-M16-02), or null (no grade, no level). */
export function levelIdOf(user: UserRow | undefined): number | null {
  if (!user || user.grade === null) return null
  return curriculum.levelForGrade(user.grade)?.id ?? null
}

/**
 * Parses the #2 / #3 / #8 body `{question_type, open_to_all, subject_id | pksk_domain_id +
 * pksk_target_level}`. Invalid values answer 422 (BR-M16-03); an SPM battle of a viewer below
 * Tingkatan 4 answers 403.
 */
export function parseBattleParams(body: unknown, viewer: UserRow | undefined): BattleParams {
  const b = (typeof body === 'object' && body !== null ? body : {}) as Record<string, unknown>
  const type = b.question_type
  if (type !== 'biasa' && type !== 'pksk' && type !== 'spm') {
    throw new M16Error('VALIDATION_ERROR', 'Jenis soalan tidak sah.', 'question_type')
  }
  const openToAll = b.open_to_all === true
  const subject = isInt(b.subject_id) ? b.subject_id : null
  if (type === 'biasa') {
    if (subject === null || subject < 1 || subject > 31) {
      throw new M16Error('VALIDATION_ERROR', 'Subjek tidak sah.', 'subject_id')
    }
    return {
      questionType: type,
      subjectId: subject,
      pkskDomainId: null,
      pkskTargetLevel: null,
      openToAll,
    }
  }
  if (type === 'pksk') {
    const domain = isInt(b.pksk_domain_id) ? b.pksk_domain_id : null
    const level = b.pksk_target_level
    if (domain === null || domain < 1 || domain > PKSK_DOMAINS.length) {
      throw new M16Error('VALIDATION_ERROR', 'Domain PKSK tidak sah.', 'pksk_domain_id')
    }
    if (level !== 'T1' && level !== 'T4') {
      throw new M16Error('VALIDATION_ERROR', 'Tahap PKSK tidak sah.', 'pksk_target_level')
    }
    return {
      questionType: type,
      subjectId: null,
      pkskDomainId: domain,
      pkskTargetLevel: level,
      openToAll,
    }
  }
  // spm: Tingkatan 4 or 5 only.
  if (!viewer || viewer.grade === null || viewer.grade < 10) {
    throw new M16Error('FORBIDDEN', 'Khas untuk pelajar Tingkatan 4 & 5 sahaja.')
  }
  if (
    subject === null ||
    subject < 1 ||
    subject > 31 ||
    questions.spmPool({ subjectId: subject }).total === 0
  ) {
    throw new M16Error('VALIDATION_ERROR', 'Subjek tidak sah.', 'subject_id')
  }
  return {
    questionType: type,
    subjectId: subject,
    pkskDomainId: null,
    pkskTargetLevel: null,
    openToAll,
  }
}

/** The M04 draw filter of a battle (BR-M16-03): `levelId` is the queue owner's level. */
export function poolFilter(
  p: Omit<BattleParams, 'openToAll'>,
  levelId: number | null,
): SampleFilter {
  if (p.questionType === 'pksk') {
    return {
      pkskDomainId: p.pkskDomainId as number,
      pkskTargetLevel: p.pkskTargetLevel as PkskLevel,
      eligible: true,
    }
  }
  if (p.questionType === 'spm') {
    return { subjectId: p.subjectId as number, spmPool: true, questionType: 'mcq', eligible: true }
  }
  return {
    subjectId: p.subjectId as number,
    questionType: 'mcq',
    eligible: true,
    ...(levelId === null ? {} : { educationLevelIds: [levelId] }),
  }
}

/** Draws the 10 arena question ids; `null` when the pool has fewer than 10 (BR-M16-03). */
export function drawQuestionIds(
  p: Omit<BattleParams, 'openToAll'>,
  levelId: number | null,
  rng: Prng,
): number[] | null {
  const rows = questions.sampleKeyless(poolFilter(p, levelId), ARENA_QUESTIONS, rng)
  return rows.length < ARENA_QUESTIONS ? null : rows.map((r) => r.id)
}

export interface ArenaQuestion {
  id: number
  text: string
  options: { id: number; label: string; text: string }[]
}

const LABELS = ['A', 'B', 'C', 'D'] as const

/** A question as the arena serves it: no key (SEC-M16-01). */
export function arenaQuestion(id: number): ArenaQuestion | null {
  const row = questions.get(id)
  if (!row) return null
  const texts = row.pkskOptions ? row.pkskOptions.map((o) => o.text) : (row.options ?? [])
  return {
    id,
    text: row.questionText,
    options: texts.slice(0, 4).map((text, i) => ({ id: i, label: LABELS[i] ?? '', text })),
  }
}

/** Grades one arena answer (`optionId` 0-3, or `null` for a timeout). */
export function gradeArena(
  id: number,
  optionId: number | null,
): { correct: boolean; correctOptionId: number } | null {
  const row = questions.get(id)
  if (!row) return null
  if (row.pkskOptions) {
    const key = row.pkskOptions.findIndex((o) => o.isCorrect)
    return { correct: optionId !== null && optionId === key, correctOptionId: key }
  }
  const graded = questions.gradeAnswer(id, optionId ?? -1)
  if (!graded) return null
  return { correct: optionId !== null && graded.isCorrect, correctOptionId: graded.correctOptionId }
}

// --- bots (SIMULATION, BR-M16-05, BR-M16-08) ------------------------------------------------------

let botP: number | null = null

/** p = M05 platform accuracy (Q-ANS-CORRECT / Q-ANS-ALL), read once per boot, never hard-coded. */
export function botAccuracy(): number {
  if (botP === null) {
    const all = practiceAnswers.count('Q-ANS-ALL')
    botP = all > 0 ? practiceAnswers.count('Q-ANS-CORRECT') / all : 0
  }
  return botP
}

export function resetBotAccuracy(): void {
  botP = null
}

/** One simulated bot answer: seconds used (2 + 10 u) and whether it is correct (u2 < p). */
export interface BotAnswer {
  seconds: number
  correct: boolean
  points: number
}

/** The 10 bot answers of a battle, from the stream `m16:battle:<uuid>`. */
export function botAnswers(prng: PrngRegistry, battleUuid: string): BotAnswer[] {
  const rng = prng.fresh(`m16:battle:${battleUuid}`)
  const p = botAccuracy()
  return Array.from({ length: ARENA_QUESTIONS }, () => {
    const seconds = Math.min(15, Math.floor(2 + 10 * rng.next()))
    const correct = rng.next() < p
    return { seconds, correct, points: correct ? arenaPoints(seconds) : 0 }
  })
}

/**
 * A fictitious opponent from the M02 users dataset (BR-M16-05): an active student of the owner's grade
 * (any grade when `openToAll`), of another school for a school battle. Falls back to wider sets when
 * the stream draws nobody that fits.
 */
export function pickBot(
  owner: UserRow,
  mode: 'quick_match' | 'school_battle',
  openToAll: boolean,
  rng: Prng,
  exclude: ReadonlySet<number> = new Set(),
): UserRow {
  const draw = users.sample('U-ROLE-ACTIVE', 400, rng, 'student', true)
  const ok = (u: UserRow, grade: boolean, school: boolean): boolean =>
    u.id !== owner.id &&
    !exclude.has(u.id) &&
    (!grade || openToAll || owner.grade === null || u.grade === owner.grade) &&
    (!school || mode !== 'school_battle' || (u.schoolId !== null && u.schoolId !== owner.schoolId))
  const found =
    draw.find((u) => ok(u, true, true)) ??
    draw.find((u) => ok(u, false, true)) ??
    draw.find((u) => ok(u, false, false))
  if (!found) throw new M16Error('NOT_FOUND', 'Tiada lawan dijumpai.')
  return found
}
