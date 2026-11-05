// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import KirkpatrickReactionPage from '../../../pages/KirkpatrickReactionPage.vue'
import { has, mountPage, reaction, reactionEmpty, squash, t, tiles } from '../fixtures'

const api = vi.hoisted(() => ({ fetchKirkpatrickReaction: vi.fn() }))
vi.mock('../../../api', () => api)

let wrapper: VueWrapper | undefined

/** The four stat cards at the top (the section tiles are read by their own section). */
const cards = (w: VueWrapper) => tiles(w).slice(0, 4)

async function open(prefix = '/admin/kirkpatrick', query = '') {
  const m = await mountPage(
    KirkpatrickReactionPage,
    { basePath: prefix },
    `${prefix}/reaction${query}`,
    `${prefix}/reaction`,
  )
  wrapper = m.wrapper
  return m.wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchKirkpatrickReaction.mockResolvedValue(reaction)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S2 T1 Reaksi (AC-M12-10.1, 10.2, 01.3)', () => {
  it('shows the four stat cards, Kepuasan Purata with its respons count', async () => {
    const w = await open()
    expect(cards(w).map((x) => x.label)).toEqual([
      'NPS Pelajar',
      'NPS Guru',
      'NPS Admin',
      'Kepuasan Purata',
    ])
    expect(cards(w).map((x) => x.value)).toEqual([
      '8.4/10',
      '6.5/10',
      '9.6/10',
      '4.6/5',
    ])
    expect(has(w, 'kirk-filter')).toBe(false)
  })

  it('shows the six tabs with T1 current and no "Rantaian Impak"', async () => {
    const w = await open()
    const tabs = t(w, 'kirk-tabs').findAll('a')
    expect(tabs.map((a) => squash(a.text()))).toEqual([
      'Overview',
      'Tahap 1: Reaksi',
      'Tahap 2: Pembelajaran',
      'Tahap 3: Tingkah Laku',
      'Tahap 4: Hasil',
      'Intervensi',
    ])
    expect(tabs.map((a) => a.attributes('href'))).toEqual([
      '/admin/kirkpatrick',
      '/admin/kirkpatrick/reaction',
      '/admin/kirkpatrick/learning',
      '/admin/kirkpatrick/behavior',
      '/admin/kirkpatrick/results',
      '/admin/kirkpatrick/interventions',
    ])
    const current = tabs.filter((a) => a.attributes('data-active') === 'true')
    expect(current).toHaveLength(1)
    expect(current[0]!.attributes('data-testid')).toBe('kirk-tab-reaction')
  })

  it('tabs are unfiltered even with ?school_id and the call carries no scope', async () => {
    const w = await open('/guru/kirkpatrick', '?school_id=8080')
    expect(t(w, 'kirk-tab-learning').attributes('href')).toBe('/guru/kirkpatrick/learning')
    expect(api.fetchKirkpatrickReaction).toHaveBeenCalledTimes(1)
    expect(api.fetchKirkpatrickReaction).toHaveBeenCalledWith({ signal: expect.anything() })
  })

  it('grid is 2 columns, 3 from md and 4 from xl', async () => {
    const w = await open()
    expect(t(w, 'kirk-reaction-cards').classes()).toEqual(
      expect.arrayContaining(['grid-cols-2', 'md:grid-cols-3', 'xl:grid-cols-4']),
    )
  })
})

describe('R1-AS-11 Tahap 1 sections', () => {
  it('"Kepuasan Purata" reads "{x}/5" with the caption "{n} respons"', async () => {
    const w = await open()
    const card = cards(w).find((x) => x.label === 'Kepuasan Purata')
    expect(card?.value).toBe('4.6/5')
    expect(t(w, 'kirk-satisfaction').text()).toContain('336 respons')
  })

  it('"Butiran Maklum Balas" has the six tiles', async () => {
    const w = await open()
    const section = t(w, 'rea-feedback')
    expect(section.get('h2').text()).toBe('Butiran Maklum Balas')
    const text = squash(section.text())
    for (const label of [
      'Jumlah Respons',
      'Mudah Diguna',
      'Relevan',
      'Promoter (9–10)',
      'Detractor (0–6)',
      'Komen Bertulis',
    ]) {
      expect(text).toContain(label)
    }
    expect(text).toContain('4.8/5')
    expect(text).toContain('4.5/5')
  })

  it('"Taburan Mood" shows the four tiles and the table Mood / Bilangan / Peratus', async () => {
    const w = await open()
    const section = t(w, 'rea-mood')
    expect(section.get('h2').text()).toBe('Taburan Mood')
    const text = squash(section.text())
    for (const label of ['Jumlah Check-in', 'Pelajar Terlibat', 'Mood Positif', 'Check-in 7 Hari']) {
      expect(text).toContain(label)
    }
    expect(text).toContain('5/20')
    expect(text).toContain('77%')
    expect(text).toContain('Gembira + Okay')
    expect(section.findAll('thead th').map((h) => h.text())).toEqual(['Mood', 'Bilangan', 'Peratus'])
    expect(section.findAll('tbody tr')).toHaveLength(4)
    expect(has(w, 'rea-mood-empty')).toBe(false)
  })

  it('"Komen Terkini" lists the comments with Komen / NPS / Kepuasan / Tarikh', async () => {
    const w = await open()
    const section = t(w, 'rea-comments')
    expect(section.get('h2').text()).toBe('Komen Terkini')
    expect(section.findAll('thead th').map((h) => h.text())).toEqual([
      'Komen',
      'NPS',
      'Kepuasan',
      'Tarikh',
    ])
    const rows = section
      .findAll('tbody tr')
      .map((r) => r.findAll('td').map((c) => squash(c.text())))
    expect(rows).toEqual([
      ['Mudah digunakan', '9', '5', '24 Sep 2026'],
      ['Boleh ditambah baik', '—', '4', '02 Sep 2026'],
    ])
  })

  it('with no feedback: Kepuasan Purata is "—" with "Belum ada mood check-in", the tiles are "—", the comments list is empty', async () => {
    api.fetchKirkpatrickReaction.mockResolvedValue(reactionEmpty)
    const w = await open()
    const card = cards(w).find((x) => x.label === 'Kepuasan Purata')
    expect(card?.value).toBe('—')
    expect(squash(t(w, 'kirk-satisfaction').text())).toContain('Belum ada mood check-in')
    const feedback = squash(t(w, 'rea-feedback').text())
    expect(feedback).toContain('Jumlah Respons')
    expect(feedback).not.toContain('/5')
    expect(squash(t(w, 'rea-comments-empty').text())).toBe('Tiada komen bertulis lagi.')
    expect(has(w, 'rea-comments-table')).toBe(false)
  })

  it('without mood check-ins "Taburan Mood" shows the empty state instead of the tiles and the table', async () => {
    api.fetchKirkpatrickReaction.mockResolvedValue(reactionEmpty)
    const w = await open()
    const empty = squash(t(w, 'rea-mood-empty').text())
    expect(empty).toContain('Belum ada mood check-in')
    expect(empty).toContain('Pelajar perlu check-in mood harian untuk mengukur reaksi (T1).')
    expect(squash(t(w, 'rea-mood').text())).not.toContain('Jumlah Check-in')
    expect(t(w, 'rea-mood').find('table').exists()).toBe(false)
  })

  it('does not scope the call by the page query and works on the school-admin mount', async () => {
    const w = await open('/admin-sekolah/kirkpatrick', '?school_id=8080')
    expect(t(w, 'kirk-tab-learning').attributes('href')).toBe('/admin-sekolah/kirkpatrick/learning')
    expect(api.fetchKirkpatrickReaction).toHaveBeenCalledWith({ signal: expect.anything() })
  })
})
