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
      ['Kelas Saya →', '/guru/kelas'],
      ['Pelajar Saya →', '/guru/pelajar'],
      ['Monitoring →', '/guru/monitoring'],
    ])
    expect(w.get('[data-testid="checklist-count"]').text()).toBe('0/3 langkah selesai')
    expect(w.get('[data-testid="checklist-percent"]').text()).toBe('0%')
    expect(w.findAll('[data-testid="checklist-link"]').map((l) => l.attributes('href'))).toEqual([
      '/guru/kelas',
      '/guru/pelajar',
      '/guru/misi-harian/cipta',
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
      ['Soalan', '20719', '✅ 19361 diluluskan'],
      ['Tugasan', '0', 'Jumlah tugasan dibuat'],
    ])
    const text = w.text()
    expect(text).toContain('Tiada pelajar berkeutamaan tinggi dikesan buat masa ini.')
    expect(text).toContain('Tiada topik kritikal menonjol dikesan daripada data semasa.')
    expect(text).toContain('Bina aktiviti pertama untuk pelajar')
    expect(text).toContain('Permulaan')
    expect(w.get('[data-testid="today-analytics"]').attributes('href')).toBe('/analitik/kelas')
    expect(w.get('[data-testid="today-action-link"]').attributes('href')).toBe('/guru/kelas')
    expect(w.get('[data-testid="today-counters"]').text().replace(/\s+/g, ' ')).toBe(
      'Pelajar0Topik0Tindakan0',
    )
    expect(w.get('[data-testid="peer-empty"]').text()).toContain('Belum cukup signal')
    expect(w.findAll('[data-testid="quick-tile"]').map((t) => t.attributes('href'))).toEqual([
      '/guru/kelas/cipta',
      '/guru/soalan/cipta',
      '/guru/pelajar',
      '/guru/profil/edit',
    ])
    expect(w.get('[data-testid="classes-empty"]').text()).toBe('Belum ada kelas. Cipta sekarang!')
    expect(w.get('[data-testid="classes-all"]').attributes('href')).toBe('/guru/kelas')
    expect(w.get('[data-testid="submissions-empty"]').text()).toContain(
      'Belum ada penghantaran tugasan.',
    )
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
    expect(w.get('[data-testid="guide-show"]').text()).toBe('Tunjuk panduan Mula Di Sini')
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
