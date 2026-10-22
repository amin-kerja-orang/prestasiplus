import type { PkskLevel, PkskQuestionStatus } from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { QUESTIONS_UNAVAILABLE } from './pksk.constants'

/**
 * Seams to the other owners (ADR-0014). PKSK questions are tags on the single question bank (BE-09), a PKSK practice
 * set is one M05 session (BE-12) and the PKSK subscription flag belongs to BE-25. None of those owners exposes the
 * methods this card needs yet (see the BE-42 report: cross-lane requests to PC-2 and PC-1/BE-25), so each seam is a port
 * with a fail-closed default; the owner's adapter replaces the default provider in `pksk.module.ts` when it lands.
 * This module never queries `questions`, `question_tags`, `practice_sessions` or `wallets` itself.
 */

// ---------------------------------------------------------------------------------------------
// Questions (BE-09 QuestionsService, PKSK-tagged: tags `pksk_domain` = domain code, `pksk_level` = T1 or T4)
// ---------------------------------------------------------------------------------------------

/** A served question: no correctness flag anywhere (SEC-M07-07). `options` is empty for a Bahagian C question. */
export interface PkskServed {
  id: string
  domainCode: string
  questionText: string
  options: { text: string }[]
}

/** Scoring facts of an approved PKSK question of one level. Server side only; never serialised. */
export interface PkskAnswerKey {
  id: string
  domainCode: string
  optionCount: number
  correctIndexes: number[]
}

export interface PkskQuestionRow {
  id: string
  questionText: string
  domainCode: string
  targetLevel: PkskLevel
  status: PkskQuestionStatus
}

export interface PkskQuestionRecord extends PkskQuestionRow {
  difficultyLevel: number | null
  explanation: string | null
  options: { text: string; isCorrect: boolean }[]
}

export interface PkskQuestionInput {
  domainCode: string
  targetLevel: PkskLevel
  status: PkskQuestionStatus
  questionText: string
  difficultyLevel: number | null
  explanation: string | null
  options: { text: string; isCorrect: boolean }[]
}

export interface PkskQuestionListFilter {
  /** Domain codes to include (a Bahagian filter is resolved to its domains by the caller); undefined = all. */
  domainCodes?: readonly string[]
  level?: PkskLevel
  status?: PkskQuestionStatus
  /** Trimmed, case-insensitive substring of the question text. */
  search?: string
  page: number
  pageSize: number
}

export interface PkskStats {
  total: number
  approved: number
  pending: number
  t1: number
  t4: number
}

/**
 * What BE-42 needs of BE-09's `QuestionsService` for questions tagged `pksk_domain` and `pksk_level`. PKSK questions
 * are excluded from the M04 lists and counts by the owner. Order of `list`: `created_at` descending, then id ascending.
 */
export interface PkskQuestionsPort {
  /** Approved questions per domain code at one level. */
  countApproved(level: PkskLevel): Promise<Record<string, number>>
  /** Every approved question of the given domains at the level, in a stable order (the caller shuffles). */
  approvedPool(level: PkskLevel, domainCodes: readonly string[]): Promise<PkskServed[]>
  /** Scoring facts of those ids that are APPROVED PKSK questions of the level; any other id is simply absent. */
  answerKeys(level: PkskLevel, ids: readonly string[]): Promise<PkskAnswerKey[]>
  list(filter: PkskQuestionListFilter): Promise<{ rows: PkskQuestionRow[]; total: number }>
  stats(): Promise<PkskStats>
  /** null when the id is unknown OR not a PKSK question (SEC-M07-12). */
  get(id: string): Promise<PkskQuestionRecord | null>
  create(input: PkskQuestionInput, actorUserId: string): Promise<PkskQuestionRecord>
  /** null when the id is unknown or not a PKSK question; nothing is written then. */
  update(id: string, input: PkskQuestionInput, actorUserId: string): Promise<PkskQuestionRecord | null>
  /** Hard delete of PKSK questions only; returns the number deleted. Historical practice answers survive (nullable ref). */
  remove(ids: readonly string[]): Promise<number>
  /** Sets the status of PKSK questions only; returns the number changed. */
  setStatus(ids: readonly string[], status: PkskQuestionStatus, actorUserId: string): Promise<number>
  /** Which of these ids are PKSK questions (subset, same strings). */
  pkskIds(ids: readonly string[]): Promise<string[]>
}

export const PKSK_QUESTIONS_PORT = Symbol('PKSK_QUESTIONS_PORT')

/** Default provider until BE-09 offers the PKSK methods: every call fails closed, so no question data is ever served. */
export class UnavailablePkskQuestions implements PkskQuestionsPort {
  private fail(): never {
    throw ApiError.of('SERVER_ERROR', { message: QUESTIONS_UNAVAILABLE })
  }
  countApproved(): Promise<Record<string, number>> {
    return this.fail()
  }
  approvedPool(): Promise<PkskServed[]> {
    return this.fail()
  }
  answerKeys(): Promise<PkskAnswerKey[]> {
    return this.fail()
  }
  list(): Promise<{ rows: PkskQuestionRow[]; total: number }> {
    return this.fail()
  }
  stats(): Promise<PkskStats> {
    return this.fail()
  }
  get(): Promise<PkskQuestionRecord | null> {
    return this.fail()
  }
  create(): Promise<PkskQuestionRecord> {
    return this.fail()
  }
  update(): Promise<PkskQuestionRecord | null> {
    return this.fail()
  }
  remove(): Promise<number> {
    return this.fail()
  }
  setStatus(): Promise<number> {
    return this.fail()
  }
  pkskIds(): Promise<string[]> {
    return this.fail()
  }
}

// ---------------------------------------------------------------------------------------------
// Practice completion (BE-12 PracticeRepository, mode `pksk`)
// ---------------------------------------------------------------------------------------------

export interface PkskPracticeCompletion {
  userId: string
  /** Written under Mod Pelajar: the session is test data. */
  isTest: boolean
  domainCode: string
  level: PkskLevel
  startedAt: Date
  completedAt: Date
  answers: { questionId: string; isCorrect: boolean; optionIndex: number | null }[]
}

export interface PkskPracticeCompletionResult {
  sessionId: string
  coinsEarned: number
  pointsEarned: number
  streakCount: number
  totalBalance: number
}

/**
 * Records ONE completed M05 practice session (mode `pksk`, no subject, no revision queue, no subject mastery, no trial
 * counter) and credits wallet and streak (BE-12 step 6). It joins the ambient transaction (`PrismaService.client`).
 */
export interface PkskPracticePort {
  completeDirect(input: PkskPracticeCompletion): Promise<PkskPracticeCompletionResult>
}

export const PKSK_PRACTICE_PORT = Symbol('PKSK_PRACTICE_PORT')

export class UnavailablePkskPractice implements PkskPracticePort {
  completeDirect(): Promise<PkskPracticeCompletionResult> {
    throw ApiError.of('SERVER_ERROR', { message: QUESTIONS_UNAVAILABLE })
  }
}

// ---------------------------------------------------------------------------------------------
// PKSK subscription flag (BE-25 SubscriptionService)
// ---------------------------------------------------------------------------------------------

export interface PkskSubscriptionPort {
  hasPkskSubscription(userId: string, at: Date): Promise<boolean>
}

export const PKSK_SUBSCRIPTION_PORT = Symbol('PKSK_SUBSCRIPTION_PORT')

/** Default: no PKSK subscription flag exists yet, so only grants and the admin role open a level (fail closed). */
export class NoPkskSubscription implements PkskSubscriptionPort {
  hasPkskSubscription(): Promise<boolean> {
    return Promise.resolve(false)
  }
}

/** Shuffles a copy of `items` (the injectable PRNG of the exam and practice sets). */
export type Shuffle = <T>(items: readonly T[]) => T[]
export const PKSK_SHUFFLE = Symbol('PKSK_SHUFFLE')
