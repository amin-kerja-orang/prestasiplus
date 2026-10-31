import { Inject, Injectable } from '@nestjs/common'
import {
  BIJAK_STANDARDS_MESSAGES,
  type BijakBlueprintView,
  type BijakBlueprintVersionItem,
  type BijakUnitRefView,
  type BijakVerificationSummary,
} from '@pp/contract'

import { toMytTimestamp } from '../../../common/time/myt'
import type { BlueprintVerification } from '../../../db/generated/client'
import { idToString } from '../../../db/ids'
import { bijakCodeOf } from '../../bijak/papers'
import { BijakPapersPorts } from '../../bijak/papers/ports'
import { sourceToWire } from '../../bijak/papers/rules'
import { profileOfDoc, quotaOfDoc, structureHashOf, toStandard, type UnitInfo } from './blueprint-standard'
import { blueprintView, type BlueprintViewContext, type BlueprintWithSections } from './blueprint-view'
import { BlueprintsRepository, pairKey, type SubjectRef } from './blueprints.repository'
import { standardForPaper } from '../builder/standard'
import { validateBlueprint, verifyComposition, type QuestionFacts, type UnitRef, type Violation } from './exam-core.adapter'

/** How many published papers of a subject and kertas are checked against the head (architecture 6.3a). */
const REVIEW_PAPER_LIMIT = 20

type ReviewGap = BijakBlueprintView['reviewPapers'][number]['gaps'][number]

/** Standard-tier violation to the gap the badge lists. Structural violations are not a "needs review" matter. */
function gapOf(v: Violation): ReviewGap | null {
  if (v.tier !== 'standard') return null
  switch (v.code) {
    case 'MARKS_BAND':
      return 'marks'
    case 'TP_BAND':
    case 'TP_COUNT':
    case 'TEMA_UNIT':
      return 'tp'
    case 'QUOTA':
      return 'quota'
    case 'KBAT':
    case 'KBAT_TOTAL':
      return 'kbat'
    case 'LEVEL_SHARE':
      return 'level_share'
    default:
      return null
  }
}

/** Fallback when the verifier's user row is gone (the FK restricts deletes, so this is defensive only). */
const UNKNOWN_VERIFIER = 'Admin Pusat'

/** Unit references of a row's profile and quota documents, as node ids. */
function unitIdsOf(row: BlueprintWithSections): bigint[] {
  const ids = new Set<string>()
  const add = (u: UnitRef) => {
    if (u.kind === 'unit') ids.add(u.nodeId)
  }
  for (const s of row.sections) {
    profileOfDoc(s.profile)?.groups.forEach((g) => g.units?.forEach(add))
    quotaOfDoc(s.quota)?.lines.forEach((l) => add(l.unit))
  }
  return [...ids].map((id) => BigInt(id))
}

/** Adds the display fields of a unit reference (code, level, title) where the unit is known. */
export function enrichUnit(ref: UnitRef | undefined, units: ReadonlyMap<string, UnitInfo>): BijakUnitRefView | undefined {
  if (!ref) return undefined
  if (ref.kind === 't1_t3') return ref
  const info = units.get(ref.nodeId)
  return info ? { kind: 'unit', nodeId: ref.nodeId, code: info.code, level: info.level, title: info.title } : ref
}

/**
 * Builds `BijakBlueprintView`s and the version-history items in batches: the verification summary, evidence
 * count, serving version, dependent papers (architecture 15.6) and the non-blocking warnings are loaded for
 * all rows at once, so a list page costs a fixed number of queries.
 */
@Injectable()
export class BlueprintViewsService {
  constructor(
    @Inject(BlueprintsRepository) private readonly repo: BlueprintsRepository,
    @Inject(BijakPapersPorts) private readonly papersPorts: BijakPapersPorts,
  ) {}

  /**
   * "Blueprint perlu semakan" (PIPE AC-06.6, v2-bijak-spm AC-26.7, architecture 6.3a): computed, never stored. Only the head
   * (active) version is checked, against the published Kertas Pilihan of its subject and kertas (newest 20). The STANDARD tier of
   * `verifyComposition` (marks bands, TP, quota, KBAT, level share) lists the gaps; it never blocks anything. A null blueprint value
   * (no profile, quota, KBAT or share) is "unconstrained" and never a gap (PIPE AC-06.5). A paper whose questions are not all live
   * candidates cannot be measured and is skipped, as the publish check does.
   */
  private async reviewOf(row: BlueprintWithSections, subject: SubjectRef): Promise<BijakBlueprintView['reviewPapers']> {
    const papers = await this.repo.publishedPilihan(row.subjectId, row.kertas, REVIEW_PAPER_LIMIT)
    if (papers.length === 0) return []
    const code = bijakCodeOf(subject.code)
    const facts = new Map<string, QuestionFacts>(
      (await this.papersPorts.poolSource.candidates({ subjectId: subject.id.toString(), subjectCode: subject.code, kertas: row.kertas })).map((f) => [f.id, f]),
    )
    const out: BijakBlueprintView['reviewPapers'] = []
    for (const paper of papers) {
      const std = standardForPaper(paper, row, code)
      if (!std) continue
      const composed = paper.sections.map((s, i) => ({ position: i + 1, questionIds: s.placements.map((pl) => idToString(pl.questionId)) }))
      const placed = composed.flatMap((c) => c.questionIds)
      if (placed.length === 0 || placed.some((id) => !facts.has(id))) continue
      const gaps = [...new Set(verifyComposition(std, composed, facts).flatMap((v) => gapOf(v) ?? []))]
      if (gaps.length > 0) out.push({ paperId: idToString(paper.id), title: paper.title, gaps })
    }
    return out
  }

  /** Verification summaries by verification id (AC-39.5): who, when, which bodies. */
  async summaries(verificationIds: bigint[]): Promise<Map<bigint, BijakVerificationSummary>> {
    const rows = await this.repo.verificationsByIds([...new Set(verificationIds)])
    const names = await this.repo.userNames([...new Set(rows.map((r) => r.verifiedById))])
    return new Map(rows.map((r) => [r.id, summaryOf(r, names.get(r.verifiedById) ?? UNKNOWN_VERIFIER)]))
  }

  async views(rows: BlueprintWithSections[], subjects: ReadonlyMap<bigint, SubjectRef>): Promise<BijakBlueprintView[]> {
    if (rows.length === 0) return []
    const pairs = [...new Map(rows.map((r) => [pairKey(r), { subjectId: r.subjectId, kertas: r.kertas }])).values()]
    const [evidence, serving, dependents, summaries, units] = await Promise.all([
      this.repo.evidenceCounts(rows.map((r) => r.id)),
      this.repo.servingVersions(pairs),
      this.repo.dependentPaperCounts(pairs),
      this.summaries(rows.flatMap((r) => (r.verificationId === null ? [] : [r.verificationId]))),
      this.repo.unitsByIds([...new Set(rows.flatMap((r) => unitIdsOf(r)))]),
    ])
    const unitMap = new Map(units.map((u) => [u.nodeId, u]))
    const built = rows.map((row) => {
      const subject = subjects.get(row.subjectId) as SubjectRef
      const servingVersion = serving.get(pairKey(row))
      const ctx: BlueprintViewContext = {
        verification: row.verificationId === null ? null : (summaries.get(row.verificationId) ?? null),
        evidenceCount: evidence.get(row.id) ?? 0,
        ...(servingVersion !== undefined ? { servingVersion } : {}),
        dependentPaperCount: dependents.get(pairKey(row)) ?? 0,
        // KBAT_TP_BAND only: problems (which need the unit map) are refused on save, never shown here.
        warnings: validateBlueprint(toStandard(row, bijakCodeOf(subject.code))).warnings,
        needsReview: false,
        reviewPapers: [],
        units: unitMap,
      }
      return { row, subject, ctx }
    })
    // Only the head version is flagged, and only when published papers depend on the pair (no query otherwise).
    for (const { row, subject, ctx } of built) {
      if (row.status !== 'active' || ctx.dependentPaperCount === 0) continue
      ctx.reviewPapers = await this.reviewOf(row, subject)
      ctx.needsReview = ctx.reviewPapers.length > 0
    }
    return built.map(({ row, subject, ctx }) => blueprintView(row, subject, ctx))
  }

  async view(row: BlueprintWithSections, subject: SubjectRef): Promise<BijakBlueprintView> {
    const [view] = await this.views([row], new Map([[subject.id, subject]]))
    return view as BijakBlueprintView
  }

  /**
   * Version history, newest first. The hash is taken from the stored content (canonical, exam-core) and not
   * trusted from the column: rows written by the 0092 SQL backfill carry a different, legacy value.
   */
  async history(rows: BlueprintWithSections[], subject: SubjectRef): Promise<BijakBlueprintVersionItem[]> {
    const summaries = await this.summaries(rows.flatMap((r) => (r.verificationId === null ? [] : [r.verificationId])))
    return rows.map((row) => {
      const verification = row.verificationId === null ? undefined : summaries.get(row.verificationId)
      return {
        version: row.version,
        status: row.status as BijakBlueprintVersionItem['status'],
        source: sourceToWire(row.source),
        servesStudents: row.servesStudents,
        createdAt: toMytTimestamp(row.createdAt),
        structureHash: structureHashOf(toStandard(row, bijakCodeOf(subject.code))),
        ...(verification ? { verification } : {}),
      }
    })
  }
}

interface SnapshotItem {
  body?: unknown
  origin?: unknown
}

/** `BijakVerificationSummary` of a recorded verification (the evidence label and bodies come from its frozen snapshot). */
function summaryOf(v: BlueprintVerification, verifierName: string): BijakVerificationSummary {
  const snapshot = (Array.isArray(v.evidenceSnapshot) ? v.evidenceSnapshot : []) as SnapshotItem[]
  const bodies = [...new Set(snapshot.flatMap((e) => (typeof e.body === 'string' ? [e.body] : [])))].sort()
  const studyOnly = snapshot.length > 0 && snapshot.every((e) => e.origin === 'study')
  const evidenceLabel = studyOnly
    ? BIJAK_STANDARDS_MESSAGES.studyEvidenceLabel
    : `${String(snapshot.length)} bukti daripada ${bodies.join(', ') || 'tiada badan'}`
  return {
    verifiedAt: toMytTimestamp(v.verifiedAt),
    verifierName,
    verifierRole: 'admin',
    evidenceLabel,
    bodies,
    ...(v.note ? { note: v.note } : {}),
  }
}
