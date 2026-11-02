// @vitest-environment jsdom
/**
 * The M07 admin forms in http mode: the real pages, client and transport, with only `fetch` stubbed.
 * The stub validates every write with the contract's own schema (`idInput` takes a decimal string and
 * refuses a number), answering 422 with `fields` as the API does. Mock mode keeps numbers.
 */
import {
  PkskAdminAccessGrantSchema,
  PkskAdminBulkRequestSchema,
  PkskAdminQuestionCreateSchema,
  PkskAdminQuestionUpdateSchema,
} from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'
import type { ZodType } from 'zod'

import { createHttpTransport, installTransport } from '@/api'

import { bulkPkskQuestions } from '../../api/admin'
import PkskAccessPage from '../../pages/PkskAccessPage.vue'
import PkskQuestionFormPage from '../../pages/PkskQuestionFormPage.vue'

const DOMAINS = [
  { id: '1', bahagian: 'A', name: 'Kecerdasan Insaniah', code: 'PKSK_INSANIAH', icon: 'x', color: '#000', order: 1 },
  { id: '2', bahagian: 'B', name: 'Matematik', code: 'PKSK_MATH', icon: 'x', color: '#000', order: 2 },
]
const PACKAGES = [{ id: '7', name: 'PKSK Kombo (T1 + T4)', level: 'ALL' }]
const DETAIL = {
  id: '55',
  bahagian: 'B',
  pkskDomainId: '2',
  pkskTargetLevel: 'T1',
  status: 'approved',
  questionText: 'Soalan contoh',
  difficultyLevel: 3,
  explanation: null,
  options: [
    { text: 'x', isCorrect: true },
    { text: 'y', isCorrect: false },
  ],
}
const META = { page: 1, pageSize: 20, totalItems: 0, totalPages: 1, from: null, to: null }

let sent: { method: string; url: string; body: unknown }[] = []
let wrapper: VueWrapper | null = null
let router: Router

const json = (status: number, payload: unknown): Response =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { 'content-type': 'application/json' },
  })

/** A write checked as the API's validation pipe does: the first failure of each field, with `fields`. */
function validated(schema: ZodType, body: unknown, ok: Response): Response {
  if (import.meta.env.VITE_API_MODE !== 'http') return ok // the mock takes numbers
  const parsed = schema.safeParse(body)
  if (parsed.success) return ok
  const fields: Record<string, string> = {}
  for (const issue of parsed.error.issues) fields[String(issue.path[0])] ??= issue.message
  const message = Object.values(fields)[0]
  return json(422, { error: { code: 'VALIDATION_ERROR', message, fields } })
}

function answer(url: string, method: string, body: unknown): Response {
  if (method === 'GET') {
    if (url === '/api/pksk-domains') return json(200, { data: DOMAINS })
    if (url === '/api/pksk-packages') return json(200, { data: PACKAGES })
    if (url === '/api/admin/pksk-questions/55') return json(200, { data: DETAIL })
    if (url.endsWith('/stats')) return json(200, { data: { activeTotal: 0, t1: 0, t4: 0 } })
    return json(200, { data: [], meta: META })
  }
  const done = (data: unknown, status = 200) => json(status, { data, status: 'Berjaya.' })
  if (url === '/api/admin/pksk-access') {
    return validated(PkskAdminAccessGrantSchema, body, done({}, 201))
  }
  if (url === '/api/admin/pksk-questions/bulk') {
    return validated(PkskAdminBulkRequestSchema, body, done({ affected: 1 }))
  }
  if (method === 'PUT') return validated(PkskAdminQuestionUpdateSchema, body, done(DETAIL))
  return validated(PkskAdminQuestionCreateSchema, body, done(DETAIL, 201))
}

async function render(
  component: object,
  path: string,
  props: Record<string, unknown> = {},
): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:rest(.*)*', component: { template: '<div />' } }],
  })
  await router.push(path)
  wrapper = mount(component, { props, attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return wrapper
}

const t = (w: VueWrapper, id: string) => w.get(`[data-testid=${id}]`)
const writes = () => sent.filter((s) => s.method !== 'GET')

async function fillNewQuestion(w: VueWrapper): Promise<void> {
  await t(w, 'q-bahagian').setValue('B')
  await t(w, 'q-domain').setValue('2')
  await t(w, 'q-text').setValue('Soalan baharu')
  const texts = w.findAll('[data-testid=option-text]')
  for (const [i, input] of texts.entries()) await input.setValue(`Pilihan ${String(i + 1)}`)
  await w.findAll('[data-testid=option-correct]')[0]!.trigger('click')
}

beforeEach(() => {
  sent = []
  setActivePinia(createPinia())
  vi.stubEnv('VITE_API_MODE', 'http')
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        const url = input as string
        const method = init?.method ?? 'GET'
        const raw = init?.body as string | undefined
        const body: unknown = raw ? JSON.parse(raw) : null
        sent.push({ method, url, body })
        return Promise.resolve(answer(url, method, body))
      },
    }),
  )
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  vi.unstubAllEnvs()
})

describe('PkskAccessPage grant', () => {
  async function submitGrant(): Promise<VueWrapper> {
    const w = await render(PkskAccessPage, '/admin/pksk/access')
    await t(w, 'grant-toggle').trigger('click')
    await t(w, 'grant-user').setValue('21')
    await t(w, 'grant-form').trigger('submit')
    await flushPromises()
    return w
  }

  it('http mode: sends userId and packageId as strings, with no "Pengguna tidak dijumpai."', async () => {
    const w = await submitGrant()
    expect(writes()[0]?.body).toEqual({ userId: '21', packageId: '7', expiresAt: null })
    expect(w.text()).not.toContain('Pengguna tidak dijumpai.')
  })

  it('mock mode: the numbers are unchanged', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await submitGrant()
    expect(writes()[0]?.body).toEqual({ userId: 21, packageId: 7, expiresAt: null })
  })
})

describe('PkskQuestionFormPage', () => {
  it('create, http mode: sends pkskDomainId as a string, with no "Sila pilih domain."', async () => {
    const w = await render(PkskQuestionFormPage, '/admin/pksk/questions/create', { mode: 'create' })
    await fillNewQuestion(w)
    await t(w, 'pksk-question-form').trigger('submit')
    await flushPromises()
    expect(writes()[0]?.body).toMatchObject({ bahagian: 'B', pkskDomainId: '2' })
    expect(w.text()).not.toContain('Sila pilih domain.')
    expect(router.currentRoute.value.path).toBe('/admin/pksk/questions')
  })

  it('edit, http mode: sends pkskDomainId as a string', async () => {
    const w = await render(PkskQuestionFormPage, '/admin/pksk/questions/55/edit', {
      mode: 'edit',
      id: '55',
    })
    await t(w, 'pksk-question-form').trigger('submit')
    await flushPromises()
    expect(writes()[0]).toMatchObject({
      method: 'PUT',
      url: '/api/admin/pksk-questions/55',
      body: { pkskDomainId: '2' },
    })
    expect(w.text()).not.toContain('Sila pilih domain.')
    expect(router.currentRoute.value.path).toBe('/admin/pksk/questions')
  })

  it('create, mock mode: pkskDomainId stays a number', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    const w = await render(PkskQuestionFormPage, '/admin/pksk/questions/create', { mode: 'create' })
    await fillNewQuestion(w)
    await t(w, 'pksk-question-form').trigger('submit')
    await flushPromises()
    expect(writes()[0]?.body).toMatchObject({ pkskDomainId: 2 })
  })
})

describe('bulkPkskQuestions', () => {
  it('http mode: every id is a string, also from a caller holding numbers', async () => {
    await bulkPkskQuestions('approve', [5, '6'])
    expect(writes()[0]?.body).toEqual({ action: 'approve', ids: ['5', '6'] })
  })

  it('mock mode: a number stays a number', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await bulkPkskQuestions('reject', [5])
    expect(writes()[0]?.body).toEqual({ action: 'reject', ids: [5] })
  })
})
