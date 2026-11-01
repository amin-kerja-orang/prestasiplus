// @vitest-environment jsdom
// REQ-A-004 Kontrak rows (K1, K4, K6, K7, K8, K9, K10): V2 labels (cloud-student-mechanism 3.4,
// BIJAK-SPM-cloud P4). K3 (duplicate guard wording) stays the V3 text approved by D92(3).
import { flushPromises, mount } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { DsRowActions, type RowAction } from '@/ds'
import { useFlashStore } from '@/stores/flash'

import SharedBanner from '../admin/kontrak/components/SharedBanner.vue'
import { formFromView, toInput } from '../admin/kontrak/domain/form'
import KontrakEditorPage from '../admin/kontrak/pages/KontrakEditorPage.vue'
import KontrakListPage from '../admin/kontrak/pages/KontrakListPage.vue'
import { setKontrakServerForTests } from '../admin/kontrak/server/client'
import { MockKontrakServer } from '../admin/kontrak/server/memory'
import adminKontrakRoutes from '../routes/admin-kontrak'

describe('K9 banner', () => {
  it('list wording: title, per-subject warning and SEMUA', () => {
    const w = mount(SharedBanner, { props: { scope: 'list' } })
    const t = w.get('[data-testid="kontrak-shared-banner"]').text()
    expect(t).toContain('Kontrak dikongsi.')
    expect(t).toContain('Setiap kontrak di bawah ialah peraturan bagi satu subjek × kertas — bukan satu set soalan.')
    expect(t).toContain('untuk SEMUA kertas subjek tersebut, bukan hanya satu kertas.')
  })
  it('editor wording omits the list sentence', () => {
    const t = mount(SharedBanner, { props: { scope: 'editor' } }).text()
    expect(t).toContain('Kontrak dikongsi.')
    expect(t).not.toContain('Setiap kontrak di bawah')
    expect(t).toContain('Menyunting kontrak ini mengubah pintu terbitan (publish gate)')
  })
})

describe('V2 labels in the Kontrak screens (mounted on the mock)', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {} }))
  })
  afterEach(() => {
    setKontrakServerForTests(null)
    vi.unstubAllGlobals()
    document.body.innerHTML = ''
  })

  const server = (): MockKontrakServer => new MockKontrakServer({ createPaper: () => Promise.resolve('paper-1') })
  async function router(path: string) {
    const r = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { template: '<i/>' } }, ...adminKontrakRoutes] })
    await r.push(path)
    await r.isReady()
    return r
  }

  it('list: heading (K1), "Baharu" opens "Kontrak Baharu" (K1)', async () => {
    setKontrakServerForTests(server())
    const r = await router('/admin/spm/kontrak')
    const w = mount(KontrakListPage, { attachTo: document.body, global: { plugins: [r] } })
    await flushPromises()
    expect(w.get('[data-testid="kontrak-list-heading"]').text()).toBe('Senarai Kontrak')
    expect(w.get('[data-testid="kontrak-add"]').text()).toBe('Baharu')
    await w.get('[data-testid="kontrak-add"]').trigger('click')
    await flushPromises()
    expect(document.body.textContent).toContain('Kontrak Baharu')
    w.unmount()
  })

  it('list: the V2 empty state when there is no contract (K10)', async () => {
    const s = server()
    s.list = () => Promise.resolve([])
    setKontrakServerForTests(s)
    const r = await router('/admin/spm/kontrak')
    const w = mount(KontrakListPage, { attachTo: document.body, global: { plugins: [r] } })
    await flushPromises()
    expect(w.text()).toContain('Tiada kontrak lagi. Cipta kontrak pertama menggunakan butang "Baharu" di atas.')
    w.unmount()
  })

  it('list: Padam kontrak asks the K8 confirmation and flashes "Kontrak dipadam."', async () => {
    const s = server()
    const rows = await s.list()
    const row = rows.find((v) => v.dependentPaperCount === 0)!
    expect(row).toBeTruthy()
    const retire = vi.fn().mockResolvedValue(undefined)
    s.retire = retire
    setKontrakServerForTests(s)
    const r = await router('/admin/spm/kontrak')
    const w = mount(KontrakListPage, { attachTo: document.body, global: { plugins: [r] } })
    await flushPromises()
    // The danger action lives in the row menu (a popper, not rendered until opened): read it from the real row.
    const acts = w.findAllComponents(DsRowActions).flatMap((c) => c.props('actions') as RowAction[])
    const padam = acts.find((x) => x.testid === `retire-${row.subject}-${row.kertas}`)
    expect(padam).toBeTruthy()
    expect(padam!.label).toBe('Padam kontrak')
    const confirm = padam!.confirm as { title?: string; body?: string; confirmLabel?: string }
    expect(confirm.title).toBe('Padam kontrak ini?')
    expect(confirm.body).toContain('Semua Bahagian kontrak turut dipadam.')
    expect(confirm.confirmLabel).toBe('Padam')
    void padam!.onSelect?.()
    await flushPromises()
    expect(retire).toHaveBeenCalledWith(row.subject, row.kertas)
    expect(useFlashStore().current?.message).toBe('Kontrak dipadam.')
    w.unmount()
  })

  it('editor: V2 field labels (K4, K6)', async () => {
    const s = server()
    setKontrakServerForTests(s)
    const r = await router('/admin/spm/kontrak/MAT/2')
    const w = mount(KontrakEditorPage, { attachTo: document.body, global: { plugins: [r] } })
    await flushPromises()
    const t = w.text()
    for (const l of ['Kod Kertas', 'Jumlah Markah', 'Sumber', 'Padam kontrak']) expect(t).toContain(l)
    expect(t).not.toContain('Kontrak berjaya disimpan.')
    w.unmount()
  })

  it('save flashes "Kontrak dikemas kini." (K7)', async () => {
    const s = server()
    setKontrakServerForTests(s)
    const r = await router('/admin/spm/kontrak/MAT/2')
    const w = mount(KontrakEditorPage, { attachTo: document.body, global: { plugins: [r] } })
    await flushPromises()
    await w.get('form').trigger('submit')
    await flushPromises()
    await flushPromises()
    expect(useFlashStore().current?.message).toBe('Kontrak dikemas kini.')
    w.unmount()
  })

  it('route title (K1) and the kept K3 wording (D92(3))', async () => {
    const route = adminKontrakRoutes.find((x) => x.meta?.header)
    expect(route?.meta?.header).toMatchObject({ title: 'Kontrak Simulasi' })
    const s = server()
    const v = await s.get('SN', 2)
    const { sections, code, durationMin } = toInput(formFromView(v))
    await expect(s.create({ subject: 'SN', kertas: 2, code, durationMin, sections })).rejects.toThrow(/sudah wujud/)
  })
})
