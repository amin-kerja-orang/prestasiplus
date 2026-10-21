// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import IntakeListPage from '../admin/intake/pages/IntakeListPage.vue'
import IntakeManualPage from '../admin/intake/pages/IntakeManualPage.vue'
import IntakeReviewPage from '../admin/intake/pages/IntakeReviewPage.vue'
import IntakeUploadPage from '../admin/intake/pages/IntakeUploadPage.vue'
import BankEditPage from '../admin/papers/BankEditPage.vue'
import BankPage from '../admin/papers/BankPage.vue'
import PaperEditorPage from '../admin/papers/PaperEditorPage.vue'
import PaperListPage from '../admin/papers/PaperListPage.vue'
import PaperNewPage from '../admin/papers/PaperNewPage.vue'
import ReviewItemPage from '../admin/papers/ReviewItemPage.vue'
import ReviewQueuePage from '../admin/papers/ReviewQueuePage.vue'
import adminIntakeRoutes from '../routes/admin-intake'
import adminPaperRoutes from '../routes/admin-papers'
import { bijakAdminServer, setBijakServerForTests } from '../server/client'
import { BijakError } from '../server/errors'
import {
  UNAVAILABLE_MESSAGE,
  blueprintFromWire,
  createHttpBijakAdminServer,
  questionStatusFromWire,
} from '../server/http-admin'

const T0 = '2026-10-20T09:00:00.000+08:00'
const ok = (data: unknown, extra: object = {}): TransportResponse => ({
  status: 200,
  headers: {},
  body: { data, ...extra },
})
const fail = (status: number, code: string, message: string): TransportResponse => ({
  status,
  headers: {},
  body: { error: { code, message } },
})

function setup(
  routes: Record<string, TransportResponse | ((req: TransportRequest) => TransportResponse)> = {},
) {
  const requests: TransportRequest[] = []
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      requests.push(req)
      const key = `${req.method} ${req.url}`
      if (key === 'GET /api/session') return Promise.resolve(ok({ csrf: 'csrf-1' }))
      const r = routes[key]
      if (typeof r === 'function') return Promise.resolve(r(req))
      return Promise.resolve(r ?? fail(500, 'SERVER_ERROR', `unrouted ${key}`))
    }),
  }
  const server = createHttpBijakAdminServer({ client: new ApiClient({ transport }) })
  return { server, requests }
}

const WIRE_PAPER = {
  id: 'p1',
  title: 'Kertas',
  subject: 'MAT',
  kertas: 2,
  year: 2026,
  code: '1449/2',
  durationMin: 150,
  instructions: [],
  sections: [],
  status: 'draf',
  createdAt: T0,
  updatedAt: T0,
}

describe('HttpBijakAdminServer', () => {
  it('lists papers through every page and maps timestamps', async () => {
    const { server, requests } = setup({
      'GET /api/admin/papers': (req) =>
        ok([{ id: req.query?.page === '2' ? 'b' : 'a', subject: 'MAT', updatedAt: T0 }], {
          meta: { totalPages: 2 },
        }),
    })
    const rows = await server.listAdminPapers()
    expect(rows.map((r) => r.id)).toEqual(['a', 'b'])
    expect(rows[0]!.updatedAt).toBe(Date.parse(T0))
    expect(requests.filter((r) => r.url.includes('/admin/papers'))).toHaveLength(2)
  })

  it('reads the editor and maps paper dates and question status', async () => {
    const { server } = setup({
      'GET /api/admin/papers/p1': ok({
        paper: { ...WIRE_PAPER, publishedAt: T0 },
        blueprint: null,
        questions: [{ id: 'q1', subject: 'MAT', status: 'published' }],
        groups: [],
      }),
    })
    const e = await server.getPaperEditor('p1')
    expect(e.paper.createdAt).toBe(Date.parse(T0))
    expect(e.paper.publishedAt).toBe(Date.parse(T0))
    expect(e.questions[0]!.status).toBe('terbit')
    expect(e.blueprint).toBeNull()
  })

  it('sends CSRF on writes: create, save, publish, withdraw, delete, preview', async () => {
    const { server, requests } = setup({
      'POST /api/admin/papers': ok({ id: 'n1' }),
      'PUT /api/admin/papers/p1': ok({ paper: WIRE_PAPER, blueprint: null, questions: [], groups: [] }),
      'POST /api/admin/papers/p1/publish': ok({ ok: false, errors: ['x'] }),
      'POST /api/admin/papers/p1/withdraw': ok({ ok: true }),
      'DELETE /api/admin/papers/p1': ok({ ok: true }),
      'POST /api/admin/papers/preview': ok({ questions: [], stimuli: {}, optionBanks: {} }),
    })
    expect(await server.createPaper({ subject: 'MAT', kertas: 2, title: ' T ' })).toBe('n1')
    await server.savePaper('p1', { title: 'B', sections: [{ id: 's', questionIds: ['q'] }] })
    expect(await server.publishPaper('p1')).toEqual({ ok: false, errors: ['x'] })
    await server.unpublishPaper('p1')
    await server.deletePaper('p1')
    expect((await server.previewQuestions(['q'])).questions).toEqual([])
    const writes = requests.filter((r) => r.method !== 'GET')
    expect(writes).toHaveLength(6)
    for (const w of writes) expect(w.headers?.['x-csrf-token']).toBe('csrf-1')
    expect(writes[0]!.body).toEqual({ subject: 'MAT', kertas: 2, title: 'T' })
    expect(writes[1]!.body).toEqual({ title: 'B', sections: [{ id: 's', questionIds: ['q'] }] })
  })

  it('maps API errors to BijakError', async () => {
    const { server } = setup({
      'POST /api/admin/papers': fail(422, 'VALIDATION_ERROR', 'Tiada blueprint untuk subjek dan kertas ini'),
      'GET /api/admin/papers/zz': fail(404, 'NOT_FOUND', 'Kertas tidak ditemui'),
    })
    await expect(server.createPaper({ subject: 'MAT', kertas: 1 })).rejects.toMatchObject({
      code: 'bad_request',
      message: 'Tiada blueprint untuk subjek dan kertas ini',
    })
    await expect(server.getPaperEditor('zz')).rejects.toMatchObject({ code: 'not_found' })
  })

  it('subjects() never calls the student route; it derives from admin blueprints', async () => {
    const { server, requests } = setup({
      'GET /api/admin/blueprints': ok(
        [
          { subject: 'MAT', subjectName: 'Matematik', kertas: 1 },
          { subject: 'MAT', subjectName: 'Matematik', kertas: 2 },
          { subject: 'SN', subjectName: 'Sains', kertas: 1 },
        ],
        { meta: { totalPages: 1 } },
      ),
    })
    const list = server.subjects()
    await vi.waitFor(() => expect(list).toHaveLength(2))
    expect(list.map((s) => s.code)).toEqual(['MAT', 'SN'])
    server.subjects()
    expect(requests.some((r) => r.url === '/api/bijak/subjects')).toBe(false)
  })

  it('subjects() degrades quietly on 403 and does not retry', async () => {
    const { server, requests } = setup({
      'GET /api/admin/blueprints': fail(403, 'FORBIDDEN', 'x'),
    })
    expect(server.subjects()).toHaveLength(0)
    await vi.waitFor(() => expect(requests.some((r) => r.url === '/api/admin/blueprints')).toBe(true))
    await new Promise((r) => setTimeout(r, 10))
    server.subjects()
    server.subjects()
    expect(requests.filter((r) => r.url === '/api/admin/blueprints')).toHaveLength(1)
    expect(requests.some((r) => r.url === '/api/bijak/subjects')).toBe(false)
  })

  it('lists blueprints', async () => {
    const { server } = setup({
      'GET /api/admin/blueprints': ok([{ subject: 'MAT', kertas: 1 }], {
        meta: { totalPages: 1 },
      }),
    })
    expect(await server.listBlueprints()).toHaveLength(1)
  })

  it('rejects (never throws) methods without a backend route', async () => {
    const { server } = setup()
    const calls = [
      () => server.resubmit('k'),
      () => server.getBankEditable('q'),
      () => server.reviseQuestion('q', 's', 'n'),
      () => server.reviseQuestionFull('q', {} as never, undefined, 'n'),
      () => server.reviewDecision('k', { action: 'betulkan', reason: 'x' }),
    ]
    for (const c of calls) {
      let p: Promise<unknown> | undefined
      expect(() => {
        p = c()
      }).not.toThrow()
      await expect(p).rejects.toBeInstanceOf(BijakError)
      await expect(p).rejects.toMatchObject({ code: 'unavailable', message: UNAVAILABLE_MESSAGE })
    }
  })

  it('mappers', () => {
    expect(questionStatusFromWire('review')).toBe('semakan')
    expect(questionStatusFromWire('approved')).toBe('semakan')
    expect(questionStatusFromWire('draft')).toBe('draf')
    expect(questionStatusFromWire('archived')).toBe('ditolak')
    expect(blueprintFromWire({ subject: 'MAT', kertas: 1 } as never).kertas).toBe(1)
  })
})

describe('admin pages in http mode do not crash', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }))
  })
  afterEach(() => {
    setBijakServerForTests(null)
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  const pages: [string, unknown, Record<string, unknown>][] = [
    ['PaperListPage', PaperListPage, {}],
    ['PaperNewPage', PaperNewPage, {}],
    ['PaperEditorPage', PaperEditorPage, {}],
    ['BankPage', BankPage, {}],
    ['BankEditPage', BankEditPage, { qid: 'q1' }],
    ['ReviewQueuePage', ReviewQueuePage, {}],
    ['ReviewItemPage', ReviewItemPage, {}],
    ['IntakeListPage', IntakeListPage, {}],
    ['IntakeManualPage', IntakeManualPage, {}],
    ['IntakeReviewPage', IntakeReviewPage, { batchId: 'b1' }],
    ['IntakeUploadPage', IntakeUploadPage, {}],
  ]

  it.each(pages)('%s mounts without throwing', async (_name, component, props) => {
    const { server } = setup() // every unrouted call answers 500
    setBijakServerForTests(server)
    expect(bijakAdminServer()).toBe(server)
    const stub = { template: '<i/>' }
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: stub }, ...adminPaperRoutes, ...adminIntakeRoutes],
    })
    await router.push('/')
    const errors: unknown[] = []
    const w = mount(component as never, {
      props: props as never,
      attachTo: document.body,
      global: { plugins: [router], config: { errorHandler: (e: unknown) => errors.push(e) } },
    })
    await flushPromises()
    expect(errors).toEqual([])
    expect(w.html().length).toBeGreaterThan(0)
    w.unmount()
  })

  async function renderPage(component: unknown, props: Record<string, unknown>, server: unknown) {
    setBijakServerForTests(server as never)
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: { template: '<i/>' } },
        ...adminPaperRoutes,
        ...adminIntakeRoutes,
      ],
    })
    await router.push('/')
    const w = mount(component as never, {
      props: props as never,
      attachTo: document.body,
      global: { plugins: [router] },
    })
    await flushPromises()
    const html = w.html()
    w.unmount()
    return html
  }

  it.each([
    ['BankPage', BankPage, {}, 'listBank'],
    ['ReviewQueuePage', ReviewQueuePage, {}, 'listReviewQueue'],
    ['ReviewItemPage', ReviewItemPage, {}, 'getReviewItem'],
  ] as [string, unknown, Record<string, unknown>, string][])(
    '%s shows the demo-unavailable state when its load is unavailable',
    async (_name, component, props, method) => {
      const server = setup().server as unknown as Record<string, unknown>
      server[method] = () => Promise.reject(new BijakError('unavailable', UNAVAILABLE_MESSAGE))
      const html = await renderPage(component, props, server)
      expect(html).toContain('Fungsi ini belum tersedia dalam demo')
      expect(html).not.toContain('Tidak dapat memuatkan')
    },
  )

  it('keeps the generic load error for any other failure', async () => {
    const server = setup().server as unknown as Record<string, unknown>
    server.listBank = () => Promise.reject(new Error('boom'))
    const html = await renderPage(BankPage, {}, server)
    expect(html).toContain('Tidak dapat memuatkan bank soalan.')
    expect(html).not.toContain('belum tersedia dalam demo')
  })

  describe('IntakeReviewPage extraction states', () => {
    const batchWith = (over: Record<string, unknown>) => ({
      id: 'b1',
      subject: 'MAT',
      kertas: 2,
      year: 2025,
      paperType: 'Soalan Umum',
      source: 'Sekolah Contoh',
      copyright: 'sendiri',
      notes: '',
      fileName: 'a.pdf',
      fileHash: 'h',
      pageCount: 1,
      sourceKind: 'pdf',
      status: 'draf',
      userId: 1,
      createdAt: 0,
      updatedAt: 0,
      provider: 'x',
      model: 'x',
      questions: [],
      stimuli: [],
      unmatched: [],
      pages: [],
      ...over,
    })
    const mountReview = async (getIntakeBatch: () => Promise<unknown>) => {
      setBijakServerForTests({ getIntakeBatch } as never)
      const router = createRouter({
        history: createMemoryHistory(),
        routes: [{ path: '/', component: { template: '<i/>' } }, ...adminPaperRoutes, ...adminIntakeRoutes],
      })
      await router.push('/')
      const w = mount(IntakeReviewPage as never, {
        props: { batchId: 'b1' } as never,
        attachTo: document.body,
        global: { plugins: [router] },
      })
      await flushPromises()
      return w
    }

    it('shows the all-decided alert, not the false "no questions" text, when every item was decided', async () => {
      const extraction = { state: 'succeeded', itemCount: 3, canExtract: true, processing: false }
      const w = await mountReview(() => Promise.resolve(batchWith({ extraction })))
      expect(w.find('[data-testid="all-decided"]').exists()).toBe(true)
      expect(w.find('[data-testid="extract-panel"]').exists()).toBe(false)
      expect(w.text()).not.toContain('Tiada soalan dikesan')
      w.unmount()
    })

    it('does not replace the batch on the poll once a rajah was added', async () => {
      vi.useFakeTimers()
      try {
        const extraction = { state: 'running', canExtract: false, processing: false }
        const get = vi.fn(() =>
          Promise.resolve(
            batchWith({
              extraction,
              stimuli: [{ id: 's1', kind: 'diagram', label: 'Rajah 1', alt: 'a', caption: 'a', page: 1 }],
            }),
          ),
        )
        const w = await mountReview(get)
        expect(get).toHaveBeenCalledTimes(1)
        await vi.advanceTimersByTimeAsync(2100)
        expect(get).toHaveBeenCalledTimes(1) // the poll skipped: a rajah is in the editor
        w.unmount()
      } finally {
        vi.useRealTimers()
      }
    })
  })
})
