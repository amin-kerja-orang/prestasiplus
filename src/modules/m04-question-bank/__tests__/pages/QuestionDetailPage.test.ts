// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router'
import { useFlashStore } from '@/stores/flash'

import type { QuestionDetail } from '../../api/questions'
import QuestionDetailPage from '../../pages/QuestionDetailPage.vue'

const questions = vi.hoisted(() => ({
  fetchQuestion: vi.fn(),
  deleteQuestion: vi.fn(),
  bulkQuestionAction: vi.fn(),
  generateAiExplanation: vi.fn(),
}))
vi.mock('../../api/questions', () => questions)

const mode = vi.hoisted(() => ({ http: false }))
vi.mock('@/api', async (orig) => ({
  ...(await orig<typeof import('@/api')>()),
  isHttpMode: () => mode.http,
}))

/** `useConfirm` falls back to `window.confirm` when no host is mounted. */
const dialogs = { confirmNative: vi.fn((message: string) => message !== '') }

function detail(extra: Partial<QuestionDetail> = {}): QuestionDetail {
  return {
    id: 564159,
    subjectId: 4,
    educationLevelId: 11,
    difficultyLevel: 3,
    questionType: 'mcq',
    questionText: 'Apakah maksud satelit buatan?',
    questionImage: null,
    options: ['Objek buatan', 'Planet', 'Meteor', 'Awan'],
    optionImages: [null, null, null, null],
    correctAnswer: 0,
    tfAnswer: null,
    correctAnswerText: null,
    altAnswers: [],
    modelAnswer: null,
    explanation: 'Satelit buatan dilancarkan untuk komunikasi.',
    aiExplanation: null,
    language: 'bm',
    pointsValue: 1,
    status: 'approved',
    isActive: true,
    complianceStatus: 'verified',
    aiVerified: true,
    sourceType: 'textbook',
    sourceFile: null,
    sourcePage: null,
    sourceSet: null,
    qualityScore: null,
    needsDiagram: false,
    spmPool: false,
    dskpSpId: 9,
    curriculumChapterId: null,
    curriculumTopicId: null,
    chapterLabel: null,
    scriptType: 'rumi',
    textDirection: 'ltr',
    pkskDomainId: null,
    pkskTargetLevel: null,
    pkskOptions: null,
    createdAt: '2026-05-18T23:21:00+08:00',
    updatedAt: '2026-05-18T23:21:00+08:00',
    usage: { attempts: 0, correct: 0 },
    subject: { id: 4, name: 'Sains' },
    level: { id: 11, name: 'Tingkatan 5' },
    dskp: {
      bidang: { id: 1, code: null, name: 'Sains T5 - Sokongan Bab Buku Teks' },
      sk: { id: 2, code: 'T5SN.B9', description: 'Menguasai konsep utama Bab 9: Satelit' },
      sp: { id: 9, code: 'T5SN.B9.1', description: 'Menjawab soalan objektif berkaitan konsep' },
    },
    createdBy: { id: 1, name: 'Pentadbir Contoh' },
    ...extra,
  }
}

let wrapper: VueWrapper | null = null
let router: Router

async function render(): Promise<VueWrapper> {
  const stub = { template: '<div />' }
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/questions', component: stub },
      { path: '/admin/questions/:id/edit', component: stub },
      { path: '/admin/questions/:id', component: QuestionDetailPage },
    ],
  })
  await router.push('/admin/questions/564159')
  wrapper = mount(QuestionDetailPage, {
    props: { id: 564159 },
    attachTo: document.body,
    global: { plugins: [router] },
  })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  for (const fn of Object.values(questions)) fn.mockReset()
  dialogs.confirmNative.mockReset()
  dialogs.confirmNative.mockReturnValue(true)
  vi.spyOn(window, 'confirm').mockImplementation((message) => dialogs.confirmNative(message ?? ''))
  questions.fetchQuestion.mockResolvedValue(detail())
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('QuestionDetailPage (M04 S3)', () => {
  it('shows the header, the question, the options and the correct answer', async () => {
    const w = await render()
    expect(t(w, 'question-subtitle').text()).toBe('Soalan #564159')
    expect(t(w, 'question-status').text()).toBe('Diluluskan')
    expect(t(w, 'question-text').text()).toBe('Apakah maksud satelit buatan?')
    const options = w.findAll('[data-testid="question-option"]')
    expect(options).toHaveLength(4)
    expect(options[0]?.attributes('data-correct')).toBe('true')
    expect(options[0]?.text()).toContain('Jawapan Betul')
    expect(w.findAll('[data-testid="question-correct-label"]')).toHaveLength(1)
    expect(t(w, 'explanation-card').text()).toContain('Penjelasan')
  })

  it('renders a placeholder for blob:mock images and real URLs as they are', async () => {
    questions.fetchQuestion.mockResolvedValue(
      detail({
        questionImage: 'blob:mock/soalan-1.png',
        optionImages: ['blob:mock/pilihan-a.png', 'https://contoh.test/b.png', null, null],
      }),
    )
    const w = await render()
    const question = t(w, 'question-image').attributes('src') ?? ''
    expect(question.startsWith('data:image/svg+xml')).toBe(true)
    const options = w.findAll('[data-testid="question-option"] img').map((i) => i.attributes('src'))
    expect(options[0]).toBe(question)
    expect(options[1]).toBe('https://contoh.test/b.png')
  })

  it('shows "Esei pilihan" and the topics when essayTopics is present (H-C3)', async () => {
    questions.fetchQuestion.mockResolvedValue(
      detail({
        questionType: 'essay',
        essayTopics: [{ id: 't1', label: 'Peranan belia' }, { id: 't2', label: 'Kepentingan membaca' }],
      }),
    )
    const w = await render()
    expect(t(w, 'essay-choice').text()).toContain('Esei pilihan')
    expect(w.findAll('[data-testid="essay-topic"]').map((n) => n.text())).toEqual([
      '1. Peranan belia',
      '2. Kepentingan membaca',
    ])
  })

  it('has no "Esei pilihan" block for a plain question', async () => {
    const w = await render()
    expect(w.find('[data-testid="essay-choice"]').exists()).toBe(false)
  })

  it('omits the "Penjelasan" card when there is no explanation', async () => {
    questions.fetchQuestion.mockResolvedValue(detail({ explanation: null }))
    const w = await render()
    expect(w.find('[data-testid="explanation-card"]').exists()).toBe(false)
  })

  it('shows the sidebar rows, the DSKP chain and the "Soalan Baharu" card', async () => {
    const w = await render()
    expect(t(w, 'info-subject').text()).toBe('Sains')
    expect(t(w, 'info-level').text()).toBe('Tingkatan 5')
    expect(t(w, 'info-difficulty').text()).toContain('(3/5)')
    expect(t(w, 'info-dskp').text()).toContain('Sains T5 - Sokongan Bab Buku Teks')
    expect(t(w, 'info-dskp').text()).toContain('T5SN.B9.1 - Menjawab soalan')
    expect(t(w, 'info-language').text()).toBe('Bahasa Melayu')
    expect(t(w, 'info-points').text()).toBe('1 mata')
    expect(t(w, 'info-created').text()).toBe('18/05/2026 23:21')
    expect(t(w, 'usage-new').text()).toContain(
      'Soalan ini belum digunakan dalam sebarang kuiz atau latihan.',
    )
  })

  it('shows "Belum ditag" without a DSKP chain and the stats card for a used question', async () => {
    questions.fetchQuestion.mockResolvedValue(
      detail({ dskp: null, usage: { attempts: 4, correct: 3 } }),
    )
    const w = await render()
    expect(t(w, 'info-dskp').text()).toBe('Belum ditag')
    expect(t(w, 'usage-attempts').text()).toBe('4')
    expect(t(w, 'usage-rate').text()).toBe('75%')
  })

  it('shows quick actions only for draft and pending questions', async () => {
    let w = await render()
    expect(w.find('[data-testid="quick-actions"]').exists()).toBe(false)
    w.unmount()
    questions.fetchQuestion.mockResolvedValue(detail({ status: 'draft' }))
    w = await render()
    expect(t(w, 'status-pending-review').text()).toBe('Hantar untuk Semakan')
    questions.bulkQuestionAction.mockResolvedValue({
      data: { affected: 1 },
      status: '1 soalan berjaya dikemaskini.',
    })
    await t(w, 'status-approve').trigger('click')
    await flushPromises()
    expect(dialogs.confirmNative).toHaveBeenCalledWith(
      'Adakah anda pasti mahu mengubah status soalan ini?',
    )
    expect(questions.bulkQuestionAction).toHaveBeenCalledWith('approve', [564159])
  })

  it('http mode (REQ-B-002): a draft goes to review first, Terbitkan appears only after that', async () => {
    mode.http = true
    try {
      questions.fetchQuestion.mockResolvedValue(detail({ status: 'draft' }))
      questions.bulkQuestionAction.mockResolvedValue({ data: { affected: 1 }, status: 'ok' })
      let w = await render()
      expect(t(w, 'status-pending-review').text()).toBe('Hantar untuk Semakan')
      expect(w.find('[data-testid="status-approve"]').exists()).toBe(false)
      await t(w, 'status-pending-review').trigger('click')
      await flushPromises()
      expect(questions.bulkQuestionAction).toHaveBeenCalledWith('pending_review', [564159])
      w.unmount()
      questions.fetchQuestion.mockResolvedValue(detail({ status: 'review' }))
      w = await render()
      expect(w.find('[data-testid="status-pending-review"]').exists()).toBe(false)
      expect(t(w, 'status-approve').text()).toBe('Terbitkan')
    } finally {
      mode.http = false
    }
  })

  it('renders a PKSK row with "-" subject and level and every correct option marked', async () => {
    questions.fetchQuestion.mockResolvedValue(
      detail({
        subject: null,
        level: null,
        status: 'pending',
        options: null,
        correctAnswer: null,
        pkskDomainId: 3,
        pkskOptions: [
          { text: 'Satu', isCorrect: true },
          { text: 'Dua', isCorrect: false },
          { text: 'Tiga', isCorrect: true },
        ],
      }),
    )
    const w = await render()
    expect(t(w, 'info-subject').text()).toBe('-')
    expect(t(w, 'question-status').text()).toBe('Menunggu')
    expect(w.findAll('[data-testid="question-correct-label"]')).toHaveLength(2)
  })

  it('deletes after the native confirm, flashes the status and goes to the list', async () => {
    questions.deleteQuestion.mockResolvedValue({
      data: { deleted: 1 },
      status: 'Soalan berjaya dipadam.',
    })
    const w = await render()
    await t(w, 'question-delete').trigger('click')
    await flushPromises()
    expect(dialogs.confirmNative).toHaveBeenCalledWith(
      'Adakah anda pasti mahu memadamkan soalan ini?',
    )
    expect(router.currentRoute.value.path).toBe('/admin/questions')
    expect(useFlashStore().consume()).toEqual({
      type: 'success',
      message: 'Soalan berjaya dipadam.',
    })
  })

  it('an unknown id sets the standard 404 outcome', async () => {
    questions.fetchQuestion.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai' }),
    )
    await render()
    expect(useRouteOutcome().value).toBe(404)
  })

  it('another load failure shows the red box with "Cuba Semula"', async () => {
    questions.fetchQuestion.mockRejectedValueOnce(
      new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'Ralat' }),
    )
    const w = await render()
    expect(useRouteOutcome().value).toBeNull()
    expect(t(w, 'question-error').text()).toContain('Cuba Semula')
    await t(w, 'question-retry').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="question-card"]').exists()).toBe(true)
  })
})

describe('AI explanation card (M04 S3)', () => {
  it('shows the empty state and the generate button', async () => {
    const w = await render()
    expect(t(w, 'ai-empty').text()).toBe(
      'Belum ada Penjelasan AI untuk soalan ini. Klik butang untuk jana.',
    )
    expect(w.get('#penjelasan-ai-card').text()).toContain(
      'Dijana AI · Boleh ada kesilapan, sahkan dengan cikgu',
    )
    expect(t(w, 'ai-generate').text()).toBe('Jana Penjelasan AI')
  })

  it('success: hides the button while loading, then reloads and renders the Markdown', async () => {
    let done: (v: unknown) => void = () => undefined
    questions.generateAiExplanation.mockReturnValue(
      new Promise((resolve) => {
        done = resolve
      }),
    )
    const w = await render()
    await t(w, 'ai-generate').trigger('click')
    expect(t(w, 'ai-loading').text()).toContain('Sedang menjana penjelasan... (anggaran 5-15 saat)')
    expect(w.find('[data-testid="ai-generate"]').exists()).toBe(false)
    questions.fetchQuestion.mockResolvedValue(
      detail({
        aiExplanation: { markdown: '## Penjelasan\n\n- satu', generatedAt: '2026-09-30T10:00:00Z' },
      }),
    )
    done({ status: 200, headers: {}, body: { ok: true, message: 'ok' } })
    await flushPromises()
    expect(questions.generateAiExplanation).toHaveBeenCalledWith(564159, { force: false })
    expect(t(w, 'ai-content').html()).toContain('Penjelasan</h2>')
    expect(t(w, 'ai-regenerate').text()).toBe('Jana Semula')
  })

  it('renders <script> and <img onerror> in the explanation as text, never as markup', async () => {
    const markdown = [
      '## Penjelasan <script>window.__pwned = 1</script>',
      '',
      'Teks <img src=x onerror="window.__pwned = 2"> **tebal**',
      '',
      '- item <b onclick="window.__pwned = 3">x</b>',
      '',
      '| <img src=x onerror="window.__pwned = 4"> | b |',
      '| --- | --- |',
      '| <script>1</script> | 2 |',
    ].join('\n')
    questions.fetchQuestion.mockResolvedValue(
      detail({ aiExplanation: { markdown, generatedAt: '2026-09-30T10:00:00Z' } }),
    )
    const w = await render()
    const content = t(w, 'ai-content')
    expect(content.find('script').exists()).toBe(false)
    expect(content.find('img').exists()).toBe(false)
    expect(content.find('b').exists()).toBe(false)
    expect(content.find('[onerror]').exists()).toBe(false)
    expect(content.find('[onclick]').exists()).toBe(false)
    expect(content.text()).toContain('<script>window.__pwned = 1</script>')
    expect(content.text()).toContain('<img src=x onerror="window.__pwned = 2">')
    expect(content.find('strong').text()).toBe('tebal')
    expect((window as unknown as { __pwned?: number }).__pwned).toBeUndefined()
  })

  it('regenerate asks the native confirm and sends force', async () => {
    questions.fetchQuestion.mockResolvedValue(
      detail({ aiExplanation: { markdown: '## Lama', generatedAt: '2026-09-30T10:00:00Z' } }),
    )
    questions.generateAiExplanation.mockResolvedValue({
      status: 200,
      headers: {},
      body: { ok: true },
    })
    const w = await render()
    await t(w, 'ai-regenerate').trigger('click')
    await flushPromises()
    expect(dialogs.confirmNative).toHaveBeenCalledWith(
      'Jana semula Penjelasan AI? Versi lama akan ditimpa.',
    )
    expect(questions.generateAiExplanation).toHaveBeenCalledWith(564159, { force: true })
  })

  it('failure with a message: shows the empty state again beside the message', async () => {
    questions.generateAiExplanation.mockResolvedValue({
      status: 500,
      headers: {},
      body: { ok: false, message: 'Perkhidmatan AI tidak tersedia.' },
    })
    const w = await render()
    await t(w, 'ai-generate').trigger('click')
    await flushPromises()
    expect(t(w, 'ai-error').text()).toBe('Perkhidmatan AI tidak tersedia.')
    expect(w.find('[data-testid="ai-empty"]').exists()).toBe(true)
    expect(w.find('[data-testid="ai-generate"]').exists()).toBe(true)
  })

  it('failure without a message shows "HTTP {status}"; a network error shows "Failed to fetch"', async () => {
    questions.generateAiExplanation.mockResolvedValueOnce({
      status: 500,
      headers: {},
      body: { ok: false },
    })
    const w = await render()
    await t(w, 'ai-generate').trigger('click')
    await flushPromises()
    expect(t(w, 'ai-error').text()).toBe('HTTP 500')
    questions.generateAiExplanation.mockRejectedValueOnce(
      new ApiError({ status: 0, code: 'NETWORK_ERROR', message: 'network' }),
    )
    await t(w, 'ai-generate').trigger('click')
    await flushPromises()
    expect(t(w, 'ai-error').text()).toBe('Failed to fetch')
  })
})
