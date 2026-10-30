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

/** Quota as written by the admin: every line is reviewed by that save, so `reviewed` is left out (absent = true). */
export function quotaToDoc(quota: BijakTopicQuota | null | undefined): Prisma.InputJsonValue | null {
  if (!quota) return null
  return {
    basis: quota.basis,
    lines: quota.lines.map((l) => ({ unit: l.unit, value: l.value, ...(l.tag ? { tag: l.tag } : {}) })),
    ...(quota.levelShare ? { levelShare: quota.levelShare } : {}),
  } as unknown as Prisma.InputJsonValue
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
