import { afterAll, describe, expect, it } from 'vitest'

import {
  bcryptHashWithSalt,
  isLegacyBcrypt,
  LegacyBcryptBusyError,
  LegacyBcryptPool,
  parseLegacyBcrypt,
} from '../../src/modules/auth/legacy-bcrypt'

describe('legacy bcrypt verifier (worker pool)', () => {
  const pool = new LegacyBcryptPool({ size: 1, maxQueue: 2 })
  afterAll(async () => {
    await pool.onModuleDestroy()
  })

  it('matches a published crypt_blowfish vector', async () => {
    expect(await pool.verify('U*U', '$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW')).toBe(true)
    expect(await pool.verify('U*V', '$2a$05$CCCCCCCCCCCCCCCCCCCCC.E5YPO9kmyuRGyh0XouQYb4YMJKvyOeW')).toBe(false)
  })

  it('verifies a $2y$ hash produced by PHP password_hash (the Laravel hasher)', async () => {
    const fromPhp = '$2y$05$s5hiTkaNRWLesw5wNVwQ4.zACielzo6GZcTGWIDTWRfsOOFije9TC'
    expect(await pool.verify('Rahsia-Ujian-1', fromPhp)).toBe(true)
    expect(await pool.verify('Rahsia-Ujian-2', fromPhp)).toBe(false)
  })

  it('round-trips and rejects malformed hashes', async () => {
    const h = bcryptHashWithSalt('Kata Laluan Ujian', 'abcdefghijklmnopqrstuu', 4, '2b')
    expect(isLegacyBcrypt(h)).toBe(true)
    expect(await pool.verify('Kata Laluan Ujian', h)).toBe(true)
    expect(await pool.verify('Kata Laluan ujian', h)).toBe(false)
    expect(await pool.verify('x', '$2y$05$short')).toBe(false)
    expect(await pool.verify('x', '')).toBe(false)
    expect(isLegacyBcrypt('$argon2id$v=19$m=19456,t=2,p=1$abc$def')).toBe(false)
  })

  it('treats a cost above 13 (or below 4) as a failed verify without doing the work', async () => {
    const tooCostly = '$2y$14$abcdefghijklmnopqrstuuabcdefghijklmnopqrstuvwxyz01234567'.slice(0, 60)
    expect(isLegacyBcrypt(tooCostly)).toBe(true)
    expect(parseLegacyBcrypt(tooCostly)).toBeNull()
    const started = Date.now()
    expect(await pool.verify('x', tooCostly)).toBe(false)
    expect(Date.now() - started).toBeLessThan(500)
    expect(parseLegacyBcrypt(`$2y$03$${'a'.repeat(53)}`)).toBeNull()
    expect(parseLegacyBcrypt(`$2y$13$${'a'.repeat(53)}`)).toMatchObject({ cost: 13 })
  })

  it('keeps the event loop responsive while a verify runs', async () => {
    const hash = bcryptHashWithSalt('Lambat-Sedikit', 'abcdefghijklmnopqrstuu', 11, '2y')
    let ticks = 0
    const timer = setInterval(() => ticks++, 10)
    const started = Date.now()
    const ok = await pool.verify('Lambat-Sedikit', hash)
    const elapsed = Date.now() - started
    clearInterval(timer)
    expect(ok).toBe(true)
    expect(elapsed).toBeGreaterThan(100)
    // On the main thread the loop would be blocked for the whole verify and the timer would not fire.
    // A loaded machine slows the timer, so only a few ticks are required.
    expect(ticks).toBeGreaterThanOrEqual(3)
  }, 60_000)

  it('refuses a queued job that waits longer than the queue timeout', async () => {
    const small = new LegacyBcryptPool({ size: 1, maxQueue: 5, queueTimeoutMs: 50 })
    try {
      const slow = bcryptHashWithSalt('Tunggu', 'abcdefghijklmnopqrstuu', 11, '2y')
      const running = small.verify('Tunggu', slow)
      await expect(small.verify('Tunggu', slow)).rejects.toBeInstanceOf(LegacyBcryptBusyError)
      expect(await running).toBe(true) // the running job is not affected
    } finally {
      await small.onModuleDestroy()
    }
  }, 60_000)

  it('rejects with a busy error when the bounded queue is full', async () => {
    const slow = bcryptHashWithSalt('Penuh', 'abcdefghijklmnopqrstuu', 10, '2y')
    const jobs = [1, 2, 3].map(() => pool.verify('Penuh', slow)) // one running, two queued
    await expect(pool.verify('Penuh', slow)).rejects.toBeInstanceOf(LegacyBcryptBusyError)
    expect(await Promise.all(jobs)).toEqual([true, true, true])
  }, 60_000)
})
