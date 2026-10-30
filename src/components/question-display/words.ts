/** Whitespace-separated word count (matches the .cloud counter). */
export function countWords(text: string): number {
  const t = text.trim()
  return t ? t.split(/\s+/).length : 0
}
