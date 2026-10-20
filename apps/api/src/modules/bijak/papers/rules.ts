/** Pure rules of the papers module (no database, no Nest): mapping, defaults and the generation seed. */
import type { BijakBlueprintSource } from '@pp/contract'

import { fnv1a32 } from '../../../db/prng'
import type { Blueprint, BlueprintSection, SectionRule } from './exam-core.adapter'

/** Database source code -> wire provenance tag (data model: verified, spec, draft). */
export const SOURCE_TO_WIRE: Readonly<Record<string, BijakBlueprintSource>> = {
  verified: 'Disahkan',
  spec: 'Spec',
  draft: 'Draf',
}

export function sourceToWire(source: string): BijakBlueprintSource {
  return SOURCE_TO_WIRE[source] ?? 'Draf'
}

export function ruleOf(ruleType: string, ruleN: number | null): SectionRule {
  return ruleType === 'choose' && ruleN !== null ? { type: 'choose', n: ruleN } : { type: 'all' }
}

/** Section instruction: the authored line, else "Jawab semua soalan." or "Jawab {n} daripada {count} soalan." (mock getCover). */
export function sectionInstruction(authored: string | null, rule: SectionRule, questionCount: number): string {
  if (authored) return authored
  return rule.type === 'all' ? 'Jawab semua soalan.' : `Jawab ${String(rule.n)} daripada ${String(questionCount)} soalan.`
}

export type ReferencePanel = { title: string; items: string[] }

/** Reference-sheet panels as stored (a jsonb document); anything that is not a valid panel is dropped. */
export function referencePanels(value: unknown): ReferencePanel[] {
  if (!Array.isArray(value)) return []
  const out: ReferencePanel[] = []
  for (const p of value) {
    if (typeof p !== 'object' || p === null) continue
    const { title, items } = p as { title?: unknown; items?: unknown }
    if (typeof title === 'string' && title && Array.isArray(items) && items.every((i) => typeof i === 'string')) {
      out.push({ title, items: items as string[] })
    }
  }
  return out
}

export interface BlueprintRow {
  code: string
  source: string
  durationMin: number
  instructions: string[]
  referenceSheets: unknown
  sections: {
    label: string
    instruction: string | null
    ruleType: string
    ruleN: number | null
    questionCount: number
    markBudget: number | null
    compulsory: boolean
    pool: string | null
  }[]
}

/** The blueprint in the shape the composer takes. A section without a pool tag draws from an empty pool (a shortage). */
export function toComposerBlueprint(subject: string, kertas: number, row: BlueprintRow): Blueprint {
  const reference = referencePanels(row.referenceSheets)
  return {
    subject,
    // The composer types Kertas as 1 | 2; the number is only carried through (the DB allows >= 1).
    kertas: kertas as Blueprint['kertas'],
    source: sourceToWire(row.source),
    code: row.code,
    durationMin: row.durationMin,
    instructions: row.instructions,
    ...(reference.length ? { reference } : {}),
    sections: row.sections.map(
      (s): BlueprintSection => ({
        label: s.label,
        ...(s.markBudget !== null ? { markBudget: s.markBudget } : {}),
        ...(s.compulsory ? { compulsory: true } : {}),
        ...(s.instruction ? { instruction: s.instruction } : {}),
        rule: ruleOf(s.ruleType, s.ruleN),
        pool: s.pool ?? '',
        take: s.questionCount,
      }),
    ),
  }
}

/**
 * Seed of one generation: a function of the injected clock, the user, the blueprint and how many
 * papers the user generated before. The same inputs give the same paper (AC 4); the counter makes
 * the next call differ even when the clock does not move.
 */
export function generationSeed(at: Date, userId: string, blueprintCode: string, previousCount: number): number {
  return fnv1a32(`${at.toISOString()}|${userId}|${blueprintCode}|${String(previousCount)}`)
}

/** Calendar year in Malaysia time (UTC+8, no daylight saving). */
export function mytYear(at: Date): number {
  return new Date(at.getTime() + 8 * 60 * 60 * 1000).getUTCFullYear()
}
