// @vitest-environment jsdom
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'

import RphFormPage from '../../pages/RphFormPage.vue'
import RphListPage from '../../pages/RphListPage.vue'
import RphViewPage from '../../pages/RphViewPage.vue'
import { listMeta, mountAt } from './helpers'

const api = vi.hoisted(() => ({
  fetchRphList: vi.fn(),
  fetchRph: vi.fn(),
  createRph: vi.fn(),
  fetchCikguClasses: vi.fn(),
  fetchCikguSubjects: vi.fn(),
}))
vi.mock('../../api/cikgu', () => api)
vi.mock('@/app/router/outcome', () => ({ setRouteOutcome: vi.fn() }))

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
})
beforeEach(() => {
  for (const fn of Object.values(api)) fn.mockReset()
  vi.mocked(setRouteOutcome).mockReset()
})

describe('S2 RPH list', () => {
  it('renders the header, the button, the headers and the empty row with the example', async () => {
    api.fetchRphList.mockResolvedValue({ data: [], meta: listMeta(0) })
    const m = await mountAt(RphListPage, '/cikgu/rph')
    wrapper = m.wrapper
    expect(wrapper.get('h1').text()).toBe('📋 Rancangan Pengajaran Harian (RPH)')
    expect(wrapper.text()).toContain('RPH yang dijana oleh Cikgu Alesa atau cikgu sendiri.')
    const cta = wrapper.get('[data-testid="rph-create"]')
    expect(cta.text()).toBe('Jana RPH Baharu')
    expect(cta.attributes('href')).toBe('/cikgu/rph/baharu')
    expect(wrapper.findAll('th').map((th) => th.text())).toEqual([
      'Tarikh',
      'Subjek / Level',
      'Tajuk',
      'Status',
      'Tindakan',
    ])
    const empty = wrapper.get('[data-testid="rph-empty"]')
    expect(empty.text()).toBe(
      'Belum ada RPH. Klik "Jana RPH Baharu" dan minta Cikgu Alesa: "Tolong jana RPH untuk Matematik T4 Bab 3 esok".',
    )
    expect(empty.get('em').text()).toBe('"Tolong jana RPH untuk Matematik T4 Bab 3 esok"')
    expect(wrapper.find('nav').exists()).toBe(false)
  })

  it('renders rows with the PROPOSED layout and "Lihat" links', async () => {
    api.fetchRphList.mockResolvedValue({
      data: [
        {
          id: 13101,
          lessonDate: '2026-09-28',
          subjectName: 'Kimia',
          level: 'T5',
          tajuk: 'Elektrolisis',
          status: 'generated',
        },
      ],
      meta: listMeta(1),
    })
    const m = await mountAt(RphListPage, '/cikgu/rph')
    wrapper = m.wrapper
    const cells = wrapper.get('tbody tr').findAll('td')
    expect(cells.map((c) => c.text())).toEqual([
      '28/09/2026',
      'Kimia / T5',
      'Elektrolisis',
      'Dijana',
      'Lihat',
    ])
    expect(cells[4]!.get('a').attributes('href')).toBe('/cikgu/rph/13101')
  })

  it('reads ?page= and shows the BM pager summary', async () => {
    api.fetchRphList.mockResolvedValue({ data: [], meta: listMeta(45, 2) })
    const m = await mountAt(RphListPage, '/cikgu/rph?page=2')
    wrapper = m.wrapper
    expect(api.fetchRphList).toHaveBeenCalledWith(2, expect.anything())
    expect(wrapper.find('nav').exists()).toBe(true)
    expect(wrapper.text()).toContain('Menunjukkan 21-40 daripada 45 hasil')
  })

  it('shows an error with a retry button', async () => {
    api.fetchRphList.mockRejectedValueOnce(new Error('x'))
    const m = await mountAt(RphListPage, '/cikgu/rph')
    wrapper = m.wrapper
    expect(wrapper.find('[data-testid="page-error"]').exists()).toBe(true)
    api.fetchRphList.mockResolvedValueOnce({ data: [], meta: listMeta(0) })
    await wrapper.get('[data-testid="page-retry"]').trigger('click')
    await flushPromises()
    expect(wrapper.find('[data-testid="rph-empty"]').exists()).toBe(true)
  })
})

describe('S3 RPH form', () => {
  const subjects = [
    { id: 2, name: 'Sains' },
    { id: 1, name: 'Matematik' },
  ]

  it('admin (no class): the no-class sentence, nine fields, defaults, info box and note', async () => {
    api.fetchCikguClasses.mockResolvedValue([])
    api.fetchCikguSubjects.mockResolvedValue(subjects)
    const m = await mountAt(RphFormPage, '/cikgu/rph/baharu')
    wrapper = m.wrapper
    expect(wrapper.get('[data-testid="rph-back"]').text()).toBe('← Senarai RPH')
    expect(wrapper.get('h1').text()).toBe('Jana RPH dengan Cikgu Alesa')
    expect(wrapper.get('[data-testid="rph-no-class"]').text()).toBe(
      'Sistem belum jumpa kelas yang dikaitkan dengan akaun Cikgu. Sila isi manual.',
    )
    expect(wrapper.find('#rph-class-pick').exists()).toBe(false)
    const form = wrapper.get('#rph-create-form')
    expect(form.attributes('novalidate')).toBeUndefined()
    expect(wrapper.get('#subject_name').attributes('required')).toBeDefined()
    expect(wrapper.get('#subject_name').attributes('list')).toBe('subject-list')
    expect(wrapper.findAll('#subject-list option').map((o) => o.attributes('value'))).toEqual([
      'Matematik',
      'Sains',
    ])
    expect(wrapper.get('#level').attributes('required')).toBeDefined()
    expect(wrapper.findAll('#level option').map((o) => o.text())).toEqual([
      '— Pilih —',
      ...[1, 2, 3, 4, 5, 6].map((n) => `Darjah ${String(n)}`),
      ...[1, 2, 3, 4, 5].map((n) => `Tingkatan ${String(n)}`),
    ])
    expect(wrapper.get('#tajuk').attributes('maxlength')).toBe('200')
    expect(wrapper.get<HTMLInputElement>('#duration_minutes').element.value).toBe('60')
    expect(wrapper.get('#duration_minutes').attributes('min')).toBe('15')
    expect(wrapper.get('#duration_minutes').attributes('max')).toBe('240')
    expect(wrapper.get<HTMLInputElement>('#lesson_date').element.value).toMatch(
      /^\d{4}-\d{2}-\d{2}$/,
    )
    expect(wrapper.get('#pengajaran_keperluan').attributes('maxlength')).toBe('500')
    expect(wrapper.get('[data-testid="rph-info"]').text()).toContain(
      '📌 Apa yang Cikgu Alesa akan jana:',
    )
    expect(wrapper.findAll('[data-testid="rph-info"] li')).toHaveLength(4)
    expect(wrapper.text()).toContain('⏱️ Proses ambil masa 10-30 saat. Sila tunggu.')
    expect(wrapper.get('[data-testid="form-cancel"]').attributes('href')).toBe('/cikgu/rph')
    expect(wrapper.get('[data-testid="form-submit"]').text()).toBe('Jana RPH dengan Cikgu Alesa')
    // empty form: the text fields are invalid (jsdom does not evaluate the placeholder option of a required select; the browser does, E2E-M13-35)
    expect((form.element as HTMLFormElement).querySelectorAll(':invalid')).toHaveLength(2)
  })

  it('teacher with classes: the select fills subject, level and class', async () => {
    api.fetchCikguClasses.mockResolvedValue([
      {
        id: 2001,
        name: '5 MARIKH - Kimia',
        subjectName: 'Kimia',
        educationLevel: 'tingkatan-5',
        levelLabel: 'Tingkatan 5',
      },
    ])
    api.fetchCikguSubjects.mockResolvedValue(subjects)
    const m = await mountAt(RphFormPage, '/cikgu/rph/baharu')
    wrapper = m.wrapper
    expect(wrapper.find('[data-testid="rph-no-class"]').exists()).toBe(false)
    const option = wrapper.findAll('#rph-class-pick option')[1]!
    expect(option.attributes('data-subject')).toBe('Kimia')
    expect(option.attributes('data-level')).toBe('T5')
    expect(option.attributes('data-class')).toBe('5 MARIKH - Kimia')
    await wrapper.get('#rph-class-pick').setValue('2001')
    expect(wrapper.get<HTMLInputElement>('#subject_name').element.value).toBe('Kimia')
    expect(wrapper.get<HTMLSelectElement>('#level').element.value).toBe('T5')
    expect(wrapper.get<HTMLInputElement>('#class_name').element.value).toBe('5 MARIKH - Kimia')
  })

  it('a valid submit is busy until #3 answers, then goes to V1', async () => {
    api.fetchCikguClasses.mockResolvedValue([])
    api.fetchCikguSubjects.mockResolvedValue(subjects)
    let resolve!: (v: unknown) => void
    api.createRph.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const m = await mountAt(RphFormPage, '/cikgu/rph/baharu')
    wrapper = m.wrapper
    await wrapper.get('#subject_name').setValue('Matematik')
    await wrapper.get('#level').setValue('T4')
    await wrapper.get('#tajuk').setValue('Pecahan Setara')
    await wrapper.get('#rph-create-form').trigger('submit')
    const btn = wrapper.get<HTMLButtonElement>('[data-testid="form-submit"]')
    expect(btn.element.disabled).toBe(true)
    expect(btn.text()).toBe('Cikgu Alesa sedang jana RPH…')
    expect(api.createRph).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectName: 'Matematik',
        level: 'T4',
        tajuk: 'Pecahan Setara',
        durationMinutes: 60,
        className: null,
        pengajaranKeperluan: null,
      }),
    )
    resolve({ id: 9000001 })
    await flushPromises()
    expect(m.router.currentRoute.value.path).toBe('/cikgu/rph/9000001')
  })

  it('a rejected save re-enables the button and shows the message', async () => {
    api.fetchCikguClasses.mockResolvedValue([])
    api.fetchCikguSubjects.mockResolvedValue(subjects)
    api.createRph.mockRejectedValueOnce(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Tidak sah',
        fields: { tajuk: 'Tajuk wajib.' },
      }),
    )
    const m = await mountAt(RphFormPage, '/cikgu/rph/baharu')
    wrapper = m.wrapper
    await wrapper.get('#rph-create-form').trigger('submit')
    await flushPromises()
    expect(wrapper.get<HTMLButtonElement>('[data-testid="form-submit"]').element.disabled).toBe(
      false,
    )
    expect(wrapper.text()).toContain('Tajuk wajib.')
    expect(m.router.currentRoute.value.path).toBe('/cikgu/rph/baharu')
  })
})

describe('V1 RPH view', () => {
  const rph = {
    id: 13101,
    userId: 5,
    subjectName: 'Kimia',
    level: 'T5',
    tajuk: 'Elektrolisis Larutan Akueus',
    lessonDate: '2026-09-28',
    status: 'generated',
    content: 'Baris 1\n<b>x</b>',
  }

  it('renders labelled values and the content as text with line breaks kept', async () => {
    api.fetchRph.mockResolvedValue(rph)
    const m = await mountAt(RphViewPage, '/cikgu/rph/13101', { id: 13101 })
    wrapper = m.wrapper
    expect(wrapper.get('h1').text()).toBe('📋 Rancangan Pengajaran Harian (RPH)')
    expect(wrapper.get('[data-testid="rph-back"]').text()).toBe('← Senarai RPH')
    expect(wrapper.get('[data-testid="rph-view-date"]').text()).toBe('28/09/2026')
    expect(wrapper.get('[data-testid="rph-view-subject"]').text()).toBe('Kimia / T5')
    expect(wrapper.get('[data-testid="rph-view-tajuk"]').text()).toBe('Elektrolisis Larutan Akueus')
    expect(wrapper.get('[data-testid="rph-view-status"]').text()).toBe('Dijana')
    const content = wrapper.get('[data-testid="rph-view-content"]')
    expect(content.classes()).toContain('whitespace-pre-line')
    expect(content.text()).toContain('<b>x</b>')
    expect(content.element.querySelector('b')).toBeNull()
    expect(api.fetchRph).toHaveBeenCalledWith(13101, expect.anything())
  })

  it('a 404 (foreign or unknown id) raises the standard 404 outcome', async () => {
    api.fetchRph.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    const m = await mountAt(RphViewPage, '/cikgu/rph/1', { id: 1 })
    wrapper = m.wrapper
    expect(setRouteOutcome).toHaveBeenCalledWith(404)
    expect(wrapper.find('[data-testid="page-error"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="rph-view-content"]').exists()).toBe(false)
  })
})
