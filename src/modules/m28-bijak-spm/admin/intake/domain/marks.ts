/** Mark helpers and the subject-specific mark-point codes (exam schema D4, Q-S3). */
import type { PointCode, SchemeDef, SubjectCode } from '../../../domain/types'
import type { IntakeQuestion } from '../types'

/** The letters a subject's schemes use, as printed (Q-S3: show the subject's own letters). */
export function codesForSubject(subject: SubjectCode): PointCode[] {
  switch (subject) {
    case 'MAT':
    case 'AM':
      return ['K', 'N', 'P', 'B']
    case 'SN':
    case 'FIZ':
    case 'KIM':
    case 'BIO':
      return ['M', 'B']
    case 'SEJ':
    case 'BI':
      return ['F', 'C']
    default:
      return ['K', 'N', 'P', 'B', 'M', 'F', 'C']
  }
}

export const CODE_NAMES: Record<PointCode, string> = {
  K: 'K - kaedah',
  N: 'N - jawapan',
  P: 'P - penyelesaian',
  B: 'B - bebas',
  M: 'M - mata markah',
  F: 'F - fakta',
  C: 'C - contoh / isi',
}

/** Marks a scheme can award, counting "any N of M" groups as N points. */
export function schemeTotal(scheme: SchemeDef | undefined): number {
  if (!scheme) return 0
  if (scheme.kind !== 'points') return scheme.marks
  const grouped = new Set<string>()
  let total = 0
  for (const g of scheme.groups ?? []) {
    const pts = scheme.points.filter((p) => g.pointIds.includes(p.id))
    pts.forEach((p) => grouped.add(p.id))
    const marks = pts.map((p) => p.marks).sort((a, b) => b - a)
    total += marks.slice(0, g.anyN).reduce((n, m) => n + m, 0)
  }
  for (const p of scheme.points) if (!grouped.has(p.id)) total += p.marks
  return total
}

export function questionMarks(q: IntakeQuestion): number {
  return q.parts.length > 0 ? q.parts.reduce((n, p) => n + p.marks, 0) : q.marks
}

export function paperMarks(questions: IntakeQuestion[]): number {
  return questions.reduce((n, q) => n + questionMarks(q), 0)
}

/** Tag shown on a point: letter plus its sequence among points of that letter (K1, K2, N1). */
export function pointTag(points: { code: PointCode }[], index: number): string {
  const code = points[index]!.code
  const seq = points.slice(0, index + 1).filter((p) => p.code === code).length
  return `${code}${seq}`
}
