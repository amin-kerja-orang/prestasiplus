// @vitest-environment jsdom
// S3-T07 (FR-MUR-13-20, AC-MUR-13-26, AC-PA-32, FR-PA-34): the pupil Bijak SPM hub is one Kertas Pilihan list. No tab strip,
// no Jana Kertas section, no generate call; `?tab=jana` (any `tab` query) falls back to the list without an error.
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import BijakHubPage from '../pages/BijakHubPage.vue'

const server = vi.hoisted(() => ({
  subjects: vi.fn(),
  listPapers: vi.fn(),
  listContracts: vi.fn(),
  generatePaper: vi.fn(),
}))
vi.mock('../server/client', () => ({ bijakServer: () => server }))
vi.mock('../lib/use-bijak', async () => {
  const { ref } = await import('vue')
  return { useBijakUser: () => ref(7), useLearnerTheme: () => undefined }
})

const PAPER = {
  id: 'p1',
  title: 'Kertas Contoh',
  subject: 'MAT',
  subjectName: 'Matematik',
  kertas: 1,
  year: 2024,
  durationMin: 150,
  marks: 100,
  status: 'belum',
}

describe('BijakHubPage has no Jana Kertas', () => {
  let wrapper: VueWrapper | null = null
  const q = (sel: string): HTMLElement | null => document.body.querySelector(sel)

  beforeEach(() => {
    server.subjects.mockReturnValue([{ code: 'MAT', name: 'Matematik' }])
    server.listPapers.mockResolvedValue([PAPER])
    server.listContracts.mockReset()
    server.generatePaper.mockReset()
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
  })

  async function render(url: string): Promise<void> {
    const stub = { template: '<i/>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/spm', component: stub },
        { path: '/spm/bijak', name: 'm28.bijak', component: stub },
        { path: '/spm/bijak/sejarah', component: stub },
        { path: '/spm/bijak/kertas/:paperId', name: 'm28.bijak.cover', component: stub },
      ],
    })
    await router.push(url)
    wrapper = mount(BijakHubPage, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
  }

  it.each(['/spm/bijak', '/spm/bijak?tab=jana', '/spm/bijak?tab=lain'])(
    '%s shows only the Kertas Pilihan list: no tab strip, no Jana section, no generate button',
    async (url) => {
      await render(url)
      expect(q('[data-testid="tab-pilihan"]')).not.toBeNull()
      expect(q('[data-testid="paper-p1"]')).not.toBeNull()
      expect(q('[data-testid="bijak-tabs"]')).toBeNull()
      expect(q('[data-testid="tab-jana"]')).toBeNull()
      expect(q('[data-testid="generate"]')).toBeNull()
      expect(document.body.textContent).not.toContain('Jana Kertas')
    },
  )

  it('never loads contracts or generates a paper', async () => {
    await render('/spm/bijak?tab=jana')
    expect(server.listContracts).not.toHaveBeenCalled()
    expect(server.generatePaper).not.toHaveBeenCalled()
  })

  it('keeps the data-empty state for an empty list', async () => {
    server.listPapers.mockResolvedValue([])
    await render('/spm/bijak?tab=jana')
    expect(q('[data-testid="empty-pilihan"]')?.textContent).toContain('Tiada kertas tersedia buat masa ini')
  })
})
