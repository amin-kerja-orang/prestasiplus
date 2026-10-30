/**
 * Builds the exam-core `StandardBlueprint` of a launch blueprint from layer 1 (structure and profile) and,
 * when present, layer 2 (unit quotas, KBAT marks, marks bands). Pure: no database. Unit codes are resolved
 * through the `resolve` callback supplied by the seed module.
 *
 * Reviewed flags (architecture section 8, 2026-10-30): every layer-2 quota line is `reviewed = false` and a
 * layer-2 `kbatMarks` makes the section `kbatReviewed = false` ("Belum disemak"). A section without a KBAT
 * value stays null and unreviewed-free (nothing to review); it remains unverifiable (AC-39.1 d).
 */
import type { Profile, Quota, QuotaLine, StandardBlueprint, StandardSection } from '@pp/exam-core'

import type { Layer1Blueprint } from './layer1'

/** One quota line of the analyst file: a unit (`subject`, `level`, `unitCode`) or the T1-T3 bucket. */
export interface Layer2Line {
  subject?: string
  level?: 'T4' | 'T5'
  unitCode?: string
  bucket?: 't1_t3'
  value: number
}

export interface Layer2Section {
  position: number
  quota?: { basis: 'questions' | 'marks'; lines: Layer2Line[]; levelShare?: { t4: number; t5: number } }
  /** Absent = INCOMPLETE section: seeded null, so the section stays unverifiable. */
  kbatMarks?: number
  marksBand?: { from: number; to: number; marksMin: number; marksMax: number }[]
  notes: string
}

export interface Layer2File {
  code: string
  sections: Layer2Section[]
  kbatMarksTotal?: number
}

export interface ResolvedUnit {
  nodeId: string
  level: 'T4' | 'T5'
}

export type UnitResolver = (subject: string, level: 'T4' | 'T5', unitCode: string) => ResolvedUnit

/** A standard blueprint plus the seed-only facts the exam-core model does not carry. */
export interface BuiltBlueprint {
  standard: StandardBlueprint
  confidence: 'high' | 'medium'
  notes: string
  /** Per section position: false when the KBAT value is a layer-2 value awaiting review. */
  kbatReviewed: ReadonlyMap<number, boolean>
  /** nodeId -> level of every unit that has a quota line (input of `validateBlueprint`). */
  unitLevels: ReadonlyMap<string, 'T4' | 'T5'>
}

export function buildBlueprint(l1: Layer1Blueprint, l2: Layer2File | null, resolve: UnitResolver): BuiltBlueprint {
  const unitLevels = new Map<string, 'T4' | 'T5'>()
  const kbatReviewed = new Map<number, boolean>()
  const sections: StandardSection[] = l1.sections.map((s1, i) => {
    const position = i + 1
    const f = l2?.sections.find((x) => x.position === position)
    const groups = s1.groups.map((grp) => {
      const band = f?.marksBand?.find((b) => b.from <= grp.from && b.to >= grp.to)
      return band ? { ...grp, marksMin: band.marksMin, marksMax: band.marksMax } : { ...grp }
    })
    const profile: Profile = { kind: s1.kind, groups }
    let quota: Quota | null = null
    if (f?.quota) {
      const lines: QuotaLine[] = f.quota.lines.map((ln) => {
        if (ln.bucket) return { unit: { kind: 't1_t3' as const }, value: ln.value, reviewed: false }
        const unit = resolve(ln.subject as string, ln.level as 'T4' | 'T5', ln.unitCode as string)
        unitLevels.set(unit.nodeId, unit.level)
        return { unit: { kind: 'unit' as const, nodeId: unit.nodeId }, value: ln.value, reviewed: false }
      })
      quota = { basis: f.quota.basis, lines, ...(f.quota.levelShare ? { levelShare: f.quota.levelShare } : {}) }
    }
    const kbatMarks = f?.kbatMarks ?? null
    if (kbatMarks !== null) kbatReviewed.set(position, false)
    return {
      position,
      label: s1.label,
      rule: s1.rule,
      questionCount: s1.questionCount,
      markBudget: s1.markBudget,
      compulsory: false,
      pool: null,
      allowedModes: s1.allowedModes,
      profile,
      quota,
      kbatMarks,
      ...(kbatMarks !== null ? { kbatReviewed: false } : {}),
    }
  })
  const layer2Notes = (l2?.sections ?? []).map((s) => `${l1.sections[s.position - 1]?.label ?? `Bahagian ${s.position}`}: ${s.notes}`)
  const standard: StandardBlueprint = {
    subject: l1.subject,
    kertas: l1.kertas,
    code: l1.code,
    version: 1,
    durationMin: l1.durationMin,
    totalMarks: sections.reduce((n, s) => n + s.markBudget, 0),
    sections,
    kbatMarks: l2?.kbatMarksTotal ?? null,
    levelShare: null,
    subPartRamp: l1.subPartRamp,
  }
  return {
    standard,
    confidence: l1.confidence,
    notes: [l1.notes, ...layer2Notes].join('\n\n'),
    kbatReviewed,
    unitLevels,
  }
}
