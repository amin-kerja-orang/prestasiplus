// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import KirkpatrickReactionPage from '../../../pages/KirkpatrickReactionPage.vue'
import { has, mountPage, reaction, squash, t, tiles } from '../fixtures'

const api = vi.hoisted(() => ({ fetchKirkpatrickReaction: vi.fn() }))
vi.mock('../../../api', () => api)

let wrapper: VueWrapper | undefined

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
  it('shows the four cards and nothing else', async () => {
    const w = await open()
    expect(tiles(w).map((x) => x.label)).toEqual([
      'NPS Pelajar',
      'NPS Guru',
      'NPS Admin',
      'Kepuasan Purata',
    ])
    expect(tiles(w).map((x) => x.value)).toEqual([
      '8.4/10',
      '6.5/10',
      '9.6/10',
      '4.6/5',
    ])
    expect(has(w, 'kirk-filter')).toBe(false)
    expect(w.text()).not.toMatch(/respon/i)
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
