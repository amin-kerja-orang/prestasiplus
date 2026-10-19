// CM-7 `:ui` removal (hardening spec 7.5): drops the class tokens of page-level `:ui="{ ... }"`
// objects that eslint/ui-prop-map.json lists as already applied by the ui.config defaults; an
// emptied slot is removed, an emptied object removes the attribute. Overrides that are still
// needed (no default, no prop or variant) stay and are listed in the report.
// Idempotent; `--dry-run`, `--module mNN`, `--json`.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findAttr, MagicString, parseSfc, removeAttr, runCodemod, walkElements } from './lib.mjs'

const MAP = JSON.parse(
  readFileSync(fileURLToPath(new URL('../../eslint/ui-prop-map.json', import.meta.url)), 'utf8'),
).map

/** Splits `a, b: (x, y), c` at top-level commas. */
function splitTop(body) {
  const out = []
  let depth = 0
  let quote = null
  let cur = ''
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (quote) {
      cur += ch
      if (ch === '\\') cur += body[++i]
      else if (ch === quote) quote = null
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') quote = ch
    if ('([{'.includes(ch)) depth++
    if (')]}'.includes(ch)) depth--
    if (ch === ',' && depth === 0) {
      out.push(cur)
      cur = ''
    } else cur += ch
  }
  if (cur.trim()) out.push(cur)
  return out
}

/** Returns the new expression text, or null when nothing changed. `''` = attribute is empty. */
export function pruneUi(exp, tag, el) {
  const rules = MAP[tag]
  if (!rules) return null
  const t = exp.trim()
  if (!(t.startsWith('{') && t.endsWith('}'))) return null
  const entries = splitTop(t.slice(1, -1))
    .map((e) => e.trim())
    .filter(Boolean)
  let changed = false
  const kept = []
  for (const e of entries) {
    const m = /^(?:(\w+)|'([\w-]+)')\s*:\s*(['"])((?:(?!\3)[^\\])*)\3$/.exec(e)
    const rule = m && rules[m[1] ?? m[2]]
    if (!m || !rule) {
      kept.push(e)
      continue
    }
    if (rule.when) {
      const ok = Object.entries(rule.when).every(([k, v]) => findAttr(el, k)?.value === v)
      if (!ok) {
        kept.push(e)
        continue
      }
    }
    const toks = m[4].split(/\s+/).filter(Boolean)
    const rest = toks.filter((x) => !rule.tokens.includes(x))
    if (rest.length === toks.length) {
      kept.push(e)
      continue
    }
    changed = true
    if (rest.length) kept.push(`${m[1] ?? `'${m[2]}'`}: ${m[3]}${rest.join(' ')}${m[3]}`)
  }
  if (!changed) return null
  if (!kept.length) return ''
  if (!t.includes('\n')) return `{ ${kept.join(', ')} }`
  const indent = /\n([ \t]*)\S/.exec(t.slice(1))?.[1] ?? ''
  const close = /\n([ \t]*)\}$/.exec(t)?.[1] ?? ''
  return `{\n${kept.map((k) => `${indent}${k},`).join('\n')}\n${close}}`
}

export function transformSource(file, source, report) {
  if (!file.endsWith('.vue')) return null
  const d = parseSfc(file, source)
  if (!d?.template?.ast) return null
  const ms = new MagicString(source)
  let n = 0
  walkElements(d.template.ast, (el) => {
    const a = findAttr(el, 'ui')
    if (!a || a.kind !== 'bound' || !a.exp) {
      if (a) report.skip(file, el.loc.start.line, el.tag, 'not an object literal')
      return
    }
    const next = pruneUi(a.exp, el.tag, el)
    if (next === null) {
      report.skip(
        file,
        el.loc.start.line,
        el.tag,
        'override still needed (no default or prop covers it)',
      )
      return
    }
    if (next === '') removeAttr(ms, source, a)
    else ms.overwrite(a.p.exp.loc.start.offset, a.p.exp.loc.end.offset, next)
    report.hit(file, el.tag)
    n++
  })
  return n ? ms.toString() : null
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runCodemod('CM-7 :ui removal', transformSource)
}
