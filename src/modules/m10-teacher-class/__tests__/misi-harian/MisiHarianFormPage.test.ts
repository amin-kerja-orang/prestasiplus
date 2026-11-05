// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { clock, formatDateKey } from '@/lib/time'
import { useFlashStore } from '@/stores/flash'

import MisiHarianFormPage from '../../pages/MisiHarianFormPage.vue'

const api = vi.hoisted(() => ({ createTeacherMission: vi.fn(), fetchGuruClasses: vi.fn() }))
vi.mock('../../api/guru', () => api)
const subjects = vi.hoisted(() => ({ fetchSubjectOptions: vi.fn() }))
vi.mock('../../components/kelas/subjects', () => subjects)

let wrapper: VueWrapper | undefined

async function mountForm() {
  wrapper = mount(MisiHarianFormPage, { attachTo: document.body })
  await flushPromises()
  return wrapper
}

const T = (id: string) => `[data-testid="${id}"]`

async function fillValid(w: VueWrapper) {
  await w.get(T('misi-title')).setValue('Jawab 10 soalan')
  await w.get(T('misi-subject')).setValue('4')
}

async function submit(w: VueWrapper) {
  await w.get(T('misi-form')).trigger('submit')
  await flushPromises()
}

const errorText = (w: VueWrapper): string =>
  w
    .findAll('[data-testid="field-error"]')
    .map((e) => e.text())
    .join('|')

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.fetchGuruClasses.mockResolvedValue({
    data: [
      { id: 7, name: '5 Amanah', isActive: true },
      { id: 8, name: '4 Lama', isActive: false },
    ],
    meta: {},
  })
  subjects.fetchSubjectOptions.mockResolvedValue([
    { id: 1, name: 'Bahasa Melayu' },
    { id: 4, name: 'Sains' },
  ])
  api.createTeacherMission.mockResolvedValue({ id: 'm1' })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})

describe('R1-GUR-2b MisiHarianFormPage', () => {
  it('AC-GUR-2b-1: shows the seven fields with their defaults and options', async () => {
    const w = await mountForm()
    expect(w.text()).toContain('Cipta Misi')
    for (const label of [
      'Tajuk Misi',
      'Keterangan (opsional)',
      'Sasaran Soalan',
      'Ganjaran Syiling',
      'Tarikh',
      'Kelas (opsional)',
      'Subjek',
    ]) {
      expect(w.text()).toContain(label)
    }
    expect((w.get(T('misi-title')).element as HTMLInputElement).value).toBe('')
    expect((w.get(T('misi-title')).element as HTMLInputElement).placeholder).toBe(
      'cth: Jawab 20 soalan Matematik',
    )
    expect((w.get(T('misi-target')).element as HTMLInputElement).value).toBe('10')
    expect((w.get(T('misi-reward')).element as HTMLInputElement).value).toBe('10')
    expect((w.get(T('misi-date')).element as HTMLInputElement).value).toBe(
      formatDateKey(clock.now()),
    )
    expect(w.get(T('misi-class')).text()).toContain('Semua kelas saya')
    expect(w.get(T('misi-class')).text()).toContain('5 Amanah')
    expect(w.get(T('misi-class')).text()).not.toContain('4 Lama')
    expect(w.get(T('misi-subject')).text()).toContain('-- Pilih subjek --')
    expect(w.get(T('misi-subject')).text()).toContain('Sains')
    expect(w.get(T('misi-submit')).text()).toBe('Cipta Misi')
  })

  it('AC-GUR-2b-5: Sasaran Soalan 0 shows the message and creates nothing', async () => {
    const w = await mountForm()
    await fillValid(w)
    await w.get(T('misi-target')).setValue('0')
    await submit(w)
    expect(errorText(w)).toBe('Sasaran soalan mesti antara 1 dan 1000.')
    expect(api.createTeacherMission).not.toHaveBeenCalled()
  })

  it('AC-GUR-2b-8: Subjek left at "-- Pilih subjek --" shows "Sila pilih subjek."', async () => {
    const w = await mountForm()
    await w.get(T('misi-title')).setValue('Jawab 10 soalan')
    await submit(w)
    expect(errorText(w)).toBe('Sila pilih subjek.')
    expect(api.createTeacherMission).not.toHaveBeenCalled()
  })

  it('validates the title, reward and the date client-side with the contract messages', async () => {
    const w = await mountForm()
    await w.get(T('misi-subject')).setValue('4')
    await w.get(T('misi-reward')).setValue('101')
    await w.get(T('misi-date')).setValue('2020-01-01')
    await submit(w)
    expect(errorText(w).split('|')).toEqual([
      'Sila isi tajuk misi.',
      'Ganjaran syiling mesti antara 0 dan 100.',
      'Tarikh tidak boleh lebih awal daripada hari ini.',
    ])
    await w.get(T('misi-title')).setValue('x'.repeat(256))
    await submit(w)
    expect(errorText(w)).toContain('Tajuk misi tidak boleh melebihi 255 aksara.')
    expect(api.createTeacherMission).not.toHaveBeenCalled()
  })

  it('shows each 422 field message under its field', async () => {
    const fields = {
      title: 'Sila isi tajuk misi.',
      description: 'Keterangan tidak boleh melebihi 500 aksara.',
      targetQuestions: 'Sasaran soalan mesti antara 1 dan 1000.',
      rewardCoins: 'Ganjaran syiling mesti antara 0 dan 100.',
      date: 'Tarikh tidak boleh lebih awal daripada hari ini.',
      subjectId: 'Sila pilih subjek.',
    }
    api.createTeacherMission.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Data tidak sah.',
        fields,
      }),
    )
    const w = await mountForm()
    await fillValid(w)
    await submit(w)
    expect(errorText(w).split('|')).toEqual(Object.values(fields))
    expect(w.find(T('misi-failure')).exists()).toBe(false)
  })

  it('AC-GUR-2b-1: the daily cap message shows in the form failure region', async () => {
    api.createTeacherMission.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Had 5 misi sehari telah dicapai.',
      }),
    )
    const w = await mountForm()
    await fillValid(w)
    await submit(w)
    expect(w.get(T('misi-failure')).text()).toContain('Had 5 misi sehari telah dicapai.')
    expect(w.emitted('created')).toBeUndefined()
  })

  it('a network or server failure shows the fixed BM line, never the English default', async () => {
    api.createTeacherMission.mockRejectedValue(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Server Error' }),
    )
    const w = await mountForm()
    await fillValid(w)
    await submit(w)
    expect(w.get(T('misi-failure')).text()).toBe('Misi tidak dapat disimpan. Sila cuba lagi.')
  })

  it('AC-GUR-2b-1: success sends the body, shows "Misi dicipta." and emits created', async () => {
    const flash = useFlashStore()
    const w = await mountForm()
    await w.get(T('misi-title')).setValue('  Jawab 10 soalan ')
    await w.get(T('misi-description')).setValue('Fokus Bab 3')
    await w.get(T('misi-class')).setValue('7')
    await w.get(T('misi-subject')).setValue('4')
    await submit(w)
    expect(api.createTeacherMission).toHaveBeenCalledWith({
      title: 'Jawab 10 soalan',
      description: 'Fokus Bab 3',
      targetQuestions: 10,
      rewardCoins: 10,
      date: formatDateKey(clock.now()),
      classroomId: '7',
      subjectId: '4',
    })
    expect(flash.current).toEqual({ type: 'success', message: 'Misi dicipta.' })
    expect(w.emitted('created')).toHaveLength(1)
  })

  it('"Semua kelas saya" sends classroomId null and an empty description null', async () => {
    const w = await mountForm()
    await fillValid(w)
    await submit(w)
    expect(api.createTeacherMission).toHaveBeenCalledWith(
      expect.objectContaining({ classroomId: null, description: null }),
    )
  })

  it('busy state: the button reads "Menyimpan..." and is disabled while saving', async () => {
    let resolve!: (v: unknown) => void
    api.createTeacherMission.mockReturnValue(new Promise((r) => (resolve = r)))
    const w = await mountForm()
    await fillValid(w)
    await w.get(T('misi-form')).trigger('submit')
    await flushPromises()
    expect(w.get(T('misi-submit')).text()).toBe('Menyimpan...')
    expect(w.get(T('misi-submit')).attributes('disabled')).toBeDefined()
    resolve({ id: 'm1' })
    await flushPromises()
    expect(w.get(T('misi-submit')).text()).toBe('Cipta Misi')
  })
})
