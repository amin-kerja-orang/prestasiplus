/** Pure helpers of the Set Builder: units of a section and the reorder payload (D83 D-9, D90). */
import type { BuilderGroup, BuilderQuestion, PaperEditorData } from '../../../domain/admin-types'
import { unitsOf, type Unit } from '../../../domain/paper-builder'

export interface SectionUnit extends Unit {
  marks: number
  questions: BuilderQuestion[]
}

export function editorMaps(ed: PaperEditorData): {
  q: Map<string, BuilderQuestion>
  g: Map<string, BuilderGroup>
} {
  return {
    q: new Map(ed.questions.map((x) => [x.id, x])),
    g: new Map(ed.groups.map((x) => [x.id, x])),
  }
}

/** The units (single question or whole group) of one section, in paper order. */
export function sectionUnits(ed: PaperEditorData, sectionId: string): SectionUnit[] {
  const sec = ed.paper.sections.find((s) => s.id === sectionId)
  if (!sec) return []
  const { q } = editorMaps(ed)
  return unitsOf(sec.questionIds, (id) => q.get(id)?.groupId).map((u) => {
    const questions = u.ids.map((id) => q.get(id)).filter((x): x is BuilderQuestion => !!x)
    return { ...u, questions, marks: questions.reduce((n, x) => n + x.marks, 0) }
  })
}

/**
 * Order payload after moving the unit at `index` by `delta` (`-1` Naik, `1` Turun): one id per unit
 * (the first member of a group). `null` when the move is out of range.
 */
export function movedOrder(units: readonly Unit[], index: number, delta: -1 | 1): string[] | null {
  const to = index + delta
  if (index < 0 || index >= units.length || to < 0 || to >= units.length) return null
  const next = units.map((u) => u.ids[0]!)
  const [moved] = next.splice(index, 1)
  next.splice(to, 0, moved!)
  return next
}

/** The section the question is placed in, if any. */
export function sectionOf(ed: PaperEditorData, questionId: string): string | undefined {
  return ed.paper.sections.find((s) => s.questionIds.includes(questionId))?.id
}
