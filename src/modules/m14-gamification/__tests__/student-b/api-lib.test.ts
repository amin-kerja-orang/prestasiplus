import { describe, expect, it, vi } from 'vitest'

import type { PodiumEntry } from '../../api'
import {
  RARITY_PILLS,
  achievementFileName,
  achievementShareText,
  progressPct,
  rarityGradient,
  readRarity,
  streakBonusLabel,
} from '../../lib/student/achievements-lib'
import {
  KAD_TABS,
  kadFileName,
  komboText,
  masteryGradient,
  masteryText,
  pct1,
  profilText,
  rankingText,
  tierName,
} from '../../lib/student/kadkongsi-lib'
import { podiumSlots } from '../../lib/student/leaderboard-lib'
import {
  downloadCard,
  profileUrlOf,
  setCardDownloader,
  waUrl,
  withProfileLink,
} from '../../lib/student/studentb-share'

describe('leaderboard-lib', () => {
  const entry = (rank: number): PodiumEntry => ({
    rank,
    userId: rank,
    name: `Pelajar ${String(rank)}`,
    initials: 'P',
    totalSyilingEarned: 100 - rank,
    tier: { key: 'platinum', labelMs: 'Platinum', icon: '💎' },
  })

  it('orders the podium silver, gold (raised), bronze', () => {
    const slots = podiumSlots([entry(1), entry(2), entry(3)])
    expect(slots.map((s) => s.entry.rank)).toEqual([2, 1, 3])
    expect(slots.map((s) => s.medal)).toEqual(['🥈', '🥇', '🥉'])
    expect(slots.map((s) => s.raised)).toEqual([false, true, false])
  })

  it('leaves out a missing rank', () => {
    expect(podiumSlots([entry(1), entry(3)]).map((s) => s.entry.rank)).toEqual([1, 3])
  })
})

describe('achievements-lib', () => {
  it('has the five rarity pills with the live labels', () => {
    expect(RARITY_PILLS.map((p) => p.label)).toEqual([
      'Semua',
      'Biasa',
      'Jarang',
      'Epik',
      'Legenda',
    ])
    expect(RARITY_PILLS.map((p) => p.value)).toEqual([null, 'common', 'rare', 'epic', 'legendary'])
  })

  it('reads the rarity query as the first string, empty as none', () => {
    expect(readRarity('epic')).toBe('epic')
    expect(readRarity(['rare', 'epic'])).toBe('rare')
    expect(readRarity('')).toBeNull()
    expect(readRarity(undefined)).toBeNull()
    expect(readRarity('zzz')).toBe('zzz')
  })

  it('formats the bonus label and the progress width', () => {
    expect(streakBonusLabel(1)).toBe('1.0x Bonus')
    expect(progressPct({ value: 0, target: 10 })).toBe(0)
    expect(progressPct({ value: 5, target: 10 })).toBe(50)
    expect(progressPct({ value: 15, target: 10 })).toBe(100)
    expect(progressPct({ value: 1, target: 0 })).toBe(0)
  })

  it('names the file and builds the WhatsApp text', () => {
    expect(achievementFileName('Langkah Pertama')).toBe('pencapaian-langkah-pertama.png')
    expect(achievementShareText('Langkah Pertama', 'https://prestasiplus.my/pelajar/3')).toBe(
      '🏅 Saya baru capai "Langkah Pertama" di PRESTASIPLUS! 🎉\n\nJom latih tubi sama-sama:\nhttps://prestasiplus.my/pelajar/3',
    )
  })

  it('uses the live gradients and falls back to common', () => {
    expect(rarityGradient('legendary')).toContain('via-amber-400')
    expect(rarityGradient('rare')).toContain('from-blue-600')
    expect(rarityGradient('unknown')).toBe(rarityGradient('common'))
  })
})

describe('kadkongsi-lib', () => {
  it('formats the percent with one decimal and drops ".0"', () => {
    expect(pct1(38.7)).toBe('38.7')
    expect(pct1(35)).toBe('35')
    expect(pct1(48.94)).toBe('48.9')
    expect(pct1(38.66)).toBe('38.7')
  })

  it('capitalises the English tier key', () => {
    expect(tierName('bronze')).toBe('Gangsa')
  })

  it('builds the four card texts (DV-M14-03 inserts the ranking value)', () => {
    expect(profilText(38.7, 119)).toBe(
      'Lihat profil saya di PRESTASIPLUS! 38.7% ketepatan dengan 119 soalan dijawab.',
    )
    expect(komboText(1, 5)).toBe(
      '🔥 Kombo 1 hari berturut-turut di PRESTASIPLUS! Rekod terbaik: 5 hari. Jom cabaran!',
    )
    expect(masteryText(2, 'Aktif', 'Bahasa Melayu', 48.94)).toBe(
      '🧠 Saya sudah capai Level 2 (Aktif) dalam Bahasa Melayu di PRESTASIPLUS! Ketepatan 48.9%. Jom bersaing!',
    )
    expect(rankingText(38.7)).toBe('🏆 Kedudukan saya di PRESTASIPLUS: 38.7%! Jom latih tubi!')
  })

  it('names the card files and lists the four tabs in order', () => {
    expect(kadFileName('penguasaan-1')).toBe('prestasiplus-penguasaan-1.png')
    expect(KAD_TABS.map((t) => t.label)).toEqual(['Profil', 'Kombo', 'Penguasaan', 'Kedudukan'])
    expect(KAD_TABS.map((t) => t.id)).toEqual(['profil', 'kombo', 'penguasaan', 'ranking'])
  })

  it('colours the mastery card by level (L1 grey, L2 blue observed)', () => {
    expect(masteryGradient(1)).toContain('gray')
    expect(masteryGradient(2)).toContain('blue')
  })
})

describe('studentb-share', () => {
  it('builds wa.me links with the profile URL appended after a blank line', () => {
    const url = waUrl(withProfileLink('Halo', profileUrlOf(1)))
    expect(url).toBe(
      `https://wa.me/?text=${encodeURIComponent('Halo\n\nhttps://prestasiplus.my/pelajar/1')}`,
    )
  })

  it('routes the card download through the installed downloader (default: html2canvas capture)', async () => {
    const spy = vi.fn(() => Promise.resolve())
    setCardDownloader(spy)
    await downloadCard(null, 'prestasiplus-profil.png')
    expect(spy).toHaveBeenCalledWith(null, 'prestasiplus-profil.png')
    setCardDownloader(null)
  })
})
