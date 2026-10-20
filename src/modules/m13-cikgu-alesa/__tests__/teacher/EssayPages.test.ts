// @vitest-environment jsdom
import { type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { setRouteOutcome } from '@/app/router/outcome'

import EssayFormPage from '../../pages/EssayFormPage.vue'
import EssayListPage from '../../pages/EssayListPage.vue'
import EssayViewPage from '../../pages/EssayViewPage.vue'
import { listMeta, mountAt } from './helpers'

const api = vi.hoisted(() => ({ fetchEssayList: vi.fn(), fetchEssay: vi.fn() }))
vi.mock('../../api/cikgu', () => api)
vi.mock('@/app/router/outcome', () => ({ setRouteOutcome: vi.fn() }))

let wrapper: VueWrapper | undefined
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
})
beforeEach(() => {
  api.fetchEssayList.mockReset()
  api.fetchEssay.mockReset()
  vi.mocked(setRouteOutcome).mockReset()
  sessionStorage.clear()
})

describe('S4 essay list', () => {
  it('empty: header, button, headers and the empty row', async () => {
    api.fetchEssayList.mockResolvedValue({ data: [], meta: listMeta(0) })
    const m = await mountAt(EssayListPage, '/cikgu/essay')
    wrapper = m.wrapper
    expect(wrapper.get('h1').text()).toBe('📝 Marking Karangan AI')
    expect(wrapper.text()).toContain(
      'Karangan yang dimark oleh Cikgu Alesa berdasarkan rubric SPM/PT3.',
    )
    const cta = wrapper.get('[data-testid="essay-create"]')
    expect(cta.text()).toBe('Mark Karangan Baharu')
    expect(cta.attributes('href')).toBe('/cikgu/essay/baharu')
    expect(wrapper.findAll('th').map((t) => t.text())).toEqual([
      'Pelajar',
      'Subjek / Rubric',
      'Tajuk',
      'Markah',
      'Tindakan',
    ])
    expect(wrapper.get('[data-testid="essay-empty"]').text()).toBe(
      'Belum ada karangan dimark. Klik "Mark Karangan Baharu" untuk mula.',
    )
  })

  it('rows: student, subject / rubric without marks, title, marks, link; empty text is "-"', async () => {
    api.fetchEssayList.mockResolvedValue({
      data: [
        {
          id: 13202,
          studentName: 'Murid Demo 02',
          subjectName: 'Sejarah',
          rubricKey: 'sejarah_essay',
          essayTitle: 'Semangat Patriotisme',
          marks: 14,
          maxMarks: 20,
          createdAt: 'x',
        },
        {
          id: 13203,
          studentName: null,
          subjectName: 'Bahasa Melayu',
          rubricKey: 'spm_bm_karangan',
          essayTitle: '',
          marks: 35,
          maxMarks: 50,
          createdAt: 'x',
        },
      ],
      meta: listMeta(2),
    })
    const m = await mountAt(EssayListPage, '/cikgu/essay')
    wrapper = m.wrapper
    const rows = wrapper.findAll('tbody tr')
    expect(rows[0]!.findAll('td').map((c) => c.text())).toEqual([
      'Murid Demo 02',
      'Sejarah / Sejarah — Karangan Esei',
      'Semangat Patriotisme',
      '14/20',
      'Lihat',
    ])
    expect(rows[0]!.get('a').attributes('href')).toBe('/cikgu/essay/13202')
    expect(rows[1]!.findAll('td')[0]!.text()).toBe('-')
    expect(rows[1]!.findAll('td')[2]!.text()).toBe('-')
  })
})

describe('S5 essay form', () => {
  it('renders the live labels, six rubrics (first selected), no name attributes', async () => {
    const m = await mountAt(EssayFormPage, '/cikgu/essay/baharu')
    wrapper = m.wrapper
    expect(wrapper.get('[data-testid="essay-back"]').text()).toBe('← Senarai')
    expect(wrapper.get('h1').text()).toBe('📝 Mark Karangan Baharu')
    expect(wrapper.text()).toContain('Salin & tampal karangan pelajar di bawah.')
    const form = wrapper.get('#essay-form')
    expect(form.attributes('action')).toBeUndefined()
    expect(form.attributes('method')).toBeUndefined()
    expect(form.element.querySelectorAll('[name]')).toHaveLength(0)
    const options = wrapper.findAll('#rubric_key option')
    expect(options).toHaveLength(6)
    expect(options[0]!.text()).toBe('SPM Bahasa Melayu — Karangan (Bahagian B) (50 markah)')
    expect(options[5]!.text()).toBe('Rubric Am (default) (100 markah)')
    expect(wrapper.get<HTMLSelectElement>('#rubric_key').element.value).toBe('spm_bm_karangan')
    expect(wrapper.get('#subject_name').attributes('placeholder')).toBe('cth: Bahasa Melayu')
    expect(wrapper.get('#level').attributes('placeholder')).toBe('T4')
    const text = wrapper.get('#essay_text')
    expect(text.attributes('rows')).toBe('14')
    expect(text.attributes('minlength')).toBe('50')
    expect(text.attributes('required')).toBeDefined()
    expect(text.attributes('placeholder')).toBe('Salin & tampal karangan pelajar di sini…')
    expect(wrapper.get('#word-counter').text()).toBe('0 perkataan')
    expect(wrapper.get('[data-testid="essay-amber"]').text()).toContain(
      'Apa yang berlaku selepas klik:',
    )
    expect(wrapper.get('#essay-submit').attributes('type')).toBe('button')
    expect(wrapper.get('#essay-submit').text()).toBe('Hantar ke Cikgu Alesa')
    expect(wrapper.get('[data-testid="form-cancel"]').attributes('href')).toBe('/cikgu/essay')
  })

  it('the counter follows the \\S+ runs', async () => {
    const m = await mountAt(EssayFormPage, '/cikgu/essay/baharu')
    wrapper = m.wrapper
    await wrapper.get('#essay_text').setValue('Satu dua')
    expect(wrapper.get('#word-counter').text()).toBe('2 perkataan')
    await wrapper.get('#essay_text').setValue('a b c d e')
    expect(wrapper.get('#word-counter').text()).toBe('5 perkataan')
  })

  it('under 50 characters: alert, stay, nothing stored', async () => {
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    const m = await mountAt(EssayFormPage, '/cikgu/essay/baharu')
    wrapper = m.wrapper
    await wrapper.get('#essay_text').setValue('x'.repeat(49))
    await wrapper.get('#essay-submit').trigger('click')
    expect(alert).toHaveBeenCalledWith('Karangan terlalu pendek (minimum 50 aksara).')
    expect(m.router.currentRoute.value.path).toBe('/cikgu/essay/baharu')
    expect(sessionStorage.getItem('cikgu_pending_essay')).toBeNull()
  })

  it('50 characters: stores the essay and opens S1 with all six keys', async () => {
    const m = await mountAt(EssayFormPage, '/cikgu/essay/baharu')
    wrapper = m.wrapper
    await wrapper.get('#rubric_key').setValue('sejarah_essay')
    await wrapper.get('#subject_name').setValue(' Sejarah ')
    await wrapper.get('#level').setValue('T5')
    await wrapper.get('#student_name').setValue('Murid Demo 03')
    await wrapper.get('#essay_title').setValue('Semangat Patriotisme')
    await wrapper.get('#essay_text').setValue(`  ${'y'.repeat(50)}  `)
    await wrapper.get('#essay-submit').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(sessionStorage.getItem('cikgu_pending_essay')).toBe('y'.repeat(50))
    const loc = m.router.currentRoute.value.fullPath
    expect(loc).toBe(
      '/cikgu?action=mark_essay&rubric=sejarah_essay&subject=Sejarah&level=T5&student=Murid+Demo+03&title=Semangat+Patriotisme',
    )
  })

  it('essay only: empty keys are kept', async () => {
    const m = await mountAt(EssayFormPage, '/cikgu/essay/baharu')
    wrapper = m.wrapper
    await wrapper.get('#essay_text').setValue('z'.repeat(50))
    await wrapper.get('#essay-submit').trigger('click')
    await new Promise((r) => setTimeout(r, 0))
    expect(m.router.currentRoute.value.fullPath).toBe(
      '/cikgu?action=mark_essay&rubric=spm_bm_karangan&subject=&level=&student=&title=',
    )
  })
})

describe('V2 essay view', () => {
  it('renders labelled values and the comment as text', async () => {
    api.fetchEssay.mockResolvedValue({
      id: 13201,
      rubricKey: 'spm_bm_karangan',
      subjectName: 'Bahasa Melayu',
      studentName: 'Murid Demo 01',
      essayTitle: 'Kepentingan Membaca',
      marks: 35,
      maxMarks: 50,
      comment: 'Markah: 35/50\nKomen <b>x</b>',
    })
    const m = await mountAt(EssayViewPage, '/cikgu/essay/13201', { id: 13201 })
    wrapper = m.wrapper
    expect(wrapper.get('h1').text()).toBe('📝 Marking Karangan AI')
    expect(wrapper.get('[data-testid="essay-back"]').text()).toBe('← Senarai')
    expect(wrapper.get('[data-testid="essay-view-student"]').text()).toBe('Murid Demo 01')
    expect(wrapper.get('[data-testid="essay-view-subject"]').text()).toBe(
      'Bahasa Melayu / SPM Bahasa Melayu — Karangan (Bahagian B)',
    )
    expect(wrapper.get('[data-testid="essay-view-tajuk"]').text()).toBe('Kepentingan Membaca')
    expect(wrapper.get('[data-testid="essay-view-marks"]').text()).toBe('35/50')
    const comment = wrapper.get('[data-testid="essay-view-comment"]')
    expect(comment.classes()).toContain('whitespace-pre-line')
    expect(comment.element.querySelector('b')).toBeNull()
  })

  it.each([13201, 'clx9abc123'])('fetches with the id as given (%s)', async (id) => {
    api.fetchEssay.mockResolvedValue({
      id,
      rubricKey: 'spm_bm_karangan',
      subjectName: 'Bahasa Melayu',
      studentName: 'Murid Demo 01',
      essayTitle: 'T',
      marks: 1,
      maxMarks: 2,
      comment: 'c',
    })
    const m = await mountAt(EssayViewPage, `/cikgu/essay/${String(id)}`, { id })
    wrapper = m.wrapper
    expect(api.fetchEssay).toHaveBeenCalledWith(id, expect.anything())
    expect(wrapper.find('[data-testid="essay-view-tajuk"]').exists()).toBe(true)
  })

  it('404 raises the standard 404 outcome', async () => {
    api.fetchEssay.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    const m = await mountAt(EssayViewPage, '/cikgu/essay/99999999', { id: 99999999 })
    wrapper = m.wrapper
    expect(setRouteOutcome).toHaveBeenCalledWith(404)
  })
})
