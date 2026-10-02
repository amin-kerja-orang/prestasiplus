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
}))
vi.mock('../../api/questions', () => questions)
const lookups = vi.hoisted(() => ({ fetchSubjects: vi.fn(), fetchEducationLevels: vi.fn() }))
vi.mock('../../api/lookups', () => lookups)

const dialogs = vi.hoisted(() => ({ confirmNative: vi.fn(() => true) }))
vi.mock('@/components/overlay/native-dialogs', () => ({
  confirmNative: dialogs.confirmNative,
  alertNative: vi.fn(),
}))

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
  setActivePinia(createPinia())
  for (const fn of [...Object.values(questions), ...Object.values(lookups)]) fn.mockReset()
  dialogs.confirmNative.mockReset()
  dialogs.confirmNative.mockReturnValue(true)
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
  it('shows the header, the total and the tiles with the 12-character name cut', async () => {
    const w = await render()
    expect(w.text()).toContain('📚 Pengurusan Soalan')
    expect(w.text()).toContain('Urus bank soalan untuk platform PRESTASIPLUS')
    expect(t(w, 'questions-total').text().replace(/\s+/g, ' ')).toBe('Jumlah: 465,278 soalan')
    const tiles = w.findAll('[data-testid="questions-tile"]')
    expect(tiles).toHaveLength(3)
    expect(tiles[1]?.text()).toContain('Matematik Ta...')
    expect(tiles[0]?.text()).toContain('32,905')
    expect(tiles[0]?.text()).toContain('13,081 lulus')
    // "lulus" is hidden when the approved count is 0.
    expect(tiles[2]?.text()).not.toContain('lulus')
    expect(w.find('[data-testid="questions-clear-subject"]').exists()).toBe(false)
  })

  it('marks the active tile and offers to clear the subject filter', async () => {
    const w = await render('/admin/questions?subject_id=8')
    const active = w
      .findAll('[data-testid="questions-tile"]')
      .filter((n) => n.classes('bg-indigo-50'))
    expect(active.map((n) => n.attributes('data-subject-id'))).toEqual(['8'])
    expect(t(w, 'questions-clear-subject').text()).toContain('Padam filter subjek — tunjuk semua')
    expect(questions.fetchQuestions.mock.calls[0]?.[0]).toMatchObject({ subjectId: '8' })
  })

  it('renders the rows in API order with badges, source and status', async () => {
    const w = await render()
    const rows = w.findAll('[data-testid="question-row"]')
    expect(rows.map((r) => r.attributes('data-question-id'))).toEqual([
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
    const pager = t(w, 'questions-pager')
    expect(pager.text().replace(/\s+/g, ' ')).toContain('Showing 1 to 20 of 465278 results')
    expect(pager.get('a[aria-label="Go to page 2"]').attributes('href')).toContain(
      'status=approved',
    )
  })

  it('submits the filter form to the URL (snake_case names) and refetches', async () => {
    const w = await render()
    await t(w, 'questions-difficulty').setValue('2')
    await t(w, 'questions-search').setValue('  satelit ')
    await w.get('[data-testid="questions-filter"]').trigger('submit')
    await flushPromises()
    expect(router.currentRoute.value.query).toEqual({ difficulty_level: '2', search: 'satelit' })
    expect(questions.fetchQuestions).toHaveBeenLastCalledWith(
      expect.objectContaining({ difficultyLevel: '2', search: 'satelit' }),
    )
  })

  it('hides table and pager and shows the empty block when nothing matches', async () => {
    questions.fetchQuestions.mockResolvedValue(listResult([], 0))
    const w = await render('/admin/questions?search=zzqxv')
    expect(t(w, 'questions-empty').text()).toContain('Tiada soalan dijumpai')
    expect(t(w, 'questions-empty-add').text()).toContain('Tambah Soalan Pertama')
    expect(w.find('[data-testid="questions-table"]').exists()).toBe(false)
    expect(w.find('[data-testid="questions-pager"]').exists()).toBe(false)
  })

  it('shows the red box with "Cuba Semula" when the list fails, and retries', async () => {
    questions.fetchQuestions.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat' }),
    )
    const w = await render()
    expect(t(w, 'questions-error').text()).toContain('Cuba Semula')
    await t(w, 'questions-retry').trigger('click')
    await flushPromises()
    expect(w.findAll('[data-testid="question-row"]')).toHaveLength(3)
  })

  it('ticks rows, shows the bulk bar and select-all ticks the page', async () => {
    const w = await render()
    expect(w.find('[data-testid="questions-bulk-bar"]').exists()).toBe(false)
    await w.findAll('[data-testid="question-select"]')[0]?.setValue(true)
    expect(t(w, 'questions-selected-count').text()).toBe('1')
    expect(w.get('[data-testid="questions-bulk-bar"]').text()).toContain('soalan dipilih')
    await t(w, 'questions-select-all').setValue(true)
    expect(t(w, 'questions-selected-count').text()).toBe('3')
    expect(t(w, 'questions-bulk-action').attributes('required')).toBeDefined()
  })

  it('bulk action: native confirm with the verb and count, then the API and the status flash', async () => {
    questions.bulkQuestionAction.mockResolvedValue({
      data: { affected: 2 },
      status: '2 soalan berjaya dikemaskini.',
    })
    const w = await render()
    const boxes = w.findAll('[data-testid="question-select"]')
    await boxes[0]?.setValue(true)
    await boxes[1]?.setValue(true)
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

  it('sends nothing when the bulk confirm is dismissed', async () => {
    dialogs.confirmNative.mockReturnValue(false)
    const w = await render()
    await w.findAll('[data-testid="question-select"]')[0]?.setValue(true)
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
    await w.findAll('[data-testid="question-delete"]')[0]?.trigger('submit')
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
    const first = w.get('[data-question-id="564159"]')
    expect(first.get('[data-testid="question-view"]').attributes('href')).toBe(
      '/admin/questions/564159',
    )
    expect(first.get('[data-testid="question-edit"]').attributes('href')).toBe(
      '/admin/questions/564159/edit',
    )
    expect(first.get('[data-testid="question-view"]').attributes('title')).toBe('Lihat')
  })
})
