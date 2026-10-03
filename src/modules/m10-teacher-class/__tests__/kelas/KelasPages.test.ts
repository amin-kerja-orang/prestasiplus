// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { GuruClass } from '../../api/types'
import KelasCreatePage from '../../pages/KelasCreatePage.vue'
import KelasListPage from '../../pages/KelasListPage.vue'

const api = vi.hoisted(() => ({
  fetchGuruClasses: vi.fn(),
  fetchClassQrData: vi.fn(),
  createGuruClass: vi.fn(),
}))
vi.mock('../../api/guru', () => api)

const subjects = vi.hoisted(() => ({ fetchSubjectOptions: vi.fn() }))
vi.mock('../../components/kelas/subjects', () => subjects)

const schools = vi.hoisted(() => ({ searchSchools: vi.fn() }))
vi.mock('@/modules/m02-users-schools', () => schools)

function cls(id: number, extra: Partial<GuruClass> = {}): GuruClass {
  return {
    id,
    kind: 'classroom',
    teacherId: 5,
    schoolId: 1,
    name: `Kelas ${String(id)}`,
    subjectId: 4,
    subjectName: 'Sains',
    educationLevel: 'tingkatan-5',
    levelId: 11,
    levelLabel: 'Ting. 5',
    academicYear: 2026,
    description: null,
    joinCode: `DMO${String(id).slice(-3)}`,
    isActive: true,
    createdAt: '2026-09-01T08:00:00+08:00',
    studentCount: 8,
    ...extra,
  }
}

const list = (rows: GuruClass[]) => ({ data: rows, meta: {} })

let router: Router
let wrapper: VueWrapper | undefined

async function mountPage(component: Component) {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guru/kelas', component: { template: '<div id="list" />' } },
      { path: '/guru/kelas/cipta', component: { template: '<div />' } },
    ],
  })
  await router.push('/guru/kelas')
  await router.isReady()
  wrapper = mount(component, {
    global: { plugins: [router], stubs: { teleport: true } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null)
  setActivePinia(createPinia())
  vi.clearAllMocks()
  subjects.fetchSubjectOptions.mockResolvedValue([
    { id: 1, name: 'Bahasa Melayu' },
    { id: 4, name: 'Sains' },
  ])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.useRealTimers()
})

describe('S4 KelasListPage', () => {
  it('shows "0 kelas aktif", the create link and the empty card with no class', async () => {
    api.fetchGuruClasses.mockResolvedValue(list([]))
    const w = await mountPage(KelasListPage)
    expect(w.get('h1').text()).toBe('Kelas Saya')
    expect(w.get('[data-testid="kelas-active-count"]').text()).toBe('0 kelas aktif')
    expect(w.get('[data-testid="kelas-create"]').attributes('href')).toBe('/guru/kelas/cipta')
    expect(w.get('[data-testid="kelas-create"]').text()).toBe('Cipta Kelas Baru')
    const empty = w.get('[data-testid="kelas-empty"]')
    expect(empty.text()).toContain('Belum Ada Kelas')
    expect(empty.text()).toContain('Cipta kelas pertama anda untuk memulakan pengajaran')
    expect(w.get('[data-testid="kelas-empty-create"]').attributes('href')).toBe('/guru/kelas/cipta')
  })

  it('lists and counts only the active classes', async () => {
    api.fetchGuruClasses.mockResolvedValue(
      list([cls(2001), cls(2002, { subjectName: null }), cls(2003, { isActive: false })]),
    )
    const w = await mountPage(KelasListPage)
    expect(w.get('[data-testid="kelas-active-count"]').text()).toBe('2 kelas aktif')
    const cards = w.findAll('[data-testid="class-card"]')
    expect(cards).toHaveLength(2)
    expect(cards[0]?.text()).toContain('8 pelajar')
    expect(cards[0]?.text()).toContain('Ting. 5')
    expect(cards[1]?.get('[data-testid="class-subject"]').text()).toBe('Tiada Subjek')
  })

  it('opens the QR modal with placeholders, then fills it; Salin alerts "Disalin!"; Tutup closes', async () => {
    api.fetchGuruClasses.mockResolvedValue(list([cls(2001)]))
    let resolve!: (v: unknown) => void
    api.fetchClassQrData.mockReturnValue(new Promise((r) => (resolve = r)))
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { value: { writeText }, configurable: true })
    const w = await mountPage(KelasListPage)

    await w.get('[data-testid="class-qr"]').trigger('click')
    expect(api.fetchClassQrData).toHaveBeenCalledWith(2001)
    expect(w.get('[data-testid="qr-name"]').text()).toBe('-')
    expect(w.find('[data-testid="qr-spinner"]').exists()).toBe(true)

    resolve({
      name: 'Kelas 2001',
      school: 'SMK DEMO',
      joinUrl: 'https://prestasiplus.my/kelas-saya?kod=DMO001',
    })
    await flushPromises()
    expect(w.get('[data-testid="qr-name"]').text()).toBe('Kelas 2001')
    expect(w.get('[data-testid="qr-school"]').text()).toBe('SMK DEMO')
    expect((w.get('[data-testid="qr-url"]').element as HTMLInputElement).value).toBe(
      'https://prestasiplus.my/kelas-saya?kod=DMO001',
    )
    expect(w.find('[data-testid="qr-canvas"]').attributes('width')).toBe('192')

    await w.get('[data-testid="qr-copy"]').trigger('click')
    await flushPromises()
    expect(writeText).toHaveBeenCalledWith('https://prestasiplus.my/kelas-saya?kod=DMO001')
    expect(alert).toHaveBeenCalledWith('Disalin!')

    const print = vi.spyOn(window, 'print').mockImplementation(() => undefined)
    await w.get('[data-testid="qr-print"]').trigger('click')
    expect(print).toHaveBeenCalled()

    await w.get('[data-testid="qr-close"]').trigger('click')
    expect(w.find('[data-testid="quick-qr-modal"]').exists()).toBe(false)
  })

  it('closes on a backdrop click', async () => {
    api.fetchGuruClasses.mockResolvedValue(list([cls(2001)]))
    api.fetchClassQrData.mockResolvedValue({
      name: 'A',
      school: null,
      joinUrl: 'https://x.my/?kod=A',
    })
    const w = await mountPage(KelasListPage)
    await w.get('[data-testid="class-qr"]').trigger('click')
    await flushPromises()
    await w.get('[data-testid="cmp-modal-backdrop"]').trigger('click')
    expect(w.find('[data-testid="quick-qr-modal"]').exists()).toBe(false)
  })

  it('shows an error box when the list fails', async () => {
    api.fetchGuruClasses.mockRejectedValue(new Error('boom'))
    const w = await mountPage(KelasListPage)
    expect(w.text()).toContain('Gagal memuatkan senarai kelas')
  })
})

describe('S5 KelasCreatePage', () => {
  it('renders the fields, 2 subjects after the placeholder and 11 tiles without required radios', async () => {
    const w = await mountPage(KelasCreatePage)
    expect(w.get('[data-testid="kelas-back"]').attributes('href')).toBe('/guru/kelas')
    const name = w.get('[data-testid="kelas-name"]')
    expect(name.attributes('placeholder')).toBe('cth: 5 Bestari')
    expect(name.attributes('required')).toBeDefined()
    const options = w.findAll('[data-testid="kelas-subject"] option').map((o) => o.text())
    expect(options).toEqual(['-- Pilih Subjek --', 'Bahasa Melayu', 'Sains'])
    expect(w.get('[data-testid="kelas-subject"]').attributes('required')).toBeDefined()
    const tiles = w.findAll('[data-testid="kelas-level"] input')
    expect(tiles).toHaveLength(11)
    expect(tiles.every((t) => t.attributes('required') === undefined)).toBe(true)
    expect(w.text()).not.toContain('Auto dari kelas sekolah')
    expect(w.get('[data-testid="kelas-submit"]').text()).toBe('Cipta Kelas')
  })

  it('searches schools after 300 ms and 2 characters; shows "{daerah}, {negeri}" and the empty text', async () => {
    vi.useFakeTimers()
    schools.searchSchools.mockResolvedValue([
      {
        id: 1,
        name: 'SMK DEMO',
        code: 'X',
        type: 'SMK',
        state: 'Johor',
        district: 'PPD SEGAMAT',
        city: null,
      },
    ])
    const w = await mountPage(KelasCreatePage)
    const input = w.get('[data-testid="school-search"]')

    await input.setValue('d')
    await vi.advanceTimersByTimeAsync(400)
    expect(schools.searchSchools).not.toHaveBeenCalled()

    await input.setValue('de')
    await vi.advanceTimersByTimeAsync(299)
    expect(schools.searchSchools).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(2)
    await flushPromises()
    expect(schools.searchSchools).toHaveBeenCalledWith(
      expect.objectContaining({ q: 'de', limit: 15 }),
    )
    expect(w.get('[data-testid="school-result"]').text()).toContain('PPD SEGAMAT, Johor')

    schools.searchSchools.mockResolvedValue([])
    await input.setValue('zzz')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    expect(w.get('[data-testid="school-none"]').text()).toBe('Tiada sekolah dijumpai')
  })

  it('filters the tiles by school type and restores 11 on clear', async () => {
    vi.useFakeTimers()
    const make = (type: string) => [
      { id: 1, name: 'Sekolah', code: '', type, state: 'Johor', district: null, city: null },
    ]
    const w = await mountPage(KelasCreatePage)
    const input = w.get('[data-testid="school-search"]')

    schools.searchSchools.mockResolvedValue(make('SK'))
    await input.setValue('se')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    await w.get('[data-testid="school-result"]').trigger('click')
    expect(w.findAll('[data-testid="kelas-level"]').map((t) => t.text())).toEqual([
      'Tahun 1',
      'Tahun 2',
      'Tahun 3',
      'Tahun 4',
      'Tahun 5',
      'Tahun 6',
    ])

    await w.get('[data-testid="school-clear"]').trigger('click')
    expect(w.findAll('[data-testid="kelas-level"]')).toHaveLength(11)

    schools.searchSchools.mockResolvedValue(make('SMK'))
    await w.get('[data-testid="school-search"]').setValue('se')
    await vi.advanceTimersByTimeAsync(400)
    await flushPromises()
    await w.get('[data-testid="school-result"]').trigger('click')
    expect(w.findAll('[data-testid="kelas-level"]')).toHaveLength(5)
  })

  it('creates the class, sets the flash and goes to /guru/kelas', async () => {
    api.createGuruClass.mockResolvedValue(cls(9000001))
    const w = await mountPage(KelasCreatePage)
    await router.push('/guru/kelas/cipta')
    await w.get('[data-testid="kelas-name"]').setValue(' 5 Bestari ')
    await w.get('[data-testid="kelas-subject"]').setValue('4')
    await w.findAll('[data-testid="kelas-level"] input')[10]?.setValue(true)
    await w.get('[data-testid="kelas-form"]').trigger('submit')
    await flushPromises()
    expect(api.createGuruClass).toHaveBeenCalledWith({
      name: '5 Bestari',
      subjectId: 4,
      educationLevel: 'tingkatan-5',
      description: null,
    })
    expect(router.currentRoute.value.path).toBe('/guru/kelas')
    expect(useFlashStore().pending?.type).toBe('success')
  })

  it('shows the 422 field messages and stays on the page', async () => {
    api.createGuruClass.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { educationLevel: 'Sila pilih tahap pendidikan.' },
      }),
    )
    const w = await mountPage(KelasCreatePage)
    await router.push('/guru/kelas/cipta')
    await w.get('[data-testid="kelas-name"]').setValue('5 Bestari')
    await w.get('[data-testid="kelas-subject"]').setValue('4')
    await w.get('[data-testid="kelas-form"]').trigger('submit')
    await flushPromises()
    expect(w.text().split('Sila pilih tahap pendidikan.').length - 1).toBe(1)
    expect(router.currentRoute.value.path).toBe('/guru/kelas/cipta')
  })
})
