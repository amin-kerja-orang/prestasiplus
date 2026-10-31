// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { ApiClient } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import { blankQuestion } from '../admin/intake/domain/blank'
import { validateBatch } from '../admin/intake/domain/validation'
import QuestionEditor from '../admin/intake/components/QuestionEditor.vue'
import { mockStudioDskp, unitsFromStudio } from '../admin/intake/lib/dskp'
import IntakeReviewPage from '../admin/intake/pages/IntakeReviewPage.vue'
import type { IntakeQuestion } from '../admin/intake/types'
import adminIntakeRoutes from '../routes/admin-intake'
import adminPaperRoutes from '../routes/admin-papers'
import { setBijakServerForTests } from '../server/client'
import { createHttpBijakAdminServer } from '../server/http-admin'
import { BijakServer, MemoryStorage } from '../server/store'

const ok = (data: unknown, extra: object = {}): TransportResponse => ({ status: 200, headers: {}, body: { data, ...extra } })

/** Real curriculum units look like the printed DSKP numbers, not the prototype `MAT-T4-02` codes. */
const T4 = { units: [{ id: '41', code: '3.0', title: 'Fungsi Kuadratik', sps: [{ id: '411', code: '3.1.1', title: 'Fungsi', skCode: '3.1' }] }] }
const T5 = { units: [{ id: '51', code: '3.0', title: 'Kebarangkalian', sps: [] }] }

function httpServer() {
  const requests: TransportRequest[] = []
  const routes: Record<string, TransportResponse> = {
    'GET /api/session': ok({ csrf: 'c' }),
    'GET /api/admin/blueprints': ok([{ subject: 'MAT', subjectName: 'Matematik', kertas: 1 }], { meta: { totalPages: 1 } }),
    'GET /api/questions/summary': ok({ subjects: [{ id: '7', name: 'Matematik', total: 3, approved: 1 }] }),
    'GET /api/education-levels': ok([{ id: 4, code: 'T4' }, { id: 5, code: 'T5' }]),
  }
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      requests.push(req)
      if (req.url === '/api/questions/studio/dskp') {
        const q = req.query as Record<string, string>
        return Promise.resolve(q.subjectId === '7' ? ok(q.educationLevelId === '4' ? T4 : T5) : ok({ units: [] }))
      }
      return Promise.resolve(routes[`${req.method} ${req.url}`] ?? { status: 500, headers: {}, body: { error: { code: 'SERVER_ERROR', message: 'x' } } })
    }),
  }
  return { server: createHttpBijakAdminServer({ client: new ApiClient({ transport }) }), requests }
}

describe('REQ-B-001 intake DSKP picker reads the real curriculum', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
  })
  afterEach(() => {
    setBijakServerForTests(null)
    document.body.innerHTML = ''
  })

  it('http: reads the units of subject and form from GET /questions/studio/dskp', async () => {
    const { server, requests } = httpServer()
    expect(await server.dskpUnits('MAT', 'T4')).toEqual(T4)
    expect(await server.dskpUnits('MAT', 'T5')).toEqual(T5)
    expect(requests.filter((r) => r.url === '/api/questions/studio/dskp').map((r) => r.query)).toEqual([
      { subjectId: '7', educationLevelId: '4' },
      { subjectId: '7', educationLevelId: '5' },
    ])
    expect(await server.dskpUnits('SN', 'T4')).toEqual({ units: [] }) // a subject the curriculum does not have
  })

  it('the mock answers in the same shape', async () => {
    const mock = await new BijakServer({ storage: new MemoryStorage() }).dskpUnits('MAT', 'T4')
    expect(mock).toEqual(mockStudioDskp('MAT', 'T4'))
    expect(mock.units.length).toBeGreaterThan(0)
    for (const u of mock.units) {
      expect(Object.keys(u).sort()).toEqual(['code', 'id', 'sps', 'title'])
      for (const sp of u.sps) expect(Object.keys(sp).sort()).toEqual(['code', 'id', 'skCode', 'title'])
    }
  })

  async function mountEditor(server: unknown, q: IntakeQuestion) {
    setBijakServerForTests(server as never)
    const emitted: IntakeQuestion[] = []
    const w = mount(QuestionEditor, {
      props: { modelValue: q, 'onUpdate:modelValue': (v: IntakeQuestion) => emitted.push(v) },
      attachTo: document.body,
    })
    await flushPromises()
    return { w, emitted }
  }

  it('lists only served units and an item tagged from it passes the gate', async () => {
    const { server } = httpServer()
    const q: IntakeQuestion = {
      ...blankQuestion('MAT', 1),
      type: 'mcq',
      stem: 'Nilai $2 + 3$ ialah',
      options: ['4', '5', '6', '7'].map((text, i) => ({ id: 'ABCD'[i]!, text })),
      marks: 1,
      scheme: { kind: 'option', marks: 1, correct: 'B', reason: '2 + 3 = 5' },
    }
    const { w, emitted } = await mountEditor(server, q)
    const labels = w.findAll('[data-testid="q-unit"] option').map((o) => o.text())
    expect(labels).toEqual(['Pilih unit', 'T4 - 3.0 Fungsi Kuadratik', 'T5 - 3.0 Kebarangkalian'])
    expect(labels.join()).not.toContain('MAT-T4')

    // the same code in two forms is told apart by the form
    await w.get('[data-testid="q-unit"]').setValue('T5:3.0')
    const tagged = emitted.at(-1)!
    expect(tagged.tag).toMatchObject({ unit: '3.0', unitLabel: 'Kebarangkalian', level: 'T5', formOrigin: 'T5' })

    const batch = { questions: [{ ...tagged, tag: { ...tagged.tag, sp: ['3.1.1'] } }], stimuli: [], source: 'Latihan fiksyen', copyright: 'sendiri' } as never
    expect(validateBatch(batch).filter((i) => /unit/i.test(i.message))).toEqual([])
    // and the unit is one of the served units, which is what the server gate (unitNotInTaxonomy) checks
    expect(unitsFromStudio('MAT', 'T5', T5).map((u) => u.code)).toContain(tagged.tag.unit)
    w.unmount()
  })

  it('says so when the unit list cannot be loaded', async () => {
    const { server } = httpServer()
    const failing = Object.assign(Object.create(server), { dskpUnits: () => Promise.reject(new Error('x')) })
    const { w } = await mountEditor(failing, blankQuestion('MAT', 1))
    expect(w.get('[data-testid="q-unit-error"]').text()).toBe('Senarai unit tidak dapat dimuatkan.')
    w.unmount()
  })
})

describe('REQ-B-016 review page never says ready while the server refused', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  })
  afterEach(() => {
    setBijakServerForTests(null)
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('shows the server issues and replaces the ready banner', async () => {
    const server = new BijakServer({ storage: new MemoryStorage() })
    const b = await server.createManualBatch(1, {
      subject: 'MAT', kertas: 2, year: 2026, paperType: 'Soalan Umum', source: 'Latihan sekolah fiksyen', copyright: 'sendiri', notes: '',
    })
    const q = b.questions[0]!
    await server.saveExtracted(b.id, {
      stimuli: [],
      questions: [
        {
          ...q,
          type: 'mcq',
          stem: 'Nilai $2 + 3$ ialah',
          options: ['4', '5', '6', '7'].map((text, i) => ({ id: 'ABCD'[i]!, text })),
          marks: 1,
          scheme: { kind: 'option', marks: 1, correct: 'B', reason: '2 + 3 = 5' },
          tag: { subject: 'MAT', level: 'T4', unit: 'MAT-T4-02', unitLabel: 'Asas Nombor', sp: ['02.1'], tp: 2, formOrigin: 'T4' },
        },
      ],
    })
    server.submitForReview = () =>
      Promise.resolve({ ok: false, issues: [{ questionId: q.id, where: 'Soalan 1', message: 'Unit DSKP tiada dalam senarai kurikulum.' }] })
    setBijakServerForTests(server)
    const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }, ...adminPaperRoutes, ...adminIntakeRoutes] })
    await router.push('/')
    const w = mount(IntakeReviewPage, { props: { batchId: b.id }, attachTo: document.body, global: { plugins: [router] } })
    await flushPromises()
    expect(w.get('[data-testid="issues-toggle"]').text()).toContain('Semua semakan kualiti lulus. Sedia dihantar.')

    await w.get('[data-testid="submit-review"]').trigger('click')
    await flushPromises()
    expect(w.get('[data-testid="server-issues"]').text()).toContain('Unit DSKP tiada dalam senarai kurikulum.')
    const toggle = w.get('[data-testid="issues-toggle"]').text()
    expect(toggle).not.toContain('Sedia dihantar')
    expect(toggle).toContain('Pelayan menolak 1 perkara')
    w.unmount()
  })
})
