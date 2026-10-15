/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { compile } from 'tailwindcss'
import { beforeAll, describe, expect, it } from 'vitest'

import { allTokenGroups } from '../tokens'

// F-02 acceptance: the token CSS compiles and every custom token produces its utility.
// Sheets are read from disk because Vitest does not process CSS imports (not even `?raw`).

const stylesDir = dirname(fileURLToPath(new URL('../main.css', import.meta.url)))
const requireFromHere = createRequire(import.meta.url)

function loadStylesheet(id: string, base: string) {
  // `@nuxt/ui` css imports the Vite-plugin-generated `#build/ui.css`, which only exists inside the
  // Vite pipeline. This test covers the legacy tokens, so Nuxt UI is replaced by an empty sheet.
  if (id === '@nuxt/ui') return Promise.resolve({ path: id, base, content: '' })
  const path = id.startsWith('.')
    ? resolve(base, id)
    : requireFromHere.resolve(id === 'tailwindcss' ? 'tailwindcss/index.css' : id)
  return Promise.resolve({ path, base: dirname(path), content: readFileSync(path, 'utf8') })
}

const mainCss = readFileSync(resolve(stylesDir, 'main.css'), 'utf8')

const allClasses = Object.values(allTokenGroups).flatMap((group) => group.map((t) => t.className))

const paletteProbes = [
  'violet-600',
  'blue-900',
  'slate-800',
  'pink-500',
  'red-800',
  'red-600',
  'orange-500',
  'indigo-500',
  'emerald-500',
  'amber-500',
  'gray-800',
  'rose-950',
].map((name) => `bg-${name}`)

let css = ''

beforeAll(async () => {
  const compiler = await compile(mainCss, { base: stylesDir, loadStylesheet })
  css = compiler.build([
    ...allClasses,
    'sm:flex',
    'md:flex',
    'lg:flex',
    'xl:flex',
    'rounded-xl',
    ...paletteProbes,
  ])
})

function ruleFor(className: string): string {
  const escaped = className.replace(/[:]/g, '\\\\:')
  const match = new RegExp(`\\.${escaped}\\s*\\{[^}]*\\}`).exec(css)
  return match?.[0] ?? ''
}

describe('design tokens (F-02)', () => {
  it('keeps the src-only source() on the tailwind import', () => {
    expect(mainCss).toContain("@import 'tailwindcss' source('../');")
  })

  it.each(allClasses)('generates the utility %s', (className) => {
    expect(ruleFor(className)).not.toBe('')
  })

  it('defines the font stacks', () => {
    expect(css).toContain(`--font-body: 'Inter Variable', Inter, sans-serif`)
    expect(css).toContain(`--font-heading: 'Outfit Variable', Outfit, sans-serif`)
    expect(css).toContain(`--font-arabic: 'Scheherazade New', 'Lateef', serif`)
  })

  it('loads the three font families', () => {
    expect(css).toContain(`font-family: 'Inter Variable'`)
    expect(css).toContain(`font-family: 'Outfit Variable'`)
    expect(css).toMatch(/font-family: 'Scheherazade New';[^}]*font-weight: 400/)
    expect(css).toMatch(/font-family: 'Scheherazade New';[^}]*font-weight: 700/)
  })

  it('has the observed semantic colours', () => {
    expect(css).toContain('--color-live-primary: #6366f1')
    expect(css).toContain('--color-text: #334155')
    expect(css).toContain('--color-text-strong: #1e293b')
    expect(css).toContain('--color-muted: #64748b')
    expect(css).toContain('--color-theme: #3b82f6')
  })

  it('has the observed gradients', () => {
    expect(ruleFor('bg-primary-gradient')).toContain(
      'linear-gradient(135deg, #3b82f6 0%, #6366f1 50%, #8b5cf6 100%)',
    )
    expect(ruleFor('bg-cta-gradient')).toContain(
      'linear-gradient(to right, #3b82f6, #6366f1, #9333ea)',
    )
    expect(ruleFor('bg-app-user')).toContain('background-attachment: fixed')
    expect(ruleFor('bg-auth')).toContain('background-size: 400% 400%')
    expect(ruleFor('bg-error-page').replace(/\s+/g, ' ')).toContain(
      'linear-gradient( 135deg, var(--color-blue-900), var(--color-violet-600), var(--color-pink-500) )',
    )
    expect(ruleFor('bg-forbidden-page').replace(/\s+/g, ' ')).toContain(
      'linear-gradient( 135deg, var(--color-red-800), var(--color-red-600), var(--color-orange-500) )',
    )
  })

  it('renders palette classes with the Tailwind v3.4 hex values (as live)', () => {
    const expected: Record<string, string> = {
      'violet-600': '#7c3aed',
      'blue-900': '#1e3a8a',
      'slate-800': '#1e293b',
      'pink-500': '#ec4899',
      'red-800': '#991b1b',
      'red-600': '#dc2626',
      'orange-500': '#f97316',
      'indigo-500': '#6366f1',
      'emerald-500': '#10b981',
      'amber-500': '#f59e0b',
      'gray-800': '#1f2937',
      'rose-950': '#4c0519',
    }
    for (const [name, hex] of Object.entries(expected)) {
      expect(css).toContain(`--color-${name}: ${hex};`)
      expect(ruleFor(`bg-${name}`)).toContain(`var(--color-${name})`)
    }
    // The v4 oklch defaults are overridden, not emitted alongside.
    expect(css).not.toMatch(/--color-violet-600: oklch/)
  })

  it('overrides all 22 standard scales at 50-950 in theme.css', () => {
    const theme = readFileSync(resolve(stylesDir, 'theme.css'), 'utf8')
    const vars = theme.match(/--color-[a-z]+-(?:50|[1-9]00|950): #[0-9a-f]{6};/g) ?? []
    expect(vars).toHaveLength(22 * 11)
  })

  it('emits keyframes for the motion tokens', () => {
    for (const name of [
      'fadeIn',
      'bounceIn',
      'sparkle',
      'coolGradient',
      'floatBounce',
      'popIn',
      'mascotBounce',
    ]) {
      expect(css).toContain(`@keyframes ${name}`)
    }
    expect(css).toContain('--animate-page-transition: fadeIn 0.4s ease-out')
    expect(css).toContain('--animate-cool-gradient: coolGradient 15s')
    expect(css).toContain('--animate-float-bounce: floatBounce 6s')
  })

  it('defines the hover-none variant as a (hover: none) media query', () => {
    expect(css).toMatch(/@media \(hover: none\)\s*\{[^}]*opacity: 100%/)
  })

  it('keeps the default breakpoints and radii', () => {
    expect(css).toContain('@media (width >= 40rem)')
    expect(css).toContain('@media (width >= 48rem)')
    expect(css).toContain('@media (width >= 64rem)')
    expect(css).toContain('@media (width >= 80rem)')
    expect(css).toContain('--radius-xl: 0.75rem')
  })

  it('applies the base body and heading styles', () => {
    expect(css).toMatch(/body\s*\{[^}]*font-family: var\(--font-body\)/)
    expect(css).toMatch(/h6[^{]*\{[^}]*font-family: var\(--font-heading\)/)
  })
})
