import { describe, expect, it } from 'vitest'

import { QR_MAX_VERSION, encodeQr, qrCapacity } from '../../components/kelas/qr-code'

const URL = 'https://prestasiplus.my/kelas-saya?kod=DMO101'

function expectFinder(m: boolean[][], x0: number, y0: number): void {
  for (let dy = 0; dy < 7; dy++) {
    for (let dx = 0; dx < 7; dx++) {
      const ring = Math.max(Math.abs(dx - 3), Math.abs(dy - 3))
      expect(m[y0 + dy]?.[x0 + dx]).toBe(ring !== 2)
    }
  }
}

describe('encodeQr', () => {
  it('picks the smallest version that fits (level M capacities)', () => {
    expect(qrCapacity(1)).toBe(14)
    expect(qrCapacity(4)).toBe(62)
    expect(qrCapacity(10)).toBe(213)
    expect(encodeQr('A')).toHaveLength(21)
    expect(encodeQr(URL)).toHaveLength(33) // 45 bytes → version 4
    expect(encodeQr('x'.repeat(213))).toHaveLength(17 + 4 * QR_MAX_VERSION)
  })

  it('draws the three finder patterns, the timing patterns and the dark module', () => {
    const m = encodeQr(URL)
    const n = m.length
    expectFinder(m, 0, 0)
    expectFinder(m, n - 7, 0)
    expectFinder(m, 0, n - 7)
    for (let i = 8; i < n - 8; i++) {
      expect(m[6]?.[i]).toBe(i % 2 === 0)
      expect(m[i]?.[6]).toBe(i % 2 === 0)
    }
    expect(m[n - 8]?.[8]).toBe(true)
  })

  it('is deterministic and differs for another code', () => {
    expect(encodeQr(URL)).toEqual(encodeQr(URL))
    expect(encodeQr(URL)).not.toEqual(encodeQr(URL.replace('DMO101', 'DMO102')))
  })

  it('rejects text that does not fit version 10', () => {
    expect(() => encodeQr('x'.repeat(214))).toThrow(RangeError)
  })
})
