/** Shared helpers over the paper structure (used by the server and by the pages). */
import type { LeafKind, PartAnswer, QuestionResult, SectionSnapshot } from './types'

interface PartLike {
  id: string
  label: string
  prompt: string
  marks: number
  answer?: { kind: LeafKind; unit?: string; wordRange?: { min: number; max: number } }
  children?: PartLike[]
}

export interface Leaf {
  id: string
  /** Label chain, e.g. "(c)(i)". */
  label: string
  prompt: string
  marks: number
  kind: LeafKind
  unit?: string
  wordRange?: { min: number; max: number }
  depth: number
}

/**
 * A stem row: text only, no answer mode, no children and no marks (T14 B-06). V2 renders an answer
 * widget for leaf parts only; the attempt contract leaves `answer` absent on a part that takes none.
 * A legacy leaf without `answer` but with marks still reads as a short answer.
 */
export function isStemRow(p: Pick<PartLike, 'marks' | 'answer' | 'children'>): boolean {
  return !p.answer && !p.children?.length && p.marks === 0
}

/** Leaf parts (the ones that take an answer) in reading order, with the label chain. */
export function leavesOf(parts: readonly PartLike[], prefix = '', depth = 0): Leaf[] {
  const out: Leaf[] = []
  for (const p of parts) {
    const label = `${prefix}${p.label}`
    if (p.children?.length) out.push(...leavesOf(p.children, label, depth + 1))
    else if (isStemRow(p)) continue
    else
      out.push({
        id: p.id,
        label,
        prompt: p.prompt,
        marks: p.marks,
        kind: p.answer?.kind ?? 'short_text',
        unit: p.answer?.unit,
        wordRange: p.answer?.wordRange,
        depth,
      })
  }
  return out
}

/** Effective marks of a section: choose-N counts only the N largest questions. */
export function effectiveMarks(rule: SectionSnapshot['rule'], questionMarks: number[]): number {
  if (rule.type === 'all') return questionMarks.reduce((a, b) => a + b, 0)
  return [...questionMarks]
    .sort((a, b) => b - a)
    .slice(0, rule.n)
    .reduce((a, b) => a + b, 0)
}

/** BM instruction line of a section (authored, else derived from the rule). */
export function sectionRuleLine(
  s: Pick<SectionSnapshot, 'rule' | 'instruction' | 'questionIds'>,
): string {
  if (s.instruction) return s.instruction
  return s.rule.type === 'all'
    ? 'Jawab semua soalan.'
    : `Jawab ${s.rule.n} daripada ${s.questionIds.length} soalan.`
}

export function isAnswered(a: PartAnswer | undefined): boolean {
  if (!a) return false
  return !!(
    a.choice ||
    a.final?.trim() ||
    a.text?.trim() ||
    a.steps?.some((s) => s.trim()) ||
    a.photos?.length
  )
}

/** Minutes and seconds as `mm:ss`, or `h:mm:ss` from one hour. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`
}

/**
 * Semakan tab "Perlu perhatian" (FB-049). One rule for every paper: a question that counts towards
 * the score and either lost marks or still waits for a teacher. A question marked "Tidak dikira"
 * never appears there (it cannot change the score), whatever its marks were.
 */
export function needsAttention(
  q: Pick<QuestionResult, 'counted' | 'awarded' | 'marks'> & {
    parts: readonly Pick<QuestionResult['parts'][number], 'status'>[]
  },
): boolean {
  if (!q.counted) return false
  return q.awarded < q.marks || q.parts.some((p) => p.status === 'belum_dimarkah')
}
