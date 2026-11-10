/**
 * V2 Panel "Skema & Rubrik" editor (`StructuredRubricEditor`) mapped onto the V3 part tree (D90/D105). A V2 sub-question is a
 * LEAF part; its Skema is the `modelText` of a `points` key and its Poin Rubrik are the key's points. No parallel store: the
 * edit goes back through the same version write as the Studio (an approved question becomes the next draft version).
 *
 * Only a leaf whose key is `points` is editable. A point is matched by row position: the kept row keeps its id, code and every
 * other field (accept, ecf, unit, ...); a new row gets a fresh id and code `P`. Groups, paths and alternatives that name a
 * removed point are trimmed, so the key stays valid.
 */
import { STRUCTURED_RUBRIC_MESSAGES, type QuestionPart, type StructuredRubricSchema } from '@pp/contract'
import type { z } from 'zod'

import { isLeaf, leavesOf } from './workflow/lifecycle/keys-gate'

type Leaf = Extract<QuestionPart, { mode: string }>

interface PointShape {
  id: string
  code: string
  label: string
  marks: number
  text?: { ms: string; en?: string }
  [k: string]: unknown
}
interface PointsKeyShape {
  kind: 'points'
  scheme_v?: number
  marks: number
  points: PointShape[]
  groups?: { id: string; pointIds: string[]; [k: string]: unknown }[]
  paths?: { id: string; pointIds: string[] }[]
  alternatives?: { id: string; pointIds: string[]; [k: string]: unknown }[]
  modelText?: string | { ms: string; en?: string }
  [k: string]: unknown
}

export interface RubricSubView {
  id: string
  number: string
  body: string
  marks: number
  editable: boolean
  scheme: string | null
  points: { id: string; code: string; text: string; marks: number }[]
}

export interface RubricSubInput {
  id: string
  scheme?: string | null
  points?: { text?: string | null; marks: number }[]
}

const pointsKeyOf = (leaf: Leaf): PointsKeyShape | null => {
  const key = (leaf as { key?: { kind?: string } }).key
  return key?.kind === 'points' ? (key as unknown as PointsKeyShape) : null
}

const schemeOf = (key: PointsKeyShape): string | null => {
  const m = key.modelText
  const text = typeof m === 'string' ? m : (m?.ms ?? '')
  return text === '' ? null : text
}

export function rubricSubs(parts: readonly QuestionPart[]): RubricSubView[] {
  return leavesOf(parts).map(({ path, leaf }) => {
    const key = pointsKeyOf(leaf)
    return {
      id: path,
      number: leaf.label,
      body: leaf.prompt.ms,
      marks: leaf.marks,
      editable: key !== null,
      scheme: key ? schemeOf(key) : null,
      points: key ? key.points.map((p) => ({ id: p.id, code: p.code, text: p.text?.ms ?? p.label, marks: p.marks })) : [],
    }
  })
}

const trimIds = <T extends { pointIds: string[] }>(list: T[] | undefined, kept: ReadonlySet<string>): T[] | undefined => {
  if (!list) return undefined
  const out = list.map((g) => ({ ...g, pointIds: g.pointIds.filter((id) => kept.has(id)) })).filter((g) => g.pointIds.length > 0)
  return out.length > 0 ? out : undefined
}

function nextId(taken: Set<string>): string {
  let n = taken.size + 1
  while (taken.has(`p${n}`)) n++
  taken.add(`p${n}`)
  return `p${n}`
}

function rebuildKey(key: PointsKeyShape, input: RubricSubInput): PointsKeyShape {
  const next: PointsKeyShape = { ...key }
  const model = (input.scheme ?? '').trim()
  if (typeof key.modelText === 'object' && key.modelText !== null) {
    if (model === '') delete next.modelText
    else next.modelText = { ...key.modelText, ms: model }
  } else if (model === '') delete next.modelText
  else next.modelText = key.scheme_v === 2 ? { ms: model } : model

  if (input.points !== undefined) {
    const taken = new Set(key.points.map((p) => p.id))
    const rows = input.points
      .map((row, i) => ({ text: (row.text ?? '').trim(), marks: row.marks, old: key.points[i] }))
      .filter((r) => r.text !== '')
    const points: PointShape[] = rows.map((r) => {
      if (r.old) {
        const point: PointShape = { ...r.old, label: r.text, marks: r.marks }
        if (point.text) point.text = { ...point.text, ms: r.text }
        return point
      }
      return { id: nextId(taken), code: 'P', label: r.text, marks: r.marks }
    })
    next.points = points
    const kept = new Set(points.map((p) => p.id))
    const groups = trimIds(key.groups, kept)
    const paths = trimIds(key.paths, kept)
    const alternatives = trimIds(key.alternatives, kept)
    for (const [name, value] of [['groups', groups], ['paths', paths], ['alternatives', alternatives]] as const) {
      if (value) next[name] = value as never
      else delete next[name]
    }
  }
  return next
}

/**
 * The part tree with the sent leaves rewritten. A sent id that is not an editable leaf of THIS question is skipped (a crafted post
 * must not touch anything else). A sent rubric with no non-blank point is refused: a `points` key needs at least one point.
 * Errors are keyed `subs.<index>.points` like the request fields.
 */
export function applyRubric(
  parts: readonly QuestionPart[],
  subs: readonly RubricSubInput[],
): { parts: QuestionPart[]; errors: Record<string, string> } {
  const byId = new Map(subs.map((s, i) => [s.id, { s, i }]))
  const errors: Record<string, string> = {}
  const walk = (list: readonly QuestionPart[], prefix: readonly string[]): QuestionPart[] =>
    list.map((part) => {
      const path = [...prefix, part.label]
      if (!isLeaf(part)) return { ...part, children: walk((part as { children: QuestionPart[] }).children, path) } as QuestionPart
      const hit = byId.get(path.join('.'))
      const key = pointsKeyOf(part)
      if (!hit || !key) return part
      const key2 = rebuildKey(key, hit.s)
      if (key2.points.length === 0) {
        errors[`subs.${hit.i}.points`] = STRUCTURED_RUBRIC_MESSAGES.noPoints
        return part
      }
      return { ...part, key: key2 } as unknown as QuestionPart
    })
  return { parts: walk(parts, []), errors }
}

/** The editor payload of the wire (`StructuredRubric`). */
export type StructuredRubricView = z.output<typeof StructuredRubricSchema>
