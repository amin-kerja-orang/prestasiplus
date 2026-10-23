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

/**
 * Printed numbers follow paper order. Only a batch whose labels are all plain whole numbers and
 * unique is touched: the same set of numbers is dealt out again in paper order, so a gap in the
 * source numbering (18, 19, 21) is kept. Free-text labels ("1(a)", "7A", empty) and duplicates are
 * left exactly as the admin typed them. A stimulus label such as "Rajah 1" is never touched.
 */
export function renumberQuestions(questions: IntakeQuestion[]): {
  questions: IntakeQuestion[]
  renumbered: boolean
} {
  if (!questions.every((q) => /^\d+$/.test(q.label))) return { questions, renumbered: false }
  const nums = questions.map((q) => Number(q.label))
  if (new Set(nums).size !== nums.length) return { questions, renumbered: false }
  const sorted = [...nums].sort((x, y) => x - y)
  let renumbered = false
  const out = questions.map((q, i) => {
    const label = String(sorted[i])
    if (q.label === label) return q
    renumbered = true
    return { ...q, label }
  })
  return renumbered ? { questions: out, renumbered } : { questions, renumbered }
}

/**
 * Attach `ids` to `stimulusId`. The group (existing members plus the new ones) is gathered into one
 * contiguous block at the position of its earliest member. `moved` tells the UI that the paper order
 * changed, so it can say so. When the order changed and the labels are plain unique numbers they are
 * dealt out again in paper order (`renumbered`), so they never run out of sequence.
 */
export function attachToStimulus(
  questions: IntakeQuestion[],
  ids: string[],
  stimulusId: string,
): { questions: IntakeQuestion[]; moved: boolean; renumbered: boolean } {
  const picked = new Set(ids)
  const tagged = questions.map((q) => (picked.has(q.id) ? { ...q, stimulusId } : q))
  const members = tagged.filter((q) => q.stimulusId === stimulusId)
  if (members.length === 0) return { questions: tagged, moved: false, renumbered: false }
  const firstIndex = tagged.findIndex((q) => q.stimulusId === stimulusId)
  const memberIds = new Set(members.map((q) => q.id))
  const rest = tagged.filter((q) => !memberIds.has(q.id))
  const before = tagged.slice(0, firstIndex).filter((q) => !memberIds.has(q.id)).length
  const out = [...rest.slice(0, before), ...members, ...rest.slice(before)]
  const moved = out.some((q, i) => q.id !== tagged[i]!.id)
  if (!moved) return { questions: out, moved, renumbered: false }
  return { ...renumberQuestions(out), moved }
}

function clearStimulus(questions: IntakeQuestion[], ids: string[]): IntakeQuestion[] {
  const drop = new Set(ids)
  return questions.map((q) => {
    if (!drop.has(q.id)) return q
    const rest = { ...q }
    delete rest.stimulusId
    return rest
  })
}

/**
 * Detach never reorders. It only deals the numbers out again when plain unique numbers were left
 * out of sequence by an earlier reorder (same guard as `renumberQuestions`).
 */
export function detachFromStimulus(
  questions: IntakeQuestion[],
  ids: string[],
): { questions: IntakeQuestion[]; renumbered: boolean } {
  return renumberQuestions(clearStimulus(questions, ids))
}

/** Remove a stimulus and detach every question that used it. */
export function removeStimulus(
  questions: IntakeQuestion[],
  stimuli: IntakeStimulus[],
  stimulusId: string,
): { questions: IntakeQuestion[]; stimuli: IntakeStimulus[] } {
  const ids = questions.filter((q) => q.stimulusId === stimulusId).map((q) => q.id)
  return {
    questions: clearStimulus(questions, ids),
    stimuli: stimuli.filter((s) => s.id !== stimulusId),
  }
}

/** "Soalan 3 - 5" style label of a group; a group that is not contiguous lists its real members. */
export function groupLabel(g: GroupInfo): string {
  if (g.from === g.to) return `Soalan ${g.from}`
  if (!g.contiguous) return `Soalan ${g.labels.join(', ')}`
  return `Soalan ${g.from} - ${g.to}`
}
