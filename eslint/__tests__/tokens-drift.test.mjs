// Drift test (V2-T04): the class allowlist is generated from src/theme/tokens.css. If tokens.css
// introduces a token name that eslint/tokens.mjs does not classify (page / ds / palette), this
// fails until a person decides which level may use it.
import { describe, expect, it } from 'vitest'

import { classifyToken } from '../class-allowlist.mjs'
import { CURATED, loadTokens, utilitySets } from '../tokens.mjs'

describe('tokens.css classification', () => {
  const fam = loadTokens()

  it('parses the token families', () => {
    expect(fam.palette.size).toBeGreaterThan(20)
    expect(fam.type.has('heading')).toBe(true)
    expect(fam.uiText.has('muted')).toBe(true)
    expect(fam.uiBg.has('elevated')).toBe(true)
    expect(fam.shadow.size).toBeGreaterThan(0)
    expect(fam.gradient.has('gradient-primary')).toBe(true)
  })

  it('has no unclassified token names', () => {
    expect(
      [...fam.unknown],
      'new token(s) in src/theme/tokens.css: classify them in eslint/tokens.mjs (CURATED) or extend loadTokens()',
    ).toEqual([])
  })

  it('every curated page token still exists in tokens.css (or is a Nuxt UI semantic colour)', () => {
    for (const n of CURATED.pageUiText) expect(fam.uiText.has(n), `--ui-text-${n}`).toBe(true)
    for (const n of CURATED.pageUiBg) expect(fam.uiBg.has(n), `--ui-bg-${n}`).toBe(true)
    for (const n of CURATED.pageColor) expect(fam.color.has(n), `--color-${n}`).toBe(true)
    for (const n of CURATED.dsColor) expect(fam.color.has(n), `--color-${n}`).toBe(true)
  })

  it('generates page and ds utilities from the tokens', () => {
    const sets = utilitySets()
    expect(sets.page.has('text-muted')).toBe(true)
    expect(sets.page.has('text-heading')).toBe(true)
    expect(sets.page.has('bg-highlight')).toBe(false)
    expect(sets.ds.has('bg-highlight')).toBe(true)
    expect(sets.gradient.has('bg-gradient-primary')).toBe(true)
  })

  it('every type-scale token is allowed in pages, palette steps never', () => {
    for (const n of fam.type) expect(classifyToken(`text-${n}`, 'page'), n).toBeNull()
    for (const n of [...fam.palette].slice(0, 12))
      expect(classifyToken(`bg-${n}`, 'ds')?.code, n).toBe('palette')
  })
})
