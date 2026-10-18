// CM-0 census (hardening spec 7.5): dry run that estimates how many type / spacing hits the
// codemods CM-1..CM-4 could rewrite mechanically. Read-only; writes docs/qa/ds-census.md.
//   npm run ds:census                         write the report
//   node scripts/codemods/census.mjs --json   print the numbers
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { classifyFamily, scanTree, splitToken } from '../lib/ds-debt-scan.mjs'

const REPORT = fileURLToPath(new URL('../../docs/qa/ds-census.md', import.meta.url))

const TEXT_TAGS = /^(p|span|div|dt|dd|li|label|strong|em|small|h[1-6])$/
const CONTAINER_TAGS = /^(div|ul|ol|section|header|footer|nav|form|article|aside|main|fieldset)$/
const STEP = /^(0|0\.5|1|1\.5|2|2\.5|3|3\.5|4|5|6|8|10|12|16)$/ // numeric steps a DsSpace can absorb
const isNumStep = (v) => STEP.test(v)
const util = (t) => {
  const u = splitToken(t)[1]
  return u.startsWith('-') ? u.slice(1) : u
}

const SURFACE_OK =
  /^(bg-(default|elevated|soft|accented|muted)|rounded-(card|chip|sheet|xs|sm|md|lg|xl|full)|rounded|shadow-[\w-]+|shadow)$/

/** Token covered by a CM-2 text conversion on a text element. */
function textCovered(t) {
  const f = classifyFamily(t)
  if (!f) return true // allowed hook (truncate, text-center, line-clamp, min-w-0 ...)
  if (f.family === 'type') return true
  if (f.family === 'colour' && f.code === 'token' && /^text-/.test(util(t))) return true
  return false
}

/** Token covered by CM-3 (Stack / Cluster / Grid / Split). */
function layoutCovered(t) {
  const f = classifyFamily(t)
  if (!f) return true
  const u = util(t)
  if (f.family === 'layout') return true
  if (f.family === 'spacing') {
    const m = /^(gap|gap-x|gap-y|space-y|space-x|p|px|py)-(.+)$/.exec(u)
    return !!m && isNumStep(m[2])
  }
  return false
}

/** Token covered by CM-4 (DsSurface): surface tokens, padding, hooks. */
function surfaceCovered(t) {
  const f = classifyFamily(t)
  if (!f) return true
  const u = util(t)
  if (f.family === 'surface') return SURFACE_OK.test(u)
  if (f.family === 'spacing') {
    const m = /^(p|px|py)-(.+)$/.exec(u)
    return !!m && isNumStep(m[2])
  }
  return false
}

function classifyElement(el) {
  const toks = el.staticTokens
  const all = toks.map(util)
  const hasRole = toks.some((t) => classifyFamily(t)?.code === 'role')
  const hasFlexGrid = all.some((u) => /^(flex|inline-flex|grid|space-[xy]-.+)$/.test(u))
  const res = { cm2: false, cm3: false, cm4: false, split: false, reason: null }
  if (el.dynamic) return { ...res, reason: 'dynamic-class (:class expression)' }
  if (TEXT_TAGS.test(el.tag) && toks.every(textCovered) && (hasRole || /^h[1-6]$/.test(el.tag)))
    res.cm2 = true
  if (CONTAINER_TAGS.test(el.tag) && hasFlexGrid && toks.every(layoutCovered)) res.cm3 = true
  const hasSurface = toks.some((t) => classifyFamily(t)?.family === 'surface')
  if (CONTAINER_TAGS.test(el.tag) && hasSurface) {
    if (toks.every(surfaceCovered)) res.cm4 = true
    else if (toks.every((t) => surfaceCovered(t) || layoutCovered(t))) res.split = true
  }
  if (!res.cm2 && !res.cm3 && !res.cm4 && !res.split) {
    if (!TEXT_TAGS.test(el.tag) && !CONTAINER_TAGS.test(el.tag))
      res.reason = /^U[A-Z]/.test(el.tag) ? 'nuxt-ui-tag' : 'other-tag (a, button, svg, img, ...)'
    else res.reason = 'extra-tokens (mixed concerns on one element)'
  }
  return res
}

/** Decides the mechanical status of one hit. */
function judge(hit, el, info) {
  if (hit.dynamic) return { status: 'human', reason: 'dynamic-class (:class expression)' }
  if (hit.rule === 'type') {
    if (hit.code === 'stock-size') return { status: 'mech', via: 'CM-1 stock size to role' }
    if (info.cm2) return { status: 'mech', via: 'CM-2 DsText / DsHeading' }
    if (hit.code === 'weight' && el.staticTokens.some((t) => classifyFamily(t)?.code === 'role'))
      return { status: 'mech', via: 'CM-1 drop redundant weight' }
    if (info.reason) return { status: 'human', reason: info.reason }
    return { status: 'human', reason: 'no type role on element (weight / case only)' }
  }
  if (hit.code === 'off-step') return { status: 'mech', via: 'CM-1 off-step to nearest step' }
  if (info.cm3) return { status: 'mech', via: 'CM-3 DsStack / DsCluster / DsGrid' }
  if (info.cm4) return { status: 'mech', via: 'CM-4 DsSurface padding' }
  if (info.split) return { status: 'split', via: 'CM-3 + CM-4 (surface and layout on one element)' }
  if (/^(mt|mb|ml|mr|my|mx|ms|me|m)$/.test(hit.code))
    return { status: 'human', reason: 'margin (no primitive; structural change)' }
  if (/^(top|right|bottom|left|inset|start|end)$/.test(hit.code))
    return { status: 'human', reason: 'positioning offset' }
  if (info.reason) return { status: 'human', reason: info.reason }
  return { status: 'human', reason: 'padding / gap outside a convertible container' }
}

const init = () => ({ total: 0, mech: 0, split: 0, human: 0, via: {}, reasons: {} })

export function runCensus() {
  const { elements, hits } = scanTree()
  const infoOf = new Map()
  const elOf = new Map()
  for (const el of elements) {
    const id = `${el.file}:${el.line}:${el.tag}`
    infoOf.set(id, classifyElement(el))
    elOf.set(id, el)
  }
  const out = { type: init(), spacing: init() }
  const byModule = {}
  for (const h of hits) {
    if (h.rule !== 'type' && h.rule !== 'spacing') continue
    const id = `${h.file}:${h.line}:${h.tag}`
    const el = elOf.get(id)
    const info = infoOf.get(id)
    const j = el && info ? judge(h, el, info) : { status: 'human', reason: 'unresolved element' }
    const bucket = out[h.rule]
    bucket.total++
    const mod = h.file.split('/').slice(0, 3).join('/')
    byModule[mod] ??= { total: 0, mech: 0, split: 0 }
    byModule[mod].total++
    if (j.status === 'mech' || j.status === 'split') {
      bucket[j.status]++
      bucket.via[j.via] = (bucket.via[j.via] ?? 0) + 1
      byModule[mod][j.status]++
    } else {
      bucket.human++
      bucket.reasons[j.reason] = (bucket.reasons[j.reason] ?? 0) + 1
    }
  }
  const combined = {
    total: out.type.total + out.spacing.total,
    mech: out.type.mech + out.spacing.mech,
    split: out.type.split + out.spacing.split,
    human: out.type.human + out.spacing.human,
  }
  const elementPatterns = { cm2: 0, cm3: 0, cm4: 0, split: 0 }
  for (const info of infoOf.values())
    for (const k of Object.keys(elementPatterns)) if (info[k]) elementPatterns[k]++
  return { ...out, combined, byModule, elementPatterns }
}

const pct = (n, d) => (d ? ((n / d) * 100).toFixed(1) : '0.0') + ' %'
const table = (obj, total) =>
  Object.entries(obj)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `| ${k} | ${v} | ${pct(v, total)} |`)
    .join('\n')

export function render(r) {
  const c = r.combined
  const mod = Object.entries(r.byModule)
    .sort((a, b) => b[1].total - a[1].total)
    .map(
      ([k, v]) =>
        `| ${k} | ${v.total} | ${v.mech} | ${v.split} | ${pct(v.mech, v.total)} | ${pct(v.mech + v.split, v.total)} |`,
    )
    .join('\n')
  return `# Design-system codemod census (CM-0)

Generated by \`npm run ds:census\` (dry run, read-only). Scope: \`src/modules\`, \`src/shells\`, \`src/components\`, \`src/pages\` (same as \`npm run ds:debt\`). Hits are class tokens on non-\`Ds*\` elements; tokens on \`Ds*\` tags are the separate \`class-on-ds\` rule and are not counted here. Decision D-H3: stage 2 goes ahead only if coverage is at least 80 %.

## Headline

| | Hits | Mechanical (strict) | Mechanical incl. split | Human |
|---|---:|---:|---:|---:|
| type | ${r.type.total} | ${r.type.mech} (${pct(r.type.mech, r.type.total)}) | ${r.type.mech + r.type.split} (${pct(r.type.mech + r.type.split, r.type.total)}) | ${r.type.human} |
| spacing | ${r.spacing.total} | ${r.spacing.mech} (${pct(r.spacing.mech, r.spacing.total)}) | ${r.spacing.mech + r.spacing.split} (${pct(r.spacing.mech + r.spacing.split, r.spacing.total)}) | ${r.spacing.human} |
| **type + spacing** | **${c.total}** | **${c.mech} (${pct(c.mech, c.total)})** | **${c.mech + c.split} (${pct(c.mech + c.split, c.total)})** | **${c.human}** |

Strict = one codemod rewrites the element with no further structure change. "Split" = surface and layout tokens share one element, so the codemod must emit two nested elements (scriptable, higher review cost).

## Method (what counts as mechanical)

- CM-1: stock \`text-xs..9xl\` to the nearest role, redundant \`font-*\`/\`leading-*\`/\`tracking-*\` next to a role class, off-step spacing to the nearest step.
- CM-2: \`p span div dt dd li label strong em small h1-h6\` whose every class is a type role, a text tone, a typography utility or a containment hook, with a type role (or a heading tag), and no \`:class\` binding.
- CM-3: \`div ul ol section header footer nav form article aside main fieldset\` with \`flex\`/\`grid\`/\`space-*\` where every class is layout, a numeric gap/padding step or a hook.
- CM-4: the same tags with surface tokens (\`bg-default|elevated|soft|accented|muted\`, \`rounded-*\`, \`shadow-*\`) and numeric padding only.
- Everything else (margins, positioning, \`:class\` expressions, \`a\`/\`button\`/Nuxt UI tags, mixed concerns) is human.

Optimistic assumptions (the real coverage can only be lower): every \`rounded-*\`/\`shadow-*\` maps to a DsSurface value; the \`gap-N\` to DsSpace table is total; responsive gap pairs map to one token.

## Type (${r.type.total})

| Route | Hits | Share |
|---|---:|---:|
${table(r.type.via, r.type.total)}
| **mechanical** | ${r.type.mech} | ${pct(r.type.mech, r.type.total)} |

| Human reason | Hits | Share |
|---|---:|---:|
${table(r.type.reasons, r.type.total)}

## Spacing (${r.spacing.total})

| Route | Hits | Share |
|---|---:|---:|
${table(r.spacing.via, r.spacing.total)}
| **mechanical (strict)** | ${r.spacing.mech} | ${pct(r.spacing.mech, r.spacing.total)} |

| Human reason | Hits | Share |
|---|---:|---:|
${table(r.spacing.reasons, r.spacing.total)}

## Convertible elements

| Pattern | Elements |
|---|---:|
| CM-2 text | ${r.elementPatterns.cm2} |
| CM-3 layout | ${r.elementPatterns.cm3} |
| CM-4 surface | ${r.elementPatterns.cm4} |
| CM-3+4 split | ${r.elementPatterns.split} |

## By module / folder

| Folder | Hits | Mechanical | Split | Strict | Incl. split |
|---|---:|---:|---:|---:|---:|
${mod}
`
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const r = runCensus()
  if (process.argv.includes('--json')) console.log(JSON.stringify(r, null, 2))
  else {
    mkdirSync(dirname(REPORT), { recursive: true })
    writeFileSync(REPORT, render(r))
    const c = r.combined
    console.log(
      `Census: ${c.total} type+spacing hits; mechanical ${pct(c.mech, c.total)} strict, ${pct(c.mech + c.split, c.total)} incl. split. Wrote ${REPORT}`,
    )
  }
}
