// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { blankQuestion } from '../admin/intake/domain/blank'
import IntakeReviewPage from '../admin/intake/pages/IntakeReviewPage.vue'
import type { IntakeBatch } from '../admin/intake/types'

const server = vi.hoisted(() => ({
  getIntakeBatch: vi.fn(),
  saveExtracted: vi.fn(),
  decideIntakeItem: vi.fn(),
  acceptUnreviewed: vi.fn(),
  submitForReview: vi.fn(),
  subjects: () => [],
}))
vi.mock('../server/client', () => ({ bijakAdminServer: () => server }))
vi.mock('@/composables/usePageMeta', () => ({ usePageMeta: () => ({ setHeader: vi.fn(), setTitle: vi.fn() }) }))

const batchOf = (n: number): IntakeBatch =>
  ({
    id: 'ek-1',
    title: 't',
    subject: 'MAT',
    subjectName: 'Matematik',
    kertas: 2,
    year: 2025,
    status: 'draf',
    sourceKind: 'manual',
    fileName: '',
    source: 'x',
    paperType: 'Percubaan',
    provider: 'manual',
    model: '-',
    questions: Array.from({ length: n }, (_, i) => blankQuestion('MAT', i + 1)),
    stimuli: [],
    unmatched: [],
    pages: [],
    updatedAt: 1,
  }) as unknown as IntakeBatch

const mounted: { unmount: () => void }[] = []
const mountPage = async () => {
  const w = mount(IntakeReviewPage, {
    props: { batchId: 'ek-1' },
    global: { stubs: { RouterLink: true, teleport: true } },
    attachTo: document.body,
  })
  mounted.push(w)
  await flushPromises()
  return w
}
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
})

beforeEach(() => {
  for (const f of Object.values(server)) if (typeof f === 'function' && 'mockReset' in f) (f as ReturnType<typeof vi.fn>).mockReset()
  server.getIntakeBatch.mockResolvedValue(batchOf(2))
  server.saveExtracted.mockResolvedValue(batchOf(2))
})

describe('IntakeReviewPage V2 item actions (I6, I7)', () => {
  it('shows Terima (A), Tolak (R), Simpan Sunting (E) and the counter on the open item', async () => {
    const w = await mountPage()
    expect(w.get('[data-testid=item-accept]').text()).toBe('Terima (A)')
    expect(w.get('[data-testid=item-reject]').text()).toBe('Tolak (R)')
    expect(w.get('[data-testid=item-save]').text()).toBe('Simpan Sunting (E)')
    expect(w.get('[data-testid=item-counter]').text()).toBe('Item 1 / 2')
    expect(w.get('[data-testid=accept-all]').text()).toBe('Terima semua yang belum disemak')
  })

  it('Terima (A) accepts the open item and adopts the returned batch', async () => {
    server.decideIntakeItem.mockResolvedValue({ ok: true, errors: [], batch: batchOf(1) })
    const w = await mountPage()
    await w.get('[data-testid=item-accept]').trigger('click')
    await flushPromises()
    expect(server.decideIntakeItem).toHaveBeenCalledWith('ek-1', expect.any(String), { action: 'terbit' })
    expect(w.get('[data-testid=decision-note]').text()).toContain('Soalan diterima sebagai draf.')
  })

  it('the key A accepts, R asks for a reason first, and typing in a field is left alone', async () => {
    server.decideIntakeItem.mockResolvedValue({ ok: true, errors: [], batch: batchOf(1) })
    const w = await mountPage()
    const input = document.createElement('input')
    document.body.appendChild(input)
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    await flushPromises()
    expect(server.decideIntakeItem).not.toHaveBeenCalled()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'r', bubbles: true }))
    await flushPromises()
    expect(w.find('[data-testid=reject-box]').exists()).toBe(true)
    await w.get('[data-testid=reject-confirm]').trigger('click')
    expect(w.get('[data-testid=decision-errors]').text()).toContain('Sebab diperlukan untuk Tolak.')
    expect(server.decideIntakeItem).not.toHaveBeenCalled()
    document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', bubbles: true }))
    await flushPromises()
    expect(server.decideIntakeItem).toHaveBeenCalledTimes(1)
  })

  it('Terima semua reports how many were skipped', async () => {
    server.acceptUnreviewed.mockResolvedValue({ done: 1, skipped: [{ id: 'q', reason: 'BELOW_THRESHOLD' }], batch: batchOf(1) })
    const w = await mountPage()
    await w.get('[data-testid=accept-all]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid=decision-note]').text()).toContain('1 soalan diterima sebagai draf. 1 dilangkau')
  })
})
