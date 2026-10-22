/**
 * Review queue wire (BE-38): the extracted items of every batch are the queue. Pure mappers from the
 * contract shapes (`IntakeItemRow`, `IntakeItem`, `IntakeConfidenceBand`) to the queue shapes the
 * pages read (`QueueItem`, `ReviewDetail`). Type-only imports from the contract; never `store.ts`.
 *
 * Status mapping (the queue has the mock's four statuses; accept creates a Draf question, it never
 * publishes, D54a): generated / needs_review / duplicate = `semakan` (waiting), accepted = `draf`
 * (the Draf question exists), rejected = `ditolak`. Nothing is `terbit` here.
 */
import type {
  IntakeConfidenceBand,
  IntakeEventAction,
  IntakeItem,
  IntakeItemRow,
  IntakeItemState,
  IntakeItemStateCounts,
} from '@pp/contract'

import { intakeToDef } from '../admin/intake/domain/convert'
import { questionMarks } from '../admin/intake/domain/marks'
import type {
  Confidence,
  HistoryEntry,
  QueueItem,
  QuestionKind,
  QuestionStatus,
  ReviewDetail,
  ReviewQuestion,
  SchemeLine,
} from '../domain/admin-types'
import { leavesOf } from '../domain/paper-model'
import type { QuestionDef, SchemeDef } from '../domain/types'
import { questionFromItem, stimulusFromWire } from './intake-wire'

const DAY = 86_400_000
const LETTERS = 'ABCDEFGH'

export function queueStatusFromState(s: IntakeItemState): QuestionStatus {
  if (s === 'accepted') return 'draf'
  if (s === 'rejected') return 'ditolak'
  return 'semakan'
}

/** The wire states that the queue status stands for (a filter by status is a filter by these). */
export function statesOfStatus(s: QuestionStatus | 'semua'): IntakeItemState[] | null {
  switch (s) {
    case 'semakan':
      return ['generated', 'needs_review', 'duplicate']
    case 'draf':
      return ['accepted']
    case 'ditolak':
      return ['rejected']
    case 'terbit':
      return []
    default:
      return null
  }
}

export function countsFromWire(c: IntakeItemStateCounts): Record<QuestionStatus, number> {
  return {
    semakan: c.generated + c.needs_review + c.duplicate,
    draf: c.accepted,
    ditolak: c.rejected,
    terbit: 0,
  }
}

export function kindFromType(t: IntakeItemRow['type']): QuestionKind {
  if (t === 'mcq') return 'objektif'
  if (t === 'essay') return 'esei'
  return 'berstruktur'
}

export function confidenceFromBand(b: IntakeConfidenceBand): Confidence {
  return b === 'high' ? 'tinggi' : b === 'medium' ? 'sederhana' : 'rendah'
}

/** Plain text of a stem with `$latex$` spans (card titles). */
export function plainText(text: string): string {
  return text
    .replace(/\\frac\{([^}]*)\}\{([^}]*)\}/g, '$1/$2')
    .replace(/\\times/g, '×')
    .replace(/\\text\{([^}]*)\}/g, '$1')
    .replace(/[$\\{}]/g, '')
}

export interface QueueContext {
  subjectName: (code: string) => string
  /** Kertas and source of the batch (the row only has its id). */
  batch: { kertas: number; source: string } | undefined
  now: number
}

const ageOf = (iso: string, now: number): number => Math.max(0, Math.floor((now - Date.parse(iso)) / DAY))

export function queueItemFromRow(row: IntakeItemRow, ctx: QueueContext): QueueItem {
  return {
    key: row.id,
    isRevision: false,
    questionIds: [row.id],
    subject: row.subject,
    subjectName: ctx.subjectName(row.subject),
    kertas: ctx.batch?.kertas ?? 0,
    kind: kindFromType(row.type),
    topic: '',
    preview: row.stemPreview,
    previewPlain: plainText(row.stemPreview),
    marks: row.marks,
    version: row.question?.version ?? 1,
    source: ctx.batch?.source ?? '',
    uploader: row.uploader.name,
    ageDays: ageOf(row.createdAt, ctx.now),
    confidence: confidenceFromBand(row.confidenceBand),
    status: queueStatusFromState(row.state),
  }
}

/** The row an item would have (the detail has no preview of its own). */
export function rowOfItem(item: IntakeItem): IntakeItemRow {
  const q = questionFromItem(item)
  const first = item.stem.trim() || item.parts[0]?.prompt || ''
  return {
    id: item.id,
    label: item.label,
    type: item.type,
    stemPreview: first.slice(0, 300),
    marks: questionMarks(q),
    page: item.page,
    subject: item.tag.subject,
    ...(item.stimulusId ? { stimulusId: item.stimulusId } : {}),
    lowCount: item.lowFields.filter((f) => !item.confirmed.includes(f)).length,
    issueCount: item.issues.length,
    needsManual: item.needsManual === true,
    batchId: item.batchId,
    position: item.position,
    state: item.state,
    confidenceBand: item.confidenceBand,
    uploader: item.uploader,
    question: item.question,
    duplicates: item.duplicates,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

/* ------------------------------------------------------------------------- scheme lines */

function describeScheme(sc: SchemeDef): SchemeLine[] {
  switch (sc.kind) {
    case 'option':
      return sc.reason ? [{ text: sc.reason }] : []
    case 'accepted':
      return sc.values.map((v) => ({ text: `Diterima: ${v.v}${v.unit ? ` ${v.unit}` : ''}` }))
    case 'mapping':
      return Object.entries(sc.map).map(([k, v]) => ({ text: `${k} = ${v}` }))
    case 'rubric':
      return [
        ...sc.bands.map((b) => ({
          text: `${b.name} (${b.range[0]}-${b.range[1]}): ${b.descriptor}`,
        })),
        ...(sc.notes ?? []).map((n) => ({ text: n })),
      ]
    case 'points': {
      const count = new Map<string, number>()
      const lines: SchemeLine[] = sc.points.map((p) => {
        const n = (count.get(p.code) ?? 0) + 1
        count.set(p.code, n)
        return { tag: `${p.code}${n}`, text: p.label, marks: p.marks }
      })
      if (sc.final) lines.push({ text: `Jawapan akhir: $${sc.final.display}$` })
      return lines
    }
  }
}

/** A bank question with its schemes as the review preview shows it. */
export function reviewQuestionOf(q: QuestionDef, schemes: Record<string, SchemeDef>, marks: number): ReviewQuestion {
  const scheme: ReviewQuestion['scheme'] = {}
  let correct: string | undefined
  if (q.mcq) {
    const sc = schemes[q.id]
    if (sc?.kind === 'option') {
      correct = sc.correct
      const letter = LETTERS[q.mcq.options.findIndex((o) => o.id === sc.correct)] ?? '?'
      scheme[q.id] = {
        marks: sc.marks,
        lines: [{ text: `Jawapan betul: ${letter}` }, ...describeScheme(sc)],
      }
    } else scheme[q.id] = null
  } else {
    for (const l of leavesOf(q.parts ?? [])) {
      const sc = schemes[l.id]
      scheme[l.id] = sc ? { marks: sc.marks, lines: describeScheme(sc) } : null
    }
  }
  return {
    id: q.id,
    stem: q.stem,
    marks,
    curriculum: q.curriculum,
    ...(q.mcq ? { mcq: { options: q.mcq.options, ...(correct ? { correct } : {}) } } : {}),
    ...(q.parts ? { parts: q.parts } : {}),
    scheme,
  }
}

/* ---------------------------------------------------------------------------- history */

const ACTION_LABEL: Record<IntakeEventAction, string> = {
  extracted: 'Diekstrak',
  added: 'Ditambah',
  edited: 'Disunting',
  confirmed: 'Disahkan',
  accepted: 'Diterima (Draf)',
  rejected: 'Ditolak',
  marked_duplicate: 'Ditandakan pendua',
  cleared_duplicate: 'Bukan pendua',
  linked_variant: 'Dipaut sebagai varian',
}

export function historyFromWire(events: IntakeItem['events']): HistoryEntry[] {
  return events.map((e) => ({
    at: Date.parse(e.at),
    by: e.actor?.name ?? 'Sistem',
    version: 1,
    action: ACTION_LABEL[e.action],
    ...(e.reason ? { note: e.reason } : e.field ? { note: e.field } : {}),
  }))
}

export function reviewDetailFromItem(item: IntakeItem, ctx: QueueContext): ReviewDetail {
  const question = questionFromItem(item)
  const content = intakeToDef(question, { qid: item.id, newPartId: (j) => `${item.id}-n${j}` })
  const row = rowOfItem(item)
  const detail: ReviewDetail = {
    item: queueItemFromRow(row, ctx),
    questions: [reviewQuestionOf(content.question, content.schemes, row.marks)],
    history: historyFromWire(item.events),
    // The gate of accept: the item's own issues, as "Soalan 3(b): message".
    gate: item.issues.map((i) => `${i.where}: ${i.message}`),
  }
  detail.item.topic = item.tag.unitLabel
  if (item.rejectReason) detail.reason = item.rejectReason
  if (item.stimulus) detail.stimulus = stimulusFromWire(item.stimulus)
  return detail
}
