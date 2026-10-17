/**
 * Server-side grading (mock server, never in the page). Answer-key kinds (exam schema D3):
 * `option` (MCQ by option identity), `mapping` (match_letter), `accepted` (short text / numeric),
 * `points` (working, structured, drawing checklist; K/N/P, M, F/C letters, "any N of M" groups) and
 * `rubric` (essay, teacher-marked). Low confidence, a manual checklist point or a rubric means the
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
  EcfRule,
  LeafKind,
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

/** Whole-word (or whole-phrase) match on normalised text: "air" is not found inside "airport". */
export function containsPhrase(text: string, phrase: string): boolean {
  if (!phrase) return false
  return ` ${text} `.includes(` ${phrase} `)
}

/** A keyword answer longer than this is routed to review (keyword stuffing). */
export const MAX_KEYWORD_ANSWER_WORDS = 80

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

/** Declarative own-figure-carried-forward rule (data, not a callback). */
export function ecfExpected(rule: EcfRule, previous: number): number {
  switch (rule.op) {
    case 'same':
      return previous
    case 'sub_from':
      return rule.k - previous
    case 'add':
      return previous + rule.k
    case 'mul':
      return previous * rule.k
  }
}

function reveal(scheme: SchemeDef, part: { marks: number }): SchemeReveal {
  switch (scheme.kind) {
    case 'option':
      return { marks: part.marks, correctOption: scheme.correct, explanation: scheme.reason }
    case 'mapping':
      return { marks: part.marks, correctLetter: Object.values(scheme.map)[0] }
    case 'accepted':
      return {
        marks: part.marks,
        acceptedText: scheme.values.map((v) => (v.unit ? `${v.v} ${v.unit}` : v.v)),
      }
    case 'rubric':
      return {
        marks: part.marks,
        rubric: {
          criteria: scheme.criteria.map((c) => c.name),
          bands: scheme.bands,
          notes: scheme.notes,
        },
      }
    case 'points':
      return {
        marks: part.marks,
        finalDisplay: scheme.final?.display,
        unit: scheme.final?.unit,
        model: scheme.model,
      }
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
): { hit: boolean; reason: string; ecf?: string; manual?: boolean } {
  const missing = (point.requires ?? []).find((id) => !hits.get(id))
  if (missing) return { hit: false, reason: `Tidak diberi: ${missing} tidak diperoleh.` }
  const m = point.match
  switch (m.type) {
    case 'step': {
      const lines = stepCandidates(answer)
      const found = lines.find((l) => m.accept.some((k) => answersEquivalent(l, k)))
      return found
        ? { hit: true, reason: `Langkah anda sepadan: ${found}` }
        : { hit: false, reason: 'Tiada langkah yang sepadan dengan kaedah yang diterima.' }
    }
    case 'all_of': {
      const lines = stepCandidates(answer)
      const miss = m.items.find((it) => !lines.some((l) => answersEquivalent(l, it)))
      return miss === undefined
        ? { hit: true, reason: 'Semua unsur yang diminta dikesan.' }
        : { hit: false, reason: `Unsur yang tiada: ${miss}` }
    }
    case 'final': {
      if (!scheme.final) return { hit: false, reason: 'Tiada jawapan akhir.' }
      if (finalValue === 'match') return { hit: true, reason: 'Jawapan akhir betul.' }
      if (point.ecf) {
        const prev = ctx.previousFinals[point.ecf.fromPart]
        const mine = numericValue(answer.final ?? '')
        if (prev != null && mine != null) {
          const expected = ecfExpected(point.ecf.rule, prev)
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
      const found = m.anyOf.find((k) => containsPhrase(text, normaliseText(k)))
      return found
        ? { hit: true, reason: `Isi dikesan: "${found}"` }
        : { hit: false, reason: 'Isi yang dikehendaki tidak dikesan.' }
    }
    case 'manual':
      return { hit: false, reason: 'Disemak oleh guru.', manual: true }
  }
}

export interface GradeInput {
  part: Pick<PartDef, 'id' | 'label' | 'prompt' | 'marks'> & { kind: 'mcq' | LeafKind }
  scheme: SchemeDef
  answer: PartAnswer | undefined
  ctx: GradeContext
}

/** Shown tags: the letter plus its sequence inside the part (K1, K2, M1, F3). */
function tagFor(points: PointDef[]): Map<string, string> {
  const seq = new Map<string, number>()
  const tags = new Map<string, string>()
  for (const p of points) {
    const n = (seq.get(p.code) ?? 0) + 1
    seq.set(p.code, n)
    tags.set(p.id, `${p.code}${n}`)
  }
  return tags
}

function singlePoint(
  part: { id: string; marks: number },
  code: 'B',
  label: string,
  ok: boolean,
  awarded: number,
  reason: string,
): PointResult[] {
  return [
    { id: `${part.id}-b1`, code, tag: 'B1', label, marks: part.marks, awarded, hit: ok, reason },
  ]
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
  const a = answer ?? {}

  if (scheme.kind === 'option' || scheme.kind === 'mapping') {
    const expected = scheme.kind === 'option' ? scheme.correct : scheme.map[part.id]
    const ok = !!a.choice && a.choice === expected
    const awarded = ok ? part.marks : 0
    const label = scheme.kind === 'option' ? 'Pilihan jawapan' : 'Padanan huruf'
    return {
      ...base,
      awarded,
      status: statusOf(awarded, part.marks, blank),
      confidence: 'high',
      points: singlePoint(
        part,
        'B',
        label,
        ok,
        awarded,
        blank ? 'Tiada jawapan dipilih.' : ok ? 'Pilihan betul.' : 'Pilihan tidak betul.',
      ),
    }
  }

  if (scheme.kind === 'accepted') {
    const typed = (part.kind === 'short_text' ? a.text : (a.final ?? a.text)) ?? ''
    let ok = false
    let unreadable = false
    for (const v of scheme.values) {
      if (part.kind === 'short_text') {
        const norm = (x: string) => (scheme.caseSensitive ? x.trim() : normaliseText(x))
        if (norm(typed) === norm(v.v)) ok = true
      } else {
        const fm = matchFinal(typed, a.unit ?? '', {
          accept: [v.v],
          tolerance: v.tol,
          unit: v.unit,
        })
        if (fm.value === 'match' && (fm.unit === 'ok' || fm.unit === 'na')) ok = true
        if (fm.value === 'unparseable') unreadable = true
      }
    }
    const low =
      !blank && !ok && (unreadable || (part.kind === 'short_text' && wordCount(typed) >= 3))
    const awarded = ok ? part.marks : 0
    return {
      ...base,
      awarded,
      status: low ? 'belum_dimarkah' : statusOf(awarded, part.marks, blank),
      confidence: low ? 'low' : 'high',
      points: singlePoint(
        part,
        'B',
        'Jawapan diterima',
        ok,
        awarded,
        blank ? 'Tiada jawapan.' : ok ? 'Jawapan diterima.' : 'Jawapan tidak diterima.',
      ),
    }
  }

  if (scheme.kind === 'rubric') {
    // Essays are never auto-marked: a person confirms the band (exam schema D4.5).
    return {
      ...base,
      awarded: 0,
      status: blank ? 'kosong' : 'belum_dimarkah',
      confidence: blank ? 'high' : 'low',
      points: [],
    }
  }

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
  const tags = tagFor(scheme.points)
  const points: PointResult[] = []
  let ecf: string | undefined
  let hasManual = false
  for (const p of scheme.points) {
    const r = blank
      ? { hit: false, reason: 'Tiada jawapan.', ecf: undefined, manual: p.match.type === 'manual' }
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
    if (r.manual) hasManual = true
    points.push({
      id: p.id,
      code: p.code,
      tag: tags.get(p.id) ?? p.code,
      ...(r.manual ? { manual: true } : {}),
      label: p.label,
      marks: p.marks,
      awarded: r.hit ? p.marks : 0,
      hit: r.hit,
      reason: r.reason,
    })
  }
  // "Any N of M": only the first N hits of a group count.
  for (const g of scheme.groups ?? []) {
    let counted = 0
    for (const pr of points) {
      if (!g.pointIds.includes(pr.id) || !pr.hit) continue
      counted += 1
      if (counted > g.anyN) {
        pr.hit = false
        pr.awarded = 0
        pr.reason = `Tidak dikira: had mana-mana ${g.anyN} telah dicapai.`
      }
    }
  }
  const total = points.reduce((n, p) => n + p.awarded, 0)
  const awarded = Math.min(total, part.marks)

  // Confidence: when the system cannot tell a wrong answer from one it cannot read, a human decides.
  let low = false
  if (!blank) {
    if (hasManual) {
      low = true
    } else if (part.kind === 'short_text') {
      const words = wordCount(a.text ?? '')
      low = (awarded === 0 && words >= 3) || words > MAX_KEYWORD_ANSWER_WORDS
    } else if (fin) {
      const typedNothing = !(a.final ?? '').trim() && !(a.steps ?? []).some((s) => s.trim())
      low = fm.value === 'unparseable' || (typedNothing && !!a.photos?.length)
    }
  }
  const status: PartStatus = low ? 'belum_dimarkah' : statusOf(awarded, part.marks, blank)
  return { ...base, awarded, status, confidence: low ? 'low' : 'high', points, ecf }
}
