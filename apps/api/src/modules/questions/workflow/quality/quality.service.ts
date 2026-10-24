import { Inject, Injectable } from '@nestjs/common'
import {
  QUESTION_QUALITY_ACTION_MAX_SCORE,
  QUESTION_QUALITY_FLASH,
  type QuestionQualitySummary,
} from '@pp/contract'

import { ApiError } from '../../../../common/errors/api-error'
import { toMytTimestamp } from '../../../../common/time/myt'
import { CLOCK, type Clock } from '../../../../db/clock'
import { idFromString, idToString } from '../../../../db/ids'
import { PrismaService } from '../../../../db/prisma.service'
import { CurriculumRepository } from '../../../curriculum'
import type { QualityQuestion } from '../ports'
import { QuestionWorkflowPorts } from '../ports'
import type { WorkflowActor } from '../actor'
import { bucketOfScore, scoreQuestion } from './quality-score'

/** Questions scored and written per statement (keyset batch of the audit and of the summary walk). */
const AUDIT_BATCH = 2000
/** An unfinished audit run older than this is treated as crashed and no longer blocks a new run. */
const AUDIT_STALE_MS = 60 * 60 * 1000
/** Advisory lock key of the audit start (check + insert of the run row). */
const AUDIT_LOCK_KEY = 7_041_001
export const AUDIT_RUNNING_MESSAGE = 'Audit kualiti sedang berjalan.'

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

  /** `GET /question-quality`: every figure is counted from the stored scores and the question store (streamed in keyset batches). */
  async summary(): Promise<QuestionQualitySummary> {
    const subjects = new Map<string, { name: string; count: number; sum: number; excellent: number }>()
    const levelAgg = new Map<string, { count: number; sum: number }>()
    const action: Scored[] = []
    let total = 0
    let scoredCount = 0
    let sum = 0
    let excellentCount = 0
    let baik = 0
    let lemah = 0
    let kritikal = 0
    let legacyGeneric = 0
    await this.ports.questionBank.forEachQualityBatch(async (batch) => {
      total += batch.length
      const stored = await this.prisma.client.questionQualityScore.findMany({
        where: { questionId: { in: batch.map((q) => idFromString(q.id)) } },
        select: { questionId: true, score: true },
      })
      const byId = new Map(stored.map((s) => [idToString(s.questionId), s.score]))
      for (const q of batch) {
        const score = byId.get(q.id)
        if (score === undefined) continue
        scoredCount += 1
        sum += score
        const band = bucketOfScore(score)
        if (band === 'cemerlang') excellentCount += 1
        else if (band === 'baik') baik += 1
        else if (band === 'lemah') lemah += 1
        else if (band === 'kritikal') kritikal += 1
        if (q.isLegacy) legacyGeneric += 1
        if (score <= QUESTION_QUALITY_ACTION_MAX_SCORE && !q.isLegacy) action.push({ q, score })
        if (q.subjectId !== null) {
          const e = subjects.get(q.subjectId) ?? { name: q.subjectName ?? '', count: 0, sum: 0, excellent: 0 }
          e.count += 1
          e.sum += score
          if (band === 'cemerlang') e.excellent += 1
          subjects.set(q.subjectId, e)
        }
        if (q.educationLevelId !== null) {
          const e = levelAgg.get(q.educationLevelId) ?? { count: 0, sum: 0 }
          e.count += 1
          e.sum += score
          levelAgg.set(q.educationLevelId, e)
        }
      }
    }, AUDIT_BATCH)
    const share = (n: number): number => (scoredCount === 0 ? 0 : round1((n * 100) / scoredCount))

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

  /**
   * `POST /question-quality/audit`: scores EVERY question, one `quality_audits` row per run. Mark and sweep, no long transaction:
   * the run row is written first, each keyset batch of `AUDIT_BATCH` questions is upserted in its own short statement stamped with
   * the run id, and at the end the rows NOT stamped with this run (questions deleted since) are removed and the run is closed. A
   * crash in the middle leaves an open run (no `finishedAt`) and the previous scores in place.
   */
  async audit(actor: WorkflowActor): Promise<{ data: { lastAuditAt: string }; status: string }> {
    const now = this.clock.now()
    const db = this.prisma.client
    // One run at a time: the check and the insert of the run row are serialised by a transaction advisory lock, and an
    // unfinished run younger than AUDIT_STALE_MS refuses a second one (a crashed run stops blocking after that window).
    const run = await this.prisma.transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(${AUDIT_LOCK_KEY}::bigint)`
      const open = await tx.qualityAudit.findFirst({ where: { finishedAt: null, createdAt: { gt: new Date(now.getTime() - AUDIT_STALE_MS) } }, select: { id: true } })
      if (open) throw ApiError.of('CONFLICT', { message: AUDIT_RUNNING_MESSAGE })
      return tx.qualityAudit.create({ data: { runById: idFromString(actor.userId), createdAt: now } })
    })
    try {
      return await this.runAudit(run.id, now)
    } catch (e) {
      // A failed run must not look like a running one: drop its row (its scores keep, unstamped, until the next sweep).
      await db.qualityAudit.delete({ where: { id: run.id } }).catch(() => undefined)
      throw e
    }
  }

  private async runAudit(runId: bigint, now: Date): Promise<{ data: { lastAuditAt: string }; status: string }> {
    const db = this.prisma.client
    let scored = 0
    let changed = 0
    let sum = 0
    await this.ports.questionBank.forEachQualityBatch(async (batch) => {
      const existing = await db.questionQualityScore.findMany({
        where: { questionId: { in: batch.map((q) => idFromString(q.id)) } },
        select: { questionId: true, score: true },
      })
      const before = new Map(existing.map((s) => [idToString(s.questionId), s.score]))
      const scores = batch.map((q) => {
        const score = scoreQuestion(q)
        return { id: q.id, score, bucket: bucketOfScore(score) }
      })
      // One statement per batch (three array parameters).
      await db.$executeRaw`
        INSERT INTO question_quality_scores (question_id, score, bucket, audit_id, scored_at)
        SELECT t.question_id, t.score, t.bucket, ${runId}, ${now}
          FROM unnest(${scores.map((x) => x.id)}::bigint[], ${scores.map((x) => x.score)}::int[], ${scores.map((x) => x.bucket)}::text[])
               AS t(question_id, score, bucket)
        ON CONFLICT (question_id) DO UPDATE
          SET score = EXCLUDED.score, bucket = EXCLUDED.bucket, audit_id = EXCLUDED.audit_id, scored_at = EXCLUDED.scored_at`
      scored += scores.length
      changed += scores.filter((s) => before.get(s.id) !== s.score).length
      sum += scores.reduce((a, s) => a + s.score, 0)
    }, AUDIT_BATCH)
    // Every current question was just stamped with this run; what is left belongs to deleted questions.
    await db.$executeRaw`DELETE FROM question_quality_scores WHERE audit_id IS DISTINCT FROM ${runId}`
    await db.qualityAudit.update({
      where: { id: runId },
      data: { finishedAt: now, findingCount: changed, scoredCount: scored, averageScore: scored === 0 ? 0 : sum / scored },
    })
    return { data: { lastAuditAt: toMytTimestamp(now) }, status: QUESTION_QUALITY_FLASH }
  }
}
