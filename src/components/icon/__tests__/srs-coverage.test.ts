import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { lookupFaName } from '../resolve'

/**
 * ADR-0010 guard: every Font Awesome name used in the SRS documents must have a
 * row in the global table (`fa-to-lucide.ts`) or in a module map.
 */
const SRS_DIR = fileURLToPath(new URL('../../../../docs/requirements/srs/', import.meta.url))

/** FA tokens that are not icons: style prefixes and utility/animation classes. */
const NON_ICON = new Set([
  'solid',
  'regular',
  'light',
  'thin',
  'duotone',
  'brands',
  'spin',
  'pulse',
  'spin-pulse',
  'spin-reverse',
  'beat',
  'bounce',
  'fade',
  'shake',
  'flip',
  'fw',
  'xs',
  'sm',
  'lg',
  'xl',
  '2xs',
  '2xl',
  '1x',
  '2x',
  '3x',
  '4x',
  '5x',
  '6x',
  '7x',
  '8x',
  '9x',
  '10x',
  'rotate-90',
  'rotate-180',
  'rotate-270',
  'rotate-by',
  'flip-horizontal',
  'flip-vertical',
  'flip-both',
  'border',
  'inverse',
  'stack',
  'stack-1x',
  'stack-2x',
  'ul',
  'li',
  'pull-left',
  'pull-right',
])

/** design-system.md §6.9 brand icons, deferred to M09. */
const DEFERRED_BRANDS = new Set(['facebook-f', 'twitter', 'whatsapp', 'youtube'])

/**
 * FA names found in an SRS but not yet given a row in design-system.md §6. Each
 * entry must be removed once the doc (and the table) gains the row; the second
 * test fails when an entry is no longer a gap.
 */
const KNOWN_GAPS: Readonly<Record<string, string>> = {}

function srsFaNames(): Map<string, Set<string>> {
  const found = new Map<string, Set<string>>()
  for (const file of readdirSync(SRS_DIR).filter((f) => f.endsWith('.md'))) {
    const text = readFileSync(SRS_DIR + file, 'utf8')
    for (const match of text.matchAll(/\bfa-([a-z0-9-]+)/g)) {
      const name = match[1] ?? ''
      if (!found.has(name)) found.set(name, new Set())
      found.get(name)?.add(file)
    }
  }
  return found
}

const used = srsFaNames()

describe('SRS Font Awesome names vs the icon table (ADR-0010)', () => {
  it('finds FA names in the SRS documents', () => {
    expect(used.size).toBeGreaterThan(100)
  })

  it('every FA icon name used in an SRS has a row', () => {
    const gaps = [...used]
      .filter(([name]) => !NON_ICON.has(name) && !DEFERRED_BRANDS.has(name))
      .filter(([name]) => !Object.hasOwn(KNOWN_GAPS, name))
      .filter(([name]) => !lookupFaName(name))
      .map(([name, files]) => `fa-${name} (${[...files].join(', ')})`)
    expect(gaps).toEqual([])
  })

  it('every known gap is still a real, used gap (remove it once mapped)', () => {
    for (const name of Object.keys(KNOWN_GAPS)) {
      expect(used.has(name), `fa-${name} no longer used`).toBe(true)
      expect(lookupFaName(name), `fa-${name} is mapped now`).toBeUndefined()
    }
  })
})
