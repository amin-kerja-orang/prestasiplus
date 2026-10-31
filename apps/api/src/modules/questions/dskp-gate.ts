/**
 * R1-B05 (ADR-0031, D76, D80 DEC-2, D83 D-4, D85 U4): the DSKP part of the approve gate, as pure functions.
 *
 * "DSKP complete" for a question = a unit node, at least one SP, a TP (the version TP, or the leaf's own override) and a cognitive
 * level on EVERY leaf, and a kertas. The unit, SP and TP rules are the tag gate every approval runs (`checkTagGate`); this file adds the
 * two rules that only bind a NEW approval of an SPM-bound question (a subject of the SPM catalogue at Tingkatan 4 or 5):
 * - every leaf has a cognitive level ("Bahagian (b) belum ada aras pemikiran.");
 * - the kertas is set (the trailing digit of the paper code).
 *
 * Legacy rule (D80 DEC-2): a question that is already approved and untouched is never re-checked, and a legacy untagged MCQ stays
 * servable in Latih Tubi; the gate runs only on a transition INTO `approved`. `isDskpComplete` is the read side ("Belum ditanda DSKP").
 */
import type { QuestionPart } from '@pp/contract'

import { isLeaf, leavesOf } from './grading'
import { kertasOfPaperCode } from './projection'

export const DSKP_MESSAGES = {
  cognitive: (label: string): string => `${labelOf(label)} belum ada aras pemikiran.`,
  tp: (label: string): string => `${labelOf(label)} belum ada TP.`,
  kertas: 'Sila pilih kertas untuk soalan SPM.',
  unit: 'Sila pilih unit DSKP.',
  sp: 'Sila pilih sekurang-kurangnya satu SP DSKP.',
} as const

/** "Bahagian (b)" for a labelled leaf (a printed label that already has its brackets, as intake keeps them, is not wrapped twice), "Soalan" for an unlabelled one. */
function labelOf(label: string): string {
  return label === '' ? 'Soalan' : label.startsWith('(') ? `Bahagian ${label}` : `Bahagian (${label})`
}

export interface DskpGateInput {
  parts: readonly QuestionPart[]
  /** The version TP (`difficulty_tp`); a leaf without its own TP inherits it. */
  tp: number | null
  unitId: string | null
  spIds: readonly string[]
  paperCode: string | null
  /** True when the subject is in the SPM catalogue and the level is Tingkatan 4 or 5. */
  spmBound: boolean
}

/** One problem of the DSKP part: `path` is the `fields` key (`parts.<path>.cognitiveLevel`, `kertas`, ...). */
export interface DskpIssue {
  path: string
  code: 'LEAF_COGNITIVE_LEVEL_MISSING' | 'LEAF_TP_MISSING' | 'KERTAS_MISSING' | 'UNIT_MISSING' | 'SP_MISSING'
  message: string
  /** Wizard step: 3 Sub-bahagian (a leaf), 4 Tag & pengelasan, 1 Kertas. */
  step: 1 | 3 | 4
}

/** The new-approval rules (the tag gate rules stay in `checkTagGate`). Empty when the question is not SPM-bound. */
export function dskpApprovalIssues(input: DskpGateInput): DskpIssue[] {
  if (!input.spmBound) return []
  const issues: DskpIssue[] = []
  for (const { path, leaf } of leavesOf(input.parts)) {
    if (!isLeaf(leaf)) continue
    const label = leaf.label
    if (leaf.cognitiveLevel == null) {
      issues.push({ path: `parts.${path}.cognitiveLevel`, code: 'LEAF_COGNITIVE_LEVEL_MISSING', message: DSKP_MESSAGES.cognitive(label), step: 3 })
    }
    if ((leaf.difficultyTp ?? input.tp) === null) {
      issues.push({ path: `parts.${path}.difficultyTp`, code: 'LEAF_TP_MISSING', message: DSKP_MESSAGES.tp(label), step: 3 })
    }
  }
  if (kertasOfPaperCode(input.paperCode) === null) issues.push({ path: 'kertas', code: 'KERTAS_MISSING', message: DSKP_MESSAGES.kertas, step: 1 })
  return issues
}

/** The `fields` map form of `dskpApprovalIssues` (the 422 shape of the other gates). */
export function checkDskpGate(input: DskpGateInput): Record<string, string> {
  return Object.fromEntries(dskpApprovalIssues(input).map((i) => [i.path, i.message]))
}

/**
 * "DSKP complete" (the read side, the badge "Belum ditanda DSKP" is its negation): unit, at least one SP, an effective TP and a cognitive
 * level on every leaf. Independent of `spmBound` and of the kertas: it describes the tags, not the approval.
 */
export function dskpCompleteness(input: Pick<DskpGateInput, 'parts' | 'tp' | 'unitId' | 'spIds'>): { complete: boolean; issues: DskpIssue[] } {
  const issues: DskpIssue[] = []
  if (input.unitId === null) issues.push({ path: 'unitId', code: 'UNIT_MISSING', message: DSKP_MESSAGES.unit, step: 4 })
  if (input.spIds.length < 1) issues.push({ path: 'spIds', code: 'SP_MISSING', message: DSKP_MESSAGES.sp, step: 4 })
  for (const { path, leaf } of leavesOf(input.parts)) {
    if (!isLeaf(leaf)) continue
    if (leaf.cognitiveLevel == null) issues.push({ path: `parts.${path}.cognitiveLevel`, code: 'LEAF_COGNITIVE_LEVEL_MISSING', message: DSKP_MESSAGES.cognitive(leaf.label), step: 3 })
    if ((leaf.difficultyTp ?? input.tp) === null) issues.push({ path: `parts.${path}.difficultyTp`, code: 'LEAF_TP_MISSING', message: DSKP_MESSAGES.tp(leaf.label), step: 3 })
  }
  return { complete: issues.length === 0, issues }
}
