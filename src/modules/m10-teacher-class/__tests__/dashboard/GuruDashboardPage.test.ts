// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { GuruDashboard } from '../../api/types'
import {
  checklistProgress,
  readGuideHidden,
  welcomeSubtitle,
  writeGuideHidden,
} from '../../components/dashboard/lib'
import GuruDashboardPage from '../../pages/GuruDashboardPage.vue'

const api = vi.hoisted(() => ({ fetchGuruDashboard: vi.fn() }))
vi.mock('../../api/guru', () => api)
const cc = vi.hoisted(() => ({ fetchCommandCenterDrill: vi.fn() }))
vi.mock('../../api/command-center', () => cc)

const pupil = (studentId: number, answered: number, accuracy: number) => ({
  studentId,
  name: `Murid ${String(studentId)}`,
  className: 'Kelas A',
  answered,
  accuracy,
  lastActiveAt: null,
  status: 'Login' as const,
})

const empty = (): GuruDashboard => ({
  checklist: { hasClass: false, hasStudents: false, hasMission: false },
  stats: {
    activeClasses: 0,
    totalClasses: 0,
    students: 0,
    questions: 20719,
    questionsApproved: 19361,
    assignments: 0,
  },
  today: { students: [], topics: [], actions: [] },
  peerTutor: [],
  classes: [],
  submissions: [],
})

let wrapper: VueWrapper | undefined

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/guru')
  await router.isReady()
  wrapper = mount(GuruDashboardPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
  api.fetchGuruDashboard.mockReset()
  api.fetchGuruDashboard.mockResolvedValue(empty())
  cc.fetchCommandCenterDrill.mockReset()
  cc.fetchCommandCenterDrill.mockResolvedValue({ title: 'Pelajar Berdaftar', students: [] })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('S1 helpers', () => {
  it('computes steps and percentage by BR-M10-05', () => {
    expect(checklistProgress({ hasClass: false, hasStudents: false, hasMission: false })).toEqual({
      done: 0,
      percent: 0,
    })
    expect(checklistProgress({ hasClass: true, hasStudents: false, hasMission: false })).toEqual({
      done: 1,
      percent: 33,
    })
    expect(
      checklistProgress({ hasClass: true, hasStudents: true, hasMission: false }).percent,
    ).toBe(67)
    expect(checklistProgress({ hasClass: true, hasStudents: true, hasMission: true }).percent).toBe(
      100,
    )
  })

  it('stores the guide key as "true" and removes it; storage failures show the guide', () => {
    writeGuideHidden(true)
    expect(localStorage.getItem('hideGuruGuide')).toBe('true')
    expect(readGuideHidden()).toBe(true)
    writeGuideHidden(false)
    expect(localStorage.getItem('hideGuruGuide')).toBeNull()
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('denied')
    })
    expect(readGuideHidden()).toBe(false)
    vi.restoreAllMocks()
  })
})

describe('S1 GuruDashboardPage', () => {
  it('admin: guide, 0/3 checklist, stat cards and empty panels (AC-03.1, 04.1, 05.1-05.3)', async () => {
    const w = await mountPage()
    expect(w.get('[data-testid="guide-title"]').text()).toBe('Mula Di Sini — 3 Langkah Mudah')
    const links = w.findAll('[data-testid="guide-link"]')
    expect(links.map((l) => [l.text(), l.attributes('href')])).toEqual([
      ['Buka Kelas →', '/guru/kelas'],
      ['Lihat Pelajar →', '/guru/pelajar'],
      ['Pantau Prestasi →', '/guru/monitoring'],
    ])
    expect(w.get('[data-testid="checklist-count"]').text()).toBe('0/3 langkah selesai')
    expect(w.get('[data-testid="checklist-percent"]').text()).toBe('0%')
    expect(w.findAll('[data-testid="checklist-link"]').map((l) => l.attributes('href'))).toEqual([
      '/guru/kelas',
      '/guru/pelajar',
      '/guru/misi-harian',
    ])
    const cards = ['classes', 'students', 'questions', 'assignments'].map((k) => {
      const c = w.get(`[data-testid="stat-${k}"]`)
      return [
        c.get('[data-ds="stat-tile"] span.text-caption').text(),
        c.get('[data-ds="stat-tile"] span.tabular').text(),
        c.get('[data-ds="stat-tile-sub"]').text(),
      ]
    })
    expect(cards).toEqual([
      ['Kelas Aktif', '0', '0 jumlah kelas'],
      ['Pelajar', '0', 'Merentasi semua kelas'],
      ['Soalan', '20,719', '✅ 19361 diluluskan'],
      ['Tugasan', '0', 'Jumlah tugasan dibuat'],
    ])
    const text = w.text()
    expect(text).toContain('Tiada pelajar berisiko buat masa ini. 🎉')
    expect(text).toContain('Top 5')
    expect(text).toContain('Ketepatan terendah')
    expect(text).toContain('Belum ada data.')
    expect(text).toContain('Semak analitik kelas untuk pecahan prestasi')
    expect(text).toContain('Analitik')
    expect(text).toContain('Buka Analitik Kelas →')
    expect(text).toContain('Kelas anda sudah disediakan oleh admin')
    expect(text).toContain('Pelajar sudah ditugaskan')
    expect(w.get('[data-testid="today-analytics"]').attributes('href')).toBe('/analitik/kelas')
    expect(w.get('[data-testid="today-action-link"]').attributes('href')).toBe('/guru/kelas')
    expect(w.get('[data-testid="today-counters"]').text().replace(/\s+/g, ' ')).toBe(
      'Pelajar0Topik0Tindakan0',
    )
    expect(w.get('[data-testid="peer-empty"]').text()).toContain('Belum cukup signal')
    expect(w.get('[data-testid="classes-empty"]').text()).toBe(
      'Belum ada kelas. Cipta kelas pertama anda.',
    )
    expect(w.get('[data-testid="classes-all"]').text()).toBe('Urus Kelas →')
    expect(w.get('[data-testid="classes-all"]').attributes('href')).toBe('/guru/kelas')
    expect(w.get('[data-testid="submissions-empty"]').text()).toContain(
      'Belum ada penghantaran tugasan. Buat tugasan di kelas untuk mula mengumpul penghantaran.',
    )
  })

  it('AC-GUR-2-2 / FR-GUR-2-2: the four V2 Tindakan Pantas tiles, no dead tiles', async () => {
    const w = await mountPage()
    const tiles = w.findAll('[data-testid="quick-tile"]')
    const shown = tiles.map((t) => [
      t.get('.text-label').text(),
      t.get('.text-caption').text(),
      t.attributes('href'),
    ])
    // "Set Soalan" is hidden by the prototype scope until S6-T14 brings its route in (allows filter kept).
    expect(shown).toEqual(
      [
        ['Pelajar Saya', 'Semak & urus pelajar kelas anda.', '/guru/pelajar'],
        ['Sumbang Soalan', 'Hantar soalan ke bank kebangsaan.', '/guru/soalan/cipta'],
        ['Set Soalan', 'Bina & terbitkan set latihan.', '/guru/set-soalan'],
        ['Prestasi Kelas', 'Lihat ketepatan & pelajar terbaik.', '/prestasi/kelas'],
      ].filter(([title]) => shown.some((s) => s[0] === title)),
    )
    expect(shown.map((s) => s[0])).toEqual(
      expect.arrayContaining(['Pelajar Saya', 'Sumbang Soalan', 'Prestasi Kelas']),
    )
    const text = w.get('[data-testid="quick-card"]').text()
    expect(text).not.toContain('Edit Profil Guru')
    expect(text).not.toContain('Cipta Kelas Baru')
  })

  it('AC-GUR-2-7: On Track / Off Track count pupils at 55% and 54%; a pupil without answers is in neither', async () => {
    cc.fetchCommandCenterDrill.mockResolvedValue({
      title: 'Pelajar Berdaftar',
      students: [pupil(1, 20, 54), pupil(2, 20, 55), pupil(3, 0, 0), pupil(4, 5, 54.5)],
    })
    const w = await mountPage()
    expect(cc.fetchCommandCenterDrill).toHaveBeenCalledWith('students')
    // 54.5 rounds half up to 55: On Track.
    expect(w.get('[data-testid="track-on-n"]').text()).toBe('2')
    expect(w.get('[data-testid="track-off-n"]').text()).toBe('1')
    const on = w.get('[data-testid="track-on"]').text()
    expect(on).toContain('On Track')
    expect(on).toContain('Ketepatan 55% atau lebih')
    const off = w.get('[data-testid="track-off"]').text()
    expect(off).toContain('Off Track')
    expect(off).toContain('Ketepatan di bawah 55%')
  })

  it('On Track / Off Track show "—" when the Command Center call fails; the page still renders', async () => {
    cc.fetchCommandCenterDrill.mockRejectedValue(new Error('x'))
    const w = await mountPage()
    expect(w.get('[data-testid="track-on-n"]').text()).toBe('—')
    expect(w.get('[data-testid="track-off-n"]').text()).toBe('—')
    expect(w.find('[data-testid="checklist-card"]').exists()).toBe(true)
  })

  it('FR-GUR-2-2: the Headcount card opens /headcount', async () => {
    const w = await mountPage()
    const card = w.get('[data-testid="headcount-card"]')
    expect(card.text()).toContain('Headcount TOV / RS / AR')
    expect(card.text()).toContain('Sasaran & pencapaian sebenar')
    expect(w.get('[data-testid="headcount-open"]').text()).toBe('Buka Headcount')
    expect(w.get('[data-testid="headcount-open"]').attributes('href')).toBe('/headcount')
  })

  it('teacher: 3/3, 100% and the class lines (AC-04.2, 05.4)', async () => {
    api.fetchGuruDashboard.mockResolvedValue({
      ...empty(),
      checklist: { hasClass: true, hasStudents: true, hasMission: true },
      stats: {
        ...empty().stats,
        activeClasses: 2,
        totalClasses: 2,
        students: 8,
        questions: 1,
        questionsApproved: 1,
      },
      classes: [
        { id: 1, name: 'Kelas A', studentCount: 8 },
        { id: 2, name: 'Kelas B', studentCount: 8 },
      ],
    })
    const w = await mountPage()
    expect(w.get('[data-testid="checklist-count"]').text()).toBe('3/3 langkah selesai')
    expect(w.get('[data-testid="checklist-percent"]').text()).toBe('100%')
    expect(w.get('[data-testid="stat-classes"]').text()).toContain('2 jumlah kelas')
    expect(w.findAll('[data-testid="classes-item"]').map((i) => i.text())).toEqual([
      'Kelas A · 8 pelajar',
      'Kelas B · 8 pelajar',
    ])
    expect(w.find('[data-testid="classes-empty"]').exists()).toBe(false)
    expect(w.find('[data-testid="submissions-empty"]').exists()).toBe(true)
  })

  it('guide: close hides and stores, the pill restores and removes the key (AC-03.2)', async () => {
    const w = await mountPage()
    await w.get('[data-testid="guide-close"]').trigger('click')
    expect(localStorage.getItem('hideGuruGuide')).toBe('true')
    expect(w.find('[data-testid="guide-card"]').exists()).toBe(false)
    expect(w.get('[data-testid="guide-show"]').text()).toBe('Tunjuk panduan mula')
    wrapper?.unmount()
    const again = await mountPage()
    expect(again.find('[data-testid="guide-card"]').exists()).toBe(false)
    await again.get('[data-testid="guide-show"]').trigger('click')
    expect(localStorage.getItem('hideGuruGuide')).toBeNull()
    expect(again.find('[data-testid="guide-card"]').exists()).toBe(true)
  })

  it('shows a spinner while loading and an error with retry on failure', async () => {
    let resolve!: (v: GuruDashboard) => void
    api.fetchGuruDashboard.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const w = await mountPage()
    expect(w.find('[data-testid="dashboard-loading"]').exists()).toBe(true)
    resolve(empty())
    await flushPromises()
    expect(w.find('[data-testid="dashboard-loading"]').exists()).toBe(false)
    wrapper?.unmount()

    api.fetchGuruDashboard.mockRejectedValueOnce(new Error('x'))
    const f = await mountPage()
    expect(f.find('[data-testid="dashboard-error"]').exists()).toBe(true)
    await f.get('[data-testid="dashboard-error"] button').trigger('click')
    await flushPromises()
    expect(f.find('[data-testid="dashboard-error"]').exists()).toBe(false)
    expect(f.find('[data-testid="checklist-card"]').exists()).toBe(true)
  })
})

describe('S1 route and header', () => {
  it('registers /guru for teacher and admin in the user shell (mock mode)', async () => {
    const { default: routes } = await import('../../routes/dashboard')
    expect(routes).toHaveLength(1)
    const r = routes[0]!
    expect(r.path).toBe('/guru')
    expect(r.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['teacher', 'admin'],
      title: 'Dashboard Guru - PRESTASIPLUS',
    })
  })

  it('AC-GUR-2b-1: registers /guru/misi-harian (teacher) and the /cipta redirect with the form open', async () => {
    const { default: routes } = await import('../../routes')
    const list = routes.find((x) => x.path === '/guru/misi-harian')!
    expect(list.meta).toMatchObject({
      layout: 'user',
      access: 'auth',
      roles: ['teacher'],
      module: 'M10',
      header: { title: 'Misi Harian' },
    })
    expect(String(list.meta?.title)).toMatch(/^Misi Harian .+ PRESTASIPLUS$/)
    expect(routes.find((x) => x.path === '/guru/misi-harian/cipta')).toMatchObject({
      redirect: '/guru/misi-harian?baru=1',
    })
  })

  it('registers /guru for the teacher only in http mode (DV-M10-37)', async () => {
    vi.resetModules()
    vi.stubEnv('VITE_API_MODE', 'http')
    try {
      const { default: routes } = await import('../../routes/dashboard')
      expect(routes[0]!.meta?.roles).toEqual(['teacher'])
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('builds the "Selamat datang, {nama} 👩‍🏫" subtitle', () => {
    expect(welcomeSubtitle('Cikgu Demo')).toBe('Selamat datang, Cikgu Demo 👩‍🏫')
  })
})
