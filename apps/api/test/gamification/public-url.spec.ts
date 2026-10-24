import { describe, expect, it } from 'vitest'

import { DEFAULT_PUBLIC_BASE_URL, publicBaseUrl } from '../../src/common/config/public-base-url'
import { shareUrl } from '../../src/modules/games/leagues/leagues.rules'

const config = (value: string | undefined) => ({ get: () => value }) as never

/** SW10-06: share, register and league links are built on the configured `PUBLIC_BASE_URL`, never on the old system's host. */
describe('publicBaseUrl and the league share text', () => {
  it('uses PUBLIC_BASE_URL without a trailing slash, else the local default', () => {
    expect(publicBaseUrl(config('https://app.example.test'))).toBe('https://app.example.test')
    expect(publicBaseUrl(config('https://app.example.test/'))).toBe('https://app.example.test')
    expect(publicBaseUrl(config('https://app.example.test/base//'))).toBe('https://app.example.test/base')
    expect(publicBaseUrl(config(undefined))).toBe(DEFAULT_PUBLIC_BASE_URL)
  })

  it('the league share text ends with <host>/liga (scheme dropped, as live "prestasiplus.my/liga")', () => {
    const decoded = (url: string) => decodeURIComponent(url.slice('https://wa.me/?text='.length).replace(/\+/g, ' '))
    expect(decoded(shareUrl('Liga Contoh', 'ABCD1234', 'https://app.example.test'))).toBe('Jom sertai Liga Pertandingan "Liga Contoh" di PrestasiPlus! Kod Jemputan: ABCD1234 — app.example.test/liga 🏆')
    expect(decoded(shareUrl('Liga Contoh', 'ABCD1234', 'http://localhost:8080'))).toContain('— localhost:8080/liga 🏆')
    expect(shareUrl('Liga Contoh', 'ABCD1234', 'https://app.example.test')).not.toContain('prestasiplus.my')
  })
})
