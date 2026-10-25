// @vitest-environment jsdom
/**
 * DSKP-T07 (G4): `IntakeReviewPage` and `BankEditPage` do not judge the tag until the subject
 * catalogue is loaded. While it loads or after it failed, no tag issue is listed and submit stays
 * disabled, with the loading or error text in the gate line; once loaded, a complete question can be sent.
 */
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { ref } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'

import BankEditPage from '../admin/papers/BankEditPage.vue'
import IntakeReviewPage from '../admin/intake/pages/IntakeReviewPage.vue'
import { dskpSource } from '../lib/dskp-source'
import type { DskpSubjectState } from '../lib/dskp-source'
import { setBijakServerForTests } from '../server/client'
import { BijakServer, MemoryStorage } from '../server/store'
import { errorState, loadedState, loadingState, matTag } from './tag-fixtures'

const holder = vi.hoisted(() => ({ state: null as unknown as DskpSubjectState }))

vi.mock('../lib/use-bijak', async (orig) => ({
  ...(await orig<typeof import('../lib/use-bijak')>()),
  useBijakUser: () => ref(1),
}))
vi.mock('../lib/dskp-source', async (orig) => ({
  ...(await orig<typeof import('../lib/dskp-source')>()),
  useDskpSubject: () => holder.state,
}))

const stubs = { MathField: true, UDrawer: true, UModal: true, RouterLink: true }
const plugins = () => [
  createPinia(),
  createRouter({ history: createMemoryHistory(), routes: [{ path: '/:p(.*)*', component: { template: '<div />' } }] }),
]

afterEach(() => {
  setBijakServerForTests(null)
  document.body.innerHTML = ''
})
beforeAll(async () => {
  await dskpSource().load('MAT')
})

const set = (s: DskpSubjectState): void => {
  holder.state = s
}

async function reviewPage() {
  const server = new BijakServer({ storage: new MemoryStorage() })
  setBijakServerForTests(server)
  const batch = await server.createManualBatch(1, {
    subject: 'MAT',
    kertas: 2,
    year: 2025,
    paperType: 'Percubaan SPM',
    source: 'Sekolah',
    copyright: 'sendiri',
    notes: '',
  })
  const q = batch.questions[0]!
  await server.saveExtracted(batch.id, {
    questions: [
      {
        ...q,
        type: 'mcq',
        stem: 'Hitung $2 + 3$.',
        options: [
          { id: 'A', text: '5' },
          { id: 'B', text: '6' },
        ],
        marks: 1,
        scheme: { kind: 'option', marks: 1, correct: 'A', reason: 'Kunci' },
        tag: matTag({ tp: 3 }),
      },
    ],
    stimuli: [],
  })
  const w = mount(IntakeReviewPage, { props: { batchId: batch.id }, global: { stubs, plugins: plugins() } })
  await flushPromises()
  return w
}

describe('IntakeReviewPage: the gate while the catalogue loads', () => {
  it('loading: no tag issue, submit disabled, "Memuatkan..."', async () => {
    set(loadingState())
    const w = await reviewPage()
    expect(w.get('[data-testid="issues-toggle"]').text()).toBe('Memuatkan...')
    expect(w.get('[data-testid="submit-review"]').attributes('disabled')).toBeDefined()
  })

  it('error: no tag issue, submit disabled, the load error text', async () => {
    set(errorState())
    const w = await reviewPage()
    expect(w.get('[data-testid="issues-toggle"]').text()).toBe(
      'Tidak dapat memuatkan senarai DSKP bagi subjek ini. Sila cuba semula.',
    )
    expect(w.get('[data-testid="submit-review"]').attributes('disabled')).toBeDefined()
  })

  it('loaded: a complete question can be sent', async () => {
    set(await loadedState('MAT'))
    const w = await reviewPage()
    expect(w.get('[data-testid="issues-toggle"]').text()).toBe('Semua semakan kualiti lulus. Sedia dihantar.')
    expect(w.get('[data-testid="submit-review"]').attributes('disabled')).toBeUndefined()
  })
})

describe('BankEditPage: the gate while the catalogue loads', () => {
  async function editPage() {
    setBijakServerForTests(new BijakServer({ storage: new MemoryStorage() }))
    const w = mount(BankEditPage, { props: { qid: 'mat2-kuadratik-v1' }, global: { stubs, plugins: plugins() } })
    await flushPromises()
    return w
  }

  it('loading: submit disabled and the gate says "Memuatkan..."', async () => {
    set(loadingState())
    const w = await editPage()
    expect(w.get('[data-testid="edit-gate"]').text()).toContain('Memuatkan...')
    expect(w.get('[data-testid="edit-submit"]').attributes('disabled')).toBeDefined()
  })

  it('error: submit disabled and the gate carries the load error', async () => {
    set(errorState())
    const w = await editPage()
    expect(w.get('[data-testid="edit-gate"]').text()).toContain(
      'Tidak dapat memuatkan senarai DSKP bagi subjek ini. Sila cuba semula.',
    )
    expect(w.get('[data-testid="edit-submit"]').attributes('disabled')).toBeDefined()
  })

  it('loaded: a tagged question can be sent as a new version', async () => {
    set(await loadedState('MAT'))
    const w = await editPage()
    expect(w.get('[data-testid="edit-gate"]').text()).toContain('Semua semakan kualiti lulus')
    expect(w.get('[data-testid="edit-submit"]').attributes('disabled')).toBeUndefined()
  })
})
