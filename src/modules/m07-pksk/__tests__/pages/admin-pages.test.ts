// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { usePageMeta } from '@/composables'
import { useFlashStore } from '@/stores/flash'

import type { PkskAccessItem, PkskQuestionDetail, PkskQuestionListItem } from '../../api/admin'
import PkskAccessPage from '../../pages/PkskAccessPage.vue'
import PkskQuestionFormPage from '../../pages/PkskQuestionFormPage.vue'
import PkskQuestionListPage from '../../pages/PkskQuestionListPage.vue'
import { chooseRowAction } from '../menu'

const admin = vi.hoisted(() => ({
  fetchPkskQuestions: vi.fn(),
  fetchPkskQuestionStats: vi.fn(),
  fetchPkskQuestion: vi.fn(),
  createPkskQuestion: vi.fn(),
  updatePkskQuestion: vi.fn(),
  deletePkskQuestion: vi.fn(),
  bulkPkskQuestions: vi.fn(),
  fetchPkskAccessList: vi.fn(),
  fetchPkskAccessStats: vi.fn(),
  grantPkskAccess: vi.fn(),
  revokePkskAccess: vi.fn(),
  fetchPkskPackages: vi.fn(),
}))
vi.mock('../../api/admin', () => admin)

const student = vi.hoisted(() => ({ fetchPkskDomains: vi.fn() }))
vi.mock('../../api/pksk', () => student)

const DOMAINS = [
  { id: 1, bahagian: 'A', name: 'Kecerdasan Insaniah', code: 'PKSK_INSANIAH' },
  { id: 2, bahagian: 'B', name: 'Matematik', code: 'PKSK_MATH' },
  { id: 3, bahagian: 'B', name: 'Sains', code: 'PKSK_SCI' },
  { id: 15, bahagian: 'C', name: 'Artikulasi Penulisan', code: 'PKSK_ESSAY' },
]

const item = (id: number, extra: Partial<PkskQuestionListItem> = {}): PkskQuestionListItem => ({
  id,
  questionText: `Soalan ${String(id)}`,
  bahagian: 'B',
  domain: { id: 2, code: 'PKSK_MATH', name: 'Matematik', icon: 'fa-calculator', color: '#3b82f6' },
  targetLevel: 'T1',
  status: 'approved',
  ...extra,
})

const listOf = <T>(rows: T[], totalItems = rows.length) => ({
  data: rows,
  meta: { page: 1, pageSize: 20, totalItems, totalPages: Math.max(1, Math.ceil(totalItems / 20)) },
})

let wrapper: VueWrapper | null = null
let router: Router
let confirmSpy: ReturnType<typeof vi.spyOn>

async function render(
  component: object,
  path: string,
  routePath: string,
  props: Record<string, unknown> = {},
): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: routePath, component, props: true },
      { path: '/admin/pksk/questions', component: { template: '<div id="list"/>' } },
    ],
  })
  await router.push(path)
  wrapper = mount(component, { props, attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of [...Object.values(admin), ...Object.values(student)]) fn.mockReset()
  student.fetchPkskDomains.mockResolvedValue(DOMAINS)
  confirmSpy = vi.spyOn(window, 'confirm')
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  confirmSpy.mockRestore()
})

const attr = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
const headBox = (w: VueWrapper) => w.get('thead button[role="checkbox"]')
const rowBoxes = (w: VueWrapper) => w.findAll('tbody button[role="checkbox"]')
const revokeButtons = (w: VueWrapper) => w.findAll('[data-ds=row-actions] button')
const value = (w: VueWrapper, id: string) =>
  (attr(w, id).element as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement).value

describe('PkskQuestionListPage (S5)', () => {
  const rows = [item(1), item(2, { status: 'pending', bahagian: 'A' }), item(3)]
  const PATH = '/admin/pksk/questions'

  beforeEach(() => {
    admin.fetchPkskQuestions.mockResolvedValue(listOf(rows, 3))
    admin.fetchPkskQuestionStats.mockResolvedValue({
      total: 763,
      approved: 763,
      pending: 0,
      t1: 383,
      t4: 380,
    })
  })

  it('renders the five global stat cards and the rows', async () => {
    const w = await render(PkskQuestionListPage, PATH, PATH)
    const tiles = ['total', 'approved', 'pending', 't1', 't4'].map((k) =>
      attr(w, 'stat-' + k).text(),
    )
    expect(tiles.map((x) => x.replace(/^[0-9]+/, ''))).toEqual([
      'Jumlah',
      'Diluluskan',
      'Menunggu',
      'Ting. 1',
      'Ting. 4',
    ])
    expect(tiles.map((x) => x.match(/^[0-9]+/)?.[0])).toEqual(['763', '763', '0', '383', '380'])
    expect(w.findAll('[data-testid=pksk-question-row]')).toHaveLength(3)
    expect(attr(w, 'pksk-add').attributes('href')).toBe('/admin/pksk/questions/create')
    expect(w.findAll('[data-testid=q-status]').map((e) => e.text())).toEqual([
      'Diluluskan',
      'Menunggu',
      'Diluluskan',
    ])
  })

  it('cuts the question text at 80 characters', async () => {
    admin.fetchPkskQuestions.mockResolvedValue(
      listOf([item(9, { questionText: 'x'.repeat(100) })], 1),
    )
    const w = await render(PkskQuestionListPage, PATH, PATH)
    expect(attr(w, 'q-text').text()).toBe(`${'x'.repeat(80)}...`)
  })

  it('shows the empty row with the create link and no pager', async () => {
    admin.fetchPkskQuestions.mockResolvedValue(listOf([], 0))
    const w = await render(PkskQuestionListPage, PATH, PATH)
    expect(attr(w, 'pksk-questions-empty').text()).toContain('Tiada soalan PKSK lagi')
    expect(attr(w, 'pksk-empty-add').text()).toBe('Tambah soalan pertama')
    expect(w.find('nav').exists()).toBe(false)
  })

  it('passes the URL filters to the API and keeps them in the controls', async () => {
    const w = await render(PkskQuestionListPage, `${PATH}?bahagian=A&level=t1&search=inovasi`, PATH)
    expect(admin.fetchPkskQuestions).toHaveBeenCalledWith(
      { bahagian: 'A', level: 't1', status: '', search: 'inovasi', page: 1 },
      expect.anything(),
    )
    expect(value(w, 'filter-bahagian')).toBe('A')
    expect(value(w, 'filter-level')).toBe('T1')
    expect(value(w, 'filter-search')).toBe('inovasi')
  })

  it('navigates at once when a select changes', async () => {
    const w = await render(PkskQuestionListPage, PATH, PATH)
    await attr(w, 'filter-bahagian').setValue('A')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ bahagian: 'A' })
  })

  it('selection: the header ticks the page ids and a row untick keeps the others', async () => {
    const w = await render(PkskQuestionListPage, PATH, PATH)
    expect(w.find('[data-testid=pksk-bulk-bar]').exists()).toBe(false)
    await headBox(w).trigger('click')
    expect(attr(w, 'bulk-count').text()).toBe('3 dipilih')
    await rowBoxes(w)[0]!.trigger('click')
    expect(attr(w, 'bulk-count').text()).toBe('2 dipilih')
    await rowBoxes(w)[1]!.trigger('click')
    await rowBoxes(w)[2]!.trigger('click')
    expect(w.find('[data-testid=pksk-bulk-bar]').exists()).toBe(false)
  })

  it('every row has a checkbox and clicking it toggles the selection', async () => {
    const w = await render(PkskQuestionListPage, PATH, PATH)
    expect(rowBoxes(w)).toHaveLength(3)
    await rowBoxes(w)[1]!.trigger('click')
    expect(attr(w, 'bulk-count').text()).toBe('1 dipilih')
    await rowBoxes(w)[1]!.trigger('click')
    expect(w.find('[data-testid=pksk-bulk-bar]').exists()).toBe(false)
    await headBox(w).trigger('click')
    expect(attr(w, 'bulk-count').text()).toBe('3 dipilih')
  })

  it('bulk approve sends the ids with no confirm and reloads with the flash', async () => {
    admin.bulkPkskQuestions.mockResolvedValue({
      data: { affected: 2 },
      status: '2 soalan telah diluluskan.',
    })
    const w = await render(PkskQuestionListPage, PATH, PATH)
    const boxes = rowBoxes(w)
    await boxes[0]!.trigger('click')
    await boxes[2]!.trigger('click')
    await attr(w, 'bulk-approve').trigger('click')
    await flushPromises()
    expect(confirmSpy).not.toHaveBeenCalled()
    expect(admin.bulkPkskQuestions).toHaveBeenCalledWith('approve', [1, 3])
    expect(admin.fetchPkskQuestionStats).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: '2 soalan telah diluluskan.',
    })
    expect(w.find('[data-testid=pksk-bulk-bar]').exists()).toBe(false)
  })

  it('bulk delete asks "Padam soalan terpilih?" and sends nothing on cancel', async () => {
    confirmSpy.mockReturnValue(false)
    const w = await render(PkskQuestionListPage, PATH, PATH)
    await headBox(w).trigger('click')
    await attr(w, 'bulk-delete').trigger('click')
    expect(confirmSpy).toHaveBeenCalledWith('Padam soalan terpilih?')
    expect(admin.bulkPkskQuestions).not.toHaveBeenCalled()
  })

  it('row delete asks "Padam soalan ini?" and calls #12 on OK', async () => {
    confirmSpy.mockReturnValueOnce(false).mockReturnValueOnce(true)
    admin.deletePkskQuestion.mockResolvedValue(undefined)
    const w = await render(PkskQuestionListPage, PATH, PATH)
    await chooseRowAction(w, 1, 'Padam')
    expect(admin.deletePkskQuestion).not.toHaveBeenCalled()
    await chooseRowAction(w, 1, 'Padam')
    expect(confirmSpy).toHaveBeenCalledWith('Padam soalan ini?')
    expect(admin.deletePkskQuestion).toHaveBeenCalledWith(2)
    expect(useFlashStore().current?.message).toBe('Soalan PKSK berjaya dipadam.')
  })

  it('links the edit icon to the edit page', async () => {
    const w = await render(PkskQuestionListPage, PATH, PATH)
    expect(w.find('a[href="/admin/pksk/questions/1/edit"]').exists()).toBe(true)
  })
})

describe('PkskQuestionFormPage create (S6)', () => {
  const CREATE = '/admin/pksk/questions/create'
  const mountCreate = () => render(PkskQuestionFormPage, CREATE, CREATE, { mode: 'create' })
  const correctVisible = (w: VueWrapper) =>
    w.findAll('[data-testid=option-correct]').filter((l) => l.isVisible()).length

  it('starts with the live defaults: 4 option rows, T1, "3 - Sederhana", all domains', async () => {
    const w = await mountCreate()
    expect(w.findAll('[data-testid=option-row]')).toHaveLength(4)
    expect(value(w, 'q-level')).toBe('T1')
    expect(value(w, 'q-difficulty')).toBe('3')
    expect(
      attr(w, 'q-domain')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual([
      '-- Pilih domain --',
      'Kecerdasan Insaniah',
      'Matematik',
      'Sains',
      'Artikulasi Penulisan',
    ])
    expect(attr(w, 'options-card').get('h2').text()).toBe('Pilihan Jawapan')
  })

  it('filters the domains by Bahagian and resets only the domain (DV-M07-08)', async () => {
    const w = await mountCreate()
    await attr(w, 'q-bahagian').setValue('B')
    await attr(w, 'q-domain').setValue('3')
    await attr(w, 'q-text').setValue('Teks')
    await attr(w, 'q-level').setValue('T4')
    await attr(w, 'q-bahagian').setValue('A')
    expect(value(w, 'q-domain')).toBe('')
    expect(attr(w, 'q-domain').findAll('option')).toHaveLength(2)
    expect(value(w, 'q-text')).toBe('Teks')
    expect(value(w, 'q-level')).toBe('T4')
  })

  it('shows the suffix only for A and "Betul" only for B', async () => {
    const w = await mountCreate()
    await attr(w, 'q-bahagian').setValue('A')
    expect(attr(w, 'options-card').get('h2').text()).toContain('(Tiada jawapan betul/salah)')
    expect(correctVisible(w)).toBe(0)
    await attr(w, 'q-bahagian').setValue('B')
    expect(attr(w, 'options-card').get('h2').text()).toBe('Pilihan Jawapan')
    expect(correctVisible(w)).toBe(4)
  })

  it('limits the option rows to 2-6 and re-letters them', async () => {
    const w = await mountCreate()
    await attr(w, 'option-add').trigger('click')
    await attr(w, 'option-add').trigger('click')
    expect(w.findAll('[data-testid=option-letter]').map((l) => l.text())).toEqual([
      'A',
      'B',
      'C',
      'D',
      'E',
      'F',
    ])
    expect(attr(w, 'option-add').isVisible()).toBe(false)
    for (let i = 0; i < 4; i++) await w.findAll('[data-testid=option-remove]')[0]!.trigger('click')
    expect(w.findAll('[data-testid=option-row]')).toHaveLength(2)
    expect(w.findAll('[data-testid=option-letter]').map((l) => l.text())).toEqual(['A', 'B'])
    expect(w.findAll('[data-testid=option-remove]').every((b) => !b.isVisible())).toBe(true)
  })

  it('hides and disables the options for C and posts no options (DV-M07-05)', async () => {
    admin.createPkskQuestion.mockResolvedValue({
      data: {},
      status: 'Soalan PKSK berjaya ditambah.',
    })
    const w = await mountCreate()
    await attr(w, 'q-bahagian').setValue('C')
    expect(attr(w, 'options-card').isVisible()).toBe(false)
    for (const input of w.findAll('[data-testid=option-text]')) {
      expect(input.attributes('disabled')).toBeDefined()
    }
    await attr(w, 'q-domain').setValue('15')
    await attr(w, 'q-text').setValue('Esei')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(admin.createPkskQuestion).toHaveBeenCalledWith({
      bahagian: 'C',
      pkskDomainId: 15,
      pkskTargetLevel: 'T1',
      questionText: 'Esei',
      difficultyLevel: 3,
    })
    expect(router.currentRoute.value.path).toBe('/admin/pksk/questions')
  })

  it('posts the options of a B question with the Betul flags', async () => {
    admin.createPkskQuestion.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await mountCreate()
    await attr(w, 'q-bahagian').setValue('B')
    await attr(w, 'q-domain').setValue('2')
    await attr(w, 'q-text').setValue('2 + 2?')
    const texts = w.findAll('[data-testid=option-text]')
    for (const [i, t] of ['1', '2', '3', '4'].entries()) await texts[i]!.setValue(t)
    await w.findAll('[data-testid=option-correct]')[3]!.trigger('click')
    await attr(w, 'q-explanation').setValue('  Mudah  ')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(admin.createPkskQuestion.mock.calls[0]![0]).toMatchObject({
      bahagian: 'B',
      pkskDomainId: 2,
      explanation: 'Mudah',
      options: [
        { text: '1', isCorrect: false },
        { text: '2', isCorrect: false },
        { text: '3', isCorrect: false },
        { text: '4', isCorrect: true },
      ],
    })
  })

  it('drops a correct flag ticked under B when the Bahagian is switched to A', async () => {
    admin.createPkskQuestion.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await mountCreate()
    await attr(w, 'q-bahagian').setValue('B')
    await w.findAll('[data-testid=option-correct]')[1]!.trigger('click')
    await attr(w, 'q-bahagian').setValue('A')
    await attr(w, 'q-domain').setValue('1')
    await attr(w, 'q-text').setValue('Nilai')
    for (const input of w.findAll('[data-testid=option-text]')) await input.setValue('x')
    await w.get('form').trigger('submit')
    await flushPromises()
    const body = admin.createPkskQuestion.mock.calls[0]![0] as { options: { isCorrect: boolean }[] }
    expect(body.options.every((o) => o.isCorrect === false)).toBe(true)
  })

  it('shows a 422 field message under the field and keeps the input', async () => {
    admin.createPkskQuestion.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Tidak sah.',
        fields: { questionText: 'Sila masukkan teks soalan.' },
      }),
    )
    const w = await mountCreate()
    await attr(w, 'q-bahagian').setValue('C')
    await attr(w, 'q-domain').setValue('15')
    await attr(w, 'q-text').setValue('Esei')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(attr(w, 'field-error').text()).toBe('Sila masukkan teks soalan.')
    expect(value(w, 'q-text')).toBe('Esei')
    expect(router.currentRoute.value.path).toBe(CREATE)
  })

  it('uses native validation only: required fields and no novalidate', async () => {
    const w = await mountCreate()
    expect(w.get('form').attributes('novalidate')).toBeUndefined()
    expect(attr(w, 'q-bahagian').attributes('required')).toBeDefined()
    expect(attr(w, 'q-domain').attributes('required')).toBeDefined()
    expect(attr(w, 'q-text').attributes('required')).toBeDefined()
  })
})

describe('PkskQuestionFormPage edit (S7)', () => {
  const detail = (extra: Partial<PkskQuestionDetail> = {}): PkskQuestionDetail => ({
    id: 55,
    bahagian: 'B',
    pkskDomainId: 2,
    pkskTargetLevel: 'T4',
    status: 'approved',
    questionText: 'Teks asal',
    difficultyLevel: 3,
    explanation: 'Penjelasan',
    options: [
      { text: 'Satu', isCorrect: true },
      { text: 'Dua', isCorrect: false },
      { text: 'Tiga', isCorrect: false },
    ],
    ...extra,
  })

  const mountEdit = () =>
    render(
      PkskQuestionFormPage,
      '/admin/pksk/questions/55/edit',
      '/admin/pksk/questions/:id/edit',
      {
        mode: 'edit',
        id: '55',
      },
    )
  const correctVisible = (w: VueWrapper) =>
    w.findAll('[data-testid=option-correct]').filter((l) => l.isVisible()).length

  it('prefills the form from #9 with "[B] name" domain options', async () => {
    admin.fetchPkskQuestion.mockResolvedValue(detail())
    const w = await mountEdit()
    expect(admin.fetchPkskQuestion).toHaveBeenCalledWith(55, expect.anything())
    expect(
      attr(w, 'q-domain')
        .findAll('option')
        .map((o) => o.text())[1],
    ).toBe('[B] Matematik')
    expect(value(w, 'q-domain')).toBe('2')
    expect(value(w, 'q-level')).toBe('T4')
    expect(value(w, 'q-status')).toBe('approved')
    expect(value(w, 'q-text')).toBe('Teks asal')
    expect(value(w, 'q-difficulty')).toBe('3')
    expect(
      w.findAll('[data-testid=option-text]').map((i) => (i.element as HTMLInputElement).value),
    ).toEqual(['Satu', 'Dua', 'Tiga'])
    expect(attr(w, 'form-submit').text()).toBe('Kemaskini')
    expect(attr(w, 'options-card').get('h2').text()).toBe('Pilihan Jawapan')
    expect(correctVisible(w)).toBe(3)
  })

  it('reloads the question and the header when the id param changes', async () => {
    admin.fetchPkskQuestion.mockImplementation((id: number) =>
      Promise.resolve(detail({ id, questionText: `Teks ${String(id)}` })),
    )
    const w = await mountEdit()
    expect(value(w, 'q-text')).toBe('Teks 55')
    await w.setProps({ id: '56' })
    await flushPromises()
    expect(admin.fetchPkskQuestion).toHaveBeenLastCalledWith(56, expect.anything())
    expect(value(w, 'q-text')).toBe('Teks 56')
    expect(usePageMeta().state.header?.subtitle).toBe('Kemaskini soalan #56')
  })

  it('does not render the options card for a saved Bahagian C', async () => {
    admin.fetchPkskQuestion.mockResolvedValue(
      detail({ bahagian: 'C', pkskDomainId: 15, options: [] }),
    )
    const w = await mountEdit()
    expect(w.find('[data-testid=options-card]').exists()).toBe(false)
  })

  it('hides "Betul" for a saved A but keeps and sends the flag', async () => {
    admin.fetchPkskQuestion.mockResolvedValue(detail({ bahagian: 'A', pkskDomainId: 1 }))
    admin.updatePkskQuestion.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await mountEdit()
    expect(correctVisible(w)).toBe(0)
    await w.get('form').trigger('submit')
    await flushPromises()
    const body = admin.updatePkskQuestion.mock.calls[0]![1] as { options: unknown[] }
    expect(body.options[0]).toEqual({ text: 'Satu', isCorrect: true })
  })

  it('submits the saved status and a domain change does not touch the options card', async () => {
    admin.fetchPkskQuestion.mockResolvedValue(detail())
    admin.updatePkskQuestion.mockResolvedValue({
      data: {},
      status: 'Soalan PKSK berjaya dikemaskini.',
    })
    const w = await mountEdit()
    await attr(w, 'q-domain').setValue('1')
    expect(correctVisible(w)).toBe(3)
    await attr(w, 'q-status').setValue('pending')
    await w.get('form').trigger('submit')
    await flushPromises()
    expect(admin.updatePkskQuestion).toHaveBeenCalledWith(
      55,
      expect.objectContaining({ pkskDomainId: 1, status: 'pending', questionText: 'Teks asal' }),
    )
    expect(useFlashStore().pending?.message).toBe('Soalan PKSK berjaya dikemaskini.')
  })
})

describe('PkskAccessPage (S8)', () => {
  const PATH = '/admin/pksk/access'
  const row = (id: number, extra: Partial<PkskAccessItem> = {}): PkskAccessItem => ({
    id,
    user: { id: 4, name: 'Pelajar Maju Demo', email: 'pelajarmaju@demo.test' },
    package: { id: 3, name: 'PKSK Kombo (T1 + T4)', level: 'ALL' },
    grantedBy: null,
    grantedAt: '2026-04-22T10:00:00+08:00',
    expiresAt: null,
    status: 'active',
    displayStatus: 'active',
    ...extra,
  })

  beforeEach(() => {
    admin.fetchPkskAccessList.mockResolvedValue(
      listOf([row(3), row(2, { grantedBy: { id: 1, name: 'Admin Demo' } })]),
    )
    admin.fetchPkskAccessStats.mockResolvedValue({ activeTotal: 3, t1: 3, t4: 3 })
    admin.fetchPkskPackages.mockResolvedValue([
      { id: 1, name: 'PKSK Tingkatan 1 (SBP/MRSM)', level: 'T1' },
      { id: 2, name: 'PKSK Tingkatan 4 (SBP/MRSM)', level: 'T4' },
      { id: 3, name: 'PKSK Kombo (T1 + T4)', level: 'ALL' },
    ])
  })

  it('renders the stat cards, the columns and the row cells', async () => {
    const w = await render(PkskAccessPage, PATH, PATH)
    expect(
      ['active', 't1', 't4'].map((k) =>
        attr(w, 'stat-' + k)
          .text()
          .replace(/^[0-9]+/, ''),
      ),
    ).toEqual(['Jumlah Akses Aktif', 'Akses T1', 'Akses T4'])
    expect(w.findAll('th').map((e) => e.text())).toEqual([
      'Pengguna',
      'Pakej',
      'Diberi Oleh',
      'Tarikh',
      'Tamat',
      'Status',
      'Tindakan',
    ])
    const first = w.get('tbody tr')
    expect(first.get('[data-testid=a-granter]').text()).toBe('-')
    expect(first.get('[data-testid=a-granted]').text()).toBe('22/04/2026')
    expect(first.get('[data-testid=a-expires]').text()).toBe('Tiada had')
    expect(first.get('[data-testid=a-status]').text()).toBe('Aktif')
    expect(first.get('[data-ds=row-actions] button').attributes('aria-label')).toBe('Tarik')
    expect(w.findAll('[data-testid=a-granter]')[1]!.text()).toBe('Admin Demo')
  })

  it('shows "Tarik" only on active rows and the expired / revoked labels', async () => {
    admin.fetchPkskAccessList.mockResolvedValue(
      listOf([
        row(1, { displayStatus: 'expired', expiresAt: '2026-06-30' }),
        row(2, { displayStatus: 'revoked', status: 'revoked' }),
      ]),
    )
    const w = await render(PkskAccessPage, PATH, PATH)
    expect(revokeButtons(w)).toHaveLength(0)
    expect(w.findAll('[data-testid=a-status]').map((e) => e.text())).toEqual([
      'Tamat Tempoh',
      'Ditarik',
    ])
    expect(w.findAll('[data-testid=a-expires]')[0]!.text()).toBe('30/06/2026')
  })

  it('shows the empty row "Tiada rekod akses"', async () => {
    admin.fetchPkskAccessList.mockResolvedValue(listOf([], 0))
    const w = await render(PkskAccessPage, PATH, PATH)
    expect(attr(w, 'access-empty').text()).toBe('Tiada rekod akses')
  })

  it('starts with the grant form hidden and keeps its values across the toggle', async () => {
    const w = await render(PkskAccessPage, PATH, PATH)
    expect(attr(w, 'grant-form').isVisible()).toBe(false)
    await attr(w, 'grant-toggle').trigger('click')
    expect(attr(w, 'grant-form').isVisible()).toBe(true)
    await attr(w, 'grant-user').setValue('123')
    await attr(w, 'grant-toggle').trigger('click')
    await attr(w, 'grant-toggle').trigger('click')
    expect(value(w, 'grant-user')).toBe('123')
    expect(
      attr(w, 'grant-package')
        .findAll('option')
        .map((o) => o.text()),
    ).toEqual([
      'PKSK Tingkatan 1 (SBP/MRSM) (T1)',
      'PKSK Tingkatan 4 (SBP/MRSM) (T4)',
      'PKSK Kombo (T1 + T4) (ALL)',
    ])
    expect(value(w, 'grant-package')).toBe('1')
    expect(attr(w, 'grant-user').attributes('type')).toBe('number')
    expect(attr(w, 'grant-expires').attributes('type')).toBe('date')
    expect(w.text()).not.toContain('Batal')
  })

  it('grants access, closes the form, reloads and flashes', async () => {
    admin.grantPkskAccess.mockResolvedValue({ data: row(9), status: 'Akses PKSK berjaya diberi.' })
    const w = await render(PkskAccessPage, PATH, PATH)
    await attr(w, 'grant-toggle').trigger('click')
    await attr(w, 'grant-user').setValue('3')
    await attr(w, 'grant-package').setValue('2')
    await attr(w, 'grant-expires').setValue('2026-12-31')
    await attr(w, 'grant-form').trigger('submit')
    await flushPromises()
    expect(admin.grantPkskAccess).toHaveBeenCalledWith({
      userId: 3,
      packageId: 2,
      expiresAt: '2026-12-31',
    })
    expect(attr(w, 'grant-form').isVisible()).toBe(false)
    expect(admin.fetchPkskAccessList).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current?.message).toBe('Akses PKSK berjaya diberi.')
  })

  it('sends a null expiry when "Tamat Tempoh" is empty', async () => {
    admin.grantPkskAccess.mockResolvedValue({ data: row(9), status: 'ok' })
    const w = await render(PkskAccessPage, PATH, PATH)
    await attr(w, 'grant-user').setValue('3')
    await attr(w, 'grant-form').trigger('submit')
    await flushPromises()
    expect(admin.grantPkskAccess).toHaveBeenCalledWith({ userId: 3, packageId: 1, expiresAt: null })
  })

  it('shows "Pengguna tidak dijumpai." under "ID Pengguna" for an unknown user', async () => {
    admin.grantPkskAccess.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'Tidak sah.',
        fields: { userId: 'Pengguna tidak dijumpai.' },
      }),
    )
    const w = await render(PkskAccessPage, PATH, PATH)
    await attr(w, 'grant-toggle').trigger('click')
    await attr(w, 'grant-user').setValue('999999')
    await attr(w, 'grant-form').trigger('submit')
    await flushPromises()
    expect(attr(w, 'field-error').text()).toBe('Pengguna tidak dijumpai.')
    expect(admin.fetchPkskAccessList).toHaveBeenCalledTimes(1)
    expect(useFlashStore().current).toBeNull()
  })

  it('revoke asks "Tarik balik akses?", sends nothing on cancel and reloads on OK', async () => {
    confirmSpy.mockReturnValueOnce(false).mockReturnValueOnce(true)
    admin.revokePkskAccess.mockResolvedValue({
      data: row(3, { displayStatus: 'revoked' }),
      status: 'Akses PKSK telah ditarik balik.',
    })
    const w = await render(PkskAccessPage, PATH, PATH)
    const button = revokeButtons(w)[0]!
    await button.trigger('click')
    expect(confirmSpy).toHaveBeenCalledWith('Tarik balik akses?')
    expect(admin.revokePkskAccess).not.toHaveBeenCalled()
    await button.trigger('click')
    await flushPromises()
    expect(admin.revokePkskAccess).toHaveBeenCalledWith(3)
    expect(admin.fetchPkskAccessStats).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current?.message).toBe('Akses PKSK telah ditarik balik.')
  })

  it('reloads the list and the cards after a 409 so the stale row goes away', async () => {
    confirmSpy.mockReturnValue(true)
    admin.revokePkskAccess.mockRejectedValue(
      new ApiError({ status: 409, code: 'CONFLICT', message: 'Akses ini tidak aktif.' }),
    )
    const w = await render(PkskAccessPage, PATH, PATH)
    admin.fetchPkskAccessList.mockResolvedValue(listOf([row(2)]))
    await revokeButtons(w)[0]!.trigger('click')
    await flushPromises()
    expect(useFlashStore().current?.type).toBe('error')
    expect(admin.fetchPkskAccessList).toHaveBeenCalledTimes(2)
    expect(admin.fetchPkskAccessStats).toHaveBeenCalledTimes(2)
    expect(w.findAll('[data-testid=access-row]')).toHaveLength(1)
  })

  it('passes the search to the API', async () => {
    await render(PkskAccessPage, `${PATH}?search=maju`, PATH)
    expect(admin.fetchPkskAccessList).toHaveBeenCalledWith(
      { search: 'maju', page: 1 },
      expect.anything(),
    )
  })
})
