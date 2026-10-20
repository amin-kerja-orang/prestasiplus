import { WEAK_BELOW, WEAK_MIN_ANSWERS } from './missions.constants'

/** Rounds half away from zero to `digits` decimals (the mock's `round`). */
export function round(value: number, digits = 0): number {
  const f = 10 ** digits
  return (Math.sign(value) * Math.round(Math.abs(value) * f + 1e-9)) / f
}

/** `part / whole * 100`, or 0 when `whole` is 0. */
export const percent = (part: number, whole: number): number => (whole === 0 ? 0 : (part / whole) * 100)

/** One answer row as the scan needs it (oldest first in a list). */
export interface AnswerFact {
  questionId: string | null
  subjectId: string
  chapterId: string | null
  isCorrect: boolean
}

/** The topic keys of a question: its first DSKP SP, and its chapter. */
export interface TopicInfo {
  spId: string | null
  chapterId: string | null
}

export interface WeakTopic {
  subjectId: string
  /** `sp:{id}` or `ch:{id}`. */
  key: string
  accuracy: number
}

/** `sp:{id}` when the question has an SP, else `ch:{id}` of its chapter (the answer's own chapter when the bank has none), else null. */
export function topicKeyOf(info: ReadonlyMap<string, TopicInfo>, a: AnswerFact): string | null {
  const t = a.questionId === null ? undefined : info.get(a.questionId)
  if (t?.spId) return `sp:${t.spId}`
  const chapter = t?.chapterId ?? a.chapterId
  return chapter ? `ch:${chapter}` : null
}

/** BR-M10-11: the weak topics of one student (all subjects), weakest first, ties by key. */
export function weakTopicsOf(answers: readonly AnswerFact[], info: ReadonlyMap<string, TopicInfo>): WeakTopic[] {
  const by = new Map<string, { subjectId: string; answered: number; correct: number }>()
  for (const a of answers) {
    const key = topicKeyOf(info, a)
    if (key === null) continue
    const cur = by.get(key) ?? { subjectId: a.subjectId, answered: 0, correct: 0 }
    cur.answered++
    if (a.isCorrect) cur.correct++
    by.set(key, cur)
  }
  const out: WeakTopic[] = []
  for (const [key, v] of by) {
    if (v.answered < WEAK_MIN_ANSWERS) continue
    const accuracy = round(percent(v.correct, v.answered), 1)
    if (accuracy >= WEAK_BELOW) continue
    out.push({ subjectId: v.subjectId, key, accuracy })
  }
  return out.sort((a, b) => a.accuracy - b.accuracy || a.key.localeCompare(b.key))
}

/** Deterministic Fisher-Yates over a copy of `ids` with the stream. */
export function shuffled<T>(ids: readonly T[], rng: { int(min: number, max: number): number }): T[] {
  const out = [...ids]
  for (let i = out.length - 1; i > 0; i--) {
    const j = rng.int(0, i)
    const tmp = out[i] as T
    out[i] = out[j] as T
    out[j] = tmp
  }
  return out
}
