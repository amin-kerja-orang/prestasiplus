/**
 * Stimulus groups (exam schema D6): several questions share one figure / passage / table that is
 * stored once on the batch. The questions of a group stay contiguous (the student pins the stimulus
 * while answering them), so attaching a question moves it next to its group.
 */
import type { IntakeQuestion, IntakeStimulus } from '../types'

export interface GroupInfo {
  stimulusId: string
  questionIds: string[]
  /** Printed labels, first to last. */
  from: string
  to: string
  contiguous: boolean
}

export function groupsOf(questions: IntakeQuestion[]): GroupInfo[] {
  const map = new Map<string, number[]>()
  questions.forEach((q, i) => {
    if (q.stimulusId) map.set(q.stimulusId, [...(map.get(q.stimulusId) ?? []), i])
  })
  return [...map.entries()].map(([stimulusId, idx]) => ({
    stimulusId,
    questionIds: idx.map((i) => questions[i]!.id),
    from: questions[idx[0]!]!.label,
    to: questions[idx[idx.length - 1]!]!.label,
    contiguous: idx.every((v, k) => k === 0 || v === idx[k - 1]! + 1),
  }))
}

/**
 * Attach `ids` to `stimulusId`. The group (existing members plus the new ones) is gathered into one
 * contiguous block at the position of its earliest member. `moved` tells the UI that the paper order
 * changed, so it can say so.
 */
export function attachToStimulus(
  questions: IntakeQuestion[],
  ids: string[],
  stimulusId: string,
): { questions: IntakeQuestion[]; moved: boolean } {
  const picked = new Set(ids)
  const tagged = questions.map((q) => (picked.has(q.id) ? { ...q, stimulusId } : q))
  const members = tagged.filter((q) => q.stimulusId === stimulusId)
  if (members.length === 0) return { questions: tagged, moved: false }
  const firstIndex = tagged.findIndex((q) => q.stimulusId === stimulusId)
  const memberIds = new Set(members.map((q) => q.id))
  const rest = tagged.filter((q) => !memberIds.has(q.id))
  const before = tagged.slice(0, firstIndex).filter((q) => !memberIds.has(q.id)).length
  const out = [...rest.slice(0, before), ...members, ...rest.slice(before)]
  const moved = out.some((q, i) => q.id !== tagged[i]!.id)
  return { questions: out, moved }
}

export function detachFromStimulus(questions: IntakeQuestion[], ids: string[]): IntakeQuestion[] {
  const drop = new Set(ids)
  return questions.map((q) => {
    if (!drop.has(q.id)) return q
    const rest = { ...q }
    delete rest.stimulusId
    return rest
  })
}

/** Remove a stimulus and detach every question that used it. */
export function removeStimulus(
  questions: IntakeQuestion[],
  stimuli: IntakeStimulus[],
  stimulusId: string,
): { questions: IntakeQuestion[]; stimuli: IntakeStimulus[] } {
  const ids = questions.filter((q) => q.stimulusId === stimulusId).map((q) => q.id)
  return {
    questions: detachFromStimulus(questions, ids),
    stimuli: stimuli.filter((s) => s.id !== stimulusId),
  }
}

/** "Soalan 3 - 5" style label of a group. */
export function groupLabel(g: GroupInfo): string {
  return g.from === g.to ? `Soalan ${g.from}` : `Soalan ${g.from} - ${g.to}`
}
