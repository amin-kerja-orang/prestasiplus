/**
 * The v2 part tree (BE-09 `QuestionPart`) as the mock's flat sub-question list: one entry per part,
 * depth first, branches included with marks 0. Mirrors BE-09 `structuredDetailView` (`flatten`); copied,
 * not imported, because that file is an HTTP view of the admin routes.
 */
import type { QuestionPart } from '@pp/contract'

type Leaf = Extract<QuestionPart, { mode: string }>
export const isLeaf = (p: QuestionPart): p is Leaf => 'mode' in p

export interface SubQuestion {
  /** `<questionId>-<label path>`: stable while the labels stay (a republish keeps saved answers addressable). */
  id: string
  /** Labels joined with `.`, for example `(a).(i)`. */
  label: string
  text: string
  marks: number
  modelAnswer: string
  /** Top-level part (the "{parts} bahagian" figure). */
  top: boolean
}

function modelAnswerOf(leaf: Leaf): string {
  const key = leaf.key as { kind: string; correct?: string; values?: unknown[]; modelText?: string; points?: { label?: string }[] }
  if (key.kind === 'option') return key.correct ?? ''
  if (key.kind === 'accepted') {
    const [first] = key.values ?? []
    return typeof first === 'string' ? first : typeof first === 'object' && first !== null ? String((first as { v?: unknown }).v ?? '') : ''
  }
  if (key.kind === 'points') return key.modelText ?? key.points?.[0]?.label ?? ''
  return ''
}

export function flatten(questionId: string, parts: readonly QuestionPart[]): SubQuestion[] {
  const out: SubQuestion[] = []
  const walk = (list: readonly QuestionPart[], path: readonly string[]): void => {
    for (const part of list) {
      const labels = [...path, part.label]
      const sub: SubQuestion = {
        id: `${questionId}-${labels.join('.')}`,
        label: labels.join('.'),
        text: part.prompt.ms,
        marks: 0,
        modelAnswer: '',
        top: path.length === 0,
      }
      out.push(sub)
      if (isLeaf(part)) {
        sub.marks = part.marks
        sub.modelAnswer = modelAnswerOf(part)
      } else {
        walk(part.children as QuestionPart[], labels)
      }
    }
  }
  walk(parts, [])
  return out
}
