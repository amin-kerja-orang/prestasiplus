import { describe, expect, it } from 'vitest'

import {
  gamAmountClass,
  gamClampPct,
  gamDifficultyLabel,
  gamLedgerIcon,
  gamNextTierPct,
  gamRelativeTime,
  gamSignedAmount,
  gamStageLabel,
  gamTierColor,
  gamTierTextColor,
  gamTierTint,
  gamTrimNumber,
} from '../../lib/student/s11-format'
import { s12CanConvert, s12ParseAmount, s12Tokens } from '../../lib/student/s12-convert'

describe('S11 format helpers', () => {
  it('BR-M14-06: next-tier pct has 1 decimal and is capped at 100', () => {
    expect(gamNextTierPct(256, 500)).toBe(51.2)
    expect(gamNextTierPct(0, 500)).toBe(0)
    expect(gamNextTierPct(900, 500)).toBe(100)
  })

  it('BR-M14-04: accuracy drops trailing zeros', () => {
    expect(gamTrimNumber(48.94)).toBe('48.94')
    expect(gamTrimNumber(35)).toBe('35')
    expect(gamTrimNumber(35.5)).toBe('35.5')
    expect(gamTrimNumber(32.345)).toBe('32.35')
  })

  it('BR-M14-35: relative time under a minute reads "baru sahaja"', () => {
    const now = Date.parse('2026-09-25T15:40:00+08:00')
    expect(gamRelativeTime(now - 20_000, now)).toBe('baru sahaja')
    expect(gamRelativeTime(now - 11 * 60_000, now)).toBe('11 minit yang lepas')
    expect(gamRelativeTime(now - 2 * 3_600_000, now)).toBe('2 jam yang lepas')
    expect(gamRelativeTime(Date.parse('2026-05-19T03:26:00+08:00'), now)).toBe('4 bulan yang lepas')
  })

  it('maps difficulty, ledger icons, amounts and stages', () => {
    expect(gamDifficultyLabel('easy')).toBe('Mudah')
    expect(gamDifficultyLabel('hard')).toBe('Sukar')
    expect(gamDifficultyLabel('Sederhana')).toBe('Sederhana')
    expect(gamLedgerIcon('earn')).toBe('💰')
    expect(gamLedgerIcon('convert')).toBe('🔄')
    expect(gamSignedAmount(25)).toBe('+25')
    expect(gamSignedAmount(-250)).toBe('−250')
    expect(gamSignedAmount(1500)).toBe('+1,500')
    expect(gamAmountClass(-1)).toBe('text-red-500')
    expect(gamAmountClass(1)).toBe('text-green-600')
    expect(gamStageLabel('active')).toBe('Aktif')
    expect(gamStageLabel('Mula Belajar')).toBe('Mula Belajar')
  })

  it('tier colours and tints, clamped bars', () => {
    expect(gamTierColor('bronze')).toBe('#cd7f32')
    expect(gamTierColor('x', '#112233')).toBe('#112233')
    expect(gamTierTint('#cd7f32')).toBe('#cd7f3220')
    expect(gamTierTextColor('gold', '#ffd700')).toBe('#1e293b')
    expect(gamTierTextColor('silver')).toBe('#1e293b')
    expect(gamTierTextColor('platinum')).toBe('#1e293b')
    expect(gamTierTextColor('bronze', '#cd7f32')).toBe('#cd7f32')
    expect(gamClampPct(120)).toBe(100)
    expect(gamClampPct(-3)).toBe(0)
  })
})

describe('S12 conversion rules', () => {
  it('floor(amount / rate)', () => {
    expect(s12Tokens(50, 50)).toBe(1)
    expect(s12Tokens(250, 50)).toBe(5)
    expect(s12Tokens(256, 50)).toBe(5)
    expect(s12Tokens(30, 50)).toBe(0)
    expect(s12Tokens(300, 50)).toBe(6)
    expect(s12Tokens(0, 50)).toBe(0)
  })

  it('valid only between rate and balance, integers', () => {
    expect(s12CanConvert(50, 50, 256)).toBe(true)
    expect(s12CanConvert(256, 50, 256)).toBe(true)
    expect(s12CanConvert(30, 50, 256)).toBe(false)
    expect(s12CanConvert(300, 50, 256)).toBe(false)
    expect(s12CanConvert(60.5, 50, 256)).toBe(false)
    expect(s12CanConvert(null, 50, 256)).toBe(false)
    expect(s12ParseAmount('')).toBeNull()
    expect(s12ParseAmount('250')).toBe(250)
  })
})
