/** Whitespace-separated word count (matches the .cloud counter). */
export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}

/**
 * Cut `text` to its first `max` words, keeping the whitespace of the kept part (FR-PA-35).
 * Trailing whitespace after the last kept word is dropped only when a cut happened.
 */
export function capWords(text: string, max: number): string {
  if (max < 0) return text
  const re = /\S+/g
  let n = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    n += 1
    if (n === max) {
      const end = m.index + m[0].length
      return countWords(text.slice(end)) > 0 ? text.slice(0, end) : text
    }
  }
  return max === 0 ? '' : text
}
