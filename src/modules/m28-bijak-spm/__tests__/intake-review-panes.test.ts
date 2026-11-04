// @vitest-environment jsdom
/**
 * Semak Ekstrak panes (S2-T07; FR-X6-11, AC-ADM-R4, AC-ADM-R5): below `lg` the tabs `Sumber PDF` | `Editor` of DsSplitPane replace
 * the page-local tab bar (default `Editor`), a manual batch shows no tabs and stacks the same two blocks, and a tap on a figure
 * crop opens it full-screen.
 */
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

const batchOf = (extra: Record<string, unknown> = {}): IntakeBatch =>
  ({
    id: 'ek-1',
    title: 't',
    subject: 'MAT',
    subjectName: 'Matematik',
    kertas: 2,
    year: 2025,
    status: 'draf',
    sourceKind: 'pdf',
    fileName: 'kertas.pdf',
    source: 'x',
    paperType: 'Percubaan',
    provider: 'mock',
    model: '-',
    questions: [blankQuestion('MAT', 1), blankQuestion('MAT', 2)],
    stimuli: [],
    unmatched: [],
    pages: [{ page: 1, text: 'Halaman satu', source: 'text-layer' }, { page: 2, text: 'Halaman dua', source: 'text-layer' }],
    updatedAt: 1,
    ...extra,
  }) as unknown as IntakeBatch

/** Below `lg` (tabs) or from it (side by side). */
function viewport(wide: boolean): void {
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: wide,
    media: q,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
}

const mounted: { unmount: () => void }[] = []
async function mountPage() {
  const w = mount(IntakeReviewPage, {
    props: { batchId: 'ek-1' },
    global: { stubs: { RouterLink: true } },
    attachTo: document.body,
  })
  mounted.push(w)
  await flushPromises()
  return w
}
const tabs = (w: Awaited<ReturnType<typeof mountPage>>) => w.findAll('[role="tab"]')

beforeEach(() => {
  for (const f of Object.values(server)) if (typeof f === 'function' && 'mockReset' in f) (f as ReturnType<typeof vi.fn>).mockReset()
  server.getIntakeBatch.mockResolvedValue(batchOf())
})
afterEach(() => {
  for (const w of mounted.splice(0)) w.unmount()
  delete (window as { matchMedia?: unknown }).matchMedia
  document.body.innerHTML = ''
})

describe('IntakeReviewPage panes', () => {
  it('below lg: the tabs are Sumber PDF then Editor, Editor is shown first and a tab switches the pane', async () => {
    viewport(false)
    const w = await mountPage()
    expect(w.get('[role="tablist"]').attributes('aria-label')).toBe('Paparan')
    expect(tabs(w).map((t) => t.text())).toEqual(['Sumber PDF', 'Editor'])
    expect(tabs(w).map((t) => t.attributes('aria-selected'))).toEqual(['false', 'true'])
    const pane = (id: string) => w.get(`[data-pane="${id}"]`)
    expect(pane('sumber').classes()).toContain('hidden')
    expect(pane('editor').classes()).not.toContain('hidden')

    await tabs(w)[0]!.trigger('click')
    expect(pane('sumber').classes()).not.toContain('hidden')
    expect(pane('editor').classes()).toContain('hidden')
    // both panes stay mounted: the source panel and the open item survive a switch
    expect(w.find('[data-testid="source-panel"]').exists()).toBe(true)
    expect(w.findAll('[data-testid="question-card"]')).toHaveLength(2)
    expect(w.find('[data-testid="item-counter"]').text()).toBe('Item 1 / 2')
    await tabs(w)[1]!.trigger('click')
    expect(pane('editor').classes()).not.toContain('hidden')
    expect(w.find('[data-testid="item-counter"]').text()).toBe('Item 1 / 2')
  })

  it('from lg: no tabs, the source pane is the first (left) column with the same testids', async () => {
    viewport(true)
    const w = await mountPage()
    expect(w.find('[role="tablist"]').exists()).toBe(false)
    expect(w.find('[data-ds="split-main"] [data-testid="source-panel"]').exists()).toBe(true)
    expect(w.find('[data-ds="split-aside"] [data-testid="questions-panel"]').exists()).toBe(true)
    expect(w.get('[data-testid="source-panel"]').classes()).toContain('lg:sticky')
  })

  it('a manual batch shows no tabs and keeps both blocks, one under the other', async () => {
    viewport(false)
    server.getIntakeBatch.mockResolvedValue(batchOf({ sourceKind: 'manual', pages: [], fileName: '' }))
    const w = await mountPage()
    expect(w.find('[role="tablist"]').exists()).toBe(false)
    expect(w.find('[data-ds="split-pane"]').exists()).toBe(false)
    expect(w.get('[data-testid="source-panel"]').attributes('aria-label')).toBe('Rajah dan petikan')
    expect(w.find('[data-testid="questions-panel"]').exists()).toBe(true)
    expect(w.find('[data-testid="stimulus-panel"]').exists()).toBe(true)
  })

  it('a tap on a figure crop opens it full-screen (AC-ADM-R5)', async () => {
    viewport(true)
    server.getIntakeBatch.mockResolvedValue(
      batchOf({ stimuli: [{ id: 's1', kind: 'diagram', label: 'Rajah 1', alt: 'Litar bersiri', image: { url: '/api/files/tok-s1' } }] }),
    )
    const w = await mountPage()
    expect(document.body.querySelector('[role="dialog"]')).toBeNull()
    await w.get('[data-testid="stimulus-card"] [data-testid="figure-tap"] img').trigger('click')
    await flushPromises()
    const viewer = document.body.querySelector('[role="dialog"]')
    expect(viewer).not.toBeNull()
    expect(viewer?.querySelector('[data-testid="figure-viewer-img"]')?.getAttribute('src')).toContain('/api/files/tok-s1')
  })
})
