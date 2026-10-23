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
  /** Printed label of every member, in paper order. */
  labels: string[]
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
    labels: idx.map((i) => questions[i]!.label),
    contiguous: idx.every((v, k) => k === 0 || v === idx[k - 1]! + 1),
  }))
}

/** Printed numbers follow paper order: "1", "2", ... (a stimulus label such as "Rajah 1" is not touched). */
export function renumberQuestions(questions: IntakeQuestion[]): IntakeQuestion[] {
  return questions.map((q, i) => (q.label === String(i + 1) ? q : { ...q, label: String(i + 1) }))
}

/** True when every label is a whole number and they do not rise in paper order (an earlier reorder left them scrambled). */
function numbersOutOfOrder(questions: IntakeQuestion[]): boolean {
  const nums = questions.map((q) => (/^\d+$/.test(q.label) ? Number(q.label) : NaN))
  if (nums.some(Number.isNaN)) return false
  return nums.some((n, i) => i > 0 && n <= nums[i - 1]!)
}

/**
 * Attach `ids` to `stimulusId`. The group (existing members plus the new ones) is gathered into one
 * contiguous block at the position of its earliest member. `moved` tells the UI that the paper order
 * changed, so it can say so. When the order changed the printed numbers are renumbered to paper order
 * (1..n), so the labels never run out of sequence.
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
  return { questions: moved ? renumberQuestions(out) : out, moved }
}

export function detachFromStimulus(questions: IntakeQuestion[], ids: string[]): IntakeQuestion[] {
  const drop = new Set(ids)
  const out = questions.map((q) => {
    if (!drop.has(q.id)) return q
    const rest = { ...q }
    delete rest.stimulusId
    return rest
  })
  // Detaching never reorders, but it heals numbers left out of sequence by an earlier reorder.
  return numbersOutOfOrder(out) ? renumberQuestions(out) : out
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

/** "Soalan 3 - 5" style label of a group; a group that is not contiguous lists its real members. */
export function groupLabel(g: GroupInfo): string {
  if (g.from === g.to) return `Soalan ${g.from}`
  if (!g.contiguous) return `Soalan ${g.labels.join(', ')}`
  return `Soalan ${g.from} - ${g.to}`
}
