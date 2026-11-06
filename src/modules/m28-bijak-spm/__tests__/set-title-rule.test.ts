// @vitest-environment jsdom
// S3-T02: `Tajuk set` (PRD30 13-01 / 13-04) is required and at most 120 characters after trim, on create, Jana set
// and the paper PUT. The mock, the http client, the forms and the page follow the server rule (#775).
import { BIJAK_BUILDER_MESSAGES, BIJAK_SET_BUILDER_PROPOSED, BIJAK_SET_TITLE_MAX } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import PaperMetaForm from '../admin/builder/components/PaperMetaForm.vue'
import { setTitleError } from '../admin/builder/domain/set-title'
import SetBuilderLandingPage from '../admin/builder/pages/SetBuilderLandingPage.vue'
import { BuilderError, type BuilderApi } from '../admin/builder/server/api'
import { setBuilderServerForTests } from '../admin/builder/server/client'
import { createHttpBuilderServer } from '../admin/builder/server/http'
import { MockBuilderServer } from '../admin/builder/server/memory'
import type { AdminPaper } from '../domain/admin-types'

const REQUIRED = BIJAK_BUILDER_MESSAGES.setTitleRequired
const TOO_LONG = BIJAK_SET_BUILDER_PROPOSED.setTitleTooLong
const x = (n: number): string => 'x'.repeat(n)

describe('setTitleError', () => {
  it('uses the contract copy and limit', () => {
    expect(BIJAK_SET_TITLE_MAX).toBe(120)
    expect(setTitleError(undefined)).toBe(REQUIRED)
    expect(setTitleError('   ')).toBe(REQUIRED)
    expect(setTitleError(x(120))).toBeUndefined()
    expect(setTitleError(`  ${x(120)}  `)).toBeUndefined() // the limit counts after trim
    expect(setTitleError(x(121))).toBe(TOO_LONG)
  })
})

describe('mock builder: the server rule on create, generate and update', () => {
  const refused = (message: string) => expect.objectContaining({ kind: 'invalid', message, fields: { title: message } })

  async function pair(api: MockBuilderServer): Promise<{ subject: string; kertas: number }> {
    const s = (await api.builderSubjects())[0]!
    return { subject: s.code, kertas: s.kertas[0]! }
  }

  it('create: blank, whitespace and a missing title are refused; 120 is kept, 121 is refused', async () => {
    const api = new MockBuilderServer()
    const p = await pair(api)
    await expect(api.create({ ...p, title: '' })).rejects.toEqual(refused(REQUIRED))
    await expect(api.create({ ...p, title: '   ' })).rejects.toEqual(refused(REQUIRED))
    await expect(api.create({ ...p })).rejects.toEqual(refused(REQUIRED))
    await expect(api.create({ ...p, title: x(121) })).rejects.toEqual(refused(TOO_LONG))
    const id = await api.create({ ...p, title: x(120) })
    expect((await api.getEditor(id)).paper.title).toBe(x(120))
  })

  it('create checks the title before anything else (parse, then the title)', async () => {
    const api = new MockBuilderServer()
    await expect(api.create({ subject: 'NOPE', kertas: 1, title: '' })).rejects.toEqual(refused(REQUIRED))
  })

  it('generate: blank, whitespace and a missing title are refused; 120 is kept, 121 is refused', async () => {
    const api = new MockBuilderServer()
    const p = await pair(api)
    await expect(api.generate(p.subject, p.kertas, { title: '' })).rejects.toEqual(refused(REQUIRED))
    await expect(api.generate(p.subject, p.kertas, { title: '  ' })).rejects.toEqual(refused(REQUIRED))
    await expect(api.generate(p.subject, p.kertas)).rejects.toEqual(refused(REQUIRED))
    await expect(api.generate(p.subject, p.kertas, { title: x(121) })).rejects.toEqual(refused(TOO_LONG))
    const id = await api.generate(p.subject, p.kertas, { title: x(120) })
    expect((await api.getEditor(id)).paper.title).toBe(x(120))
  })

  it('update: blank, whitespace and 121 are refused and leave the title; 120 is saved', async () => {
    const api = new MockBuilderServer()
    const id = await api.create({ ...(await pair(api)), title: 'Asal' })
    await expect(api.updateHeader(id, { title: '' })).rejects.toEqual(refused(REQUIRED))
    await expect(api.updateHeader(id, { title: '   ' })).rejects.toEqual(refused(REQUIRED))
    await expect(api.updateHeader(id, { title: x(121) })).rejects.toEqual(refused(TOO_LONG))
    expect((await api.getEditor(id)).paper.title).toBe('Asal')
    expect((await api.updateHeader(id, { title: x(120) })).paper.title).toBe(x(120))
    // A patch without a title is not a title edit.
    expect((await api.updateHeader(id, { year: 2025 })).paper.title).toBe(x(120))
  })
})

describe('http builder: a 422 fields.title becomes the field error', () => {
  function client(handler: (req: TransportRequest) => TransportResponse): { api: ReturnType<typeof createHttpBuilderServer>; bodies: unknown[] } {
    const bodies: unknown[] = []
    const transport: Transport = {
      request: vi.fn((req: TransportRequest) => {
        if (req.url === '/api/session') return Promise.resolve({ status: 200, headers: {}, body: { data: { csrf: 'c' } } })
        bodies.push(req.body)
        return Promise.resolve(handler(req))
      }),
    }
    return { api: createHttpBuilderServer({ client: new ApiClient({ transport }) }), bodies }
  }
  const unprocessable = (message: string): TransportResponse => ({
    status: 422,
    headers: {},
    body: { error: { code: 'VALIDATION_ERROR', message, fields: { title: message } } },
  })

  it.each([
    ['create', (a: ReturnType<typeof createHttpBuilderServer>) => a.create({ subject: 'SEJ', kertas: 1, title: '' })],
    ['generate', (a: ReturnType<typeof createHttpBuilderServer>) => a.generate('SEJ', 1, { title: '' })],
    ['update', (a: ReturnType<typeof createHttpBuilderServer>) => a.updateHeader('p1', { title: '' })],
  ])('%s: keeps the field and the message of the 422', async (_name, run) => {
    const { api, bodies } = client(() => unprocessable(REQUIRED))
    const err = await run(api).catch((e: unknown) => e)
    expect(err).toBeInstanceOf(BuilderError)
    expect(err).toMatchObject({ kind: 'invalid', message: REQUIRED, fields: { title: REQUIRED } })
    expect(bodies.length).toBeGreaterThan(0)
  })

  it('sends a blank title as typed instead of dropping it', async () => {
    const { api, bodies } = client(() => unprocessable(REQUIRED))
    await api.create({ subject: 'SEJ', kertas: 1, title: '  ' }).catch(() => undefined)
    await api.generate('SEJ', 1, { title: '' }).catch(() => undefined)
    await api.create({ subject: 'SEJ', kertas: 1 }).catch(() => undefined)
    expect(bodies[0]).toMatchObject({ title: '  ' })
    expect(bodies[1]).toMatchObject({ title: '' })
    expect(bodies[2]).toMatchObject({ title: '' })
  })

  it('a 422 without fields has none', async () => {
    const { api } = client(() => ({ status: 422, headers: {}, body: { error: { code: 'VALIDATION_ERROR', message: 'Kertas ini terkunci.' } } }))
    const err = await api.updateHeader('p1', { year: 2025 }).catch((e: unknown) => e)
    expect(err).toMatchObject({ kind: 'invalid', fields: {} })
  })
})

describe('PaperMetaForm: the title rule', () => {
  const paper = { id: 'p', title: 'Set A', subject: 'MAT', kertas: 2, year: 2026, code: '1449/2', durationMin: 150, instructions: [], status: 'draf' } as unknown as AdminPaper

  it('shows the error and blocks Simpan for blank and for 121 characters; 120 passes', async () => {
    const w = mount(PaperMetaForm, { props: { paper, title: '' } })
    expect(w.text()).toContain(REQUIRED)
    expect(w.get('[data-testid="meta-save"]').attributes('disabled')).toBeDefined()
    await w.setProps({ title: '   ' })
    expect(w.text()).toContain(REQUIRED)
    await w.setProps({ title: x(121) })
    expect(w.text()).toContain(TOO_LONG)
    expect(w.get('[data-testid="meta-save"]').attributes('disabled')).toBeDefined()
    await w.get('form').trigger('submit')
    expect(w.emitted('save')).toBeUndefined()
    await w.setProps({ title: x(120) })
    expect(w.text()).not.toContain(TOO_LONG)
    expect(w.get('[data-testid="meta-save"]').attributes('disabled')).toBeUndefined()
  })
})

describe('Set Builder landing: the title rule on Mula kosong and Jana set', () => {
  let wrapper: VueWrapper | null = null
  const stubC = { template: '<i/>' }

  function stub(over: Record<string, ReturnType<typeof vi.fn>> = {}) {
    const m: Record<string, ReturnType<typeof vi.fn>> = {
      listSets: vi.fn().mockResolvedValue([]),
      builderSubjects: vi.fn().mockResolvedValue([{ code: 'SEJ', name: 'Sejarah', kertas: [1, 2], levelScopes: { 1: 't5', 2: 't4_t5' } }]),
      poolPreview: vi.fn().mockResolvedValue({
        blueprint: { version: 1, source: 'Disahkan' },
        publishedTotal: 50,
        eligibleTotal: 50,
        verdict: 'boleh',
        firstFailure: null,
        excluded: { total: 0, byReason: [] },
        warnings: [],
        sections: [{ position: 1, label: 'Bahagian A', slots: 40, eligible: 50, modeExcluded: 0 }],
        groupTotal: 3,
        contractTotal: 40,
        filters: { years: [2025], negeri: ['Johor'] },
        levelScope: 't5',
      }),
      generate: vi.fn().mockResolvedValue('new1'),
      getEditor: vi.fn().mockResolvedValue({ paper: { sections: [{ questionIds: ['a'] }] } }),
      create: vi.fn().mockResolvedValue('new2'),
      ...over,
    }
    return { m, api: m as unknown as BuilderApi }
  }

  async function render(api: BuilderApi): Promise<VueWrapper> {
    setBuilderServerForTests(api)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/studio/sets', component: SetBuilderLandingPage },
        { path: '/admin/studio/sets/:paper/builder', component: stubC },
        { path: '/admin/spm/kertas/:id', name: 'm28.admin.papers.edit', component: stubC },
        { path: '/admin/spm/kontrak', name: 'm28.admin.kontrak', component: stubC },
        { path: '/admin/spm/kontrak/:subjek/:kertas', name: 'm28.admin.kontrak.edit', component: stubC },
        { path: '/admin/spm/kontrak/:subjek/:kertas/kolam', name: 'm28.admin.kontrak.pool', component: stubC },
      ],
    })
    await router.push('/admin/studio/sets')
    wrapper = mount(SetBuilderLandingPage, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
    return wrapper
  }
  const pick = async (w: VueWrapper, id: string, v: string): Promise<void> => {
    await w.get(`[data-testid="${id}"]`).setValue(v)
    await flushPromises()
  }

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    setBuilderServerForTests(null)
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('Jana set: blank and 121 show the error and keep Jana off; 120 generates', async () => {
    const { m, api } = stub()
    const w = await render(api)
    await pick(w, 'gen-subject', 'SEJ')
    await pick(w, 'gen-kertas', '1')
    const form = w.get('[data-testid="generate-form"]')
    await w.get('[data-testid="gen-title"]').setValue('')
    expect(form.text()).toContain(REQUIRED)
    expect(w.get('[data-testid="gen-submit"]').attributes('disabled')).toBeDefined()
    await w.get('[data-testid="gen-title"]').setValue(x(121))
    expect(form.text()).toContain(TOO_LONG)
    expect(w.get('[data-testid="gen-submit"]').attributes('disabled')).toBeDefined()
    await form.trigger('submit')
    await flushPromises()
    expect(m.generate).not.toHaveBeenCalled()
    await w.get('[data-testid="gen-title"]').setValue(x(120))
    expect(w.get('[data-testid="gen-submit"]').attributes('disabled')).toBeUndefined()
    await form.trigger('submit')
    await flushPromises()
    expect(m.generate).toHaveBeenCalledOnce()
  })

  it('Jana set: a 422 fields.title from the server shows in the field, not as a flash', async () => {
    const err = new BuilderError('invalid', TOO_LONG, { fields: { title: TOO_LONG } })
    const { api } = stub({ generate: vi.fn().mockRejectedValue(err) })
    const w = await render(api)
    await pick(w, 'gen-subject', 'SEJ')
    await pick(w, 'gen-kertas', '1')
    await w.get('[data-testid="generate-form"]').trigger('submit')
    await flushPromises()
    expect(w.get('[data-testid="generate-form"]').text()).toContain(TOO_LONG)
    expect(w.get('[data-testid="gen-submit"]').attributes('disabled')).toBeDefined()
  })

  it('Mula kosong: blank and 121 show the error and nothing is sent; 120 creates', async () => {
    const { m, api } = stub()
    const w = await render(api)
    await pick(w, 'blank-subject', 'SEJ')
    await pick(w, 'blank-kertas', '1')
    const form = w.get('[data-testid="blank-form"]')
    const submit = w.get('[data-testid="blank-submit"]')
    await w.get('[data-testid="blank-title"]').setValue('  ')
    // The button stays off while the rule fails, as Jana set does (the PR text says so).
    expect(submit.attributes('disabled')).toBeDefined()
    await form.trigger('submit')
    await flushPromises()
    expect(form.text()).toContain(REQUIRED)
    await w.get('[data-testid="blank-title"]').setValue(x(121))
    expect(form.text()).toContain(TOO_LONG)
    expect(submit.attributes('disabled')).toBeDefined()
    await form.trigger('submit')
    await flushPromises()
    expect(m.create).not.toHaveBeenCalled()
    await w.get('[data-testid="blank-title"]').setValue(x(120))
    expect(submit.attributes('disabled')).toBeUndefined()
    await form.trigger('submit')
    await flushPromises()
    expect(m.create).toHaveBeenCalledWith(expect.objectContaining({ title: x(120) }))
  })
})
