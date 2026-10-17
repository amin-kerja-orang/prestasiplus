import { describe, expect, it } from 'vitest'

import type { SpmTargetRow } from '../../api/types'
import {
  parseId,
  remedialChip,
  safeResourceUrl,
  targetBarWidth,
  targetStatus,
} from '../../components/remedial/assigned-lib'
import {
  answerUrl,
  kbatBadge,
  parsePage,
  parseVariant,
  safeImageSrc,
  variantQuery,
} from '../../components/structured/structured-lib'

describe('structured-lib', () => {
  it('maps KBAT levels to the observed badges (BR-23)', () => {
    expect(kbatBadge(1)).toEqual({ label: 'LOTS 1', color: 'success' })
    expect(kbatBadge(2).label).toBe('LOTS 2')
    expect(kbatBadge(3)).toEqual({ label: 'MOTS 3', color: 'warning' })
    for (const n of [4, 5, 6]) {
      expect(kbatBadge(n)).toEqual({ label: `HOTS ${String(n)}`, color: 'error' })
    }
  })

  it('parses the variant; track needs scope', () => {
    expect(parseVariant({})).toEqual({ scope: null, track: null })
    expect(parseVariant({ scope: 'spm' })).toEqual({ scope: 'spm', track: null })
    expect(parseVariant({ scope: 'spm', track: 'bahasa' })).toEqual({
      scope: 'spm',
      track: 'bahasa',
    })
    expect(parseVariant({ track: 'bahasa' })).toEqual({ scope: null, track: null })
    expect(parseVariant({ scope: 'x' })).toEqual({ scope: null, track: null })
  })

  it('keeps scope and track on the answer link', () => {
    expect(answerUrl(7, { scope: null, track: null })).toBe('/latihan-berstruktur/7/jawab')
    expect(answerUrl(7, { scope: 'spm', track: null })).toBe(
      '/latihan-berstruktur/7/jawab?scope=spm',
    )
    expect(answerUrl(7, { scope: 'spm', track: 'bahasa' })).toBe(
      '/latihan-berstruktur/7/jawab?scope=spm&track=bahasa',
    )
    expect(variantQuery({ scope: null, track: null })).toBe('')
  })

  it('parses the page and rejects unsafe image sources', () => {
    expect(parsePage({ page: '3' })).toBe(3)
    expect(parsePage({ page: '0' })).toBe(1)
    expect(parsePage({})).toBe(1)
    expect(safeImageSrc('https://x.test/a.png')).toBe('https://x.test/a.png')
    expect(safeImageSrc('/img/a.png')).toBe('/img/a.png')
    expect(safeImageSrc('blob:http://x/1')).toBe('blob:http://x/1')
    expect(safeImageSrc('javascript:alert(1)')).toBeNull()
    expect(safeImageSrc('//evil.test/a.png')).toBeNull()
    expect(safeImageSrc('/\\evil.com')).toBeNull()
    expect(safeImageSrc('data:image/png;base64,AA')).toBeNull()
    expect(safeImageSrc(null)).toBeNull()
  })
})

describe('assigned-lib', () => {
  it('accepts only positive integer ids', () => {
    expect(parseId('7601')).toBe(7601)
    for (const bad of ['0', '-1', '1.5', 'abc', '', '01']) expect(parseId(bad)).toBeNull()
  })

  it('links resources only over http(s) or internally', () => {
    expect(safeResourceUrl('https://youtu.be/x')).toBe('https://youtu.be/x')
    expect(safeResourceUrl('/artikel/a')).toBe('/artikel/a')
    expect(safeResourceUrl('javascript:alert(1)')).toBeNull()
    expect(safeResourceUrl('//evil.test')).toBeNull()
    expect(safeResourceUrl('/\\evil.com')).toBeNull()
    expect(safeResourceUrl(null)).toBeNull()
  })

  it('labels the remedial status', () => {
    expect(remedialChip('active').label).toBe('Aktif')
    expect(remedialChip('completed').label).toBe('Selesai')
  })

  it('renders the S15 status and bar from progress (BR-27)', () => {
    const none: SpmTargetRow = {
      id: 1,
      name: 'BM',
      target: null,
      answered: 0,
      accuracyPct: null,
      band: null,
      predictedGrade: null,
    }
    expect(targetStatus(none)).toBe('Belum mula')
    expect(targetBarWidth(none)).toBe(0)
    const some = { ...none, answered: 12, accuracyPct: 75, band: 'green' as const }
    expect(targetStatus(some)).toBe('12 soalan · 75%')
    expect(targetBarWidth(some)).toBe(75)
  })
})
