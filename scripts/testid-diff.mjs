// Codemod safety net (hardening spec 7.5): the multiset of test ids, routes and BM copy must not
// change when a codemod runs. Every string literal and template text of the page-level sources
// is collected EXCEPT class lists (those are what the codemods rewrite) and the known renamed
// prop vocabulary; whatever differs is printed so a human can confirm it is only vocabulary.
//   node scripts/testid-diff.mjs --write <file.json>     snapshot now
//   node scripts/testid-diff.mjs --compare <file.json>   diff against a snapshot (exit 1 on a change)
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { listFiles, looksLikeClassList, ROOT } from './lib/ds-debt-scan.mjs'

const SCOPE = ['src/modules', 'src/shells', 'src/components', 'src/pages', 'src/dev', 'src/router']

/** Vocabulary the prop codemods are allowed to change (old and new spelling). */
const VOCAB = new Set([
  'danger', 'error', 'good', 'bad', 'success', 'inline', 'heat', 'friend', 'keep', 'action', 'onPrimary',
  'warning', 'info', 'raised', 'none', 'compact', 'roomy', 'density', 'blank', 'bulk', 'bar', 'float',
])

/** Phosphor base names that the icon codemod may introduce (`fire` for `i-ph-fire-duotone`). */
const ICONS = new Set(
  ['src/theme/ds-icons.ts', 'src/theme/learn-icons.ts'].flatMap((f) =>
    [...readFileSync(join(ROOT, f), 'utf8').matchAll(/'([a-z0-9-]+)'/g)].map((m) => m[1]),
  ),
)

/** A multi-token string made only of utility-class looking tokens (the codemods rewrite those). */
const UTIL =
  /^(?:[a-z0-9-]+:)*!?-?(?:flex|grid|gap|p[xytblrse]?|m[xytblrse]?|size|w|h|min|max|text|bg|font|rounded|shadow|items|justify|shrink|grow|truncate|border|ring|opacity|overflow|sr|hidden|block|inline|sticky|absolute|relative|leading|tracking|col|row|z|top|left|right|bottom|inset|space|divide|object|aspect|cursor|select|transition|duration|animate|underline|uppercase|tabular|line|break|whitespace|self|content|place|order|basis|list|pointer|backdrop|blur|fill|stroke|outline|decoration|italic|static|fixed|not|group|peer|learner|staff|dark)(?:[-/[(].*|$)/
function classy(t) {
  const toks = t.split(/\s+/)
  return toks.length >= 2 && toks.every((x) => /^[!a-z0-9:\-/[\]()._%#&=@,']+$/.test(x)) && toks.some((x) => /[-:/[]/.test(x) && UTIL.test(x))
}

export function collect(source) {
  const out = {}
  const add = (s) => {
    const t = s.trim()
    if (!t || VOCAB.has(t)) return
    if (/^i-ph-[a-z0-9-]+$/.test(t) || ICONS.has(t)) return // icon spelling is a codemod target (R1)
    if (looksLikeClassList(t) || classy(t)) return
    out[t] = (out[t] ?? 0) + 1
  }
  for (const m of source.matchAll(/'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g))
    add(m[1] ?? m[2] ?? m[3])
  for (const m of source.matchAll(/>([^<>{}]+)</g)) add(m[1].replace(/\s+/g, ' '))
  return out
}

export function snapshot() {
  const snap = {}
  for (const f of listFiles(SCOPE)) {
    const strings = collect(readFileSync(join(ROOT, f), 'utf8'))
    for (const [k, v] of Object.entries(strings)) snap[`${f}\u0000${k}`] = v
  }
  return snap
}

export function diff(before, after) {
  const out = []
  for (const k of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[k] ?? 0
    const b = after[k] ?? 0
    if (a !== b) out.push({ file: k.split('\u0000')[0], text: k.split('\u0000')[1], before: a, after: b })
  }
  return out
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [mode, file] = process.argv.slice(2)
  if (mode === '--write' && file) {
    const s = snapshot()
    writeFileSync(file, JSON.stringify(s))
    console.log(`testid-diff: snapshot of ${Object.keys(s).length} strings -> ${file}`)
  } else if (mode === '--compare' && file && existsSync(file)) {
    const d = diff(JSON.parse(readFileSync(file, 'utf8')), snapshot())
    if (!d.length) console.log('testid-diff: identical (test ids, routes and copy unchanged)')
    else {
      for (const x of d) console.log(`${x.before} -> ${x.after}  ${x.file}  ${JSON.stringify(x.text.slice(0, 120))}`)
      console.log(`testid-diff: ${d.length} difference(s)`)
      process.exit(1)
    }
  } else {
    console.error('usage: node scripts/testid-diff.mjs --write|--compare <file.json>')
    process.exit(2)
  }
}
