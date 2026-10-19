import { describe, expect, it } from 'vitest'

import { bcryptHashWithSalt, isLegacyBcrypt, verifyLegacyBcrypt } from '../../src/modules/auth/legacy-bcrypt'

describe('legacy bcrypt verifier', () => {
  it('matches a published crypt_blowfish vector', () => {
    expect(verifyLegacyBcrypt('U*U', '$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW')).toBe(true)
    expect(verifyLegacyBcrypt('U*V', '$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW')).toBe(false)
  })

  it('verifies a $2y$ hash produced by PHP password_hash (the Laravel hasher)', () => {
    const fromPhp = '$2y$05$s5hiTkaNRWLesw5wNVwQ4.zACielzo6GZcTGWIDTWRfsOOFije9TC'
    expect(verifyLegacyBcrypt('Rahsia-Ujian-1', fromPhp)).toBe(true)
    expect(verifyLegacyBcrypt('Rahsia-Ujian-2', fromPhp)).toBe(false)
  })

  it('round-trips and rejects malformed hashes', () => {
    const h = bcryptHashWithSalt('Kata Laluan Ujian', 'abcdefghijklmnopqrstuu', 4, '2b')
    expect(isLegacyBcrypt(h)).toBe(true)
    expect(verifyLegacyBcrypt('Kata Laluan Ujian', h)).toBe(true)
    expect(verifyLegacyBcrypt('Kata Laluan ujian', h)).toBe(false)
    expect(verifyLegacyBcrypt('x', '$2y$05$short')).toBe(false)
    expect(verifyLegacyBcrypt('x', '')).toBe(false)
    expect(isLegacyBcrypt('$argon2id$v=19$m=19456,t=2,p=1$abc$def')).toBe(false)
  })
})
