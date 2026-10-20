import { Inject, Injectable } from '@nestjs/common'
import {
  QUESTION_QUALITY_ACTION_MAX_SCORE,
  QUESTION_QUALITY_FLASH,
  type QuestionQualitySummary,
} from '@pp/contract'

import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { CurriculumRepository } from '../../../curriculum'
import type { QualityQuestion } from '../ports'
import { QuestionWorkflowPorts } from '../ports'
import type { WorkflowActor } from '../actor'
import { bucketOfScore, scoreQuestion } from './quality-score'

/** The audit writes the whole catalogue in one transaction: allow far more than Prisma's 5 s. */
const AUDIT_TX = { maxWait: 20_000, timeout: 120_000 } as const

const round1 = (n: number): number => Math.round(n * 10) / 10
const cmpId = (a: string, b: string): number => (BigInt(a) < BigInt(b) ? -1 : BigInt(a) > BigInt(b) ? 1 : 0)

interface Scored {
  q: QualityQuestion
  score: number
}

/** Quality dashboard and re-audit (BR-M04-21, BR-M04-22, FR-M04-59 to 63). */
@Injectable()
export class QualityService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(QuestionWorkflowPorts) private readonly ports: QuestionWorkflowPorts,
    @Inject(CurriculumRepository) private readonly curriculum: CurriculumRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  /** `GET /question-quality`: every figure is counted from the stored scores and the question store. */
  async summary(): Promise<QuestionQualitySummary> {
    const questions = await this.ports.questionBank.listForQuality()
    const stored = await this.prisma.client.questionQualityScore.findMany({ select: { questionId: true, score: true } })
    const byId = new Map(stored.map((s) => [idToString(s.questionId), s.score]))
    const scoredRows: Scored[] = []
    for (const q of questions) {
      const score = byId.get(q.id)
      if (score !== undefined) scoredRows.push({ q, score })
    }

    const total = questions.length
    const scoredCount = scoredRows.length
    const sum = scoredRows.reduce((a, r) => a + r.score, 0)
    const share = (n: number): number => (scoredCount === 0 ? 0 : round1((n * 100) / scoredCount))
    const count = (band: string): number => scoredRows.filter((r) => bucketOfScore(r.score) === band).length

    const excellentCount = count('cemerlang')
    const baik = count('baik')
    const lemah = count('lemah')
    const kritikal = count('kritikal')
    const low = scoredRows.filter((r) => r.score <= QUESTION_QUALITY_ACTION_MAX_SCORE)
    const action = low.filter((r) => !r.q.isLegacy)
    const legacyGeneric = scoredRows.filter((r) => r.q.isLegacy).length

    const subjects = new Map<string, { name: string; count: number; sum: number; excellent: number }>()
    const levelAgg = new Map<string, { count: number; sum: number }>()
    for (const { q, score } of scoredRows) {
      if (q.subjectId !== null) {
        const e = subjects.get(q.subjectId) ?? { name: q.subjectName ?? '', count: 0, sum: 0, excellent: 0 }
        e.count += 1
        e.sum += score
        if (bucketOfScore(score) === 'cemerlang') e.excellent += 1
        subjects.set(q.subjectId, e)
      }
      if (q.educationLevelId !== null) {
        const e = levelAgg.get(q.educationLevelId) ?? { count: 0, sum: 0 }
        e.count += 1
        e.sum += score
        levelAgg.set(q.educationLevelId, e)
      }
    }

    const bySubject = [...subjects.entries()]
      .map(([subjectId, e]) => ({ subjectId, name: e.name, count: e.count, raw: e.sum / e.count, average: round1(e.sum / e.count), excellentPct: Math.round((e.excellent * 100) / e.count) }))
      .sort((a, b) => b.raw - a.raw || cmpId(a.subjectId, b.subjectId))
      .map(({ raw: _raw, ...rest }) => {
        void _raw
        return rest
      })

    const levels = await this.curriculum.levels()
    const byLevel = levels.map((l) => {
      const e = levelAgg.get(idToString(l.id))
      return { levelId: idToString(l.id), name: l.name, count: e?.count ?? 0, average: e && e.count > 0 ? round1(e.sum / e.count) : 0 }
    })

    const actionList = action
      .map(({ q, score }) => ({
        id: q.id,
        questionText: q.stemText,
        subject: q.subjectId !== null ? { id: q.subjectId, name: q.subjectName ?? '' } : null,
        level: q.educationLevelId !== null ? { id: q.educationLevelId, name: q.levelName ?? '' } : null,
        sourceSet: q.sourceSet,
        qualityScore: score,
      }))
      .sort((a, b) => cmpId(b.id, a.id))

    const last = await this.prisma.client.qualityAudit.findFirst({
      where: { finishedAt: { not: null } },
      orderBy: [{ finishedAt: 'desc' }, { id: 'desc' }],
      select: { finishedAt: true },
    })

    return {
      total,
      average: scoredCount === 0 ? 0 : round1(sum / scoredCount),
      scoredCount,
      excellentCount,
      activeActionCount: action.length,
      buckets: { baik, lemahKritikal: action.length, legacyGeneric },
      distribution: { cemerlang: share(excellentCount), baik: share(baik), lemah: share(lemah), kritikal: share(kritikal) },
      bySubject,
      byLevel,
      actionList,
      lastAuditAt: last?.finishedAt ? toMytTimestamp(last.finishedAt) : null,
    }
  }

  /** `POST /question-quality/audit`: scores EVERY question, one `quality_audits` row per run. */
  async audit(actor: WorkflowActor): Promise<{ data: { lastAuditAt: string }; status: string }> {
    const questions = await this.ports.questionBank.listForQuality()
    const now = this.clock.now()
    const finishedAt = await this.prisma.transaction(async (tx) => {
      const existing = await tx.questionQualityScore.findMany({ select: { questionId: true, score: true } })
      const before = new Map(existing.map((s) => [idToString(s.questionId), s.score]))
      const scores = questions.map((q) => {
        const score = scoreQuestion(q)
        return { id: q.id, score, bucket: bucketOfScore(score) }
      })
      const run = await tx.qualityAudit.create({ data: { runById: idFromString(actor.userId), createdAt: now } })
      // One statement for all scores (three array parameters, any catalogue size).
      await tx.$executeRaw`
        INSERT INTO question_quality_scores (question_id, score, bucket, audit_id, scored_at)
        SELECT t.question_id, t.score, t.bucket, ${run.id}, ${now}
          FROM unnest(${scores.map((x) => x.id)}::bigint[], ${scores.map((x) => x.score)}::int[], ${scores.map((x) => x.bucket)}::text[])
               AS t(question_id, score, bucket)
        ON CONFLICT (question_id) DO UPDATE
          SET score = EXCLUDED.score, bucket = EXCLUDED.bucket, audit_id = EXCLUDED.audit_id, scored_at = EXCLUDED.scored_at`
      // Every current question was just stamped with this run; what is left belongs to deleted questions.
      await tx.$executeRaw`DELETE FROM question_quality_scores WHERE audit_id IS DISTINCT FROM ${run.id}`
      const changed = scores.filter((s) => before.get(s.id) !== s.score).length
      const sum = scores.reduce((a, s) => a + s.score, 0)
      await tx.qualityAudit.update({
        where: { id: run.id },
        data: {
          finishedAt: now,
          findingCount: changed,
          scoredCount: scores.length,
          averageScore: scores.length === 0 ? 0 : sum / scores.length,
        },
      })
      return now
    }, AUDIT_TX)
    return { data: { lastAuditAt: toMytTimestamp(finishedAt) }, status: QUESTION_QUALITY_FLASH }
  }
}
