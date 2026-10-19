// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import KirkpatrickLearningPage from '../../../pages/KirkpatrickLearningPage.vue'
import { all, flat, has, learning, mountPage, rowOf, squash, t, tiles } from '../fixtures'

const api = vi.hoisted(() => ({ fetchKirkpatrickLearning: vi.fn() }))
vi.mock('../../../api', () => api)

let wrapper: VueWrapper | undefined

async function open(prefix = '/admin/kirkpatrick', query = '') {
  const m = await mountPage(
    KirkpatrickLearningPage,
    { basePath: prefix },
    `${prefix}/learning${query}`,
    `${prefix}/learning`,
  )
  wrapper = m.wrapper
  return m.wrapper
}

beforeEach(() => {
  vi.clearAllMocks()
  api.fetchKirkpatrickLearning.mockResolvedValue(learning())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S3 KPIs and Learning Gain (AC-M12-11.1..11.4)', () => {
  it('shows the six KPI cards', async () => {
    const w = await open()
    expect(tiles(w).map((x) => x.label)).toEqual([
      'Soalan Dijawab',
      'Ketepatan',
      'Skor Purata',
      'Sesi Selesai',
      'Kadar Penyelesaian',
      'Learning Gain',
    ])
    expect(tiles(w).map((x) => x.value)).toEqual([
      '306,133',
      '82.8%',
      '80.3%',
      '20991/20991',
      '100%',
      '-',
    ])
    expect(t(w, 'kirk-kpi-sessions').text()).toContain('/20991')
    expect(t(w, 'kirk-kpi-gain').text()).toContain('Perlu pre/post test')
  })

  it('KPI grid is 2 columns, 3 from md', async () => {
    const w = await open()
    expect(t(w, 'kirk-learning-kpis').classes()).toEqual(
      expect.arrayContaining(['grid-cols-2', 'md:grid-cols-3']),
    )
  })

  it('static Learning Gain card', async () => {
    const w = await open()
    const text = squash(t(w, 'kirk-gain-card').text())
    expect(text).toContain('Pre-Test / Post-Test belum dimulakan')
    expect(text).toContain(
      "Apabila ujian diagnostik dimulakan, Hake's Normalized Learning Gain akan dikira secara automatik.",
    )
    expect(text).toContain(
      'g = (Post - Pre) / (100 - Pre) · High: g≥0.7 · Medium: 0.3≤g<0.7 · Low: g<0.3',
    )
  })

  it('has the tab strip with T2 current and no filter form', async () => {
    const w = await open()
    expect(t(w, 'kirk-tab-learning').attributes('data-active')).toBe('true')
    expect(has(w, 'kirk-filter')).toBe(false)
  })

  it('passes school_id from the URL only', async () => {
    await open('/admin/kirkpatrick', '?school_id=8080')
    expect(api.fetchKirkpatrickLearning).toHaveBeenCalledWith({ schoolId: 8080 }, expect.anything())
  })
})

describe('S3 subjects (AC-M12-12.1..12.3)', () => {
  it('rows: name, 1-decimal label, status pill, plain count; no title, no link', async () => {
    const w = await open()
    const rows = all(w, 'kirk-subject-row')
    expect(rows.map((r) => flat(r))).toEqual([
      'Pendidikan Muzik 100.0% Mastered 20 soalan',
      'Sejarah 76.3% Developing 57695 soalan',
      'Biologi 33.3% Beginning 30 soalan',
    ])
    const bar = (i: number) => rows[i]!.get('[data-testid="kirk-subject-bar"]')
    expect(
      [0, 1, 2].map((i) =>
        ['bg-success', 'bg-warning', 'bg-error'].find((c) => bar(i).html().includes(c)),
      ),
    ).toEqual(['bg-success', 'bg-warning', 'bg-error'])
    expect(bar(1).get('[role="progressbar"]').attributes('aria-valuenow')).toBe('76.3')
    for (const r of rows) {
      expect(r.attributes('title')).toBeUndefined()
      expect(r.find('[title]').exists()).toBe(false)
      expect(r.find('a').exists()).toBe(false)
      expect(r.classes()).not.toContain('cursor-pointer')
    }
    expect(rows[0]!.get('[data-testid="kirk-subject-name"]').classes()).toEqual(
      expect.arrayContaining(['w-24', 'sm:w-40', 'truncate']),
    )
  })
})

describe('S3 school table (AC-M12-13.1..13.3)', () => {
  it('headers, rows, links and accuracy colours', async () => {
    const w = await open()
    expect(
      t(w, 'kirk-schools')
        .findAll('th')
        .map((h) => h.text()),
    ).toEqual(['#', 'Sekolah', 'Pelajar', 'Soalan', 'Ketepatan', 'Skor Purata', 'Subjek'])
    expect(all(w, 'kirk-school-link').map((a) => flat(rowOf(a)))).toEqual([
      '1 SMK Demo A 53 71,408 89.9% 84.7% 5',
      '2 SMK Demo B 184 15,007 55% 73.3% 3',
      '3 SMK Demo C 1 0 0% 0% 1',
    ])
    expect(all(w, 'kirk-school-link').map((a) => a.attributes('href'))).toEqual([
      '/admin/monitoring/sekolah/8880',
      '/admin/monitoring/sekolah/8080',
      '/admin/monitoring/sekolah/940',
    ])
    expect(
      all(w, 'kirk-school-accuracy').map((c) =>
        c.classes().find((k) => ['text-success', 'text-warning', 'text-error'].includes(k)),
      ),
    ).toEqual(['text-success', 'text-warning', 'text-error'])
  })

  it('scrolls inside its card; links follow the guru mount', async () => {
    const w = await open('/guru/kirkpatrick')
    expect(t(w, 'kirk-schools-scroller').attributes('data-ds')).toBe('data-table')
    expect(all(w, 'kirk-school-link')[0]!.attributes('href')).toBe('/guru/monitoring/sekolah/8880')
    expect(t(w, 'kirk-tab-overview').attributes('href')).toBe('/guru/kirkpatrick')
  })
})
