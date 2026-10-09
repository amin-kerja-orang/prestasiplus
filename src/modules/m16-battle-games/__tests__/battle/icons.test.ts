/**
 * Every data-driven Font Awesome icon of S1 (discovery A.1 tiles, A.2 domains) resolves through the
 * shared icon maps (ADR-0010); a miss needs a design-system row, not a local map. Reported as
 * missing (no design-system row, M16-T3): fa-superscript (Matematik Tambahan) and fa-flask-vial
 * (Kimia); the tile then shows no glyph. The S1 level icons are fixed Lucide components.
 */

import { describe, expect, it } from 'vitest'

import { lookupFaName } from '@/components/icon/resolve'

const SUBJECT_ICONS = [
  'book-open',
  'globe',
  'calculator',
  'flask',
  'clock',
  'moon',
  'heart',
  'bolt',
  'leaf',
  'map',
  'palette',
  'music',
  'heartbeat',
  'wrench',
  'desktop',
  'language',
  'receipt',
  'chart-line',
  'briefcase',
  'book',
]
const DOMAIN_ICONS = [
  'brain',
  'calculator',
  'flask',
  'language',
  'landmark',
  'globe-asia',
  'users',
  'futbol',
  'monument',
  'leaf',
  'laptop-code',
  'chart-line',
  'lightbulb',
  'earth-asia',
  'pen-fancy',
  'seedling',
]

describe('S1 data-driven icons resolve through the icon maps', () => {
  it.each([...new Set([...SUBJECT_ICONS, ...DOMAIN_ICONS])])('fa-%s', (name) => {
    expect(lookupFaName(name), `fa-${name}`).toBeDefined()
  })
})
