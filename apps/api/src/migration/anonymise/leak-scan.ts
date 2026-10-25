/**
 * Leak scan (BE-35 AC3). After anonymising, the OUTPUT is read back and checked for
 *
 *   1. e-mail addresses (other than the reserved `example.test` fakes), Malaysian mobile and landline
 *      numbers, and 12-digit IC numbers (valid month and day), in every string of every column, json included;
 *   2. the original values: during the run every value that a rule replaced is indexed as a salted
 *      SHA-256 (the salt is random per run and never leaves memory; the values themselves are not kept),
 *      and every output cell is looked up in that index. Whole values (case and spacing ignored),
 *      digit sequences of phone/IC values, and multi-word names inside longer text count. Single words
 *      of a name are NOT matched on their own: common words (and surnames) would flag public content.
 *
 * Any hit fails the run. A hit names the table, the column, the kind and a count, never a value.
 * The scan also works on its own on a finished dump directory (patterns only), see `anonymise:scan`.
 */
import { createHash, randomBytes } from 'node:crypto'

import { DirReader } from '../staging/readers'
import { TABLES, type TableSpec } from '../ddl/spec'
import type { LeakHit } from './errors'
import { EMAIL, IC, LANDLINE, MOBILE } from './patterns'
import { EMAIL_DOMAIN } from './pseudonyms'
import type { Rule } from './rules'

export { EMAIL, IC, LANDLINE, MOBILE } from './patterns'

export interface ScanPatternOptions {
  /** E-mail domains that are fakes and therefore allowed (default: example.test). */
  allowedEmailDomains?: readonly string[]
}

/** The pattern kinds found in one string (each kind once). */
export function patternKinds(text: string, options: ScanPatternOptions = {}): string[] {
  const allowed = new Set((options.allowedEmailDomains ?? [EMAIL_DOMAIN]).map((d) => d.toLowerCase()))
  const kinds: string[] = []
  if (text.length >= 5) {
    for (const m of text.matchAll(EMAIL)) {
      if (!allowed.has((m[1] as string).toLowerCase())) {
        kinds.push('email')
        break
      }
    }
  }
  if (text.length >= 9) {
    if (MOBILE.test(text) || LANDLINE.test(text)) kinds.push('phone')
    if (IC.test(text)) kinds.push('ic')
  }
  return kinds
}

/** A span of a string that the leak scan would flag (UTF-16 offsets, `end` exclusive). `kind` is a scan kind. */
export interface PiiSpan {
  start: number
  end: number
  kind: 'email' | 'phone' | 'ic' | 'original-value' | 'original-name'
}

const globalOf = (re: RegExp): RegExp => new RegExp(re.source, re.flags.includes('g') ? re.flags : `${re.flags}g`)
const EMAIL_G = globalOf(EMAIL)
const MOBILE_G = globalOf(MOBILE)
const LANDLINE_G = globalOf(LANDLINE)
const IC_G = globalOf(IC)

/**
 * Every span of `text` that `patternKinds` would report, built from the SAME regexes (so the scan and the redactor
 * (redact.ts) cannot drift): each e-mail address whose domain is not allowed, each mobile or landline number, each IC.
 * Overlapping spans are returned as they are; the caller merges them.
 */
export function patternSpans(text: string, options: ScanPatternOptions = {}): PiiSpan[] {
  const allowed = new Set((options.allowedEmailDomains ?? [EMAIL_DOMAIN]).map((d) => d.toLowerCase()))
  const spans: PiiSpan[] = []
  for (const m of text.matchAll(EMAIL_G)) {
    if (!allowed.has((m[1] as string).toLowerCase())) spans.push({ start: m.index, end: m.index + m[0].length, kind: 'email' })
  }
  for (const re of [MOBILE_G, LANDLINE_G]) for (const m of text.matchAll(re)) spans.push({ start: m.index, end: m.index + m[0].length, kind: 'phone' })
  for (const m of text.matchAll(IC_G)) spans.push({ start: m.index, end: m.index + m[0].length, kind: 'ic' })
  return spans
}

const collapse = (s: string): string => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
const DIGIT_RUN = /\d[\d -]{5,}\d/g
const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u

/**
 * `collapse` of `text` with, for every UTF-16 unit of the result, the offsets of the source characters it came from.
 * NFKC is applied per base character with its combining marks and the lower case to the whole string, which gives the same
 * string as `collapse` for all text except a few cross-character compositions; a mismatch can only make the caller fall back to
 * redacting the whole cell, never miss a hit (redact.ts re-checks the output with `match`).
 */
function foldWithOffsets(text: string): { folded: string; start: number[]; end: number[] } {
  const start: number[] = []
  const end: number[] = []
  const chunks: string[] = []
  for (const m of text.matchAll(/\P{M}\p{M}*|\p{M}+/gu)) {
    const f = m[0].normalize('NFKC')
    chunks.push(f)
    for (let i = 0; i < f.length; i++) {
      start.push(m.index)
      end.push(m.index + m[0].length)
    }
  }
  const composed = chunks.join('')
  // Lower case the whole string, as `collapse` does (a final sigma depends on its neighbours). The few characters whose
  // lower case has another length (U+0130) are lower-cased one by one instead, so the offsets stay aligned.
  const whole = composed.toLowerCase()
  if (whole.length === composed.length) return { folded: whole, start, end }
  const s2: number[] = []
  const e2: number[] = []
  let folded = ''
  let at = 0
  for (const chunk of chunks) {
    const f = chunk.toLowerCase()
    for (let i = 0; i < f.length; i++) {
      s2.push(start[at] as number)
      e2.push(end[at] as number)
    }
    at += chunk.length
    folded += f
  }
  return { folded, start: s2, end: e2 }
}

/** Every string (and long integer) leaf of a cell. */
export function* leaves(value: unknown): Generator<string> {
  if (typeof value === 'string') yield value
  else if (typeof value === 'number' && Number.isInteger(value) && Math.abs(value) >= 100_000_000) yield String(value)
  else if (Array.isArray(value)) for (const v of value) yield* leaves(v)
  else if (value !== null && typeof value === 'object') for (const v of Object.values(value)) yield* leaves(v)
}

/** The parsed value of a json text cell (so its string leaves are indexed, not the whole text); anything else as it is. */
function parsedJson(original: unknown): unknown {
  if (typeof original !== 'string') return original
  try {
    return JSON.parse(original)
  } catch {
    return original
  }
}

/** Salted hashes of the original values that rules replaced. Memory only; never written anywhere. */
export class OriginalsIndex {
  private readonly salt = randomBytes(16)
  private readonly whole = new Set<string>()
  private readonly digitSeq = new Set<string>()
  private readonly nameGrams = new Set<string>()
  private readonly gramSizes = new Set<number>()

  get size(): number {
    return this.whole.size + this.digitSeq.size + this.nameGrams.size
  }

  private h(tag: string, text: string): string {
    return createHash('sha256').update(this.salt).update(tag).update(text).digest('hex').slice(0, 32)
  }

  /**
   * Index what `rule` replaced. `keep`, `redact-pii` (public content, kept except for the masked spans), `slug-from-id` and
   * `null-content` (content text such as an article slug or a banner link: it is not personal data in itself, and indexing it
   * would fail the scan on any other kept cell that equals it; personal names inside it are indexed from the identity tables)
   * and values that the rule left unchanged are never recorded.
   */
  record(rule: Rule, original: unknown, output: unknown): void {
    if (rule.rule === 'keep' || rule.rule === 'redact-pii' || rule.rule === 'slug-from-id' || rule.rule === 'null-content') return
    for (const s of leaves(rule.rule === 'scrub-json' ? parsedJson(original) : original)) {
      if (typeof output === 'string' && output === s) continue
      this.add(rule, s)
    }
  }

  private add(rule: Rule, raw: string): void {
    const n = collapse(raw)
    const kind = rule.rule === 'pseudonym' ? rule.kind : null
    const minWhole = rule.rule === 'scrub-text' || rule.rule === 'scrub-json' ? 20 : kind === 'username' || kind === 'code' || kind === 'opaque' ? 5 : 6
    if (n.length >= minWhole) this.whole.add(this.h('w', n))
    if (kind === 'phone' || kind === 'ic') {
      const d = raw.replace(/\D/g, '')
      if (d.length >= 7) this.digitSeq.add(this.h('d', d))
    }
    if (kind === 'name' || kind === 'org') {
      const tokens = n.split(TOKEN_SPLIT).filter(Boolean)
      if (tokens.length >= 2 && tokens.length <= 8 && n.length >= 8) {
        this.nameGrams.add(this.h('g', tokens.join(' ')))
        this.gramSizes.add(tokens.length)
      }
    }
    if (kind === 'email') {
      const local = n.split('@')[0] ?? ''
      if (local.length >= 6) this.whole.add(this.h('w', local))
    }
  }

  /** `original-value` or `original-name` when the cell text is or contains an indexed original, else null. */
  match(text: string): string | null {
    if (this.size === 0) return null
    const n = collapse(text)
    if (n.length >= 5 && this.whole.has(this.h('w', n))) return 'original-value'
    if (this.digitSeq.size > 0) {
      for (const run of text.match(DIGIT_RUN) ?? []) {
        const d = run.replace(/\D/g, '')
        if (d.length >= 7 && this.digitSeq.has(this.h('d', d))) return 'original-value'
      }
      const all = text.replace(/\D/g, '')
      if (all.length >= 7 && all.length <= 15 && this.digitSeq.has(this.h('d', all))) return 'original-value'
    }
    if (this.nameGrams.size > 0) {
      const tokens = n.split(TOKEN_SPLIT).filter(Boolean)
      for (const size of this.gramSizes) {
        for (let i = 0; i + size <= tokens.length; i++) {
          if (this.nameGrams.has(this.h('g', tokens.slice(i, i + size).join(' ')))) return 'original-name'
        }
      }
    }
    return null
  }

  /**
   * The spans of `text` that `match` would flag, by the same rules: the whole cell when it is an indexed whole value;
   * every digit run (and, when only the digits of the whole cell add up to it, the stretch from the first to the last
   * digit) of an indexed phone/IC digit sequence of at least 7 digits; every run of tokens that is an indexed multi-word
   * name (2 to 8 tokens, 8 characters). A single word is never a span on its own. Used by the redactor (redact.ts).
   */
  spans(text: string): PiiSpan[] {
    if (this.size === 0) return []
    if (this.whole.size > 0) {
      const n = collapse(text)
      if (n.length >= 5 && this.whole.has(this.h('w', n))) return [{ start: 0, end: text.length, kind: 'original-value' }]
    }
    const out: PiiSpan[] = []
    if (this.digitSeq.size > 0) {
      for (const m of text.matchAll(DIGIT_RUN)) {
        const d = m[0].replace(/\D/g, '')
        if (d.length >= 7 && this.digitSeq.has(this.h('d', d))) out.push({ start: m.index, end: m.index + m[0].length, kind: 'original-value' })
      }
      const all = text.replace(/\D/g, '')
      if (all.length >= 7 && all.length <= 15 && this.digitSeq.has(this.h('d', all))) {
        const first = text.search(/\d/)
        let last = text.length - 1
        while (last > first && !/\d/.test(text[last] as string)) last--
        out.push({ start: first, end: last + 1, kind: 'original-value' })
      }
    }
    if (this.nameGrams.size > 0) {
      const { folded, start, end } = foldWithOffsets(text)
      const tokens = [...folded.matchAll(/[\p{L}\p{N}]+/gu)]
      for (const size of this.gramSizes) {
        for (let i = 0; i + size <= tokens.length; i++) {
          const first = tokens[i] as RegExpMatchArray
          const last = tokens[i + size - 1] as RegExpMatchArray
          if (this.nameGrams.has(this.h('g', tokens.slice(i, i + size).map((t) => t[0]).join(' ')))) {
            out.push({ start: start[first.index as number] as number, end: end[(last.index as number) + last[0].length - 1] as number, kind: 'original-name' })
          }
        }
      }
    }
    return out
  }
}

export interface ScanResult {
  rowsScanned: number
  cellsScanned: number
  hits: LeakHit[]
}

export class LeakScanner {
  private readonly counts = new Map<string, LeakHit>()
  rows = 0
  cells = 0

  constructor(
    private readonly index: OriginalsIndex | null = null,
    private readonly patterns: ScanPatternOptions = {},
  ) {}

  scanRow(table: string, row: Record<string, unknown>): void {
    this.rows++
    for (const [column, value] of Object.entries(row)) {
      if (value === null || value === undefined) continue
      this.cells++
      for (const text of leaves(value)) {
        const kinds = patternKinds(text, this.patterns)
        const original = this.index?.match(text)
        if (original) kinds.push(original)
        for (const kind of kinds) {
          const key = `${table}\0${column}\0${kind}`
          const hit = this.counts.get(key)
          if (hit) hit.count++
          else this.counts.set(key, { table, column: PLAIN.test(column) ? column : '(unprintable name)', kind, count: 1 })
        }
      }
    }
  }

  result(): ScanResult {
    return { rowsScanned: this.rows, cellsScanned: this.cells, hits: [...this.counts.values()].sort((a, b) => `${a.table}.${a.column}`.localeCompare(`${b.table}.${b.column}`)) }
  }
}

const PLAIN = /^[a-z][a-z0-9_]{0,62}$/

/** Reads a finished `pp-staging-dump/1` directory and scans every row of every table in its manifest. */
export async function scanDumpDirectory(
  dir: string,
  scanner: LeakScanner,
  tables: readonly TableSpec[] = TABLES,
  batchSize = 2000,
): Promise<ScanResult> {
  const reader = new DirReader(dir)
  try {
    for (const spec of tables) {
      if (!(await reader.has(spec.name))) continue
      for await (const batch of reader.read(spec.name, batchSize)) for (const row of batch) scanner.scanRow(spec.name, row)
    }
  } finally {
    await reader.close()
  }
  return scanner.result()
}
