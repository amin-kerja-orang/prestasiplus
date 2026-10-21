/** Pure M06 rules (SRS M06 v1.4 section 4 BR-M06-08, -24, section 6.12). No store access. */
import type { QuestionPart } from '@pp/contract'
import type { SpmHeroClass, SpmMockGrade, SpmSetStatus } from '@pp/contract'

import { GRADE_BANDS } from './config'

/** BR-M06-08. */
export function setStatus(readyCount: number, bankSource: number | null, size: number): SpmSetStatus {
  if (readyCount < size) return 'belum_cukup'
  if (bankSource !== null && bankSource > size) return 'bank_besar'
  return 'bersih'
}

export const isStartable = (s: SpmSetStatus): boolean => s !== 'belum_cukup'

/** BR-M06-08: the figures of a set from its count of eligible questions. */
export function setFigures(eligible: number, size: number): { readyCount: number; bankSource: number | null; status: SpmSetStatus } {
  const bankSource = eligible > size ? eligible : null
  const readyCount = Math.min(eligible, size)
  return { readyCount, bankSource, status: setStatus(readyCount, bankSource, size) }
}

/** BR-M06-24 (INFERRED bands). */
export function gradeOf(percent: number): SpmMockGrade {
  for (const [floor, grade] of GRADE_BANDS) if (percent >= floor) return grade as SpmMockGrade
  return 'G'
}

export function heroClassOf(grade: SpmMockGrade): SpmHeroClass {
  if (grade === 'G') return 'bad'
  if (grade === 'C' || grade === 'D' || grade === 'E') return 'mid'
  return 'good'
}

export const round2 = (n: number): number => Math.round(n * 100) / 100

/** Section 6.12 Paper 2 marker (D4): 0 for an empty answer, else round(max x min(1, words / 60)). */
export function markPaper2(answer: string | null, maxMarks: number): number {
  const words = (answer ?? '').trim().split(/\s+/).filter(Boolean).length
  if (words === 0) return 0
  return Math.round(maxMarks * Math.min(1, words / 60))
}

export const paper1Feedback = (right: boolean, letter: string): string =>
  right ? 'Tahniah, jawapan anda betul.' : `Jawapan yang betul ialah ${letter}.`

export const paper2Feedback = (marks: number, max: number): string =>
  `Jawapan anda merangkumi ${String(marks)} daripada ${String(max)} markah. Rujuk skema.`

/** BR-M06-24 weak topics: wrong items (mark < max) per topic, count desc then name. */
export function weakTopicsOf(
  items: readonly { topic: string; marks: number | null; maxMarks: number }[],
): { topic: string; wrongCount: number }[] {
  const by = new Map<string, number>()
  for (const it of items) {
    if ((it.marks ?? 0) < it.maxMarks) by.set(it.topic, (by.get(it.topic) ?? 0) + 1)
  }
  return [...by.entries()]
    .map(([topic, wrongCount]) => ({ topic, wrongCount }))
    .sort((a, b) => b.wrongCount - a.wrongCount || a.topic.localeCompare(b.topic, 'ms'))
}

/** Difficulty 1 to 5 of the mock scale from a TP (1 to 6): the flat wire clamps 6 to 5 and an unset TP to 1. */
export const difficultyOf = (tp: number | null): number => Math.min(5, Math.max(1, tp ?? 1))

/* ------------------------------------------------------------------------------ question mapping */

type Leaf = Extract<QuestionPart, { mode: string }>

const isLeaf = (p: QuestionPart): p is Leaf => 'mode' in p

/** Leaf parts in document order. */
export function leavesOf(parts: readonly QuestionPart[]): Leaf[] {
  const out: Leaf[] = []
  const walk = (list: readonly QuestionPart[]): void => {
    for (const p of list) {
      if (isLeaf(p)) out.push(p)
      else walk(p.children as unknown as QuestionPart[])
    }
  }
  walk(parts)
  return out
}

/** A Paper 1 item of a question that is one multiple-choice leaf: stem, option texts and the key letter. */
export interface McqItem {
  text: string
  options: string[]
  letter: string
}

export function mcqItemOf(stemMs: string | null, parts: readonly QuestionPart[]): McqItem | null {
  const [only] = parts
  if (parts.length !== 1 || only === undefined || !isLeaf(only) || only.mode !== 'mcq') return null
  const text = stemMs ?? only.prompt.ms
  return { text, options: only.options.map((o) => o.body.ms), letter: only.key.correct }
}

/** Open question 6: the model text a leaf's key carries (empty when the key has no text). */
export function modelTextOf(leaf: Leaf): string {
  const key = leaf.key as { kind: string; modelText?: string; values?: unknown[]; correct?: string; notes?: string[]; points?: { label: string; text?: { ms: string } }[] }
  if (key.kind === 'points') {
    if (key.modelText) return key.modelText
    return (key.points ?? []).map((p) => p.text?.ms ?? p.label).join('; ')
  }
  if (key.kind === 'rubric') return (key.notes ?? []).join('; ')
  if (key.kind === 'accepted') return (key.values ?? []).map((v) => (typeof v === 'string' ? v : String((v as { v: unknown }).v))).join(', ')
  if (key.kind === 'option') return key.correct ?? ''
  return ''
}

/** A Paper 2 item of a structured question: the first leaf part's prompt and the joined model texts of all leaves. */
export function structuredItemOf(stemMs: string | null, parts: readonly QuestionPart[]): { text: string; modelAnswer: string } | null {
  const leaves = leavesOf(parts)
  const [first] = leaves
  if (first === undefined) return null
  return {
    text: first.prompt.ms || stemMs || '',
    modelAnswer: leaves.map(modelTextOf).filter((t) => t !== '').join('\n'),
  }
}
