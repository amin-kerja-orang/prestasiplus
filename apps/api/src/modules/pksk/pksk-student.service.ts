import { Inject, Injectable } from '@nestjs/common'
import {
  PkskAnswersRequestSchema,
  type PkskAccess,
  type PkskAnswer,
  type PkskBahagian,
  type PkskDashboard,
  type PkskDomain,
  type PkskDomainSection,
  type PkskExam,
  type PkskExamAttempt,
  type PkskLevel,
  type PkskPractice,
  type PkskPracticeResult,
} from '@pp/contract'

import { ApiError } from '../../common/errors/api-error'
import { toMytTimestamp } from '../../common/time/myt'
import { CLOCK, type Clock } from '../../db/clock'
import { PrismaService } from '../../db/prisma.service'
import { isOverloadError } from '../auth/auth.errors'
import type { PkskActor } from './actor'
import { invalidAnswers } from './errors'
import { PkskAccessService } from './pksk-access.service'
import { PkskDomainsRepository, type DomainRecord } from './pksk-domains.repository'
import { PkskProgressRepository } from './pksk-progress.repository'
import { BAHAGIAN_SECTIONS, EXAM_PLAN, PRACTICE_SIZE, WRITE_TX } from './pksk.constants'
import {
  PKSK_PRACTICE_PORT,
  PKSK_QUESTIONS_PORT,
  PKSK_SHUFFLE,
  type PkskAnswerKey,
  type PkskPracticePort,
  type PkskQuestionsPort,
  type PkskServed,
  type Shuffle,
} from './ports'
import { bahagianPct, examScore, gradeOf, isAnswerCorrect, mean, round1 } from './rules'

const domainRef = (d: DomainRecord) => ({ id: d.id, code: d.code as PkskDomain['code'], name: d.name, icon: d.icon, color: d.color })

/** Served shape: no correctness flag anywhere (SEC-M07-07). Built field by field, never spread from a record. */
const served = (q: PkskServed) => ({ id: q.id, questionText: q.questionText, options: q.options.map((o) => ({ text: o.text })) })

/**
 * The learner PKSK area (M07-01 to M07-09). Every `/levels/:level/*` route runs the level gate first (404 for a
 * bad level, then 403 without access), fail closed. Correctness never leaves the server before a submission and then
 * only as the aggregate result.
 */
@Injectable()
export class PkskStudentService {
  constructor(
    @Inject(PkskAccessService) private readonly gate: PkskAccessService,
    @Inject(PkskDomainsRepository) private readonly domains: PkskDomainsRepository,
    @Inject(PkskProgressRepository) private readonly progress: PkskProgressRepository,
    @Inject(PKSK_QUESTIONS_PORT) private readonly questions: PkskQuestionsPort,
    @Inject(PKSK_PRACTICE_PORT) private readonly practice: PkskPracticePort,
    @Inject(PKSK_SHUFFLE) private readonly shuffle: Shuffle,
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** M07-01. */
  access(actor: PkskActor): Promise<PkskAccess> {
    return this.gate.levels(actor, this.clock.now())
  }

  /** M07-02. */
  async domainList(): Promise<PkskDomain[]> {
    const rows = await this.domains.list()
    return rows.map((d) => ({
      ...domainRef(d),
      bahagian: d.bahagian,
      nameEn: d.nameEn,
      order: d.order,
      isActive: d.isActive,
      createdAt: toMytTimestamp(d.createdAt),
      updatedAt: toMytTimestamp(d.updatedAt),
    }))
  }

  /** M07-03. */
  async dashboard(actor: PkskActor, rawLevel: string): Promise<PkskDashboard> {
    const level = await this.gate.gate(actor, rawLevel, this.clock.now())
    const [attempts, mastery, domains] = await Promise.all([
      this.progress.attempts(actor.userId, level, actor.isTest),
      this.progress.masteryMap(actor.userId, level, actor.isTest),
      this.domains.list(),
    ])
    const avg = mean(attempts.map((a) => a.scorePct))
    return {
      level,
      readiness: { scorePct: Math.round(avg), grade: gradeOf(avg) },
      examCount: attempts.length,
      bahagianBAvgPct: round1(mean(attempts.map((a) => a.bahagianBPct))),
      domains: domains
        .filter((d) => d.bahagian === 'B')
        .map((d) => ({ ...domainRef(d), masteryPct: mastery.get(d.id) ?? 0 })),
    }
  }

  /** M07-04. */
  async sections(actor: PkskActor, rawLevel: string): Promise<PkskDomainSection[]> {
    const level = await this.gate.gate(actor, rawLevel, this.clock.now())
    const [domains, counts, mastery] = await Promise.all([
      this.domains.list(),
      this.questions.countApproved(level),
      this.progress.masteryMap(actor.userId, level, actor.isTest),
    ])
    return (['A', 'B', 'C'] as PkskBahagian[]).map((bahagian) => ({
      bahagian,
      ...BAHAGIAN_SECTIONS[bahagian],
      domains: domains
        .filter((d) => d.bahagian === bahagian)
        .map((d) => ({ ...domainRef(d), questionCount: counts[d.code] ?? 0, masteryPct: mastery.get(d.id) ?? 0 })),
    }))
  }

  /** M07-05: up to 10 random approved questions of the domain and level; records the load time. */
  async practiceSet(actor: PkskActor, rawLevel: string, code: string): Promise<PkskPractice> {
    const now = this.clock.now()
    const level = await this.gate.gate(actor, rawLevel, now)
    const domain = await this.domains.byCode(code)
    if (!domain) throw ApiError.of('NOT_FOUND')
    const pool = this.shuffle(await this.questions.approvedPool(level, [domain.code]))
    await this.progress.markLoaded(actor.userId, level, domain.id, now)
    return {
      domain: { id: domain.id, code: domain.code as PkskDomain['code'], name: domain.name, bahagian: domain.bahagian },
      questions: pool.slice(0, PRACTICE_SIZE).map(served),
    }
  }

  /** M07-06. */
  async attempts(actor: PkskActor, rawLevel: string): Promise<PkskExamAttempt[]> {
    const level = await this.gate.gate(actor, rawLevel, this.clock.now())
    const rows = await this.progress.attempts(actor.userId, level, actor.isTest)
    return rows.map((a) => ({ id: a.id, completedAt: toMytTimestamp(a.completedAt), scorePct: a.scorePct, grade: a.grade }))
  }

  /**
   * M07-07: scores the set on the server and records ONE M05 practice session (mode `pksk`) in the same transaction as
   * the mastery row, so a failure after the session is recorded leaves neither a mastery row nor a wallet credit.
   */
  async submitPractice(actor: PkskActor, rawLevel: string, code: string, body: unknown): Promise<PkskPracticeResult> {
    const now = this.clock.now()
    const level = await this.gate.gate(actor, rawLevel, now)
    const domain = await this.domains.byCode(code)
    if (!domain) throw ApiError.of('NOT_FOUND')
    const answers = parseAnswers(body)
    const keys = await this.keysOf(level, answers)
    if (keys === null || [...keys.values()].some((k) => k.domainCode !== domain.code)) throw invalidAnswers()
    const scored = answers.map((a) => ({
      questionId: a.questionId,
      isCorrect: correct(domain.bahagian, keys.get(a.questionId) as PkskAnswerKey, a),
      optionIndex: a.optionIndex ?? null,
    }))
    const masteryPct = Math.round((scored.filter((s) => s.isCorrect).length / scored.length) * 100)
    return this.write(async () => {
      const loaded = await this.progress.takeLoaded(actor.userId, level, domain.id)
      const done = await this.practice.completeDirect({
        userId: actor.userId,
        isTest: actor.isTest,
        domainCode: domain.code,
        level,
        startedAt: loaded !== null && loaded.getTime() < now.getTime() ? loaded : now,
        completedAt: now,
        answers: scored,
      })
      await this.progress.setMastery(actor.userId, level, domain.id, masteryPct, actor.isTest)
      return {
        masteryPct,
        sessionId: done.sessionId,
        gamification: {
          coinsEarned: done.coinsEarned,
          pointsEarned: done.pointsEarned,
          streakCount: done.streakCount,
          totalBalance: done.totalBalance,
        },
      }
    })
  }

  /** M07-08: 30 A + 70 B + 1 C approved questions of the level (fewer when the pool is short). Nothing is stored. */
  async exam(actor: PkskActor, rawLevel: string): Promise<PkskExam> {
    const level = await this.gate.gate(actor, rawLevel, this.clock.now())
    const domains = await this.domains.list()
    const sections = []
    for (const part of EXAM_PLAN) {
      const codes = domains.filter((d) => d.bahagian === part.bahagian).map((d) => d.code)
      const pool = this.shuffle(await this.questions.approvedPool(level, codes))
      sections.push({ bahagian: part.bahagian, weightPct: part.weightPct, questions: pool.slice(0, part.count).map(served) })
    }
    return { sections }
  }

  /** M07-09: scored server side; the planned counts (30, 70, 1) are the denominators. */
  async submitExam(actor: PkskActor, rawLevel: string, body: unknown): Promise<PkskExamAttempt> {
    const now = this.clock.now()
    const level = await this.gate.gate(actor, rawLevel, now)
    const answers = parseAnswers(body)
    const keys = await this.keysOf(level, answers)
    if (keys === null) throw invalidAnswers()
    const bahagianByCode = new Map((await this.domains.list()).map((d) => [d.code, d.bahagian]))
    const right: Record<PkskBahagian, number> = { A: 0, B: 0, C: 0 }
    const given: Record<PkskBahagian, number> = { A: 0, B: 0, C: 0 }
    for (const a of answers) {
      const key = keys.get(a.questionId) as PkskAnswerKey
      const bahagian = bahagianByCode.get(key.domainCode)
      if (bahagian === undefined) throw invalidAnswers()
      given[bahagian] += 1
      if (correct(bahagian, key, a)) right[bahagian] += 1
    }
    if (EXAM_PLAN.some((p) => given[p.bahagian] > p.count)) throw invalidAnswers()
    const pct = (b: PkskBahagian): number => bahagianPct(right[b], (EXAM_PLAN.find((p) => p.bahagian === b) as { count: number }).count)
    const [a, b, c] = [pct('A'), pct('B'), pct('C')] as [number, number, number]
    const scorePct = examScore(a, b, c)
    const row = await this.write(() =>
      this.progress.addAttempt({
        userId: actor.userId,
        level,
        completedAt: now,
        scorePct,
        bahagianAPct: a,
        bahagianBPct: b,
        bahagianCPct: c,
        grade: gradeOf(scorePct),
        isTest: actor.isTest,
      }),
    )
    return { id: row.id, completedAt: toMytTimestamp(row.completedAt), scorePct: row.scorePct, grade: row.grade }
  }

  /** The keys of the answered questions, or null when any is not an approved PKSK question of the level. */
  private async keysOf(level: PkskLevel, answers: readonly PkskAnswer[]): Promise<Map<string, PkskAnswerKey> | null> {
    const found = await this.questions.answerKeys(level, answers.map((a) => a.questionId))
    const map = new Map(found.map((k) => [k.id, k]))
    return answers.every((a) => map.has(a.questionId)) ? map : null
  }

  private async write<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await this.prisma.transaction(fn, WRITE_TX)
    } catch (err) {
      if (isOverloadError(err)) throw ApiError.of('RATE_LIMITED', { retryAfter: 5 })
      throw err
    }
  }
}

/** Strict body of both POSTs; every failure is the single field `answers` (the mock never reports per-element keys). */
export function parseAnswers(body: unknown): PkskAnswer[] {
  const parsed = PkskAnswersRequestSchema.safeParse(body)
  if (!parsed.success) throw invalidAnswers()
  return parsed.data.answers
}

/** Bahagian C is marked by the simulated essay marker; A and B need a chosen option flagged correct. */
function correct(bahagian: PkskBahagian, key: PkskAnswerKey, answer: PkskAnswer): boolean {
  if (bahagian === 'C') return isAnswerCorrect({ optionCount: 0, correctIndexes: [] }, answer)
  if (key.optionCount === 0) return false
  return isAnswerCorrect(key, answer)
}

