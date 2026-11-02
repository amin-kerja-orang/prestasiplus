// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { QuestionRow, QuestionSummary } from '../../api/questions'
import QuestionListPage from '../../pages/QuestionListPage.vue'

const questions = vi.hoisted(() => ({
  fetchQuestions: vi.fn(),
  fetchQuestionSummary: vi.fn(),
  deleteQuestion: vi.fn(),
  bulkQuestionAction: vi.fn(),
  bulkQuestionsByFilter: vi.fn(),
}))
// `buildBulkFilter` and the types stay real.
vi.mock('../../api/questions', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../api/questions')>()),
  ...questions,
}))
const lookups = vi.hoisted(() => ({ fetchSubjects: vi.fn(), fetchEducationLevels: vi.fn() }))
vi.mock('../../api/lookups', () => lookups)

/** `useConfirm` falls back to `window.confirm` when no host is mounted. */
const dialogs = { confirmNative: vi.fn((message: string) => message !== '') }

function row(id: number, extra: Partial<QuestionRow> = {}): QuestionRow {
  return {
    id,
    questionText: `Soalan contoh ${String(id)}`,
    subject: { id: 4, name: 'Sains' },
    level: { id: 11, name: 'Tingkatan 5' },
    difficultyLevel: 3,
    status: 'approved',
    isActive: true,
    complianceStatus: 'verified',
    aiVerified: true,
    dskpTagged: true,
    sourceType: 'textbook',
    sourceFile: 'buku-contoh.pdf',
    kertas: null,
    numberLabel: null,
    ...extra,
  }
}

function listResult(rows: QuestionRow[], total = rows.length, page = 1) {
  return {
    data: rows,
    meta: { page, pageSize: 20, totalItems: total, totalPages: Math.max(1, Math.ceil(total / 20)) },
  }
}

const SUMMARY: QuestionSummary = {
  total: 465278,
  subjects: [
    {
      id: 1,
      name: 'Bahasa Melayu',
      icon: 'fa-book-open',
      group: 'teras',
      total: 32905,
      approved: 13081,
    },
    {
      id: 8,
      name: 'Matematik Tambahan',
      icon: 'fa-square-root-alt',
      group: 'elektif',
      total: 7580,
      approved: 2579,
    },
    { id: 28, name: 'Sains Sukan', icon: 'fa-book', group: 'elektif', total: 0, approved: 0 },
  ],
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(url = '/admin/questions'): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/questions', component: QuestionListPage },
      { path: '/admin/questions/:pathMatch(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push(url)
  wrapper = mount(QuestionListPage, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)

beforeEach(() => {
  window.localStorage.clear()
  setActivePinia(createPinia())
  for (const fn of [...Object.values(questions), ...Object.values(lookups)]) fn.mockReset()
  dialogs.confirmNative.mockReset()
  dialogs.confirmNative.mockReturnValue(true)
  vi.spyOn(window, 'confirm').mockImplementation((message) => dialogs.confirmNative(message ?? ''))
  questions.fetchQuestionSummary.mockResolvedValue(SUMMARY)
  questions.fetchQuestions.mockResolvedValue(
    listResult(
      [
        row(564159),
        row(564160, { dskpTagged: false, aiVerified: false, sourceType: null, sourceFile: null }),
        row(564161, { status: 'archived', isActive: false, complianceStatus: 'pending_mapping' }),
      ],
      465278,
    ),
  )
  lookups.fetchSubjects.mockResolvedValue({
    data: [{ id: 1, name: 'Bahasa Melayu', color: '#3B82F6' }],
    meta: {},
  })
  lookups.fetchEducationLevels.mockResolvedValue({
    data: [{ id: 11, name: 'Tingkatan 5' }],
    meta: {},
  })
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('QuestionListPage (M04 S1)', () => {
  it('shows the header, the KPI strip and the collapsible subject breakdown with full names', async () => {
    const w = await render()
    expect(w.text()).toContain('Urus bank soalan untuk platform PRESTASIPLUS')
    expect(t(w, 'questions-total').text().replace(/\s+/g, ' ')).toBe('Jumlah: 465,278 soalan')
    const kpis = t(w, 'questions-kpis').text()
    expect(kpis).toContain('465,278')
    expect(kpis).toContain('Diluluskan')
    // The breakdown is collapsed until opened.
    expect(w.find('[data-testid="questions-tile"]').exists()).toBe(false)
    await t(w, 'questions-summary-toggle').trigger('click')
    const tiles = w.findAll('[data-testid="questions-tile"]')
    expect(tiles).toHaveLength(3)
    // Sorted by Jumlah, descending; full names, never cut.
    expect(tiles.map((n) => n.text())).toEqual([
      'Bahasa Melayu',
      'Matematik Tambahan',
      'Sains Sukan',
    ])
    const totals = w.findAll('[data-testid="questions-tile-total"]').map((n) => n.text())
    expect(totals[0]).toBe('32,905')
    const approved = w.findAll('[data-testid="questions-tile-approved"]').map((n) => n.text())
    expect(approved[0]).toBe('13,081 lulus')
    // "lulus" is hidden when the approved count is 0.
    expect(approved).toHaveLength(2)
    expect(w.find('[data-testid="questions-clear-subject"]').exists()).toBe(false)
  })

  it('marks the active tile and offers to clear the subject filter', async () => {
    const w = await render('/admin/questions?subject_id=8')
    await t(w, 'questions-summary-toggle').trigger('click')
    const active = w
      .findAll('[data-testid="questions-tile"]')
      .filter((n) => n.attributes('aria-current') === 'true')
    expect(active.map((n) => n.attributes('data-subject-id'))).toEqual(['8'])
    expect(t(w, 'questions-clear-subject').text()).toContain('Padam filter subjek — tunjuk semua')
    expect(questions.fetchQuestions.mock.calls[0]?.[0]).toMatchObject({ subjectId: '8' })
  })

  it('shows "Esei pilihan" and the topics only for an essay_choice row (H-C3)', async () => {
    questions.fetchQuestions.mockResolvedValue(
      listResult(
        [
          row(1, { essayTopics: [{ id: 't1', label: 'Peranan belia' }, { id: 't2', label: 'Kepentingan membaca' }] }),
          row(2),
        ],
        2,
      ),
    )
    const w = await render()
    const rows = w.findAll('tbody tr')
    expect(rows[0]?.get('[data-testid="question-essay-choice"]').text()).toContain('Esei pilihan')
    expect(rows[0]?.findAll('[data-testid="question-essay-topic"]').map((n) => n.text())).toEqual([
      '1. Peranan belia',
      '2. Kepentingan membaca',
    ])
    expect(rows[1]?.find('[data-testid="question-essay-choice"]').exists()).toBe(false)
  })

  it('renders the rows in API order with badges, source and status', async () => {
    const w = await render()
    const rows = w.findAll('tbody tr')
    expect(rows.map((r) => r.get('[data-testid="question-id"]').text())).toEqual([
      '564159',
      '564160',
      '564161',
    ])
    expect(rows[0]?.text()).toContain('DSKP')
    expect(rows[0]?.text()).toContain('VERIFIED')
    expect(rows[0]?.text()).toContain('AI Verified')
    expect(rows[0]?.text()).toContain('Source: TEXTBOOK')
    expect(rows[0]?.text()).toContain('buku-contoh.pdf')
    expect(rows[1]?.text()).toContain('Latihan Tambahan')
    expect(rows[1]?.text()).toContain('Source: TIADA')
    expect(rows[2]?.text()).toContain('PENDING MAPPING')
    expect(rows[2]?.text()).toContain('Arkib')
    expect(rows[2]?.text()).toContain('INACTIVE')
  })

  it('cuts a long question text to 80 characters + "..."', async () => {
    questions.fetchQuestions.mockResolvedValue(
      listResult([row(1, { questionText: 'x'.repeat(100) })]),
    )
    const w = await render()
    expect(t(w, 'question-text').text()).toBe(`${'x'.repeat(80)}...`)
  })

  it('shows the English pager and keeps the filters on its links', async () => {
    const w = await render('/admin/questions?status=approved')
    const pager = w.get('[data-ds="data-table-pager"]')
    expect(pager.text().replace(/\s+/g, ' ')).toContain('Menunjukkan 1-20 daripada 465278 hasil')
    const next = pager.findAll('button').find((b) => b.text() === '2')
    await next?.trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ status: 'approved', page: '2' })
  })

  it('submits the filter form to the URL (snake_case names) and refetches', async () => {
    const w = await render()
    await t(w, 'questions-subject').setValue('1')
    await t(w, 'questions-search').setValue('  satelit ')
    await w.get('[data-testid="questions-filter"]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ subject_id: '1', search: 'satelit' })
    expect(questions.fetchQuestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ subjectId: '1', search: 'satelit' }),
    )
  })

  it('hides table and pager and shows the empty block when nothing matches', async () => {
    questions.fetchQuestions.mockResolvedValue(listResult([], 0))
    const w = await render('/admin/questions?search=zzqxv')
    expect(t(w, 'questions-empty').text()).toContain('Tiada soalan dijumpai')
    expect(t(w, 'questions-empty-add').text()).toContain('Tambah Soalan Pertama')
    expect(w.find('[data-testid="questions-table"]').exists()).toBe(false)
    expect(w.find('[data-ds="data-table-pager"]').exists()).toBe(false)
  })

  it('shows the red box with "Cuba Semula" when the list fails, and retries', async () => {
    questions.fetchQuestions.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat' }),
    )
    const w = await render()
    expect(t(w, 'questions-error').text()).toContain('Cuba Semula')
    await t(w, 'questions-retry').trigger('click')
    await flushPromises()
    expect(w.findAll('tbody tr')).toHaveLength(3)
  })

  it('ticks rows, shows the bulk bar and select-all ticks the page', async () => {
    const w = await render()
    expect(w.find('[data-testid="questions-bulk-bar"]').exists()).toBe(false)
    await w.findAll('tbody [role="checkbox"]')[0]?.trigger('click')
    await flushPromises()
    expect(t(w, 'questions-selected-count').text()).toBe('1')
    expect(w.get('[data-testid="questions-bulk-bar"]').text()).toContain('soalan dipilih')
    await w.get('thead [role="checkbox"]').trigger('click')
    await flushPromises()
    expect(t(w, 'questions-selected-count').text()).toBe('3')
    expect(t(w, 'questions-bulk-action').attributes('required')).toBeDefined()
  })

  it('bulk action: native confirm with the verb and count, then the API and the status flash', async () => {
    questions.bulkQuestionAction.mockResolvedValue({
      data: { affected: 2 },
      status: '2 soalan berjaya dikemaskini.',
    })
    const w = await render()
    const boxes = w.findAll('tbody [role="checkbox"]')
    await boxes[0]?.trigger('click')
    await boxes[1]?.trigger('click')
    await flushPromises()
    await t(w, 'questions-bulk-action').setValue('archive')
    await w.get('[data-testid="questions-bulk-bar"]').trigger('submit')
    await flushPromises()
    expect(dialogs.confirmNative).toHaveBeenCalledWith(
      'Adakah anda pasti mahu mengarkibkan 2 soalan?',
    )
    expect(questions.bulkQuestionAction).toHaveBeenCalledWith('archive', [564159, 564160])
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: '2 soalan berjaya dikemaskini.',
    })
    expect(w.find('[data-testid="questions-bulk-bar"]').exists()).toBe(false)
  })

  it('REQ-A-023: a delete with failed[] lists each refused row with the server message', async () => {
    questions.bulkQuestionAction.mockResolvedValue({
      data: { affected: 1 },
      status: '1 soalan berjaya dikemaskini.',
      failed: [{ id: 564160, code: 'CONFLICT', message: 'Teks pelayan: tidak boleh dipadam.' }],
    })
    const w = await render()
    const boxes = w.findAll('tbody [role="checkbox"]')
    await boxes[0]?.trigger('click')
    await boxes[1]?.trigger('click')
    await flushPromises()
    await t(w, 'questions-bulk-action').setValue('delete')
    await w.get('[data-testid="questions-bulk-bar"]').trigger('submit')
    await flushPromises()
    expect(useFlashStore().current).toEqual({
      type: 'error',
      message: [
        '1 soalan berjaya dikemaskini, 1 tidak dikemaskini.',
        'Soalan #564160: Teks pelayan: tidak boleh dipadam.',
      ],
    })
  })

  it('sends nothing when the bulk confirm is dismissed', async () => {
    dialogs.confirmNative.mockReturnValue(false)
    const w = await render()
    await w.findAll('tbody [role="checkbox"]')[0]?.trigger('click')
    await flushPromises()
    await t(w, 'questions-bulk-action').setValue('delete')
    await w.get('[data-testid="questions-bulk-bar"]').trigger('submit')
    await flushPromises()
    expect(questions.bulkQuestionAction).not.toHaveBeenCalled()
  })

  it('deletes a row after the native confirm and flashes the API status', async () => {
    questions.deleteQuestion.mockResolvedValue({
      data: { deleted: 1 },
      status: 'Soalan berjaya dipadam.',
    })
    const w = await render()
    await w.findAll('[data-testid="question-more"]')[0]?.trigger('keydown', { key: 'Enter' })
    await flushPromises()
    const del = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((n) =>
      (n.textContent ?? '').includes('Padam'),
    )
    expect(del).toBeDefined()
    del?.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await flushPromises()
    expect(dialogs.confirmNative).toHaveBeenCalledWith(
      'Adakah anda pasti mahu memadamkan soalan ini?',
    )
    expect(questions.deleteQuestion).toHaveBeenCalledWith(564159)
    expect(useFlashStore().current).toEqual({
      type: 'success',
      message: 'Soalan berjaya dipadam.',
    })
  })

  it('links the row actions to the detail and edit pages', async () => {
    const w = await render()
    const first = w.get('tbody tr')
    expect(first.get('[data-testid="question-view"]').attributes('href')).toBe(
      '/admin/questions/564159',
    )
    expect(first.get('[data-testid="question-edit"]').attributes('href')).toBe(
      '/admin/questions/564159/edit',
    )
    expect(first.get('[data-testid="question-view"]').attributes('aria-label')).toBe('Lihat')
    expect(first.get('[data-testid="question-edit"]').attributes('aria-label')).toBe('Edit')
  })

  it("renders v2 wire statuses (approved, review, archived) and an unknown one without crashing (issue 61)", async () => {
    questions.fetchQuestions.mockResolvedValue(
      listResult([
        row(1, { status: "approved" }),
        row(2, { status: "review" as never }),
        row(3, { status: "archived" }),
        row(4, { status: "mystery" as never, complianceStatus: "weird" as never }),
      ]),
    )
    const w = await render()
    const badges = w.findAll("[data-testid=\"question-status\"]").map((b) => b.text())
    expect(badges).toEqual(["Diluluskan", "Menunggu Semakan", "Arkib", "Tidak diketahui"])
  })
})

describe('QuestionListPage: Luluskan Hasil Tapisan / Arkib Semua (REQ-A-021)', () => {
  const RESULT = {
    matched: 12,
    eligible: 10,
    skipped: 2,
    cap: 500,
    processed: 0,
    affected: 0,
    failed: [],
    remaining: 10,
    capped: false,
    dryRun: true,
  }
  const done = (extra: Record<string, unknown> = {}) => ({
    data: { ...RESULT, processed: 10, affected: 10, remaining: 0, dryRun: false, ...extra },
    status: 'x',
  })

  it('"Luluskan Hasil Tapisan" is disabled with the reason when no filter is set; "Arkib Semua" is not', async () => {
    const w = await render()
    expect(t(w, 'questions-approve-filter').attributes('disabled')).toBeDefined()
    expect(t(w, 'questions-approve-filter-hint').text()).toContain('Sila pilih sekurang-kurangnya satu penapis')
    expect(t(w, 'questions-archive-all').attributes('disabled')).toBeUndefined()
  })

  it('a whitespace-only search is no filter', async () => {
    const w = await render('/admin/questions?search=%20%20')
    expect(t(w, 'questions-approve-filter').attributes('disabled')).toBeDefined()
  })

  it('dry run, confirm with the count, real call with expectedCount; sends only the non-blank keys', async () => {
    questions.bulkQuestionsByFilter
      .mockResolvedValueOnce({ data: RESULT, status: '' })
      .mockResolvedValueOnce(done())
    const w = await render('/admin/questions?status=approved&subject_id=1&search=%20&difficulty_level=')
    await t(w, 'questions-approve-filter').trigger('click')
    await flushPromises()
    expect(questions.bulkQuestionsByFilter).toHaveBeenNthCalledWith(
      1,
      'approved',
      { subjectId: '1', status: 'approved' },
      { dryRun: true },
    )
    const message = dialogs.confirmNative.mock.calls[0]?.[0] as string
    expect(message).toContain('Luluskan SEMUA soalan hasil tapisan ini? Ia akan kelihatan kepada pelajar.')
    expect(message).toContain('10 daripada 12 soalan sepadan akan diluluskan.')
    expect(questions.bulkQuestionsByFilter).toHaveBeenNthCalledWith(
      2,
      'approved',
      { subjectId: '1', status: 'approved' },
      { expectedCount: 12 },
    )
    expect(t(w, 'bulk-filter-success').text()).toContain(
      'Berjaya luluskan 10 soalan (hasil tapisan) — kini kelihatan kepada pelajar.',
    )
  })

  it('cancelling the confirm makes no real call', async () => {
    questions.bulkQuestionsByFilter.mockResolvedValueOnce({ data: RESULT, status: '' })
    dialogs.confirmNative.mockReturnValue(false)
    const w = await render('/admin/questions?status=draft')
    await t(w, 'questions-approve-filter').trigger('click')
    await flushPromises()
    expect(questions.bulkQuestionsByFilter).toHaveBeenCalledTimes(1)
    expect(w.find('[data-testid="bulk-filter-result"]').exists()).toBe(false)
  })

  it('"Arkib Semua" sends an empty filter whatever the list filter is, and shows the V2 result', async () => {
    questions.bulkQuestionsByFilter
      .mockResolvedValueOnce({ data: RESULT, status: '' })
      .mockResolvedValueOnce(done())
    const w = await render('/admin/questions?status=draft')
    await t(w, 'questions-archive-all').trigger('click')
    await flushPromises()
    expect(questions.bulkQuestionsByFilter).toHaveBeenNthCalledWith(1, 'archived', {}, { dryRun: true })
    expect(questions.bulkQuestionsByFilter).toHaveBeenNthCalledWith(2, 'archived', {}, { expectedCount: 12 })
    expect(dialogs.confirmNative.mock.calls[0]?.[0]).toContain('ARKIB SEMUA soalan?')
    expect(t(w, 'bulk-filter-success').text()).toContain('Berjaya arkib 10 soalan. Bank pelajar kini kosong')
  })

  it('lists the refused rows (10 shown, the rest behind "Lihat n lagi") and the notes', async () => {
    const failed = Array.from({ length: 12 }, (_, i) => ({
      id: String(100 + i),
      code: 'VALIDATION_ERROR',
      message: 'Tag DSKP belum lengkap.',
      fields: {},
    }))
    questions.bulkQuestionsByFilter
      .mockResolvedValueOnce({ data: RESULT, status: '' })
      .mockResolvedValueOnce(done({ affected: 8, failed, skipped: 2, remaining: 3 }))
    const w = await render('/admin/questions?status=pending_review')
    await t(w, 'questions-approve-filter').trigger('click')
    await flushPromises()
    expect(t(w, 'bulk-filter-failed').text()).toContain('12 soalan tidak diluluskan kerana DSKP belum lengkap:')
    expect(w.findAll('[data-testid="bulk-filter-failed-row"]')).toHaveLength(10)
    expect(w.text()).toContain('Soalan #100')
    expect(w.text()).toContain('2 soalan dilangkau')
    expect(w.text()).toContain('Baki 3 soalan belum diproses')
    await t(w, 'bulk-filter-failed-more').trigger('click')
    expect(w.findAll('[data-testid="bulk-filter-failed-row"]')).toHaveLength(12)
  })

  it('shows the server 422 fields.filter message inline in a role=alert and does not confirm', async () => {
    const message = 'Penapis yang dipilih tidak mempunyai nilai. Isi nilai penapis, atau buang penapis itu.'
    questions.bulkQuestionsByFilter.mockRejectedValueOnce(
      new ApiError({ status: 422, code: 'VALIDATION_ERROR', message, fields: { filter: message } }),
    )
    const w = await render('/admin/questions?status=approved')
    await t(w, 'questions-approve-filter').trigger('click')
    await flushPromises()
    const alert = t(w, 'questions-filter-bulk-error')
    expect(alert.attributes('role')).toBe('alert')
    expect(alert.text()).toContain(message)
    expect(dialogs.confirmNative).not.toHaveBeenCalled()
  })

  it('shows a 422 fields.expectedCount / a 409 message and reloads the list', async () => {
    const stale = 'Bilangan soalan hasil tapisan telah berubah (dijangka 12, kini 11). Muat semula senarai dan semak semula sebelum meneruskan.'
    questions.bulkQuestionsByFilter
      .mockResolvedValueOnce({ data: RESULT, status: '' })
      .mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: stale }))
    const w = await render('/admin/questions?status=approved')
    const before = questions.fetchQuestions.mock.calls.length
    await t(w, 'questions-approve-filter').trigger('click')
    await flushPromises()
    expect(t(w, 'questions-filter-bulk-error').text()).toContain(stale)
    expect(questions.fetchQuestions.mock.calls.length).toBeGreaterThan(before)
  })

  it('says so when nothing is eligible, without a confirm', async () => {
    questions.bulkQuestionsByFilter.mockResolvedValueOnce({ data: { ...RESULT, eligible: 0 }, status: '' })
    const w = await render('/admin/questions?status=approved')
    await t(w, 'questions-approve-filter').trigger('click')
    await flushPromises()
    expect(t(w, 'questions-filter-bulk-error').text()).toContain('Tiada soalan hasil tapisan ini yang boleh diluluskan')
    expect(dialogs.confirmNative).not.toHaveBeenCalled()
  })
})
