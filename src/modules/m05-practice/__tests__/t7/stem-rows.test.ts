// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import StructuredAnswerPage from '../../pages/StructuredAnswerPage.vue'

const api = vi.hoisted(() => ({ fetchStructuredDetail: vi.fn(), submitStructuredAttempt: vi.fn() }))
vi.mock('../../api/practice', () => api)
vi.mock('@/modules/m04-question-bank', () => ({
  ReportQuestionModal: defineComponent({ props: { open: Boolean }, setup: () => () => h('div') }),
}))

/**
 * T14 B-06: the server lists every part, branches included with 0 marks and dotted labels
 * ("(a).(i).(A)"). V2 and Bijak show only leaf parts as answer fields, and label chains as "(a)(i)(A)".
 */
const DETAIL = {
  id: 7, subjectId: 1, subjectName: 'Matematik', levelName: 'Tingkatan 4', stimulus: 'Stem',
  stimulusImage: null, backUrl: '/latihan-berstruktur',
  subQuestions: [
    { id: 1, label: '(a)', text: 'Bagi fungsi f(x)...', marks: 0 },
    { id: 2, label: '(a).(i)', text: 'Tentukan', marks: 0 },
    { id: 3, label: '(a).(i).(A)', text: 'nilai', marks: 1 },
    { id: 4, label: '(a).(i).(B)', text: 'nilai', marks: 1 },
  ],
}

describe('B-06 Soalan Berstruktur stem rows', () => {
  it('shows text only for 0-mark rows, boxes for scored rows, and (a)(i)(A) labels', async () => {
    api.fetchStructuredDetail.mockResolvedValue(DETAIL)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/latihan-berstruktur/:id/jawab', component: StructuredAnswerPage }],
    })
    await router.push('/latihan-berstruktur/7/jawab')
    const w = mount(StructuredAnswerPage, { global: { plugins: [router], stubs: { teleport: true } } })
    await flushPromises()
    expect(w.findAll('[data-testid=sub-answer]')).toHaveLength(2)
    expect(w.get('[data-testid=sub-1]').text()).toContain('Bagi fungsi f(x)')
    expect(w.get('[data-testid=sub-1]').text()).not.toContain('markah')
    expect(w.findAll('[data-testid=sub-label]').map((l) => l.text())).toEqual(['(a)', '(a)(i)', '(a)(i)(A)', '(a)(i)(B)'])
  })
})
