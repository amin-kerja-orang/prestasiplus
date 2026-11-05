/**
 * Pure helpers of the standard-domain side of the paper builder (R1-B09a): the exam-core blueprint of a
 * paper, the BM lines of `verifyComposition`, and the wire form of a shortage. No database, no Nest.
 */
import {
  BIJAK_BUILDER_CHECK_LINES as LINES,
  BIJAK_BUILDER_INELIGIBLE_TEXT as INELIGIBLE_TEXT,
  type BijakBuilderBlockerCode,
  type BijakGenerateShortage,
} from '@pp/contract'

import { ruleOf } from '../../bijak/papers/rules'
import { MISSING_FROM_POOL_TEXT } from './builder.constants'
import { toStandard } from '../blueprints/blueprint-standard'
import type { BlueprintWithSections } from './builder.repository'
import type { StandardBlueprint, StandardShortage, Violation } from './exam-core.adapter'
import type { BlockerDraft } from './blockers'

/**
 * The exam-core blueprint a paper is checked against: the structure (label, rule, count, budget) comes
 * from the paper's own sections, the standard content (pool tag, modes, profile, quota, KBAT) from the
 * blueprint version the paper conforms to, matched by position. Null when the paper has no blueprint.
 */
export interface PaperSections {
  sections: { position?: number; label: string; ruleType: string; ruleN: number | null; questionCount: number; markBudget: number; compulsory: boolean }[]
}

export function standardForPaper(paper: PaperSections, blueprint: BlueprintWithSections | null, subjectCode: string): StandardBlueprint | null {
  if (!blueprint) return null
  const base = toStandard(blueprint, subjectCode)
  return {
    ...base,
    sections: paper.sections.map((ps, i) => {
      const b = base.sections.find((s) => s.position === (ps.position ?? i + 1))
      // S3-T02: a scaled set (fewer questions than its Kontrak section, PO decision item 5) is held to the structure only, as it was drawn.
      const scaled = !!b && b.questionCount !== ps.questionCount
      return {
        position: i + 1,
        label: ps.label,
        rule: ruleOf(ps.ruleType, ps.ruleN),
        questionCount: ps.questionCount,
        markBudget: ps.markBudget,
        compulsory: ps.compulsory,
        pool: b?.pool ?? null,
        allowedModes: b?.allowedModes ?? [],
        profile: scaled ? null : (b?.profile ?? null),
        quota: scaled ? null : (b?.quota ?? null),
        kbatMarks: scaled ? null : (b?.kbatMarks ?? null),
      }
    }),
  }
}

/** Base reasons that block a curated paper (structural tier). `pool_mismatch` is an explicit admin choice and only a note. */
const BLOCKING_REASONS = new Set(['no_unit', 'no_tp', 'no_marks', 'no_key', 'tag_review', 'mode_not_allowed'])

/** Structural reasons that can never be overridden, with their blocker code. */
const HARD_REASON_CODE: Readonly<Record<string, BijakBuilderBlockerCode>> = { no_key: 'NO_KEY', no_marks: 'NO_MARKS', mode_not_allowed: 'MODE_NOT_ALLOWED' }

const text = (reason: string | undefined): string => (INELIGIBLE_TEXT as Record<string, string>)[reason ?? ''] ?? (reason ?? 'tidak layak')

/**
 * BM lines of a `verifyComposition` result. Blockers: ineligible questions and broken groups of the
 * structural tier. Counts, marks and duplicates are reported by `checkPaper` already and are not repeated.
 * Notes (never block a curated paper, D78 O-2): the standard tier (quota, profile, KBAT, level share),
 * a question outside the section pool and unequal marks in a choose-N section.
 */
export function violationLines(
  violations: readonly Violation[],
  labelOf: (position: number) => string,
): { blockers: string[]; fixed: string[]; notes: string[]; blockerIssues: BlockerDraft[]; fixedIssues: BlockerDraft[] } {
  const blockerIssues: BlockerDraft[] = []
  /** Blockers that the audited override can never lift (a question missing from the pool, no key, no marks, a mode not allowed, a broken group). */
  const fixedIssues: BlockerDraft[] = []
  const notes: string[] = []
  const at = (v: Violation, line: string): string => (v.sectionPosition === undefined ? line : LINES.sectionLine(labelOf(v.sectionPosition), line))
  const draft = (v: Violation, code: BijakBuilderBlockerCode, line: string): BlockerDraft => ({
    code,
    message: at(v, line),
    ...(v.sectionPosition === undefined ? {} : { section: labelOf(v.sectionPosition) }),
    ...(v.questionId ? { questionId: v.questionId } : {}),
  })
  for (const v of violations) {
    if (v.code === 'UNKNOWN_QUESTION') {
      fixedIssues.push(draft(v, 'UNKNOWN_QUESTION', LINES.ineligible(v.questionId ?? '', MISSING_FROM_POOL_TEXT)))
    } else if (v.code === 'INELIGIBLE' && v.tier === 'structural' && BLOCKING_REASONS.has(v.detail ?? '')) {
      const line = LINES.ineligible(v.questionId ?? '', text(v.detail))
      // PIPE AC-07.5 / AC-26.3: the audited override lifts the blueprint-conformance failures (no unit, no TP, tags awaiting review) only.
      // A question without a key or marks, or in an answer mode the section does not allow, is a structural failure: never overridable.
      const hard = HARD_REASON_CODE[v.detail ?? '']
      if (hard) fixedIssues.push(draft(v, hard, line))
      else blockerIssues.push(draft(v, 'INELIGIBLE', line))
    } else if (v.code === 'GROUP_BROKEN') {
      fixedIssues.push(draft(v, 'GROUP_BROKEN', LINES.groupNotConsecutive(v.detail ?? '')))
    } else if (v.tier === 'standard' || v.code === 'INELIGIBLE' || v.code === 'MARKS_EACH') {
      notes.push(at(v, noteOf(v)))
    }
  }
  const unique = (list: BlockerDraft[]): BlockerDraft[] => [...new Map(list.map((b) => [b.message, b])).values()]
  const blockerList = unique(blockerIssues)
  const fixedList = unique(fixedIssues)
  return { blockers: blockerList.map((b) => b.message), fixed: fixedList.map((b) => b.message), notes: [...new Set(notes)], blockerIssues: blockerList, fixedIssues: fixedList }
}

function noteOf(v: Violation): string {
  switch (v.code) {
    case 'INELIGIBLE':
      return LINES.ineligible(v.questionId ?? '', text(v.detail))
    case 'QUOTA':
      return `kuota topik tidak dipenuhi (perlu ${String(v.expected)}, ada ${String(v.actual)})`
    case 'TP_BAND':
    case 'TP_COUNT':
    case 'MARKS_BAND':
    case 'TEMA_UNIT':
      return 'profil kesukaran bahagian tidak dipenuhi'
    case 'KBAT':
    case 'KBAT_TOTAL':
      return `markah KBAT tidak dipenuhi (perlu ${String(v.expected)}, ada ${String(v.actual)})`
    case 'LEVEL_SHARE':
      return 'nisbah Tingkatan 4 : 5 tidak dipenuhi'
    case 'MARKS_EACH':
      return 'Soalan pilihan sepatutnya sama markah supaya pilihan adil'
    default:
      return v.code
  }
}

/** The contract's shortage shape (drops the internal `marksBand`; `need` is at least 1). */
export function shortageToWire(s: StandardShortage): BijakGenerateShortage {
  const { marksBand: _marksBand, ...rest } = s
  void _marksBand
  return { ...rest, need: Math.max(1, rest.need) }
}
