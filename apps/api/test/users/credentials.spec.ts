import { describe, expect, it } from 'vitest'

import { generatePassword } from '../../src/modules/users/credentials'
import { MIN_PASSWORD_LENGTH, PASSWORD_ALPHABET, PASSWORD_LENGTH, PASSWORD_TOO_SHORT_MESSAGE } from '../../src/modules/users/users.constants'

describe('generated passwords (FR-ADM-U02.4, AC-ADM-U05.3: minimum 8)', () => {
  it('the default length is at or above the minimum and uses only the alphabet', () => {
    expect(MIN_PASSWORD_LENGTH).toBe(8)
    expect(PASSWORD_LENGTH).toBeGreaterThanOrEqual(MIN_PASSWORD_LENGTH)
    for (let i = 0; i < 50; i++) {
      const p = generatePassword()
      expect(p).toHaveLength(PASSWORD_LENGTH)
      for (const ch of p) expect(PASSWORD_ALPHABET).toContain(ch)
    }
  })

  it('refuses a length under the minimum and accepts the minimum', () => {
    expect(() => generatePassword(MIN_PASSWORD_LENGTH - 1)).toThrow(RangeError)
    expect(() => generatePassword(Number.NaN)).toThrow(RangeError)
    expect(generatePassword(MIN_PASSWORD_LENGTH)).toHaveLength(MIN_PASSWORD_LENGTH)
  })

  it('carries the BM copy for a typed password that is too short', () => {
    expect(PASSWORD_TOO_SHORT_MESSAGE).toBe('Kata laluan mesti sekurang-kurangnya 8 aksara.')
  })
})
