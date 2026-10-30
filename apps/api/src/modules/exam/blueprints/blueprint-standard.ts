import { createHash } from 'node:crypto'

import {
  BijakDifficultyProfileViewSchema,
  BijakTopicQuotaViewSchema,
  type BijakDifficultyProfile,
  type BijakDifficultyProfileView,
  type BijakTopicQuotaView,
  type BijakTopicQuota,
} from '@pp/contract'

import type { Prisma } from '../../../db/generated/client'
import { ruleOf } from '../../bijak/papers/rules'
import type { BlueprintWithSections } from './blueprint-view'
import { canonicalStructure, type StandardBlueprint, type StandardSection } from './exam-core.adapter'

/** A DSKP unit (curriculum node of kind unit) as the editor and the validator know it. */
export interface UnitInfo {
  nodeId: string
  code: string
  level: 'T4' | 'T5'
  title: string
}

/** sha-256 (hex) of the canonical STRUCTURAL content (architecture 3.5): the string exam-core builds. */
export function structureHashOf(bp: StandardBlueprint): string {
  return createHash('sha256').update(canonicalStructure(bp), 'utf8').digest('hex')
}

/** Profile document as stored (a jsonb document, re-parsed on read like `reference_sheets`). */
export function profileOfDoc(doc: unknown): BijakDifficultyProfileView | null {
  if (doc === null || doc === undefined) return null
  return BijakDifficultyProfileViewSchema.parse(doc)
}

/**
 * Quota document as stored: a line carries `reviewed` only when it is false (absent = true, 3.3a). The
 * result always has `reviewed` set, which is what the view and exam-core read.
 */
export function quotaOfDoc(doc: unknown): BijakTopicQuotaView | null {
  if (doc === null || doc === undefined) return null
  const raw = doc as { lines?: unknown }
  const lines = Array.isArray(raw.lines)
    ? raw.lines.map((l: unknown) => ({ ...(l as Record<string, unknown>), reviewed: (l as { reviewed?: unknown }).reviewed !== false }))
    : []
  return BijakTopicQuotaViewSchema.parse({ ...raw, lines })
}

/** Profile as written by the admin: a plain jsonb document (the strict input schema already vetted it). */
export function profileToDoc(profile: BijakDifficultyProfile | null | undefined): Prisma.InputJsonValue | null {
  return profile ? (profile as unknown as Prisma.InputJsonValue) : null
}

const unitKeyOfRef = (u: { kind: 'unit'; nodeId: string } | { kind: 't1_t3' }): string => (u.kind === 't1_t3' ? 't1_t3' : `unit:${u.nodeId}`)

/**
 * Quota as written by the admin: a line the admin changed or added is reviewed by that save (`reviewed` left out,
 * absent = true). A line unchanged from the previous version (same unit key and value) keeps its unreviewed
 * state: `unreviewed` maps the unit key to the value that was "Belum disemak" (AC-39.9).
 */
export function quotaToDoc(
  quota: BijakTopicQuota | null | undefined,
  unreviewed: ReadonlyMap<string, number> = new Map(),
): Prisma.InputJsonValue | null {
  if (!quota) return null
  return {
    basis: quota.basis,
    lines: quota.lines.map((l) => ({
      unit: l.unit,
      value: l.value,
      ...(unreviewed.get(unitKeyOfRef(l.unit)) === l.value ? { reviewed: false } : {}),
      ...(l.tag ? { tag: l.tag } : {}),
    })),
    ...(quota.levelShare ? { levelShare: quota.levelShare } : {}),
  } as unknown as Prisma.InputJsonValue
}

/** The stored quota document with every line reviewed (the review stamp of a section). */
export function reviewedQuotaDoc(doc: unknown): Prisma.InputJsonValue | null {
  if (doc === null || doc === undefined) return null
  const raw = doc as { lines?: unknown[] }
  return {
    ...raw,
    lines: (raw.lines ?? []).map((l) => {
      const rest = { ...(l as Record<string, unknown>) }
      delete rest.reviewed
      return rest
    }),
  } as unknown as Prisma.InputJsonValue
}

/** Unit key to value of the stored quota lines that are still unreviewed. */
export function unreviewedLines(doc: unknown): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of quotaOfDoc(doc)?.lines ?? []) if (!l.reviewed) out.set(unitKeyOfRef(l.unit), l.value)
  return out
}

/** The persisted row as the exam-core blueprint (the shape `validateBlueprint` and the hash take). */
export function toStandard(row: BlueprintWithSections, subjectCode: string): StandardBlueprint {
  const sections: StandardSection[] = [...row.sections]
    .sort((a, b) => a.position - b.position)
    .map((s) => ({
      position: s.position,
      label: s.label,
      rule: ruleOf(s.ruleType, s.ruleN),
      questionCount: s.questionCount,
      markBudget: s.markBudget ?? s.questionCount,
      compulsory: s.compulsory,
      pool: s.pool,
      allowedModes: s.allowedModes,
      profile: profileOfDoc(s.profile),
      quota: quotaOfDoc(s.quota),
      kbatMarks: s.kbatMarks,
      kbatReviewed: s.kbatReviewed,
    }))
  return {
    subject: subjectCode,
    kertas: row.kertas,
    code: row.code,
    version: row.version,
    durationMin: row.durationMin,
    totalMarks: sections.reduce((n, s) => n + s.markBudget, 0),
    sections,
    kbatMarks: row.kbatMarks,
    levelShare: (row.levelShare as { t4: number; t5: number } | null) ?? null,
    subPartRamp: row.subPartRamp,
  }
}

/** `unitLevels` of `validateBlueprint`: node id to T4/T5 for every unit of the subject. */
export function unitLevelsOf(units: readonly UnitInfo[]): Record<string, 'T4' | 'T5'> {
  return Object.fromEntries(units.map((u) => [u.nodeId, u.level]))
}
