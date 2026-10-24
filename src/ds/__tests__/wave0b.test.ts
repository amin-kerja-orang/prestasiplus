// @vitest-environment jsdom
/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { h } from 'vue'

import {
  DsArt3D,
  DsAudioPlayer,
  DsBadgeTile,
  DsGameTile,
  DsHeatGrid,
  DsLeaderRow,
  DsLevelMap,
  DsMediaCard,
  DsPrintSheet,
  DsProse,
  DsShopCard,
  DsThemeScope,
  DsWheel,
} from '@/ds'

const wait = (ms = 30) => new Promise((r) => setTimeout(r, ms))

beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  g.IntersectionObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
    takeRecords() {
      return []
    }
  }
  window.matchMedia ??= ((query: string) => ({
    matches: !query.includes('reduce'),
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  document.body.innerHTML = ''
  vi.useRealTimers()
})

describe('DsLeaderRow', () => {
  it('top three get the lime chip, own row is marked', () => {
    const w = mount(DsLeaderRow, {
      props: { rank: 2, name: 'Murid Contoh', school: 'Sekolah Contoh', points: 1200, own: true },
    })
    expect(w.get('[data-ds="leader-rank"]').classes()).toContain('bg-highlight')
    expect(w.attributes('aria-current')).toBe('true')
    expect(w.text()).toContain('Anda')
    const low = mount(DsLeaderRow, { props: { rank: 7, name: 'x', points: 1 } })
    expect(low.get('[data-ds="leader-rank"]').classes()).toContain('bg-elevated')
  })
})

describe('DsHeatGrid', () => {
  const props = {
    label: 'Penguasaan topik',
    columns: ['Bab 1', 'Bab 2'],
    rows: [{ id: 'a', label: 'Kelas A', cells: [10, 95] }],
  }
  it('prints a percentage in every cell, kobalt ramp for staff', async () => {
    const w = mount(DsThemeScope, {
      props: { personality: 'staff', scheme: 'light' },
      slots: { default: () => h(DsHeatGrid, props) },
    })
    await wait()
    const cells = w.findAll('[data-ds="heat-cell"]')
    expect(cells.map((c) => c.text())).toEqual(['10%', '95%'])
    expect(cells[1]!.classes()).toContain('bg-primary')
  })
  it('bands colour by status and draw one swatch per band plus the empty cell', async () => {
    const w = mount(DsThemeScope, {
      props: { personality: 'staff', scheme: 'light' },
      slots: {
        default: () =>
          h(DsHeatGrid, {
            ...props,
            rows: [{ id: 'a', label: 'Kelas A', cells: [49, 50, 74, 75, null] }],
            columns: ['1', '2', '3', '4', '5'],
            bands: [
              { min: 0, label: 'Lemah' },
              { min: 50, label: 'Sederhana' },
              { min: 75, label: 'Mahir' },
            ],
          }),
      },
    })
    await wait()
    const cells = w.findAll('[data-ds="heat-cell"]').map((c) => c.classes())
    expect(cells[0]).toContain('bg-primary/15')
    expect(cells[1]).toContain('bg-primary/60')
    expect(cells[2]).toContain('bg-primary/60')
    expect(cells[3]).toContain('bg-primary')
    expect(cells[4]).toContain('border-dashed')
    expect(w.findAll('[data-ds="heat-legend"] > li').map((l) => l.text())).toEqual([
      'Mahir',
      'Sederhana',
      'Lemah',
      'Tiada data',
    ])
    expect(w.findAll('[data-ds="heat-legend-swatch"]')).toHaveLength(4)
  })
  it('learner ramp ends in the heat colour', async () => {
    const w = mount(DsThemeScope, {
      props: { personality: 'learner', scheme: 'dark' },
      slots: { default: () => h(DsHeatGrid, props) },
    })
    await wait()
    expect(w.findAll('[data-ds="heat-cell"]')[1]!.classes()).toContain('bg-heat')
  })
})

describe('DsMediaCard', () => {
  it('shows chips, title and progress', () => {
    const w = mount(DsMediaCard, {
      props: { title: 'Pecahan', duration: '4:30', category: 'Matematik', progress: 40, meta: '12 tontonan' },
    })
    expect(w.get('[data-ds="media-title"]').text()).toBe('Pecahan')
    expect(w.text()).toContain('4:30')
    expect(w.find('[role="progressbar"]').exists()).toBe(true)
  })
})

describe('DsProse', () => {
  it('renders html or slot inside the prose scope', () => {
    expect(mount(DsProse, { props: { html: '<h2>Tajuk</h2>' } }).find('h2').exists()).toBe(true)
    expect(mount(DsProse, { slots: { default: '<p>isi</p>' } }).attributes('data-ds')).toBe('prose')
  })
})

describe('DsShopCard', () => {
  it('disabled reason disables the action and is shown as text', async () => {
    const w = mount(DsShopCard, {
      props: { name: 'Pensel', price: 50, actionLabel: 'Tebus', disabledReason: 'Koin tidak cukup' },
    })
    expect(w.get('[data-ds="shop-reason"]').text()).toContain('Koin tidak cukup')
    expect(w.get('button').attributes('disabled')).toBeDefined()
    const ok = mount(DsShopCard, { props: { name: 'Pensel', price: 50, actionLabel: 'Tebus' } })
    await ok.get('button').trigger('click')
    expect(ok.emitted('action')).toHaveLength(1)
  })
})

describe('DsBadgeTile', () => {
  it('states carry a word, new chip shows BARU', () => {
    expect(mount(DsBadgeTile, { props: { state: 'locked', title: 'Juara' } }).text()).toContain('Terkunci')
    const earned = mount(DsBadgeTile, { props: { title: 'Juara', date: '1 Okt 2026', isNew: true } })
    expect(earned.text()).toContain('BARU')
    expect(earned.find('img[data-art]').exists()).toBe(true)
    expect(
      mount(DsBadgeTile, { props: { state: 'progress', title: 'Juara', progress: 30 } }).find(
        '[role="progressbar"]',
      ).exists(),
    ).toBe(true)
  })
})

describe('DsGameTile', () => {
  it('is one button with name, mode and live badge, emits select', async () => {
    const w = mount(DsGameTile, { props: { name: 'Roda Nasib', mode: 'Solo', liveLabel: 'LANGSUNG' } })
    expect(w.text()).toContain('Roda Nasib')
    expect(w.text()).toContain('LANGSUNG')
    await w.trigger('click')
    expect(w.emitted('select')).toHaveLength(1)
  })
})

describe('DsWheel', () => {
  it('spins, then reveals the result', async () => {
    vi.useFakeTimers()
    const w = mount(DsWheel, {
      props: { label: 'Roda', duration: 500 },
      slots: { prize: '<i>roda</i>', result: '<b data-test="r">Hadiah</b>' },
    })
    await w.get('[data-ds="wheel-spin"]').trigger('click')
    expect(w.attributes('data-state')).toBe('spinning')
    expect(w.find('[data-test="r"]').exists()).toBe(false)
    vi.advanceTimersByTime(600)
    await w.vm.$nextTick()
    expect(w.attributes('data-state')).toBe('revealed')
    expect(w.find('[data-test="r"]').exists()).toBe(true)
    expect(w.emitted('revealed')).toHaveLength(1)
  })
})

describe('DsLevelMap', () => {
  it('locked nodes are disabled, states have words, detail under the current node', async () => {
    const w = mount(DsLevelMap, {
      props: {
        label: 'Peta tahap',
        levels: [
          { id: 'a', label: 'Tahap 1', state: 'done' },
          { id: 'b', label: 'Tahap 2', state: 'current' },
          { id: 'c', label: 'Tahap 3', state: 'locked' },
        ],
      },
      slots: { detail: '<p data-test="d">butiran</p>' },
    })
    const buttons = w.findAll('button')
    expect(buttons[2]!.attributes('disabled')).toBeDefined()
    expect(w.text()).toContain('Selesai')
    expect(w.text()).toContain('Sekarang')
    expect(w.text()).toContain('Terkunci')
    expect(w.findAll('[data-test="d"]')).toHaveLength(1)
    await buttons[0]!.trigger('click')
    expect(w.emitted('select')?.[0]).toEqual(['a'])
  })
})

describe('DsAudioPlayer', () => {
  it('Space toggles playback; times are formatted', async () => {
    const play = vi.fn(() => Promise.resolve())
    const pause = vi.fn()
    Object.defineProperty(HTMLMediaElement.prototype, 'paused', { get: () => true, configurable: true })
    HTMLMediaElement.prototype.play = play
    HTMLMediaElement.prototype.pause = pause
    const w = mount(DsAudioPlayer, { props: { src: '/a.mp3', title: 'Dengar', transcript: 'Teks' } })
    expect(w.get('[data-ds="audio-current"]').text()).toBe('0:00')
    await w.trigger('keydown', { key: ' ', code: 'Space' })
    expect(play).toHaveBeenCalled()
    expect(w.get('[data-ds="audio-toggle"]').attributes('aria-label')).toBe('Main')
  })
})

describe('DsPrintSheet', () => {
  it('forces the light scheme and prints via the button', async () => {
    const print = vi.spyOn(window, 'print').mockImplementation(() => {})
    const w = mount(DsPrintSheet, { props: { printLabel: 'Cetak' }, slots: { default: '<p>isi</p>' } })
    expect(w.get('[data-ds="theme-scope"]').attributes('data-scheme')).toBe('light')
    await w.get('button').trigger('click')
    expect(print).toHaveBeenCalled()
  })
})

describe('DsArt3D plain', () => {
  it('renders an ordinary lazy image with alt', () => {
    const w = mount(DsArt3D, { props: { variant: 'plain', src: '/x.png', alt: 'Gambar', ratio: 'video' } })
    expect(w.attributes('src')).toBe('/x.png')
    expect(w.attributes('alt')).toBe('Gambar')
    expect(w.attributes('loading')).toBe('lazy')
    expect(w.classes()).toContain('aspect-video')
  })
})
