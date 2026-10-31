/**
 * M04 question quality (SRS §7 #12–#13, BR-M04-21, BR-M04-22, FR-M04-59…63). Admin-only.
 *
 * | # | Route | Notes |
 * |---|---|---|
 * | 12 | `GET /api/question-quality` | S6 `QualitySummary` (DATA-M04-08), every figure counted from the store |
 * | 13 | `POST /api/question-quality/audit` | scores the runtime rows, records `lastAuditAt`; no confirm |
 *
 * INFERRED: Purata Skor and the bucket cards count every scored question (Q-SCORED); "Skor 51-75"
 * is the `baik` bucket, "Skor ≤ 50" and "Perlu Tindakan Aktif" the non-legacy `le50` rows (BR-M04-21);
 * "Legacy Generic" counts scored legacy rows; the flash text "Audit kualiti selesai." (UNVERIFIED
 * COPY, §8).
 */

import { ok, route, type MockContext, type RouteDef } from '@/mock/define'
import { curriculum } from '@/modules/m03-curriculum/mock'

import type { QualityActionRow, QualitySummary } from '../../api/quality'
import { qualityAuditRepo } from '../repository/audit-state'
import { distributionBucket } from '../repository/quality-rules'
import { questionsRepo } from '../repository/questions'
import { levelScope } from '../repository/visible-levels'
import { adminOnly, nameLookup } from './workflow-common'

export const AUDIT_DONE_TEXT = 'Audit kualiti selesai.'

const round1 = (n: number): number => Math.round(n * 10) / 10

function buildSummary(): QualitySummary {
  const names = nameLookup()
  const stats = questionsRepo.qualityStats()
  const scored = stats.count

  // Secondary-only (D72): every figure below skips the hidden Darjah questions.
  const scope = { educationLevelId: levelScope() }
  const excellentCount = questionsRepo.countWhere({ qualityBucket: 'cemerlang', ...scope })
  const baik = questionsRepo.countWhere({ qualityBucket: 'baik', ...scope })
  const legacyGeneric = questionsRepo.countWhere({
    qualityBucket: ['cemerlang', 'baik', 'le50'],
    legacyGeneric: true,
    ...scope,
  })
  const low = questionsRepo.scoredWithLowScore()
  const action = low.filter((q) => !q.legacyGeneric)
  const lemah = low.filter((q) => distributionBucket(q.qualityScore ?? 0) === 'lemah').length
  const kritikal = low.length - lemah
  const share = (n: number) => (scored === 0 ? 0 : round1((n * 100) / scored))

  const bySubject = curriculum
    .subjects()
    .flatMap((s) => {
      const e = stats.bySubject.get(s.id)
      if (!e || e.count === 0) return []
      const excellent = questionsRepo.countWhere({
        subjectId: s.id,
        qualityBucket: 'cemerlang',
        ...scope,
      })
      return [
        {
          subjectId: s.id,
          name: s.name,
          count: e.count,
          raw: e.sum / e.count,
          average: round1(e.sum / e.count),
          excellentPct: Math.round((excellent * 100) / e.count),
        },
      ]
    })
    .sort((a, b) => b.raw - a.raw || a.subjectId - b.subjectId)
    .map(({ raw: _raw, ...rest }) => {
      void _raw
      return rest
    })

  const byLevel = curriculum.visibleLevels().map((l) => {
    const e = stats.byLevel.get(l.id)
    return {
      levelId: l.id,
      name: l.name,
      count: e?.count ?? 0,
      average: e && e.count > 0 ? round1(e.sum / e.count) : 0,
    }
  })

  const actionList: QualityActionRow[] = action.map((q) => ({
    id: q.id,
    questionText: q.questionText,
    subject: names.subject(q.subjectId),
    level: names.level(q.educationLevelId),
    sourceSet: q.sourceSet,
    qualityScore: q.qualityScore ?? 0,
  }))

  return {
    total: questionsRepo.visibleCount('Q-ALL'),
    average: scored === 0 ? 0 : round1(stats.sum / scored),
    scoredCount: scored,
    excellentCount,
    activeActionCount: action.length,
    buckets: { baik, lemahKritikal: action.length, legacyGeneric },
    distribution: {
      cemerlang: share(excellentCount),
      baik: share(baik),
      lemah: share(lemah),
      kritikal: share(kritikal),
    },
    bySubject,
    byLevel,
    actionList,
    lastAuditAt: qualityAuditRepo.lastAuditAt(),
  }
}

/** #13. */
function runAudit(ctx: MockContext) {
  const at = ctx.transaction(() => {
    questionsRepo.auditRuntimeRows()
    return qualityAuditRepo.record(ctx.clock.now())
  })
  return ok({ lastAuditAt: at }, { status: AUDIT_DONE_TEXT })
}

export const qualityRoutes: RouteDef[] = [
  route('GET', '/api/question-quality', [adminOnly], () => ok(buildSummary())),
  route('POST', '/api/question-quality/audit', [adminOnly], (_req, ctx) => runAudit(ctx)),
]
