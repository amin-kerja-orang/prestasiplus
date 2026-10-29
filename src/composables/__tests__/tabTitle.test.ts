import { describe, expect, it } from 'vitest'

import { cleanPageName, formatTabTitle } from '../tabTitle'

describe('formatTabTitle', () => {
  it('formats a plain page name', () => {
    expect(formatTabTitle('Log Masuk')).toBe('Log Masuk | PRESTASIPLUS')
  })

  it.each([
    ['Bijak SPM - PRESTASIPLUS', 'Bijak SPM | PRESTASIPLUS'],
    ['Ringkasan Eksekutif | PRESTASIPLUS', 'Ringkasan Eksekutif | PRESTASIPLUS'],
    ['Soalan — PRESTASIPLUS', 'Soalan | PRESTASIPLUS'],
    ['Tahap 1: Reaksi — Kirkpatrick', 'Tahap 1: Reaksi | PRESTASIPLUS'],
    ['Urus Sekolah - Admin PRESTASIPLUS', 'Urus Sekolah | PRESTASIPLUS'],
    ['Pelajar Komplimen - Admin Panel', 'Pelajar Komplimen | PRESTASIPLUS'],
    ['PRESTASIPLUS COMMAND CENTER', 'COMMAND CENTER | PRESTASIPLUS'],
    ['PRESTASIPLUS - Bank Soalan', 'Bank Soalan | PRESTASIPLUS'],
    ['  Papan   Pemuka  ', 'Papan Pemuka | PRESTASIPLUS'],
  ])('strips legacy affixes: %s', (raw, expected) => {
    expect(formatTabTitle(raw)).toBe(expected)
  })

  it('never yields the brand alone', () => {
    expect(formatTabTitle('')).toBe('Halaman | PRESTASIPLUS')
    expect(formatTabTitle(null)).toBe('Halaman | PRESTASIPLUS')
    expect(formatTabTitle('PRESTASIPLUS')).toBe('Halaman | PRESTASIPLUS')
  })

  it('is idempotent', () => {
    const once = formatTabTitle('Bank Soalan')
    expect(formatTabTitle(once)).toBe(once)
    expect(cleanPageName(once)).toBe('Bank Soalan')
  })
})
