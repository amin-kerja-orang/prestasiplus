// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiError } from '@/api'

import RemedialPreview from '../../components/remedial/RemedialPreview.vue'

const api = vi.hoisted(() => ({ fetchRemedialPreview: vi.fn() }))
vi.mock('../../api/practice', () => api)
const outcome = vi.hoisted(() => ({ setRouteOutcome: vi.fn() }))
vi.mock('@/app/router/outcome', async (orig) => ({
  ...(await orig<typeof import('@/app/router/outcome')>()),
  setRouteOutcome: outcome.setRouteOutcome,
}))

const mountIt = async () => {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:r(.*)*', component: { template: '<div />' } }],
  })
  await router.push('/remedial/7601')
  const w = mount(RemedialPreview, { props: { id: 7601 }, global: { plugins: [router] } })
  await flushPromises()
  return w
}

beforeEach(() => {
  api.fetchRemedialPreview.mockReset()
  outcome.setRouteOutcome.mockReset()
})

describe('Q4 RemedialPreview', () => {
  it('shows the banner and marks the correct option; no buttons to answer', async () => {
    api.fetchRemedialPreview.mockResolvedValue({
      id: 7601,
      subjectName: 'Matematik',
      status: 'active',
      totalQuestions: 1,
      createdAt: '2026-09-20T09:00:00+08:00',
      teacherName: 'Cikgu Demo',
      studentName: 'Murid Demo 08',
      questions: [
        {
          id: 1,
          questionText: '<b>1+1</b>',
          textDirection: 'ltr',
          scriptType: 'rumi',
          options: [
            { id: 0, label: 'A', text: '1' },
            { id: 1, label: 'B', text: '2' },
          ],
          correctOptionId: 1,
        },
      ],
    })
    const w = await mountIt()
    expect(w.get('[data-testid=preview-banner]').text()).toBe(
      'Pratonton — jawapan tidak direkodkan.',
    )
    expect(w.get('[data-testid=preview-title]').text()).toBe('Ujian Remedial — Matematik')
    expect(w.get('[data-testid=preview-text]').text()).toBe('<b>1+1</b>')
    const opts = w.findAll('[data-testid=preview-option]')
    expect(opts.map((o) => o.attributes('data-correct'))).toEqual(['false', 'true'])
    expect(w.find('button').exists()).toBe(false)
  })

  it('a 404 is the global 404 page', async () => {
    api.fetchRemedialPreview.mockRejectedValue(
      new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }),
    )
    await mountIt()
    expect(outcome.setRouteOutcome).toHaveBeenCalledWith(404)
  })
})
