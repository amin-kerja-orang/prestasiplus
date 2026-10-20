/**
 * Pure mapping from the BE-09 question store shapes to the paper builder shapes (BE-39 wiring). No
 * database access. Decisions (see docs/architecture/v2-backend-deviations.md, "BE-39 wiring" rows):
 *
 * - kertas: the digit of a `question_tags` pool code of the Bijak form `MAT2-B` (the same code the blueprint
 *   section `pool` uses), else the trailing digit of the version `paper_code` (`1449/2`).
 * - marks: the sum of the leaf marks of the version (the BE-09 `totalMarks` rule).
 * - leaf id of a part view: the labels of the path joined with `.` (`a.i`, the BE-09 `PartAnswer.path`); an
 *   MCQ question (one top-level MCQ leaf) is keyed by the question id, as the prototype does.
 */
import {
  BIJAK_BUILDER_SCHEME_LINES as SCHEME_LINES,
  type BijakAttemptLeafKind,
  type BijakAttemptOption,
  type BijakAttemptPartView,
  type BijakAttemptStimulus,
  type BijakBuilderQuestionStatus,
  type BijakBuilderReviewQuestion,
} from '@pp/contract'

import type { QuestionPart } from '../../questions'

type SchemeLine = { tag?: string; text: string; marks?: number }
type ReviewScheme = BijakBuilderReviewQuestion['scheme']
type Leaf = Extract<QuestionPart, { mode: string }>
export type Curriculum = BijakBuilderReviewQuestion['curriculum']

const isLeaf = (p: QuestionPart): p is Leaf => 'mode' in p

/** A part row as the describe query reads it (no prompt keys, only the key kind). */
export interface PartRow {
  id: bigint
  parentPartId: bigint | null
  position: number
  label: string
  promptMs: string
  marks: number | null
  mode: string | null
  key: { kind: string } | null
}

/** Kertas of a question from its pool codes, else its paper code; null when neither says. */
export function kertasOf(poolCodes: readonly string[], paperCode: string | null): number | null {
  for (const code of poolCodes) {
    const m = /^[A-Za-z]+(\d)-/.exec(code)
    if (m) return Number(m[1])
  }
  const m = paperCode ? /\/(\d)\s*$/.exec(paperCode) : null
  return m ? Number(m[1]) : null
}

/** Sum of the leaf marks. */
export const marksOfRows = (rows: readonly PartRow[]): number => rows.reduce((n, r) => n + (r.mode !== null ? (r.marks ?? 0) : 0), 0)

/** `kindOf`: objektif = one MCQ question; esei = a leaf with a rubric key; berstruktur otherwise. */
export function kindOfRows(type: string, rows: readonly PartRow[]): 'objektif' | 'berstruktur' | 'esei' {
  if (type === 'mcq') return 'objektif'
  return rows.some((r) => r.key?.kind === 'rubric') ? 'esei' : 'berstruktur'
}

/** `previewOf`: the stem, then " {label} {prompt}" of the first part when that part is a leaf. */
export function previewOfRows(stem: string | null, rows: readonly PartRow[]): string {
  const top = rows.filter((r) => r.parentPartId === null).sort((a, b) => a.position - b.position)[0]
  const base = (stem ?? '').trim()
  if (!top || top.mode === null) return base
  if (base === '') return top.promptMs
  return base === top.promptMs.trim() ? base : `${base} ${top.label} ${top.promptMs}`
}

/** Question status the builder shows (D54a): the live version when there is one, else the latest. */
export function statusOf(input: {
  isActive: boolean
  liveStatus: string | null
  latestStatus: string | null
}): BijakBuilderQuestionStatus {
  const raw = input.liveStatus ?? input.latestStatus ?? 'draft'
  const status: BijakBuilderQuestionStatus = (['draft', 'review', 'approved', 'published', 'archived'] as const).find((s) => s === raw) ?? 'draft'
  // A withdrawn (inactive) question is not eligible (BE-09 Q-2), so the builder treats it as archived.
  return status === 'published' && !input.isActive ? 'archived' : status
}

export function levelOf(levelCode: string | null, formOrigin: string): 'T4' | 'T5' {
  if (levelCode === 'T4' || levelCode === 'T5') return levelCode
  return formOrigin === 't5' ? 'T5' : 'T4'
}

export const formOriginWire = (f: string): 'T1-T3' | 'T4' | 'T5' => (f === 't5' ? 'T5' : f === 't4' ? 'T4' : 'T1-T3')

/* ------------------------------------------------------------------------------- stimulus */

export interface StimulusSource {
  id: bigint
  kind: string
  label: string | null
  bodyMs: string | null
  caption: string | null
  altText: string | null
  tableData: unknown
}

const asTable = (data: unknown): { head: string[]; rows: string[][] } | undefined => {
  if (typeof data !== 'object' || data === null) return undefined
  const { head, rows } = data as { head?: unknown; rows?: unknown }
  const strings = (v: unknown): v is string[] => Array.isArray(v) && v.every((s) => typeof s === 'string')
  return strings(head) && Array.isArray(rows) && rows.every(strings) ? { head, rows: rows as string[][] } : undefined
}

/** The builder shows one stimulus per group: the first non-audio one (the contract has a single `stimulus`). */
export function stimulusOf(s: StimulusSource): BijakAttemptStimulus | undefined {
  if (s.kind === 'audio') return undefined
  const kind = s.kind === 'passage' ? 'passage' : s.kind === 'table' ? 'table' : 'diagram'
  const label = s.label ?? ''
  const table = kind === 'table' ? asTable(s.tableData) : undefined
  return {
    id: s.id.toString(),
    kind,
    label,
    ...(s.caption ? { caption: s.caption } : {}),
    alt: s.altText ?? label,
    ...(kind === 'passage' && s.bodyMs ? { text: s.bodyMs } : {}),
    ...(table ? { table } : {}),
  }
}

/* ---------------------------------------------------------------------------------- scheme */

const LEAF_KIND: Record<Leaf['mode'], BijakAttemptLeafKind> = {
  // An MCQ leaf inside a structured tree has no kind of its own in the part view: it reads as a short answer.
  mcq: 'short_text',
  match_letter: 'match_letter',
  short_text: 'short_text',
  numeric: 'numeric',
  working: 'working',
  essay: 'essay',
  drawing: 'drawing',
  table_fill: 'table_fill',
}

function describeKey(leaf: Leaf): SchemeLine[] {
  switch (leaf.mode) {
    case 'mcq':
      return [{ text: SCHEME_LINES.correctOption(leaf.options.findIndex((o) => o.label === leaf.key.correct)) }]
    case 'short_text':
      return leaf.key.values.map((v) => ({ text: SCHEME_LINES.accepted(v) }))
    case 'numeric':
      return leaf.key.values.map((v) => ({ text: SCHEME_LINES.accepted(String(v.v), v.unit) }))
    case 'match_letter':
      return Object.entries(leaf.key.map).map(([k, v]) => ({ text: SCHEME_LINES.mapping(k, v) }))
    case 'table_fill':
      return Object.entries(leaf.key.cells).map(([k, v]) => ({ text: SCHEME_LINES.mapping(k, v.join(', ')) }))
    case 'working':
    case 'drawing':
      return pointLines(leaf.key)
    case 'essay': {
      const key = leaf.key
      if (key.kind === 'points') return pointLines(key)
      return [
        ...key.bands.map((b) =>
          ({ text: SCHEME_LINES.rubricBand(b.name, b.range[0], b.range[1], Object.values(b.descriptors ?? {}).join('; ')) }),
        ),
        ...(key.notes ?? []).map((n) => ({ text: n })),
      ]
    }
  }
}

function pointLines(key: Extract<Leaf, { mode: 'working' }>['key']): SchemeLine[] {
  const count = new Map<string, number>()
  const lines: SchemeLine[] = key.points.map((p) => {
    const n = (count.get(p.code) ?? 0) + 1
    count.set(p.code, n)
    return { tag: SCHEME_LINES.pointTag(p.code, n), text: p.label, marks: p.marks }
  })
  if (key.final) lines.push({ text: SCHEME_LINES.finalAnswer(key.final.display) })
  return lines
}

/** An MCQ question is one top-level MCQ leaf. */
const mcqLeafOf = (parts: readonly QuestionPart[]): Extract<Leaf, { mode: 'mcq' }> | undefined => {
  const [only] = parts
  return parts.length === 1 && only !== undefined && isLeaf(only) && only.mode === 'mcq' ? only : undefined
}

function viewOf(part: QuestionPart, path: string[], scheme: ReviewScheme): BijakAttemptPartView {
  const here = [...path, part.label]
  const id = here.join('.')
  if (!isLeaf(part)) {
    return {
      id,
      label: part.label,
      prompt: part.prompt.ms,
      marks: 0,
      children: part.children.map((c) => viewOf(c as QuestionPart, here, scheme)),
    }
  }
  scheme[id] = { marks: part.marks, lines: describeKey(part) }
  const range = part.mode === 'essay' ? part.wordRange : undefined
  return {
    id,
    label: part.label,
    prompt: part.prompt.ms,
    marks: part.marks,
    answer: { kind: LEAF_KIND[part.mode], ...(range ? { wordRange: range } : {}) },
  }
}

export function reviewQuestion(input: {
  id: string
  stem: string | null
  parts: readonly QuestionPart[]
  curriculum: Curriculum
}): BijakBuilderReviewQuestion {
  const { id, parts, curriculum } = input
  const scheme: ReviewScheme = {}
  const mcq = mcqLeafOf(parts)
  if (mcq) {
    scheme[id] = { marks: mcq.marks, lines: describeKey(mcq) }
    return {
      id,
      stem: input.stem && input.stem.trim() !== '' ? input.stem : mcq.prompt.ms,
      marks: mcq.marks,
      curriculum,
      mcq: { options: mcq.options.map((o): BijakAttemptOption => ({ id: o.label, text: o.body.ms })), correct: mcq.key.correct },
      scheme,
    }
  }
  const views = parts.map((p) => viewOf(p, [], scheme))
  const marks = parts.reduce((n, p) => n + marksOfTree(p), 0)
  return { id, stem: input.stem ?? '', marks, curriculum, parts: views, scheme }
}

function marksOfTree(p: QuestionPart): number {
  return isLeaf(p) ? p.marks : p.children.reduce((n, c) => n + marksOfTree(c as QuestionPart), 0)
}
