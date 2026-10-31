/**
 * Simulasi Kuiz mapping (R1-B16). PURE: no database, no clock. Turns a stored question version into quiz items and
 * keeps the answer key on the server side of the line: an item never carries `key`, `correct` or the explanation.
 *
 * An item is one LEAF of the part tree (V2 "part"): an `mcq` leaf is objective and markable, any other leaf is `open`
 * (shown with an unsaved textarea). Item ids: the question id for a question that is one single leaf, else
 * `{questionId}:{path}` with the labels stripped to `[A-Za-z0-9]` and joined by `.` (`(a)(ii)` -> `a.ii`).
 */
import type { BijakKuizItem } from '@pp/contract'
import type { QuestionPart } from '@pp/contract'

import { stimulusTableOf } from '../../questions/stimulus-table'
import type { QuestionRecord, StimulusGroupRecord } from '../../questions/types'

type Leaf = Extract<QuestionPart, { mode: string }>
type McqLeaf = Extract<Leaf, { mode: 'mcq' }>

const isLeaf = (p: QuestionPart): p is Leaf => 'mode' in p

export interface LeafRef {
  /** Item id. */
  id: string
  /** Stripped label path, or null for a question that is one single top-level leaf. */
  path: string | null
  /** Prompts of the parent parts, outermost first. */
  lead: string[]
  leaf: Leaf
}

const stripLabel = (label: string): string => label.replace(/[^A-Za-z0-9]/g, '')

/** Every leaf of a part tree in order, with its item id. A repeated path keeps the first leaf only. */
export function leavesOf(questionId: string, parts: readonly QuestionPart[]): LeafRef[] {
  const out: LeafRef[] = []
  const seen = new Set<string>()
  const walk = (list: readonly QuestionPart[], labels: string[], lead: string[]): void => {
    for (const p of list) {
      const path = [...labels, stripLabel(p.label)].filter((s) => s !== '')
      if (isLeaf(p)) {
        const key = path.join('.')
        const single = parts.length === 1 && labels.length === 0
        const id = single ? questionId : `${questionId}:${key}`
        if (seen.has(id)) continue
        seen.add(id)
        out.push({ id, path: single ? null : key, lead, leaf: p })
      } else {
        walk(p.children as readonly QuestionPart[], path, [...lead, p.prompt.ms])
      }
    }
  }
  walk(parts, [], [])
  return out
}

/** The leaf an item id names, or null when it names none (or a malformed id). */
export function leafOf(record: QuestionRecord, itemId: string): LeafRef | null {
  return leavesOf(record.id, record.version.parts).find((l) => l.id === itemId) ?? null
}

/** An objective leaf the quiz can mark: an MCQ whose key names one of its options. */
export function markableLeaf(l: LeafRef): McqLeaf | null {
  const leaf = l.leaf
  if (leaf.mode !== 'mcq') return null
  return leaf.options.some((o) => o.label === leaf.key.correct) ? leaf : null
}

/** The item id's question id (`123` or `123:a.i`), or null when the id is malformed. */
export function questionIdOfItem(itemId: string): string | null {
  const m = /^(\d{1,20})(?::[A-Za-z0-9.]{1,40})?$/.exec(itemId)
  return m ? (m[1] as string) : null
}

/** Unbiased shuffle with an injected integer source (`pick(n)` returns 0..n-1). */
export function shuffled<T>(list: readonly T[], pick: (n: number) => number): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = pick(i + 1)
    const t = a[i] as T
    a[i] = a[j] as T
    a[j] = t
  }
  return a
}

export type KuizStimulus = BijakKuizItem['stimuli'][number]

/** What the service resolved around one question (groups, image tokens, curriculum names). */
export interface ItemContext {
  /** Stimuli to show with the question (group stimuli, stem image, linked image stimuli), in order. */
  stimuli: KuizStimulus[]
  subjectName: string | null
  /** Internal file id -> public token. */
  tokens: ReadonlyMap<string, string>
  pick(n: number): number
}

const tokenOf = (ctx: ItemContext, fileId: string | null | undefined): string | null =>
  fileId ? (ctx.tokens.get(fileId) ?? null) : null

/** One item for a leaf. The key, the explanation and the leaf curriculum fields never enter the object. */
export function toItem(record: QuestionRecord, ref: LeafRef, ctx: ItemContext): BijakKuizItem {
  const mcq = markableLeaf(ref)
  const leaf = ref.leaf
  const options = mcq
    ? shuffled(mcq.options, ctx.pick).map((o, i) => ({
        id: o.label,
        label: String.fromCharCode(65 + i),
        text: o.body.ms,
        imageToken: tokenOf(ctx, o.imageId),
      }))
    : []
  return {
    id: ref.id,
    groupId: record.groupId,
    kind: leaf.mode === 'mcq' ? 'mcq' : 'open',
    stem: record.version.stemMs,
    lead: ref.lead,
    path: ref.path,
    prompt: leaf.prompt.ms,
    marks: leaf.marks,
    markable: mcq !== null,
    subjectName: ctx.subjectName,
    stimuli: ctx.stimuli,
    options,
  }
}

/** Image file ids a question's items may need a token for (options of every leaf, stimuli are added by the caller). */
export function optionImageIds(record: QuestionRecord): string[] {
  const out: string[] = []
  for (const l of leavesOf(record.id, record.version.parts)) {
    if (l.leaf.mode === 'mcq') for (const o of l.leaf.options) if (o.imageId) out.push(o.imageId)
  }
  return out
}

/** The stimulus ids the question (version and leaf parts) links to directly, outside any group. */
export function linkedStimulusIds(record: QuestionRecord): string[] {
  const out = new Set(record.version.stimulusIds)
  for (const l of leavesOf(record.id, record.version.parts)) if (l.leaf.stimulusId) out.add(l.leaf.stimulusId)
  return [...out]
}

/** Everything the mapper needs of a stimulus linked straight to a version (outside its group), read by the service. */
export interface OwnStimulus {
  kind: string
  label: string
  bodyMs: string | null
  alt: string | null
  caption: string | null
  sourceCitation: string | null
  tableData: unknown
  assetFileId: string | null
  /** Distinct active questions linking it; more than one means it must be a stimulus group (D90). */
  sharedBy: number
}

type StimulusLike = {
  kind: string
  label: string
  bodyMs: string | null
  alt: string | null
  caption?: string | null
  sourceCitation?: string | null
  tableData?: unknown
  assetFileId: string | null
}

const KUIZ_KINDS: ReadonlySet<string> = new Set(['passage', 'table', 'diagram', 'image', 'map', 'infographic', 'graph'])

/**
 * One stimulus on the kuiz wire, all seven kinds with caption, source and table grid (R1-T07 read model, same table reader
 * as the Studio and the bridge). Null when the kind is unknown or there is nothing to show (no text, table or picture).
 */
export function toKuizStimulus(s: StimulusLike): KuizStimulus | null {
  if (!KUIZ_KINDS.has(s.kind)) return null
  const table = s.kind === 'table' ? (stimulusTableOf(s.tableData, s.bodyMs) ?? null) : null
  // A table parsed from the body replaces the body text; any other body stays the text.
  const text = s.bodyMs?.trim() ? s.bodyMs : null
  const body = table && !s.tableData ? null : text
  if (!body && !table && !s.assetFileId) return null
  return {
    kind: s.kind as KuizStimulus['kind'],
    label: s.label,
    body,
    imageToken: null,
    // An unlabelled own picture still gets a text alternative (same line as the bridge, R1E2E-05b).
    alt: s.alt ?? (!s.label && s.assetFileId && !body && !table ? 'Gambar untuk soalan ini' : null),
    caption: s.caption ?? null,
    source: s.sourceCitation ?? null,
    table,
  }
}

export interface ResolvedStimuli {
  /** Each stimulus with the internal file id of its picture (null when it has none); tokens are filled by `stimuliWithTokens`. */
  entries: Array<{ stimulus: KuizStimulus; file: string | null }>
  /** False when a stimulus cannot be shown (unknown, audio, empty, or shared by several questions without being a group): the question cannot be served. */
  complete: boolean
  /** The first `groupCount` entries belong to the question's stimulus group (D90); the rest are linked to the question itself. */
  groupCount: number
}

/**
 * Stimuli of a question: those of its group (any of the seven kinds), then the question's OWN stimuli linked straight to the
 * version or to a leaf (R1E2E-05b: any kind, link order, with caption, source, table). D90: a stimulus linked to several
 * questions must be a group, so one that is shared and not grouped makes the question incomplete, as does an unknown, audio
 * or empty one. Never silently dropped.
 */
export function resolveStimuli(
  record: QuestionRecord,
  group: StimulusGroupRecord | null,
  own: ReadonlyMap<string, OwnStimulus>,
): ResolvedStimuli {
  const entries: ResolvedStimuli['entries'] = []
  const inGroup = new Set<string>()
  const files = new Set<string>()
  let complete = true
  for (const s of group?.stimuli ?? []) {
    inGroup.add(s.id)
    const w = toKuizStimulus(s)
    if (!w) {
      complete = false
      continue
    }
    entries.push({ stimulus: w, file: s.assetFileId })
    if (s.assetFileId) files.add(s.assetFileId)
  }
  const groupCount = entries.length
  for (const id of linkedStimulusIds(record)) {
    if (inGroup.has(id)) continue
    const a = own.get(id)
    const w = a && a.sharedBy <= 1 ? toKuizStimulus(a) : null
    if (!a || !w) {
      complete = false
      continue
    }
    if (a.assetFileId) {
      // The same picture twice is shown once, but only when the duplicate has no label of its own (the stem picture of a group).
      if (files.has(a.assetFileId) && !w.label) continue
      files.add(a.assetFileId)
    }
    entries.push({ stimulus: w, file: a.assetFileId })
  }
  return { entries, complete, groupCount }
}

/**
 * The stimuli with their picture tokens filled. `part`: `all` (random quiz: the group stimulus shown above the item),
 * `own` (per-paper quiz item: only what is linked to the question, the group is rendered once by the page) or `group`.
 */
export function stimuliWithTokens(resolved: ResolvedStimuli, tokens: ReadonlyMap<string, string>, part: 'all' | 'own' | 'group' = 'all'): KuizStimulus[] {
  const list = part === 'all' ? resolved.entries : part === 'group' ? resolved.entries.slice(0, resolved.groupCount) : resolved.entries.slice(resolved.groupCount)
  return list.map((e) => ({ ...e.stimulus, imageToken: e.file ? (tokens.get(e.file) ?? null) : null }))
}
