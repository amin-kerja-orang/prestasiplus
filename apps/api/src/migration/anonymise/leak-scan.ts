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
import { EMAIL_DOMAIN } from './pseudonyms'
import type { Rule } from './rules'

const EMAIL = /[A-Za-z0-9._%+'-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,})/g
// +60/60/0 then 1x then 7-8 digits; separators (space or dash) allowed between the groups.
const MOBILE = /(?<![\d+])(?:\+?60|0)[ -]?1\d[ -]?\d{3,4}[ -]?\d{4}(?!\d)/
// Landline: area code 3 to 9, then 7-8 digits.
const LANDLINE = /(?<![\d+])(?:\+?60|0)[ -]?[3-9][ -]?\d{3,4}[ -]?\d{4}(?!\d)/
// YYMMDD (valid month and day) - place code - serial, separators optional.
const IC = /(?<!\d)\d{2}(?:0[1-9]|1[0-2])(?:0[1-9]|[12]\d|3[01])[ -]?\d{2}[ -]?\d{4}(?!\d)/

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

const collapse = (s: string): string => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()
const DIGIT_RUN = /\d[\d -]{5,}\d/g
const TOKEN_SPLIT = /[^\p{L}\p{N}]+/u

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

  /** Index what `rule` replaced. `keep` and values that the rule left unchanged are never recorded. */
  record(rule: Rule, original: unknown, output: unknown): void {
    if (rule.rule === 'keep') return
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
