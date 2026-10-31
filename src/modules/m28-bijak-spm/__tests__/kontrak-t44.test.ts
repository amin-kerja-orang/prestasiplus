// @vitest-environment jsdom
// REQ-A-006 (T44 / H-A15): "Blueprint perlu semakan" (PIPE AC-06.6) with the reviewPapers gaps, and "Boleh tanda auto".
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { emptyForm, formFromView, toInput } from '../admin/kontrak/domain/form'
import { gapText, REVIEW_BADGE } from '../admin/kontrak/domain/review'
import KontrakEditorPage from '../admin/kontrak/pages/KontrakEditorPage.vue'
import KontrakListPage from '../admin/kontrak/pages/KontrakListPage.vue'
import { MockKontrakServer } from '../admin/kontrak/server/memory'
import { setKontrakServerForTests } from '../admin/kontrak/server/client'
import adminKontrakRoutes from '../routes/admin-kontrak'

const server = (): MockKontrakServer => new MockKontrakServer({ createPaper: () => Promise.resolve('paper-1') })
const REVIEW = [
  { paperId: '9', title: 'Set Percubaan A', gaps: ['marks', 'level_share'] as ('marks' | 'level_share')[] },
  { paperId: '10', title: 'Set Percubaan B', gaps: ['kbat'] as 'kbat'[] },
]

describe('REQ-A-006 text and gaps', () => {
  it('the badge is the contract text', () => {
    expect(REVIEW_BADGE).toBe('Blueprint perlu semakan')
    expect(gapText(['marks', 'tp', 'quota', 'kbat', 'level_share'])).toBe('Markah, TP, Kuota, KBAT, Nisbah Tingkatan')
  })
})

describe('REQ-A-006 Boleh tanda auto (autoMarkable)', () => {
  it('is carried by create and version bodies: true, false and null (not stated) are all kept', async () => {
    const s = server()
    const view = await s.get('MAT', 2)
    for (const v of [true, false, null]) {
      const f = formFromView({ ...view, autoMarkable: v })
      expect(f.autoMarkable).toBe(v)
      expect(toInput(f).autoMarkable).toBe(v)
    }
    // an older server that omits it reads as not stated
    expect(formFromView({ ...view, autoMarkable: undefined }).autoMarkable).toBeNull()
    expect(emptyForm().autoMarkable).toBeNull()
  })

  it('the mock keeps it on a new version', async () => {
    const s = server()
    const view = await s.get('MAT', 2)
    const f = formFromView(view)
    f.autoMarkable = true
    f.notes = 'nota'
    const next = await s.saveVersion('MAT', 2, toInput(f))
    expect(next.autoMarkable).toBe(true)
  })
})

describe('REQ-A-006 pages', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  })
  afterEach(() => {
    setKontrakServerForTests(null)
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  async function router(path: string) {
    const r = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }, ...adminKontrakRoutes] })
    await r.push(path)
    await r.isReady()
    return r
  }

  it('editor: badge text, the gaps per paper, and the Boleh tanda auto field writes the form', async () => {
    const s = server()
    const real = s.get.bind(s)
    s.get = async (sub, k) => ({ ...(await real(sub, k)), needsReview: true, reviewPapers: REVIEW })
    setKontrakServerForTests(s)
    const r = await router('/admin/spm/kontrak/MAT/2')
    const w = mount(KontrakEditorPage, { attachTo: document.body, global: { plugins: [r] } })
    await flushPromises()
    expect(w.get('[data-testid="needs-review"]').text()).toBe('Blueprint perlu semakan')
    expect(w.html()).not.toContain('perlu disemak')
    const list = w.get('[data-testid="review-papers"]').text()
    expect(list).toContain('Set Percubaan A: Markah, Nisbah Tingkatan')
    expect(list).toContain('Set Percubaan B: KBAT')
    const sel = w.get('[data-testid="auto-markable"]')
    await sel.setValue('true')
    expect((sel.element as HTMLSelectElement).value).toBe('true')
    w.unmount()
  })

  it('list: badge text and the count of affected papers (card view in jsdom; the table cell has the same testids)', async () => {
    const s = server()
    const real = s.list.bind(s)
    s.list = async () => (await real()).map((v, i) => (i === 0 ? { ...v, needsReview: true, reviewPapers: REVIEW } : v))
    setKontrakServerForTests(s)
    const r = await router('/admin/spm/kontrak')
    const w = mount(KontrakListPage, { attachTo: document.body, global: { plugins: [r] } })
    await flushPromises()
    expect(w.find('[data-testid="needs-review"]').text()).toBe('Blueprint perlu semakan')
    expect(w.get('[data-testid="review-count"]').text()).toBe('2 kertas terjejas')
    expect(w.html()).not.toContain('perlu disemak')
    w.unmount()
  })
})
