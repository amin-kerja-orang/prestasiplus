// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { TeacherMission } from '../../api/guru'
import MisiHarianPage from '../../pages/MisiHarianPage.vue'

const api = vi.hoisted(() => ({
  fetchTeacherMissions: vi.fn(),
  deleteTeacherMission: vi.fn(),
  createTeacherMission: vi.fn(),
  fetchGuruClasses: vi.fn(),
}))
vi.mock('../../api/guru', () => api)
const subjects = vi.hoisted(() => ({ fetchSubjectOptions: vi.fn() }))
vi.mock('../../components/kelas/subjects', () => subjects)

const mission = (id: string, extra: Partial<TeacherMission> = {}): TeacherMission => ({
  id,
  title: `Misi ${id}`,
  description: null,
  targetQuestions: 10,
  rewardCoins: 10,
  date: '2026-09-25',
  classroomId: null,
  subjectId: '4',
  subjectName: 'Sains',
  global: false,
  completedCount: 0,
  ...extra,
})

let router: Router
let wrapper: VueWrapper | undefined

async function mountPage(path = '/guru/misi-harian') {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/guru/misi-harian', component: { template: '<div />' } }],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(MisiHarianPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.fetchGuruClasses.mockResolvedValue({ data: [], meta: {} })
  subjects.fetchSubjectOptions.mockResolvedValue([{ id: 4, name: 'Sains' }])
  api.fetchTeacherMissions.mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})

describe('R1-GUR-2b MisiHarianPage', () => {
  it('AC-GUR-2b-1: lists mission cards with title, description, facts, date and completed count', async () => {
    api.fetchTeacherMissions.mockResolvedValue([
      mission('a', { title: 'Jawab 10 soalan', description: 'Fokus Bab 3', completedCount: 3 }),
    ])
    const w = await mountPage()
    expect(w.get('[data-testid="misi-intro"]').text()).toBe(
      'Assign misi harian kepada pelajar. Fokus: Latih Tubi SPM & Tracking A.',
    )
    expect(w.get('[data-testid="misi-new"]').text()).toBe('Misi Baru')
    const card = w.get('[data-testid="misi-card"]')
    expect(card.get('[data-testid="misi-title-text"]').text()).toBe('Jawab 10 soalan')
    expect(card.get('[data-testid="misi-desc"]').text()).toBe('Fokus Bab 3')
    expect(card.findAll('[data-testid="misi-facts"] span').map((f) => f.text())).toEqual([
      '10 soalan',
      '+10 syiling',
      '25/09/2026',
    ])
    expect(card.get('[data-testid="misi-completed"]').text()).toBe('3')
    expect(card.text()).toContain('pelajar selesai')
    expect(card.find('[data-testid="misi-global"]').exists()).toBe(false)
  })

  it('AC-GUR-2b-6: a Global mission has the badge and no delete control; an own mission has one', async () => {
    api.fetchTeacherMissions.mockResolvedValue([
      mission('g', { global: true, title: 'Rajin Berlatih' }),
      mission('own'),
    ])
    const w = await mountPage()
    const [global, own] = w.findAll('[data-testid="misi-card"]')
    expect(global!.get('[data-testid="misi-global"]').text()).toBe('Global')
    expect(global!.find('[data-testid="misi-delete"]').exists()).toBe(false)
    expect(own!.find('[data-testid="misi-global"]').exists()).toBe(false)
    expect(own!.find('[data-testid="misi-delete"]').exists()).toBe(true)
  })

  it('FR-GUR-2b-3: delete asks for confirmation, then calls the API and reloads', async () => {
    api.fetchTeacherMissions.mockResolvedValue([mission('own')])
    api.deleteTeacherMission.mockResolvedValue({ deleted: 1 })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const w = await mountPage()
    await w.get('[data-testid="misi-delete"]').trigger('click')
    await flushPromises()
    expect(api.deleteTeacherMission).not.toHaveBeenCalled()

    confirmSpy.mockReturnValue(true)
    api.fetchTeacherMissions.mockResolvedValue([])
    await w.get('[data-testid="misi-delete"]').trigger('click')
    await flushPromises()
    expect(api.deleteTeacherMission).toHaveBeenCalledWith('own')
    expect(api.fetchTeacherMissions).toHaveBeenCalledTimes(2)
    expect(w.find('[data-testid="misi-empty"]').exists()).toBe(true)
  })

  it('AC-GUR-2b-6: a 403 on delete shows "Misi global tidak boleh dipadam." and a 404 its message', async () => {
    api.fetchTeacherMissions.mockResolvedValue([mission('own')])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const flash = useFlashStore()
    const w = await mountPage()
    api.deleteTeacherMission.mockRejectedValueOnce(
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'Misi global tidak boleh dipadam.' }),
    )
    await w.get('[data-testid="misi-delete"]').trigger('click')
    await flushPromises()
    expect(flash.current).toEqual({ type: 'error', message: 'Misi global tidak boleh dipadam.' })

    api.deleteTeacherMission.mockRejectedValueOnce(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Not found' }),
    )
    await w.get('[data-testid="misi-delete"]').trigger('click')
    await flushPromises()
    // A generic English default never reaches the UI: the fixed BM line shows instead.
    expect(flash.current).toEqual({
      type: 'error',
      message: 'Misi tidak dapat dipadam. Sila cuba lagi.',
    })
  })

  it('empty list: "Belum ada misi" with "Cipta Misi" opening the form', async () => {
    const w = await mountPage()
    const empty = w.get('[data-testid="misi-empty"]')
    expect(empty.text()).toContain('Belum ada misi')
    expect(empty.text()).toContain('Cipta misi harian pertama untuk pelajar anda.')
    expect(w.find('[data-testid="misi-form-card"]').exists()).toBe(false)
    await w.get('[data-testid="misi-empty-create"]').trigger('click')
    expect(w.find('[data-testid="misi-form-card"]').exists()).toBe(true)
  })

  it('"Misi Baru" shows the form card; "Batal" closes it', async () => {
    const w = await mountPage()
    await w.get('[data-testid="misi-new"]').trigger('click')
    expect(w.get('[data-testid="misi-form-card"]').text()).toContain('Cipta Misi')
    await w.get('[data-testid="misi-cancel"]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="misi-form-card"]').exists()).toBe(false)
  })

  it('AC-GUR-2b-1: the /cipta redirect target (?baru=1) opens the form', async () => {
    const w = await mountPage('/guru/misi-harian?baru=1')
    expect(w.find('[data-testid="misi-form-card"]').exists()).toBe(true)
  })

  it('shows a loading skeleton, then an error with retry', async () => {
    let resolve!: (v: TeacherMission[]) => void
    api.fetchTeacherMissions.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const w = await mountPage()
    expect(w.find('[data-testid="misi-loading"]').exists()).toBe(true)
    resolve([])
    await flushPromises()
    expect(w.find('[data-testid="misi-loading"]').exists()).toBe(false)
    wrapper?.unmount()

    api.fetchTeacherMissions.mockRejectedValueOnce(new Error('x'))
    const f = await mountPage()
    expect(f.find('[data-testid="misi-error"]').exists()).toBe(true)
    await f.get('[data-testid="misi-error"] button').trigger('click')
    await flushPromises()
    expect(f.find('[data-testid="misi-error"]').exists()).toBe(false)
  })

  it('AC-GUR-2b-4 (R): cards stack on one column at 375 and every control is at least 44px', async () => {
    api.fetchTeacherMissions.mockResolvedValue([mission('own')])
    const w = await mountPage()
    expect(w.get('[data-testid="misi-list"]').classes()).toEqual(
      expect.arrayContaining(['grid-cols-1', 'md:grid-cols-2']),
    )
    expect(w.get('[data-testid="misi-new"]').classes()).toContain('min-h-11')
    expect(w.get('[data-testid="misi-delete"]').classes()).toEqual(
      expect.arrayContaining(['min-h-11', 'min-w-11']),
    )
  })
})
