/**
 * R1-B13: keyword suggestion for the points of a mark scheme. A port of the V2 `RubricKeywordMarker`
 * (backend/app/Support/RubricKeywordMarker.php), PURE: no database, no clock.
 *
 * A deliberately crude and generous SUGGESTION that the pupil confirms with a self-mark; it never
 * becomes the awarded mark. For each rubric point it asks whether the answer mentions any significant
 * keyword of the point (V2 :98-130):
 * - tokens are lower-cased, tags stripped, split on anything that is not a letter or digit, and the
 *   Malay/English stop-words are dropped (V2 :138-145);
 * - a prose point matches when the answer has ANY token of 5 or more characters of the point;
 * - a point made only of short tokens falls back to its digit-bearing tokens, ALL of which must be in
 *   the answer ("7", "(3,1)"); short alphabetic words never match.
 *
 * Marks (V2 :68-70): the sum of the matched points marks when the points carry marks, else the
 * proportional share round(maxMarks * matched / total); always clamped to 0..maxMarks.
 * Same answer in, same suggestion out (case and spacing do not matter).
 */

/** Function words that carry no topic signal (V2 STOPWORDS). */
const STOPWORDS: ReadonlySet<string> = new Set([
  'yang', 'dan', 'atau', 'dengan', 'untuk', 'pada', 'dalam', 'ini', 'itu', 'adalah', 'ialah',
  'akan', 'dari', 'daripada', 'kepada', 'serta', 'demi', 'agar', 'supaya', 'kerana', 'oleh',
  'seperti', 'antara', 'boleh', 'juga', 'tidak', 'bukan', 'telah', 'sudah', 'lebih', 'sangat',
  'the', 'and', 'for', 'with', 'that', 'this', 'from', 'have', 'will', 'your', 'their',
])

/** Minimum length of a token to count as a keyword (V2 MIN_KEYWORD_LEN). */
export const MIN_KEYWORD_LEN = 5

export interface SuggestPoint {
  id: string
  label: string
  marks: number
}

export interface PointSuggestion {
  suggestedMark: number
  matched: number
  total: number
  points: { id: string; label: string; marks: number; matched: boolean }[]
}

/** Lower-case alphanumeric tokens minus stop-words. Hyphens and punctuation split ("undang-undang"). */
export function tokenize(text: string): string[] {
  const plain = text.replace(/<[^>]*>/g, '').toLowerCase()
  return plain
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .split(' ')
    .filter((t) => t !== '' && !STOPWORDS.has(t))
}

function pointMatches(label: string, answerTokens: ReadonlySet<string>): boolean {
  const tokens = tokenize(label)
  const significant = tokens.filter((t) => [...t].length >= MIN_KEYWORD_LEN)
  if (significant.length > 0) return significant.some((k) => answerTokens.has(k))
  const digitTokens = tokens.filter((t) => /\d/u.test(t))
  if (digitTokens.length === 0) return false
  return digitTokens.every((k) => answerTokens.has(k))
}

export function suggestFromPoints(points: readonly SuggestPoint[], answer: string, maxMarks: number): PointSuggestion {
  const answerTokens = new Set(tokenize(answer))
  const rows: PointSuggestion['points'] = []
  let matchedCount = 0
  let matchedMarkSum = 0
  let pointMarkSum = 0
  for (const p of points) {
    pointMarkSum += p.marks
    if (p.label.trim() === '') continue
    const matched = pointMatches(p.label, answerTokens)
    if (matched) {
      matchedCount += 1
      matchedMarkSum += p.marks
    }
    rows.push({ id: p.id, label: p.label, marks: p.marks, matched })
  }
  const total = rows.length
  // PHP round() rounds half away from zero, Math.round half up: the same for non-negative numbers.
  const awarded = pointMarkSum > 0 ? matchedMarkSum : total > 0 ? Math.round((maxMarks * matchedCount) / total) : 0
  return { suggestedMark: Math.max(0, Math.min(awarded, maxMarks)), matched: matchedCount, total, points: rows }
}
