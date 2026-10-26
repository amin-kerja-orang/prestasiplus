/**
 * The normalised view of a string for the leak scan (A1-LEAK follow-up F1), in a file of its own with NO imports (like
 * patterns.ts), so the leak scan, the `redact-pii` rule and the question screen of QLOAD (transform/question-bank.ts
 * `piiKindsOf`) read the same text and the pure transform does not pull in the anonymiser.
 *
 * Why: the scan patterns and the originals index read the raw characters. Personal data that a reader still sees but the
 * raw characters hide survives both the scan and the redactor: a name split by a tag or `&nbsp;`, a phone number with a
 * zero-width character, a soft hyphen or an entity inside it, digits written full-width or Arabic-Indic, an e-mail written
 * with `&commat;`, and a phone number inside a JSON string whose characters are JSON-escaped (`0`).
 *
 * `normaliseForScan` is a pure function. In this order it:
 *   1. replaces every HTML tag the way a reader would see it (`tags` 'render', the default): an INLINE tag (`b`, `span`, `sup`,
 *      `a`, ...) with nothing, so a number or a name cut by formatting is whole again (`012-<span>345</span> 6789`,
 *      `<b>Ali</b> bin Abu`); a BLOCK tag (`br`, `p`, `div`, `li`, `td`, `tr`, `table`, `h1`...) with ` | `, so the text on
 *      either side stays apart (`Ali<br>Abu` is two words, and the cells of a table are not one number: `<td>60</td><td>8121</td>`
 *      must not read as the landline shape `60 8121`). The other modes are for comparison: 'space' (every tag a space) and
 *      'join' (every tag nothing);
 *   2. decodes HTML entities: numeric (decimal, hex, the `;` may be missing) and a fixed list of named ones, in at most two
 *      passes (so `&amp;#48;` is read too). An entity that is not in the list, or not a valid scalar value, stays as it is;
 *   3. removes zero-width and other invisible characters (U+200B to U+200F, U+202A to U+202E, U+2060 to U+2064, U+00AD, U+034F,
 *      U+180E, U+FE00 to U+FE0F, U+FEFF);
 *   4. applies NFKC (full-width digits, letters and punctuation; no-break and other spaces; superscripts);
 *   5. maps the decimal digits that NFKC leaves (Arabic-Indic U+0660 to 0669, Extended Arabic-Indic U+06F0 to 06F9, and the
 *      other common scripts, see `DIGIT_ZEROS`) to ASCII `0` to `9`, and the dash variants (U+2010 to U+2015, U+2212) to `-`;
 *   6. treats a line break like a block tag (a separator, so two lines are not one number: `03` and `71801400` on two lines),
 *      collapses every other run of white space to one space and trims.
 *
 * Cost: every step is one pass over the text with a bounded pattern (the tag pattern cannot cross a `<` or `>`, the entity
 * pattern is at most 40 characters), so the whole is linear in the length of the text. An ASCII text without `<`, `&` or runs
 * of white space comes back unchanged and is not copied.
 *
 * The view is only ever USED IN ADDITION to the raw text (a hit on either counts), so the scan gets stricter, never looser.
 */

/** Zero code point of each script's block of ten decimal digits that NFKC does not fold. */
const DIGIT_ZEROS: readonly number[] = [
  0x0660, // Arabic-Indic
  0x06f0, // Extended Arabic-Indic (Persian, Urdu)
  0x07c0, // N'Ko
  0x0966, // Devanagari
  0x09e6, // Bengali
  0x0a66, // Gurmukhi
  0x0ae6, // Gujarati
  0x0b66, // Oriya
  0x0be6, // Tamil
  0x0c66, // Telugu
  0x0ce6, // Kannada
  0x0d66, // Malayalam
  0x0e50, // Thai
  0x0ed0, // Lao
  0x0f20, // Tibetan
  0x1040, // Myanmar
  0x17e0, // Khmer
  0x1810, // Mongolian
]
const hex4 = (n: number): string => `\\u${n.toString(16).padStart(4, '0')}`
const NON_ASCII_DIGIT = new RegExp(`[${DIGIT_ZEROS.map((z) => `${hex4(z)}-${hex4(z + 9)}`).join('')}]`, 'g')
const digitOf = (c: string): string => {
  const code = c.charCodeAt(0)
  for (const z of DIGIT_ZEROS) if (code >= z && code <= z + 9) return String(code - z)
  return c
}

const INVISIBLE = /[\u00ad\u034f\u180e\u200b-\u200f\u202a-\u202e\u2060-\u2064\ufe00-\ufe0f\ufeff]/g
const DASH = /[\u2010-\u2015\u2212]/g
const NON_ASCII = /[^\x00-\x7f]/
// A tag: `<`, an optional `/`, a letter or `!`, then anything that is not `<` or `>`, then `>`. It cannot cross another `<`,
// so every start position is looked at once and the pattern is linear. `x < y` and `a<3` are not tags (a space or a digit follows).
const TAG = /<\/?[A-Za-z!][^<>]*>/g
const TAG_NAME = /^<\/?([A-Za-z0-9]*)/
const BLOCK = new Set(
  ('p br hr div li ul ol dl dt dd table thead tbody tfoot tr td th caption h1 h2 h3 h4 h5 h6 blockquote pre section article header footer figure figcaption center form fieldset address nav aside main').split(' '),
)
export type TagMode = 'render' | 'space' | 'join'
const tagText = (tag: string, mode: TagMode): string => {
  if (mode === 'space') return ' '
  if (mode === 'join') return ''
  return BLOCK.has((TAG_NAME.exec(tag)?.[1] ?? '').toLowerCase()) ? SEP : ''
}
/** Stands for a block tag until the end (then ` | `; none at either end of the text), so a run of them is one and no pattern is run on a half-made string. */
const SEP = '\u001e'
const SEPARATED = / ?\u001e(?: ?\u001e)* ?/g
const isBlank = (c: number): boolean => c === 0x1e || c === 0x20 || (c >= 9 && c <= 13) || c === 0xa0 || c === 0x2028 || c === 0x2029 || c === 0xfeff || c === 0x1680 || (c >= 0x2000 && c <= 0x200a) || c === 0x202f || c === 0x205f || c === 0x3000
// One pass: anything that the steps below could change (a non-printable or non-ASCII character, a tag or entity start, a backslash,
// a run of two spaces, a space at either end). Plain printable ASCII text without them comes back as it is.
const NEEDS_WORK = /[^\x20-\x7e]|[<&\\]|  |^ | $/
const SPACES = /\s{2,}|[^\S ]/g
const LINE_BREAKS = /[\n\r\v\f\u0085\u2028\u2029]+/g

// Named entities that can hide (or stand in for) a character of a phone number, an e-mail address or a name. The list is fixed.
const NAMED = new Map<string, string>(Object.entries({
  amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0', shy: '\u00ad', zwnj: '\u200c', zwj: '\u200d', lrm: '\u200e', rlm: '\u200f',
  ensp: '\u2002', emsp: '\u2003', thinsp: '\u2009', numsp: '\u2007', puncsp: '\u2008', hairsp: '\u200a', ZeroWidthSpace: '\u200b', NoBreak: '\u2060',
  NewLine: '\n', Tab: '\t', commat: '@', period: '.', comma: ',', colon: ':', semi: ';', plus: '+', hyphen: '-', dash: '-', minus: '\u2212', ndash: '\u2013',
  mdash: '\u2014', lpar: '(', rpar: ')', lbrack: '[', rbrack: ']', lsqb: '[', rsqb: ']', num: '#', sol: '/', bsol: '\\', lowbar: '_', percnt: '%', excl: '!', quest: '?',
  ast: '*', equals: '=', dollar: '$', vert: '|', grave: '`', Hat: '^', tilde: '~', lcub: '{', rcub: '}',
}))
// `&#48;` `&#x30;` (the `;` may be missing), or `&name;`, or the five legacy names that browsers also read without a `;`.
const ENTITY = /&(?:#[xX]([0-9a-fA-F]{1,6});?|#(\d{1,7});?|([A-Za-z][A-Za-z0-9]{1,31});|(nbsp|amp|lt|gt|quot)(?![A-Za-z0-9]))/g

function decodeEntities(text: string): string {
  let cur = text
  for (let pass = 0; pass < 2 && cur.includes('&'); pass++) {
    const next = cur.replace(ENTITY, (whole: string, hexCode?: string, decCode?: string, name?: string, legacy?: string) => {
      if (name !== undefined || legacy !== undefined) return NAMED.get((name ?? legacy) as string) ?? whole
      const code = hexCode !== undefined ? parseInt(hexCode, 16) : parseInt(decCode as string, 10)
      // not a scalar value (0, a control other than tab, line feed and carriage return, a surrogate, beyond U+10FFFF): left as it is
      const ok = code === 9 || code === 10 || code === 13 || (code >= 32 && code <= 0x10ffff && code !== 0x7f && !(code >= 0x80 && code <= 0x9f) && !(code >= 0xd800 && code <= 0xdfff))
      return ok ? String.fromCodePoint(code) : whole
    })
    if (next === cur) break
    cur = next
  }
  return cur
}

/**
 * The normalised view of `s` (see the header). `tags` chooses what a tag becomes (default 'render').
 * Returns `s` itself when nothing changes.
 */
export function normaliseForScan(s: string, tags: TagMode = 'render'): string {
  if (!NEEDS_WORK.test(s)) return s
  let t = s
  if (t.includes('<')) t = t.replace(TAG, (tag) => tagText(tag, tags))
  if (t.includes('&')) t = decodeEntities(t)
  if (NON_ASCII.test(t)) {
    t = t.replace(INVISIBLE, '').normalize('NFKC').replace(INVISIBLE, '').replace(NON_ASCII_DIGIT, digitOf).replace(DASH, '-')
  }
  t = t.replace(LINE_BREAKS, SEP)
  let from = 0
  let to = t.length
  while (from < to && isBlank(t.charCodeAt(from))) from++
  while (to > from && isBlank(t.charCodeAt(to - 1))) to--
  if (from > 0 || to < t.length) t = t.slice(from, to)
  t = t.replace(SPACES, ' ')
  return t.includes(SEP) ? t.replace(SEPARATED, ' | ') : t
}

/** The string leaves of a JSON text that holds backslash escapes (keys too, as the raw text scan reads them), joined by line feeds; else null. */
function jsonStrings(s: string): string | null {
  if (!s.includes('\\')) return null
  const first = s.trimStart().charCodeAt(0)
  if (first !== 0x7b && first !== 0x5b && first !== 0x22) return null // { [ "
  let parsed: unknown
  try {
    parsed = JSON.parse(s)
  } catch {
    return null
  }
  const out: string[] = []
  const stack: unknown[] = [parsed]
  while (stack.length > 0) {
    const v = stack.pop()
    if (typeof v === 'string') out.push(v)
    else if (Array.isArray(v)) for (let i = v.length - 1; i >= 0; i--) stack.push(v[i])
    else if (v !== null && typeof v === 'object') {
      for (const [k, x] of Object.entries(v).reverse()) {
        stack.push(x)
        out.push(k)
      }
    }
  }
  return out.length === 0 ? null : out.join('\n')
}

const NO_VIEWS: readonly string[] = []
let memoIn: string | null = null
let memoOut: readonly string[] = []

/**
 * The views of `s` that the scan reads IN ADDITION to the raw text: the normalised view, and the same for the string leaves of
 * a JSON text whose escapes hide characters (and the leaves as they are).
 * Only views that differ from `s` are returned, so a plain text has none. The last answer is remembered (the scan asks
 * for the pattern kinds and the originals match of the same string one after the other).
 */
export function scanViews(s: string): readonly string[] {
  if (s === memoIn) return memoOut
  if (!NEEDS_WORK.test(s)) return NO_VIEWS
  const views: string[] = []
  const base = s.trim() // a view that differs from the raw text only by outer white space adds nothing
  const add = (v: string): void => {
    if (v !== s && v !== base && v !== '' && !views.includes(v)) views.push(v)
  }
  add(normaliseForScan(s))
  const json = jsonStrings(s)
  if (json !== null) {
    add(normaliseForScan(json))
    add(json)
  }
  memoIn = s
  memoOut = views
  return views
}
