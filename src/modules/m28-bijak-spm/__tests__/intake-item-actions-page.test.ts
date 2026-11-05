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
const confirm = vi.hoisted(() => vi.fn())
vi.mock('@/ds', async (original) => ({ ...(await original<typeof import('@/ds')>()), useConfirm: () => confirm }))
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
  confirm.mockReset().mockResolvedValue(true)
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

  it('shows the wire status label as the badge for an http batch, else Draf (R1E2E-C1)', async () => {
    server.getIntakeBatch.mockResolvedValue({ ...batchOf(2), batchStatus: 'ready_for_review', statusLabel: 'Sedia untuk semakan' })
    const http = await mountPage()
    expect(http.get('[data-testid=review-status]').text()).toContain('Sedia untuk semakan')
    // the batch stays editable: the item actions are still offered
    expect(http.find('[data-testid=item-accept]').exists()).toBe(true)
    server.getIntakeBatch.mockResolvedValue(batchOf(2))
    const mock = await mountPage()
    expect(mock.get('[data-testid=review-status]').text()).toContain('Draf')
  })

  it('Terima (A) accepts the open item and adopts the returned batch', async () => {
    server.decideIntakeItem.mockResolvedValue({ ok: true, errors: [], batch: batchOf(1) })
    const w = await mountPage()
    await w.get('[data-testid=item-accept]').trigger('click')
    await flushPromises()
    expect(server.decideIntakeItem).toHaveBeenCalledWith('ek-1', expect.any(String), { action: 'terbit' })
    expect(w.get('[data-testid=decision-note]').text()).toMatch(/Soalan #\S+ dicipta sebagai draf\./)
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

  it('Terima semua asks first; a refusal sends nothing', async () => {
    confirm.mockResolvedValue(false)
    const w = await mountPage()
    await w.get('[data-testid=accept-all]').trigger('click')
    await flushPromises()
    expect(confirm.mock.calls[0]?.[0]).toMatchObject({ confirmLabel: 'Ya, Terima Semua', cancelLabel: 'Batal' })
    expect(confirm.mock.calls[0]?.[0].message).toMatch(/^Terima \d+ item yang belum disemak\?$/)
    expect(server.acceptUnreviewed).not.toHaveBeenCalled()
  })

  it('Sebelum and Seterusnya move along the batch, stopping at each end', async () => {
    server.getIntakeBatch.mockResolvedValue(batchOf(2))
    const w = await mountPage()
    expect(w.get('[data-testid=item-counter]').text()).toContain('Item 1 / 2')
    expect(w.get('[data-testid=item-prev]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid=item-next]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid=item-counter]').text()).toContain('Item 2 / 2')
    expect(w.get('[data-testid=item-next]').attributes('disabled')).toBeDefined()
  })

  it('Terima semua reports how many were skipped', async () => {
    server.acceptUnreviewed.mockResolvedValue({ done: 1, skipped: [{ id: 'q', reason: 'BELOW_THRESHOLD' }], batch: batchOf(1) })
    const w = await mountPage()
    await w.get('[data-testid=accept-all]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid=decision-note]').text()).toBe('1 diterima, 1 gagal')
  })

  it('does not decide when the save before it failed', async () => {
    server.saveExtracted.mockRejectedValue(new Error('x'))
    const w = await mountPage()
    await w.get('[data-testid=item-accept]').trigger('click')
    await flushPromises()
    expect(server.decideIntakeItem).not.toHaveBeenCalled()
    expect(w.get('[data-testid=decision-errors]').text()).toContain('Simpanan gagal')
    await w.get('[data-testid=accept-all]').trigger('click')
    await flushPromises()
    expect(server.acceptUnreviewed).not.toHaveBeenCalled()
  })

  it('decides on the server id when the save mapped a local id (http mode)', async () => {
    const b = batchOf(2)
    const local = b.questions[0]!.id
    server.getIntakeBatch.mockResolvedValue(b)
    server.saveExtracted.mockResolvedValue({ idMap: { items: { [local]: 'srv-9' }, stimuli: {} } })
    server.decideIntakeItem.mockResolvedValue({ ok: true, errors: [], batch: batchOf(1) })
    const w = await mountPage()
    await w.get('[data-testid=item-accept]').trigger('click')
    await flushPromises()
    expect(server.decideIntakeItem).toHaveBeenCalledWith('ek-1', 'srv-9', { action: 'terbit' })
    expect(w.get('[data-testid=decision-note]').text()).toContain('Soalan #srv-9 dicipta sebagai draf.')
  })

  it('shows an unexpected server error instead of failing silently', async () => {
    server.decideIntakeItem.mockRejectedValue(new Error('Pelayan tidak dapat dihubungi'))
    const w = await mountPage()
    await w.get('[data-testid=item-accept]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid=decision-errors]').text()).toContain('Pelayan tidak dapat dihubungi')
  })
})
