/**
 * Content hash of a legacy question (BE-29, v2-data-migration.md 3.3 item 2): SHA-256 of the normalised stem plus
 * the sorted, normalised option texts. It is the soft key of the optional backfill that links a migrated answer to
 * a question of the new bank. The question text goes in, only the hash comes out: callers keep no copy of the text
 * and never log it.
 */
import { createHash } from 'node:crypto'

/** NFC, lower-case, every whitespace run folded to one space, trimmed. */
export function normaliseText(value: string | null | undefined): string {
  if (value === null || value === undefined) return ''
  return value.normalize('NFC').toLowerCase().replace(/\s+/g, ' ').trim()
}

/**
 * SHA-256 (hex) of `[stem, options]` after normalisation; options are sorted so their order in the source does
 * not matter. Returns null when there is no text at all (nothing to match later).
 */
export function contentHash(stem: string | null | undefined, options: readonly (string | null | undefined)[]): string | null {
  const s = normaliseText(stem)
  const o = options.map((x) => normaliseText(x)).filter((x) => x !== '').sort()
  if (s === '' && o.length === 0) return null
  return createHash('sha256').update(JSON.stringify([s, o])).digest('hex')
}
