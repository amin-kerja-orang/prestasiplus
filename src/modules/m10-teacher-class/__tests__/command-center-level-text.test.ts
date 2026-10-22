import { describe, expect, it } from 'vitest'

import { levelText } from '../components/command-center/copy'

describe('levelText (BE-22 grade codes)', () => {
  it('maps curriculum codes to the slug text', () => {
    expect(levelText('DARJAH_3')).toBe('tahun-3')
    expect(levelText('TINGKATAN_5')).toBe('tingkatan-5')
  })
  it('passes mock slugs through', () => {
    expect(levelText('tahun-1')).toBe('tahun-1')
  })
})
