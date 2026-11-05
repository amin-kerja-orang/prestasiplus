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
  createGuruStudent: vi.fn(),
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
  username: null,
  tugasan: 0,
  skorPurata: null,
  lastActiveAt: null,
})

let state: {
  mine: GuruStudent[]
  school: GuruStudent[]
  schoolSet: boolean
}

let wrapper: VueWrapper | undefined

async function mountPage(path = '/guru/pelajar') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guru/pelajar', component: { template: '<div />' } },
      { path: '/guru/kelas/cipta', component: { template: '<div />' } },
      { path: '/guru/pelajar/cipta', component: { template: '<div />' } },
      { path: '/guru/profil/edit', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(PelajarSayaPage, {
    props: { create: path === '/guru/pelajar/cipta' },
    global: { plugins: [router] },
  })
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
    expect(w.get('[data-testid="pelajar-value"]').text()).toBe('2')
    expect(w.text()).toContain('Pelajar dalam kelas saya')
    expect(w.get('[data-testid="pelajar-create"]').attributes('href')).toBe('/guru/pelajar/cipta')
    expect(w.get('[data-testid="pelajar-create"]').text()).toContain('Cipta')
    const tabs = w.findAll('[data-testid="pelajar-tabs"] button')
    expect(tabs.map((t) => t.text())).toEqual(['Pelajar Sekolah', 'Pelajar Saya (2)'])
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
    // AC-GUR-41-7: the button is enabled; with no class chosen it explains and adds nobody
    expect(rows[1]?.get('[data-testid="student-add"]').attributes('disabled')).toBeUndefined()
    await rows[1]?.get('[data-testid="student-add"]').trigger('click')
    await flushPromises()
    expect(api.addStudentToClass).not.toHaveBeenCalled()
    expect(useFlashStore().current).toMatchObject({ type: 'error', message: 'Sila pilih kelas dahulu.' })
    expect(w.get('[data-testid="pelajar-target-error"]').text()).toBe('Sila pilih kelas dahulu.')

    await w.get('[data-testid="pelajar-target"]').setValue('2002')
    // student 3001 is not in 2002; student 2 is not either
    await w.findAll('[data-testid="student-add"]')[1]?.trigger('click')
    await flushPromises()
    expect(api.addStudentToClass).toHaveBeenCalledWith(2, { classroomId: '2002' })
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

  it('flashes the BM action-failed text for a 500, a lost connection and a generic 403 (SWE-10)', async () => {
    for (const error of [
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }),
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' }),
      new ApiError({ status: 403, code: 'FORBIDDEN', message: 'This action is unauthorized.' }),
    ]) {
      api.addStudentToClass.mockRejectedValueOnce(error)
      const w = await mountPage()
      await w.get('[data-testid="tab-school"]').trigger('click')
      await flushPromises()
      await w.get('[data-testid="pelajar-target"]').setValue('2002')
      await w.findAll('[data-testid="student-add"]')[1]?.trigger('click')
      await flushPromises()
      expect(useFlashStore().current).toMatchObject({
        type: 'error',
        message: 'Tindakan tidak berjaya. Sila cuba lagi.',
      })
      w.unmount()
    }
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

  describe('two classes with the same name (SW5-03)', () => {
    const twin = (id: number) => ({ id, name: 'Kelas Kembar' })

    beforeEach(() => {
      api.fetchGuruClasses.mockImplementation(() =>
        Promise.resolve({
          data: [klass(2001, 'Kelas Kembar'), klass(2002, 'Kelas Kembar')],
          meta: {},
        }),
      )
      state.mine = [
        {
          ...student(3001, 'Murid Demo 01', ['Kelas Kembar', 'Kelas Kembar']),
          classes: [twin(2001), twin(2002)],
        },
      ]
      state.school = [
        { ...student(3001, 'Murid Demo 01', ['Kelas Kembar']), classes: [twin(2001)] },
        { ...student(3002, 'Murid Demo 02', ['Kelas Kembar']), classes: [twin(2002)] },
        student(3003, 'Murid Demo 03'),
      ]
    })

    it('shows one chip per class, each with its own remove button', async () => {
      api.removeStudentFromClass.mockResolvedValue({ removed: 1 })
      vi.spyOn(window, 'confirm').mockReturnValue(true)
      const w = await mountPage()
      const chips = w.findAll('[data-testid="student-class"]')
      expect(chips.map((c) => c.text())).toEqual(['Kelas Kembar', 'Kelas Kembar'])
      const buttons = w.findAll('[data-testid="student-remove"]')
      expect(buttons).toHaveLength(2)

      await buttons[1]?.trigger('click')
      await flushPromises()
      expect(api.removeStudentFromClass).toHaveBeenCalledWith(3001, 2002)
    })

    it('marks "already in class" per class id, not per name', async () => {
      const w = await mountPage()
      await w.get('[data-testid="tab-school"]').trigger('click')
      await flushPromises()
      const inClass = () =>
        w
          .findAll('[data-testid="student-row"]')
          .filter((r) => r.find('[data-testid="student-in-class"]').exists())
          .map((r) => r.attributes('data-student-id'))

      expect(inClass()).toEqual([])
      await w.get('[data-testid="pelajar-target"]').setValue('2001')
      expect(inClass()).toEqual(['3001'])
      await w.get('[data-testid="pelajar-target"]').setValue('2002')
      expect(inClass()).toEqual(['3002'])
    })

    it('falls back to the names when the API sends no classes', async () => {
      state.school = [
        student(3001, 'Murid Demo 01', ['Kelas Kembar']),
        student(3002, 'Murid Demo 02'),
      ]
      const w = await mountPage()
      await w.get('[data-testid="tab-school"]').trigger('click')
      await flushPromises()
      await w.get('[data-testid="pelajar-target"]').setValue('2001')
      expect(w.findAll('[data-testid="student-in-class"]')).toHaveLength(1)
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
      { tab: 'school', search: 'Dua', page: 1 },
      expect.anything(),
    )
    vi.useRealTimers()
  })

  describe('R1-GUR-41 columns (AC-GUR-41-6)', () => {
    it('shows username beneath the name, Tahap, Tugasan, Skor Purata and Terakhir Aktif (dd/mm/yyyy MYT)', async () => {
      state.mine = [
        {
          ...student(3001, 'Murid Demo 01', ['2001']),
          username: 'murid.demo01',
          tugasan: 3,
          skorPurata: 70,
          lastActiveAt: '2026-11-04T23:30:00.000+08:00',
        },
        student(3002, 'Murid Demo 02', ['2001']),
      ]
      const w = await mountPage()
      const [first, second] = w.findAll('[data-testid="student-row"]')
      expect(first?.text()).toContain('murid.demo01')
      expect(first?.get('[data-testid="student-tahap"]').text()).toBe('Tahap: Tingkatan 5')
      expect(first?.get('[data-testid="student-tugasan"]').text()).toBe('Tugasan: 3')
      expect(first?.get('[data-testid="student-skor"]').text()).toBe('Skor Purata: 70%')
      expect(first?.get('[data-testid="student-active"]').text()).toBe('Terakhir Aktif: 04/11/2026')
      expect(second?.get('[data-testid="student-skor"]').text()).toBe('Skor Purata: \u2014')
      expect(second?.get('[data-testid="student-active"]').text()).toBe('Terakhir Aktif: \u2014')
    })

    it('pages 25 per page: the pager shows when the API reports more than one page and asks the next page', async () => {
      api.fetchGuruStudents.mockImplementation((p: { tab?: string; page?: number }) =>
        Promise.resolve({
          data: state.mine,
          meta: { count: 30, schoolSet: true, page: p.page ?? 1, pageSize: 25, totalPages: 2 },
        }),
      )
      const w = await mountPage()
      expect(w.find('[data-testid="pelajar-mine-pager"]').exists()).toBe(true)
      await w.get('[data-testid="pelajar-mine-pager"] button[value="2"]').trigger('click')
      await flushPromises()
      expect(api.fetchGuruStudents).toHaveBeenLastCalledWith({ tab: 'mine', page: 2 }, expect.anything())
    })
  })

  describe('R1-GUR-41 Cipta Pelajar (AC-GUR-41-2, FR-GUR-8-7)', () => {
    const fill = async (w: VueWrapper, name: string, ic = '') => {
      await w.get('[data-testid="pelajar-new-name"]').setValue(name)
      await w.get('[data-testid="pelajar-new-class"]').setValue('2001')
      await w.get('[data-testid="pelajar-new-ic"]').setValue(ic)
      await w.get('[data-testid="pelajar-create-form"]').trigger('submit')
      await flushPromises()
    }

    it('the card is closed on /guru/pelajar and open on /guru/pelajar/cipta (no redirect)', async () => {
      const closed = await mountPage()
      expect(closed.find('[data-testid="pelajar-create-card"]').exists()).toBe(false)
      closed.unmount()
      const open = await mountPage('/guru/pelajar/cipta')
      expect(open.get('[data-testid="pelajar-create-card"]').text()).toContain(
        'Tambah pelajar baharu terus ke dalam salah satu kelas anda.',
      )
    })

    it('creates the pupil, shows the server message until dismissed and reloads the list', async () => {
      api.createGuruStudent.mockResolvedValue({
        id: '9',
        name: 'Murid Contoh',
        username: 'murid.contoh01',
        message: 'Pelajar dicipta. Login: murid.contoh01 / contoh-kata',
      })
      const w = await mountPage('/guru/pelajar/cipta')
      const before = api.fetchGuruStudents.mock.calls.length
      await fill(w, '  Murid Contoh ', '123456121234')
      expect(api.createGuruStudent).toHaveBeenCalledWith({
        name: 'Murid Contoh',
        classroomId: '2001',
        ic: '123456121234',
      })
      expect(w.get('[data-testid="pelajar-created"]').text()).toContain(
        'Pelajar dicipta. Login: murid.contoh01 / contoh-kata',
      )
      expect(api.fetchGuruStudents.mock.calls.length).toBeGreaterThan(before)
      await w.get('[data-testid="pelajar-created"] button').trigger('click')
      expect(w.find('[data-testid="pelajar-created"]').exists()).toBe(false)
    })

    it('client checks use the contract messages and send nothing', async () => {
      const w = await mountPage('/guru/pelajar/cipta')
      await w.get('[data-testid="pelajar-create-form"]').trigger('submit')
      await flushPromises()
      expect(w.text()).toContain('Sila isi nama.')
      expect(w.text()).toContain('Sila pilih kelas.')
      for (const ic of ['12345678901', '123456-12-1234']) {
        await fill(w, 'Murid Contoh', ic)
        expect(w.text()).toContain('No. IC mesti 12 digit tanpa sempang.')
      }
      await fill(w, 'a'.repeat(256))
      expect(w.text()).toContain('Nama tidak boleh melebihi 255 aksara.')
      expect(api.createGuruStudent).not.toHaveBeenCalled()
    })

    it('shows a duplicate IC from the server under the IC field', async () => {
      api.createGuruStudent.mockRejectedValue(
        new ApiError({
          status: 409,
          code: 'CONFLICT',
          message: 'No. IC sudah didaftarkan.',
          fields: { ic: 'No. IC sudah didaftarkan.' },
        }),
      )
      const w = await mountPage('/guru/pelajar/cipta')
      await fill(w, 'Murid Contoh', '123456121234')
      expect(w.text()).toContain('No. IC sudah didaftarkan.')
      expect(w.find('[data-testid="pelajar-created"]').exists()).toBe(false)
    })

    it('a teacher without an active class sees "Anda belum ada kelas aktif. Cipta kelas dahulu."', async () => {
      api.fetchGuruClasses.mockImplementation(() => Promise.resolve({ data: [], meta: {} }))
      const w = await mountPage('/guru/pelajar/cipta')
      expect(w.get('[data-testid="pelajar-create-no-class"]').text()).toBe(
        'Anda belum ada kelas aktif. Cipta kelas dahulu.',
      )
      expect(w.find('[data-testid="pelajar-create-form"]').exists()).toBe(false)
    })

    it('preselects the class when the teacher has exactly one', async () => {
      api.fetchGuruClasses.mockImplementation(() =>
        Promise.resolve({ data: [klass(2001, '2001')], meta: {} }),
      )
      const w = await mountPage('/guru/pelajar/cipta')
      expect(
        (w.get('[data-testid="pelajar-new-class"]').element as HTMLSelectElement).value,
      ).toBe('2001')
    })
  })

  it('keeps the contract copy in step with the app copy', async () => {
    const { GURU_STUDENT_MESSAGES } = await import('@pp/contract')
    expect(PELAJAR_COPY.errName).toBe(GURU_STUDENT_MESSAGES.name)
    expect(PELAJAR_COPY.errNameMax).toBe(GURU_STUDENT_MESSAGES.nameMax)
    expect(PELAJAR_COPY.errClass).toBe(GURU_STUDENT_MESSAGES.classroom)
    expect(PELAJAR_COPY.errIc).toBe(GURU_STUDENT_MESSAGES.ic)
    expect(PELAJAR_COPY.noActiveClass).toBe(GURU_STUDENT_MESSAGES.noActiveClass)
    expect(PELAJAR_COPY.chooseClassFirst).toBe(GURU_STUDENT_MESSAGES.chooseClassFirst)
    expect(PELAJAR_COPY.added).toBe(GURU_STUDENT_MESSAGES.added)
    expect(PELAJAR_COPY.removed).toBe(GURU_STUDENT_MESSAGES.removed)
  })
})
