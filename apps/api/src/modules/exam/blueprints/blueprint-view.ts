import type {
  BijakBlueprintView,
  BijakBlueprintWarning,
  BijakReviewPaper,
  BijakUnitRefView,
  BijakVerificationSummary,
} from '@pp/contract'

import type { BlueprintSection, Blueprint } from '../../../db/generated/client'
import { bijakCodeOf } from '../../bijak/papers'
import { referencePanels, ruleOf, sectionInstruction, sourceToWire } from '../../bijak/papers/rules'
import { profileOfDoc, quotaOfDoc, type UnitInfo } from './blueprint-standard'

export type BlueprintWithSections = Blueprint & { sections: BlueprintSection[] }

/**
 * What a view needs besides the row itself (architecture 6.3, 6.3a, 15.6). The service loads it in batches;
 * `EMPTY_VIEW_CONTEXT` is for callers that only need the structure (the paper editor's `blueprint` field).
 */
export interface BlueprintViewContext {
  verification: BijakVerificationSummary | null
  evidenceCount: number
  /** Version of the row with `servesStudents` for the same subject and kertas; absent when none serves. */
  servingVersion?: number
  dependentPaperCount: number
  warnings: BijakBlueprintWarning[]
  /** "Blueprint perlu semakan" (PIPE AC-06.6, architecture 6.3a): computed by `BlueprintViewsService` from the standard tier of `verifyComposition`. */
  needsReview: boolean
  reviewPapers: BijakReviewPaper[]
  /** Display fields of the DSKP units a profile or quota refers to (by node id). */
  units: ReadonlyMap<string, UnitInfo>
}

export const EMPTY_VIEW_CONTEXT: BlueprintViewContext = {
  verification: null,
  evidenceCount: 0,
  dependentPaperCount: 0,
  warnings: [],
  needsReview: false,
  reviewPapers: [],
  units: new Map(),
}

function unitView(ref: { kind: 'unit'; nodeId: string } | { kind: 't1_t3' }, units: ReadonlyMap<string, UnitInfo>): BijakUnitRefView {
  if (ref.kind === 't1_t3') return ref
  const info = units.get(ref.nodeId)
  return info ? { kind: 'unit', nodeId: ref.nodeId, code: info.code, level: info.level, title: info.title } : ref
}

/**
 * `BlueprintView` of one blueprint row, built as the mock `blueprintView` (admin.ts lines 352-379):
 * `markBudget` defaults to the question count, the instruction to the derived line, `totalMarks` is
 * the sum of the section budgets. `subject` is the Bijak code of the curriculum subject. The standard
 * fields (profile, quota, KBAT, reviewed flags, verification, serving) come from the row and the context.
 */
export function blueprintView(
  row: BlueprintWithSections,
  subject: { code: string; name: string },
  ctx: BlueprintViewContext = EMPTY_VIEW_CONTEXT,
): BijakBlueprintView {
  const sections = [...row.sections]
    .sort((a, b) => a.position - b.position)
    .map((s) => {
      const rule = ruleOf(s.ruleType, s.ruleN)
      const profile = profileOfDoc(s.profile)
      const quota = quotaOfDoc(s.quota)
      return {
        label: s.label,
        markBudget: s.markBudget ?? s.questionCount,
        questionCount: s.questionCount,
        compulsory: s.compulsory,
        instruction: sectionInstruction(s.instruction, rule, s.questionCount),
        rule,
        pool: s.pool,
        position: s.position,
        profile: profile
          ? {
              kind: profile.kind,
              groups: profile.groups.map((g) => ({ ...g, ...(g.units ? { units: g.units.map((u) => unitView(u, ctx.units)) } : {}) })),
            }
          : null,
        quota: quota
          ? {
              basis: quota.basis,
              lines: quota.lines.map((l) => ({
                ...(l.tag ? { tag: l.tag } : {}),
                unit: unitView(l.unit, ctx.units),
                value: l.value,
                reviewed: l.reviewed,
              })),
              ...(quota.levelShare ? { levelShare: quota.levelShare } : {}),
            }
          : null,
        kbatMarks: s.kbatMarks,
        kbatReviewed: s.kbatReviewed,
        allowedModes: s.allowedModes as BijakBlueprintView['sections'][number]['allowedModes'],
      }
    })
  return {
    subject: bijakCodeOf(subject.code),
    subjectName: subject.name,
    kertas: row.kertas,
    source: sourceToWire(row.source),
    code: row.code,
    durationMin: row.durationMin,
    instructions: row.instructions,
    totalMarks: sections.reduce((n, s) => n + s.markBudget, 0),
    sections,
    version: row.version,
    servesStudents: row.servesStudents,
    verification: ctx.verification,
    evidenceCount: ctx.evidenceCount,
    notes: row.notes,
    subPartRamp: row.subPartRamp,
    autoMarkable: row.autoMarkable ?? null,
    kbatMarks: row.kbatMarks,
    levelShare: (row.levelShare as { t4: number; t5: number } | null) ?? null,
    warnings: ctx.warnings,
    needsReview: ctx.needsReview,
    reviewPapers: ctx.reviewPapers,
    reference: referencePanels(row.referenceSheets),
    ...(ctx.servingVersion !== undefined ? { servingVersion: ctx.servingVersion } : {}),
    dependentPaperCount: ctx.dependentPaperCount,
  }
}
