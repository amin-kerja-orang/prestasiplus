/**
 * Question bank wire (BE-09 admin routes `GET /questions`, `/questions/summary`, `/questions/{id}`)
 * seen through the Bijak bank screens. The BE-09 question is the flat M04 shape plus an optional v2
 * part tree; the contract exports the zod schemas only, so the fields read here are declared as
 * structural subsets of `QuestionRowSchema` / `QuestionDetailSchema` (`questions/schema.ts`).
 *
 * What the wire does not carry, and how the screens degrade (deviation row in
 * docs/architecture/v2-backend-deviations.md): no kertas (0, the screens hide it), no topic unless
 * the question has a chapter label, no version history (one entry from `createdAt`), no "used in
 * papers" (empty), no pending revision (false).
 */
import type { QuestionPart } from '@pp/contract'

import type {
  BankDetail,
  BankRow,
  QuestionKind,
  QuestionStatus,
  ReviewQuestion,
  SchemeLine,
} from '../domain/admin-types'
import type { CurriculumTag, McqOption, PartDef } from '../domain/types'
import { plainText } from './review-wire'

const LETTERS = 'ABCDEFGH'

export type WireQuestionStatus = 'draft' | 'review' | 'approved' | 'archived'
type Ref = { id: string; name: string } | null

/** Subset of `QuestionRowSchema`. */
export interface WireBankRow {
  id: string
  questionText: string
  subject: Ref
  level: Ref
  status: WireQuestionStatus
}

/** Subset of `QuestionDetailSchema`. */
export interface WireBankDetail extends WireBankRow {
  questionType: 'mcq' | 'true_false' | 'short_answer' | 'fill_blank' | 'essay'
  options: string[] | null
  correctAnswer: number | null
  tfAnswer: boolean | null
  correctAnswerText: string | null
  modelAnswer: string | null
  pointsValue: number
  chapterLabel: string | null
  createdAt: string
  createdBy: { id: string; name: string | null }
  dskp: { sp: { code: string | null } } | null
  parts?: QuestionPart[]
}

/** Wire lifecycle code to the bank status (Draf, Semakan, Diterbitkan = `approved` since ADR-0027, Diarkib = Ditolak). */
export function bankStatusFromWire(s: WireQuestionStatus): QuestionStatus {
  if (s === 'approved') return 'terbit'
  if (s === 'review') return 'semakan'
  if (s === 'archived') return 'ditolak'
  return 'draf'
}

/** The wire codes behind a bank status filter ('semua' = none, a filter-less list). */
export function wireStatusesOf(s: QuestionStatus | 'semua'): WireQuestionStatus[] | null {
  switch (s) {
    case 'terbit':
      return ['approved']
    case 'semakan':
      return ['review']
    case 'draf':
      return ['draft']
    case 'ditolak':
      return ['archived']
    default:
      return null
  }
}

type Leaf = Extract<QuestionPart, { mode: string }>
const isLeaf = (p: QuestionPart): p is Leaf => 'mode' in p
const leavesOfParts = (parts: readonly QuestionPart[]): Leaf[] =>
  parts.flatMap((p) => (isLeaf(p) ? [p] : leavesOfParts(p.children as QuestionPart[])))

export function bankKind(q: Pick<WireBankDetail, 'questionType' | 'parts'>): QuestionKind {
  const leaves = q.parts ? leavesOfParts(q.parts) : []
  if (leaves.length > 0) {
    if (leaves.length === 1 && leaves[0]!.mode === 'mcq') return 'objektif'
    const rubric = leaves.some((l) => l.mode === 'essay' && l.key.kind === 'rubric')
    return rubric ? 'esei' : 'berstruktur'
  }
  if (q.questionType === 'mcq' || q.questionType === 'true_false') return 'objektif'
  if (q.questionType === 'essay') return 'esei'
  return 'berstruktur'
}

export function bankMarks(q: Pick<WireBankDetail, 'pointsValue' | 'parts'>): number {
  const leaves = q.parts ? leavesOfParts(q.parts) : []
  return leaves.length > 0 ? leaves.reduce((n, l) => n + l.marks, 0) : q.pointsValue
}

export function bankRowFrom(
  row: WireBankRow,
  detail: WireBankDetail | undefined,
  subject: { code: string; name: string },
): BankRow {
  const preview = row.questionText
  return {
    id: row.id,
    subject: subject.code,
    subjectName: subject.name,
    kertas: 0,
    kind: detail ? bankKind(detail) : 'objektif',
    topic: detail?.chapterLabel ?? '',
    marks: detail ? bankMarks(detail) : 0,
    preview,
    previewPlain: plainText(preview),
    version: 1,
    status: bankStatusFromWire(row.status),
    usedIn: 0,
  }
}

/* ----------------------------------------------------------------------------- detail */

function keyLines(p: Leaf): SchemeLine[] {
  const k = p.key as { kind: string } & Record<string, unknown>
  switch (k.kind) {
    case 'option':
      return [{ text: `Jawapan betul: ${String(k.correct)}` }]
    case 'options':
      return [{ text: `Jawapan betul: ${(k.correct as string[]).join(', ')}` }]
    case 'accepted':
      return (k.values as unknown[]).map((v) => ({
        text: `Diterima: ${typeof v === 'object' && v !== null ? String((v as { v: unknown }).v) : String(v)}`,
      }))
    case 'mapping': {
      const m = (k.map ?? {}) as Record<string, string>
      return Object.entries(m).map(([a, b]) => ({ text: `${a} = ${b}` }))
    }
    case 'rubric':
      return ((k.bands ?? []) as { name: string; range: [number, number] }[]).map((b) => ({
        text: `${b.name} (${b.range[0]}-${b.range[1]})`,
      }))
    case 'points': {
      const count = new Map<string, number>()
      return ((k.points ?? []) as { code: string; label: string; marks: number }[]).map((pt) => {
        const n = (count.get(pt.code) ?? 0) + 1
        count.set(pt.code, n)
        return { tag: `${pt.code}${n}`, text: pt.label, marks: pt.marks }
      })
    }
    default:
      return []
  }
}

function partsOf(
  parts: readonly QuestionPart[],
  prefix: string,
  scheme: ReviewQuestion['scheme'],
): PartDef[] {
  return parts.map((p, i) => {
    const id = `${prefix}${i + 1}`
    if (!isLeaf(p)) {
      return {
        id,
        label: p.label,
        prompt: p.prompt.ms,
        marks: 0,
        children: partsOf(p.children, `${id}.`, scheme),
      }
    }
    scheme[id] = { marks: p.marks, lines: keyLines(p) }
    return { id, label: p.label, prompt: p.prompt.ms, marks: p.marks, answer: { kind: leafKind(p.mode) } }
  })
}

function leafKind(m: Leaf['mode']): NonNullable<PartDef['answer']>['kind'] {
  return m === 'mcq' || m === 'pksk_choice' ? 'short_text' : m
}

function levelOf(name: string | undefined): CurriculumTag['level'] {
  const n = /([45])/.exec(name ?? '')?.[1]
  return n === '4' ? 'T4' : n === '5' ? 'T5' : 'T4+T5'
}

export function bankDetailFrom(
  d: WireBankDetail,
  subject: { code: string; name: string },
  row: BankRow,
): BankDetail {
  const scheme: ReviewQuestion['scheme'] = {}
  const leaves = d.parts ? leavesOfParts(d.parts) : []
  const single = leaves.length === 1 && leaves[0]!.mode === 'mcq' ? leaves[0] : undefined
  let mcq: ReviewQuestion['mcq']
  let parts: PartDef[] | undefined
  if (single && single.mode === 'mcq') {
    const options: McqOption[] = single.options.map((o) => ({ id: o.label, text: o.body.ms }))
    mcq = { options, correct: single.key.correct }
    scheme[d.id] = { marks: single.marks, lines: keyLines(single) }
  } else if (d.parts && d.parts.length > 0) {
    parts = partsOf(d.parts, `${d.id}-p`, scheme)
  } else if (d.questionType === 'mcq' && d.options) {
    const options: McqOption[] = d.options.map((text, i) => ({ id: LETTERS[i] ?? String(i), text }))
    const correct = d.correctAnswer !== null ? options[d.correctAnswer]?.id : undefined
    mcq = { options, ...(correct ? { correct } : {}) }
    scheme[d.id] = correct ? { marks: d.pointsValue, lines: [{ text: `Jawapan betul: ${correct}` }] } : null
  } else {
    const key =
      d.correctAnswerText ??
      (d.tfAnswer !== null ? (d.tfAnswer ? 'Betul' : 'Salah') : (d.modelAnswer ?? ''))
    scheme[`${d.id}-ans`] = key ? { marks: d.pointsValue, lines: [{ text: key }] } : null
    parts = [{ id: `${d.id}-ans`, label: '', prompt: '', marks: d.pointsValue }]
  }
  const curriculum: CurriculumTag = {
    subject: subject.code,
    level: levelOf(d.level?.name),
    unit: null,
    unitLabel: d.chapterLabel ?? '',
    sp: d.dskp?.sp.code ? [d.dskp.sp.code] : [],
    tp: 3,
    formOrigin: 'T4',
  }
  const question: ReviewQuestion = {
    id: d.id,
    stem: d.questionText,
    marks: bankMarks(d),
    curriculum,
    ...(mcq ? { mcq } : {}),
    ...(parts ? { parts } : {}),
    scheme,
  }
  return {
    row,
    question,
    history: [
      {
        at: Date.parse(d.createdAt),
        by: d.createdBy.name ?? 'Sistem',
        version: 1,
        action: row.status === 'terbit' ? 'Diterbitkan' : 'Dicipta',
      },
    ],
    usedInPapers: [],
    pendingRevision: false,
  }
}
