/**
 * `coin_transactions.source` mapping of the ledger transform (BE-29, M14 URS FN-M14-8.1 to 8.3): every observed
 * .cloud source maps to its v2 value with the sign its direction needs. Values are fictitious; ids are surrogate.
 */
import { describe, expect, it } from 'vitest'

import { ledgerSourceSignOk, transformLedger } from '../../../src/migration/transform/wallet'

const tx = (over: Record<string, string | null> = {}) => ({
  id: '1', user_id: '1', type: 'earn', source: 'quiz_spm', amount: '5', balance_after: '5', created_at: '2026-01-01 00:00:00+00', ...over,
})
const refs = { userId: '9', isStudent: true }

/** [.cloud source, v2 source, type, a valid signed amount]. */
const OBSERVED: ReadonlyArray<readonly [string, string, string, string]> = [
  ['quiz_spm', 'quiz_spm', 'earn', '22'],
  ['daily_login', 'daily_login', 'earn', '2'],
  ['token_conversion', 'token_conversion', 'convert', '-400'],
  ['daily_challenge', 'daily_challenge', 'earn', '25'],
  ['spm', 'spm', 'earn', '7'],
  ['streak_bonus', 'streak_bonus', 'bonus', '25'],
  ['reward_claim', 'reward_claim', 'spend', '-100'],
  ['mystery_box', 'mystery_box', 'earn', '30'],
  ['hadiah_redeem', 'hadiah_redeem', 'spend', '-10'],
]

describe('observed ledger sources', () => {
  it.each(OBSERVED)('%s maps to %s (%s, %s)', (source, v2, type, amount) => {
    const out = transformLedger(tx({ source, type, amount, balance_after: '100' }), refs)
    expect(out.ok && out.value).toMatchObject({ source: v2, type, amount: Number(amount), source_id: null })
  })

  it('keeps the earlier keys', () => {
    expect(transformLedger(tx({ source: 'practice' }), refs)).toMatchObject({ ok: true, value: { source: 'quiz_practice' } })
    expect(transformLedger(tx({ source: 'admin_award', type: 'bonus' }), refs)).toMatchObject({ ok: true, value: { source: 'admin_award' } })
  })

  it('rejects an earning row with a debit and a debit source with a credit, never flipping the sign', () => {
    expect(transformLedger(tx({ source: 'daily_challenge', type: 'earn', amount: '-25' }), refs)).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE', column: 'amount' } })
    expect(transformLedger(tx({ source: 'streak_bonus', type: 'bonus', amount: '-25' }), refs)).toMatchObject({ ok: false, reject: { column: 'amount' } })
    expect(transformLedger(tx({ source: 'reward_claim', type: 'spend', amount: '100' }), refs)).toMatchObject({ ok: false, reject: { column: 'amount' } })
    expect(transformLedger(tx({ source: 'reward_claim', type: 'earn', amount: '100' }), refs)).toMatchObject({ ok: false, reject: { column: 'amount' } })
    expect(transformLedger(tx({ source: 'token_conversion', type: 'convert', amount: '400' }), refs)).toMatchObject({ ok: false, reject: { column: 'amount' } })
  })

  it('lets a refund of a debit source credit syiling (the type decides)', () => {
    expect(transformLedger(tx({ source: 'reward_claim', type: 'refund', amount: '100' }), refs)).toMatchObject({ ok: true, value: { amount: 100 } })
    expect(ledgerSourceSignOk('reward_claim', 'refund', 100)).toBe(true)
    expect(ledgerSourceSignOk('reward_claim', 'spend', 100)).toBe(false)
    expect(ledgerSourceSignOk('hadiah_redeem', 'spend', -1)).toBe(true)
  })

  it('rejects an unknown source with UNKNOWN_ENUM and the allowed codes', () => {
    const out = transformLedger(tx({ source: 'token_convert' }), refs)
    expect(out).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'source' } })
  })
})
