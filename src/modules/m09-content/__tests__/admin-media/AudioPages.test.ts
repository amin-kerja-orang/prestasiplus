// @vitest-environment jsdom
import { flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import AudioSetCreatePage from '../../pages/AudioSetCreatePage.vue'
import AudioSetListPage from '../../pages/AudioSetListPage.vue'
import { makeRouter, mountAt, t } from './harness'

const api = vi.hoisted(() => ({
  fetchAdminAudioSets: vi.fn(),
  fetchLevelOptions: vi.fn(),
  fetchSubjectOptions: vi.fn(),
  fetchAudioTemplate: vi.fn(),
  createAudioSet: vi.fn(),
}))
vi.mock('../../api/admin-media', () => api)

const saver = vi.hoisted(() => ({ saveBlob: vi.fn() }))
vi.mock('@/lib/save-blob', () => saver)

const meta = (stats = { sets: 0, approved: 0, draftPending: 0, questions: 0 }, total = 0) => ({
  page: 1,
  pageSize: 20,
  totalItems: total,
  totalPages: 1,
  from: total === 0 ? null : 1,
  to: total === 0 ? null : total,
  stats,
})

const LEVELS = [
  { id: 1, name: 'Darjah 1' },
  { id: 10, name: 'Tingkatan 4' },
]
const SUBJECTS = [
  { id: 3, name: 'Matematik' },
  { id: 18, name: 'Bahasa Arab' },
  { id: 1, name: 'Bahasa Melayu' },
]

let wrapper: VueWrapper | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  saver.saveBlob.mockReset()
  api.fetchAdminAudioSets.mockResolvedValue({ data: [], meta: meta() })
  api.fetchLevelOptions.mockResolvedValue({ data: LEVELS, meta: meta() })
  api.fetchSubjectOptions.mockResolvedValue({ data: SUBJECTS, meta: meta() })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('AudioSetListPage (S12)', () => {
  it('shows the intro, links, guide, zero stats, filter and the empty state', async () => {
    wrapper = (await mountAt(AudioSetListPage, '/page')).wrapper
    const w = wrapper
    expect(w.text()).toContain('Ujian Mendengar')
    expect(w.text()).toContain('Senarai set soalan audio fixed sequence, bukan rawak.')
    expect(t(w, 'template-xlsx').attributes('href')).toBe('/admin/audio-kbat/template')
    expect(t(w, 'template-word').attributes('href')).toBe('/admin/audio-kbat/template-word')
    expect(t(w, 'audio-create').attributes('href')).toBe('/admin/audio-kbat/create')
    expect(t(w, 'audio-guide').text()).toContain(
      'Panduan ringkas untuk cikgu yang ingin sumbang soalan Audio KBAT',
    )
    expect(t(w, 'audio-guide').text()).toContain('Set ini bukan soalan rawak.')
    expect(t(w, 'audio-guide').text()).toContain('Jika cikgu mahu bahan yang mudah ditaip')
    for (const key of ['sets', 'approved', 'draftPending', 'questions']) {
      expect(t(w, `stat-${key}`).text()).toMatch(/^0/)
    }
    expect(t(w, 'audio-stats').text()).toContain('Draft/Pending')
    expect(t(w, 'audio-empty').text()).toBe('Belum ada set Audio KBAT.')
  })

  it('lists the filter options with the subjects sorted A–Z', async () => {
    wrapper = (await mountAt(AudioSetListPage, '/page')).wrapper
    const w = wrapper
    expect(
      t(w, 'filter-subject')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['Semua Subjek', 'Bahasa Arab', 'Bahasa Melayu', 'Matematik'])
    expect(
      t(w, 'filter-level')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['Semua Tahap', 'Darjah 1', 'Tingkatan 4'])
    expect(
      t(w, 'filter-status')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['Semua Status', 'Draft', 'Pending Review', 'Approved', 'Archived'])
    expect(t(w, 'filter-search').attributes('placeholder')).toBe('Cari tajuk/sumber...')
    expect(w.get('form[role=search] button[type=submit]').text()).toBe('Tapis')
  })

  it('"Tapis" goes to the same path with the values and keeps them selected', async () => {
    const { wrapper: w, router } = await mountAt(AudioSetListPage, '/page')
    wrapper = w
    await t(w, 'filter-level').setValue('10')
    await t(w, 'filter-subject').setValue('3')
    await t(w, 'filter-status').setValue('approved')
    await t(w, 'filter-search').setValue('sifir')
    await t(w, 'audio-filter').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.path).toBe('/admin/audio-kbat')
    expect(router.currentRoute.value.query).toEqual({
      education_level_id: '10',
      subject_id: '3',
      status: 'approved',
      search: 'sifir',
    })
  })

  it('maps the URL filter to the camelCase API query and keeps the controls', async () => {
    const router = makeRouter([{ path: '/admin/audio-kbat', component: AudioSetListPage }])
    const mounted = await mountAt(
      AudioSetListPage,
      '/admin/audio-kbat?education_level_id=10&subject_id=3&status=draft&search=abc',
      {},
      router,
    )
    wrapper = mounted.wrapper
    expect(api.fetchAdminAudioSets).toHaveBeenCalledWith(
      { pageSize: 100, educationLevelId: 10, subjectId: 3, status: 'draft', search: 'abc' },
      expect.anything(),
    )
    expect((t(wrapper, 'filter-level').element as HTMLSelectElement).value).toBe('10')
    expect((t(wrapper, 'filter-status').element as HTMLSelectElement).value).toBe('draft')
    expect((t(wrapper, 'filter-search').element as HTMLInputElement).value).toBe('abc')
    expect(t(wrapper, 'audio-empty').text()).toBe('Belum ada set Audio KBAT.')
  })

  it('shows the stats of the whole collection and one neutral row per set', async () => {
    api.fetchAdminAudioSets.mockResolvedValue({
      data: [
        {
          id: 1,
          title: 'BM T4 Set 1',
          educationLevel: { id: 10, name: 'Tingkatan 4' },
          subject: { id: 1, name: 'Bahasa Melayu' },
          status: 'approved',
          statusLabel: 'Approved',
          questionCount: 30,
        },
      ],
      meta: meta({ sets: 2, approved: 1, draftPending: 1, questions: 60 }, 1),
    })
    wrapper = (await mountAt(AudioSetListPage, '/page')).wrapper
    const w = wrapper
    expect(
      ['sets', 'approved', 'draftPending', 'questions'].map(
        (key) => t(w, `stat-${key}`).text().match(/^\d+/)?.[0],
      ),
    ).toEqual(['2', '1', '1', '60'])
    const row = w.get('tbody tr')
    expect(row.get('[data-testid=set-title]').text()).toBe('BM T4 Set 1')
    expect(row.get('[data-testid=set-level]').text()).toBe('Tingkatan 4')
    expect(row.get('[data-testid=set-subject]').text()).toBe('Bahasa Melayu')
    expect(row.get('[data-testid=set-status]').text()).toBe('Approved')
    expect(row.get('[data-testid=set-questions]').text()).toBe('30 soalan')
    expect(w.find('[data-testid=audio-empty]').exists()).toBe(false)
  })

  it('a template link downloads through the API and stays on the page', async () => {
    const blob = new Blob(['x'])
    api.fetchAudioTemplate.mockResolvedValue({ blob, filename: 'template-audio-kbat.xlsx' })
    const { wrapper: w, router } = await mountAt(AudioSetListPage, '/page')
    wrapper = w
    await t(w, 'template-xlsx').trigger('click')
    await flushPromises()
    expect(api.fetchAudioTemplate).toHaveBeenCalledWith('xlsx')
    expect(saver.saveBlob).toHaveBeenCalledWith(blob, 'template-audio-kbat.xlsx')
    await t(w, 'template-word').trigger('click')
    await flushPromises()
    expect(api.fetchAudioTemplate).toHaveBeenLastCalledWith('docx')
    expect(saver.saveBlob).toHaveBeenLastCalledWith(blob, 'template-audio-kbat.xlsx')
    expect(router.currentRoute.value.path).toBe('/page')
  })
})

async function create() {
  const router = makeRouter([{ path: '/create', component: AudioSetCreatePage }])
  const mounted = await mountAt(AudioSetCreatePage, '/create', {}, router)
  wrapper = mounted.wrapper
  return mounted
}

function fillRequired(w: VueWrapper): Promise<void[]> {
  const jobs: Promise<void>[] = []
  jobs.push(t(w, 'set-title').setValue('BM T4 Ujian Mendengar Set 1'))
  jobs.push(t(w, 'set-level').setValue('10'))
  jobs.push(t(w, 'set-subject').setValue('1'))
  for (const block of w.findAll('[data-testid=question-block]')) {
    jobs.push(block.get('[data-testid=q-text]').setValue('Soalan?'))
    for (const key of ['optionA', 'optionB', 'optionC', 'optionD']) {
      jobs.push(block.get(`[data-testid=q-${key}]`).setValue(key))
    }
  }
  return Promise.all(jobs)
}

describe('AudioSetCreatePage (S13)', () => {
  it('renders the header, guide, "Maklumat Set" defaults and no "Batal"', async () => {
    const { wrapper: w } = await create()
    expect(w.get('[data-ds=back-link]').text()).toBe('Kembali')
    expect(w.get('[data-ds=back-link]').attributes('href')).toBe('/admin/audio-kbat')
    expect(w.text()).toContain(
      'Format fixed: 4 audio section, 30 soalan MCQ, soalan dipaparkan serentak mengikut section.',
    )
    expect(t(w, 'audio-guide').text()).toContain('Apa yang cikgu perlu sediakan?')
    expect(t(w, 'audio-guide').text()).toContain('Template Word')
    expect(t(w, 'audio-guide').text()).toContain('Template XLSX')
    expect(t(w, 'set-title').attributes('placeholder')).toBe('Contoh: BM T4 Ujian Mendengar Set 1')
    expect((t(w, 'set-status').element as HTMLSelectElement).value).toBe('approved')
    expect(
      t(w, 'set-status')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['Approved', 'Pending Review', 'Draft'])
    expect(t(w, 'set-source').attributes('placeholder')).toBe('Contoh: Cikgu Demo 02')
    expect(t(w, 'set-instructions').attributes('placeholder')).toBe(
      'Dengar audio bagi setiap bahagian dan jawab semua soalan.',
    )
    expect(
      t(w, 'set-subject')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual(['Pilih Subjek', 'Bahasa Arab', 'Bahasa Melayu', 'Matematik'])
    expect(w.text()).not.toContain('Batal')
    expect(t(w, 'form-submit').text()).toBe('Simpan Set Audio KBAT')
  })

  it('has 4 section cards (8/8/8/6 questions) and 30 question blocks with defaults', async () => {
    const { wrapper: w } = await create()
    const sections = w.findAll('[data-testid=section-card]')
    expect(sections.map((s) => s.get('h2').text())).toEqual([
      'Bahagian 1 · Soalan 1-8',
      'Bahagian 2 · Soalan 9-16',
      'Bahagian 3 · Soalan 17-24',
      'Bahagian 4 · Soalan 25-30',
    ])
    expect(
      w.findAll('[data-testid=section-title]').map((i) => (i.element as HTMLInputElement).value),
    ).toEqual(['Audio 1', 'Audio 2', 'Audio 3', 'Audio 4'])
    const audio = w.get('[data-testid=section-audio] input[type="file"]')
    expect(audio.attributes('accept')).toBe('.mp3,.m4a,.wav,.ogg,.aac,.mp4,audio/*')
    expect(audio.attributes('required')).toBeUndefined()
    expect(w.get('[data-testid=section-transcript]').attributes('placeholder')).toBe(
      'Wajib digalakkan untuk semakan admin.',
    )
    const blocks = w.findAll('[data-testid=question-block]')
    expect(blocks).toHaveLength(30)
    expect(blocks[0]!.get('h2').text()).toBe('Soalan 1')
    expect(blocks[29]!.get('h2').text()).toBe('Soalan 30')
    expect(blocks[0]!.text()).toContain('KBAT Audio')
    expect((blocks[0]!.get('[data-testid=q-answer]').element as HTMLSelectElement).value).toBe('A')
    expect((blocks[0]!.get('[data-testid=q-marks]').element as HTMLInputElement).value).toBe('1')
    expect((blocks[0]!.get('[data-testid=q-kbat]').element as HTMLInputElement).value).toBe('3')
    expect(blocks[0]!.get('[data-testid=q-marks]').attributes('max')).toBe('20')
    expect(blocks[0]!.get('[data-testid=q-kbat]').attributes('max')).toBe('5')
    expect(blocks[0]!.get('[data-testid=q-dskp]').attributes('placeholder')).toBe('Optional')
    // Section 1 is followed by questions 1–8, then section 2.
    const order = [
      ...w.element.querySelectorAll('[data-testid=section-card], [data-testid=question-block]'),
    ]
    expect(order[0]?.getAttribute('data-section-no')).toBe('1')
    expect(order[8]?.getAttribute('data-question-no')).toBe('8')
    expect(order[9]?.getAttribute('data-section-no')).toBe('2')
    // The options sit in a one-column grid below md and two from md.
    expect(blocks[0]!.find('.md\\:grid-cols-2').exists()).toBe(true)
  })

  it('the empty form has 153 invalid required fields and sends nothing', async () => {
    const { wrapper: w } = await create()
    const form = t(w, 'audio-form').element as HTMLFormElement
    const invalid = [...form.querySelectorAll('input, select, textarea')].filter(
      (el) => !(el as HTMLInputElement).checkValidity(),
    )
    expect(invalid).toHaveLength(153)
    expect(api.createAudioSet).not.toHaveBeenCalled()
  })

  it('a valid form posts the body, queues the flash and returns to S12', async () => {
    api.createAudioSet.mockResolvedValue({
      data: { id: 1 },
      status: 'Set Audio KBAT berjaya disimpan.',
    })
    const { wrapper: w, router } = await create()
    await fillRequired(w)
    expect(
      [
        ...(t(w, 'audio-form').element as HTMLFormElement).querySelectorAll(
          'input, select, textarea',
        ),
      ].filter((el) => !(el as HTMLInputElement).checkValidity()),
    ).toHaveLength(0)
    await t(w, 'audio-form').trigger('submit')
    await flushPromises()
    expect(api.createAudioSet).toHaveBeenCalledTimes(1)
    const body = api.createAudioSet.mock.calls[0]![0] as {
      title: string
      educationLevelId: number
      subjectId: number
      status: string
      sections: { title: string }[]
      questions: { questionText: string; correctAnswer: string; marks: number }[]
    }
    expect(body.title).toBe('BM T4 Ujian Mendengar Set 1')
    expect(body.educationLevelId).toBe(10)
    expect(body.subjectId).toBe(1)
    expect(body.status).toBe('approved')
    expect(body.sections).toHaveLength(4)
    expect(body.questions).toHaveLength(30)
    expect(body.questions[0]).toMatchObject({
      questionText: 'Soalan?',
      correctAnswer: 'A',
      marks: 1,
    })
    expect(useFlashStore().pending?.type).toBe('success')
    expect(router.currentRoute.value.path).toBe('/admin/audio-kbat')
  })

  it('a 422 keeps every value and shows the messages', async () => {
    api.createAudioSet.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { title: 'Medan ini diperlukan.', 'questions.3.optionA': 'Medan ini tidak sah.' },
      }),
    )
    const { wrapper: w, router } = await create()
    await fillRequired(w)
    await t(w, 'audio-form').trigger('submit')
    await flushPromises()
    expect((t(w, 'set-title').element as HTMLInputElement).value).toBe(
      'BM T4 Ujian Mendengar Set 1',
    )
    expect(t(w, 'audio-form-alert').text()).toContain('Medan ini tidak sah.')
    expect(w.text()).toContain('Medan ini diperlukan.')
    expect(router.currentRoute.value.path).toBe('/create')
  })

  it('a lookup failure replaces the form with the load error', async () => {
    api.fetchLevelOptions.mockRejectedValue(new Error('x'))
    const { wrapper: w } = await create()
    expect(t(w, 'audio-load-error').text()).toContain('Ralat memuatkan data')
    expect(w.find('[data-testid=audio-form]').exists()).toBe(false)
  })
})
