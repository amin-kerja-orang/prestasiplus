/**
 * Paper builder rules (pure), a verbatim port of the prototype `domain/paper-builder.ts`: stimulus
 * groups move as one unit and stay contiguous; the live budget check compares each section with the
 * blueprint. The section marks come from the shared domain (`effectiveMarks`, via the adapter); this
 * file has no marks-budget or choose-N rule of its own. Lines are the BM texts of the contract.
 */
import { BIJAK_BUILDER_CHECK_LINES as LINES } from '@pp/contract'

import { GROUP_MIN_MEMBERS_MESSAGE, MIN_GROUP_MEMBERS } from './builder.constants'
import { effectiveMarks } from './exam-core.adapter'

export interface BuilderSectionSpec {
  label: string
  markBudget: number
  questionCount: number
  rule: { type: 'all' } | { type: 'choose'; n: number }
}

export type GroupOf = (questionId: string) => string | undefined
export type MembersOf = (groupId: string) => string[]

/** Units of a section list: a group (whole, in order) or a single question. */
export interface Unit {
  ids: string[]
  groupId?: string
}

export function unitsOf(ids: readonly string[], groupOf: GroupOf): Unit[] {
  const units: Unit[] = []
  for (const id of ids) {
    const g = groupOf(id)
    const last = units[units.length - 1]
    if (g && last?.groupId === g) last.ids.push(id)
    else units.push(g ? { ids: [id], groupId: g } : { ids: [id] })
  }
  return units
}

/** Adds a question; when it belongs to a group, the whole group is added in published order. */
export function addUnit(
  ids: readonly string[],
  questionId: string,
  groupOf: GroupOf,
  membersOf: MembersOf,
): string[] {
  if (ids.includes(questionId)) return [...ids]
  const g = groupOf(questionId)
  const add = g ? membersOf(g) : [questionId]
  return [...ids, ...add.filter((id) => !ids.includes(id))]
}

/** Removes a question; a group question removes its whole group. */
export function removeUnit(ids: readonly string[], questionId: string, groupOf: GroupOf): string[] {
  const g = groupOf(questionId)
  return ids.filter((id) => (g ? groupOf(id) !== g : id !== questionId))
}

/** Moves the unit at `index` by `delta` positions (never splits a group). */
export function moveUnit(
  ids: readonly string[],
  index: number,
  delta: -1 | 1,
  groupOf: GroupOf,
): string[] {
  const units = unitsOf(ids, groupOf)
  const to = index + delta
  if (index < 0 || index >= units.length || to < 0 || to >= units.length) return [...ids]
  const next = [...units]
  const [u] = next.splice(index, 1)
  next.splice(to, 0, u!)
  return next.flatMap((x) => x.ids)
}

/**
 * D90: makes a list of ids a valid section list. Every stimulus group is expanded to ALL its members,
 * contiguous and in the group's published order, at the position of its first member; repeats are
 * dropped (the first occurrence wins).
 */
export function normalizeUnits(ids: readonly string[], groupOf: GroupOf, membersOf: MembersOf): string[] {
  const out: string[] = []
  const done = new Set<string>()
  for (const id of ids) {
    if (done.has(id)) continue
    const g = groupOf(id)
    const add = g ? [...new Set([...membersOf(g), ...(membersOf(g).includes(id) ? [] : [id])])] : [id]
    for (const m of add) {
      if (done.has(m)) continue
      done.add(m)
      out.push(m)
    }
  }
  return out
}

/**
 * D90: moves whole units. `order` names each unit once (any member id for a group). Returns null when
 * it is not a permutation of the units of `ids`.
 */
export function reorderUnits(ids: readonly string[], order: readonly string[], groupOf: GroupOf): string[] | null {
  const units = unitsOf(ids, groupOf)
  const unitOfId = new Map<string, number>()
  units.forEach((u, i) => u.ids.forEach((id) => unitOfId.set(id, i)))
  const used = new Set<number>()
  const out: string[] = []
  for (const id of order) {
    const i = unitOfId.get(id)
    if (i === undefined || used.has(i)) return null
    used.add(i)
    out.push(...units[i]!.ids)
  }
  return used.size === units.length ? out : null
}

export interface SectionCheck {
  label: string
  count: number
  need: number
  marks: number
  budget: number
  /** Blocking problems (publish is refused while any remain). */
  errors: string[]
  /** Notes that do not block. */
  notes: string[]
  ok: boolean
}

export interface PaperCheck {
  sections: SectionCheck[]
  /** Paper-level blocking problems (duplicates, unpublished questions, broken groups). */
  errors: string[]
  totalMarks: number
  totalBudget: number
  ok: boolean
}

export interface CheckInput {
  specs: readonly BuilderSectionSpec[]
  sections: readonly { questionIds: readonly string[] }[]
  marksOf: (questionId: string) => number
  groupOf: GroupOf
  membersOf: MembersOf
  /** Question ids that are not Terbit. */
  isLive: (questionId: string) => boolean
  nameOf?: (questionId: string) => string
  /**
   * D93: true when the group is a real stimulus group of the bank (the port knows it). Only such a group needs
   * `MIN_GROUP_MEMBERS` members; absent = every group counts.
   */
  isStimulusGroup?: (groupId: string) => boolean
}

export function checkPaper(input: CheckInput): PaperCheck {
  const { specs, sections, marksOf, groupOf, membersOf, isLive } = input
  const errors: string[] = []
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const s of sections) for (const id of s.questionIds) (seen.has(id) ? dup : seen).add(id)
  if (dup.size) errors.push(LINES.duplicateQuestion([...dup]))

  // D93 (a D90 group-integrity rule, never overridable): a stimulus group with fewer than two members cannot be placed.
  const tooSmall = new Set<string>()
  for (const s of sections)
    for (const id of s.questionIds) {
      const g = groupOf(id)
      if (g && (input.isStimulusGroup?.(g) ?? true) && membersOf(g).length < MIN_GROUP_MEMBERS) tooSmall.add(g)
    }
  if (tooSmall.size) errors.push(GROUP_MIN_MEMBERS_MESSAGE)

  // A group must live in one section, contiguous and complete.
  const sectionOfGroup = new Map<string, number>()
  sections.forEach((s, si) => {
    for (const id of s.questionIds) {
      const g = groupOf(id)
      if (!g) continue
      const prev = sectionOfGroup.get(g)
      if (prev !== undefined && prev !== si) errors.push(LINES.groupSplit(g))
      sectionOfGroup.set(g, si)
    }
  })

  const out: SectionCheck[] = specs.map((spec, i) => {
    const ids = sections[i]?.questionIds ?? []
    const secErrors: string[] = []
    const notes: string[] = []
    const marks = effectiveMarks(spec.rule, ids.map(marksOf))
    if (ids.length !== spec.questionCount)
      secErrors.push(
        ids.length < spec.questionCount
          ? LINES.tooFew(spec.questionCount, ids.length)
          : LINES.tooMany(spec.questionCount, ids.length),
      )
    if (marks !== spec.markBudget) secErrors.push(LINES.marksMismatch(marks, spec.markBudget))
    if (spec.rule.type === 'choose') {
      const marksList = ids.map(marksOf)
      if (new Set(marksList).size > 1)
        notes.push('Soalan pilihan sepatutnya sama markah supaya pilihan adil')
    }
    const unitList = unitsOf(ids, groupOf)
    const groupsSeen = new Set<string>()
    for (const u of unitList) {
      if (!u.groupId) continue
      if (groupsSeen.has(u.groupId)) secErrors.push(LINES.groupNotConsecutive(u.groupId))
      groupsSeen.add(u.groupId)
      const all = membersOf(u.groupId)
      const missing = all.filter((m) => !ids.includes(m))
      if (missing.length) secErrors.push(LINES.groupIncomplete(u.groupId, missing.length))
      // D90: the members run in the group's published order.
      const expected = all.filter((m) => u.ids.includes(m))
      if (!missing.length && expected.some((m, i) => u.ids[i] !== m)) secErrors.push(LINES.groupOutOfOrder(u.groupId))
    }
    const notLive = ids.filter((id) => !isLive(id))
    if (notLive.length) secErrors.push(LINES.notPublished(notLive.length))
    return {
      label: spec.label,
      count: ids.length,
      need: spec.questionCount,
      marks,
      budget: spec.markBudget,
      errors: secErrors,
      notes,
      ok: secErrors.length === 0,
    }
  })
  const totalMarks = out.reduce((n, s) => n + s.marks, 0)
  const totalBudget = specs.reduce((n, s) => n + s.markBudget, 0)
  return {
    sections: out,
    errors,
    totalMarks,
    totalBudget,
    ok: errors.length === 0 && out.every((s) => s.ok),
  }
}

/** The publish refusal lines: paper-wide errors first, then each section line prefixed `{label}: `. */
export function publishErrors(check: PaperCheck): string[] {
  return [
    ...check.errors,
    ...check.sections.flatMap((s) => s.errors.map((e) => LINES.sectionLine(s.label, e))),
  ]
}
