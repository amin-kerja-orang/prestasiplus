// @vitest-environment jsdom
import { IntakeBatchCreateSchema } from '@pp/contract'
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Component } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

const createIntakeBatch = vi.fn()
vi.mock('../server/client', async (orig) => {
  const actual = await orig<typeof import('../server/client')>()
  return {
    ...actual,
    bijakAdminServer: () => {
      const real = actual.bijakAdminServer()
      return new Proxy(real, { get: (t, k, r) => (k === 'createIntakeBatch' ? createIntakeBatch : Reflect.get(t, k, r)) })
    },
  }
})

import IntakeManualPage from '../admin/intake/pages/IntakeManualPage.vue'
import IntakeUploadPage from '../admin/intake/pages/IntakeUploadPage.vue'
import { toIntakeKertas } from '../admin/intake/types'
import adminIntakeRoutes from '../routes/admin-intake'
import { batchCreateToWire } from '../server/intake-wire'

async function render(page: Component, path = '/') {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/', component: { template: '<i/>' } }, ...adminIntakeRoutes],
  })
  await router.push(path)
  const w = mount(page, { attachTo: document.body, global: { plugins: [router] } })
  await flushPromises()
  return w
}

describe('intake Kertas 1..4 (S1-T03)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    createIntakeBatch.mockReset()
    createIntakeBatch.mockResolvedValue({ id: 'b1' })
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: false,
      media: query,
      addEventListener() {},
      removeEventListener() {},
    }))
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  it('toIntakeKertas accepts 1..4 and falls back otherwise', () => {
    for (const n of [1, 2, 3, 4]) expect(toIntakeKertas(String(n))).toBe(n)
    expect(toIntakeKertas('5')).toBe(2)
    expect(toIntakeKertas(undefined, 1)).toBe(1)
  })

  it('the upload form offers Kertas 1 to 4', async () => {
    const w = await render(IntakeUploadPage)
    const opts = w.findAll('[data-testid="intake-kertas"] option').map((o) => o.text())
    expect(opts).toEqual(['Kertas 1', 'Kertas 2', 'Kertas 3', 'Kertas 4'])
    w.unmount()
  })

  it('the manual form offers Kertas 1 to 4 and pre-fills Kertas 3 from the query', async () => {
    const w = await render(IntakeManualPage, '/?kertas=3')
    const sel = w.find('[data-testid="intake-kertas"]')
    expect(sel.findAll('option').map((o) => o.text())).toContain('Kertas 4')
    expect((sel.element as HTMLSelectElement).value).toBe('3')
    w.unmount()
  })

  it.each([3, 4])('the upload form sends kertas %i through the client', async (k) => {
    const w = await render(IntakeUploadPage)
    await w.find('[data-testid="intake-kertas"]').setValue(String(k))
    await w.find('[data-testid="intake-source"]').setValue('Sekolah')
    await w.find('[data-testid="intake-copyright"]').setValue('sendiri')
    // The sample path asks for the source declaration as submit does (S2-T02).
    await w.find('[data-testid="intake-declaration"]').trigger('click')
    await w.find('[data-testid="intake-sample"]').trigger('click')
    await vi.waitFor(() => expect(createIntakeBatch).toHaveBeenCalledTimes(1), { timeout: 5000 })
    expect(createIntakeBatch.mock.calls[0]![1]).toMatchObject({ kertas: k })
    w.unmount()
  })

  it.each([3, 4] as const)('the wire body carries kertas %i and passes the contract', (k) => {
    const body = batchCreateToWire({
      subject: 'MAT',
      kertas: k,
      year: 2025,
      paperType: 'Percubaan',
      source: 'Sekolah',
      copyright: 'sendiri',
      notes: '',
    })
    expect(body.kertas).toBe(k)
    expect(IntakeBatchCreateSchema.safeParse(body).success).toBe(true)
  })
})
