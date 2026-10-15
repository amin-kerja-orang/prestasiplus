// Class allowlist for strict files (design system v2.0 guard rules G-1, G-2, G-3, G-3b).
// Two levels (V2-T04 review):
//   page - pages and modules: layout utilities + curated token utilities only (G-1..G-3b).
//   ds   - composites in src/ds: also radius, shadow, transition, animate, font, z, opacity,
//          token gradients and every token colour. Still no lines (G-3b), no palette colours,
//          no arbitrary values.
// Token names are generated from src/theme/tokens.css (eslint/tokens.mjs).
import { utilitySets } from './tokens.mjs'

const BREAKPOINTS = ['sm', 'md', 'lg', 'xl', '2xl']

const STATIC_VARIANTS = new Set([
  ...BREAKPOINTS,
  ...BREAKPOINTS.map((b) => `max-${b}`),
  'pointer-coarse',
  'pointer-fine',
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'disabled',
  'checked',
  'open',
  'first',
  'last',
  'odd',
  'even',
  'empty',
  'placeholder',
  'dark',
  'learner',
  'staff',
  'motion-safe',
  'motion-reduce',
  'print',
  'rtl',
  'ltr',
])

const STATE_WORDS =
  'selected|checked|unchecked|disabled|expanded|pressed|current|invalid|busy|hidden|open|closed|active|inactive|highlighted|on|off|visible|indeterminate'
const VARIANT_RES = [
  new RegExp(`^(?:aria|data)-(?:${STATE_WORDS})$`),
  new RegExp(`^data-\\[state=(?:${STATE_WORDS})\\]$`),
  /^group-(?:hover|focus|focus-within|focus-visible|active)(?:\/[\w-]+)?$/,
  /^@(?:max-)?(?:xs|sm|md|lg|xl|2xl|3xl|4xl)$/,
]

function variantOk(v) {
  if (STATIC_VARIANTS.has(v)) return true
  if (v.startsWith('not-')) return variantOk(v.slice(4))
  return VARIANT_RES.some((re) => re.test(v))
}

/** Splits `md:hover:bg-x` on `:` outside brackets/parens. */
function splitVariants(token) {
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
  return parts
}

/** G-2: spacing steps (pages). */
const SPACING_STEPS = new Set(['0', '1', '2', '3', '4', '6', '8', '12', '16'])
const SPACING_WORDS = new Set([
  'px',
  'auto',
  'full',
  'screen',
  'dvh',
  'svh',
  'lvh',
  'min',
  'max',
  'fit',
])
const pageSpacingOk = (v) => SPACING_STEPS.has(v) || SPACING_WORDS.has(v) || /^\d+\/\d+$/.test(v)
/** ds level: any numeric spacing step incl. halves. */
const dsSpacingOk = (v) => /^\d+(?:\.5)?$/.test(v) || SPACING_WORDS.has(v) || /^\d+\/\d+$/.test(v)

const LAYOUT_PREFIXED = [
  'grid-cols',
  'grid-rows',
  'col-span',
  'col-start',
  'col-end',
  'row-span',
  'row-start',
  'row-end',
  'auto-cols',
  'auto-rows',
  'grid-flow',
  'basis',
  'items',
  'justify',
  'justify-items',
  'justify-self',
  'self',
  'place-items',
  'place-content',
  'place-self',
  'content',
  'order',
  'w',
  'h',
  'min-w',
  'min-h',
  'max-w',
  'max-h',
  'size',
  'overflow',
  'overflow-x',
  'overflow-y',
  'aspect',
  'flex',
  'line-clamp',
  'whitespace',
  'break',
  'object',
]
const SPACING_PREFIXED = [
  'gap',
  'gap-x',
  'gap-y',
  'space-x',
  'space-y',
  'p',
  'px',
  'py',
  'pt',
  'pr',
  'pb',
  'pl',
  'ps',
  'pe',
  'm',
  'mx',
  'my',
  'mt',
  'mr',
  'mb',
  'ml',
  'ms',
  'me',
  'inset',
  'inset-x',
  'inset-y',
  'top',
  'right',
  'bottom',
  'left',
  'start',
  'end',
]
const LAYOUT_EXACT = new Set([
  'flex',
  'inline-flex',
  'grid',
  'inline-grid',
  'block',
  'inline-block',
  'inline',
  'hidden',
  'contents',
  'flow-root',
  'flex-row',
  'flex-col',
  'flex-row-reverse',
  'flex-col-reverse',
  'flex-wrap',
  'flex-nowrap',
  'flex-wrap-reverse',
  'grow',
  'grow-0',
  'shrink',
  'shrink-0',
  'relative',
  'absolute',
  'fixed',
  'sticky',
  'static',
  'text-start',
  'text-center',
  'text-end',
  'text-left',
  'text-right',
  'sr-only',
  'not-sr-only',
  'container',
  'break-words',
  'text-wrap',
  'text-nowrap',
  'text-balance',
  // Behaviour / layout-adjacent, accepted by the Delivery Lead (V2-T04 review).
  'invisible',
  'visible',
  'pointer-events-none',
  'pointer-events-auto',
  'cursor-pointer',
  'select-none',
  'object-cover',
  'object-contain',
  'truncate',
  'text-ellipsis',
])

const byLength = (a, b) => b.length - a.length
const spacingRe = new RegExp(`^(${[...SPACING_PREFIXED].sort(byLength).join('|')})-(.+)$`)
const layoutRe = new RegExp(`^(${[...LAYOUT_PREFIXED].sort(byLength).join('|')})-(.+)$`)

const LINES = [/^(border|divide)(-|$)/, /^(outline|ring)(-|$)/]
const LINES_MSG =
  'Border/divide/outline/ring utilities are forbidden (G-3b: no lines; separate with spacing and tone; focus rings live in the theme config).'

/** Visual decisions: banned in pages, allowed in composites (ds). */
const PAGE_ONLY_BANNED = [
  [/^shadow(-|$)/, 'shadow', 'Shadows are decided by components, not pages (G-3).'],
  [/^rounded(-|$)/, 'radius', 'Radius is decided by components, not pages (G-3).'],
  [
    /^(bg-gradient|bg-linear|bg-radial|bg-conic)(-|$)/,
    'gradient',
    'Gradients live inside component variants (G-3).',
  ],
  [/^(from|via|to)-/, 'gradient', 'Gradient stops live inside component variants (G-3).'],
  [
    /^(z|animate|transition|duration|ease|delay|opacity|font|leading|tracking)(-|$)|^transition$/,
    'decoration',
    'z/animate/transition/duration/ease/font/opacity are decided by the theme (G-3).',
  ],
  [
    /^(uppercase|lowercase|capitalize|underline|no-underline|line-through|italic)$/,
    'typography',
    'Typography comes from the type scale and components (G-3).',
  ],
]
/** Banned at every level. */
const ALWAYS_BANNED = [
  [
    /^text-(xs|sm|base|lg|xl|[2-9]xl)$/,
    'text-size',
    'Stock text sizes are banned; use the type scale text-display..text-overline (G-3).',
  ],
  [
    /^(from|via|to)-/,
    'gradient',
    'Raw gradient stops are forbidden; use a token gradient (bg-gradient-primary) (G-3).',
  ],
  [
    /^(bg-gradient|bg-linear|bg-radial|bg-conic)(-|$)/,
    'gradient',
    'Raw gradients are forbidden; use a token gradient (bg-gradient-primary) (G-3).',
  ],
]
/** ds level allows these families outright. */
const DS_ALLOWED =
  /^(shadow|rounded|z|animate|transition|duration|ease|delay|opacity|font|leading|tracking)(-|$)|^transition$|^(uppercase|lowercase|capitalize|underline|no-underline|line-through|italic)$/

const PALETTE_RE =
  /^(bg|text|fill|stroke|accent|caret|decoration|placeholder|from|via|to)-(slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|kobalt|ink|limau|delima|laut|mentari|ungu|daun|black|white|transparent|current)(-\d{2,3})?(\/\d+)?$/
const PALETTE_STEP_RE = /-\d{2,3}(\/\d+)?$/

/**
 * @param {string} rawToken one whitespace-free class token
 * @param {'page' | 'ds'} [level]
 * @returns {{ code: string, message: string } | null} null when allowed
 */
export function classifyToken(rawToken, level = 'page') {
  if (!rawToken) return null
  const isDs = level === 'ds'
  const parts = splitVariants(rawToken)
  let utility = parts.pop() ?? ''
  if (/[[\]()]/.test(utility))
    return { code: 'arbitrary', message: 'Arbitrary values `[...]`/`(--x)` are forbidden (G-3).' }
  for (const v of parts) {
    if (/[[\]()]/.test(v) && !VARIANT_RES.some((re) => re.test(v)) && !v.startsWith('not-'))
      return { code: 'arbitrary', message: 'Arbitrary variants `[...]` are forbidden (G-3).' }
    if (!variantOk(v))
      return { code: 'variant', message: `Variant "${v}:" is not in the allowlist (G-1).` }
  }
  utility = utility.replace(/^!/, '').replace(/!$/, '')
  const negative = utility.startsWith('-')
  if (negative) utility = utility.slice(1)

  const sets = utilitySets()
  const colorUtils = isDs ? sets.dsColorUtils : sets.pageColorUtils

  // Icon classes (Phosphor collection via Nuxt UI icons plugin, D38).
  if (/^i-ph-[a-z0-9-]+$/.test(utility)) return null
  if (/^i-/.test(utility))
    return {
      code: 'icon',
      message: 'Icons must come from the Phosphor collection: use `i-ph-*` (D38).',
    }

  // Colour tokens, with an optional opacity modifier (`bg-primary/10`).
  const mod = /^(.+)\/(\d{1,3})$/.exec(utility)
  if (mod && !negative && colorUtils.has(mod[1])) return null
  if (colorUtils.has(utility) && !negative) return null

  if (
    PALETTE_RE.test(utility) ||
    (PALETTE_STEP_RE.test(utility) && /^(bg|text|fill|stroke)-/.test(utility))
  )
    return {
      code: 'palette',
      message: `Palette colour "${utility}" is forbidden; use token utilities (text-muted, bg-elevated, ...) (G-3).`,
    }
  if (/^(bg|text|fill|stroke)-#|^(bg|text)-(rgb|hsl|oklch)/.test(utility))
    return { code: 'palette', message: 'Colour literals are forbidden (G-3).' }

  if (!negative && (isDs ? sets.ds : sets.page).has(utility)) return null
  if (LAYOUT_EXACT.has(utility)) return null

  for (const re of LINES) if (re.test(utility)) return { code: 'lines', message: LINES_MSG }

  if (isDs) {
    // Token gradients, shadows, radii: any name is accepted (stock names too), gradients only via tokens.
    if (sets.gradient.has(utility)) return null
    for (const [re, code, message] of ALWAYS_BANNED) if (re.test(utility)) return { code, message }
    if (DS_ALLOWED.test(utility)) return null
  } else {
    if (sets.gradient.has(utility))
      return { code: 'gradient', message: 'Gradients live inside component variants (G-3).' }
    for (const [re, code, message] of ALWAYS_BANNED) if (re.test(utility)) return { code, message }
    for (const [re, code, message] of PAGE_ONLY_BANNED)
      if (re.test(utility)) return { code, message }
  }

  const sp = spacingRe.exec(utility)
  if (sp) {
    const ok = isDs ? dsSpacingOk(sp[2]) : pageSpacingOk(sp[2])
    return ok
      ? null
      : {
          code: 'spacing',
          message: `Spacing "${utility}" is not a design step; use 0, 1, 2, 3, 4, 6, 8, 12 or 16 (G-2).`,
        }
  }
  if (layoutRe.test(utility)) return null

  return {
    code: 'unknown',
    message: `Class "${rawToken}" is not in the design-system allowlist (G-1).`,
  }
}

/** Splits a static class string into tokens. */
export const splitClasses = (s) => s.split(/\s+/).filter(Boolean)
