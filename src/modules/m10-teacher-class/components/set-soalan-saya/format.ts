/** "{n} soalan" (FR-M10-73). */
export function questionCountLabel(n: number): string {
  return `${String(n)} soalan`
}

/** The M05 quiz of a set (Q6). */
export function quizPath(id: number): string {
  return `/set-soalan-saya/${String(id)}/jawab`
}
