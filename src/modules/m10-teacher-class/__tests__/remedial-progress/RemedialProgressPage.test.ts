// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import RemedialProgressPage from '../../pages/RemedialProgressPage.vue'
import routes from '../../routes'

const api = vi.hoisted(() => ({ fetchRemedialProgress: vi.fn() }))
vi.mock('../../api/guru', () => api)

const t = (w: ReturnType<typeof mount>, id: string) => w.find(`[data-testid="${id}"]`)

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<div />' } }],
  })
  const w = mount(RemedialProgressPage, { global: { plugins: [router] } })
  await flushPromises()
  return w
}

beforeEach(() => setActivePinia(createPinia()))
afterEach(() => vi.clearAllMocks())

describe('S3 Remedial Progress', () => {
  it('has a route at /guru/remedial-progress for teacher and admin (Command Center "Rekod" target)', () => {
    const r = routes.find((x) => x.path === '/guru/remedial-progress')
    expect(r).toBeTruthy()
    expect(r?.meta?.roles).toEqual(['teacher', 'admin'])
    expect(r?.meta?.title).toBe('Remedial Progress Dashboard')
    expect(r?.meta?.header).toEqual({
      title: 'Remedial Progress Dashboard',
      subtitle: 'Selamat datang kembali',
    })
  })

  it('shows the empty state with the live copy', async () => {
    api.fetchRemedialProgress.mockResolvedValue({
      stats: { total: 0, completed: 0, students: 0, avgImprovement: 0 },
      rows: [],
    })
    const w = await mountPage()
    expect(t(w, 'remedial-progress-subtitle').text()).toBe(
      'Jejak peningkatan pelajar melalui ujian pemulihan',
    )
    expect(t(w, 'rp-stat-total').text()).toContain('JUMLAH SET')
    expect(t(w, 'rp-stat-improvement').text()).toContain('+0%')
    expect(t(w, 'remedial-progress-empty').text()).toContain('Belum ada ujian remedial dijana.')
    expect(t(w, 'remedial-progress-empty').text()).toContain(
      'Buka Command Center → klik Remedial untuk mula.',
    )
  })

  it('lists the tests with status and before → after', async () => {
    api.fetchRemedialProgress.mockResolvedValue({
      stats: { total: 2, completed: 1, students: 2, avgImprovement: 20 },
      rows: [
        {
          id: 1,
          studentName: 'Murid A',
          subjectName: 'Sains',
          status: 'completed',
          beforeAccuracy: 40,
          afterAccuracy: 60,
        },
        {
          id: 2,
          studentName: 'Murid B',
          subjectName: 'Matematik',
          status: 'active',
          beforeAccuracy: 30,
          afterAccuracy: null,
        },
      ],
    })
    const w = await mountPage()
    expect(t(w, 'rp-stat-improvement').text()).toContain('+20%')
    const rows = w.findAll('[data-testid="remedial-progress-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('Selesai')
    expect(rows[0]!.text()).toContain('40% → 60%')
    expect(rows[1]!.text()).toContain('30% → -')
  })

  it('shows the loading skeleton while the request is pending', async () => {
    api.fetchRemedialProgress.mockReturnValue(new Promise(() => undefined))
    const w = await mountPage()
    expect(t(w, 'remedial-progress-loading').attributes('aria-busy')).toBe('true')
    expect(t(w, 'remedial-progress-stats').exists()).toBe(false)
  })

  it('shows a retryable error and fetches again on retry', async () => {
    api.fetchRemedialProgress.mockRejectedValueOnce(new Error('x'))
    api.fetchRemedialProgress.mockResolvedValue({
      stats: { total: 0, completed: 0, students: 0, avgImprovement: 0 },
      rows: [],
    })
    const w = await mountPage()
    expect(t(w, 'remedial-progress-error').exists()).toBe(true)
    expect(api.fetchRemedialProgress).toHaveBeenCalledTimes(1)
    await w.find('[data-testid="remedial-progress-error"] button').trigger('click')
    await flushPromises()
    expect(api.fetchRemedialProgress).toHaveBeenCalledTimes(2)
    expect(t(w, 'remedial-progress-empty').exists()).toBe(true)
  })
})
