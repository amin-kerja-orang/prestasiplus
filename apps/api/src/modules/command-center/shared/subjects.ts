/** Short subject names of the feed/drills (mock `live-reads.ts`): v2 seeds use codes MATH, BM, SEJ ... plus the old names. */
const SHORT: Record<string, string> = {
  MATEMATIK: 'Matematik',
  MATH: 'Matematik',
  BM: 'BM',
  BI: 'BI',
  SAINS: 'Sains',
  'P.ISLAM': 'P.Islam',
  PI: 'P.Islam',
  SEJARAH: 'Sejarah',
  SEJ: 'Sejarah',
  GEO: 'Geo',
  GEOGRAFI: 'Geo',
  MORAL: 'Moral',
}

/** Free practice (no subject) is shown as "Latihan Bebas" in the board feeds. */
export const FREE_PRACTICE = 'Latihan Bebas'

export function shortSubjectName(code: string | null, name: string | null): string {
  if (code === null) return FREE_PRACTICE
  return SHORT[code.toUpperCase()] ?? name ?? code
}
