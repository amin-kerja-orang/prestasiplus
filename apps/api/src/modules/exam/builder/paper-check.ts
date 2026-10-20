/**
 * Paper builder rules (pure), a verbatim port of the prototype `domain/paper-builder.ts`: stimulus
 * groups move as one unit and stay contiguous; the live budget check compares each section with the
 * blueprint. The section marks come from the shared domain (`effectiveMarks`, via the adapter); this
 * file has no marks-budget or choose-N rule of its own. Lines are the BM texts of the contract.
 */
import { BIJAK_BUILDER_CHECK_LINES as LINES } from '@pp/contract'

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
}

export function checkPaper(input: CheckInput): PaperCheck {
  const { specs, sections, marksOf, groupOf, membersOf, isLive } = input
  const errors: string[] = []
  const seen = new Set<string>()
  const dup = new Set<string>()
  for (const s of sections) for (const id of s.questionIds) (seen.has(id) ? dup : seen).add(id)
  if (dup.size) errors.push(LINES.duplicateQuestion([...dup]))

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
      const missing = membersOf(u.groupId).filter((m) => !ids.includes(m))
      if (missing.length) secErrors.push(LINES.groupIncomplete(u.groupId, missing.length))
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
