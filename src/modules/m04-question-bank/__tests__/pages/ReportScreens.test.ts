// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { ReportView } from '../../api/reports'
import ReportQuestionModal from '../../components/report/ReportQuestionModal.vue'
import LaporanSoalanPage from '../../pages/LaporanSoalanPage.vue'
import QuestionReportsPage from '../../pages/QuestionReportsPage.vue'

const api = vi.hoisted(() => ({
  fetchQuestionReports: vi.fn(),
  fetchMyReports: vi.fn(),
  createQuestionReport: vi.fn(),
  updateQuestionReport: vi.fn(),
}))
vi.mock('../../api/reports', () => api)

const NOW = '2026-09-25T15:40:00+08:00'

function report(id: number, extra: Partial<ReportView> = {}): ReportView {
  return {
    id,
    questionType: 'structured',
    questionId: 3698,
    reasons: ['other'],
    reasonLabels: ['Lain-lain'],
    category: 'Lain-lain',
    comment: 'Lambat',
    source: 'structured_attempt',
    quizSessionId: null,
    roomCode: null,
    sourceSet: 'trial',
    status: 'pending',
    displayStatus: 'pending',
    adminNotes: null,
    createdAt: NOW,
    updatedAt: NOW,
    question: {
      exists: true,
      type: 'structured',
      id: 3698,
      text: 'Kedaulatan ialah konsep kenegaraan.',
      subjectName: 'Sejarah',
      levelName: 'Tingkatan 5',
      complianceStatus: 'verified',
      isActive: true,
      practiceUrl: '/latihan-berstruktur/3698/jawab?scope=spm',
    },
    reporter: { id: 5001, name: 'Pelajar Demo Satu' },
    ...extra,
  }
}

const mcq = (id: number, extra: Partial<ReportView> = {}): ReportView =>
  report(id, {
    questionType: 'mcq',
    questionId: 136891,
    reasons: ['unclear'],
    reasonLabels: ['Soalan mengelirukan'],
    category: 'Tak Jelas',
    comment: null,
    sourceSet: null,
    roomCode: 'Y31OBA',
    status: 'reviewed',
    displayStatus: 'reviewed',
    adminNotes: 'Dinyahaktifkan segera oleh admin',
    question: {
      exists: true,
      type: 'mcq',
      id: 136891,
      text: 'Rajah 16 menunjukkan dua segi tiga.',
      options: ['A', 'B', 'C', 'D'],
      correctAnswer: 1,
      subjectName: 'Matematik',
      levelName: 'Tingkatan 5',
      complianceStatus: 'verified',
      isActive: false,
      practiceUrl: '/spm/latih-tubi/MATH/quiz?question_id=136891&count=1',
    },
    ...extra,
  })

const counts = { pending: 2, reviewed: 3, fixed: 5, dismissed: 1, all: 11 }
const adminResult = (rows: ReportView[], activeTab: string | null = 'pending') => ({
  data: rows,
  meta: { activeTab, counts },
})

let wrapper: VueWrapper | null = null

async function renderAdmin(url = '/admin/question-reports'): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/admin/question-reports', component: QuestionReportsPage }],
  })
  await router.push(url)
  wrapper = mount(QuestionReportsPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  for (const fn of Object.values(api)) fn.mockReset()
  api.fetchQuestionReports.mockResolvedValue(adminResult([report(10)]))
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('QuestionReportsPage (M04 S7)', () => {
  it('renders the header, five tabs with counts and the default active tab', async () => {
    const w = await renderAdmin()
    expect(w.get('[data-testid=reports-subtitle]').text()).toBe(
      'Soalan yang dilaporkan oleh pelajar dari kuiz, latihan & Papan Bijak',
    )
    expect(w.findAll('[data-testid^=reports-tab-]').map((t) => t.text())).toEqual([
      'Menunggu (2)',
      'Disemak (3)',
      'Diperbaiki (5)',
      'Ditolak (1)',
      'Semua (11)',
    ])
    expect(w.findAll('[data-active=true]').map((t) => t.text())).toEqual(['Menunggu (2)'])
    expect(api.fetchQuestionReports).toHaveBeenCalledWith(expect.objectContaining({ status: null }))
  })

  it('an unknown status shows the empty block and no active tab', async () => {
    api.fetchQuestionReports.mockResolvedValue(adminResult([], null))
    const w = await renderAdmin('/admin/question-reports?status=zzz')
    expect(w.get('[data-testid=reports-empty]').text()).toBe('Tiada laporan buat masa ini')
    expect(w.findAll('[data-active=true]')).toHaveLength(0)
  })

  it('a pending structured card: badges, pill, block, comment and all five actions', async () => {
    const w = await renderAdmin()
    const card = w.get('[data-testid=report-card-10]')
    expect(card.get('[data-testid=report-status]').text()).toBe('Menunggu')
    expect(card.get('[data-testid=report-category]').text()).toBe('Lain-lain')
    expect(card.get('[data-testid=report-source-set]').text()).toBe('trial')
    expect(card.get('[data-testid=report-reporter]').text()).toBe('Oleh: Pelajar Demo Satu')
    expect(card.get('[data-testid=report-time]').text()).toMatch(/yang lepas$/)
    expect(card.get('[data-testid=report-question-id]').text()).toBe('ID Soalan: 3698')
    expect(card.get('[data-testid=report-reason]').text()).toBe('Lain-lain')
    expect(card.get('[data-testid=report-question]').text()).toContain('Soalan Struktur #3698:')
    expect(card.get('[data-testid=report-comment]').text()).toContain('Komen pelajar:')
    expect(card.find('[data-testid=report-admin-notes]').exists()).toBe(false)
    expect(card.get('[data-testid=report-fix]').text()).toBe('Tandakan Selesai')
    expect(card.get('[data-testid=report-dismiss]').text()).toBe('Tolak & Aktifkan Semula')
    expect(card.get('[data-testid=report-question-link]').text()).toBe(
      'Lihat Soalan Struktur #3698',
    )
    expect(card.get('[data-testid=report-question-link]').attributes('href')).toBe(
      '/admin/structured-questions/3698',
    )
    expect(card.get('[data-testid=report-open]').attributes('target')).toBe('_blank')
    expect(card.get('[data-testid=report-deactivate]').text()).toBe('Nyahaktif Segera')
  })

  it('an inactive reviewed MCQ card: Dinyahaktif, correct option marked, admin note, no deactivate', async () => {
    api.fetchQuestionReports.mockResolvedValue(adminResult([mcq(6)], 'all'))
    const w = await renderAdmin('/admin/question-reports?status=all')
    const card = w.get('[data-testid=report-card-6]')
    expect(card.get('[data-testid=report-inactive]').text()).toBe('Dinyahaktif')
    expect(card.get('[data-testid=report-category]').text()).toBe('Tak Jelas')
    expect(card.get('[data-testid=report-reason]').text()).toBe('Soalan mengelirukan')
    expect(card.get('[data-testid=report-room]').text()).toBe('Bilik: Y31OBA')
    expect(card.get('[data-correct=true]').text()).toContain('B. B')
    expect(card.get('[data-testid=report-admin-notes]').text()).toContain(
      'Dinyahaktifkan segera oleh admin',
    )
    expect(card.get('[data-testid=report-question-link]').text()).toBe('Edit Soalan #136891')
    expect(card.get('[data-testid=report-question-link]').attributes('href')).toBe(
      '/admin/questions/136891/edit',
    )
    expect(card.find('[data-testid=report-deactivate]').exists()).toBe(false)
  })

  it('a fixed card has no actions; "Dikeluarkan" and a deleted question render', async () => {
    api.fetchQuestionReports.mockResolvedValue(
      adminResult(
        [
          mcq(2, { status: 'fixed', displayStatus: 'removed' }),
          mcq(1, {
            status: 'fixed',
            displayStatus: 'fixed',
            question: { exists: false, type: 'mcq', id: 108527 },
          }),
        ],
        'fixed',
      ),
    )
    const w = await renderAdmin('/admin/question-reports?status=fixed')
    const removed = w.get('[data-testid=report-card-2]')
    expect(removed.get('[data-testid=report-status]').text()).toBe('Dikeluarkan')
    expect(removed.find('[data-testid=report-actions]').exists()).toBe(false)
    const gone = w.get('[data-testid=report-card-1]')
    expect(gone.get('[data-testid=report-missing]').text()).toBe('Soalan tidak dijumpai')
    expect(gone.find('[data-testid=report-actions]').exists()).toBe(false)
  })

  it('"Tandakan Selesai" sends the textarea notes, reloads and flashes the API text', async () => {
    api.updateQuestionReport.mockResolvedValue({ data: {}, status: 'Laporan berjaya dikemaskini.' })
    const w = await renderAdmin()
    await w.get('[data-testid=report-notes]').setValue('Soalan diperbaiki')
    await w.get('[data-testid=report-fix]').trigger('click')
    await flushPromises()
    expect(api.updateQuestionReport).toHaveBeenCalledWith(10, {
      status: 'fixed',
      adminNotes: 'Soalan diperbaiki',
    })
    expect(api.fetchQuestionReports).toHaveBeenCalledTimes(2)
    expect(useFlashStore().current).toMatchObject({
      type: 'success',
      message: 'Laporan berjaya dikemaskini.',
    })
  })

  it('"Tolak & Aktifkan Semula" and "Nyahaktif Segera" send the fixed notes and flags', async () => {
    api.updateQuestionReport.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await renderAdmin()
    await w.get('[data-testid=report-dismiss]').trigger('click')
    await flushPromises()
    expect(api.updateQuestionReport).toHaveBeenLastCalledWith(10, {
      status: 'dismissed',
      adminNotes: 'Soalan dan jawapan disemak — tiada masalah',
      reactivate: true,
    })
    await w.get('[data-testid=report-deactivate]').trigger('click')
    await flushPromises()
    expect(api.updateQuestionReport).toHaveBeenLastCalledWith(10, {
      status: 'reviewed',
      adminNotes: 'Dinyahaktifkan segera oleh admin',
      forceDeactivate: true,
    })
  })

  it('"Arkib" sends archive: true (R1-B17; V2 Studio label "Arkib", cloud-student-mechanism section 3)', async () => {
    api.updateQuestionReport.mockResolvedValue({ data: {}, status: 'ok' })
    const w = await renderAdmin()
    const btn = w.get('[data-testid=report-card-10] [data-testid=report-archive]')
    expect(btn.text()).toBe('Arkib')
    await btn.trigger('click')
    await flushPromises()
    expect(api.updateQuestionReport).toHaveBeenLastCalledWith(10, {
      status: 'reviewed',
      adminNotes: 'Diarkibkan oleh admin',
      archive: true,
    })
  })

  it('a failed action flashes the error and keeps the list', async () => {
    api.updateQuestionReport.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai.' }),
    )
    const w = await renderAdmin()
    await w.get('[data-testid=report-fix]').trigger('click')
    await flushPromises()
    expect(useFlashStore().current).toMatchObject({ type: 'error' })
    expect(w.find('[data-testid=report-card-10]').exists()).toBe(true)
  })

  it('a load failure shows the red box and "Cuba Semula" retries', async () => {
    api.fetchQuestionReports.mockRejectedValueOnce(new Error('boom'))
    const w = await renderAdmin()
    expect(w.get('[data-testid=reports-error]').text()).toContain(
      'Maaf, berlaku ralat. Sila cuba semula.',
    )
    await w.get('[data-testid=reports-retry]').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid=report-card-10]').exists()).toBe(true)
  })
})

describe('LaporanSoalanPage (M04 S13)', () => {
  const mine = (
    rows: ReportView[],
    c = { pending: 0, reviewed: 0, fixed: 0, dismissed: 0, all: 0 },
  ) => ({
    data: rows,
    meta: { counts: c },
  })

  it('shows the zero counters and the empty state', async () => {
    api.fetchMyReports.mockResolvedValue(mine([]))
    wrapper = mount(LaporanSoalanPage)
    await flushPromises()
    expect(wrapper.findAll('[data-testid^=my-reports-count-]').map((c) => c.text())).toEqual([
      '0Jumlah',
      '0Menunggu',
      '0Disemak',
      '0Diperbaiki',
      '0Ditolak',
    ])
    const empty = wrapper.get('[data-testid=my-reports-empty]')
    expect(empty.text()).toContain('Tiada Laporan')
    expect(empty.text()).toContain('Anda belum menghantar sebarang laporan soalan.')
  })

  it('lists one row per report with the title, status, reasons and the admin note', async () => {
    api.fetchMyReports.mockResolvedValue(
      mine([report(10), mcq(6, { questionId: 136891 })], {
        pending: 1,
        reviewed: 1,
        fixed: 0,
        dismissed: 0,
        all: 2,
      }),
    )
    wrapper = mount(LaporanSoalanPage)
    await flushPromises()
    expect(wrapper.get('[data-testid=my-reports-count-all]').text()).toBe('2Jumlah')
    const first = wrapper.get('[data-testid=my-report-10]')
    expect(first.get('[data-testid=my-report-title]').text()).toBe('Soalan Struktur #3698')
    expect(first.get('[data-testid=my-report-status]').text()).toBe('Menunggu')
    expect(first.find('[data-testid=my-report-notes]').exists()).toBe(false)
    const second = wrapper.get('[data-testid=my-report-6]')
    expect(second.get('[data-testid=my-report-title]').text()).toBe('Soalan #136891')
    expect(second.get('[data-testid=my-report-status]').text()).toBe('Disemak')
    expect(second.get('[data-testid=my-report-reason]').text()).toBe('Soalan mengelirukan')
    expect(second.get('[data-testid=my-report-notes]').text()).toContain('Status tindakan admin:')
  })

  it('a load failure keeps the counters row and shows the red box', async () => {
    api.fetchMyReports.mockRejectedValue(new Error('x'))
    wrapper = mount(LaporanSoalanPage)
    await flushPromises()
    expect(wrapper.get('[data-testid=my-reports-error]').text()).toContain('Cuba Semula')
  })
})

describe('ReportQuestionModal (M04 S14)', () => {
  const doc = () => document.body
  const q = (id: string) => doc().querySelector<HTMLElement>(`[data-testid=${id}]`)
  const click = async (id: string) => {
    q(id)?.click()
    await flushPromises()
  }

  async function open(props: Record<string, unknown> = {}): Promise<VueWrapper> {
    wrapper = mount(ReportQuestionModal, {
      attachTo: document.body,
      props: { open: true, questionId: 564161, ...props },
    })
    await flushPromises()
    return wrapper
  }

  it('MCQ: title, subtitle, the seven reasons, counter and a disabled submit', async () => {
    await open()
    expect(q('report-title')?.textContent?.trim()).toBe('Lapor Soalan')
    expect(q('report-subtitle')?.textContent).toBe('Soalan ini akan dinyahaktifkan sementara')
    expect(doc().querySelectorAll('[data-testid^=report-reason-]')).toHaveLength(7)
    expect(q('report-counter')?.textContent?.trim()).toBe('0/500')
    expect((q('report-submit') as HTMLButtonElement).disabled).toBe(true)
    expect(q('report-comment')?.getAttribute('maxlength')).toBe('500')
    expect(q('report-comment')?.getAttribute('placeholder')).toBe('Terangkan masalah soalan ini...')
  })

  it('structured: its subtitle and the five structured reasons', async () => {
    await open({ variant: 'structured' })
    expect(q('report-subtitle')?.textContent).toBe(
      'Soalan ini akan dinyahaktifkan selepas 3 laporan',
    )
    expect(doc().querySelectorAll('[data-testid^=report-reason-]')).toHaveLength(5)
    expect(q('report-reason-wrong_answer')?.textContent).toContain('Skema jawapan tidak tepat')
    expect(q('report-reason-wrong_options')?.textContent).toContain('Markah tidak adil')
  })

  it('ticking enables submit; the card takes the reason tint and the tints prop overrides it', async () => {
    await open({ tints: { wrong_answer: 'yellow' } })
    const card = q('report-reason-wrong_answer') as HTMLElement
    const box = card.querySelector('input') as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('change'))
    await flushPromises()
    expect(card.className).toContain('border-yellow-300')
    expect((q('report-submit') as HTMLButtonElement).disabled).toBe(false)
    const typo = (q('report-reason-typo') as HTMLElement).querySelector('input') as HTMLInputElement
    typo.checked = true
    typo.dispatchEvent(new Event('change'))
    await flushPromises()
    expect((q('report-reason-typo') as HTMLElement).className).toContain('border-indigo-300')
  })

  async function tick(reasonValue: string): Promise<void> {
    const box = (q(`report-reason-${reasonValue}`) as HTMLElement).querySelector(
      'input',
    ) as HTMLInputElement
    box.checked = true
    box.dispatchEvent(new Event('change'))
    await flushPromises()
  }

  it('the tint alias colours the ticked card like tints', async () => {
    await open({ tint: { typo: 'blue' } })
    await tick('typo')
    expect((q('report-reason-typo') as HTMLElement).className).toContain('border-blue-300')
  })

  it('ignores the result of a request sent before the modal was closed and reopened', async () => {
    let finish: (v: unknown) => void = () => undefined
    api.createQuestionReport.mockReturnValue(new Promise((r) => (finish = r)))
    const w = await open()
    await tick('typo')
    await click('report-submit')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    finish({ success: true, message: 'lama' })
    await flushPromises()
    expect(q('report-done')).toBeNull()
    expect(q('report-form')).not.toBeNull()
    expect(w.emitted('reported')).toBeUndefined()
    expect((q('report-submit') as HTMLButtonElement).disabled).toBe(true)
  })

  it('sends the report with the source and session, shows "Terima Kasih!" and the message', async () => {
    api.createQuestionReport.mockResolvedValue({
      success: true,
      message: 'Laporan berjaya dihantar.',
    })
    const w = await open({ quizSessionId: 'sess-9', source: 'latihan' })
    await tick('wrong_answer')
    const textarea = q('report-comment') as HTMLTextAreaElement
    textarea.value = 'Salah'
    textarea.dispatchEvent(new Event('input'))
    await flushPromises()
    expect(q('report-counter')?.textContent?.trim()).toBe('5/500')
    await click('report-submit')
    expect(api.createQuestionReport).toHaveBeenCalledWith({
      questionId: 564161,
      reasons: ['wrong_answer'],
      comment: 'Salah',
      quizSessionId: 'sess-9',
      source: 'latihan',
    })
    expect(q('report-done')?.textContent).toContain('Terima Kasih!')
    expect(q('report-message')?.textContent).toBe('Laporan berjaya dihantar.')
    expect(w.emitted('reported')?.[0]).toEqual([{ ok: true, message: 'Laporan berjaya dihantar.' }])
    await click('report-done-close')
    expect(w.emitted('update:open')).toBeTruthy()
  })

  it('structured sends questionType and the structured_attempt source by default', async () => {
    api.createQuestionReport.mockResolvedValue({ success: true, message: 'ok' })
    await open({ variant: 'structured', questionId: 3698 })
    await tick('other')
    await click('report-submit')
    expect(api.createQuestionReport).toHaveBeenCalledWith(
      expect.objectContaining({
        questionId: 3698,
        questionType: 'structured',
        source: 'structured_attempt',
        reasons: ['other'],
      }),
    )
  })

  it('MCQ defaults the source to spm', async () => {
    api.createQuestionReport.mockResolvedValue({ success: true, message: '' })
    await open()
    await tick('typo')
    await click('report-submit')
    expect(api.createQuestionReport).toHaveBeenCalledWith(
      expect.objectContaining({ source: 'spm' }),
    )
    // An empty server message falls back to the default copy.
    expect(q('report-message')?.textContent).toBe('Laporan berjaya dihantar.')
  })

  it('a failed request shows the done view with the default or the host failure text', async () => {
    api.createQuestionReport.mockRejectedValue(new Error('network'))
    await open()
    await tick('typo')
    await click('report-submit')
    expect(q('report-done')?.textContent).toContain('Terima Kasih!')
    expect(q('report-message')?.textContent).toBe('Ralat. Sila cuba lagi.')
    wrapper?.unmount()
    document.body.innerHTML = ''
    await open({ failureText: 'Gagal menghantar laporan. Sila cuba lagi.' })
    await tick('typo')
    await click('report-submit')
    expect(q('report-message')?.textContent).toBe('Gagal menghantar laporan. Sila cuba lagi.')
  })

  it('shows "Menghantar..." and disables submit while the request runs', async () => {
    let finish: (v: unknown) => void = () => undefined
    api.createQuestionReport.mockReturnValue(new Promise((r) => (finish = r)))
    await open()
    await tick('typo')
    await click('report-submit')
    expect(q('report-submit')?.textContent).toContain('Menghantar...')
    expect((q('report-submit') as HTMLButtonElement).disabled).toBe(true)
    finish({ success: true, message: 'x' })
    await flushPromises()
    expect(q('report-done')).not.toBeNull()
  })

  it('closes on Batal, the X, the backdrop and Esc without sending', async () => {
    const w = await open()
    await click('report-cancel')
    await click('report-close')
    q('cmp-modal-backdrop')?.click()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    await flushPromises()
    expect(w.emitted('update:open')).toHaveLength(4)
    expect(api.createQuestionReport).not.toHaveBeenCalled()
  })

  it('reopening resets the reasons, the comment and the sent state', async () => {
    api.createQuestionReport.mockResolvedValue({ success: true, message: 'ok' })
    const w = await open()
    await tick('typo')
    await click('report-submit')
    await w.setProps({ open: false })
    await w.setProps({ open: true })
    await flushPromises()
    expect(q('report-form')).not.toBeNull()
    expect(q('report-done')).toBeNull()
    expect((q('report-submit') as HTMLButtonElement).disabled).toBe(true)
  })
})
