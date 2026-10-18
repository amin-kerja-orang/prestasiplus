// Token utility sets generated from src/theme/tokens.css (V2-T04 review fix).
// The CSS is the source of truth for which token names exist; the lists below only decide which
// FAMILIES a page may use ("curated") and which are composite-only. A token the lists do not
// classify makes the drift test (eslint/__tests__/tokens-drift.test.mjs) fail, so a new token is
// always a conscious decision.
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const TOKENS_CSS = fileURLToPath(new URL('../src/theme/tokens.css', import.meta.url))

/** Semantic colours Nuxt UI provides (`--ui-primary` etc.); usable as text-* / bg-* in composites. */
export const NUXT_UI_SEMANTIC = [
  'primary',
  'secondary',
  'success',
  'info',
  'warning',
  'error',
  'neutral',
]

/** G-1: what a PAGE may use. Everything else defined in tokens.css is composite (ds) level only. */
export const CURATED = {
  /** `--ui-text-*` names (and `default` = `--ui-text`) pages may use as `text-*`. */
  pageUiText: ['default', 'toned', 'muted', 'dimmed', 'highlighted', 'inverted'],
  /** `--ui-bg-*` names pages may use as `bg-*`. */
  pageUiBg: ['default', 'muted', 'elevated'],
  /** Semantic colours pages may use as `text-*`. */
  pageSemanticText: ['primary', 'success', 'info', 'warning', 'error'],
  /** `--color-*` bridge tokens pages may use as `bg-*` / `text-*`. */
  pageColor: ['soft', 'cat-1', 'cat-2', 'cat-3', 'cat-4', 'cat-5', 'cat-6', 'cat-7', 'cat-8'],
  /** `--color-*` bridge tokens only composites may use. */
  dsColor: [
    'highlight',
    'on-highlight',
    'win-ring',
    'seg-active',
    'primary-on',
    'primary-t',
    'on-sem',
    'on-secondary',
    'heat',
    'friend',
    'trial',
    'ai',
    'flame',
    'ic-theme',
    // Tint, ramp, overlay and track tokens (hardening T-H0): composites only; pages go through DsText/DsSurface props.
    ...['primary','highlight','success','warning','error','info'].flatMap((n) => [n + '-soft', n + '-strong']),
    'error-field',
    'overlay',
    'ramp-1',
    'ramp-2',
    'ramp-3',
    'ramp-4',
    'track',
  ],
  /** `--ui-bg-*` names only composites may use. */
  dsUiBg: ['accented', 'inverted'],
}

/** @returns {Record<string, Set<string>>} token names per family, parsed from tokens.css */
export function loadTokens(file = TOKENS_CSS) {
  const css = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
  const fam = {
    palette: new Set(),
    color: new Set(),
    uiText: new Set(),
    uiBg: new Set(),
    uiBorder: new Set(),
    type: new Set(),
    shadow: new Set(),
    radius: new Set(),
    gradient: new Set(),
    animate: new Set(),
    ease: new Set(),
    font: new Set(),
    /** Declared names no family recognises (the drift test requires this to stay empty). */
    unknown: new Set(),
  }
  const names = new Set()
  for (const m of css.matchAll(/(?:^|[;{\s])(--[a-z0-9-]+)\s*:/g)) names.add(m[1])
  for (const full of names) {
    const name = full.replace(/--(?:line-height|letter-spacing|font-weight)$/, '')
    let m
    if ((m = /^--color-(.+)$/.exec(name))) {
      if (/-\d{2,3}$/.test(m[1])) fam.palette.add(m[1])
      else fam.color.add(m[1])
    } else if ((m = /^--ui-text(?:-(.+))?$/.exec(name))) fam.uiText.add(m[1] ?? 'default')
    else if ((m = /^--ui-bg(?:-(.+))?$/.exec(name))) fam.uiBg.add(m[1] ?? 'default')
    else if ((m = /^--ui-border(?:-(.+))?$/.exec(name))) fam.uiBorder.add(m[1] ?? 'default')
    else if (/^--ui-/.test(name) || /^--ds-/.test(name) || /^--transition-duration-/.test(name)) continue
    else if ((m = /^--text-(.+)$/.exec(name))) fam.type.add(m[1])
    else if ((m = /^--shadow-(.+)$/.exec(name))) fam.shadow.add(m[1])
    else if ((m = /^--radius-(.+)$/.exec(name))) fam.radius.add(m[1])
    else if ((m = /^--background-image-(.+)$/.exec(name))) fam.gradient.add(m[1])
    else if ((m = /^--animate-(.+)$/.exec(name))) fam.animate.add(m[1])
    else if ((m = /^--ease-(.+)$/.exec(name))) fam.ease.add(m[1])
    else if ((m = /^--font-(.+)$/.exec(name))) fam.font.add(m[1])
    else fam.unknown.add(name)
  }
  // Color tokens that are not classified by CURATED are drift too.
  const classifiedColor = new Set([...CURATED.pageColor, ...CURATED.dsColor])
  for (const c of fam.color) if (!classifiedColor.has(c)) fam.unknown.add(`--color-${c}`)
  const classifiedText = new Set(CURATED.pageUiText)
  for (const t of fam.uiText) if (!classifiedText.has(t)) fam.unknown.add(`--ui-text-${t}`)
  const classifiedBg = new Set([...CURATED.pageUiBg, ...CURATED.dsUiBg, 'soft'])
  for (const b of fam.uiBg) if (!classifiedBg.has(b)) fam.unknown.add(`--ui-bg-${b}`)
  return fam
}

let cache
/** Utility sets for the allowlist: exact class names (without variants / opacity modifier). */
export function utilitySets() {
  if (cache) return cache
  let fam
  try {
    fam = loadTokens()
  } catch {
    fam = loadFallback()
  }
  const has = (set, n) => set.has(n)
  const pageColorUtils = new Set()
  const dsColorUtils = new Set()
  const addColor = (set, name) => {
    set.add(`text-${name}`)
    set.add(`bg-${name}`)
  }
  for (const n of CURATED.pageUiText) if (has(fam.uiText, n)) pageColorUtils.add(`text-${n}`)
  for (const n of CURATED.pageUiBg) if (has(fam.uiBg, n)) pageColorUtils.add(`bg-${n}`)
  for (const n of CURATED.pageSemanticText) pageColorUtils.add(`text-${n}`)
  for (const n of CURATED.pageColor) if (has(fam.color, n)) addColor(pageColorUtils, n)
  for (const u of pageColorUtils) dsColorUtils.add(u)
  for (const n of CURATED.dsColor) if (has(fam.color, n)) addColor(dsColorUtils, n)
  for (const n of CURATED.dsUiBg) if (has(fam.uiBg, n)) dsColorUtils.add(`bg-${n}`)
  for (const n of NUXT_UI_SEMANTIC) addColor(dsColorUtils, n)
  for (const n of fam.uiText) dsColorUtils.add(`text-${n}`)
  const type = new Set([...fam.type].map((n) => `text-${n}`))
  cache = {
    page: new Set([...pageColorUtils, ...type, 'tabular']),
    ds: new Set([...dsColorUtils, ...type, 'tabular']),
    /** `text-*` / `bg-*` utilities that take an opacity modifier (colour tokens only). */
    pageColorUtils,
    dsColorUtils,
    shadow: new Set([...fam.shadow].map((n) => `shadow-${n}`)),
    radius: new Set([...fam.radius].map((n) => `rounded-${n}`)),
    gradient: new Set([...fam.gradient].map((n) => `bg-${n}`)),
    animate: new Set([...fam.animate].map((n) => `animate-${n}`)),
    font: new Set([...fam.font].map((n) => `font-${n}`)),
    families: fam,
  }
  return cache
}

/** Used only if tokens.css cannot be read (the drift test would still fail loudly in CI). */
function loadFallback() {
  return {
    palette: new Set(),
    color: new Set([...CURATED.pageColor, ...CURATED.dsColor]),
    uiText: new Set(CURATED.pageUiText),
    uiBg: new Set([...CURATED.pageUiBg, ...CURATED.dsUiBg]),
    uiBorder: new Set(),
    type: new Set([
      'display',
      'title',
      'heading',
      'subheading',
      'body',
      'label',
      'caption',
      'overline',
    ]),
    shadow: new Set(),
    radius: new Set(),
    gradient: new Set(),
    animate: new Set(),
    ease: new Set(),
    font: new Set(),
    unknown: new Set(),
  }
}
