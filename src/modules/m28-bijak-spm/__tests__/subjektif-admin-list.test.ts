// @vitest-environment jsdom
// S3-T06 admin UI: Kertas Subjektif list (PRD30 Q-18, FR-ADM-Q18.1, FR-ADM-Q18.3, FR-ADM-Q18.4, fields 18-01..18-08, 18-11).
import { BIJAK_BUILDER_MESSAGES as M } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { useFlashStore } from '@/stores/flash'
import { acceptConfirm, confirmHost, confirmState, settleConfirm } from '@/ds/useConfirm'

import SubjektifPaperListPage from '../admin/papers/SubjektifPaperListPage.vue'
import { setBuilderServerForTests } from '../admin/builder/server/client'
import { MockBuilderServer } from '../admin/builder/server/memory'
import { SUBJEKTIF_ROUTES } from '../admin/papers/ui'

/** The row menu is a Reka dropdown; the stub lists its items as buttons that run the real `onSelect` (so DsRowActions' confirm is exercised). */
const MenuStub = defineComponent({
  props: { items: { type: Array, default: () => [] } },
  setup(props, { slots }) {
    return () =>
      h('div', [
        slots.default?.(),
        ...(props.items as Record<string, unknown>[][]).flat().map((i) =>
          h('button', { 'data-testid': i['data-testid'] as string, onClick: () => (i.onSelect as () => void)() }, String(i.label)),
        ),
      ])
  },
})

let wrapper: VueWrapper | null = null
let api: MockBuilderServer

async function render(): Promise<VueWrapper> {
  const stub = { template: '<i/>' }
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/', name: SUBJEKTIF_ROUTES.list, component: stub },
      { path: '/d/:id', name: SUBJEKTIF_ROUTES.detail, component: stub },
    ],
  })
  await router.push('/')
  wrapper = mount(SubjektifPaperListPage, {
    global: { plugins: [router], stubs: { UDropdownMenu: MenuStub, DropdownMenu: MenuStub } },
    attachTo: document.body,
  })
  await flushPromises()
  return wrapper
}

const flashNow = () => useFlashStore().current

beforeEach(() => {
  setActivePinia(createPinia())
  vi.stubGlobal('matchMedia', (query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }))
  api = new MockBuilderServer()
  setBuilderServerForTests(api)
  confirmHost.count = 1
})

afterEach(() => {
  settleConfirm(false)
  confirmHost.count = 0
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  setBuilderServerForTests(null)
  vi.unstubAllGlobals()
})

const body = (): HTMLElement => document.body
const byTid = (id: string): HTMLElement | null => body().querySelector(`[data-testid="${id}"]`)
async function click(id: string): Promise<void> {
  const el = byTid(id)
  if (!el) throw new Error(`missing ${id}`)
  el.click()
  await flushPromises()
}
async function fill(id: string, value: string): Promise<void> {
  const el = byTid(id) as HTMLInputElement | HTMLSelectElement | null
  if (!el) throw new Error(`missing ${id}`)
  el.value = value
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }))
  await flushPromises()
}

describe('Kertas Subjektif list (FR-ADM-Q18.1)', () => {
  it('shows the three tiles from meta.counts and the columns', async () => {
    await render()
    const text = body().textContent ?? ''
    for (const t of ['Jumlah Kertas', 'Diterbitkan', 'Ada Skema']) expect(text).toContain(t)
    const heads = [...body().querySelectorAll('th')].map((t) => t.textContent?.trim())
    expect(heads).toEqual(['Tajuk', 'Subjek', 'Kertas', 'Negeri', 'Tahun', 'Kandungan', 'Status', 'Tindakan'])
    const tiles = (await api.listSubjektif()).counts
    expect(tiles).toEqual({ total: 3, published: 2, withScheme: 1 })
  })

  it('renders K2, the Negeri name, "{q} soalan" / "{q} soalan, {s} bersekema", the tiada skema badge and "—" for Tempoh 0 or null', async () => {
    await render()
    const r1 = byTid('sj-table')!.textContent ?? ''
    expect(r1).toContain('K2')
    expect(r1).toContain('Selangor')
    expect(r1).toContain('2 soalan, 2 bersekema')
    expect(r1).toContain('2 soalan, 1 bersekema')
    expect(r1).toContain('0 soalan')
    // sj-2 has Tempoh null and sj-3 has 0; sj-1 has 150.
    expect(r1.match(/Tempoh \(minit\): —/g)).toHaveLength(2)
    expect(r1).toContain('Tempoh (minit): 150')
    // Only the paper with an unschemed question carries the badge (s < q); the empty draft has 0 < 0 false.
    expect(r1.match(/tiada skema/g)).toHaveLength(1)
  })

  it('filters by Kertas and Status with Tapis; an empty result reads "Tiada kertas sepadan penapis."', async () => {
    await render()
    expect(body().textContent).toContain('Semua Subjek')
    expect(body().textContent).toContain('Semua Kertas')
    expect(body().textContent).toContain('Semua Status')
    await fill('sj-filter-kertas', '3')
    ;(body().querySelector('[data-ds=filter-bar]') as HTMLFormElement).requestSubmit()
    await flushPromises()
    expect(byTid('sj-table')!.textContent).toContain('Sains Kertas 3')
    expect(byTid('sj-table')!.textContent).not.toContain('Bahasa Melayu Kertas 2')
    await fill('sj-filter-status', 'terbit')
    ;(body().querySelector('[data-ds=filter-bar]') as HTMLFormElement).requestSubmit()
    await flushPromises()
    expect(body().textContent).toContain('Tiada kertas sepadan penapis.')
  })
})

describe('Baharu form (fields 18-02..18-08)', () => {
  it('shows each field error on an empty submit, with the 18-xx messages', async () => {
    await render()
    await click('sj-new')
    expect(byTid('sj-f-title')!.getAttribute('placeholder')).toBe('Contoh: Bahasa Melayu Kertas 2')
    expect(body().textContent).toContain('Tiada subjek')
    await click('sj-f-submit')
    const text = body().textContent ?? ''
    for (const m of [M.subjektifTitleRequired, M.subjectRequired, M.kertasInvalid, M.examBoardRequired, M.yearRequired, M.totalMarksRange])
      expect(text).toContain(m)
  })

  it('shows the duration range error and keeps the dialog open', async () => {
    await render()
    await click('sj-new')
    await fill('sj-f-duration', '301')
    await click('sj-f-submit')
    expect(body().textContent).toContain(M.durationRange)
    expect(byTid('sj-form')).not.toBeNull()
  })

  it('shows the 422 fields of the server', async () => {
    await render()
    const { BuilderError } = await import('../admin/builder/server/api')
    vi.spyOn(api, 'createSubjektif').mockRejectedValue(new BuilderError('invalid', M.yearRequired, { fields: { year: M.yearRequired } }))
    await click('sj-new')
    await fill('sj-f-title', 'Bahasa Melayu Kertas 2 Contoh')
    await fill('sj-f-subject', 'BM')
    await fill('sj-f-kertas', '2')
    await fill('sj-f-negeri', 'selangor')
    await fill('sj-f-year', '2025')
    await fill('sj-f-marks', '40')
    await click('sj-f-submit')
    expect(body().textContent).toContain(M.yearRequired)
  })

  it('creates a draft and flashes "“{title}” telah dicipta sebagai draf."', async () => {
    await render()
    await click('sj-new')
    await fill('sj-f-title', 'Kimia Kertas 3 Contoh')
    await fill('sj-f-subject', 'SN')
    await fill('sj-f-kertas', '3')
    await fill('sj-f-negeri', 'johor')
    await fill('sj-f-year', '2025')
    await fill('sj-f-marks', '50')
    await click('sj-f-submit')
    expect(flashNow()).toMatchObject({ type: 'success', message: '“Kimia Kertas 3 Contoh” telah dicipta sebagai draf.' })
    expect(byTid('sj-form')).toBeNull()
    expect(byTid('sj-table')!.textContent).toContain('Kimia Kertas 3 Contoh')
  })

  it('Sunting saves and flashes "telah dikemas kini"', async () => {
    await render()
    await click('sj-edit-sj-3')
    await fill('sj-f-title', 'Sains Kertas 3 Disunting')
    await click('sj-f-submit')
    expect(flashNow()?.message).toBe('“Sains Kertas 3 Disunting” telah dikemas kini.')
  })
})

describe('row menu (18-11, FR-ADM-Q18.3)', () => {
  it('offers Pratonton, Sunting, Kandungan, Sembunyikan or Terbit, and Padam', async () => {
    await render()
    for (const id of ['sj-preview-sj-1', 'sj-edit-sj-1', 'sj-content-sj-1', 'sj-toggle-sj-1', 'sj-delete-sj-1']) expect(byTid(id)).not.toBeNull()
    expect(byTid('sj-toggle-sj-1')!.textContent).toBe('Sembunyikan')
    expect(byTid('sj-toggle-sj-3')!.textContent).toBe('Terbit')
  })

  it('Pratonton reads the student view of the paper', async () => {
    await render()
    const spy = vi.spyOn(api, 'studentView')
    await click('sj-preview-sj-1')
    expect(spy).toHaveBeenCalledWith('sj-1')
    await expect(spy.mock.results[0]!.value).resolves.toMatchObject({ title: 'Bahasa Melayu Kertas 2 - Percubaan Contoh', questionCount: 2 })
  })

  it('Sembunyikan then Terbit flash the V2 lines', async () => {
    await render()
    await click('sj-toggle-sj-1')
    expect(flashNow()?.message).toBe('“Bahasa Melayu Kertas 2 - Percubaan Contoh” disembunyikan daripada pelajar.')
    await click('sj-toggle-sj-1')
    expect(flashNow()).toMatchObject({ type: 'success', message: '“Bahasa Melayu Kertas 2 - Percubaan Contoh” kini diterbitkan.' })
  })

  it('shows a publish refusal verbatim from the server blockers', async () => {
    await render()
    await click('sj-toggle-sj-3')
    expect(flashNow()).toMatchObject({
      type: 'error',
      message: '“Sains Kertas 3 - Percubaan Contoh” tiada kandungan — tidak boleh diterbitkan.',
    })
    vi.spyOn(api, 'publish').mockResolvedValue({ ok: false, errors: ['Jumlah markah (40) mesti sama dengan jumlah markah bahagian (30).'], blockerDetails: [], canOverride: false })
    await click('sj-toggle-sj-3')
    expect(flashNow()?.message).toBe('Jumlah markah (40) mesti sama dengan jumlah markah bahagian (30).')
  })

  it('Padam asks "Padam kertas ini?" with Batal / Ya, Padam; Batal deletes nothing, Ya, Padam flashes "telah dipadam"', async () => {
    await render()
    await click('sj-delete-sj-3')
    expect(confirmState).toMatchObject({ open: true, title: 'Padam kertas ini?', confirmLabel: 'Ya, Padam', cancelLabel: 'Batal' })
    settleConfirm(false)
    await flushPromises()
    expect((await api.listSubjektif()).total).toBe(3)

    await click('sj-delete-sj-3')
    await acceptConfirm()
    await flushPromises()
    expect(flashNow()?.message).toBe('“Sains Kertas 3 - Percubaan Contoh” telah dipadam.')
    expect((await api.listSubjektif()).total).toBe(2)
  })
})
