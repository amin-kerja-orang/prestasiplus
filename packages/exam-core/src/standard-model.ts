/**
 * Bijak SPM exam standard (slug `bijak-spm`, BJS-03): the model of a checkable blueprint.
 * Source: docs/architecture/v2-bijak-spm-standards.md sections 3.3 and 4. Pure types and tiny helpers;
 * dependency-free so the API and the browser share it. Field names mirror `@pp/contract`
 * `bijak/standards` (camelCase) but this package never imports the contract.
 */

/** KBAT levels of the DSKP catalogue (v2-dskp-integration); a question or part without one is "Bukan KBAT". */
export const KBAT_LEVELS = ['mengaplikasi', 'menganalisis', 'menilai', 'mencipta'] as const
export type KbatLevel = (typeof KBAT_LEVELS)[number]

/** `unit:<nodeId>` for a DSKP unit, `t1_t3` for the bucket "T1-T3, luar DSKP". */
export type UnitKey = string
export const T1_T3_KEY: UnitKey = 't1_t3'

export type UnitRef = { kind: 'unit'; nodeId: string } | { kind: 't1_t3' }

export function unitKeyOf(ref: UnitRef): UnitKey {
  return ref.kind === 't1_t3' ? T1_T3_KEY : `unit:${ref.nodeId}`
}

export function unitRefOf(key: UnitKey): UnitRef {
  return key === T1_T3_KEY ? { kind: 't1_t3' } : { kind: 'unit', nodeId: key.slice(5) }
}

export type SectionRule = { type: 'all' } | { type: 'choose'; n: number }
export type ProfileKind = 'ladder' | 'bahagian' | 'tema'
export type QuotaBasis = 'questions' | 'marks'

export interface SlotGroup {
  /** 1-based, inclusive. Groups tile 1..questionCount. */
  from: number
  to: number
  tpMin: number
  tpMax: number
  /** Optional EXACT questions per TP; a TP without a count counts 0. */
  tpCounts?: { tp: number; count: number }[]
  marksMin?: number
  marksMax?: number
  /** 'tema' only. */
  units?: UnitRef[]
}

export interface Profile {
  kind: ProfileKind
  groups: SlotGroup[]
}

export interface QuotaLine {
  unit: UnitRef
  value: number
  /** false = "Belum disemak" (seeded, not confirmed). Absent = reviewed. */
  reviewed?: boolean
}

export interface Quota {
  basis: QuotaBasis
  lines: QuotaLine[]
  /** Stated T4:T5 share in the basis unit. */
  levelShare?: { t4: number; t5: number }
}

export interface StandardSection {
  /** 1-based; the key that problems and evidence refer to. */
  position: number
  label: string
  rule: SectionRule
  /** M: the number of slots (offered questions). */
  questionCount: number
  /** Effective marks after choose-N. */
  markBudget: number
  compulsory?: boolean
  /** Optional narrowing tag (NULL = no tag filter). */
  pool?: string | null
  /** Empty = any answer mode. */
  allowedModes: readonly string[]
  profile: Profile | null
  quota: Quota | null
  /** Exact KBAT marks of the offered questions; null = unconstrained, 0 is a value. */
  kbatMarks: number | null
  /** false = the section KBAT value is "Belum disemak". Absent = reviewed. */
  kbatReviewed?: boolean
}

export interface StandardBlueprint {
  subject: string
  kertas: number
  code: string
  version: number
  durationMin?: number | null
  /** Stated total; when set it must equal the sum of the section budgets. */
  totalMarks?: number | null
  sections: readonly StandardSection[]
  kbatMarks?: number | null
  levelShare?: { t4: number; t5: number } | null
  subPartRamp?: boolean
}

/** Answer-mode vocabulary (the leaf modes of M04). */
export const ANSWER_MODES = [
  'mcq',
  'match_letter',
  'short_text',
  'numeric',
  'working',
  'essay',
  'drawing',
  'table_fill',
  'pksk_choice',
] as const

/**
 * Marks OFFERED by a section (the only place that computes it): `all` gives the mark budget;
 * `choose N of M` gives `(markBudget / N) * M` (every question has the same marks, AC-34.2).
 * Returns the budget unchanged when N does not divide it (validateBlueprint reports CHOOSE_N_RANGE).
 */
export function offeredMarks(section: Pick<StandardSection, 'rule' | 'markBudget' | 'questionCount'>): number {
  if (section.rule.type === 'all') return section.markBudget
  const n = section.rule.n
  if (n < 1 || section.markBudget % n !== 0) return section.markBudget
  return (section.markBudget / n) * section.questionCount
}

/** Marks every question carries in a choose-N section; null for `all`. */
export function perQuestionMarks(section: Pick<StandardSection, 'rule' | 'markBudget'>): number | null {
  if (section.rule.type === 'all') return null
  const n = section.rule.n
  return n >= 1 && section.markBudget % n === 0 ? section.markBudget / n : null
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys)
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      const v = (value as Record<string, unknown>)[k]
      if (v !== undefined) out[k] = sortKeys(v)
    }
    return out
  }
  return value
}

/**
 * Canonical STRUCTURAL content of a blueprint (3.5): the string a service hashes (sha-256) to
 * decide whether an edit is cosmetic. Cosmetic content (notes, instructions, reference sheets,
 * section label and instruction) and the `reviewed` flags are left out. Keys are sorted, so the
 * string depends on content only.
 */
export function canonicalStructure(bp: StandardBlueprint): string {
  const stripReviewed = (q: Quota | null) =>
    q ? { ...q, lines: q.lines.map((l) => ({ unit: l.unit, value: l.value })) } : null
  const body = {
    subject: bp.subject,
    kertas: bp.kertas,
    code: bp.code,
    durationMin: bp.durationMin ?? null,
    totalMarks: bp.sections.reduce((n, s) => n + s.markBudget, 0),
    kbatMarks: bp.kbatMarks ?? null,
    levelShare: bp.levelShare ?? null,
    subPartRamp: bp.subPartRamp ?? false,
    sections: [...bp.sections]
      .sort((a, b) => a.position - b.position)
      .map((s) => ({
        position: s.position,
        rule: s.rule,
        questionCount: s.questionCount,
        markBudget: s.markBudget,
        compulsory: s.compulsory ?? false,
        pool: s.pool ?? null,
        allowedModes: [...s.allowedModes].sort(),
        profile: s.profile ?? null,
        quota: stripReviewed(s.quota),
        kbatMarks: s.kbatMarks ?? null,
      })),
  }
  return JSON.stringify(sortKeys(body))
}
