import { REDACTED_MARK } from './workflow.constants'

/** Kinds of detail a mask can remove (the contract `AiRedactionFlag` list). */
export type RedactionFlag = 'person_name' | 'school_name' | 'phone' | 'email' | 'ic_number' | 'address'

export interface Redacted {
  text: string
  /** Spans masked per kind. Counts only, never the masked text. */
  masked: Partial<Record<RedactionFlag, number>>
  /**
   * The spans that were masked (in memory only, never stored or logged): used to mask a provider that echoes them back
   * in its answer. Words of a masked person name are listed too.
   */
  spans: string[]
}

const EMAIL = /[\p{L}\p{N}._%+-]+@[\p{L}\p{N}-]+(?:\.[\p{L}\p{N}-]+)+/gu
// MyKad: 6 + 2 + 4 digits with optional "-" or space separators.
const IC = /(?<![\d-])\d{6}[- ]?\d{2}[- ]?\d{4}(?![\d-])/g
// Mobile (01x) and landline numbers, with or without the country code.
const MOBILE = /(?<![\d-])(?:\+?60[- ]?|0)1\d[- ]?\d{3,4}[- ]?\d{4}(?![\d-])/g
const LANDLINE = /(?<![\d-])(?:\+?60[- ]?|0)[3-9][- ]?\d{3,4}[- ]?\d{4}(?![\d-])/g
// School names abbreviated or written out in upper case, as on a cover page ("SMK TAMAN CONTOH").
const SCHOOL_ABBREV = /\b(?:SMKA|SMK|SMJK|SMT|SMV|SBP|MRSM|SJK|SK|SMS|SMA|KV)\s+(?:\([CT]\)\s+)?\p{Lu}[\p{Lu}'’.-]*(?:\s+\p{Lu}[\p{Lu}'’.-]*){0,5}/gu
const SCHOOL_FULL = /\b(?:SEKOLAH|SEK\.)\s+\p{Lu}[\p{Lu}'’. -]{4,70}/gu

/**
 * "Label: value" lines of a cover page. The label stays, the value is masked. A colon is required, so running text
 * ("nama-nama haiwan", "guru mengajar") is never touched.
 */
const LABELS: ReadonlyArray<{ flag: RedactionFlag; words: string }> = [
  {
    flag: 'person_name',
    words:
      "nama(?:\\s+(?:pelajar|murid|calon|guru|penuh))?|name|student(?:'s)?\\s+name|calon|pelajar|murid|guru(?:\\s+(?:mata\\s+pelajaran|subjek|kelas))?|cikgu|teacher|disediakan\\s+oleh|disemak\\s+oleh|penyedia|pembina|prepared\\s+by|checked\\s+by",
  },
  { flag: 'school_name', words: 'sekolah|school|kelas|class' },
  { flag: 'address', words: 'alamat|address' },
  { flag: 'phone', words: 'no\\.?\\s*tel(?:efon)?|tel(?:efon)?|telephone|phone|no\\.?\\s*hp|hp' },
  { flag: 'ic_number', words: 'no\\.?\\s*kp|no\\.?\\s*mykad|no\\.?\\s*k\\/p|ic(?:\\s*no\\.?)?|mykad' },
  { flag: 'email', words: 'e-?mel|e-?mail' },
]
const LABELLED = LABELS.map(({ flag, words }) => ({
  flag,
  re: new RegExp(`^([ \\t]*(?:${words})[ \\t]*[:：][ \\t]*)([^\\n]*\\S[^\\n]*)$`, 'gimu'),
}))

const MIN_SPAN = 4

function addSpan(spans: string[], text: string, flag: RedactionFlag): void {
  const t = text.trim()
  if (t.length >= MIN_SPAN) spans.push(t)
  if (flag === 'person_name') for (const w of t.split(/[\s,]+/)) if (w.length >= MIN_SPAN && w.toLowerCase() !== 'bin' && w.toLowerCase() !== 'binti') spans.push(w)
}

function bump(masked: Redacted['masked'], flag: RedactionFlag, n = 1): void {
  masked[flag] = (masked[flag] ?? 0) + n
}

function replaceAll(text: string, re: RegExp, flag: RedactionFlag, masked: Redacted['masked'], spans: string[]): string {
  return text.replace(re, (all: string) => {
    bump(masked, flag)
    addSpan(spans, all, flag)
    return REDACTED_MARK
  })
}

/**
 * Masks the personal details of a cover page (names after a label, school names, phone numbers, e-mail addresses,
 * MyKad numbers, addresses) before the text of a page goes to a provider (AC-8). It is a pattern filter, not a name
 * recogniser: a bare name on a line without a label stays. The extraction job therefore also keeps the page IMAGE
 * out of the request whenever it masked something on that page.
 */
export function redactText(text: string): Redacted {
  const masked: Redacted['masked'] = {}
  const spans: string[] = []
  let out = text
  for (const { flag, re } of LABELLED) {
    out = out.replace(re, (_all, label: string, value: string) => {
      bump(masked, flag)
      addSpan(spans, value, flag)
      return `${label}${REDACTED_MARK}`
    })
  }
  out = replaceAll(out, EMAIL, 'email', masked, spans)
  out = replaceAll(out, IC, 'ic_number', masked, spans)
  out = replaceAll(out, MOBILE, 'phone', masked, spans)
  out = replaceAll(out, LANDLINE, 'phone', masked, spans)
  out = replaceAll(out, SCHOOL_FULL, 'school_name', masked, spans)
  out = replaceAll(out, SCHOOL_ABBREV, 'school_name', masked, spans)
  return { text: out, masked, spans: [...new Set(spans)] }
}

export function maskedCount(r: Redacted): number {
  return Object.values(r.masked).reduce((n, c) => n + (c ?? 0), 0)
}

/**
 * Identifiers that must never be stored in an extracted payload whatever the provider returned: MyKad numbers, e-mail
 * addresses and phone numbers, in every string of a JSON value. (Names and schools are removed from the INPUT; the
 * output of a provider that was given no name cannot contain one.)
 */
export function scrubIdentifiers<T>(value: T): T {
  if (typeof value === 'string') {
    let s: string = value
    for (const re of [EMAIL, IC, MOBILE, LANDLINE]) s = s.replace(re, REDACTED_MARK)
    return s as T
  }
  if (Array.isArray(value)) return value.map((v) => scrubIdentifiers(v)) as T
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, scrubIdentifiers(v)])) as T
  }
  return value
}

/** Masks every listed span (case-insensitive) in every string of a JSON value; the provider must not echo what was masked. */
export function maskSpans<T>(value: T, spans: readonly string[]): T {
  if (spans.length === 0) return value
  const escaped = [...spans].sort((a, b) => b.length - a.length).map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const re = new RegExp(escaped.join('|'), 'giu')
  const walk = (v: unknown): unknown => {
    if (typeof v === 'string') return v.replace(re, REDACTED_MARK)
    if (Array.isArray(v)) return v.map(walk)
    if (v !== null && typeof v === 'object') return Object.fromEntries(Object.entries(v as Record<string, unknown>).map(([k, x]) => [k, walk(x)]))
    return v
  }
  return walk(value) as T
}
