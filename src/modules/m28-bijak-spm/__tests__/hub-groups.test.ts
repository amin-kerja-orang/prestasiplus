// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import BijakHubPage from '../pages/BijakHubPage.vue'

/** FR-MUR-13-5, AC-MUR-13-1, 46 section 4.2 row 1: filters from the listed papers, groups by count, heading "{n} set · {kod}", chips. */
const server = vi.hoisted(() => ({ subjects: vi.fn(), listPapers: vi.fn(), listContracts: vi.fn() }))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const paper = (id: string, subject: string, subjectName: string, kertas: number, code: string) => ({
  id, title: id, subject, subjectName, kertas, year: 2025, code, durationMin: 75, questionCount: 40, marks: 40, kind: 'pilihan', status: 'belum',
})
const PAPERS = [
  paper('s1', 'SEJ', 'Sejarah', 1, '1249/1'),
  paper('m1', 'MAT', 'Matematik', 1, '1449/1'),
  paper('m2', 'MAT', 'Matematik', 3, '1449/3'),
  paper('n1', 'SN', 'Sains', 2, '1511/2'),
]

let wrapper: VueWrapper | null = null
beforeEach(() => {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  // Constant subject list: a subject with no listed paper must not appear in the filter.
  server.subjects.mockReturnValue([{ code: 'FIZ', name: 'Fizik' }])
  server.listContracts.mockResolvedValue([])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.unstubAllGlobals()
})

async function render(): Promise<VueWrapper> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/spm/bijak', component: BijakHubPage },
      { path: '/spm/bijak/kertas/:paperId', name: 'm28.bijak.cover', component: stub },
      { path: '/:p(.*)*', component: stub },
    ],
  })
  await router.push('/spm/bijak')
  wrapper = mount({ template: '<RouterView />' }, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const headings = (): string[] => [...document.body.querySelectorAll('[data-testid=tab-pilihan] h3')].map((h) => h.textContent ?? '')
const labelsOf = (w: VueWrapper, items: 'subjectItems' | 'kertasItems'): string[] =>
  (w.findComponent(BijakHubPage).vm as unknown as Record<string, { label: string }[]>)[items]!.map((i) => i.label)

describe('Kertas Pilihan', () => {
  it('orders groups by paper count, most first, then by name', async () => {
    server.listPapers.mockResolvedValue(PAPERS)
    await render()
    expect(headings()).toEqual(['Matematik', 'Sains', 'Sejarah'])
  })

  it('heads a group with "{n} set · {kod}"', async () => {
    server.listPapers.mockResolvedValue(PAPERS)
    await render()
    expect(document.body.querySelector('[data-testid=group-sets]')?.textContent).toBe('2 set · 1449')
  })

  it('a group whose papers have no code is headed "{n} set" alone (lead ruling DD3)', async () => {
    server.listPapers.mockResolvedValue([paper('x1', 'FIZ', 'Fizik', 1, ''), paper('x2', 'FIZ', 'Fizik', 2, '')])
    await render()
    expect(document.body.querySelector('[data-testid=group-sets]')?.textContent).toBe('2 set')
  })

  it('offers only the subjects of listed papers (name asc) and the kertas they hold', async () => {
    server.listPapers.mockResolvedValue(PAPERS)
    const w = await render()
    expect(labelsOf(w, 'subjectItems')).toEqual(['Semua subjek', 'Matematik', 'Sains', 'Sejarah'])
    expect(labelsOf(w, 'kertasItems')).toEqual(['Semua kertas', 'Kertas 1', 'Kertas 2', 'Kertas 3'])
  })

  it('a card shows the three chips, then only the V3 status', async () => {
    server.listPapers.mockResolvedValue(PAPERS)
    await render()
    const chips = [...document.body.querySelectorAll('[data-testid=paper-m1] [data-testid=paper-chips] > *')].map((c) => c.textContent?.trim())
    expect(chips).toEqual(['Kertas 1', '40 markah', '75 min', 'Belum cuba'])
    expect(document.body.querySelector('[data-testid=paper-m1]')?.textContent).not.toContain('2025')
  })

  it('a paper in progress shows "Belum dihantar" (OPT-STATUS-ATTEMPT) and no old wording', async () => {
    server.listPapers.mockResolvedValue([{ ...paper('m1', 'MAT', 'Matematik', 1, '1449/1'), status: 'sedang' }])
    await render()
    const card = document.body.querySelector('[data-testid=paper-m1]')?.textContent ?? ''
    expect(card).toContain('Belum dihantar')
    expect(card).not.toContain('Sedang dijawab')
  })

  it('with no listed paper: the exact empty text', async () => {
    server.listPapers.mockResolvedValue([])
    await render()
    const empty = document.body.querySelector('[data-testid=empty-pilihan]')?.textContent ?? ''
    expect(empty).toContain('Tiada kertas tersedia buat masa ini')
    expect(empty).toContain('Set simulasi sedang dalam penyediaan. Semak semula tidak lama lagi.')
  })
})
