// CM-4 surface wrappers and page roots (hardening spec 7.5). Idempotent; `--dry-run`, `--module mNN`.
//   a) a page root `mx-auto flex flex-col max-w-* gap-*` (or `space-y-*`) -> <DsPage layout="..">,
//      layout from eslint/page-archetypes.json; `width` is added only when it differs from the
//      archetype's width, `gap` only when it is not the section rhythm.
//   b) a `div` that is only a card surface (`bg-* rounded-* shadow-* p-N`) -> <DsSurface level radius
//      shadow padding>; radius / shadow / clip are always explicit so the look is unchanged.
import { readFileSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { elementFacts, GAP, isHook, runElementCodemod } from './elem-lib.mjs'

const ARCH = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../eslint/page-archetypes.json', import.meta.url)),
    'utf8',
  ),
).pages
const ARCH_WIDTH = {
  list: 'wide',
  form: 'prose',
  report: 'full',
  dashboard: 'wide',
  detail: 'default',
  learner: 'default',
}
const MAXW = { '3xl': 'prose', '6xl': 'default', '7xl': 'wide', none: 'full' }

const SURFACE_TAG = new Set([
  'div',
  'section',
  'article',
  'aside',
  'li',
  'form',
  'nav',
  'header',
  'footer',
  'ul',
  'ol',
])
const LEVEL = {
  'bg-default': 'raised',
  'bg-elevated': 'elevated',
  'bg-soft': 'soft',
  'bg-accented': 'accented',
}
const RADIUS = {
  'rounded-card': 'card',
  'rounded-chip': 'chip',
  'rounded-sheet': 'sheet',
  'rounded-none': 'none',
}
const SHADOW = {
  'shadow-ds-xs': 'raised',
  'shadow-card': 'card',
  'shadow-lift': 'lift',
  'shadow-modal': 'modal',
}
const PAD = { 0: 'none', 3: 'sm', 4: 'md', 5: 'lg', 6: 'lg' }
const AUTO_SHADOW = { raised: 'raised', elevated: 'none', soft: 'none', accented: 'none' }

function pageRoot(el, ctx) {
  if (ctx.ancestors.length !== 0 || !/\/pages\/[^/]+Page\.vue$/.test(ctx.file)) return undefined
  const top = (ctx.d.template.ast.children ?? []).filter((c) => c.type === 1)
  if (top.length !== 1 || top[0] !== el || el.tag !== 'div') return undefined
  const facts = elementFacts(el, ctx.source)
  if (facts.reason)
    return /max-w-/.test(el.props.find((p) => p.name === 'class')?.value?.content ?? '')
      ? { skip: facts.reason }
      : undefined
  if (!facts.tokens.some((t) => t.plain && /^max-w-/.test(t.util))) return undefined
  let flex = false
  let col = false
  let gap = null
  let gapMd = null
  let spaceY = null
  let width = null
  const rest = []
  const bad = (reason) => ({ skip: `page root: ${reason}` })
  for (const t of facts.tokens) {
    const u = t.util
    if (!t.plain) {
      if (t.variants.length === 1 && t.variants[0] === 'md' && /^gap-\d+$/.test(u))
        gapMd = Number(u.slice(4))
      else if (isHook(t)) rest.push(t.raw)
      else return bad('variant-prefixed utility')
      continue
    }
    if (u === 'flex') flex = true
    else if (u === 'flex-col') col = true
    else if (u === 'mx-auto' || u === 'w-full' || u === 'min-w-0') continue
    else if (/^max-w-/.test(u)) {
      width = MAXW[u.slice(6)]
      if (!width) return bad(`max-w-${u.slice(6)} has no DsPage width`)
    } else if (/^gap-\d+$/.test(u)) gap = Number(u.slice(4))
    else if (/^space-y-\d+$/.test(u)) spaceY = Number(u.slice(8))
    else if (isHook(t)) rest.push(t.raw)
    else return bad('padding / other utilities on the root')
  }
  if (flex !== col && flex) return bad('flex without flex-col')
  const g = gap ?? spaceY
  if (gap !== null && spaceY !== null) return bad('gap and space-y')
  if (gapMd !== null && !(g === 5 && gapMd === 6))
    return bad('responsive gap is not the section rhythm')
  const props = []
  const layout = ARCH[ctx.file]?.layout ?? 'detail'
  props.push(`layout="${layout}"`)
  if (width !== ARCH_WIDTH[layout]) props.push(`width="${width}"`)
  if (!(g === 5 && gapMd === 6)) {
    if (g === null) props.push('gap="none"')
    else if (GAP[g]) props.push(`gap="${GAP[g]}"`)
    else return bad(`gap-${g} has no DsSpace token`)
  }
  return { facts, tag: 'DsPage', props, rest }
}

function surface(el, ctx) {
  if (!SURFACE_TAG.has(el.tag)) return undefined
  const cls = el.props.find((p) => p.type === 6 && p.name === 'class')?.value?.content
  if (!cls || !/(^|\s)bg-(default|elevated|soft|accented)(\s|$)/.test(cls)) return undefined
  const facts = elementFacts(el, ctx.source)
  if (facts.reason) return { skip: facts.reason }
  let level = null
  let radius = null
  let shadow = null
  let pad = null
  let clip = false
  const rest = []
  for (const t of facts.tokens) {
    const u = t.util
    if (!t.plain) {
      if (isHook(t)) rest.push(t.raw)
      else return { skip: 'surface: variant-prefixed utility' }
      continue
    }
    if (LEVEL[u]) level = LEVEL[u]
    else if (RADIUS[u]) radius = RADIUS[u]
    else if (SHADOW[u]) shadow = SHADOW[u]
    else if (/^p-\d+$/.test(u)) {
      pad = PAD[Number(u.slice(2))]
      if (!pad) return { skip: 'surface: padding step without a DsPadding token' }
    } else if (u === 'overflow-hidden' || u === 'overflow-clip') clip = true
    else if (u === 'min-w-0') continue
    else if (isHook(t)) rest.push(t.raw)
    else return { skip: 'surface: other utilities (border / layout / spacing / type / colour)' }
  }
  if (!level) return { skip: 'surface: no level' }
  const props = []
  if (el.tag !== 'div') props.push(`as="${el.tag}"`)
  if (level !== 'raised') props.push(`level="${level}"`)
  props.push(`radius="${radius ?? 'none'}"`)
  const sh = shadow ?? 'none'
  if (sh !== AUTO_SHADOW[level]) props.push(`shadow="${sh}"`)
  const p = pad ?? 'none'
  if (p !== 'md') props.push(`padding="${p}"`)
  if (!clip) props.push(':clip="false"')
  return { facts, tag: 'DsSurface', props, rest }
}

export function plan(el, ctx) {
  const root = pageRoot(el, ctx)
  if (root !== undefined) return root
  return surface(el, ctx)
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runElementCodemod('CM-4 surface and page', 'cm4', plan)
}
