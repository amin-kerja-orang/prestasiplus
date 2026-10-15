// Class allowlist for strict files (design system v2.0, guard rules G-1, G-2, G-3, G-3b).
// Pure functions; the ESLint rule (rules/ds-class-allowlist.mjs) and its tests use them.

/** Responsive and state variants a page may use. */
const VARIANTS = new Set([
  'sm',
  'md',
  'lg',
  'xl',
  '2xl',
  'max-sm',
  'max-md',
  'max-lg',
  'max-xl',
  'pointer-coarse',
  'pointer-fine',
  'hover',
  'focus',
  'focus-visible',
  'focus-within',
  'active',
  'disabled',
  'first',
  'last',
  'odd',
  'even',
  'dark',
  'motion-safe',
  'motion-reduce',
  'print',
  'rtl',
  'ltr',
  'group-hover',
  'group-focus-within',
])

/** G-2: spacing steps. */
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
const isSpacingValue = (v) => SPACING_STEPS.has(v) || SPACING_WORDS.has(v) || /^\d+\/\d+$/.test(v)

/** Token (semantic) utilities defined by the theme (G-1). */
const TOKEN_TEXT = [
  'default',
  'toned',
  'muted',
  'dimmed',
  'highlighted',
  'inverted',
  'primary',
  'success',
  'info',
  'warning',
  'error',
]
const TOKEN_BG = ['default', 'muted', 'elevated', 'soft']
const TYPE_SCALE = [
  'display',
  'title',
  'heading',
  'subheading',
  'body',
  'label',
  'caption',
  'overline',
]
const TOKEN_EXACT = new Set([
  ...TOKEN_TEXT.map((n) => `text-${n}`),
  ...TOKEN_BG.map((n) => `bg-${n}`),
  ...TYPE_SCALE.map((n) => `text-${n}`),
  'tabular',
])

/** Layout utilities taking a free (non-spacing) value. */
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
]
/** Layout utilities whose value is a spacing step (G-2). */
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
  'truncate',
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
])

const spacingRe = new RegExp(
  `^(${[...SPACING_PREFIXED].sort((a, b) => b.length - a.length).join('|')})-(.+)$`,
)
const layoutRe = new RegExp(
  `^(${[...LAYOUT_PREFIXED].sort((a, b) => b.length - a.length).join('|')})-(.+)$`,
)

/** Banned families with a specific message (checked before the generic fallback). */
const BANNED = [
  [
    /^(border|divide)(-|$)/,
    'lines',
    'Border/divide utilities are forbidden (G-3b: no lines; separate with spacing and tone).',
  ],
  [
    /^(outline|ring)(-|$)/,
    'lines',
    'Outline/ring utilities are forbidden (G-3b); focus rings live in the theme config.',
  ],
  [/^shadow(-|$)/, 'shadow', 'Shadows are decided by components, not pages (G-3).'],
  [/^(rounded)(-|$)/, 'radius', 'Radius is decided by components, not pages (G-3).'],
  [
    /^(bg-gradient|bg-linear|bg-radial|bg-conic|from|via|to)(-|$)/,
    'gradient',
    'Gradients live inside component variants (G-3).',
  ],
  [
    /^(z|animate|transition|duration|ease|delay|opacity|font|leading|tracking)(-|$)/,
    'decoration',
    'z/animate/transition/duration/ease/font/opacity are decided by the theme (G-3).',
  ],
  [
    /^text-(xs|sm|base|lg|xl|[2-9]xl)$/,
    'text-size',
    'Stock text sizes are banned in pages; use the type scale text-display..text-overline (G-3).',
  ],
]

const PALETTE_RE =
  /^(bg|text|fill|stroke|accent|caret|decoration|placeholder|from|via|to)-(slate|gray|grey|zinc|neutral|stone|red|orange|amber|yellow|lime|green|emerald|teal|cyan|sky|blue|indigo|violet|purple|fuchsia|pink|rose|kobalt|ink|black|white|transparent|current)(-\d{2,3})?(\/\d+)?$/

/**
 * @param {string} rawToken one whitespace-free class token
 * @returns {{ code: string, message: string } | null} null when allowed
 */
export function classifyToken(rawToken) {
  if (!rawToken) return null
  if (/[[\]()]/.test(rawToken))
    return { code: 'arbitrary', message: 'Arbitrary values `[...]`/`(--x)` are forbidden (G-3).' }

  const parts = rawToken.split(':')
  let utility = parts.pop() ?? ''
  for (const v of parts) {
    if (!VARIANTS.has(v))
      return { code: 'variant', message: `Variant "${v}:" is not in the allowlist (G-1).` }
  }
  utility = utility.replace(/^!/, '').replace(/!$/, '')
  const negative = utility.startsWith('-')
  if (negative) utility = utility.slice(1)

  // Icon classes (Phosphor collection via Nuxt UI icons plugin, D38).
  if (/^i-ph-[a-z0-9-]+$/.test(utility)) return null
  if (/^i-/.test(utility))
    return {
      code: 'icon',
      message: 'Icons must come from the Phosphor collection: use `i-ph-*` (D38).',
    }

  if (PALETTE_RE.test(utility))
    return {
      code: 'palette',
      message: `Palette colour "${utility}" is forbidden; use token utilities (text-muted, bg-elevated, ...) (G-3).`,
    }
  if (/^(bg|text|fill|stroke)-#|^(bg|text)-(rgb|hsl|oklch)/.test(utility))
    return { code: 'palette', message: 'Colour literals are forbidden (G-3).' }

  if (TOKEN_EXACT.has(utility) && !negative) return null
  if (LAYOUT_EXACT.has(utility)) return null

  for (const [re, code, message] of BANNED) {
    if (re.test(utility)) return { code, message }
  }

  const sp = spacingRe.exec(utility)
  if (sp) {
    return isSpacingValue(sp[2])
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
