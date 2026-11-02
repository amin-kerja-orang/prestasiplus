// @vitest-environment jsdom
// The Kontrak editor keeps its tab in `?paparan=`. Switching tabs must not reload the form, or a new contract can never be
// saved: its fields sit on different tabs and Simpan refuses while any tab has a problem. A change of subject or kertas must.
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import KontrakEditorPage from '../admin/kontrak/pages/KontrakEditorPage.vue'
import { setKontrakServerForTests } from '../admin/kontrak/server/client'
import { MockKontrakServer } from '../admin/kontrak/server/memory'
import adminKontrakRoutes from '../routes/admin-kontrak'

describe('Kontrak editor: tabs and the form', () => {
  let server: MockKontrakServer
  let wrapper: VueWrapper | undefined

  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
    server = new MockKontrakServer({ createPaper: () => Promise.resolve('paper-1') })
    setKontrakServerForTests(server)
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = undefined
    setKontrakServerForTests(null)
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  async function open(path: string): Promise<Router> {
    const r = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }, ...adminKontrakRoutes] })
    await r.push(path)
    await r.isReady()
    wrapper = mount(KontrakEditorPage, { attachTo: document.body, global: { plugins: [r] } })
    await flushPromises()
    return r
  }
  const go = async (r: Router, paparan: string): Promise<void> => {
    await r.push({ query: { ...r.currentRoute.value.query, paparan } })
    await flushPromises()
  }
  const field = (id: string): HTMLInputElement => wrapper!.get<HTMLInputElement>(`#${id}`).element

  it('a new contract keeps Kod Kertas when the tab changes and comes back', async () => {
    const r = await open('/admin/spm/kontrak/MAT/2?baharu=1')
    await wrapper!.get('#kontrak-umum-code').setValue('3472/2')

    await go(r, 'bahagian-1')
    await wrapper!.get('#kontrak-s0-m').setValue('7')
    await go(r, 'umum')
    expect(field('kontrak-umum-code').value).toBe('3472/2')

    await go(r, 'bahagian-1')
    expect(field('kontrak-s0-m').value).toBe('7')
  })

  it('an existing contract keeps an unsaved edit and is not fetched again on a tab change', async () => {
    const get = vi.spyOn(server, 'get')
    const r = await open('/admin/spm/kontrak/MAT/2')
    expect(get).toHaveBeenCalledTimes(1)
    await wrapper!.get('#kontrak-umum-code').setValue('EDITED/2')

    await go(r, 'bahagian-1')
    await go(r, 'umum')

    expect(field('kontrak-umum-code').value).toBe('EDITED/2')
    expect(get).toHaveBeenCalledTimes(1)
  })

  it('a real change of subject or kertas still reloads the form', async () => {
    const get = vi.spyOn(server, 'get')
    const r = await open('/admin/spm/kontrak/MAT/2')
    const first = field('kontrak-umum-code').value
    await wrapper!.get('#kontrak-umum-code').setValue('EDITED/2')

    await r.push('/admin/spm/kontrak/SN/2')
    await flushPromises()

    expect(get).toHaveBeenLastCalledWith('SN', 2)
    const reloaded = field('kontrak-umum-code').value
    expect(reloaded).not.toBe('EDITED/2')
    expect(reloaded).not.toBe(first)
  })
})
