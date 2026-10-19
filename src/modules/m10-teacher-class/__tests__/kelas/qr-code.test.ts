import { createHash } from 'node:crypto'
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
  // Known answers: hashes of the module matrices (rows of 0/1 joined by newlines), captured from
  // encodings that decode back to the input text with an independent reader (jsQR, not a dependency).
  it.each([
    [URL, 33, 'c6b4bb73fbaf6e9051266f0b066d16ce0998f8e5f40906cd467a017cf47db05e'],
    ['A', 21, 'bc9009ae87ca68f1d256b69eb26362086d73d9f0b95f1e9f3dccae752626c3b6'],
    ['x'.repeat(63), 37, 'fcc8278569d63b26ffb606f813853af872249d8da212fdd5a580b766bfea7146'],
    ['y'.repeat(213), 57, '3bb4dc258df63cd72866923bcf69b2a163f017bd6dd5d9d77a92f7f81ad9c892'],
  ])('matches the verified matrix of %#', (text, size, hash) => {
    const m = encodeQr(text)
    expect(m).toHaveLength(size)
    const bits = m.map((r) => r.map((v) => (v ? 1 : 0)).join('')).join('\n')
    expect(createHash('sha256').update(bits).digest('hex')).toBe(hash)
  })

  it('writes a format word that is a valid BCH(15,5) codeword for level M', () => {
    for (const text of [URL, 'A', 'y'.repeat(213)]) {
      const m = encodeQr(text)
      const at = (x: number, y: number) => (m[y]?.[x] ? 1 : 0)
      let bits = 0
      for (let i = 0; i <= 5; i++) bits |= at(8, i) << i
      bits |= at(8, 7) << 6
      bits |= at(8, 8) << 7
      bits |= at(7, 8) << 8
      for (let i = 9; i < 15; i++) bits |= at(14 - i, 8) << i
      const word = bits ^ 0x5412
      expect(word >>> 13).toBe(0) // error-correction level M = 00
      let rem = word
      for (let i = 14; i >= 10; i--) if ((rem >>> i) & 1) rem ^= 0x537 << (i - 10)
      expect(rem).toBe(0)
    }
  })
})
