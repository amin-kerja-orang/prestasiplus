/**
 * S6 card data (SRS M16 v1.6 FR-M16-52; URS FN-M16-4.1.3..4.1.11; discovery A.3): 18 cards in live order,
 * exact route per card, badge pairs, chips and the D21 reach rule (every card route is one the M16 SRS §2
 * names).
 */

import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { buildRoutes } from '@/app/router'
import { resolveIcon } from '@/components/icon'

import { HUB_CARDS } from '../../components/hub/hub-cards'
import { ROOM_GAMES } from '../../components/lobby/lobby-config'

/** Discovery A.3 order and targets. */
const EXPECTED: [string, string, string][] = [
  ['Papan Bijak', 'Main Sekarang', '/papan-bijak'],
  ['Battle Arena', 'Battle!', '/battle'],
  ['Perang Fakta', 'Main!', '/perang-fakta'],
  ['Benteng Ilmu', 'Duel!', '/benteng-ilmu'],
  ['Perlumbaan Matematik', 'Lumba!', '/perlumbaan-matematik'],
  ['Kuiz Relay', 'Main!', '/kuiz-relay'],
  ['Teka Silang Kata', 'Main!', '/teka-silang-kata'],
  ['Betul atau Salah', 'Mula', '/permainan/betul-salah'],
  ['Roda Nasib', 'Spin Sekarang!', '/permainan/roda-nasib'],
  ['Pertandingan Mingguan', 'Lihat Ranking', '/permainan/pertandingan'],
  ['Peta Pengembaraan', 'Jelajah', '/peta-belajar'],
  ['Uji Minda', 'Mula', '/permainan/uji-minda'],
  ['Cabaran Kilat', 'Mula!', '/permainan/cabaran-kilat'],
  ['Jutawan Ilmu', 'Main!', '/permainan/jutawan'],
  ['Susun Jawapan', 'Susun!', '/permainan/susun-jawapan'],
  ['Tembak Jawapan', 'Tembak!', '/permainan/tembak-jawapan'],
  ['Sambung Kata', 'Mula!', '/permainan/sambung-kata'],
  ['Kad Memori', 'Main!', '/permainan/kad-memori'],
]

describe('S6 hub card data', () => {
  it('has the 18 cards in live order with their button text and route', () => {
    expect(HUB_CARDS.map((c) => [c.title, c.button, c.to])).toEqual(EXPECTED)
  })

  it('keeps the observed badges', () => {
    const badges = HUB_CARDS.map((c) => c.badge ?? null)
    expect(badges).toEqual([
      null,
      '🔥 HOT',
      '👥 MULTIPLAYER',
      '👥 MULTIPLAYER',
      '👥 MULTIPLAYER',
      '👥 MULTIPLAYER',
      '👥 MULTIPLAYER',
      '✅❌ BARU!',
      '📅 HARIAN',
      '📅 MINGGUAN',
      null,
      '👨‍👩‍👧 IBU BAPA',
      '⚡ BARU!',
      '💰 BARU!',
      '🧩 BARU!',
      '🎯 BARU!',
      '🔗 BARU!',
      '🧠 HOT!',
    ])
  })

  it('keeps the exact chips (copy kept as live, DV-M16-21/22/23)', () => {
    const chips = Object.fromEntries(HUB_CARDS.map((c) => [c.title, c.chips.map((x) => x.text)]))
    expect(chips['Papan Bijak']).toEqual(['🆕 Belum main lagi'])
    expect(chips['Battle Arena']).toEqual(['🆕 Belum battle lagi'])
    expect(chips['Perang Fakta']).toEqual(['👥 2-6 Pemain', '⚡ 10 Saat'])
    expect(chips['Jutawan Ilmu']).toEqual(['📚 Semua Subjek', '🏆 1000🪙'])
    expect(chips['Kad Memori']).toEqual(['🃏 6 Pasangan', '🧠 Ingatan'])
    expect(HUB_CARDS.find((c) => c.title === 'Kad Memori')?.text).toContain('sebelum masa habis')
  })

  it('flags only the Papan Bijak and Battle chips as conditional (DV-M16-14)', () => {
    const conditional = HUB_CARDS.flatMap((c) => c.chips.filter((x) => x.unlessFlag)).map(
      (x) => x.unlessFlag,
    )
    expect(conditional).toEqual(['papanBijakPlayed', 'battled'])
  })

  it('has unique ids and every text node class at least 12 px (no text-[..px] below 12)', () => {
    expect(new Set(HUB_CARDS.map((c) => c.id)).size).toBe(HUB_CARDS.length)
    for (const c of HUB_CARDS) expect(c.badgeClass ?? '').not.toMatch(/text-\[(\d|1[01])px\]/)
  })
})

describe('S6 card icons', () => {
  it('keeps the live classes for the two unmapped rows', () => {
    expect(HUB_CARDS.find((c) => c.id === 'perang-fakta')?.icon).toBe('fa-fist-raised')
    expect(HUB_CARDS.find((c) => c.id === 'teka-silang-kata')?.icon).toBe('fa-pencil-alt')
  })

  it.each(HUB_CARDS.map((c) => [c.title, c.icon]))(
    '%s (%s) resolves to an icon with an empty lazy index',
    (_title, icon) => {
      expect(resolveIcon(icon, null).kind).toBe('icon')
    },
  )
})

describe('S6 → room game routes (D21 reach rule)', () => {
  const router = createRouter({ history: createMemoryHistory(), routes: buildRoutes() })

  it('registers /permainan with the DV-M16-01 header and the live tab title', () => {
    const r = router.resolve('/permainan')
    expect(r.name).toBe('m16.permainan')
    expect(r.meta.title).toBe('Permainan — PRESTASIPLUS')
    expect(r.meta.header).toEqual({ title: 'Zona Permainan', subtitle: 'Selamat datang kembali' })
    expect(r.meta.layout).toBe('user')
    expect(r.meta.roles).toBeUndefined()
  })

  it.each(ROOM_GAMES)(
    'the hub card for %s resolves to its lobby (not the 404 catch-all)',
    (game) => {
      expect(HUB_CARDS.some((c) => c.to === `/${game}`)).toBe(true)
      expect(router.resolve(`/${game}`).name).not.toBe('core.not-found')
      expect(router.resolve(`/${game}/ABC123`).name).toBe(`m16.room.${game}`)
    },
  )
})
