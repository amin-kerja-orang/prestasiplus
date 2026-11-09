// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'
import { setRouteOutcome, useRouteOutcome } from '@/app/router'

import type { QuestionDetail } from '../../api/questions'
import QuestionPreviewPage from '../../pages/QuestionPreviewPage.vue'

const api = vi.hoisted(() => ({ fetchQuestion: vi.fn() }))
vi.mock('../../api/questions', () => api)

const question = (extra: Partial<QuestionDetail> = {}): QuestionDetail =>
  ({
    id: 5,
    questionType: 'mcq',
    questionText: 'Pilih kata ganda penuh.\n<img src=x onerror=alert(1)>',
    questionImage: null,
    options: ['kupu-kupu', 'sayur-mayur', 'tali-temali', ''],
    correctAnswer: 1,
    correctAnswerText: null,
    modelAnswer: null,
    status: 'approved',
    difficultyLevel: 3,
    pointsValue: 1,
    subject: { id: 1, name: 'Bahasa Melayu' },
    level: { id: 2, name: 'Tingkatan 5' },
    ...extra,
  }) as unknown as QuestionDetail

let wrapper: VueWrapper | null = null
async function render(): Promise<VueWrapper> {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] })
  await router.push('/admin/spm/soalan/5/pratonton')
  wrapper = mount(QuestionPreviewPage, { props: { id: '5' }, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  setRouteOutcome(null)
  api.fetchQuestion.mockReset().mockResolvedValue(question())
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('QuestionPreviewPage (V2 Pratonton)', () => {
  it('is read-only, ticks only the correct option and skips an empty option', async () => {
    const w = await render()
    expect(api.fetchQuestion).toHaveBeenCalledWith(5, expect.anything())
    expect(w.get('[data-testid=preview-back]').attributes('href')).toBe('/admin/spm/databank')
    expect(w.get('[data-testid=preview-readonly]').text()).toBe('Pratonton (baca sahaja)')
    expect(w.get('[data-testid=preview-status]').text()).toBe('Diluluskan')
    const opts = w.findAll('[data-testid=preview-option]')
    expect(opts).toHaveLength(3)
    expect(opts.map((o) => o.attributes('data-correct'))).toEqual(['false', 'true', 'false'])
    expect(w.findAll('[data-testid=preview-tick]')).toHaveLength(1)
    expect(opts[1]!.text()).toContain('B')
    expect(opts[1]!.text()).toContain('✓')
    expect(w.find('input, textarea, button[type=submit], form').exists()).toBe(false)
  })

  it('renders question text escaped, never as HTML', async () => {
    const w = await render()
    expect(w.find('[data-testid=preview-body] img').exists()).toBe(false)
    expect(w.get('[data-testid=preview-body]').text()).toContain('<img src=x onerror=alert(1)>')
  })

  it('lists Maklumat', async () => {
    const w = await render()
    const info = w.get('[data-testid=preview-info]').text()
    for (const s of ['Maklumat', 'Bahasa Melayu', 'Tingkatan 5', 'Kesukaran', 'Markah']) expect(info).toContain(s)
  })

  it('a question without options shows its answer text as correct', async () => {
    api.fetchQuestion.mockResolvedValue(question({ questionType: 'short_answer', options: null, correctAnswer: null, correctAnswerText: 'Jakarta' }))
    const w = await render()
    expect(w.find('[data-testid=preview-options]').exists()).toBe(false)
    expect(w.get('[data-testid=preview-answer]').text()).toContain('Jakarta')
  })

  it('an unknown id gives the 404 outcome; another failure keeps the retry box', async () => {
    api.fetchQuestion.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    await render()
    expect(useRouteOutcome().value).toBe(404)
    wrapper?.unmount()
    api.fetchQuestion.mockRejectedValue(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))
    expect((await render()).find('[data-testid=preview-error]').exists()).toBe(true)
  })
})
