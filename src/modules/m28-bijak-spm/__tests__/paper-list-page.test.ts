// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import PaperListPage from '../admin/papers/PaperListPage.vue'
import type { AdminPaperSummary } from '../domain/admin-types'

const server = vi.hoisted(() => ({ listAdminPapers: vi.fn(), deletePaper: vi.fn() }))
vi.mock('../server/client', () => ({ bijakServer: () => server, bijakAdminServer: () => server }))

function paper(id: string, extra: Partial<AdminPaperSummary> = {}): AdminPaperSummary {
  return {
    id,
    title: `Kertas ${id}`,
    subject: 'MAT',
    subjectName: 'Matematik',
    kertas: 1,
    code: `MAT-${id}`,
    status: 'draf',
    questionCount: 10,
    marks: 40,
    budget: 50,
    ok: false,
    updatedAt: 1_800_000_000_000,
    ...extra,
  }
}

let wrapper: VueWrapper | null = null

beforeEach(() => {
  setActivePinia(createPinia())
  // Below 768px (matches: false) DsDataTable renders the card list.
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  server.listAdminPapers.mockReset()
  server.deletePaper.mockReset()
  server.listAdminPapers.mockResolvedValue([
    paper('d1'),
    paper('p1', { status: 'terbit', ok: true }),
  ])
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
      { path: '/', component: stub },
      { path: '/n', name: 'm28.admin.papers.new', component: stub },
      { path: '/e/:id', name: 'm28.admin.papers.edit', component: stub },
    ],
  })
  await router.push('/')
  wrapper = mount(PaperListPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

describe('PaperListPage card list (mobile)', () => {
  it('shows Buka and Padam kertas for a draft, only Buka for a published paper', async () => {
    const w = await render()
    expect(w.find('[data-ds=data-table-cards]').exists()).toBe(true)
    expect(w.find('[data-testid=paper-open-d1]').text()).toContain('Buka')
    expect(w.find('[data-testid=paper-delete-d1]').attributes('aria-label')).toBe('Padam kertas')
    expect(w.find('[data-testid=paper-open-p1]').exists()).toBe(true)
    expect(w.find('[data-testid=paper-delete-p1]').exists()).toBe(false)
  })

  it('shows status, Blueprint badge, Markah and Dikemas kini on the card', async () => {
    const w = await render()
    const draft = w.get('[data-testid=paper-card-d1]').text()
    expect(draft).toContain('Belum sepadan')
    expect(draft).toContain('40 / 50')
    expect(draft).toContain('Dikemas kini')
    expect(draft).toContain('Draf')
    const pub = w.get('[data-testid=paper-card-p1]').text()
    expect(pub).toContain('Sepadan')
    expect(pub).not.toContain('Belum sepadan')
    expect(pub).toContain('Diterbitkan')
  })

  it('deletes a draft from the card', async () => {
    server.deletePaper.mockResolvedValue(undefined)
    const w = await render()
    await w.get('[data-testid=paper-delete-d1]').trigger('click')
    await flushPromises()
    expect(server.deletePaper).toHaveBeenCalledWith('d1')
  })
})
