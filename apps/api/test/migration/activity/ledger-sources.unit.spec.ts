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

/**
 * A1-FIX: the codes of the anonymised A1 dump that were rejected UNKNOWN_ENUM. [.cloud source as staged, v2 source, type,
 * a valid signed amount]. A dash in the staged code is folded to `_` by `enumKey`. v2 has no source enum (free text), so the
 * four aliases map to the name v2 writes for the same event and every other code keeps its own value.
 */
const A1_CODES: ReadonlyArray<readonly [string, string, string, string]> = [
  ['jutawan_ilmu', 'jutawan_ilmu', 'earn', '20'],
  ['latihan', 'latihan', 'earn', '10'],
  ['papan_bijak', 'papan_bijak', 'earn', '5'],
  ['memory_game', 'memory_game', 'earn', '5'],
  ['betul_salah', 'betul_salah', 'earn', '5'],
  ['daily_spin', 'daily_spin', 'earn', '5'],
  ['cabaran-harian', 'daily_challenge', 'earn', '25'],
  ['perang_fakta_play', 'perang_fakta_play', 'earn', '5'],
  ['perang_fakta_win', 'perang_fakta_win', 'earn', '15'],
  ['structured_question', 'structured_question', 'earn', '3'],
  ['remedial_quiz', 'remedial_quiz', 'earn', '5'],
  ['quiz', 'quiz', 'earn', '5'],
  ['quiz_complete', 'quiz_complete', 'earn', '12'],
  ['mathrace_play', 'mathrace_play', 'earn', '5'],
  ['mathrace_win', 'mathrace_win', 'earn', '15'],
  ['susun_jawapan', 'susun_jawapan', 'earn', '5'],
  ['crossword_play', 'crossword_play', 'earn', '5'],
  ['crossword_win', 'crossword_win', 'earn', '15'],
  ['homework_chapter', 'homework_chapter', 'earn', '10'],
  ['sambung_kata', 'sambung_kata', 'earn', '5'],
  ['tukar-token', 'token_conversion', 'convert', '-400'],
  ['token_convert', 'token_conversion', 'convert', '-400'],
  ['benteng_play', 'benteng_play', 'earn', '5'],
  ['benteng_win', 'benteng_win', 'earn', '15'],
  ['kotak-misteri', 'mystery_box', 'earn', '30'],
  ['notes_mastery', 'notes_mastery', 'earn', '5'],
  ['papan_bijak_win', 'papan_bijak_win', 'earn', '15'],
  ['tembak_jawapan', 'tembak_jawapan', 'earn', '5'],
  ['speed_challenge', 'speed_challenge', 'earn', '5'],
  ['kuizrelay_play', 'kuizrelay_play', 'earn', '5'],
  ['data_sync', 'data_sync', 'bonus', '50'],
]

describe('A1-FIX ledger sources (one case per code)', () => {
  it.each(A1_CODES)('%s maps to %s (%s, %s)', (source, v2, type, amount) => {
    const out = transformLedger(tx({ source, type, amount, balance_after: '500' }), refs)
    expect(out.ok && out.value).toMatchObject({ source: v2, type, amount: Number(amount), source_id: null, balance_after: 500 })
  })

  it('also accepts the upper-case and spaced forms of a code, as every enum map does', () => {
    expect(transformLedger(tx({ source: ' Cabaran-Harian ' }), refs)).toMatchObject({ ok: true, value: { source: 'daily_challenge' } })
    expect(transformLedger(tx({ source: 'KOTAK MISTERI' }), refs)).toMatchObject({ ok: true, value: { source: 'mystery_box' } })
  })

  it('keeps the ledger sums: the amount and balance_after are copied, never changed by the source map', () => {
    for (const [source, , type, amount] of A1_CODES) {
      const out = transformLedger(tx({ source, type, amount, balance_after: '777' }), refs)
      expect(out.ok && [out.value.amount, out.value.balance_after]).toEqual([Number(amount), 777])
    }
  })

  it('the aliased debit source token_conversion still rejects a credit row, never flipping the sign', () => {
    expect(transformLedger(tx({ source: 'tukar-token', type: 'convert', amount: '400' }), refs)).toMatchObject({ ok: false, reject: { column: 'amount' } })
    expect(transformLedger(tx({ source: 'token_convert', type: 'convert', amount: '400' }), refs)).toMatchObject({ ok: false, reject: { column: 'amount' } })
  })

  it('an unmapped code is still UNKNOWN_ENUM', () => {
    expect(transformLedger(tx({ source: 'kod_tidak_dikenali' }), refs)).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'source' } })
  })
})

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
    const out = transformLedger(tx({ source: 'kod_tidak_dikenali' }), refs)
    expect(out).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'source' } })
  })
})
