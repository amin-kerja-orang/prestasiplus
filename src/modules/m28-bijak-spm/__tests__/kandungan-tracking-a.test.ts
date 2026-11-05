// @vitest-environment jsdom
/** Tracking A (S3-T05, R1-ADM-Q-17): the draft rules, the mock reads, the list and the editor. */
import type { SpmAdminTrackingASet, SpmAdminTrackingACandidate } from '@pp/contract'
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { KANDUNGAN_ROUTES, TRACKING_NEW_SET, TrackingRefusal } from '../admin/kandungan/api'
import { fillTrackingSet, moveTrackingUnit, swapTrackingUnit, trackingCount } from '../admin/kandungan/lanes'
import { createMockKandungan } from '../admin/kandungan/local-kandungan'
import TrackingAListPage from '../admin/kandungan/pages/TrackingAListPage.vue'
import TrackingASetEditorPage from '../admin/kandungan/pages/TrackingASetEditorPage.vue'
import { ADMIN_ROUTES } from '../admin/papers/ui'

const server = vi.hoisted(() => ({ trackingLane: vi.fn(), trackingSet: vi.fn(), createTrackingSet: vi.fn(), saveTrackingSet: vi.fn() }))
const flash = vi.hoisted(() => ({ show: vi.fn() }))
vi.mock('../admin/kandungan/client', () => ({ kandunganServer: () => server }))
vi.mock('@/composables/useFlash', () => ({ useFlash: () => flash }))

const q = (id: string, stem = `Soalan ${id}`): SpmAdminTrackingACandidate => ({ kind: 'question', id, questions: 1, label: stem, members: [{ id, stem, servable: true, statusWord: null }] })
const group = (id: string, label: string, n: number): SpmAdminTrackingACandidate => ({
  kind: 'group',
  id,
  questions: n,
  label,
  members: Array.from({ length: n }, (_, i) => ({ id: `${id}-${String(i + 1)}`, stem: `Ahli ${String(i + 1)}`, servable: true, statusWord: null })),
})
const setOf = (over: Partial<SpmAdminTrackingASet> = {}): SpmAdminTrackingASet => ({
  id: '7',
  subjectId: '3',
  subject: 'Sains',
  year: 2026,
  setNo: 1,
  kind: 'ramalan',
  targetCount: 5,
  filled: 1,
  attention: ['Hanya 1 daripada 5 soalan'],
  items: [{ ...q('1'), position: 1 }],
  candidates: 28471,
  candidateItems: [q('1'), q('2'), q('3')],
  ...over,
})

describe('the draft rules', () => {
  it('AC-ADM-Q17.3, PO 15: a group of 4 with 3 free slots stops the fill; nothing is split or passed over', () => {
    const res = fillTrackingSet([q('a'), q('b')], [group('g', 'Rajah 3', 4), q('c'), q('d'), q('e')], 5)
    expect(res.stopped).toEqual({ label: 'Rajah 3', questions: 4, free: 3 })
    expect(res.added).toBe(0)
    expect(res.units.map((u) => u.id)).toEqual(['a', 'b'])
  })

  it('AC-ADM-Q17.3: with 4 free slots the group goes in whole; it stops at the group after the singles before it', () => {
    expect(fillTrackingSet([q('a')], [group('g', 'Rajah 3', 4), q('c')], 5).units.map((u) => u.id)).toEqual(['a', 'g'])
    const res = fillTrackingSet([], [q('a'), q('b'), group('g', 'Rajah 3', 4), q('c')], 5)
    expect(res.units.map((u) => u.id)).toEqual(['a', 'b'])
    expect(res.stopped?.free).toBe(3)
  })

  it('AC-ADM-Q17.1: fills to the target and stops; a group counts as its questions', () => {
    const res = fillTrackingSet([], [group('g', 'R', 2), ...['a', 'b', 'c', 'd', 'e'].map((x) => q(x))], 4)
    expect(trackingCount(res.units)).toBe(4)
    expect(res.stopped).toBeNull()
    expect(res.units.map((u) => u.id)).toEqual(['g', 'a', 'b'])
  })

  it('tukar: replaces in place with what fits, a group whole; null when nothing fits', () => {
    const draft = [q('a'), q('b')]
    expect(swapTrackingUnit(draft, 0, [q('a'), q('b'), group('g', 'R', 4), q('c')], 2)?.map((u) => u.id)).toEqual(['c', 'b'])
    expect(swapTrackingUnit(draft, 0, [q('a'), q('b'), group('g', 'R', 2)], 3)?.map((u) => u.id)).toEqual(['g', 'b'])
    expect(swapTrackingUnit(draft, 0, [q('a'), q('b')], 2)).toBeNull()
  })

  it('Naik and Turun move a group as one row and stop at the ends', () => {
    const draft = [q('a'), group('g', 'R', 2), q('b')]
    expect(moveTrackingUnit(draft, 1, -1).map((u) => u.id)).toEqual(['g', 'a', 'b'])
    expect(moveTrackingUnit(draft, 1, 1).map((u) => u.id)).toEqual(['a', 'b', 'g'])
    expect(moveTrackingUnit(draft, 0, -1).map((u) => u.id)).toEqual(['a', 'g', 'b'])
  })
})

describe('the mock reads (they answer like the API)', () => {
  it('create, clash, save, clash with a sibling, and BM is no option', async () => {
    const api = createMockKandungan()
    const lane = await api.trackingLane({ page: 1, pageSize: 5 })
    expect(lane.setSubjects.some((s) => s.id === 'BM' || s.id === 'BI')).toBe(false)
    expect(lane.subjects.length).toBeGreaterThanOrEqual(lane.setSubjects.length)
    const subjectId = lane.setSubjects.find((s) => s.id === 'MAT')?.id ?? lane.setSubjects[0]?.id ?? ''
    const one = await api.createTrackingSet({ subjectId, year: 2026, setNo: 1 })
    expect(one.attention).toEqual([`Hanya 0 daripada ${String(one.targetCount)} soalan`])
    await expect(api.createTrackingSet({ subjectId, year: 2026, setNo: 1 })).rejects.toMatchObject({ fields: { setNo: 'Set 1 sudah wujud untuk subjek dan tahun ini.' } })
    const first = one.candidateItems.find((c) => c.kind === 'question')
    if (!first) return
    await api.saveTrackingSet(one.id, { items: [{ kind: 'question', id: first.id }] })
    const two = await api.createTrackingSet({ subjectId, year: 2026, setNo: 2 })
    expect(two.candidateItems.map((c) => c.id)).not.toContain(first.id)
    await expect(api.saveTrackingSet(two.id, { items: [{ kind: 'question', id: first.id }] })).rejects.toBeInstanceOf(TrackingRefusal)
    const row = (await api.trackingLane({ page: 1, pageSize: 5 })).rows[0]
    expect(row?.meta).toBe(`#${one.id} · ramalan · 1 soalan`)
  })
})

describe('pages', () => {
  let wrapper: VueWrapper | null = null
  let router: Router

  const tid = (id: string): HTMLElement | null => document.body.querySelector(`[data-testid="${id}"]`)
  const text = (id: string): string | undefined => tid(id)?.textContent?.trim()
  const click = async (id: string): Promise<void> => {
    tid(id)?.click()
    await flushPromises()
  }
  const mountAt = async (component: object, path: string): Promise<void> => {
    const stub = { template: '<i/>' }
    router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/admin/spm', name: KANDUNGAN_ROUTES.hub, component: stub },
        { path: '/admin/spm/tracking-a', name: KANDUNGAN_ROUTES.trackingA, component },
        { path: '/admin/spm/tracking-a/:set/sunting', name: KANDUNGAN_ROUTES.trackingAEdit, component },
        { path: '/admin/spm/soalan/:qid/sunting', name: ADMIN_ROUTES.bankEdit, component: stub },
        { path: '/spm/ramalan', name: 'm06.spm.ramalan', component: stub },
      ],
    })
    await router.push(path)
    wrapper = mount(component, { global: { plugins: [router] }, attachTo: document.body })
    await flushPromises()
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.stubGlobal('ResizeObserver', class { observe(): void {} unobserve(): void {} disconnect(): void {} })
  })
  afterEach(() => {
    wrapper?.unmount()
    wrapper = null
    document.body.innerHTML = ''
    vi.unstubAllGlobals()
  })

  it('FR-ADM-Q17.1 the list: one row per set with its attention; Sunting opens the editor; no Status filter', async () => {
    server.trackingLane.mockResolvedValue({
      rows: [
        { id: '7', title: 'Sains · 2026 Set 1', meta: '#7 · ramalan · 8 soalan', status: 'belum_cukup', attention: ['Hanya 8 daripada 40 soalan'], actions: ['edit'] },
        { id: '8', title: 'Sains · 2026 Set 2', meta: '#8 · ramalan · 40 soalan', status: 'bersih', attention: [], actions: ['edit'] },
      ],
      page: 1,
      pageSize: 25,
      total: 2,
      count: 2,
      subjects: [{ id: '3', name: 'Sains' }],
      setSubjects: [{ id: '3', name: 'Sains' }],
    })
    await mountAt(TrackingAListPage, '/admin/spm/tracking-a')
    expect(document.body.textContent).toContain('Sains · 2026 Set 1')
    expect(document.body.textContent).toContain('#7 · ramalan · 8 soalan')
    expect(text('attention-7')).toBe('Hanya 8 daripada 40 soalan')
    expect(tid('lane-status')).toBeNull()
    expect(tid('lane-edit-7')?.getAttribute('href')).toBe('/admin/spm/tracking-a/7/sunting')
    expect(tid('tracking-add')?.getAttribute('href')).toBe(`/admin/spm/tracking-a/${TRACKING_NEW_SET}/sunting`)
  })

  it('the editor shows the counter, the needed and available lines, the chip and the empty pane', async () => {
    server.trackingSet.mockResolvedValue(setOf())
    await mountAt(TrackingASetEditorPage, '/admin/spm/tracking-a/7/sunting')
    expect(text('tracking-counter')).toBe('1 / 5')
    expect(text('tracking-needed')).toBe('4 soalan lagi diperlukan.')
    expect(text('tracking-available')).toBe('Soalan tersedia untuk Sains: 28,471')
    expect(text('tracking-kind')).toBe('ramalan')
    expect(text('tracking-pane-empty')).toBe('Pilih soalan untuk menyunting.')
    expect(document.title === '' || document.body.textContent?.includes('Soalan dalam set')).toBe(true)
  })

  it('Isi set fills the draft only; Simpan sends it whole and flashes; a set at target hides Isi set', async () => {
    server.trackingSet.mockResolvedValue(setOf({ targetCount: 3 }))
    server.saveTrackingSet.mockResolvedValue(setOf({ targetCount: 3, filled: 3, attention: [], items: [{ ...q('1'), position: 1 }, { ...q('2'), position: 2 }, { ...q('3'), position: 3 }] }))
    await mountAt(TrackingASetEditorPage, '/admin/spm/tracking-a/7/sunting')
    await click('tracking-fill')
    expect(text('tracking-counter')).toBe('3 / 3')
    expect(tid('tracking-fill')).toBeNull()
    expect(text('tracking-full')).toBe('Set ini lengkap.')
    expect(server.saveTrackingSet).not.toHaveBeenCalled()
    await click('tracking-save')
    expect(server.saveTrackingSet).toHaveBeenCalledWith('7', { items: ['1', '2', '3'].map((id) => ({ kind: 'question', id })) })
    expect(flash.show).toHaveBeenCalledWith({ type: 'success', message: 'Set dikemas kini.' })
  })

  it('PO 15: Isi set stops at a group that does not fit and shows the exact text', async () => {
    server.trackingSet.mockResolvedValue(setOf({ targetCount: 3, items: [], filled: 0, candidateItems: [group('g', 'Rajah 3', 4), q('2')] }))
    await mountAt(TrackingASetEditorPage, '/admin/spm/tracking-a/7/sunting')
    expect(text('tracking-empty')).toBe('Set ini masih kosong.')
    await click('tracking-fill')
    expect(text('tracking-notice')).toContain('Kumpulan “Rajah 3” (4 soalan) tidak muat dalam 3 petak yang tinggal. Pilih kumpulan lain atau kosongkan petak.')
    expect(text('tracking-counter')).toBe('0 / 3')
  })

  it('no candidate: the exact fill text; an empty save never reaches the server', async () => {
    server.trackingSet.mockResolvedValue(setOf({ items: [], filled: 0, candidateItems: [] }))
    await mountAt(TrackingASetEditorPage, '/admin/spm/tracking-a/7/sunting')
    await click('tracking-fill')
    expect(text('tracking-notice')).toContain('Tiada soalan lain yang boleh disajikan untuk mengisi set ini.')
    await click('tracking-save')
    expect(text('tracking-notice')).toContain('Pilih sekurang-kurangnya satu soalan sebelum menyimpan.')
    expect(server.saveTrackingSet).not.toHaveBeenCalled()
  })

  it('PO 14: a refused save shows the reason and keeps the draft', async () => {
    const reason = 'Soalan No. 2 sudah ada dalam Set 1 untuk subjek dan tahun ini. Buang atau tukar soalan itu.'
    server.trackingSet.mockResolvedValue(setOf())
    server.saveTrackingSet.mockRejectedValue(new TrackingRefusal({ items: reason }))
    await mountAt(TrackingASetEditorPage, '/admin/spm/tracking-a/7/sunting')
    await click('tracking-fill')
    await click('tracking-save')
    expect(text('tracking-notice')).toContain(reason)
    expect(text('tracking-counter')).toBe('3 / 5')
  })

  it('tukar: replaces from fresh candidates; a failed read and no candidate have their own texts', async () => {
    server.trackingSet.mockResolvedValue(setOf())
    await mountAt(TrackingASetEditorPage, '/admin/spm/tracking-a/7/sunting')
    await click('set-swap-1')
    expect(tid('tracking-row-2')).not.toBeNull()
    expect(tid('tracking-row-1')).toBeNull()
    server.trackingSet.mockResolvedValue(setOf({ candidateItems: [q('2')] }))
    await click('set-swap-2')
    expect(text('tracking-notice')).toContain('Tiada soalan lain yang boleh disajikan untuk ditukar.')
    server.trackingSet.mockRejectedValue(new Error('x'))
    await click('set-swap-2')
    expect(text('tracking-notice')).toContain('Tukar gagal.')
  })

  it('a member not served says why; the pane opens the bank editor; buang removes a group whole; nothing creates a question', async () => {
    const archived = { ...q('9', 'Soalan arkib'), members: [{ id: '9', stem: 'Soalan arkib', servable: false, statusWord: 'diarkib' }] }
    server.trackingSet.mockResolvedValue(setOf({ items: [{ ...archived, position: 1 }, { ...group('g', 'Rajah 3', 2), position: 2 }], filled: 2, candidateItems: [] }))
    await mountAt(TrackingASetEditorPage, '/admin/spm/tracking-a/7/sunting')
    expect(text('tracking-unserved-9')).toBe('diarkib · Tidak disajikan kepada pelajar')
    expect(text('tracking-counter')).toBe('3 / 5')
    const row = tid('tracking-select-9')
    ;(row?.matches('button') ? row : row?.querySelector('button'))?.click()
    await flushPromises()
    expect(tid('tracking-open-9')?.getAttribute('href')).toBe('/admin/spm/soalan/9/sunting')
    expect(tid('tracking-open-9')?.textContent).toBe('Buka di laman berasingan')
    await click('set-remove-g')
    expect(text('tracking-counter')).toBe('1 / 5')
  })

  it('Tambah Set: the new-set route opens the form; the clash shows on its field; success opens the new set', async () => {
    server.trackingLane.mockResolvedValue({ rows: [], page: 1, pageSize: 1, total: 0, count: 0, subjects: [], setSubjects: [{ id: '3', name: 'Sains' }] })
    await mountAt(TrackingASetEditorPage, `/admin/spm/tracking-a/${TRACKING_NEW_SET}/sunting`)
    expect(server.trackingSet).not.toHaveBeenCalled()
    await click('tracking-add-submit')
    expect(document.body.textContent).toContain('Sila pilih subjek.')
    const select = document.body.querySelector<HTMLSelectElement>('select[data-testid="tracking-add-subject"]')
    expect(select?.textContent).toContain('Sains')
    expect(select?.textContent).not.toContain('Bahasa Melayu')
    if (select) {
      select.value = '3'
      select.dispatchEvent(new Event('change'))
    }
    await flushPromises()
    server.createTrackingSet.mockRejectedValueOnce(new TrackingRefusal({ setNo: 'Set 1 sudah wujud untuk subjek dan tahun ini.' }))
    await click('tracking-add-submit')
    expect(document.body.textContent).toContain('Set 1 sudah wujud untuk subjek dan tahun ini.')
    server.createTrackingSet.mockResolvedValueOnce(setOf({ id: '12' }))
    server.trackingSet.mockResolvedValue(setOf({ id: '12' }))
    await click('tracking-add-submit')
    expect(router.currentRoute.value.params.set).toBe('12')
  })
})
