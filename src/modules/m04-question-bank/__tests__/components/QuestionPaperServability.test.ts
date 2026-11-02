// @vitest-environment jsdom
import { SERVABILITY_REASON_MS } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import QuestionPaperServability from '../../components/studio/QuestionPaperServability.vue'

const api = vi.hoisted(() => ({ fetchPaperServability: vi.fn() }))
vi.mock('../../api/paper-servability', () => api)

const body = (data: unknown[], meta = { total: data.length, truncated: false }) => ({ data, meta })

let wrapper: VueWrapper | null = null
const mountIt = async () => {
  wrapper = mount(QuestionPaperServability, { props: { questionId: '5' }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)

beforeEach(() => api.fetchPaperServability.mockReset())
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('QuestionPaperServability', () => {
  it('lists a served paper with the served chip and no reasons', async () => {
    api.fetchPaperServability.mockResolvedValue(body([{ paperId: '10', title: 'Kertas Percubaan A', served: true, reasons: [] }]))
    const w = await mountIt()
    expect(api.fetchPaperServability).toHaveBeenCalledWith('5', expect.any(AbortSignal))
    expect(t(w, 'paper-served-title').text()).toBe('Kertas Percubaan A')
    expect(t(w, 'paper-served-chip').text()).toBe('Boleh dilihat')
    expect(w.find('[data-testid="paper-served-reasons"]').exists()).toBe(false)
    expect(t(w, 'paper-served-summary').text()).toBe('Boleh dibuka murid di 1 daripada 1 kertas diterbitkan.')
  })

  it('shows a not served paper with the question_missing sentence and the placed question', async () => {
    api.fetchPaperServability.mockResolvedValue(
      body([
      { paperId: '11', title: 'Kertas Percubaan B', served: false, reasons: [{ code: 'question_missing', message: SERVABILITY_REASON_MS.question_missing, detail: '77' }] },
    ]),
    )
    const w = await mountIt()
    expect(t(w, 'paper-served-chip').text()).toBe('Tidak boleh dilihat')
    expect(t(w, 'paper-served-reasons').text()).toBe(`Soalan #77: ${SERVABILITY_REASON_MS.question_missing}`)
    expect(t(w, 'paper-served-11').attributes('data-served')).toBe('false')
  })

  it('says the question is on no published paper when the list is empty', async () => {
    api.fetchPaperServability.mockResolvedValue(body([]))
    const w = await mountIt()
    expect(t(w, 'paper-served-empty').text()).toBe('Tiada dalam mana-mana kertas diterbitkan.')
    expect(w.find('[data-testid="paper-served-list"]').exists()).toBe(false)
  })

  it('shows the truncated caption when the API read only the first papers', async () => {
    const row = { paperId: '10', title: 'Kertas Percubaan A', served: true, reasons: [] }
    api.fetchPaperServability.mockResolvedValue(body([row], { total: 250, truncated: true }))
    const w = await mountIt()
    expect(t(w, 'paper-served-truncated').text()).toBe('Menunjukkan 1 daripada 250 kertas.')
  })

  it('shows no truncated caption when the list is complete', async () => {
    api.fetchPaperServability.mockResolvedValue(body([{ paperId: '10', title: 'A', served: true, reasons: [] }]))
    const w = await mountIt()
    expect(w.find('[data-testid="paper-served-truncated"]').exists()).toBe(false)
  })

  it('shows an inline error and retries', async () => {
    api.fetchPaperServability.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce(body([]))
    const w = await mountIt()
    expect(t(w, 'paper-served-error').text()).toContain('Senarai kertas tidak dapat dimuat.')
    await w.get('[data-testid="paper-served-error"] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="paper-served-empty"]').exists()).toBe(true)
  })
})
