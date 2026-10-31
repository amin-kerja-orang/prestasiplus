/**
 * Pure helpers of the standard-domain side of the paper builder (R1-B09a): the exam-core blueprint of a
 * paper, the BM lines of `verifyComposition`, and the wire form of a shortage. No database, no Nest.
 */
import {
  BIJAK_BUILDER_CHECK_LINES as LINES,
  BIJAK_BUILDER_INELIGIBLE_TEXT as INELIGIBLE_TEXT,
  type BijakGenerateShortage,
} from '@pp/contract'

import { ruleOf } from '../../bijak/papers/rules'
import { MISSING_FROM_POOL_TEXT } from './builder.constants'
import { toStandard } from '../blueprints/blueprint-standard'
import type { BlueprintWithSections, PaperTree } from './builder.repository'
import type { StandardBlueprint, StandardShortage, Violation } from './exam-core.adapter'

/**
 * The exam-core blueprint a paper is checked against: the structure (label, rule, count, budget) comes
 * from the paper's own sections, the standard content (pool tag, modes, profile, quota, KBAT) from the
 * blueprint version the paper conforms to, matched by position. Null when the paper has no blueprint.
 */
export function standardForPaper(paper: PaperTree, blueprint: BlueprintWithSections | null, subjectCode: string): StandardBlueprint | null {
  if (!blueprint) return null
  const base = toStandard(blueprint, subjectCode)
  return {
    ...base,
    sections: paper.sections.map((ps, i) => {
      const b = base.sections.find((s) => s.position === i + 1)
      return {
        position: i + 1,
        label: ps.label,
        rule: ruleOf(ps.ruleType, ps.ruleN),
        questionCount: ps.questionCount,
        markBudget: ps.markBudget,
        compulsory: ps.compulsory,
        pool: b?.pool ?? null,
        allowedModes: b?.allowedModes ?? [],
        profile: b?.profile ?? null,
        quota: b?.quota ?? null,
        kbatMarks: b?.kbatMarks ?? null,
      }
    }),
  }
}

/** Base reasons that block a curated paper (structural tier). `pool_mismatch` is an explicit admin choice and only a note. */
const BLOCKING_REASONS = new Set(['no_unit', 'no_tp', 'no_marks', 'no_key', 'tag_review', 'mode_not_allowed'])

const text = (reason: string | undefined): string => (INELIGIBLE_TEXT as Record<string, string>)[reason ?? ''] ?? (reason ?? 'tidak layak')

/**
 * BM lines of a `verifyComposition` result. Blockers: ineligible questions and broken groups of the
 * structural tier. Counts, marks and duplicates are reported by `checkPaper` already and are not repeated.
 * Notes (never block a curated paper, D78 O-2): the standard tier (quota, profile, KBAT, level share),
 * a question outside the section pool and unequal marks in a choose-N section.
 */
export function violationLines(violations: readonly Violation[], labelOf: (position: number) => string): { blockers: string[]; fixed: string[]; notes: string[] } {
  const blockers: string[] = []
  /** Blockers that the audited override can never lift (the question itself cannot be checked at all). */
  const fixed: string[] = []
  const notes: string[] = []
  const at = (v: Violation, line: string): string => (v.sectionPosition === undefined ? line : LINES.sectionLine(labelOf(v.sectionPosition), line))
  for (const v of violations) {
    if (v.code === 'UNKNOWN_QUESTION') {
      fixed.push(at(v, LINES.ineligible(v.questionId ?? '', MISSING_FROM_POOL_TEXT)))
    } else if (v.code === 'INELIGIBLE' && v.tier === 'structural' && BLOCKING_REASONS.has(v.detail ?? '')) {
      blockers.push(at(v, LINES.ineligible(v.questionId ?? '', text(v.detail))))
    } else if (v.code === 'GROUP_BROKEN') {
      blockers.push(at(v, LINES.groupNotConsecutive(v.detail ?? '')))
    } else if (v.tier === 'standard' || v.code === 'INELIGIBLE' || v.code === 'MARKS_EACH') {
      notes.push(at(v, noteOf(v)))
    }
  }
  return { blockers: [...new Set(blockers)], fixed: [...new Set(fixed)], notes: [...new Set(notes)] }
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
