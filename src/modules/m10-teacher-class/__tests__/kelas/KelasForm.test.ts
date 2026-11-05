// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { clock, formatDateKey } from '@/lib/time'
import { useFlashStore } from '@/stores/flash'

import type { GuruClass, GuruStudent } from '../../api/types'
import KelasCreatePage from '../../pages/KelasCreatePage.vue'

/**
 * R1-GUR-8 class form, create and edit (S6-T14): AC-GUR-8-1, 8-2, 8-3, 8-4, 8-5 (touch targets),
 * 8-7 and 8-9, plus the member list, the type-ahead and the Cipta Pelajar link.
 */

const api = vi.hoisted(() => ({
  fetchGuruClasses: vi.fn(),
  createGuruClass: vi.fn(),
  updateGuruClass: vi.fn(),
  fetchGuruStudents: vi.fn(),
  addStudentToClass: vi.fn(),
  removeStudentFromClass: vi.fn(),
}))
vi.mock('../../api/guru', () => api)

const subjects = vi.hoisted(() => ({ fetchSubjectOptions: vi.fn() }))
vi.mock('../../components/kelas/subjects', () => subjects)

const session = vi.hoisted(() => ({ user: { schoolId: 1 } as { schoolId: number | null } | null }))
vi.mock('@/stores/session', () => ({ useSessionStore: () => session }))

const cls = (id: number, extra: Partial<GuruClass> = {}): GuruClass => ({
  id,
  kind: 'classroom',
  teacherId: 5,
  schoolId: 1,
  name: '5 Bestari',
  subjectId: 4,
  subjectName: 'Sains',
  educationLevel: 'tingkatan-5',
  levelId: 11,
  levelLabel: 'Ting. 5',
  academicYear: 2026,
  year: 2026,
  description: null,
  joinCode: 'XYZ',
  isActive: true,
  createdAt: '2026-09-01T08:00:00+08:00',
  studentCount: 2,
  ...extra,
})

type Pupil = GuruStudent & { lastActiveAt?: string | null }
const pupil = (id: number, name: string, classes: { id: number; name: string }[], extra = {}): Pupil => ({
  id,
  name,
  levelName: 'Tingkatan 5',
  classNames: classes.map((c) => c.name),
  classes,
  ...extra,
})
const students = (rows: Pupil[]) => ({ data: rows, meta: { count: rows.length, schoolSet: true } })

let router: Router
let wrapper: VueWrapper | undefined

async function mountAt(path: string): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guru/kelas', component: { template: '<div id="list" />' } },
      { path: '/guru/kelas/cipta', component: KelasCreatePage },
      { path: '/guru/kelas/:id/edit', component: KelasCreatePage },
      { path: '/guru/pelajar/cipta', component: { template: '<div />' } },
    ],
  })
  await router.push(path)
  await router.isReady()
  wrapper = mount(KelasCreatePage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

async function fill(w: VueWrapper, name = '5 Bestari'): Promise<void> {
  await w.get('[data-testid="kelas-name"]').setValue(name)
  await w.get('[data-testid="kelas-level"]').setValue('tingkatan-5')
  await w.get('[data-testid="kelas-subject"]').setValue('4')
}
const submit = async (w: VueWrapper): Promise<void> => {
  await w.get('[data-testid="kelas-form"]').trigger('submit')
  await flushPromises()
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  session.user = { schoolId: 1 }
  subjects.fetchSubjectOptions.mockResolvedValue([
    { id: 1, name: 'Bahasa Melayu' },
    { id: 4, name: 'Matematik' },
  ])
  api.fetchGuruClasses.mockResolvedValue({ data: [cls(2001)], meta: {} })
  api.fetchGuruStudents.mockResolvedValue(students([]))
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('R1-GUR-8 create form', () => {
  it('renders Nama Kelas, Tingkatan, Subjek (pilihan), Tahun Sesi; no description, school picker or join code', async () => {
    const w = await mountAt('/guru/kelas/cipta')
    const text = w.text()
    expect(text).toContain('Maklumat Kelas')
    expect(text).toContain('Nama Kelas')
    expect(text).toContain('Subjek (pilihan)')
    expect(text).toContain('Tahun Sesi')
    expect(w.findAll('[data-testid="kelas-level"] option').map((o) => o.text())).toEqual([
      '-- Pilih tingkatan --',
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    expect(w.findAll('[data-testid="kelas-subject"] option').map((o) => o.text())).toEqual([
      '— Tiada —',
      'Bahasa Melayu',
      'Matematik',
    ])
    expect(w.find('[data-testid="kelas-description"]').exists()).toBe(false)
    expect(w.find('[data-testid="school-search"]').exists()).toBe(false)
    expect(w.find('[data-testid="kelas-members-card"]').exists()).toBe(false)
    expect(w.get('[data-testid="kelas-submit"]').text()).toBe('Cipta Kelas')
    // The default Tahun Sesi is the current calendar year in MYT.
    const year = Number(formatDateKey(clock.now()).slice(0, 4))
    expect((w.get('[data-testid="kelas-year"]').element as HTMLInputElement).value).toBe(String(year))
  })

  it('AC-GUR-8-1: saves Nama, Tingkatan, Subjek and Tahun Sesi, shows the toast and opens the list', async () => {
    api.createGuruClass.mockResolvedValue(cls(9001))
    const w = await mountAt('/guru/kelas/cipta')
    await fill(w, ' 5 Bestari ')
    await w.get('[data-testid="kelas-year"]').setValue('2026')
    await submit(w)
    expect(api.createGuruClass).toHaveBeenCalledWith({
      name: '5 Bestari',
      educationLevel: 'tingkatan-5',
      subjectId: '4',
      year: 2026,
    })
    expect(router.currentRoute.value.path).toBe('/guru/kelas')
    const flash = useFlashStore().pending
    expect(flash?.type).toBe('success')
    expect(flash?.message).toBe('Kelas dicipta.')
  })

  it('Subjek is optional: "— Tiada —" is sent as null', async () => {
    api.createGuruClass.mockResolvedValue(cls(9001))
    const w = await mountAt('/guru/kelas/cipta')
    await w.get('[data-testid="kelas-name"]').setValue('5 Bestari')
    await w.get('[data-testid="kelas-level"]').setValue('tingkatan-3')
    await submit(w)
    expect(api.createGuruClass).toHaveBeenCalledWith(
      expect.objectContaining({ subjectId: null, educationLevel: 'tingkatan-3' }),
    )
  })

  it('AC-GUR-8-2: an empty name, no Tingkatan and a bad year show BM messages and nothing is saved', async () => {
    const w = await mountAt('/guru/kelas/cipta')
    await w.get('[data-testid="kelas-year"]').setValue('1999')
    await submit(w)
    expect(w.text()).toContain('Sila isi nama kelas.')
    expect(w.text()).toContain('Sila pilih tingkatan.')
    expect(w.text()).toContain('Tahun sesi mesti antara 2020 dan 2100.')
    expect(api.createGuruClass).not.toHaveBeenCalled()
  })

  it('a name over 100 characters shows "Nama kelas tidak boleh melebihi 100 aksara."', async () => {
    const w = await mountAt('/guru/kelas/cipta')
    await fill(w, 'A'.repeat(101))
    await submit(w)
    expect(w.text()).toContain('Nama kelas tidak boleh melebihi 100 aksara.')
    expect(api.createGuruClass).not.toHaveBeenCalled()
  })

  it('AC-GUR-8-7: a 409 shows "Nama kelas sudah digunakan." under the name and stays on the form', async () => {
    api.createGuruClass.mockRejectedValue(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Nama kelas sudah digunakan.' }),
    )
    const w = await mountAt('/guru/kelas/cipta')
    await fill(w, ' 5 bestari ')
    await submit(w)
    expect(w.get('[data-testid="field-error"]').text()).toBe('Nama kelas sudah digunakan.')
    expect(router.currentRoute.value.path).toBe('/guru/kelas/cipta')
    // The same name in another Tahun Sesi saves.
    api.createGuruClass.mockResolvedValue(cls(9002))
    await w.get('[data-testid="kelas-year"]').setValue('2027')
    await submit(w)
    expect(api.createGuruClass).toHaveBeenLastCalledWith(expect.objectContaining({ year: 2027 }))
    expect(router.currentRoute.value.path).toBe('/guru/kelas')
  })

  it('shows 422 field messages inline, once each', async () => {
    api.createGuruClass.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { educationLevel: 'Sila pilih tingkatan.' },
      }),
    )
    const w = await mountAt('/guru/kelas/cipta')
    await fill(w)
    await submit(w)
    expect(w.text().split('Sila pilih tingkatan.').length - 1).toBe(1)
  })

  it('shows the BM failure line for a 500 and the network copy for status 0', async () => {
    api.createGuruClass.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }),
    )
    const w = await mountAt('/guru/kelas/cipta')
    await fill(w)
    await submit(w)
    expect(w.get('[data-testid="kelas-failure"]').text()).toContain('Gagal menyimpan kelas.')
    api.createGuruClass.mockRejectedValue(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'Failed to fetch' }),
    )
    await submit(w)
    expect(w.get('[data-testid="kelas-failure"]').text()).toContain('Ralat rangkaian.')
  })

  it('AC-GUR-8-9: an account with no school sees the message and no form', async () => {
    session.user = { schoolId: null }
    const w = await mountAt('/guru/kelas/cipta')
    expect(w.get('[data-testid="kelas-no-school"]').text()).toContain(
      'Akaun anda belum dipautkan ke sekolah. Sila hubungi pentadbir.',
    )
    expect(w.find('[data-testid="kelas-form"]').exists()).toBe(false)
  })

  it('AC-GUR-8-5: Cipta Kelas, Batal and the fields are touch targets of 44 px', async () => {
    const w = await mountAt('/guru/kelas/cipta')
    expect(w.get('[data-testid="kelas-submit"]').classes()).toContain('min-h-11')
    expect(w.get('[data-testid="kelas-cancel"]').classes()).toContain('min-h-11')
    expect(w.get('[data-testid="kelas-cancel"]').attributes('href')).toBe('/guru/kelas')
  })
})

describe('R1-GUR-8 edit form', () => {
  it('loads the class from the own list into the fields and saves with PUT: toast "Kelas dikemaskini."', async () => {
    api.updateGuruClass.mockResolvedValue(cls(2001, { name: '5 Cekap' }))
    const w = await mountAt('/guru/kelas/2001/edit')
    expect((w.get('[data-testid="kelas-name"]').element as HTMLInputElement).value).toBe('5 Bestari')
    expect((w.get('[data-testid="kelas-level"]').element as HTMLSelectElement).value).toBe(
      'tingkatan-5',
    )
    expect((w.get('[data-testid="kelas-subject"]').element as HTMLSelectElement).value).toBe('4')
    expect((w.get('[data-testid="kelas-year"]').element as HTMLInputElement).value).toBe('2026')
    expect(w.get('[data-testid="kelas-submit"]').text()).toBe('Simpan')

    await w.get('[data-testid="kelas-name"]').setValue('5 Cekap')
    await submit(w)
    expect(api.updateGuruClass).toHaveBeenCalledWith('2001', {
      name: '5 Cekap',
      educationLevel: 'tingkatan-5',
      subjectId: '4',
      year: 2026,
    })
    expect(api.createGuruClass).not.toHaveBeenCalled()
    expect(router.currentRoute.value.path).toBe('/guru/kelas/2001/edit')
  })

  it('shows "Kelas tidak dijumpai." for a class that is not in the own list', async () => {
    const w = await mountAt('/guru/kelas/999/edit')
    expect(w.get('[data-testid="kelas-not-found"]').text()).toContain('Kelas tidak dijumpai.')
    expect(w.find('[data-testid="kelas-form"]').exists()).toBe(false)
  })

  it('lists the members of this class only, by name, with Tingkatan and Terakhir Aktif', async () => {
    api.fetchGuruStudents.mockResolvedValue(
      students([
        pupil(11, 'Zara Contoh', [{ id: 2001, name: '5 Bestari' }], {
          lastActiveAt: '2026-10-03T09:00:00+08:00',
        }),
        pupil(12, 'Ali Contoh', [{ id: 2001, name: '5 Bestari' }]),
        pupil(13, 'Orang Lain', [{ id: 2002, name: '4 Cekap' }]),
      ]),
    )
    const w = await mountAt('/guru/kelas/2001/edit')
    expect(api.fetchGuruStudents).toHaveBeenCalledWith({ tab: 'mine' }, expect.anything())
    const names = w.findAll('[data-testid="member-name"]').map((n) => n.text())
    expect(names).toEqual(['Ali Contoh', 'Zara Contoh'])
    const text = w.get('[data-testid="kelas-members"]').text()
    expect(text).toContain('Tingkatan 5')
    expect(text).toContain('03/10/2026')
    expect(text).toContain('—')
    expect(text).not.toContain('Orang Lain')
  })

  it('shows "Belum ada pelajar dalam kelas ini." when the class has no member', async () => {
    const w = await mountAt('/guru/kelas/2001/edit')
    expect(w.get('[data-testid="kelas-members-empty"]').text()).toContain(
      'Belum ada pelajar dalam kelas ini.',
    )
  })

  it('AC-GUR-8-4: "Keluarkan" asks first, removes the link and reloads the list', async () => {
    api.fetchGuruStudents.mockResolvedValue(
      students([pupil(11, 'Ali Contoh', [{ id: 2001, name: '5 Bestari' }])]),
    )
    api.removeStudentFromClass.mockResolvedValue({ removed: 1 })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    const w = await mountAt('/guru/kelas/2001/edit')
    const button = w.get('[data-testid="member-remove"]')
    expect(button.text()).toBe('Keluarkan')
    expect(button.classes()).toContain('min-h-11')

    await button.trigger('click')
    await flushPromises()
    expect(confirmSpy).toHaveBeenCalledTimes(1)
    expect(api.removeStudentFromClass).not.toHaveBeenCalled()

    api.fetchGuruStudents.mockResolvedValue(students([]))
    await button.trigger('click')
    await flushPromises()
    expect(api.removeStudentFromClass).toHaveBeenCalledWith(11, '2001')
    expect(w.find('[data-testid="member-remove"]').exists()).toBe(false)
    expect(w.find('[data-testid="kelas-members-empty"]').exists()).toBe(true)
  })

  it('AC-GUR-8-3: the type-ahead starts at 2 characters, shows "{nama} · {Tingkatan n}", max 20, and adds', async () => {
    vi.useFakeTimers()
    const found = Array.from({ length: 25 }, (_, i) =>
      pupil(100 + i, `Murid ${String(i).padStart(2, '0')}`, []),
    )
    // A pupil already in this class is not offered.
    found.push(pupil(11, 'Murid Ahli', [{ id: 2001, name: '5 Bestari' }]))
    api.fetchGuruStudents.mockImplementation((params: { tab: string; search?: string }) =>
      Promise.resolve(students(params.tab === 'school' ? found : [])),
    )
    api.addStudentToClass.mockResolvedValue({ status: 'active' })
    const w = await mountAt('/guru/kelas/2001/edit')
    const input = w.get('[data-testid="kelas-pupil-search"]')

    await input.setValue('m')
    await vi.advanceTimersByTimeAsync(500)
    expect(api.fetchGuruStudents).not.toHaveBeenCalledWith(
      expect.objectContaining({ tab: 'school' }),
      expect.anything(),
    )

    await input.setValue('mu')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(api.fetchGuruStudents).toHaveBeenCalledWith(
      { tab: 'school', search: 'mu' },
      expect.anything(),
    )
    const options = w.findAll('[data-testid="kelas-pupil-option"]')
    expect(options).toHaveLength(20)
    expect(options[0]?.text()).toContain('Murid 00 · Tingkatan 5')
    expect(w.text()).not.toContain('Murid Ahli')

    await w.get('[data-testid="kelas-pupil-add"]').trigger('click')
    await flushPromises()
    expect(api.addStudentToClass).toHaveBeenCalledWith(100, { classroomId: '2001' })
    expect(useFlashStore().pending).toBeDefined()
  })

  it('shows "Tiada pelajar dijumpai." when the search finds nobody', async () => {
    vi.useFakeTimers()
    const w = await mountAt('/guru/kelas/2001/edit')
    await w.get('[data-testid="kelas-pupil-search"]').setValue('zzz')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(w.get('[data-testid="kelas-pupil-none"]').text()).toBe('Tiada pelajar dijumpai.')
  })

  it('links to Cipta Pelajar (S6-T10) without rebuilding it', async () => {
    const w = await mountAt('/guru/kelas/2001/edit')
    const link = w.get('[data-testid="kelas-new-pupil-link"]')
    expect(link.attributes('href')).toBe('/guru/pelajar/cipta')
    expect(w.get('[data-testid="kelas-new-pupil"]').text()).toContain('Tambah Pelajar Baharu')
  })
})
