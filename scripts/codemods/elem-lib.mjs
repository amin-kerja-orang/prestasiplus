// Shared helpers of the element-conversion codemods CM-2, CM-3, CM-4 (hardening spec 7.5).
// An element is rewritten in place (tag name, class attribute, import) by magic-string, so every
// other attribute (data-testid, id, aria-*, handlers, v-if/v-for) and all children stay untouched.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { classifyFamily, splitToken } from '../lib/ds-debt-scan.mjs'
import { PRINT_FILE } from './cm1-tokens.mjs'
import { MagicString, parseSfc, removeAttr, ROOT, filesFor, Report, parseArgs } from './lib.mjs'

export { MagicString, Report, parseArgs }

/** DsSpace token of a Tailwind gap step (`gap-N`). Steps without a token (1.5, 5, 12 ...) are absent. */
export const GAP = { 0: 'none', 1: '2xs', 2: 'xs', 3: 'sm', 4: 'md', 6: 'lg', 8: 'xl', 10: '2xl' }

/** Prop names of the Ds layout / text primitives: an element that already uses one is not converted. */
const PROP_NAMES = new Set([
  'as',
  'gap',
  'row-gap',
  'align',
  'justify',
  'wrap',
  'cols',
  'fill',
  'padding',
  'variant',
  'tone',
  'level',
  'truncate',
  'clamp',
  'tabular',
  'prose',
  'sr-only',
  'radius',
  'shadow',
  'emphasis',
  'interactive',
  'selected',
  'disabled',
  'loading',
  'invalid',
  'clip',
  'layout',
  'width',
  'min-item',
  'stack-below',
  'ratio',
  'focusable',
  'to',
  'href',
  'type',
])
const kebabCase = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()

export const tokensOf = (cls) =>
  cls
    .split(/\s+/)
    .filter(Boolean)
    .map((raw) => {
      const [variants, util0] = splitToken(raw)
      return { raw, variants, util: util0, plain: variants.length === 0 }
    })

/** Class facts of an element, or a reason it cannot be converted at all. */
export function elementFacts(el, source) {
  let cls = null
  let classProp = null
  for (const p of el.props) {
    if (p.type === 6 && p.name === 'class') {
      cls = p.value?.content ?? ''
      classProp = p
    } else if (p.type === 7 && p.name === 'bind' && (!p.arg || p.arg.content === 'class'))
      return { reason: 'dynamic-class' }
    if (p.type === 6 && p.name === 'ref') return { reason: 'ref (instance, not element)' }
    if (p.type === 7 && ['html', 'text', 'is'].includes(p.name)) return { reason: `v-${p.name}` }
    if (p.type === 7 && p.name === 'slot') return { reason: 'v-slot' }
    const name = p.type === 6 ? p.name : p.name === 'bind' && p.arg?.isStatic ? p.arg.content : null
    if (name && name !== 'class' && PROP_NAMES.has(kebabCase(name)))
      return { reason: `attribute "${name}" clashes with a prop` }
  }
  if (cls === null) return { reason: 'no class' }
  return { cls, classProp, tokens: tokensOf(cls), source }
}

/** True for a token that is a legal page-level hook (kept in `class`): unknown utility or allow-listed. */
export const isHook = (t) => classifyFamily(t.raw) === null

/** Replaces tag name (open + close) and the class attribute. `props` = attribute strings, `rest` = kept classes. */
export function applyPlan(ms, source, el, facts, { tag, props, rest }) {
  const open = el.loc.start.offset
  ms.overwrite(open + 1, open + 1 + el.tag.length, tag)
  if (!el.isSelfClosing) {
    const end = el.loc.end.offset
    // the element's own closing tag is the last `</` before `end` (a sibling's may start AT `end`)
    const closeIdx = source.lastIndexOf('</', end - 1)
    if (closeIdx >= open) ms.overwrite(closeIdx + 2, closeIdx + 2 + el.tag.length, tag)
  }
  const text = [...props, ...(rest.length ? [`class="${rest.join(' ')}"`] : [])].join(' ')
  const a = { p: facts.classProp }
  if (text) ms.overwrite(a.p.loc.start.offset, a.p.loc.end.offset, text)
  else removeAttr(ms, source, a)
}

/** Adds `names` to the `@/ds` import of a `<script setup>` (creates the block/import when absent). */
export function addDsImport(source, d, names) {
  const need = [...new Set(names)]
  if (!need.length) return source
  const setup = d.scriptSetup
  if (!setup) {
    if (d.script) return null // options-style script block: not safe to extend
    return `<script setup lang="ts">\nimport { ${need.sort().join(', ')} } from '@/ds'\n</script>\n\n${source}`
  }
  const body = setup.content
  const offset = setup.loc.start.offset
  const re = /import\s*\{([^}]*)\}\s*from\s*'@\/ds'/g
  let m
  let last = null
  while ((m = re.exec(body))) {
    if (!/^\s*import\s+type\b/.test(m[0])) last = m
  }
  if (last) {
    const have = last[1]
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean)
    const missing = need.filter((n) => !have.some((h) => h === n || h.endsWith(` as ${n}`)))
    if (!missing.length) return source
    const multiline = last[1].includes('\n')
    const names2 = [...have, ...missing]
    const open = offset + last.index
    const inner = multiline ? `{\n  ${names2.join(',\n  ')},\n}` : `{ ${names2.join(', ')} }`
    return (
      source.slice(0, open) + `import ${inner} from '@/ds'` + source.slice(open + last[0].length)
    )
  }
  const line = `import { ${need.sort().join(', ')} } from '@/ds'\n`
  // after the last top-level import statement
  const imports = [...body.matchAll(/^import[\s\S]*?from\s*['"][^'"]+['"];?[ \t]*$/gm)]
  const sideEffect = [...body.matchAll(/^import\s*['"][^'"]+['"];?[ \t]*$/gm)]
  const all = [...imports, ...sideEffect].sort((a, b) => a.index - b.index)
  if (all.length) {
    const lastImp = all[all.length - 1]
    const at = offset + lastImp.index + lastImp[0].length
    return source.slice(0, at) + '\n' + line.trimEnd() + source.slice(at)
  }
  const at = offset + (body.startsWith('\n') ? 1 : 0)
  return source.slice(0, at) + line + source.slice(at)
}

/** Runs one element codemod. `visit(el, ctx) -> plan | {skip: reason, count?: bool} | null`. */
export function runElementCodemod(name, rule, visit, args = parseArgs()) {
  const report = new Report(name)
  const files = filesFor({ module: args.module }).filter(
    (f) => f.endsWith('.vue') && !f.startsWith('src/components/') && !PRINT_FILE.test(f),
  )
  for (const file of files) {
    const abs = join(ROOT, file)
    const source = readFileSync(abs, 'utf8')
    const d = parseSfc(file, source)
    if (!d?.template?.ast) continue
    const ms = new MagicString(source)
    const used = new Set()
    const plans = []
    const walk = (node, ancestors) => {
      if (node.type === 1) {
        const r = visit(node, { file, source, ancestors, d })
        if (r?.skip) report.skip(file, node.loc.start.line, rule, r.skip)
        else if (r) plans.push({ node, r })
        for (const ch of node.children ?? [])
          if (typeof ch === 'object' && ch) walk(ch, [...ancestors, node])
      } else
        for (const ch of node.children ?? []) if (typeof ch === 'object' && ch) walk(ch, ancestors)
    }
    walk(d.template.ast, [])
    if (!plans.length) continue
    for (const { node, r } of plans) {
      applyPlan(ms, source, node, r.facts, r)
      for (const n of [r.tag, ...(r.extraImports ?? [])]) used.add(n)
    }
    let out = ms.toString()
    // offsets of the edited text differ from `d`: re-parse before computing the import edit
    out = addDsImport(out, parseSfc(file, out) ?? d, [...used])
    if (out == null) {
      report.skip(file, 1, rule, 'options-style <script> (no <script setup>)')
      continue
    }
    for (const { r } of plans) report.hit(file, r.tag)
    if (!args.dry) writeFileSync(abs, out)
  }
  report.print(args)
  return report
}
