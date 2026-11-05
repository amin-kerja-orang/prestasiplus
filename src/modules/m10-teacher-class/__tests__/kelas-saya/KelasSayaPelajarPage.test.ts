// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import KelasSayaPelajarPage from '../../pages/KelasSayaPelajarPage.vue'

const api = vi.hoisted(() => ({ fetchJoinedClasses: vi.fn() }))
vi.mock('../../api/guru', () => api)

const stub = { template: '<div />' }
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const META = { page: 1, pageSize: 20, totalItems: 0, totalPages: 1, from: null, to: null }
const list = (data: unknown[]) => ({ data, meta: { ...META, totalItems: data.length } })

const CLASS = {
  id: 2002,
  name: '5 MARIKH - Sejarah',
  subjectName: 'Sejarah',
  teacherName: 'Guru Demo',
  levelLabel: 'Ting. 5',
}

let wrapper: VueWrapper | null = null

async function mountPage(path = '/kelas-saya') {
  const r = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/kelas-saya', component: stub }],
  })
  await r.push(path)
  await r.isReady()
  wrapper = mount(KelasSayaPelajarPage, { global: { plugins: [r] } })
  await flushPromises()
  return wrapper
}

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.resetAllMocks()
})

describe('S33 Kelas Saya (student)', () => {
  it('has no join box and shows the empty state', async () => {
    api.fetchJoinedClasses.mockResolvedValue(list([]))
    const w = await mountPage()
    expect(w.text()).not.toContain('Masukkan Kod Kelas')
    expect(w.find('[data-testid="class-code"]').exists()).toBe(false)
    expect(w.find('[data-testid="join-form"]').exists()).toBe(false)
    expect(w.findAll('button').some((b) => b.text() === 'Sertai')).toBe(false)
    expect(w.find('[data-testid="classes-empty"]').exists()).toBe(true)
  })

  it('ignores ?kod= (nothing is pre-filled or joined)', async () => {
    api.fetchJoinedClasses.mockResolvedValue(list([]))
    const w = await mountPage('/kelas-saya?kod=DEMO-4S')
    expect(w.find('input').exists()).toBe(false)
    expect(w.html()).not.toContain('DEMO-4S')
    expect(w.findAll('button').some((b) => b.text() === 'Sertai')).toBe(false)
  })

  it('shows the loading state before the list arrives', () => {
    api.fetchJoinedClasses.mockReturnValue(new Promise(() => undefined))
    wrapper = mount(KelasSayaPelajarPage, {
      global: { plugins: [createRouter({ history: createMemoryHistory(), routes: [] })] },
    })
    expect(wrapper.find('[data-testid="classes-loading"]').exists()).toBe(true)
  })

  it('lists joined classes instead of the empty card', async () => {
    api.fetchJoinedClasses.mockResolvedValue(list([CLASS]))
    const w = await mountPage()
    expect(w.find('[data-testid="classes-empty"]').exists()).toBe(false)
    expect(t(w, 'class-name').text()).toBe('5 MARIKH - Sejarah')
    expect(t(w, 'class-subject').text()).toBe('Sejarah')
    expect(t(w, 'class-teacher').text()).toBe('Guru Demo')
    expect(t(w, 'class-level').text()).toBe('Ting. 5')
  })

  it('shows an error state with retry when the list fails (@provisional not on live)', async () => {
    api.fetchJoinedClasses.mockRejectedValueOnce(new Error('x'))
    const w = await mountPage()
    expect(t(w, 'classes-error').text()).toContain('Ralat memuatkan data. Sila cuba semula.')
    api.fetchJoinedClasses.mockResolvedValueOnce(list([]))
    await w.get('[data-testid="classes-error"] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="classes-empty"]').exists()).toBe(true)
  })
})
