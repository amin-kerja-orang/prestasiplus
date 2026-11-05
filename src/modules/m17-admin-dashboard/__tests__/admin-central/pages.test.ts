// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import type { AdminAnalytics, AdminDashboard, AdminLaporan } from '../../api/command-center'
import AdminAnalitikPage from '../../pages/AdminAnalitikPage.vue'
import AdminDashboardPage from '../../pages/AdminDashboardPage.vue'
import AdminLaporanPage from '../../pages/AdminLaporanPage.vue'

const api = vi.hoisted(() => ({
  fetchAdminDashboard: vi.fn(),
  fetchAdminAnalytics: vi.fn(),
  fetchAdminLaporan: vi.fn(),
}))
vi.mock('../../api/command-center', () => api)

const dashboard: AdminDashboard = {
  questions: {
    total: 120,
    byStatus: { draft: 10, review: 3, approved: 100, archived: 7 },
    thisWeek: 4,
  },
  subjects: { total: 12, active: 11 },
  levels: 5,
  users: { total: 300, students: 250, teachers: 40 },
  battles: { total: 9, active: 2, finished: 7 },
}

const analytics: AdminAnalytics = {
  range: '30d',
  platform: {
    schools: 5,
    activeSubscriptions: 3,
    students: 100,
    activeStudents: 60,
    answered: 1500,
    accuracy: 62.5,
  },
  trend: [{ date: '2026-09-24', answered: 10 }],
  topSchools: [{ schoolId: '1', school: 'SMK CONTOH', answered: 90 }],
  bank: {
    bySubject: [{ id: '1', name: 'Matematik', total: 50 }],
    byLevel: [{ id: '7', name: 'Tingkatan 1', total: 50 }],
    total: 4,
    byStatus: { draft: 1, review: 1, approved: 2, archived: 0 },
    dskpTaggedShare: 40,
    chapterCoverage: 30,
    servability: {},
  },
}

const laporan: AdminLaporan = {
  range: 30,
  tiles: {
    schools: 5,
    teachers: 4,
    pupils: 40,
    pupilsAccessed: 20,
    teachersAccessed: 4,
    pupilsPractised: 15,
    activities: 300,
    averageScore: 71.5,
  },
  trend: [{ date: '24/09', count: 3 }],
  breakdown: [{ type: 'kuiz', label: 'Kuiz', count: 1200 }],
  mostActive: [
    { id: '1', name: 'MURID CONTOH', school: { id: '1', name: 'SMK CONTOH' }, activities: 12 },
  ],
  schoolActivity: [{ schoolId: '1', name: 'SMK CONTOH', activities: 99, activePupils: 8 }],
}

let wrapper: VueWrapper | null = null
async function render(component: object) {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/')
  wrapper = mount(component, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}
beforeEach(() => {
  setActivePinia(createPinia())
  for (const f of Object.values(api)) f.mockReset()
  api.fetchAdminDashboard.mockResolvedValue(dashboard)
  api.fetchAdminAnalytics.mockResolvedValue(analytics)
  api.fetchAdminLaporan.mockResolvedValue(laporan)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('AdminDashboardPage (M-01)', () => {
  it('shows the tiles with their sub-lines and links to the filtered list', async () => {
    const w = await render(AdminDashboardPage)
    const text = w.text()
    for (const l of [
      'Soalan Aktif',
      'Diluluskan',
      'Menunggu Semakan',
      'Draf',
      'Subjek',
      'Tahap Pendidikan',
      'Pengguna',
      'Battle Arena',
    ]) {
      expect(text).toContain(l)
    }
    expect(text).toContain('Minggu ini: 4')
    expect(text).toContain('250 Pelajar')
    expect(text).toContain('11 Aktif')
    expect(text).toContain('PvP Quiz Battles')
    expect(text).toContain('9 Total')
    expect(text).toContain('Tindakan Pantas')
    expect(text).toContain('Pautan Pantas')
    const hrefs = w.findAll('a').map((a) => a.attributes('href'))
    expect(hrefs).toContain('/admin/studio?status=review')
    expect(text).not.toContain('Muat Turun Data')
  })

  it('shows "Tidak dapat dimuatkan." with Cuba lagi on failure and retries', async () => {
    api.fetchAdminDashboard.mockRejectedValueOnce(new Error('x'))
    const w = await render(AdminDashboardPage)
    expect(w.text()).toContain('Tidak dapat dimuatkan.')
    const retry = w.findAll('button').find((b) => b.text() === 'Cuba lagi')
    expect(retry).toBeDefined()
    await retry?.trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Soalan Aktif')
  })
})

describe('AdminAnalitikPage (M-05)', () => {
  it('shows the regions and a whole-number accuracy rounded half up', async () => {
    const w = await render(AdminAnalitikPage)
    const text = w.text()
    expect(text).toContain('Taburan Status Soalan')
    expect(text).toContain('Top 10 Subjek Aktif')
    expect(text).toContain('Jumlah: 4 soalan')
    expect(text).toContain('63%')
    expect(text).toContain('Matematik')
  })

  it('shows "Tiada data analitik." when there is nothing', async () => {
    api.fetchAdminAnalytics.mockResolvedValue({
      ...analytics,
      platform: { ...analytics.platform, answered: 0 },
      bank: { ...analytics.bank, byStatus: { draft: 0, review: 0, approved: 0, archived: 0 } },
    })
    const w = await render(AdminAnalitikPage)
    expect(w.text()).toContain('Tiada data analitik.')
  })

  it('shows the error state', async () => {
    api.fetchAdminAnalytics.mockRejectedValue(new Error('x'))
    const w = await render(AdminAnalitikPage)
    expect(w.text()).toContain('Tidak dapat dimuatkan.')
    expect(w.text()).toContain('Cuba lagi')
  })
})

describe('AdminLaporanPage (M-06)', () => {
  it('shows the tiles, regions and the all-teachers notice', async () => {
    const w = await render(AdminLaporanPage)
    const text = w.text()
    for (const l of [
      'Sekolah',
      'Guru',
      'Murid',
      'Murid Pernah Akses',
      'Cikgu Pernah Akses',
      'Murid Buat Latihan',
      'Jumlah Aktiviti',
      'Skor Purata',
      'Pecahan Aktiviti',
      'Aktiviti Mengikut Sekolah',
      'Pelajar Paling Aktif (Top 10)',
    ]) {
      expect(text).toContain(l)
    }
    expect(text).toContain('20 / 40')
    expect(text).toContain('1,200')
    expect(text).toContain('72%')
    expect(text).toContain('Semua guru telah mengakses platform.')
  })

  it('shows the region empty copies', async () => {
    api.fetchAdminLaporan.mockResolvedValue({
      ...laporan,
      tiles: { ...laporan.tiles, teachersAccessed: 1 },
      trend: [{ date: '24/09', count: 0 }],
      breakdown: [],
      mostActive: [],
      schoolActivity: [],
    })
    const text = (await render(AdminLaporanPage)).text()
    expect(text).toContain('Tiada aktiviti dalam 14 hari lepas.')
    expect(text).toContain('Tiada aktiviti direkodkan.')
    expect(text).toContain('Tiada aktiviti pelajar.')
    expect(text).toContain('Tiada aktiviti sekolah.')
    expect(text).not.toContain('Semua guru telah mengakses platform.')
  })

  it('shows "Tiada data laporan." when everything is zero and the error state', async () => {
    api.fetchAdminLaporan.mockResolvedValueOnce({
      ...laporan,
      tiles: { ...laporan.tiles, schools: 0, teachers: 0, pupils: 0, activities: 0 },
    })
    expect((await render(AdminLaporanPage)).text()).toContain('Tiada data laporan.')
    wrapper?.unmount()
    api.fetchAdminLaporan.mockRejectedValue(new Error('x'))
    expect((await render(AdminLaporanPage)).text()).toContain('Tidak dapat dimuatkan.')
  })
})
