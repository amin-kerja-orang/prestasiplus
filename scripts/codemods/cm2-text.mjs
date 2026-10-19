// CM-2 text elements -> DsText / DsHeading (hardening spec 7.5). Idempotent; `--dry-run`,
// `--module mNN`, `--json`. Only elements whose every class is a type role, a text tone or a
// truncate / clamp / align / wrap hook are converted; anything else is reported as residual.
//   <p class="text-caption text-muted">   -> <DsText variant="caption" tone="muted">
//   <h2 class="text-heading">             -> <DsHeading :level="2">
import { pathToFileURL } from 'node:url'

import { elementFacts, isHook, runElementCodemod } from './elem-lib.mjs'

const TEXT_AS = new Set([
  'p',
  'span',
  'div',
  'label',
  'legend',
  'dt',
  'dd',
  'li',
  'strong',
  'em',
  'small',
  'time',
  'figcaption',
])
const DEFAULT_TAG = {
  display: 'p',
  title: 'p',
  heading: 'p',
  subheading: 'p',
  body: 'p',
  'body-strong': 'p',
  label: 'span',
  caption: 'p',
  meta: 'span',
  overline: 'span',
  kpi: 'span',
  'kpi-lg': 'span',
}
const DEFAULT_TONE = {
  display: 'highlighted',
  title: 'highlighted',
  heading: 'highlighted',
  subheading: 'highlighted',
  body: 'default',
  'body-strong': 'highlighted',
  label: 'default',
  caption: 'muted',
  meta: 'dimmed',
  overline: 'muted',
  kpi: 'highlighted',
}
const ROLE = /^text-(display|title|heading|subheading|body|label|caption|overline|kpi)$/
const TONE_CLASS = {
  'text-highlighted': 'highlighted',
  'text-default': 'default',
  'text-toned': 'toned',
  'text-muted': 'muted',
  'text-dimmed': 'dimmed',
  'text-inverted': 'inverted',
  'text-primary-t': 'primary',
  'text-success': 'success',
  'text-warning': 'warning',
  'text-error': 'error',
  'text-info': 'info',
  'text-on-sem': 'on-sem',
}
const HEADING_TONES = new Set(['highlighted', 'muted', 'primary', 'inverted'])
const HEADING_VARIANTS = new Set(['display', 'title', 'heading', 'subheading', 'label', 'overline'])
const LEVEL_VARIANT = {
  1: 'title',
  2: 'heading',
  3: 'subheading',
  4: 'label',
  5: 'label',
  6: 'label',
}
const ALIGN = { 'text-center': 'center', 'text-start': 'start', 'text-end': 'end' }
/** An ancestor with these classes sets a colour that unset-tone text inherits. */
const COLOURED_PARENT =
  /\b(text-(?:inverted|white|on-sem)|bg-(?:primary|inverted|success|warning|error|info)|bg-gradient|from-)/

export function plan(el, { source, ancestors }) {
  const isHeading = /^h[1-6]$/.test(el.tag)
  if (!isHeading && !TEXT_AS.has(el.tag)) return null
  const facts = elementFacts(el, source)
  if (facts.reason) {
    // only count elements that look like text: static role class present
    const cls = el.props.find((p) => p.type === 6 && p.name === 'class')?.value?.content ?? ''
    return /\btext-(display|title|heading|subheading|body|label|caption|overline|kpi)\b/.test(cls)
      ? { skip: facts.reason }
      : null
  }
  const toks = facts.tokens
  const roleTok = toks.filter((t) => t.plain && ROLE.test(t.util))
  if (!roleTok.length && !isHeading) return null
  if (roleTok.length > 1) return { skip: 'two type roles' }
  if (isHeading && !roleTok.length) return { skip: 'heading without a type role class' }
  let role = roleTok[0] ? ROLE.exec(roleTok[0].util)[1] : null
  let tone = null
  let align = null
  let clamp = null
  let truncate = false
  let wrap = null
  let tabular = false
  let srOnly = false
  let minW0 = false
  const rest = []
  const weight = []
  for (const t of toks) {
    if (t.raw === roleTok[0]?.raw) continue
    if (!t.plain) {
      if (isHook(t)) rest.push(t.raw)
      else return { skip: 'variant-prefixed utility (responsive / state)' }
      continue
    }
    const u = t.util
    if (TONE_CLASS[u]) {
      if (tone) return { skip: 'two text tones' }
      tone = TONE_CLASS[u]
    } else if (ALIGN[u]) align = ALIGN[u]
    else if (u === 'truncate') truncate = true
    else if (/^line-clamp-[1-6]$/.test(u)) clamp = Number(u.slice(-1))
    else if (u === 'break-words') wrap = 'anywhere'
    else if (u === 'text-balance') wrap = 'balance'
    else if (u === 'tabular-nums' || u === 'tabular') tabular = true
    else if (u === 'sr-only') srOnly = true
    else if (u === 'min-w-0') minW0 = true
    else if (u === 'uppercase' && role === 'overline') continue
    else if (u === 'font-semibold' && role === 'body') weight.push(u)
    else if (isHook(t)) rest.push(t.raw)
    else return { skip: 'other utilities (layout / spacing / colour / weight)' }
  }
  if (minW0 && !truncate && clamp === null) rest.push('min-w-0')
  if (weight.length) {
    if (isHeading) return { skip: 'other utilities (layout / spacing / colour / weight)' }
    role = 'body-strong'
  }
  if (truncate && clamp !== null) return { skip: 'truncate with clamp' }
  if (!tone) {
    // Without a tone class the primitive applies the variant's own colour: only equal to the old
    // look when the variant colour is the page default and no coloured ancestor is involved.
    const coloured = ancestors.some((a) => {
      const c = a.props.find((p) => p.type === 6 && p.name === 'class')?.value?.content ?? ''
      return COLOURED_PARENT.test(c)
    })
    if (coloured) return { skip: 'no tone class under a coloured parent' }
    // a component ancestor (banner, card, hero ...) may colour its slot: the inherited colour is unknown
    const custom = ancestors.some(
      (a) =>
        (/^[A-Z]/.test(a.tag) && !/^Ds(Stack|Cluster|Grid|Page|Text|Heading)$/.test(a.tag)) ||
        a.tag.includes('-'),
    )
    if (custom) return { skip: 'no tone class under a component (inherited colour unknown)' }
    if (
      !isHeading &&
      ![
        'body',
        'label',
        'body-strong',
        'display',
        'title',
        'heading',
        'subheading',
        'kpi',
      ].includes(role)
    )
      return { skip: 'no tone class (variant default tone would change the colour)' }
  }

  const props = []
  if (isHeading) {
    const level = Number(el.tag[1])
    if (!HEADING_VARIANTS.has(role)) return { skip: 'role has no DsHeading variant' }
    if (tone && !HEADING_TONES.has(tone)) return { skip: 'tone not available on DsHeading' }
    if (truncate && clamp !== null) return { skip: 'truncate with clamp' }
    if (clamp !== null && clamp > 3) return { skip: 'clamp > 3 on a heading' }
    if (tabular || srOnly) return { skip: 'heading with tabular / sr-only' }
    props.push(`:level="${level}"`)
    if (role !== LEVEL_VARIANT[level]) props.push(`variant="${role}"`)
    if (tone && tone !== 'highlighted') props.push(`tone="${tone}"`)
    if (align) props.push(`align="${align}"`)
    if (truncate) props.push('truncate')
    if (clamp !== null) props.push(`:clamp="${clamp}"`)
    if (wrap) props.push(`wrap="${wrap}"`)
    return { facts, tag: 'DsHeading', props, rest }
  }
  if (!TEXT_AS.has(el.tag)) return null
  props.push(`variant="${role}"`)
  if (el.tag !== DEFAULT_TAG[role]) props.push(`as="${el.tag}"`)
  if (tone && tone !== DEFAULT_TONE[role]) props.push(`tone="${tone}"`)
  if (align) props.push(`align="${align}"`)
  if (truncate) props.push('truncate')
  if (clamp !== null) props.push(`:clamp="${clamp}"`)
  if (wrap) props.push(`wrap="${wrap}"`)
  if (tabular) props.push('tabular')
  if (srOnly) props.push('sr-only')
  return { facts, tag: 'DsText', props, rest }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runElementCodemod('CM-2 text', 'cm2', plan)
}
