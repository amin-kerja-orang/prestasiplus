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
import { bijakCodeOf } from '../../bijak/papers'
import { sourceToWire } from '../../bijak/papers/rules'
import { profileOfDoc, quotaOfDoc, structureHashOf, toStandard, type UnitInfo } from './blueprint-standard'
import { blueprintView, type BlueprintViewContext, type BlueprintWithSections } from './blueprint-view'
import { BlueprintsRepository, pairKey, type SubjectRef } from './blueprints.repository'
import { validateBlueprint, type UnitRef } from './exam-core.adapter'

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
  constructor(@Inject(BlueprintsRepository) private readonly repo: BlueprintsRepository) {}

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
    return rows.map((row) => {
      const subject = subjects.get(row.subjectId) as SubjectRef
      const servingVersion = serving.get(pairKey(row))
      const ctx: BlueprintViewContext = {
        verification: row.verificationId === null ? null : (summaries.get(row.verificationId) ?? null),
        evidenceCount: evidence.get(row.id) ?? 0,
        ...(servingVersion !== undefined ? { servingVersion } : {}),
        dependentPaperCount: dependents.get(pairKey(row)) ?? 0,
        // KBAT_TP_BAND only: problems (which need the unit map) are refused on save, never shown here.
        warnings: validateBlueprint(toStandard(row, bijakCodeOf(subject.code))).warnings,
        // TODO(BJS-11): needsReview / reviewPapers from the standard tier of verifyComposition (6.3a).
        needsReview: false,
        reviewPapers: [],
        units: unitMap,
      }
      return blueprintView(row, subject, ctx)
    })
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
