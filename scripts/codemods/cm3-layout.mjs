// CM-3 flex / grid wrappers -> DsStack / DsCluster / DsGrid (hardening spec 7.5).
// Idempotent; `--dry-run`, `--module mNN`, `--json`. Only elements whose every class maps to a
// primitive prop (or is a page-level hook such as w-full / mx-auto) are converted.
//   flex flex-col gap-4                         -> <DsStack gap="md">
//   flex flex-wrap items-center gap-2           -> <DsCluster gap="xs">
//   flex flex-col gap-3 md:flex-row md:items-center -> <DsCluster stack-below="md" gap="sm">
//   grid grid-cols-1 md:grid-cols-2 gap-4       -> <DsGrid :cols="{ base: 1, md: 2 }" gap="md">
// Not converted (residual): responsive gaps, padding, surface / type / colour utilities, margins,
// positioning, `section` / `article` / `aside` / `main` as a Cluster or Grid, DsSplit pairs.
import { pathToFileURL } from 'node:url'

import { elementFacts, GAP, isHook, runElementCodemod } from './elem-lib.mjs'

const STACK_AS = new Set([
  'div',
  'section',
  'article',
  'header',
  'footer',
  'main',
  'aside',
  'nav',
  'form',
  'ul',
  'ol',
  'fieldset',
])
const CLUSTER_AS = new Set([
  'div',
  'span',
  'ul',
  'ol',
  'nav',
  'header',
  'footer',
  'form',
  'fieldset',
])
const GRID_AS = new Set(['div', 'ul', 'ol', 'section'])
const ALIGN = {
  start: 'start',
  center: 'center',
  end: 'end',
  baseline: 'baseline',
  stretch: 'stretch',
}
const JUSTIFY = { start: 'start', center: 'center', end: 'end', between: 'between' }
const COLS_OK = new Set([1, 2, 3, 4, 5, 6, 12])
const BPS = ['sm', 'md', 'lg', 'xl']

const gapOf = (n) => GAP[n]

export function plan(el, { source }) {
  if (!/^(div|ul|ol|section|header|footer|nav|form|article|aside|main|fieldset|span)$/.test(el.tag))
    return null
  const clsRaw = el.props.find((p) => p.type === 6 && p.name === 'class')?.value?.content
  if (!clsRaw || !/(^|\s)(flex|grid|space-y-\S+)(\s|$)/.test(clsRaw)) return null
  const facts = elementFacts(el, source)
  if (facts.reason) return { skip: facts.reason }

  let flex = false
  let grid = false
  let col = false
  let rowDir = false
  let wrap = null
  let align = null
  let justify = null
  let gap = null
  let gapX = null
  let gapY = null
  let spaceY = null
  const cols = {}
  let bpRow = null
  let bpAlign = null
  const rest = []
  const bad = (reason) => ({ skip: reason })

  for (const t of facts.tokens) {
    const u = t.util
    if (!t.plain) {
      const bp = t.variants.length === 1 && BPS.includes(t.variants[0]) ? t.variants[0] : null
      if (bp && /^grid-cols-\d+$/.test(u)) {
        const n = Number(u.slice(10))
        if (!COLS_OK.has(n)) return bad('grid columns outside 1-6, 12')
        cols[bp] = n
      } else if (bp && u === 'flex-row') bpRow = bp
      else if (bp && /^items-(start|center|end|baseline|stretch)$/.test(u))
        bpAlign = [bp, ALIGN[u.slice(6)]]
      else if (isHook(t)) rest.push(t.raw)
      else return bad('responsive / state variant on a layout utility')
      continue
    }
    if (u === 'flex') flex = true
    else if (u === 'grid') grid = true
    else if (u === 'flex-col') col = true
    else if (u === 'flex-row') rowDir = true
    else if (u === 'flex-wrap') wrap = true
    else if (u === 'flex-nowrap') wrap = false
    else if (/^items-(start|center|end|baseline|stretch)$/.test(u)) align = ALIGN[u.slice(6)]
    else if (/^justify-(start|center|end|between)$/.test(u)) justify = JUSTIFY[u.slice(8)]
    else if (/^grid-cols-\d+$/.test(u)) {
      const n = Number(u.slice(10))
      if (!COLS_OK.has(n)) return bad('grid columns outside 1-6, 12')
      cols.base = n
    } else if (/^gap-\d+$/.test(u)) {
      gap = gapOf(Number(u.slice(4)))
      if (!gap) return bad('gap step without a DsSpace token')
    } else if (/^gap-x-\d+$/.test(u)) {
      gapX = gapOf(Number(u.slice(6)))
      if (!gapX) return bad('gap step without a DsSpace token')
    } else if (/^gap-y-\d+$/.test(u)) {
      gapY = gapOf(Number(u.slice(6)))
      if (!gapY) return bad('gap step without a DsSpace token')
    } else if (/^space-y-\d+$/.test(u)) {
      spaceY = gapOf(Number(u.slice(8)))
      if (!spaceY) return bad('space-y step without a DsSpace token')
    } else if (u === 'min-w-0') continue
    else if (isHook(t)) rest.push(t.raw)
    else return bad('other utilities (spacing / surface / type / colour / position)')
  }

  if (gap && spaceY && gap !== spaceY) return bad('gap and space-y differ')
  const gapTok = gap ?? spaceY
  if (flex && grid) return bad('flex and grid')
  if (!flex && !grid) {
    if (!spaceY || gap || gapX || gapY || col || rowDir || align || justify || wrap !== null)
      return bad('space-y mixed with other layout')
  }

  // DsGrid
  if (grid) {
    if (!GRID_AS.has(el.tag)) return bad('tag not supported by DsGrid')
    if (col || rowDir || wrap !== null || justify || bpRow || bpAlign || gapX || gapY || spaceY)
      return bad('grid mixed with flex / axis gaps')
    if (!Object.keys(cols).length) return bad('grid without grid-cols')
    if (align && align !== 'start' && align !== 'center' && align !== 'end' && align !== 'stretch')
      return bad('grid align')
    const props = []
    const keys = ['base', ...BPS].filter((k) => cols[k] !== undefined)
    if (keys.length === 1 && keys[0] === 'base') props.push(`:cols="${cols.base}"`)
    else props.push(`:cols="{ ${keys.map((k) => `${k}: ${cols[k]}`).join(', ')} }"`)
    const g = gapTok ?? 'none'
    if (g !== 'md') props.push(`gap="${g}"`)
    if (el.tag !== 'div') props.push(`as="${el.tag}"`)
    // the primitive aligns `stretch` by default, like an unset grid
    if (align && align !== 'stretch') props.push(`align="${align}"`)
    return { facts, tag: 'DsGrid', props, rest }
  }

  // DsStack: flex-col or space-y without flex
  const isStack = (flex && col && !bpRow && !bpAlign) || (!flex && spaceY)
  if (isStack) {
    if (!STACK_AS.has(el.tag)) return bad('tag not supported by DsStack')
    if (wrap || rowDir || gapX || gapY || align === 'baseline')
      return bad('stack with wrap / row / axis gaps')
    if (cols.base !== undefined || Object.keys(cols).length) return bad('stack with grid-cols')
    const props = []
    if (el.tag !== 'div') props.push(`as="${el.tag}"`)
    const g = gapTok ?? 'none'
    if (g !== 'md') props.push(`gap="${g}"`)
    if (align && align !== 'stretch') props.push(`align="${align}"`)
    if (justify) props.push(`justify="${justify}"`)
    return { facts, tag: 'DsStack', props, rest }
  }

  // DsCluster
  if (!flex) return bad('unsupported layout')
  if (!CLUSTER_AS.has(el.tag)) return bad('tag not supported by DsCluster')
  if (cols.base !== undefined || Object.keys(cols).length) return bad('flex with grid-cols')
  if (spaceY) return bad('flex row with space-y')
  const props = []
  if (el.tag !== 'div') props.push(`as="${el.tag}"`)
  const gx = gapX ?? gapTok ?? 'none'
  const gy = gapY ?? gapTok ?? 'none'
  if (gx !== 'sm') props.push(`gap="${gx}"`)
  if (gy !== gx) props.push(`row-gap="${gy}"`)
  if (bpRow || (col && !bpRow)) {
    if (!col || !bpRow) return bad('flex-col without a matching breakpoint row')
    if (align) return bad('items-* beside a responsive direction')
    if (justify || wrap !== null) return bad('responsive direction with justify / wrap')
    const a = bpAlign ? (bpAlign[0] === bpRow ? bpAlign[1] : null) : 'stretch'
    if (a === null) return bad('breakpoint of items-* differs from flex-row')
    props.push(`stack-below="${bpRow}"`)
    if (a !== 'center') props.push(`align="${a}"`)
    return { facts, tag: 'DsCluster', props, rest }
  }
  if (bpAlign) return bad('breakpoint items-* without flex-row')
  const a = align ?? 'stretch'
  if (a !== 'center') props.push(`align="${a}"`)
  if (justify) props.push(`justify="${justify}"`)
  if (wrap !== true) props.push(':wrap="false"')
  return { facts, tag: 'DsCluster', props, rest }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runElementCodemod('CM-3 layout', 'cm3', plan)
}
