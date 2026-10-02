// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { GuruClass, GuruStudent } from '../../api/types'
import PelajarSayaPage from '../../pages/PelajarSayaPage.vue'
import { PELAJAR_COPY } from '../../components/pelajar/copy'

const api = vi.hoisted(() => ({
  fetchGuruClasses: vi.fn(),
  fetchGuruStudents: vi.fn(),
  addStudentToClass: vi.fn(),
  removeStudentFromClass: vi.fn(),
}))
vi.mock('../../api/guru', () => api)

const klass = (id: number, name: string): GuruClass =>
  ({ id, name, isActive: true, kind: 'classroom' }) as GuruClass
const student = (id: number, name: string, classNames: string[] = []): GuruStudent => ({
  id,
  name,
  levelName: 'Tingkatan 5',
  classNames,
})

let state: {
  mine: GuruStudent[]
  school: GuruStudent[]
  schoolSet: boolean
}

let wrapper: VueWrapper | undefined

async function mountPage() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guru/pelajar', component: { template: '<div />' } },
      { path: '/guru/kelas/cipta', component: { template: '<div />' } },
      { path: '/guru/pelajar/cipta', component: { template: '<div />' } },
      { path: '/guru/profil/edit', component: { template: '<div />' } },
    ],
  })
  await router.push('/guru/pelajar')
  await router.isReady()
  wrapper = mount(PelajarSayaPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  state = {
    mine: [
      student(3001, 'Murid Demo 01', ['2001']),
      student(3002, 'Murid Demo 02', ['2001', '2002']),
    ],
    school: [student(3001, 'Murid Demo 01', ['2001']), student(2, 'Murid Demo Dua')],
    schoolSet: true,
  }
  api.fetchGuruClasses.mockImplementation(() =>
    Promise.resolve({ data: [klass(2001, '2001'), klass(2002, '2002')], meta: {} }),
  )
  api.fetchGuruStudents.mockImplementation((p: { tab?: string }) =>
    Promise.resolve(
      p.tab === 'school'
        ? { data: state.school, meta: { count: state.school.length, schoolSet: state.schoolSet } }
        : { data: state.mine, meta: { count: state.mine.length, schoolSet: state.schoolSet } },
    ),
  )
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})

describe('S6 PelajarSayaPage', () => {
  it('shows the counter, the link, the tabs with the badge, and the mine rows by default', async () => {
    const w = await mountPage()
    expect(w.get('[data-testid="pelajar-count"]').text()).toBe('2')
    expect(w.text()).toContain('Pelajar dalam kelas saya')
    expect(w.get('[data-testid="pelajar-create"]').attributes('href')).toBe('/guru/pelajar/cipta')
    expect(w.get('[data-testid="pelajar-create"]').text()).toContain('Cipta')
    const tabs = w.findAll('[data-testid="pelajar-tabs"] button')
    expect(tabs.map((t) => t.text())).toEqual(['Pelajar Sekolah', 'Pelajar Saya 2'])
    expect(w.findAll('[data-testid="student-row"]')).toHaveLength(2)
    expect(w.findAll('[data-testid="student-name"]')[0]?.text()).toBe('Murid Demo 01')
  })

  it('shows the empty card with a link to the create-class page', async () => {
    state.mine = []
    const w = await mountPage()
    const empty = w.get('[data-testid="pelajar-empty"]')
    expect(empty.text()).toContain('Belum ada pelajar dalam kelas anda')
    expect(empty.text()).toContain('Buat kelas dan tambah pelajar dari senarai sekolah.')
    expect(w.get('[data-testid="pelajar-empty-create"]').attributes('href')).toBe(
      '/guru/kelas/cipta',
    )
  })

  it('shows the no-school card on the school tab with the class select', async () => {
    state.mine = []
    state.school = []
    state.schoolSet = false
    const w = await mountPage()
    await w.get('[data-testid="tab-school"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain('Tambah pelajar ke:')
    const options = w.findAll('[data-testid="pelajar-target"] option').map((o) => o.text())
    expect(options).toEqual(['-- Pilih kelas --', '2001', '2002'])
    const card = w.get('[data-testid="pelajar-no-school"]')
    expect(card.text()).toContain('Sekolah belum ditetapkan')
    expect(card.text()).toContain(
      'Sila tetapkan sekolah anda di Profil atau semasa cipta kelas untuk melihat senarai pelajar sekolah.',
    )
    expect(w.get('[data-testid="pelajar-profile-link"]').attributes('href')).toBe(
      '/guru/profil/edit',
    )
  })

  it('adds a school student to the chosen class and reloads', async () => {
    api.addStudentToClass.mockResolvedValue({})
    const w = await mountPage()
    await w.get('[data-testid="tab-school"]').trigger('click')
    await flushPromises()
    const rows = w.findAll('[data-testid="student-row"]')
    expect(rows).toHaveLength(2)
    // no class chosen: add is disabled
    expect(rows[1]?.get('[data-testid="student-add"]').attributes('disabled')).toBeDefined()

    await w.get('[data-testid="pelajar-target"]').setValue('2002')
    // student 3001 is not in 2002; student 2 is not either
    await w.findAll('[data-testid="student-add"]')[1]?.trigger('click')
    await flushPromises()
    expect(api.addStudentToClass).toHaveBeenCalledWith(2, { classroomId: 2002 })
    expect(useFlashStore().current).toMatchObject({ type: 'success', message: PELAJAR_COPY.added })
    // the lists were reloaded
    expect(
      api.fetchGuruStudents.mock.calls.filter(([p]) => p.tab === 'mine').length,
    ).toBeGreaterThan(1)
  })

  it('marks a student already in the chosen class instead of offering add', async () => {
    const w = await mountPage()
    await w.get('[data-testid="tab-school"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="pelajar-target"]').setValue('2001')
    expect(w.findAll('[data-testid="student-in-class"]')).toHaveLength(1)
  })

  it('shows the response message when an add is refused', async () => {
    api.addStudentToClass.mockRejectedValue(
      new ApiError({
        status: 409,
        code: 'CONFLICT',
        message: 'Pelajar sudah berada dalam kelas ini.',
      }),
    )
    const w = await mountPage()
    await w.get('[data-testid="tab-school"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="pelajar-target"]').setValue('2002')
    await w.findAll('[data-testid="student-add"]')[1]?.trigger('click')
    await flushPromises()
    expect(useFlashStore().current).toMatchObject({
      type: 'error',
      message: 'Pelajar sudah berada dalam kelas ini.',
    })
  })

  it('removes a student from a class after confirm, and sends nothing when dismissed', async () => {
    api.removeStudentFromClass.mockResolvedValue({ removed: 1 })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const w = await mountPage()
    const button = w.findAll('[data-testid="student-remove"]')[0]
    await button?.trigger('click')
    expect(api.removeStudentFromClass).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    await button?.trigger('click')
    await flushPromises()
    expect(api.removeStudentFromClass).toHaveBeenCalledWith(3001, 2001)
    expect(useFlashStore().current).toMatchObject({
      type: 'success',
      message: PELAJAR_COPY.removed,
    })
  })

  it('searches the school list by name after 300 ms', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const w = await mountPage()
    await w.get('[data-testid="tab-school"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="pelajar-search"]').setValue('Dua')
    await vi.advanceTimersByTimeAsync(350)
    await flushPromises()
    expect(api.fetchGuruStudents).toHaveBeenCalledWith(
      { tab: 'school', search: 'Dua' },
      expect.anything(),
    )
    vi.useRealTimers()
  })
})
