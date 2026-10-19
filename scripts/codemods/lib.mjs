// Shared helpers of the Wave 2 codemods (docs/design/v2-ds-hardening.md 7.5).
// Position-preserving edits: @vue/compiler-sfc finds the nodes, magic-string rewrites the source.
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

import { parse } from '@vue/compiler-sfc'
import MagicString from 'magic-string'

import { listFiles, ROOT } from '../lib/ds-debt-scan.mjs'

export { MagicString, ROOT }

export const CM_SCOPE = ['src/modules', 'src/shells', 'src/components', 'src/pages']

export function parseArgs(argv = process.argv.slice(2)) {
  const flags = new Set(argv.filter((a) => a.startsWith('--') && !a.includes('=')))
  const opts = Object.fromEntries(
    argv.filter((a) => a.startsWith('--') && a.includes('=')).map((a) => a.slice(2).split('=')),
  )
  return { dry: flags.has('--dry-run'), module: opts.module, json: flags.has('--json'), flags }
}

/** Files in the codemod scope (optionally one module `mNN`). `extra` adds scope roots. */
export function filesFor({ module, extra = [] } = {}) {
  let files = listFiles([...CM_SCOPE, ...extra])
  if (module) files = files.filter((f) => f.startsWith(`src/modules/${module}`))
  return files
}

export const kebab = (s) => s.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase()
export const pascalTag = (tag) =>
  /^[a-z]+(-[a-z0-9]+)+$/.test(tag)
    ? tag.replace(/(^|-)([a-z0-9])/g, (_, __, c) => c.toUpperCase())
    : tag

/** Depth-first element walk of a parsed template. */
export function walkElements(root, fn) {
  const walk = (node) => {
    if (node.type === 1) fn(node)
    for (const ch of node.children ?? []) if (typeof ch === 'object' && ch) walk(ch)
  }
  for (const ch of root.children ?? []) if (typeof ch === 'object' && ch) walk(ch)
}

export function parseSfc(file, source) {
  try {
    return parse(source, { filename: file }).descriptor
  } catch {
    return null
  }
}

/** The attribute `name` (camel or kebab, static or bound) of an element. */
export function findAttr(node, name) {
  const want = kebab(name)
  for (const p of node.props) {
    if (p.type === 6 && kebab(p.name) === want)
      return { p, kind: p.value ? 'static' : 'bare', value: p.value?.content, name: p.name }
    if (p.type === 7 && p.name === 'bind' && p.arg?.isStatic && kebab(p.arg.content) === want)
      return { p, kind: 'bound', exp: p.exp?.content?.trim(), name: p.arg.content }
  }
  return null
}

/** Literal string value of an attribute: static value, or a bound `'literal'`; undefined otherwise. */
export function literalValue(a) {
  if (!a) return undefined
  if (a.kind === 'static') return a.value
  if (a.kind === 'bound') {
    const m = /^(['"])([^'"\\]*)\1$/.exec(a.exp ?? '')
    return m ? m[2] : undefined
  }
  return undefined
}

/** Bare attribute / `:x="true"` -> true, `:x="false"` -> false, else undefined (dynamic). */
export function boolValue(a) {
  if (!a) return undefined
  if (a.kind === 'bare') return true
  if (a.kind === 'static') return a.value === '' || a.value === a.name ? true : undefined
  if (a.exp === 'true') return true
  if (a.exp === 'false') return false
  return undefined
}

/** Name in the caller's style (kebab stays kebab). */
export const styleName = (_orig, camel) => kebab(camel)

/** Replace an attribute by `text`. */
export function replaceAttr(ms, a, text) {
  ms.overwrite(a.p.loc.start.offset, a.p.loc.end.offset, text)
}

/** Remove an attribute together with the whitespace in front of it. */
export function removeAttr(ms, source, a) {
  let s = a.p.loc.start.offset
  while (s > 0 && /[ \t]/.test(source[s - 1])) s--
  if (s > 0 && source[s - 1] === '\n') {
    // attribute on its own line: remove the line break as well
    s--
    if (source[s - 1] === '\r') s--
  }
  ms.remove(s, a.p.loc.end.offset)
}

/** Rename only the name part of an attribute, keeping the value. */
export function renameAttr(ms, source, a, newCamel) {
  const text = source.slice(a.p.loc.start.offset, a.p.loc.end.offset)
  const nm = styleName(a.name, newCamel)
  const idx = text.indexOf(a.name)
  ms.overwrite(a.p.loc.start.offset + idx, a.p.loc.start.offset + idx + a.name.length, nm)
}

export class Report {
  constructor(name) {
    this.name = name
    this.files = new Set()
    this.hits = 0
    this.byRule = {}
    this.skipped = []
  }
  hit(file, rule, n = 1) {
    this.files.add(file)
    this.hits += n
    this.byRule[rule] = (this.byRule[rule] ?? 0) + n
  }
  skip(file, line, rule, reason) {
    this.skipped.push({ file, line, rule, reason })
  }
  print({ dry, json }) {
    const out = {
      codemod: this.name,
      mode: dry ? 'dry-run' : 'write',
      files: this.files.size,
      hits: this.hits,
      byRule: this.byRule,
      skipped: this.skipped.length,
    }
    if (json) console.log(JSON.stringify({ ...out, skippedDetail: this.skipped }, null, 2))
    else {
      console.log(JSON.stringify(out, null, 2))
      const by = {}
      for (const s of this.skipped)
        by[`${s.rule}: ${s.reason}`] = (by[`${s.rule}: ${s.reason}`] ?? 0) + 1
      for (const [k, v] of Object.entries(by)) console.log(`  skipped ${v}x ${k}`)
    }
  }
}

/** Runs `transform(file, source, report) -> string|null` over the files; writes unless dry. */
export function runCodemod(name, transform, args = parseArgs(), filesOpts = {}) {
  const report = new Report(name)
  for (const file of filesFor({ module: args.module, ...filesOpts })) {
    const abs = join(ROOT, file)
    const source = readFileSync(abs, 'utf8')
    const next = transform(file, source, report)
    if (next != null && next !== source && !args.dry) writeFileSync(abs, next)
  }
  report.print(args)
  return report
}
