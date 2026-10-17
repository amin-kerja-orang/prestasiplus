// @vitest-environment jsdom
import { DOMWrapper, flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'

import CommandCenterPage from '../../pages/CommandCenterPage.vue'
import {
  ACHIEVEMENTS,
  EMPTY_PREDICTIVE,
  EVALUATION,
  live,
  PREDICTIVE,
  SCAN,
  TEACHER_LIVE,
} from './fixtures'

const api = vi.hoisted(() => ({
  COMMAND_CENTER_POLL_MS: 10_000,
  fetchCommandCenterLiveData: vi.fn(),
  fetchCommandCenterDrill: vi.fn(),
  fetchRemedialScan: vi.fn(),
  generateRemedialTest: vi.fn(),
  cancelRemedialTest: vi.fn(),
  fetchCommandCenterPredictive: vi.fn(),
  fetchCommandCenterEvaluation: vi.fn(),
  fetchCommandCenterAchievements: vi.fn(),
  fetchBadgeHolders: vi.fn(),
}))
vi.mock('../../api/command-center', () => api)

let router: Router
let wrapper: VueWrapper | undefined

async function mountPage() {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/guru/command-center')
  await router.isReady()
  wrapper = mount(CommandCenterPage, {
    global: { plugins: [router] },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

/** Dialogs are portalled to the body, so everything is looked up there. */
const wrap = (e: Element) => {
  const w = new DOMWrapper(e)
  const trigger = w.trigger.bind(w)
  // the portalled dialog mounts a few ticks after a click
  w.trigger = (async (...a: Parameters<typeof trigger>) => {
    await trigger(...a)
    await flushPromises()
  })
  return w
}
const q = (sel: string) => Array.from(document.body.querySelectorAll(sel)).map(wrap)
const t = (id: string) => q(`[data-testid="${id}"]`)[0] ?? wrapper!.find(`[data-testid="${id}"]`)
const all = (id: string) => q(`[data-testid="${id}"]`)
const cards = () =>
  all('cc-modal-card').map((c) =>
    Array.from(c.element.querySelectorAll('span'))
      .map((s) => s.textContent)
      .join(' '),
  )
const text = (id: string) => t(id).text().replace(/\s+/g, ' ')
const modalTitle = () => q('[data-slot="title"]')[0]!.text()
/** The table row of an element that sits in its first cell (the DS table gives rows no test id). */
const trOf = (w: { element: Element }) => new DOMWrapper(w.element.closest('tr'))
const cellTone = (w: { element: Element }, i: number) =>
  w.element.closest('tr')!.querySelectorAll('td')[i]!.querySelector('span')!.className

/** Runs the 600 ms count animation of the two tiles to its end. */
async function settle() {
  await vi.advanceTimersByTimeAsync(700)
  await flushPromises()
}

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-09-25T15:40:00+08:00'))
  vi.clearAllMocks()
  api.fetchCommandCenterLiveData.mockResolvedValue(TEACHER_LIVE)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  document.body.innerHTML = ''
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('S2 board (FR-M10-14..18)', () => {
  it('sets the tab title from the teacher name and ticks the MYT clock', async () => {
    await mountPage()
    expect(document.title).toBe('Command Center — Guru: Guru Demo')
    expect(text('cc-clock')).toBe('15:40:00')
    await vi.advanceTimersByTimeAsync(3000)
    expect(text('cc-clock')).toBe('15:40:03')
    expect(text('cc-title')).toBe('Command Center')
    expect(text('cc-live-badge')).toBe('LIVE')
  })

  it('renders the six top links, in live order with the Rekod href', async () => {
    await mountPage()
    const labels = t('cc-links')
      .findAll('a, button')
      .map((a) => a.text())
    expect(labels).toEqual(['Remedial', 'Rekod', 'Evaluate', 'Ramalan SPM', 'Kelas', 'Badges'])
    expect(t('cc-link-rekod').attributes('href')).toBe('/guru/remedial-progress')
    expect(t('cc-back').attributes('href')).toBe('/guru')
    expect(text('cc-back')).toBe('Dashboard')
  })

  it('shows the KPI values of the teacher after the count animation', async () => {
    await mountPage()
    await settle()
    const values = all('cc-kpi-value').map((v) => v.text())
    expect(values).toEqual(['8', '1,283', '46%', '4.69'])
    expect(all('cc-kpi-sub').map((s) => s.text())).toEqual([
      '0 aktif menjawab',
      'sepanjang masa',
      'keseluruhan sekolah',
      'purata GPS',
    ])
  })

  it('keeps "--" on the two count tiles while the value is 0, "0%" and 4.69 for the admin mirror', async () => {
    api.fetchCommandCenterLiveData.mockResolvedValue(live({ gpsOverall: 4.69, kirkT4Gps: 4.69 }))
    await mountPage()
    await settle()
    expect(all('cc-kpi-value').map((v) => v.text())).toEqual(['--', '--', '0%', '4.69'])
    expect(text('cc-insight')).toBe(
      '"0% pelajar terlibat aktif. Ketepatan purata 0%. GPS sekolah: 4.69."',
    )
    expect(text('cc-classes-empty')).toBe('Tiada data')
    expect(text('cc-feed-empty')).toBe('Tiada aktiviti terkini')
    expect(text('cc-leaderboard-empty')).toBe('Tiada data minggu ini')
    expect(text('cc-engagement-total')).toBe('Jumlah: 0 pelajar')
    expect(text('cc-week-change')).toBe('Sama dengan minggu lepas')
    expect(all('cc-kirk-text').map((v) => v.text())).toEqual([
      '☆☆☆☆☆ 0/10',
      '0% ketepatan',
      '0 aktif 30h',
      'GPS 4.69',
    ])
    expect(all('cc-mood-count').map((v) => v.text())).toEqual(['0', '0', '0', '0'])
  })

  it('animates a tile from the previous raw value', async () => {
    api.fetchCommandCenterLiveData
      .mockResolvedValueOnce(live({ totalStudents: '8', totalStudentsRaw: 8 }))
      .mockResolvedValue(live({ totalStudents: '16', totalStudentsRaw: 16 }))
    await mountPage()
    await settle()
    expect(all('cc-kpi-value')[0]!.text()).toBe('8')
    await vi.advanceTimersByTimeAsync(9_300)
    await flushPromises()
    await vi.advanceTimersByTimeAsync(200)
    const mid = all('cc-kpi-value')[0]!.text()
    expect(Number(mid)).toBeGreaterThanOrEqual(8)
    expect(Number(mid)).toBeLessThan(16)
    await settle()
    expect(all('cc-kpi-value')[0]!.text()).toBe('16')
  })

  it('renders the panels of the teacher (classes, Kirkpatrick, mood, activity, feed, leaderboard, engagement)', async () => {
    await mountPage()
    const rows = all('cc-class-row')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.find('[data-testid="cc-class-name"]').text()).toBe('Kimia 5 Alpha')
    expect(rows[0]!.find('[data-testid="cc-class-level"]').text()).toBe('tingkatan-5')
    expect(rows[0]!.find('[data-testid="cc-class-stats"]').text()).toBe('8 plj | 6 aktif | 46%')
    expect(rows[0]!.attributes('title')).toBe('Klik: lihat pelajar dalam kelas')
    // t1 7.5 / 10 -> round(3.75) = 4 stars
    expect(all('cc-kirk-text').map((v) => v.text())).toEqual([
      '★★★★☆ 7.5/10',
      '46% ketepatan',
      '8 aktif 30h',
      'GPS 4.69',
    ])
    expect(all('cc-mood-count').map((v) => v.text())).toEqual(['1', '2', '0', '3'])
    expect(text('cc-activity-today')).toBe('0 soalan')
    expect(text('cc-activity-week')).toBe('36')
    expect(text('cc-week-change')).toBe('▼ 23% vs minggu lepas')
    expect(all('cc-feed-row')).toHaveLength(2)
    expect(all('cc-leaderboard-row')[0]!.text()).toContain('1')
    expect(all('cc-leaderboard-row')[3]!.text()).toContain('4')
    expect(all('cc-leaderboard-row')[0]!.text()).toContain('20 jwb')
    expect(all('cc-band-count').map((c) => c.text())).toEqual(['0', '1', '5', '2', '0'])
    expect(text('cc-engagement-total')).toBe('Jumlah: 8 pelajar')
    // (0 + 1 + 5) / 8 = 75%
    expect(text('cc-insight')).toBe(
      '"75% pelajar terlibat aktif. Ketepatan purata 46%. GPS sekolah: 4.69."',
    )
    expect(text('cc-footer')).toBe(
      'Powered by ALESA AI · PrestasiPlus © 2026 · Data dikemaskini setiap 10 saat',
    )
    expect(t('cc-recent-badges').text()).toContain('Murid Demo 02 — Pemula Rajin')
  })

  it('opens a student page in a new tab from a feed row and a class page from a class row', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    await mountPage()
    await all('cc-feed-row')[0]!.trigger('click')
    expect(open).toHaveBeenLastCalledWith('/guru/command-center/student/3002', '_blank', 'noopener')
    await all('cc-class-row')[1]!.trigger('click')
    expect(open).toHaveBeenLastCalledWith(
      '/guru/command-center/classroom/2002',
      '_blank',
      'noopener',
    )
    await all('cc-leaderboard-row')[0]!.trigger('click')
    expect(open).toHaveBeenLastCalledWith('/guru/command-center/student/3007', '_blank', 'noopener')
  })
})

describe('polling (FR-M10-15, NFR-M10-02)', () => {
  it('calls live-data on load and every 10 s, and stops when the page is left', async () => {
    await mountPage()
    expect(api.fetchCommandCenterLiveData).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(10_000)
    expect(api.fetchCommandCenterLiveData).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(20_000)
    expect(api.fetchCommandCenterLiveData).toHaveBeenCalledTimes(4)
    wrapper!.unmount()
    wrapper = undefined
    await vi.advanceTimersByTimeAsync(30_000)
    expect(api.fetchCommandCenterLiveData).toHaveBeenCalledTimes(4)
  })

  it('skips a tick while a request is still in flight, so a slow response still lands', async () => {
    let release!: (v: unknown) => void
    api.fetchCommandCenterLiveData.mockReturnValueOnce(new Promise((r) => (release = r)))
    await mountPage()
    await vi.advanceTimersByTimeAsync(25_000)
    expect(api.fetchCommandCenterLiveData).toHaveBeenCalledTimes(1)
    release(TEACHER_LIVE)
    await settle()
    expect(all('cc-kpi-value')[0]!.text()).toBe('8')
    await vi.advanceTimersByTimeAsync(10_000)
    expect(api.fetchCommandCenterLiveData).toHaveBeenCalledTimes(2)
  })

  it('keeps the previous values when a poll fails and logs "Fetch error:"', async () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => undefined)
    await mountPage()
    await settle()
    api.fetchCommandCenterLiveData.mockRejectedValue(new Error('down'))
    await vi.advanceTimersByTimeAsync(10_000)
    await flushPromises()
    expect(all('cc-kpi-value')[0]!.text()).toBe('8')
    expect(all('cc-class-row')).toHaveLength(2)
    expect(log).toHaveBeenCalledWith('Fetch error:', expect.any(Error))
  })

  it('shows the initial zero board when the first load fails', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined)
    api.fetchCommandCenterLiveData.mockRejectedValue(new Error('down'))
    await mountPage()
    expect(all('cc-kpi-value').map((v) => v.text())).toEqual(['--', '--', '0%', '--'])
  })
})

describe('drill modal (FR-M10-19, FN-M10-2.2.7)', () => {
  it('shows "Memuatkan..." and "Memuatkan data...", then the response title and "Tiada data"', async () => {
    let resolve!: (v: unknown) => void
    api.fetchCommandCenterDrill.mockReturnValue(new Promise((r) => (resolve = r)))
    await mountPage()
    await t('cc-kpi-students').trigger('click')
    expect(api.fetchCommandCenterDrill).toHaveBeenCalledWith(
      'students',
      undefined,
      expect.anything(),
    )
    expect(modalTitle()).toBe('Memuatkan...')
    expect(text('cc-drill-loading')).toBe('Memuatkan data...')
    resolve({ title: 'Pelajar Berdaftar', students: [] })
    await flushPromises()
    expect(modalTitle()).toBe('Pelajar Berdaftar')
    expect(text('cc-drill-empty')).toBe('Tiada data')
  })

  it.each([
    ['cc-kpi-students', 'students', undefined],
    ['cc-kpi-answered', 'today', undefined],
    ['cc-kpi-accuracy', 'subjects', undefined],
    ['cc-kpi-gps', 'gps', undefined],
    ['cc-kirk-t1', 'kirk', 't1'],
    ['cc-kirk-t4', 'kirk', 't4'],
    ['cc-mood-stressed', 'mood', 'stressed'],
    ['cc-band-developing', 'engagement', 'developing'],
    ['cc-activity-bar', 'today', 'aktiviti'],
  ] as const)('the %s tile asks drill(%s, %s)', async (testid, type, filter) => {
    api.fetchCommandCenterDrill.mockResolvedValue({ title: 'X', students: [] })
    await mountPage()
    await t(testid).trigger('click')
    expect(api.fetchCommandCenterDrill).toHaveBeenCalledWith(type, filter, expect.anything())
  })

  it('renders the students table, colours the accuracy and opens a student row in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    api.fetchCommandCenterDrill.mockResolvedValue({
      title: 'Pelajar Berdaftar',
      students: [
        {
          studentId: 3001,
          name: 'Murid Demo 01',
          className: 'Kimia 5 Alpha, Sejarah 5 Beta',
          answered: 30,
          accuracy: 86,
          lastActiveAt: '2026-09-24T10:00:00+08:00',
          status: 'Login',
        },
        {
          studentId: 3002,
          name: 'Murid Demo 02',
          className: 'Kimia 5 Alpha',
          answered: 10,
          accuracy: 30,
          lastActiveAt: null,
          status: 'Aktif',
        },
      ],
    })
    await mountPage()
    await t('cc-kpi-students').trigger('click')
    const heads = t('cc-drill-table-wrap')
      .findAll('th')
      .map((h) => h.text())
    expect(heads[0]).toBe('Pelajar')
    expect(heads.at(-1)).toBe('Status')
    const rows = all('cc-drill-row')
    expect(rows).toHaveLength(2)
    expect(cellTone(rows[0]!, 3)).toContain('text-success')
    expect(cellTone(rows[1]!, 3)).toContain('text-error')
    expect(trOf(rows[1]!).findAll('td')[4]!.text()).toBe('-')
    await rows[0]!.trigger('click')
    expect(open).toHaveBeenLastCalledWith('/guru/command-center/student/3001', '_blank', 'noopener')
  })

  it('renders the "vs" cards of kirk t2 and no table', async () => {
    api.fetchCommandCenterDrill.mockResolvedValue({
      title: 'Kirkpatrick T2',
      students: [],
      vsLabel: 'Bulan Ini vs Bulan Lepas',
      extra: {
        accuracyNow: 46,
        accuracyPrev: 40,
        accuracyChange: 6,
        answersNow: 83,
        answersPrev: 0,
        activeNow: 8,
        activePrev: 0,
        newStudents: 8,
      },
    })
    await mountPage()
    await t('cc-kirk-t2').trigger('click')
    expect(text('cc-drill-vs-label')).toBe('Bulan Ini vs Bulan Lepas')
    expect(cards()).toEqual([
      '46% Ketepatan Kini',
      '40% Ketepatan Lepas',
      '+6% Perubahan',
      '83 Jawapan Kini',
      '0 Jawapan Lepas',
      '8 Aktif Kini (30h)',
      '0 Aktif Lepas (30h)',
      '8 Pelajar Baru',
    ])
    expect(t('cc-drill-table-wrap').exists()).toBe(false)
    expect(t('cc-drill-empty').exists()).toBe(false)
  })

  it('shows "Ralat: {message}" and the tile label when the drill fails', async () => {
    api.fetchCommandCenterDrill.mockRejectedValue(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Jenis tidak sah' }),
    )
    await mountPage()
    await t('cc-mood-happy').trigger('click')
    expect(text('cc-drill-error')).toBe('Ralat: Jenis tidak sah')
    expect(modalTitle()).toBe('Mood Pelajar')
  })

  it('closes with "Tutup" and can be opened again', async () => {
    api.fetchCommandCenterDrill.mockResolvedValue({ title: 'GPS Sekolah', students: [] })
    await mountPage()
    await t('cc-kpi-gps').trigger('click')
    expect(t('cc-drill-modal').exists()).toBe(true)
    await t('cc-modal-close').trigger('click')
    await flushPromises()
    expect(t('cc-drill-modal').exists()).toBe(false)
    await t('cc-kpi-gps').trigger('click')
    expect(t('cc-drill-modal').exists()).toBe(true)
  })
})

describe('loading texts of the modals', () => {
  it.each([
    ['cc-link-remedial', 'fetchRemedialScan', 'Mengimbas topik lemah pelajar...'],
    ['cc-link-evaluate', 'fetchCommandCenterEvaluation', 'Menilai semua pelajar...'],
    [
      'cc-link-predictive',
      'fetchCommandCenterPredictive',
      'Menganalisis data prestasi semua pelajar...',
    ],
    ['cc-link-badges', 'fetchCommandCenterAchievements', 'Mengimbas pencapaian semua pelajar...'],
  ] as const)('%s shows %s loading text', async (link, fn, loading) => {
    api[fn].mockReturnValue(new Promise(() => undefined))
    await mountPage()
    await t(link).trigger('click')
    expect(text('cc-modal-loading')).toBe(loading)
  })
})

describe('"👩‍🏫 Kelas" and "🔮 Ramalan SPM" (FR-M10-20, FR-M10-21)', () => {
  it('fetches live-data again and lists the two classes; a row opens the class page', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    await mountPage()
    await t('cc-link-kelas').trigger('click')
    expect(modalTitle()).toBe('Kelas Saya — Ringkasan Prestasi')
    expect(api.fetchCommandCenterLiveData).toHaveBeenCalledTimes(2)
    await flushPromises()
    expect(cards()).toEqual(['8 Jumlah Pelajar', '0 Aktif', '46% Ketepatan'])
    expect(all('cc-kelas-row')).toHaveLength(2)
    expect(
      t('cc-kelas-table')
        .findAll('th')
        .map((h) => h.text()),
    ).toEqual(['#', 'Kelas', 'Tingkatan', 'Pelajar', 'Aktif', 'Ketepatan'])
    await all('cc-kelas-row')[0]!.trigger('click')
    expect(open).toHaveBeenLastCalledWith(
      '/guru/command-center/classroom/2001',
      '_blank',
      'noopener',
    )
  })

  it('shows the loading text first', async () => {
    api.fetchCommandCenterLiveData
      .mockResolvedValueOnce(TEACHER_LIVE)
      .mockReturnValueOnce(new Promise(() => undefined))
    await mountPage()
    await t('cc-link-kelas').trigger('click')
    expect(text('cc-modal-loading')).toBe('Menganalisis prestasi guru...')
  })

  it('renders the empty prediction: cards, ten grade chips and the empty text', async () => {
    api.fetchCommandCenterPredictive.mockResolvedValue(EMPTY_PREDICTIVE)
    await mountPage()
    await t('cc-link-predictive').trigger('click')
    await flushPromises()
    expect(modalTitle()).toBe('Ramalan SPM — Predictive Analytics')
    expect(all('cc-grade-chip').map((c) => c.text())).toEqual([
      'A+',
      'A',
      'A-',
      'B+',
      'B',
      'C+',
      'C',
      'D',
      'E',
      'G',
    ])
    expect(cards()).toEqual([
      '0 Pelajar Dianalisis',
      '0 Ramalan GPS Purata',
      '0 Berisiko',
      '- Gred Terbanyak',
    ])
    expect(text('cc-predictive-empty')).toBe('Tiada data mencukupi untuk ramalan')
  })

  it('renders the prediction table with the risk chips and "{g} ({n})" chips @provisional UNVERIFIED COPY', async () => {
    api.fetchCommandCenterPredictive.mockResolvedValue(PREDICTIVE)
    await mountPage()
    await t('cc-link-predictive').trigger('click')
    await flushPromises()
    const chips = all('cc-grade-chip').map((c) => c.text())
    expect(chips).toContain('A (1)')
    expect(chips).toContain('G (1)')
    expect(chips).toContain('B')
    const rows = all('cc-predictive-row').map((r) => trOf(r))
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('KRITIKAL')
    expect(rows[0]!.text()).toContain('Turun (-8%)')
    expect(rows[1]!.text()).toContain('RENDAH')
    expect(cards()[1]).toBe('5.00 Ramalan GPS Purata')
  })
})

describe('"🔬 Remedial" (FR-M10-22, FR-M10-23)', () => {
  async function openRemedial() {
    await t('cc-link-remedial').trigger('click')
    await flushPromises()
  }

  it('shows the loading text, then the empty congratulation', async () => {
    api.fetchRemedialScan.mockResolvedValue({ weakStudents: [], existingRemedials: [] })
    await mountPage()
    await t('cc-link-remedial').trigger('click')
    expect(modalTitle()).toBe('Smart Remedial — Scan Pelajar Lemah')
    await flushPromises()
    expect(text('cc-remedial-empty')).toBe(
      'Tiada pelajar dengan topik lemah (<50% accuracy). Tahniah!',
    )
  })

  it('shows "Ralat: {message}" when the scan fails', async () => {
    api.fetchRemedialScan.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat pelayan' }),
    )
    await mountPage()
    await openRemedial()
    expect(text('cc-remedial-error')).toBe('Ralat: Ralat pelayan')
  })

  it('lists the weak students with the count line and the open test of one @provisional UNVERIFIED COPY', async () => {
    api.fetchRemedialScan.mockResolvedValue(SCAN)
    await mountPage()
    await openRemedial()
    expect(text('cc-remedial-count')).toBe(
      '2 pelajar dikesan lemah dalam topik tertentu (accuracy <50%)',
    )
    expect(
      t('cc-remedial-table')
        .findAll('th')
        .map((h) => h.text()),
    ).toEqual(['Pelajar', 'Topik Lemah', 'Accuracy Terendah', 'Tindakan'])
    const rows = all('cc-remedial-row')
      .map((r) => trOf(r))
      .map((r) => trOf(r))
    expect(rows[0]!.text()).toContain('Polimer (12.5%)')
    expect(rows[0]!.text()).toContain('Getah Asli (30%)')
    expect(rows[0]!.text()).toContain('12.5%')
    // student 3002: one "Jana Kimia" button for the two Kimia topics
    expect(rows[0]!.findAll('[data-testid="cc-remedial-generate"]').map((b) => b.text())).toEqual([
      'Jana Kimia',
    ])
    // student 3008 has test 7601
    const view = rows[1]!.find('[data-testid="cc-remedial-view"]')
    expect(view.text()).toBe('Lihat Quiz (5 soalan)')
    expect(view.attributes('href')).toBe('/remedial/7601')
    expect(view.attributes('target')).toBe('_blank')
    expect(rows[1]!.find('[data-testid="cc-remedial-cancel"]').text()).toBe('Batal & Jana Semula')
    expect(rows[1]!.find('[data-testid="cc-remedial-generate"]').exists()).toBe(false)
  })

  it('shows "Selesai ({x}%)" for a completed test and still offers "Jana {Subjek}" @provisional UNVERIFIED COPY', async () => {
    api.fetchRemedialScan.mockResolvedValue({
      weakStudents: [SCAN.weakStudents[1]!],
      existingRemedials: [
        { id: 7602, studentId: 3008, status: 'completed', totalQuestions: 5, afterAccuracy: 62.5 },
        // an older completed test listed later: the latest (max id) wins
        { id: 7500, studentId: 3008, status: 'completed', totalQuestions: 5, afterAccuracy: 40 },
        { id: 7603, studentId: 3008, status: 'cancelled', totalQuestions: 5, afterAccuracy: null },
      ],
    })
    await mountPage()
    await openRemedial()
    const done = t('cc-remedial-done')
    expect(done.text()).toBe('Selesai (62.5%)')
    expect(done.attributes('href')).toBe('/remedial/7602')
    expect(t('cc-remedial-cancel').exists()).toBe(false)
    expect(t('cc-remedial-generate').text()).toBe('Jana Kimia')
  })

  it('generates a test: "Menjana..." then the "{Subjek} ({n})" link @provisional UNVERIFIED COPY', async () => {
    api.fetchRemedialScan.mockResolvedValue(SCAN)
    let resolve!: (v: unknown) => void
    api.generateRemedialTest.mockReturnValue(new Promise((r) => (resolve = r)))
    await mountPage()
    await openRemedial()
    const button = all('cc-remedial-generate')[0]!
    await button.trigger('click')
    expect(api.generateRemedialTest).toHaveBeenCalledWith({ studentId: 3002, subject: 'Kimia' })
    expect(button.text()).toBe('Menjana...')
    expect(button.attributes('disabled')).toBeDefined()
    resolve({ quizId: 9100, totalQuestions: 8 })
    await flushPromises()
    const link = t('cc-remedial-made')
    expect(link.text()).toBe('Kimia (8)')
    expect(link.attributes('href')).toBe('/remedial/9100')
    expect(t('cc-remedial-generate').exists()).toBe(false)
  })

  it('shows the response message, "Gagal" and "Ralat" for a failed generate and lets the teacher retry @provisional UNVERIFIED COPY', async () => {
    api.fetchRemedialScan.mockResolvedValue(SCAN)
    await mountPage()
    await openRemedial()
    api.generateRemedialTest.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Tiada soalan untuk topik lemah',
      }),
    )
    await all('cc-remedial-generate')[0]!.trigger('click')
    await flushPromises()
    expect(text('cc-remedial-gen-error')).toBe('Tiada soalan untuk topik lemah')
    api.generateRemedialTest.mockResolvedValueOnce({})
    await all('cc-remedial-generate')[0]!.trigger('click')
    await flushPromises()
    expect(text('cc-remedial-gen-error')).toBe('Gagal')
    api.generateRemedialTest.mockRejectedValueOnce(new Error('network'))
    await all('cc-remedial-generate')[0]!.trigger('click')
    await flushPromises()
    expect(text('cc-remedial-gen-error')).toBe('Ralat')
    expect(all('cc-remedial-generate')[0]!.text()).toBe('Jana Kimia')
  })

  it('cancels the open test after the confirm: "Membatal...", "Dibatalkan — boleh jana semula", Jana buttons back @provisional UNVERIFIED COPY', async () => {
    api.fetchRemedialScan.mockResolvedValue(SCAN)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    let resolve!: (v: unknown) => void
    api.cancelRemedialTest.mockReturnValue(new Promise((r) => (resolve = r)))
    await mountPage()
    await openRemedial()
    const cancel = t('cc-remedial-cancel')
    await cancel.trigger('click')
    expect(confirm).toHaveBeenCalledWith(
      'Batal set soalan remedial untuk Murid Demo 08? Anda boleh jana semula selepas ini.',
    )
    expect(api.cancelRemedialTest).toHaveBeenCalledWith(7601)
    expect(cancel.text()).toBe('Membatal...')
    resolve({ success: true })
    await flushPromises()
    const row = trOf(all('cc-remedial-row')[1]!)
    expect(row.find('[data-testid="cc-remedial-cancel-text"]').text()).toBe(
      'Dibatalkan — boleh jana semula',
    )
    expect(row.find('[data-testid="cc-remedial-generate"]').text()).toBe('Jana Kimia')
    expect(row.find('[data-testid="cc-remedial-view"]').exists()).toBe(false)
  })

  it('does nothing when the confirm is dismissed, and shows "Gagal — cuba lagi" / "Ralat — cuba lagi" @provisional UNVERIFIED COPY', async () => {
    api.fetchRemedialScan.mockResolvedValue(SCAN)
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    await mountPage()
    await openRemedial()
    await t('cc-remedial-cancel').trigger('click')
    expect(api.cancelRemedialTest).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    api.cancelRemedialTest.mockRejectedValueOnce(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Ujian tidak aktif' }),
    )
    await t('cc-remedial-cancel').trigger('click')
    await flushPromises()
    expect(text('cc-remedial-cancel-text')).toBe('Gagal — cuba lagi')
    api.cancelRemedialTest.mockRejectedValueOnce(new Error('network'))
    await t('cc-remedial-cancel').trigger('click')
    await flushPromises()
    expect(text('cc-remedial-cancel-text')).toBe('Ralat — cuba lagi')
    expect(t('cc-remedial-cancel').text()).toBe('Batal & Jana Semula')
  })
})

describe('"⚠ Evaluate" (FR-M10-24) @provisional UNVERIFIED COPY', () => {
  it('shows the cards and "Semua pelajar dalam keadaan baik!" for the admin', async () => {
    api.fetchCommandCenterEvaluation.mockResolvedValue({
      summary: { totalStudents: 0, atRisk: 0, critical: 0, high: 0, medium: 0 },
      alerts: [],
    })
    await mountPage()
    await t('cc-link-evaluate').trigger('click')
    await flushPromises()
    expect(modalTitle()).toBe('Auto Evaluate — Penilaian Risiko Pelajar')
    expect(cards()).toEqual([
      '0 Jumlah Pelajar',
      '0 Berisiko',
      '0 Kritikal',
      '0 Tinggi',
      '0 Sederhana',
    ])
    expect(text('cc-evaluate-empty')).toBe(
      'Semua pelajar dalam keadaan baik! Tiada risiko dikesan.',
    )
  })

  it('lists the alerts with the risk badges and opens a row in a new tab', async () => {
    const open = vi.spyOn(window, 'open').mockReturnValue(null)
    api.fetchCommandCenterEvaluation.mockResolvedValue(EVALUATION)
    await mountPage()
    await t('cc-link-evaluate').trigger('click')
    await flushPromises()
    expect(all('cc-risk').map((r) => r.text())).toEqual(['TINGGI', 'SEDERHANA'])
    const row = trOf(all('cc-evaluate-row')[0]!)
    expect(row.text()).toContain('Tiada aktiviti 7 hari')
    expect(row.text()).toContain('Beri latihan tambahan')
    await row.trigger('click')
    expect(open).toHaveBeenLastCalledWith('/guru/command-center/student/3003', '_blank', 'noopener')
  })
})

describe('"🏆 Badges" (FR-M10-25) @provisional UNVERIFIED COPY', () => {
  it('lists the badge chips with their rarity, the collectors and the new awards', async () => {
    api.fetchCommandCenterAchievements.mockResolvedValue(ACHIEVEMENTS)
    await mountPage()
    await t('cc-link-badges').trigger('click')
    await flushPromises()
    expect(modalTitle()).toBe('Achievement System — Scan & Award Badges')
    expect(cards()).toEqual(['8 Pelajar', '1 Lencana Baru Dianugerah', '2 Jenis Lencana Aktif'])
    const chips = all('cc-badge-chip').map((c) => c.text())
    expect(chips[0]).toContain('Pemula Rajin')
    expect(chips[0]).toContain('1 pelajar')
    expect(chips[0]).toContain('Epic')
    expect(chips[1]).toContain('0 pelajar')
    expect(chips[1]).toContain('Legendary')
    expect(t('cc-collectors-table').text()).toContain('Murid Demo 02')
    expect(text('cc-new-awards')).toContain('Pemula Rajin')
    expect(document.body.textContent).toContain('Baru Dianugerahkan Hari Ini!')
  })

  it('opens "Lencana: {nama}" with the holders, and its empty text', async () => {
    api.fetchCommandCenterAchievements.mockResolvedValue(ACHIEVEMENTS)
    let release!: (v: unknown) => void
    api.fetchBadgeHolders
      .mockReturnValueOnce(new Promise((r) => (release = r)))
      .mockResolvedValueOnce({
        badge: { name: 'Pelajar Aktif', description: 'Aktif 5 hari' },
        holders: [],
      })
    await mountPage()
    await t('cc-link-badges').trigger('click')
    await flushPromises()
    await all('cc-badge-chip')[0]!.trigger('click')
    expect(api.fetchBadgeHolders).toHaveBeenCalledWith(1, expect.anything())
    expect(text('cc-holders-loading')).toBe('Memuatkan senarai pelajar...')
    release({
      badge: { name: 'Pemula Rajin', description: 'Jawab 10 soalan' },
      holders: [
        {
          studentId: 3002,
          name: 'Murid Demo 02',
          accuracy: 55,
          awardedAt: '2026-09-24T10:00:00+08:00',
        },
      ],
    })
    await flushPromises()
    const titles = q('[data-slot="title"]').map((x) => x.text())
    expect(titles.at(-1)).toBe('Lencana: Pemula Rajin')
    expect(text('cc-holders-count')).toBe('1 pelajar memiliki lencana ini')
    expect(
      t('cc-holders-table')
        .findAll('th')
        .map((h) => h.text()),
    ).toEqual(['#', 'Pelajar', 'Ketepatan', 'Tarikh Anugerah'])
    expect(t('cc-holders-table').text()).toContain('24/09/2026')
    // close the holders modal only, open the second badge
    await all('cc-modal-close').at(-1)!.trigger('click')
    await flushPromises()
    expect(t('cc-holders-modal').exists()).toBe(false)
    expect(t('cc-badges-modal').exists()).toBe(true)
    await all('cc-badge-chip')[1]!.trigger('click')
    await flushPromises()
    expect(text('cc-holders-empty')).toBe('Belum ada pelajar yang memiliki lencana ini.')
  })
})
