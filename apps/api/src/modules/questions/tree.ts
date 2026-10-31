/**
 * Pure mapping between the contract part tree (`QuestionPart[]`) and the rows of `question_parts`,
 * `part_options` and `answer_keys`. No database access: the repository reads and writes the rows,
 * this file only converts. A key that does not parse as the contract leaf for its mode fails
 * closed (`StoredKeyError`, mapped to a 500 by the service with the part id logged).
 */
import { QuestionLeafPartSchema, type QuestionCognitiveLevel, type QuestionPart } from '@pp/contract'

import type { AnswerKey, PartOption, QuestionPart as PartRow } from '../../db/generated/client'
import { idFromString, idToString } from '../../db/ids'
import { kbatOfCognitive } from './effective-leaf'
import { isLeaf, type QuestionLeaf } from './grading'

export class StoredKeyError extends Error {
  constructor(readonly partId: string) {
    super(`Stored answer key of part ${partId} does not match its mode`)
    this.name = 'StoredKeyError'
  }
}

/** The depth limit of the part tree (D1): (a), (i), (A). */
export const MAX_PART_DEPTH = 3

const rich = (ms: string | null, en: string | null): { ms: string; en?: string } => (en === null ? { ms: ms ?? '' } : { ms: ms ?? '', en })

// --- rows -> tree ---------------------------------------------------------------------------------

export function partsFromRows(rows: readonly PartRow[], options: readonly PartOption[], keys: readonly AnswerKey[]): QuestionPart[] {
  const children = new Map<string, PartRow[]>()
  for (const row of rows) {
    const k = row.parentPartId === null ? '' : idToString(row.parentPartId)
    children.set(k, [...(children.get(k) ?? []), row])
  }
  const optionsOf = new Map<bigint, PartOption[]>()
  for (const o of options) optionsOf.set(o.partId, [...(optionsOf.get(o.partId) ?? []), o])
  const keyOf = new Map<bigint, AnswerKey>(keys.map((k) => [k.partId, k]))

  const build = (parent: string): QuestionPart[] =>
    (children.get(parent) ?? [])
      .slice()
      .sort((a, b) => a.position - b.position || (a.id < b.id ? -1 : 1))
      .map((row) => {
        const kids = children.get(idToString(row.id))
        if (row.mode === null || row.marks === null) {
          return { label: row.label, prompt: rich(row.promptMs, row.promptEn), children: build(idToString(row.id)) } as QuestionPart
        }
        if (kids && kids.length > 0) throw new StoredKeyError(idToString(row.id))
        return leafFromRow(row, (optionsOf.get(row.id) ?? []).slice().sort((a, b) => a.position - b.position), keyOf.get(row.id))
      })
  return build('')
}

function leafFromRow(row: PartRow, options: PartOption[], key: AnswerKey | undefined): QuestionLeaf {
  const candidate: Record<string, unknown> = {
    label: row.label,
    prompt: rich(row.promptMs, row.promptEn),
    marks: row.marks,
    mode: row.mode,
    key: key?.content,
  }
  if (row.stimulusId !== null) candidate.stimulusId = idToString(row.stimulusId)
  if (row.reveal === 'never') candidate.reveal = 'never'
  // BJS-06: per-leaf overrides; NULL stays absent (inherit the version value).
  if (row.unitNodeId !== null) candidate.unitNodeId = idToString(row.unitNodeId)
  if (row.formOrigin !== null) candidate.formOrigin = row.formOrigin
  if (row.difficultyTp !== null) candidate.difficultyTp = row.difficultyTp
  if (row.kbat !== null) candidate.kbat = row.kbat
  if (row.cognitiveLevel !== null) candidate.cognitiveLevel = row.cognitiveLevel
  if (row.mode === 'mcq' || row.mode === 'pksk_choice') {
    candidate.options = options.map((o) => ({
      label: o.label,
      body: rich(o.bodyMs, o.bodyEn),
      ...(o.imageFileId === null ? {} : { imageId: idToString(o.imageFileId) }),
    }))
  }
  if (row.mode === 'short_text' && row.blankCount !== null) candidate.blankCount = row.blankCount
  if (row.mode === 'essay' && row.wordMin !== null && row.wordMax !== null) candidate.wordRange = { min: row.wordMin, max: row.wordMax }
  const parsed = QuestionLeafPartSchema.safeParse(candidate)
  if (!parsed.success) throw new StoredKeyError(idToString(row.id))
  return parsed.data as QuestionLeaf
}

// --- tree -> row drafts ---------------------------------------------------------------------------

export interface OptionDraft {
  label: string
  bodyMs: string
  bodyEn: string | null
  imageFileId: bigint | null
  position: number
}

export interface PartDraft {
  label: string
  position: number
  depth: number
  promptMs: string
  promptEn: string | null
  marks: number | null
  mode: QuestionLeaf['mode'] | null
  blankCount: number | null
  wordMin: number | null
  wordMax: number | null
  stimulusId: bigint | null
  reveal: 'after_submit' | 'never'
  unitNodeId: bigint | null
  formOrigin: 't1_t3' | 't4' | 't5' | null
  difficultyTp: number | null
  kbat: 'mengaplikasi' | 'menganalisis' | 'menilai' | 'mencipta' | 'bukan' | null
  /** Leaf only (migration 0102). */
  cognitiveLevel: QuestionCognitiveLevel | null
  options: OptionDraft[]
  key: { kind: string; content: unknown } | null
  children: PartDraft[]
}

/** Ordered drafts for the repository to insert (positions are 1-based, depth 1 to 3). */
export function draftsFromParts(parts: readonly QuestionPart[], depth = 1): PartDraft[] {
  return parts.map((part, i) => {
    const base = {
      label: part.label,
      position: i + 1,
      depth,
      promptMs: part.prompt.ms,
      promptEn: part.prompt.en ?? null,
    }
    if (!isLeaf(part)) {
      return {
        ...base,
        marks: null,
        mode: null,
        blankCount: null,
        wordMin: null,
        wordMax: null,
        stimulusId: null,
        reveal: 'after_submit' as const,
        unitNodeId: null,
        formOrigin: null,
        difficultyTp: null,
        kbat: null,
        cognitiveLevel: null,
        options: [],
        key: null,
        children: draftsFromParts(part.children as QuestionPart[], depth + 1),
      }
    }
    return {
      ...base,
      marks: part.marks,
      mode: part.mode,
      blankCount: part.mode === 'short_text' ? (part.blankCount ?? null) : null,
      wordMin: part.mode === 'essay' ? (part.wordRange?.min ?? null) : null,
      wordMax: part.mode === 'essay' ? (part.wordRange?.max ?? null) : null,
      stimulusId: part.stimulusId === undefined ? null : idFromString(part.stimulusId),
      reveal: part.reveal ?? 'after_submit',
      unitNodeId: part.unitNodeId == null ? null : idFromString(part.unitNodeId),
      formOrigin: part.formOrigin ?? null,
      difficultyTp: part.difficultyTp ?? null,
      // The four upper cognitive levels are KBAT: an explicit `kbat` wins, else it follows the level (D76).
      kbat: part.kbat ?? kbatOfCognitive(part.cognitiveLevel),
      cognitiveLevel: part.cognitiveLevel ?? null,
      options:
        part.mode === 'mcq' || part.mode === 'pksk_choice'
          ? part.options.map((o, j) => ({
              label: o.label,
              bodyMs: o.body.ms,
              bodyEn: o.body.en ?? null,
              imageFileId: o.imageId == null ? null : idFromString(o.imageId),
              position: j + 1,
            }))
          : [],
      key: { kind: part.key.kind, content: part.key },
      children: [],
    }
  })
}

/** Every `imageId` and `stimulusId` the tree references (decimal strings), for existence checks. */
export function referencedIds(parts: readonly QuestionPart[]): { imageIds: string[]; stimulusIds: string[]; unitIds: string[] } {
  const imageIds: string[] = []
  const unitIds: string[] = []
  const stimulusIds: string[] = []
  const walk = (list: readonly QuestionPart[]): void => {
    for (const part of list) {
      if (!isLeaf(part)) {
        walk(part.children as QuestionPart[])
        continue
      }
      if (part.stimulusId !== undefined) stimulusIds.push(part.stimulusId)
      if (part.unitNodeId != null) unitIds.push(part.unitNodeId)
      if (part.mode === 'mcq' || part.mode === 'pksk_choice') for (const o of part.options) if (o.imageId != null) imageIds.push(o.imageId)
    }
  }
  walk(parts)
  return { imageIds, stimulusIds, unitIds }
}

/**
 * A copy of the tree with every MCQ option picture id passed through `map` (a public token to the internal id on the way in,
 * the other way on the way out). Everything else is kept as it is.
 */
export async function mapOptionImageIds(parts: readonly QuestionPart[], map: (id: string) => string | Promise<string>): Promise<QuestionPart[]> {
  const out: QuestionPart[] = []
  for (const part of parts) {
    if (!isLeaf(part)) {
      out.push({ ...part, children: await mapOptionImageIds(part.children as QuestionPart[], map) } as QuestionPart)
    } else if (part.mode === 'mcq' || part.mode === 'pksk_choice') {
      const options = []
      for (const o of part.options) options.push(o.imageId == null ? o : { ...o, imageId: await map(o.imageId) })
      out.push({ ...part, options } as QuestionPart)
    } else out.push(part)
  }
  return out
}

/** Total marks of the leaves (flat `pointsValue`, structured `totalMarks`). */
export function totalMarks(parts: readonly QuestionPart[]): number {
  return parts.reduce((s, p) => s + (isLeaf(p) ? p.marks : totalMarks(p.children as QuestionPart[])), 0)
}

/** Part type of a version: `structured` for a tree or several leaves, otherwise by the single leaf mode. */
export function versionTypeOf(parts: readonly QuestionPart[]): 'mcq' | 'match' | 'short' | 'structured' | 'working' | 'essay' | 'drawing' | 'table' {
  const [only] = parts
  if (parts.length !== 1 || only === undefined || !isLeaf(only)) return 'structured'
  switch (only.mode) {
    case 'mcq':
    case 'pksk_choice':
      return 'mcq'
    case 'match_letter':
      return 'match'
    case 'short_text':
    case 'numeric':
      return 'short'
    case 'working':
      return 'working'
    case 'essay':
    case 'essay_choice':
      return 'essay'
    case 'drawing':
      return 'drawing'
    case 'table_fill':
      return 'table'
  }
}
