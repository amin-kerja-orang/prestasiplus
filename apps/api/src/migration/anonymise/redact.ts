/**
 * The `redact-pii` rule (A1-LEAK, route 4). For FREE-TEXT CONTENT columns that must stay readable (question and option
 * bodies, explanations, stimuli, answer keys, article titles): only the spans that the leak scan would flag are
 * replaced with `REDACTED_TOKEN`; the text around them is kept. (`scrub-text` would replace the whole cell.)
 *
 * Spans (the same sources as the scan, so the scan on the output is clean BY CONSTRUCTION):
 *   1. every match of the scan patterns (leak-scan.ts `patternSpans`, built from the scanner's own regexes): an e-mail
 *      address whose domain is not allowed, a mobile or landline number, an IC number;
 *   2. what the originals index would flag (`OriginalsIndex.spans`): a cell that is an indexed whole value (indexed
 *      values are at least 5 characters: 5 for username/code/opaque rules, 6 for the others, 20 for scrub rules), a digit
 *      run of an indexed phone/IC value (at least 7 digits), a run of tokens that is an indexed multi-word name (2 to 8
 *      words, 8 characters or more, case and accent folded as the scanner does). A single word, however common, is
 *      never masked on its own.
 *
 * The result is re-checked with the scanner's own functions; spans are replaced round after round until nothing is left
 * (replacing a span can lift a look-around guard of a neighbouring match), and if the text still would not scan clean
 * the whole cell becomes the token (fail closed).
 *
 * The scan also reads a NORMALISED view of every string (normalise.ts: tags and entities removed, NFKC, Arabic-Indic and
 * other non-ASCII digits and zero-width characters folded, JSON escapes decoded; A1-LEAK F1). Spans are cut from the RAW text
 * only (offsets of the view cannot be mapped back exactly), so PII that only the view shows (`<b>012</b>-345 6789`, a zero-width
 * character inside a number, `&#64;`, full-width digits, a name split by a tag) is not cut: the check after the raw spans
 * finds the cell still dirty and the whole cell becomes the token. The guarantee is: redacted output scans clean, raw and
 * normalised. NULL, "" and values that are not text stay as they are.
 *
 * JSON (an object, or a text that parses to an object, array or string): every string leaf is redacted on its own,
 * keys, numbers, booleans and null are kept. A long integer that the scan would flag (it scans integers of 9 digits or
 * more) is the one number that cannot stay: it becomes the token as a string. A text cell whose JSON form was changed
 * is written back with JSON.stringify; one that needs no redaction is returned byte for byte.
 *
 * Nothing here logs or returns a value: callers get per-kind counts only.
 */
import { leaves, patternKinds, patternSpans, type OriginalsIndex, type PiiSpan, type ScanPatternOptions } from './leak-scan'
import { REDACTED_TOKEN } from './redacted-token'

export { REDACTED_TOKEN }

export type RedactKind = PiiSpan['kind']

/** Counts of redacted spans by kind (never values). */
export type RedactCounts = Partial<Record<RedactKind, number>>

const MAX_ROUNDS = 8
const KIND_ORDER: readonly RedactKind[] = ['email', 'phone', 'ic', 'original-value', 'original-name']

const isObject = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)

export class PiiRedactor {
  constructor(
    private readonly index: OriginalsIndex | null = null,
    private readonly patterns: ScanPatternOptions = {},
  ) {}

  private spansOf(text: string): PiiSpan[] {
    return [...patternSpans(text, this.patterns), ...(this.index?.spans(text) ?? [])]
  }

  /** True when the scanner would report nothing for this exact string. */
  private clean(text: string): boolean {
    return patternKinds(text, this.patterns).length === 0 && (this.index?.match(text) ?? null) === null
  }

  /** Redacts one string; `count` is told the kind of every replaced span. */
  redactString(text: string, count?: (kind: RedactKind) => void): string {
    let cur = text
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const spans = this.spansOf(cur)
      if (spans.length === 0) {
        if (this.clean(cur)) return cur
        break
      }
      spans.sort((a, b) => a.start - b.start || a.end - b.end)
      let out = ''
      let at = 0
      let i = 0
      while (i < spans.length) {
        // one token for a group of overlapping spans (an e-mail that holds a phone number, a name next to an IC)
        const first = spans[i] as PiiSpan
        let end = first.end
        let order = KIND_ORDER.indexOf(first.kind)
        let j = i + 1
        while (j < spans.length && (spans[j] as PiiSpan).start <= end) {
          const next = spans[j] as PiiSpan
          if (next.end > end) end = next.end
          order = Math.min(order, KIND_ORDER.indexOf(next.kind))
          j++
        }
        out += cur.slice(at, first.start) + REDACTED_TOKEN
        at = end
        count?.(KIND_ORDER[order] as RedactKind)
        i = j
      }
      cur = out + cur.slice(at)
    }
    // Still flagged without a span to cut (or not settled after MAX_ROUNDS): fail closed, the whole cell goes.
    count?.((this.index?.match(cur) as RedactKind | null) ?? (patternKinds(cur, this.patterns)[0] as RedactKind | undefined) ?? 'original-value')
    return REDACTED_TOKEN
  }

  private redactLeaf(value: unknown, count?: (kind: RedactKind) => void): unknown {
    if (typeof value === 'string') return value === '' ? '' : this.redactString(value, count)
    if (typeof value === 'number') {
      // the scan reads integers of 9+ digits as text; one that would be flagged cannot stay a number
      const flagged = [...leaves(value)].some((s) => this.spansOf(s).length > 0)
      if (!flagged) return value
      count?.('original-value')
      return REDACTED_TOKEN
    }
    if (Array.isArray(value)) return value.map((v) => this.redactLeaf(v, count))
    if (isObject(value)) return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, this.redactLeaf(v, count)]))
    return value
  }

  /** Is the whole value free of anything the scan would flag? (`leaves` as the scanner reads them.) */
  private valueClean(value: unknown): boolean {
    for (const s of leaves(value)) if (!this.clean(s)) return false
    return true
  }

  /** Applies the rule to one cell value. */
  redact(value: unknown, count?: (kind: RedactKind) => void): unknown {
    if (value === null || value === undefined) return null
    if (typeof value === 'string') {
      if (value === '') return ''
      const probe = this.spansOf(value)
      if (probe.length === 0 && this.clean(value)) return value
      // A text that holds JSON: redact the leaves, so the result stays valid JSON.
      const trimmed = value.trimStart()
      if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"')) {
        let parsed: unknown
        try {
          parsed = JSON.parse(value)
        } catch {
          parsed = undefined
        }
        if (typeof parsed === 'string' || (parsed !== null && typeof parsed === 'object')) {
          const local: RedactKind[] = []
          const text = JSON.stringify(this.redactLeaf(parsed, (k) => local.push(k)))
          if (this.clean(text)) {
            for (const k of local) count?.(k)
            return text
          }
        }
      }
      return this.redactString(value, count)
    }
    if (typeof value === 'object') {
      if (this.valueClean(value)) return value
      return this.redactLeaf(value, count)
    }
    if (typeof value === 'number') return this.valueClean(value) ? value : this.redactLeaf(value, count)
    return value
  }
}
