/** "{n} soalan" (FR-M10-73). */
export function questionCountLabel(n: number): string {
  return `${String(n)} soalan`
}

/** "{n} minit"; `null` = no limit, nothing shown. */
export function timeLimitLabel(minutes: number | null): string | null {
  return minutes === null ? null : `${String(minutes)} minit`
}

/** `attemptsLeft` (BR-M10-18): `null` = unlimited. */
export function attemptsLabel(left: number | null): string {
  if (left === null) return 'Percubaan tanpa had'
  return `${String(left)} percubaan berbaki`
}

/** The M05 quiz of a set (Q6). */
export function quizPath(id: number): string {
  return `/set-soalan-saya/${String(id)}/jawab`
}
