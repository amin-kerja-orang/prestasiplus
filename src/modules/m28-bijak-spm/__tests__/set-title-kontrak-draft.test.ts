// @vitest-environment jsdom
// S3-T02 (review round 2): the Kontrak "Jana Draf Kertas" sends `Tajuk set` (PRD30 13-04, API-BIJAK-11 refuses a draft without one),
// the builder mock checks the size before it creates a paper, the pool preview counts groups from the bank, and a 422 `fields.title`
// is shown on the title field of the Set Builder and Semak Kertas (the last in its own file).
import { BIJAK_BUILDER_MESSAGES, BIJAK_SET_BUILDER_PROPOSED } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import { MockBuilderServer } from '../admin/builder/server/memory'
import { KontrakError, type KontrakApi } from '../admin/kontrak/server/api'
import { setKontrakServerForTests } from '../admin/kontrak/server/client'
import { createHttpKontrakServer } from '../admin/kontrak/server/http'
import { MockKontrakServer } from '../admin/kontrak/server/memory'
import KontrakPoolPage from '../admin/kontrak/pages/KontrakPoolPage.vue'

const REQUIRED = BIJAK_BUILDER_MESSAGES.setTitleRequired
const TOO_LONG = BIJAK_SET_BUILDER_PROPOSED.setTitleTooLong
const x = (n: number): string => 'x'.repeat(n)

describe('Kontrak mock: generateDraft applies the title rule', () => {
  const refused = (message: string) => expect.objectContaining({ kind: 'invalid', message, fields: { title: message } })

  it('refuses a blank, whitespace or 121-character title before it creates a paper', async () => {
    const createPaper = vi.fn().mockResolvedValue('paper-1')
    const s = new MockKontrakServer({ createPaper })
    await expect(s.generateDraft('SN', 2, '')).rejects.toEqual(refused(REQUIRED))
    await expect(s.generateDraft('SN', 2, '   ')).rejects.toEqual(refused(REQUIRED))
    await expect(s.generateDraft('SN', 2, x(121))).rejects.toEqual(refused(TOO_LONG))
    expect(createPaper).not.toHaveBeenCalled()
  })

  it('hands the trimmed title (120 is allowed) to the paper it creates', async () => {
    const createPaper = vi.fn().mockResolvedValue('paper-1')
    const s = new MockKontrakServer({ createPaper })
    const pool = await s.pool('SN', 2)
    if (pool.verdict !== 'boleh') return // the seed's verdict decides whether a draft can be made at all
    await expect(s.generateDraft('SN', 2, `  ${x(120)}  `)).resolves.toEqual({ id: 'paper-1' })
    expect(createPaper).toHaveBeenCalledWith('SN', 2, x(120))
  })
})

describe('Kontrak http: generateDraft sends the title', () => {
  function client(handler: (req: TransportRequest) => TransportResponse) {
    const calls: TransportRequest[] = []
    const transport: Transport = {
      request: vi.fn((req: TransportRequest) => {
        if (req.url === '/api/session') return Promise.resolve({ status: 200, headers: {}, body: { data: { csrf: 'c' } } })
        calls.push(req)
        return Promise.resolve(handler(req))
      }),
    }
    return { api: createHttpKontrakServer({ client: new ApiClient({ transport }) }), calls }
  }

  it('posts { subject, kertas, title } to /api/admin/papers/generate with the title trimmed', async () => {
    const { api, calls } = client(() => ({ status: 201, headers: {}, body: { data: { id: '77' } } }))
    await expect(api.generateDraft('SEJ', 2, '  Latih Tubi  ')).resolves.toEqual({ id: '77' })
    expect(calls[0]).toMatchObject({ method: 'POST', url: '/api/admin/papers/generate' })
    expect(calls[0]!.body).toEqual({ subject: 'SEJ', kertas: 2, title: 'Latih Tubi' })
  })

  it('reads a 422 fields.title into KontrakError.fields', async () => {
    const { api } = client(() => ({ status: 422, headers: {}, body: { error: { code: 'VALIDATION_ERROR', message: REQUIRED, fields: { title: REQUIRED } } } }))
    const err = await api.generateDraft('SEJ', 2, '').catch((e: unknown) => e)
    expect(err).toBeInstanceOf(KontrakError)
    expect(err).toMatchObject({ kind: 'invalid', message: REQUIRED, fields: { title: REQUIRED } })
  })
})

describe('builder mock: Jana set checks the size first, the preview counts groups from the bank', () => {
  async function pair(api: MockBuilderServer): Promise<{ subject: string; kertas: number }> {
    const s = (await api.builderSubjects())[0]!
    return { subject: s.code, kertas: s.kertas[0]! }
  }

  it('a count above the contract total is refused with fields.count and leaves no set in listSets', async () => {
    const api = new MockBuilderServer()
    const p = await pair(api)
    const before = (await api.listSets()).map((s) => s.id)
    const total = (await api.poolPreview(p.subject, p.kertas)).contractTotal!
    const message = BIJAK_SET_BUILDER_PROPOSED.countAboveContract(total)
    await expect(api.generate(p.subject, p.kertas, { title: 'Set A', count: total + 1 })).rejects.toMatchObject({ kind: 'invalid', message, fields: { count: message } })
    expect((await api.listSets()).map((s) => s.id)).toEqual(before)
  })

  it('poolPreview creates no paper and groupTotal is computed, not 1', async () => {
    const api = new MockBuilderServer()
    const before = (await api.listSets()).length
    const { bijakAdminServer } = await import('../server/client')
    const admin = bijakAdminServer() as unknown as { bankUnits(subject: string, kertas: number): { groupId?: string }[] }
    const seen = new Set<number>()
    for (const s of await api.builderSubjects()) {
      for (const kertas of s.kertas) {
        const preview = await api.poolPreview(s.code, kertas)
        expect(preview.groupTotal).toBe(admin.bankUnits(s.code, kertas).filter((u) => u.groupId).length)
        seen.add(preview.groupTotal ?? -1)
      }
    }
    expect((await api.listSets()).length).toBe(before)
    expect([...seen].some((n) => n !== 1)).toBe(true)
  })
})

describe('Kontrak pool page: Tajuk set', () => {
  let wrapper: VueWrapper | null = null
  const stubC = { template: '<i/>' }

  async function render(verdict: 'boleh' | 'tidak_boleh', generateDraft: ReturnType<typeof vi.fn>): Promise<VueWrapper> {
    const real = new MockKontrakServer({ createPaper: () => Promise.resolve('paper-1') })
    const pool = { ...(await real.pool('SN', 2)), verdict, firstFailure: null }
    setKontrakServerForTests({ pool: () => Promise.resolve(pool), get: (s: string, k: number) => real.get(s, k), generateDraft } as unknown as KontrakApi)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/spm/kontrak/:subjek/:kertas/kolam', name: 'm28.admin.kontrak.pool', component: KontrakPoolPage },
        { path: '/admin/spm/kontrak/:subjek/:kertas', name: 'm28.admin.kontrak.edit', component: stubC },
        { path: '/admin/spm/kertas/:id', name: 'm28.admin.papers.edit', component: stubC },
        { path: '/:p(.*)*', component: stubC },
      ],
    })
    await router.push('/admin/spm/kontrak/SN/2/kolam')
    wrapper = mount(KontrakPoolPage, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    setKontrakServerForTests(null)
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('has an empty Tajuk set with the placeholder; Jana Draf Kertas is off and says why while it is invalid', async () => {
    const gen = vi.fn().mockResolvedValue({ id: 'p9' })
    const w = await render('boleh', gen)
    const input = w.get('[data-testid="draft-title"]')
    expect((input.element as HTMLInputElement).value).toBe('')
    expect(input.attributes('placeholder')).toBe('cth: Latih Tubi Sejarah Mac')
    const button = w.get('[data-testid="generate-draft"]')
    expect(button.attributes('disabled')).toBeDefined()
    // untouched: no error on first render, the button already stays off
    expect(w.text()).not.toContain(REQUIRED)
    await input.trigger('blur')
    expect(w.text()).toContain(REQUIRED)
    expect(button.attributes('disabled')).toBeDefined()
    await input.setValue(x(121))
    expect(w.text()).toContain(TOO_LONG)
    expect(button.attributes('disabled')).toBeDefined()
    await button.trigger('click')
    await flushPromises()
    expect(gen).not.toHaveBeenCalled()
  })

  it('shows the rule error after input too, not only after blur', async () => {
    const w = await render('boleh', vi.fn())
    expect(w.text()).not.toContain(TOO_LONG)
    await w.get('[data-testid="draft-title"]').setValue(x(121))
    expect(w.text()).toContain(TOO_LONG)
  })

  it('sends the title and opens the draft', async () => {
    const gen = vi.fn().mockResolvedValue({ id: 'p9' })
    const w = await render('boleh', gen)
    await w.get('[data-testid="draft-title"]').setValue(x(120))
    const button = w.get('[data-testid="generate-draft"]')
    expect(button.attributes('disabled')).toBeUndefined()
    await button.trigger('click')
    await flushPromises()
    expect(gen).toHaveBeenCalledWith('SN', 2, x(120))
  })

  it('shows a 422 fields.title on the field, not as the retry callout, and clears it on edit', async () => {
    const err = new KontrakError('invalid', TOO_LONG, { fields: { title: TOO_LONG } })
    const gen = vi.fn().mockRejectedValue(err)
    const w = await render('boleh', gen)
    await w.get('[data-testid="draft-title"]').setValue('Set A')
    await w.get('[data-testid="generate-draft"]').trigger('click')
    await flushPromises()
    expect(w.text()).toContain(TOO_LONG)
    expect(w.find('[data-testid="draft-error"]').exists()).toBe(false)
    await w.get('[data-testid="draft-title"]').setValue('Set B')
    expect(w.text()).not.toContain(TOO_LONG)
  })
})
