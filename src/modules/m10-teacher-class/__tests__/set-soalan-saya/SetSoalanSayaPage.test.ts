// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import SetSoalanSayaPage from '../../pages/SetSoalanSayaPage.vue'
import {
  attemptsLabel,
  questionCountLabel,
  quizPath,
  timeLimitLabel,
} from '../../components/set-soalan-saya/format'
import setRoutes from '../../routes/set-soalan-saya'
import kelasRoutes from '../../routes/kelas-saya'

const api = vi.hoisted(() => ({ fetchMyQuestionSets: vi.fn() }))
vi.mock('../../api/guru', () => api)

const META = { page: 1, pageSize: 20, totalItems: 0, totalPages: 1, from: null, to: null }
const list = (data: unknown[]) => ({ data, meta: { ...META, totalItems: data.length } })
const SET = {
  id: 7402,
  title: 'Sejarah Bab 1 - Set 1',
  teacherName: 'Guru Demo',
  questionCount: 10,
  timeLimitMinutes: null,
  attemptsLeft: 1,
}

let wrapper: VueWrapper | null = null

async function mountPage() {
  const r = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/set-soalan-saya', component: { template: '<div />' } },
      { path: '/set-soalan-saya/:id/jawab', component: { template: '<div />' } },
    ],
  })
  await r.push('/set-soalan-saya')
  await r.isReady()
  wrapper = mount(SetSoalanSayaPage, { global: { plugins: [r] } })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.resetAllMocks()
})

describe('S34 Set Soalan Guru (student)', () => {
  it('renders the observed empty card', async () => {
    api.fetchMyQuestionSets.mockResolvedValue(list([]))
    const w = await mountPage()
    const empty = w.get('[data-testid="sets-empty"]')
    expect(empty.text()).toContain('Tiada Set Soalan')
    expect(empty.text()).toContain('Guru anda belum sediakan set soalan untuk anda.')
  })

  it('shows loading, then an error with retry (@provisional not on live)', async () => {
    api.fetchMyQuestionSets.mockRejectedValueOnce(new Error('x'))
    const w = await mountPage()
    expect(w.get('[data-testid="sets-error"]').text()).toContain('Ralat memuatkan data')
    api.fetchMyQuestionSets.mockResolvedValueOnce(list([SET]))
    await w.get('[data-testid="sets-retry"]').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="set-row"]')).toHaveLength(1)
  })

  it('renders a PROPOSED row linking "Mula" to the M05 quiz (@provisional)', async () => {
    api.fetchMyQuestionSets.mockResolvedValue(
      list([SET, { ...SET, id: 9, title: 'B', timeLimitMinutes: 30, attemptsLeft: null }]),
    )
    const w = await mountPage()
    const rows = w.findAll('[data-testid="set-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.get('[data-testid="set-title"]').text()).toBe('Sejarah Bab 1 - Set 1')
    expect(rows[0]!.get('[data-testid="set-teacher"]').text()).toBe('Guru Demo')
    expect(rows[0]!.get('[data-testid="set-count"]').text()).toBe('10 soalan')
    expect(rows[0]!.find('[data-testid="set-time"]').exists()).toBe(false)
    expect(rows[0]!.get('[data-testid="set-start"]').attributes('href')).toBe(
      '/set-soalan-saya/7402/jawab',
    )
    expect(rows[1]!.get('[data-testid="set-time"]').text()).toBe('30 minit')
    expect(rows[1]!.get('[data-testid="set-attempts"]').text()).toBe('Percubaan tanpa had')
  })
})

describe('format helpers and routes', () => {
  it('formats labels', () => {
    expect(questionCountLabel(1)).toBe('1 soalan')
    expect(timeLimitLabel(null)).toBeNull()
    expect(timeLimitLabel(45)).toBe('45 minit')
    expect(attemptsLabel(null)).toBe('Percubaan tanpa had')
    expect(attemptsLabel(2)).toBe('2 percubaan berbaki')
    expect(quizPath(5)).toBe('/set-soalan-saya/5/jawab')
  })

  it('declares user-shell routes for student and admin with the observed titles', () => {
    const [s34] = setRoutes
    const [s33] = kelasRoutes
    expect(s34!.path).toBe('/set-soalan-saya')
    expect(s34!.meta).toMatchObject({
      layout: 'user',
      roles: ['student', 'admin'],
      title: 'Set Soalan Guru - PRESTASIPLUS',
      header: { title: 'Set Soalan Guru', subtitle: 'Set soalan yang disediakan oleh guru anda' },
    })
    expect(s33!.path).toBe('/kelas-saya')
    expect(s33!.meta).toMatchObject({
      title: 'Kelas Saya',
      header: { title: 'Kelas Saya', subtitle: 'Sertai kelas guru anda 🏫' },
    })
  })
})
