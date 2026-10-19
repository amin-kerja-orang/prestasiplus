// CM-1 token class rewrites (hardening spec 7.5). Idempotent; `--dry-run`, `--module mNN`.
//   (a) redundant weight next to a type role that already sets it   font-semibold + text-label
//   (b) stock text-xs/sm/base/lg/xl/2xl -> the type role            text-sm -> text-body
//   (d) text-primary -> text-primary-t (D-H8 contrast)
//   (e) bg-<tone>/N -> bg-<tone>-soft (N <= 15) | -strong (16..30)  the ad-hoc alphas -> two tints
//   (f) palette -> token via eslint/palette-map.json (exact matches only; empty today)
// Scope: class="" and the string literals of :class in templates, plus class-list string literals
// in <script> and .ts. Print / share-card files keep their stock sizes (decision D-H4).
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { looksLikeClassList } from '../lib/ds-debt-scan.mjs'
import { MagicString, parseSfc, runCodemod, walkElements } from './lib.mjs'

const PALETTE = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../eslint/palette-map.json', import.meta.url)), 'utf8'),
).map

const TINT_RE = /^bg-(primary|highlight|success|warning|error|info)\/(\d{1,2})$/
const STOCK = {
  'text-xs': 'text-caption',
  'text-sm': 'text-body',
  'text-base': 'text-body',
  'text-lg': 'text-subheading',
  'text-xl': 'text-heading',
  'text-2xl': 'text-title',
}
const ROLE_RE = /^text-(display|title|heading|subheading|body|label|caption|overline)$/
/** Weight the role sets in BOTH personalities (tokens.css), so the utility is redundant. */
const ROLE_WEIGHT = { label: 'font-semibold', heading: 'font-bold', title: 'font-bold' }
/** Legacy-mirror / print files colour with the stock palette: their stock sizes are part of the replica. */
export const PALETTE_FILE =
  /\b(?:text|bg|border|from|to|via)-(?:slate|amber|indigo|purple|orange|red|emerald|blue|yellow|green|violet|gray)-\d{2,3}\b|\bbg-white\b/
export const PRINT_FILE = /RenewalInvoice|ReportQuestion|\/Kad[A-Z]\w*Card|AchievementShare|Harness/

/** Splits `md:hover:x` -> [prefix 'md:hover:', util 'x'] (brackets/parens aware). */
function split(token) {
  let depth = 0
  let last = -1
  for (let i = 0; i < token.length; i++) {
    const ch = token[i]
    if (ch === '[' || ch === '(') depth++
    else if (ch === ']' || ch === ')') depth--
    else if (ch === ':' && depth === 0) last = i
  }
  return [token.slice(0, last + 1), token.slice(last + 1)]
}

/** Rewrites one class list. Returns { text, counts }. */
export function rewriteClassList(text, opts = {}) {
  const counts = {}
  const bump = (k) => (counts[k] = (counts[k] ?? 0) + 1)
  const parts = text.split(/(\s+)/)
  const toks = []
  parts.forEach((p, i) => {
    if (i % 2 === 0 && p) {
      const [prefix, util] = split(p)
      toks.push({ i, prefix, util, drop: false })
    }
  })
  const has = (prefix, pred) => toks.some((t) => !t.drop && t.prefix === prefix && pred(t.util))

  // (d) (e) (f)
  for (const t of toks) {
    const m = TINT_RE.exec(t.util)
    if (m && Number(m[2]) <= 30) {
      t.util = `bg-${m[1]}-${Number(m[2]) <= 15 ? 'soft' : 'strong'}`
      bump('tint')
    } else if (t.util === 'text-primary') {
      t.util = 'text-primary-t'
      bump('text-primary')
    } else if (PALETTE[t.util]) {
      t.util = PALETTE[t.util]
      bump('palette')
    }
  }
  // (b) stock sizes
  if (!opts.keepStock) {
    for (const t of toks) {
      if (!(t.util in STOCK)) continue
      if (has(t.prefix, (u) => ROLE_RE.test(u))) {
        t.drop = true // a role of the same variant already decides
      } else if (t.util === 'text-sm' && has(t.prefix, (u) => u === 'font-semibold')) {
        t.util = 'text-label'
        toks.find((x) => x.prefix === t.prefix && x.util === 'font-semibold').drop = true
      } else t.util = STOCK[t.util]
      bump('stock-size')
    }
  }
  // (a) redundant weight, unprefixed role only
  const role = toks.find((t) => !t.drop && t.prefix === '' && ROLE_RE.test(t.util))
  if (role) {
    const w = ROLE_WEIGHT[ROLE_RE.exec(role.util)[1]]
    const wt = w && toks.find((t) => !t.drop && t.prefix === '' && t.util === w)
    if (wt) {
      wt.drop = true
      bump('weight')
    }
  }
  if (!Object.keys(counts).length) return { text, counts }

  // rebuild: drop duplicates created by the mapping, keep original whitespace
  const seen = new Set()
  const byIdx = new Map()
  for (const t of toks) {
    const full = t.prefix + t.util
    if (t.drop || seen.has(full)) byIdx.set(t.i, null)
    else {
      seen.add(full)
      byIdx.set(t.i, full)
    }
  }
  let res = ''
  let ws = ''
  let emitted = false
  let droppedLead = false
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i]
    if (i % 2 === 1) {
      ws = p
      continue
    }
    if (!p) {
      res += ws
      ws = ''
      continue
    }
    const tok = byIdx.get(i)
    if (tok === null) {
      if (!emitted) droppedLead = true
      continue
    }
    res += (emitted || !droppedLead ? ws : '') + tok
    emitted = true
    ws = ''
  }
  const lastTok = toks[toks.length - 1]
  const trailing =
    parts.length % 2 === 0 && lastTok && byIdx.get(lastTok.i) !== null ? parts.at(-1) : ''
  res += trailing
  return { text: res, counts }
}

/**
 * Walks code, skipping comments, and yields string literals { start, end, quote } (body = start..end).
 * Template literals with ${} are skipped (their parts are not plain class lists).
 */
export function* literals(code) {
  let i = 0
  while (i < code.length) {
    const ch = code[i]
    const two = code.slice(i, i + 2)
    if (two === '//') {
      while (i < code.length && code[i] !== '\n') i++
    } else if (two === '/*') {
      const e = code.indexOf('*/', i + 2)
      i = e < 0 ? code.length : e + 2
    } else if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      let simple = true
      while (j < code.length && code[j] !== ch) {
        if (code[j] === '\\') {
          simple = false
          j++
        } else if (ch === '`' && code[j] === '$' && code[j + 1] === '{') simple = false
        else if (ch !== '`' && code[j] === '\n') break
        j++
      }
      if (simple && code[j] === ch) yield { start: i + 1, end: j }
      i = j + 1
    } else i++
  }
}

/** Rewrites class-list string literals inside code/expression text (comments are left alone). */
function rewriteLiterals(code, opts, report, file) {
  let out = ''
  let pos = 0
  for (const { start, end } of literals(code)) {
    const body = code.slice(start, end)
    if (!looksLikeClassList(body)) continue
    const r = rewriteClassList(body, opts)
    if (r.text === body) continue
    for (const [k, v] of Object.entries(r.counts)) report.hit(file, k, v)
    out += code.slice(pos, start) + r.text
    pos = end
  }
  return out + code.slice(pos)
}

/** Sequential intensity ramps are a scale, not a tint (tokens.css): their alphas stay. */
const RAMP_FILE = /m08-student-performance\/lib\/analitik\//

export function transformSource(file, source, report) {
  if (RAMP_FILE.test(file)) return null
  const opts = { keepStock: PRINT_FILE.test(file) || PALETTE_FILE.test(source) }
  if (!file.endsWith('.vue')) return rewriteLiterals(source, opts, report, file)
  const d = parseSfc(file, source)
  if (!d) return null
  const ms = new MagicString(source)
  const regions = []
  if (d.template?.ast) {
    walkElements(d.template.ast, (el) => {
      for (const p of el.props) {
        if (p.type === 6 && p.name === 'class' && p.value) {
          const s = p.value.loc.start.offset + 1
          const e = p.value.loc.end.offset - 1
          const r = rewriteClassList(source.slice(s, e), opts)
          if (r.text !== source.slice(s, e)) {
            ms.overwrite(s, e, r.text)
            for (const [k, v] of Object.entries(r.counts)) report.hit(file, k, v)
          }
        } else if (p.type === 7 && p.name === 'bind' && p.arg?.content === 'class' && p.exp) {
          regions.push([p.exp.loc.start.offset, p.exp.loc.end.offset])
        }
      }
    })
  }
  for (const b of [d.script, d.scriptSetup])
    if (b) regions.push([b.loc.start.offset, b.loc.end.offset])
  for (const [s, e] of regions) {
    const old = source.slice(s, e)
    const nu = rewriteLiterals(old, opts, report, file)
    if (nu !== old) ms.overwrite(s, e, nu)
  }
  return ms.toString()
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runCodemod('CM-1 token class rewrites', transformSource)
}
