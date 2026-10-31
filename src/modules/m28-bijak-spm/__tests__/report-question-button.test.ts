// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import ReportQuestionButton from '../components/ReportQuestionButton.vue'

const create = vi.hoisted(() => vi.fn())
vi.mock('@/modules/m04-question-bank/api/reports', () => ({ createQuestionReport: create }))

let wrapper: VueWrapper | null = null
const ATTEMPT = '11111111-1111-4111-8111-111111111111'

beforeEach(() => {
  create.mockReset()
  create.mockResolvedValue({ success: true, message: 'Laporan berjaya dihantar.' })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('"Lapor Soalan" on a Bijak question (AC-R1-18.1, S-69)', () => {
  it('opens the report form and posts the attempt so the server stores the paper', async () => {
    wrapper = mount(ReportQuestionButton, { props: { questionId: '42', attemptId: ATTEMPT }, attachTo: document.body })
    await wrapper.get('[data-testid=lapor-soalan]').trigger('click')
    await flushPromises()
    expect(document.body.querySelector('[data-testid=report-form]')).not.toBeNull()
    const reason = document.body.querySelector('[data-testid^="report-reason-"] input') as HTMLInputElement
    reason.click()
    await flushPromises()
    ;(document.body.querySelector('[data-testid=report-form]') as HTMLFormElement).dispatchEvent(new Event('submit', { cancelable: true }))
    await flushPromises()
    expect(create).toHaveBeenCalledTimes(1)
    expect(create.mock.calls[0]![0]).toMatchObject({ questionId: 42, attemptId: ATTEMPT, source: 'spm' })
    expect(document.body.textContent).toContain('Terima Kasih!')
  })

  it('shows nothing for a question id that is not a database id (mock seed ids)', () => {
    wrapper = mount(ReportQuestionButton, { props: { questionId: 'mat1-q1', attemptId: ATTEMPT } })
    expect(wrapper.find('[data-testid=lapor-soalan]').exists()).toBe(false)
  })
})
