// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import IntakeListPage from '../admin/intake/pages/IntakeListPage.vue'

const server = vi.hoisted(() => ({
  listIntakeBatches: vi.fn(),
  cancelIntakeBatch: vi.fn(),
  subjects: () => [],
}))
const confirm = vi.hoisted(() => vi.fn())
vi.mock('../server/client', () => ({ bijakAdminServer: () => server }))
vi.mock('@/composables/usePageMeta', () => ({ usePageMeta: () => ({ setHeader: vi.fn(), setTitle: vi.fn() }) }))
vi.mock('@/ds', async (original) => ({
  ...(await original<typeof import('@/ds')>()),
  useConfirm: () => confirm,
}))

function batch(id: string, batchStatus: string) {
  return {
    id,
    title: `Kelompok ${id}`,
    subject: 'MAT',
    subjectName: 'Matematik',
    kertas: 1,
    sourceKind: 'pdf',
    fileName: 'a.pdf',
    questionCount: 2,
    reviewedCount: 1,
    status: 'draf',
    batchStatus,
    statusLabel: batchStatus,
    updatedAt: 0,
  }
}

let wrapper: VueWrapper | null = null

async function render(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/admin/spm/soalan/ekstrak', component: IntakeListPage },
      { path: '/:rest(.*)*', component: { template: '<div />' } },
    ],
  })
  await router.push('/admin/spm/soalan/ekstrak')
  wrapper = mount(IntakeListPage, { global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  server.listIntakeBatches.mockReset().mockResolvedValue([batch('1', 'processing'), batch('2', 'ready_for_review')])
  server.cancelIntakeBatch.mockReset().mockResolvedValue(undefined)
  confirm.mockReset().mockResolvedValue(true)
})

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('IntakeListPage (R1-ADM-Q-07)', () => {
  it('names the page and orders the three buttons with the exact labels', async () => {
    const w = await render()
    expect(w.text()).toContain('Import & Semakan')
    expect(w.get('[data-testid=intake-new]').text()).toBe('Muat Naik Kertas')
    expect(w.get('[data-testid=intake-manual]').text()).toBe('Tulis Soalan Manual')
    expect(w.get('[data-testid=intake-csv]').text()).toBe('Import CSV')
    const order = w.findAll('[data-testid^=intake-]').map((b) => b.attributes('data-testid'))
    expect(order.indexOf('intake-new')).toBeLessThan(order.indexOf('intake-manual'))
    expect(order.indexOf('intake-manual')).toBeLessThan(order.indexOf('intake-csv'))
  })

  it('shows the tabs, active on Kelompok Item, and links Kiriman Guru', async () => {
    const w = await render()
    expect(w.get('[data-testid=import-tabs]').text()).toContain('Kelompok Item')
    expect(w.get('[data-testid=import-tab-kiriman]').attributes('href')).toBe('/admin/question-submissions')
  })

  it('shows the PRD empty text', async () => {
    server.listIntakeBatches.mockResolvedValue([])
    const w = await render()
    expect(w.text()).toContain('Tiada kelompok item lagi.')
    expect(w.text()).not.toContain('Belum ada kertas')
  })

  it('offers Batalkan only before a batch is ready', async () => {
    const w = await render()
    expect(w.findAll('[data-testid=batch-cancel]')).toHaveLength(1)
  })

  it('cancels after the exact confirm, then reloads', async () => {
    const w = await render()
    await w.get('[data-testid=batch-cancel]').trigger('click')
    await flushPromises()
    expect(confirm).toHaveBeenCalledWith({
      message: 'Batalkan kelompok ini?',
      confirmLabel: 'Ya, Batalkan',
      cancelLabel: 'Batal',
    })
    expect(server.cancelIntakeBatch).toHaveBeenCalledWith('1')
    expect(server.listIntakeBatches).toHaveBeenCalledTimes(2)
  })

  it('does nothing when the confirm is refused', async () => {
    confirm.mockResolvedValue(false)
    const w = await render()
    await w.get('[data-testid=batch-cancel]').trigger('click')
    await flushPromises()
    expect(server.cancelIntakeBatch).not.toHaveBeenCalled()
  })
})
