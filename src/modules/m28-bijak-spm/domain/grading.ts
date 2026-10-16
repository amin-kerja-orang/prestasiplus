/**
 * Server-side grading (mock server, never in the page): MCQ by option identity, working / numeric
 * parts by per-point K1 / N1 / P1 marks, short text by keyword points. Low confidence means the
 * part is flagged "Belum dimarkah — perlu semakan" and never silently becomes zero.
 */
import {
  answersEquivalent,
  latexToPlain,
  matchFinal,
  numericValue,
  type FinalMatch,
} from './math-expr'
import type {
  PartAnswer,
  PartDef,
  PartResult,
  PartStatus,
  PointDef,
  PointResult,
  SchemeDef,
  SchemeReveal,
} from './types'

export const MSG_NEEDS_REVIEW = 'Belum dimarkah — perlu semakan'

export function normaliseText(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function wordCount(s: string): number {
  const t = normaliseText(s)
  return t ? t.split(' ').length : 0
}

export function isBlank(a: PartAnswer | undefined): boolean {
  if (!a) return true
  if (a.choice) return false
  if (a.final?.trim()) return false
  if (a.text?.trim()) return false
  if (a.steps?.some((x) => x.trim())) return false
  return !a.photos?.length
}

/** Working lines that can be compared: each step, and each side of a chain `a = b = c`. */
function stepCandidates(a: PartAnswer): string[] {
  const out: string[] = []
  for (const line of [...(a.steps ?? []), a.final ?? '']) {
    const t = line.trim()
    if (!t) continue
    out.push(t)
    const plain = latexToPlain(t)
    if ((plain.match(/=/g) ?? []).length >= 1 && !/[<>]/.test(plain)) {
      for (const seg of plain.split('=')) if (seg.trim()) out.push(seg.trim())
    }
  }
  return out
}

function pointText(a: PartAnswer): string {
  return normaliseText([a.text ?? '', a.final ?? '', ...(a.steps ?? [])].join(' '))
}

export interface GradeContext {
  /** Final numeric value the student gave for earlier parts (for ECF), by part id. */
  previousFinals: Record<string, number | null>
}

function statusOf(awarded: number, marks: number, blank: boolean): PartStatus {
  if (blank) return 'kosong'
  if (awarded >= marks && marks > 0) return 'betul'
  if (awarded > 0) return 'separa'
  return 'salah'
}

function reveal(scheme: SchemeDef, part: { marks: number }): SchemeReveal {
  if (scheme.kind === 'mcq') {
    return { marks: part.marks, correctOption: scheme.correct, explanation: scheme.reason }
  }
  return {
    marks: part.marks,
    finalDisplay: scheme.final?.display,
    unit: scheme.final?.unit,
    model: scheme.model,
  }
}

function gradePoint(
  point: PointDef,
  answer: PartAnswer,
  scheme: Extract<SchemeDef, { kind: 'points' }>,
  hits: Map<string, boolean>,
  ctx: GradeContext,
  unitState: string,
  finalValue: string,
  formHint?: string,
): { hit: boolean; reason: string; ecf?: string } {
  if (point.requires && !hits.get(point.requires)) {
    return { hit: false, reason: `Tidak diberi: ${point.requires} tidak diperoleh.` }
  }
  const m = point.match
  switch (m.type) {
    case 'step': {
      const lines = stepCandidates(answer)
      const found = lines.find((l) => m.accept.some((k) => answersEquivalent(l, k)))
      return found
        ? { hit: true, reason: `Langkah anda sepadan: ${found}` }
        : { hit: false, reason: 'Tiada langkah yang sepadan dengan kaedah yang diterima.' }
    }
    case 'final': {
      if (!scheme.final) return { hit: false, reason: 'Tiada jawapan akhir.' }
      if (finalValue === 'match') return { hit: true, reason: 'Jawapan akhir betul.' }
      if (point.ecf) {
        const prev = ctx.previousFinals[point.ecf.fromPart]
        const mine = numericValue(answer.final ?? '')
        if (prev != null && mine != null) {
          const expected = point.ecf.expected(prev)
          if (Math.abs(expected - mine) <= (scheme.final.tolerance ?? 0) + 1e-9) {
            return { hit: true, reason: point.ecf.note, ecf: point.ecf.note }
          }
        }
      }
      return {
        hit: false,
        reason:
          finalValue === 'empty'
            ? 'Tiada jawapan akhir.'
            : (formHint ?? 'Jawapan akhir tidak betul.'),
      }
    }
    case 'unit':
      if (unitState === 'ok') return { hit: true, reason: 'Unit betul.' }
      return {
        hit: false,
        reason: unitState === 'missing' ? 'Unit tidak ditulis.' : 'Unit tidak betul.',
      }
    case 'keywords': {
      const text = pointText(answer)
      const found = m.anyOf.find((k) => text.includes(normaliseText(k)))
      return found
        ? { hit: true, reason: `Isi dikesan: "${found}"` }
        : { hit: false, reason: 'Isi yang dikehendaki tidak dikesan.' }
    }
  }
}

export interface GradeInput {
  part: Pick<PartDef, 'id' | 'label' | 'prompt' | 'marks'> & {
    kind: 'mcq' | 'working' | 'numeric' | 'short_text'
  }
  scheme: SchemeDef
  answer: PartAnswer | undefined
  ctx: GradeContext
}

/** Grades one leaf part. */
export function gradePart({ part, scheme, answer, ctx }: GradeInput): PartResult {
  const base = {
    partId: part.id,
    label: part.label,
    prompt: part.prompt,
    marks: part.marks,
    answer: answer ?? {},
    scheme: reveal(scheme, part),
  }
  const blank = isBlank(answer)

  if (scheme.kind === 'mcq') {
    const ok = !!answer?.choice && answer.choice === scheme.correct
    const awarded = ok ? part.marks : 0
    return {
      ...base,
      awarded,
      status: statusOf(awarded, part.marks, blank),
      confidence: 'high',
      points: [
        {
          id: `${part.id}-b1`,
          code: 'B1',
          label: 'Pilihan jawapan',
          marks: part.marks,
          awarded,
          hit: ok,
          reason: blank ? 'Tiada jawapan dipilih.' : ok ? 'Pilihan betul.' : 'Pilihan tidak betul.',
        },
      ],
    }
  }

  const a = answer ?? {}
  const fin = scheme.final
  let fm: FinalMatch = fin
    ? matchFinal(a.final ?? '', a.unit ?? '', fin)
    : { value: 'empty', unit: 'na' }
  const wrongForm =
    !!fin?.mustContain &&
    fm.value === 'match' &&
    !latexToPlain(a.final ?? '')
      .replace(/\^\(([^()]*)\)/g, '^$1')
      .includes(fin.mustContain)
  if (wrongForm) fm = { ...fm, value: 'mismatch' }
  const hits = new Map<string, boolean>()
  const points: PointResult[] = []
  let ecf: string | undefined
  let total = 0
  for (const p of scheme.points) {
    const r = blank
      ? { hit: false, reason: 'Tiada jawapan.', ecf: undefined }
      : gradePoint(
          p,
          a,
          scheme,
          hits,
          ctx,
          fm.unit,
          fm.value,
          wrongForm ? fin?.formHint : undefined,
        )
    hits.set(p.id, r.hit)
    if (r.ecf) ecf = r.ecf
    const awarded = r.hit ? p.marks : 0
    total += awarded
    points.push({
      id: p.id,
      code: p.code,
      label: p.label,
      marks: p.marks,
      awarded,
      hit: r.hit,
      reason: r.reason,
    })
  }
  const awarded = Math.min(total, part.marks)

  // Confidence: when the system cannot tell a wrong answer from one it cannot read, a human decides.
  let low = false
  if (!blank) {
    if (part.kind === 'short_text') {
      low = awarded === 0 && wordCount(a.text ?? '') >= 3
    } else if (fin) {
      const typedNothing = !(a.final ?? '').trim() && !(a.steps ?? []).some((s) => s.trim())
      low = fm.value === 'unparseable' || (typedNothing && !!a.photos?.length)
    }
  }
  const status: PartStatus = low ? 'belum_dimarkah' : statusOf(awarded, part.marks, blank)
  return { ...base, awarded, status, confidence: low ? 'low' : 'high', points, ecf }
}
