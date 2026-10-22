import { describe, expect, it } from 'vitest'

import { diffForHumans } from '../../src/modules/command-center/board/diff-for-humans'

const NOW = new Date('2026-10-19T09:00:00+08:00')
const ago = (iso: string): string => diffForHumans(new Date(iso), NOW)

describe('diffForHumans (Carbon ms locale)', () => {
  it('prints the largest non-zero unit only', () => {
    expect(ago('2026-10-19T09:00:00+08:00')).toBe('1 saat yang lepas')
    expect(ago('2026-10-19T08:59:30+08:00')).toBe('30 saat yang lepas')
    expect(ago('2026-10-19T08:15:00+08:00')).toBe('45 minit yang lepas')
    expect(ago('2026-10-19T07:00:00+08:00')).toBe('2 jam yang lepas')
    expect(ago('2026-10-17T09:00:00+08:00')).toBe('2 hari yang lepas')
    expect(ago('2026-10-05T09:00:00+08:00')).toBe('2 minggu yang lepas')
    expect(ago('2026-08-19T09:00:00+08:00')).toBe('2 bulan yang lepas')
    expect(ago('2024-10-19T09:00:00+08:00')).toBe('2 tahun yang lepas')
  })

  it('reads a later instant as the future', () => {
    expect(ago('2026-10-19T11:00:00+08:00')).toBe('2 jam dari sekarang')
  })
})
