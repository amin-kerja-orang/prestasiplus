import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { STUDENT, STUDENT_EMPTY, STUDENT_MAJU, bootWalletApp, userIdOf, type WalletTestApp } from './helpers'

/** BE-21 `WalletService.balancesOf`: one set-based read of the current syiling balance (seeded mock wallets). */
describe('WalletService.balancesOf', () => {
  let t: WalletTestApp
  beforeAll(async () => {
    t = await bootWalletApp()
  }, 120_000)
  afterAll(async () => {
    await t.close()
  })

  it('returns the balance of each wallet, the same figure as gamificationSummary', async () => {
    const a = await userIdOf(t.db, STUDENT)
    const b = await userIdOf(t.db, STUDENT_MAJU)
    const map = await t.wallet.balancesOf([a, b, a])
    expect(map.size).toBe(2)
    expect(map.get(a)).toBe((await t.wallet.gamificationSummary(a)).coins)
    expect(map.get(b)).toBe((await t.wallet.gamificationSummary(b)).coins)
    expect(map.get(a)).toBe(370)
    expect(map.get(b)).toBe(267)
  })

  it('a user without a wallet is absent (read as 0); an empty list is an empty map', async () => {
    const none = await userIdOf(t.db, STUDENT_EMPTY)
    const map = await t.wallet.balancesOf([none])
    expect(map.get(none) ?? 0).toBe((await t.wallet.gamificationSummary(none)).coins)
    expect((await t.wallet.balancesOf([])).size).toBe(0)
  })

  it('more than 1000 ids are chunked and still answer', async () => {
    const a = await userIdOf(t.db, STUDENT)
    const ids = Array.from({ length: 1500 }, (_, i) => String(900_000_000 + i))
    const map = await t.wallet.balancesOf([a, ...ids])
    expect(map.get(a)).toBe(370)
  })

  it('rejects a malformed id', async () => {
    await expect(t.wallet.balancesOf(['not-an-id'])).rejects.toThrow(RangeError)
  })
})
