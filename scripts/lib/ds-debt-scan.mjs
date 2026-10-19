// Scanner core for `npm run ds:debt` and the CM-0 census (docs/design/v2-ds-hardening.md 6.4, 7.5).
// Walks the page-level source tree, extracts every class token and attributes it to a rule family.
// Pure functions + one filesystem walker; no output formatting here.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { parse } from '@vue/compiler-sfc'

import { classifyToken } from '../../eslint/class-allowlist.mjs'

export const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** Directories scanned (spec 6.4.1). src/ds and src/theme are ds-level and out of scope. */
export const DEFAULT_SCOPE = ['src/modules', 'src/shells', 'src/components', 'src/pages']

export const RULES = [
  'type',
  'spacing',
  'surface',
  'colour',
  'layout',
  'ui-prop',
  'class-on-ds',
  'class-literal-in-ts',
]

/** Utilities that stay legal on a page (spec 6.3, decision D-H2). Not counted as debt. */
const HOOK_EXACT = new Set([
  'min-w-0',
  'w-full',
  'h-full',
  'grow',
  'shrink-0',
  'mx-auto',
  'ms-auto',
  'me-auto',
  'hidden',
  'block',
  'sr-only',
  'not-sr-only',
  'truncate',
  'break-words',
  'text-start',
  'text-center',
  'text-end',
  'text-left',
  'text-right',
  'text-wrap',
  'text-nowrap',
  'text-balance',
  'text-ellipsis',
  'aspect-video',
  'aspect-square',
  'object-cover',
  'object-contain',
  'static',
  'invisible',
  'visible',
  'pointer-events-none',
  'pointer-events-auto',
  'cursor-pointer',
  'select-none',
])
const HOOK_RE = [
  /^line-clamp-\d$/,
  /^size-\d+$/,
  /^(overflow|overflow-x|overflow-y)-/,
  /^(w|h|min-w|min-h|max-w|max-h)-/,
]

const TYPE_ROLES =
  'display|title|heading|subheading|body|body-strong|label|caption|meta|overline|kpi|kpi-lg'
const TYPE_RE = new RegExp(
  `^(text-(?:${TYPE_ROLES}|xs|sm|base|lg|xl|[2-9]xl)|font-[\\w-]+|leading-[\\w./-]+|tracking-[\\w-]+|uppercase|lowercase|capitalize|italic|not-italic|underline|no-underline|line-through|tabular|tabular-nums|font-display)$`,
)
const TYPE_ROLE_RE = new RegExp(`^text-(?:${TYPE_ROLES})$`)
const SPACING_RE =
  /^(gap|gap-x|gap-y|space-x|space-y|p|px|py|pt|pr|pb|pl|ps|pe|m|mx|my|mt|mr|mb|ml|ms|me|inset|inset-x|inset-y|top|right|bottom|left|start|end)-.+$/
const SURFACE_RE =
  /^(bg-(?:default|elevated|accented|soft|muted|inverted|seg-active|primary|secondary|success|warning|error|info|neutral)(?:-soft|-strong|-field)?|rounded(?:-[\w]+)?|shadow(?:-[\w-]+)?|bg-gradient-[\w-]+|ring(?:-[\w-]+)?|border(?:-[\w-]+)?|divide(?:-[\w-]+)?|outline(?:-[\w-]+)?)$/
const COLOUR_RE =
  /^(text|bg|fill|stroke|accent|caret|decoration|placeholder)-[a-z][\w-]*$|^opacity-\d+$/
const LAYOUT_RE =
  /^(flex|inline-flex|grid|inline-grid|flex-row|flex-col|flex-wrap|flex-nowrap|flex-row-reverse|flex-col-reverse|flex-1|flex-auto|flex-none|(?:grid-cols|grid-rows|col-span|col-start|row-span|items|justify|justify-items|justify-self|self|place-items|place-content|place-self|content|order|basis|grid-flow)-.+)$/
const MOTION_RE = /^(z|animate|transition|duration|ease|delay)(-|$)|^transition$/

export const FAMILY_ORDER = ['colour', 'surface', 'type', 'spacing', 'layout']

/** Splits `md:hover:bg-x` on `:` outside brackets/parens; returns [variants[], utility]. */
export function splitToken(token) {
  const parts = []
  let depth = 0
  let cur = ''
  for (const ch of token) {
    if (ch === '[' || ch === '(') depth++
    else if (ch === ']' || ch === ')') depth--
    if (ch === ':' && depth === 0) {
      parts.push(cur)
      cur = ''
    } else cur += ch
  }
  parts.push(cur)
  const utility = parts.pop() ?? ''
  return [parts, utility.replace(/^!|!$/g, '')]
}

/**
 * Attributes one class token to a rule family.
 * @returns {{ family: string, code: string } | null} null when the token is allowed / not debt.
 * `code` is a finer label ("palette", "opacity", "stock-size", ...) used by the census.
 */
export function classifyFamily(rawToken) {
  const [, util0] = splitToken(rawToken)
  const util = util0.startsWith('-') ? util0.slice(1) : util0
  if (!util) return null
  if (HOOK_EXACT.has(util) || HOOK_RE.some((re) => re.test(util))) return null
  if (/^i-/.test(util)) return null
  // Reuse the project classifier for the codes it already owns (palette, arbitrary, gradient, ...).
  const c = classifyToken(rawToken, 'page')
  if (c) {
    switch (c.code) {
      case 'arbitrary':
        return { family: 'colour', code: 'arbitrary' }
      case 'palette':
        return { family: 'colour', code: 'palette' }
      case 'gradient':
        return { family: 'surface', code: 'gradient' }
      case 'lines':
        return { family: 'surface', code: 'lines' }
      case 'text-size':
        return { family: 'type', code: 'stock-size' }
      case 'typography':
        return { family: 'type', code: 'typography' }
      case 'spacing':
        return { family: 'spacing', code: 'off-step' }
      case 'radius':
      case 'shadow':
        return { family: 'surface', code: c.code }
      case 'decoration':
        if (/^(font|leading|tracking)(-|$)/.test(util)) return { family: 'type', code: 'weight' }
        if (/^opacity(-|$)/.test(util)) return { family: 'colour', code: 'opacity' }
        return { family: 'surface', code: 'motion' }
      default:
        break // variant / unknown: fall through to the family regexes
    }
  }
  if (/\/\d{1,3}$/.test(util) && COLOUR_RE.test(util.replace(/\/\d{1,3}$/, '')))
    return { family: 'colour', code: 'opacity' }
  if (TYPE_RE.test(util)) {
    if (TYPE_ROLE_RE.test(util)) return { family: 'type', code: 'role' }
    if (/^(font|leading|tracking)-/.test(util)) return { family: 'type', code: 'weight' }
    return { family: 'type', code: 'typography' }
  }
  if (SURFACE_RE.test(util)) {
    const code = util.startsWith('bg-') ? 'bg' : util.split('-')[0]
    return { family: 'surface', code }
  }
  if (MOTION_RE.test(util)) return { family: 'surface', code: 'motion' }
  if (SPACING_RE.test(util)) return { family: 'spacing', code: util.split('-')[0] }
  if (LAYOUT_RE.test(util)) return { family: 'layout', code: 'layout' }
  if (COLOUR_RE.test(util)) return { family: 'colour', code: 'token' }
  return null
}

/** True when the literal reads like a Tailwind class list rather than copy text. */
export function looksLikeClassList(text) {
  const tokens = text.trim().split(/\s+/).filter(Boolean)
  if (tokens.length === 0 || tokens.length > 60) return false
  if (!tokens.every((t) => /^[!a-z0-9:\-/[\]()._%#&=@]+$/.test(t))) return false
  let debt = 0
  let known = 0
  for (const t of tokens) {
    const f = classifyFamily(t)
    if (f) {
      debt++
      known++
    } else if (HOOK_EXACT.has(splitToken(t)[1]) || /^i-ph-/.test(t)) known++
  }
  if (debt === 0) return false
  if (tokens.length === 1) return /-/.test(tokens[0])
  return known / tokens.length >= 0.8
}

/** String literals ('..', "..", `..` split on ${}) found in a code fragment. */
export function stringLiterals(code) {
  const out = []
  const re = /'((?:[^'\\\n]|\\.)*)'|"((?:[^"\\\n]|\\.)*)"|`((?:[^`\\]|\\.)*)`/g
  let m
  while ((m = re.exec(code))) {
    const s = m[1] ?? m[2] ?? m[3] ?? ''
    for (const part of s.split(/\$\{[^}]*\}/))
      if (part.trim()) out.push({ text: part, index: m.index })
  }
  return out
}

const lineOf = (text, index) => text.slice(0, index).split('\n').length

const isDsTag = (tag) => /^Ds[A-Z]/.test(tag) || /^ds-[a-z]/.test(tag)

/**
 * Scans one file's source.
 * @returns {{ hits: Hit[] }} where Hit = { rule, family?, code, token, file, line, tag?, elementId?, dynamic?, ... }
 */
export function scanSource(file, source) {
  const hits = []
  const elements = [] // template elements with class info, for the census
  if (file.endsWith('.vue')) {
    let descriptor
    try {
      descriptor = parse(source, { filename: file }).descriptor
    } catch {
      return { hits, elements }
    }
    const tpl = descriptor.template
    if (tpl?.ast) {
      const walk = (node) => {
        if (node.type === 1) scanElement(node)
        for (const ch of node.children ?? []) if (typeof ch === 'object') walk(ch)
      }
      const scanElement = (node) => {
        const line = node.loc.start.line
        const tag = node.tag
        const ds = isDsTag(tag)
        let staticTokens = []
        let dynamicTokens = []
        let dynamic = false
        for (const p of node.props) {
          if (p.type === 6 && p.name === 'class' && p.value) {
            staticTokens = p.value.content.split(/\s+/).filter(Boolean)
          } else if (p.type === 7 && p.name === 'bind' && p.arg?.content === 'class' && p.exp) {
            dynamic = true
            for (const lit of stringLiterals(p.exp.content))
              dynamicTokens.push(...lit.text.split(/\s+/).filter(Boolean))
          } else if (
            (p.type === 7 && p.name === 'bind' && p.arg?.content === 'ui') ||
            (p.type === 6 && p.name === 'ui')
          ) {
            hits.push({ rule: 'ui-prop', code: 'ui', token: ':ui', file, line, tag })
          }
        }
        const id = `${file}:${line}:${tag}`
        const all = [...staticTokens, ...dynamicTokens]
        const el = { id, file, line, tag, ds, staticTokens, dynamicTokens, dynamic, hits: [] }
        for (const token of all) {
          const f = classifyFamily(token)
          if (!f) continue
          const isDyn = !staticTokens.includes(token)
          if (ds) {
            // Layout hooks were already filtered by classifyFamily (returns null).
            const hit = {
              rule: 'class-on-ds',
              family: f.family,
              code: f.code,
              token,
              file,
              line,
              tag,
            }
            hits.push(hit)
            el.hits.push(hit)
          } else {
            const hit = {
              rule: f.family,
              family: f.family,
              code: f.code,
              token,
              file,
              line,
              tag,
              dynamic: isDyn,
            }
            hits.push(hit)
            el.hits.push(hit)
          }
        }
        if (el.hits.length) elements.push(el)
      }
      for (const ch of tpl.ast.children ?? []) if (typeof ch === 'object') walk(ch)
    }
    for (const block of [descriptor.script, descriptor.scriptSetup]) {
      if (!block) continue
      scanCode(block.content, file, hits, block.loc.start.line - 1)
    }
  } else {
    scanCode(source, file, hits, 0)
  }
  return { hits, elements }
}

function scanCode(code, file, hits, baseLine) {
  for (const lit of stringLiterals(code)) {
    if (!looksLikeClassList(lit.text)) continue
    hits.push({
      rule: 'class-literal-in-ts',
      code: 'literal',
      token: lit.text.trim().slice(0, 80),
      file,
      line: baseLine + lineOf(code, lit.index),
    })
  }
}

/** All scannable files below the scope directories. */
export function listFiles(scope = DEFAULT_SCOPE, root = ROOT) {
  const out = []
  const walk = (dir) => {
    for (const name of readdirSync(dir)) {
      const full = join(dir, name)
      const st = statSync(full)
      if (st.isDirectory()) {
        if (name === '__tests__' || name === 'node_modules') continue
        walk(full)
      } else if (/\.(vue|ts)$/.test(name) && !/\.(test|spec|d)\.ts$/.test(name)) out.push(full)
    }
  }
  for (const s of scope) {
    try {
      walk(join(root, s))
    } catch {
      /* missing scope directory */
    }
  }
  return out.map((f) => relative(root, f).replaceAll('\\', '/')).sort()
}

/** Scans the whole scope. */
export function scanTree({ scope = DEFAULT_SCOPE, root = ROOT } = {}) {
  const files = listFiles(scope, root)
  const hits = []
  const elements = []
  for (const f of files) {
    const r = scanSource(f, readFileSync(join(root, f), 'utf8'))
    hits.push(...r.hits)
    elements.push(...r.elements)
  }
  return { files, hits, elements }
}

/** { rule: { file: count } } with zero entries omitted, keys sorted. */
export function countByRuleFile(hits) {
  const out = Object.fromEntries(RULES.map((r) => [r, {}]))
  for (const h of hits) out[h.rule][h.file] = (out[h.rule][h.file] ?? 0) + 1
  for (const r of RULES)
    out[r] = Object.fromEntries(Object.entries(out[r]).sort(([a], [b]) => (a < b ? -1 : 1)))
  return out
}

export const totalsOf = (byRule) =>
  Object.fromEntries(
    RULES.map((r) => [r, Object.values(byRule[r] ?? {}).reduce((a, b) => a + b, 0)]),
  )
