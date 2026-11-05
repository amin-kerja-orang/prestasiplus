// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createMemoryHistory, createRouter, type Router } from 'vue-router'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import type { GuruSetList, QuestionSetRow } from '../../api/guru'
import type { GuruClass } from '../../api/types'
import SetSoalanGuruListPage from '../../pages/SetSoalanGuruListPage.vue'

/** R1-GUR-8b Screen A (list): AC-GUR-8b-1, 8b-2 (status), 8b-4 / 8b-13 (copy), 8b-6 (targets), 8b-8. */

const api = vi.hoisted(() => ({
  fetchGuruSets: vi.fn(),
  fetchGuruClasses: vi.fn(),
  setGuruSetStatus: vi.fn(),
  deleteGuruSet: vi.fn(),
  copyGuruSet: vi.fn(),
}))
vi.mock('../../api/guru', () => api)

const row = (id: string, extra: Partial<QuestionSetRow> = {}): QuestionSetRow => ({
  id,
  title: `Set ${id}`,
  status: 'draft',
  subjectId: '4',
  subjectName: 'Matematik',
  educationLevelId: null,
  questionCount: 5,
  siap: 2,
  classrooms: [],
  updatedAt: '2026-10-03T09:00:00+08:00',
  ...extra,
})
const sets = (rows: QuestionSetRow[]): GuruSetList => ({
  rows,
  counters: {
    published: rows.filter((r) => r.status === 'published').length,
    draft: rows.filter((r) => r.status === 'draft').length,
    participation: 7,
  },
  summary: { total: rows.length, siap: 0 },
})
const klass = (id: number, name: string): GuruClass =>
  ({ id: String(id) as unknown as number, name, isActive: true }) as GuruClass

let router: Router
let wrapper: VueWrapper | undefined
const settle = async (): Promise<void> => {
  await flushPromises()
  await new Promise((r) => setTimeout(r, 80))
  await flushPromises()
}
const dlg = <T extends HTMLElement>(selector: string): T | null => document.querySelector<T>(selector)

async function mountPage(): Promise<VueWrapper> {
  router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: '/guru/set-soalan', component: SetSoalanGuruListPage },
      { path: '/guru/set-soalan/cipta', component: { template: '<div />' } },
      { path: '/guru/set-soalan/:id', component: { template: '<div />' } },
      { path: '/guru/set-soalan/:id/keputusan', component: { template: '<div />' } },
    ],
  })
  await router.push('/guru/set-soalan')
  await router.isReady()
  wrapper = mount(SetSoalanGuruListPage, { global: { plugins: [router] }, attachTo: document.body })
  await flushPromises()
  return wrapper
}

beforeEach(() => {
  setActivePinia(createPinia())
  vi.clearAllMocks()
  api.fetchGuruClasses.mockResolvedValue({
    data: [klass(1, '5 Bestari'), klass(2, '5 Cekap')],
    meta: {},
  })
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = undefined
  vi.restoreAllMocks()
  document.body.innerHTML = ''
})

describe('R1-GUR-8b list', () => {
  it('shows the count, "Cipta Set Baru" and the three counters', async () => {
    api.fetchGuruSets.mockResolvedValue(sets([row('1'), row('2', { status: 'published' })]))
    const w = await mountPage()
    expect(w.get('[data-testid="set-count"]').text()).toBe('2 set soalan')
    const create = w.get('[data-testid="set-create"]')
    expect(create.text()).toBe('Cipta Set Baru')
    expect(create.attributes('href')).toBe('/guru/set-soalan/cipta')
    expect(create.classes()).toContain('min-h-11')
    expect(w.get('[data-testid="set-counter-published"]').text()).toContain('Diterbitkan')
    expect(w.get('[data-testid="set-counter-published"]').text()).toContain('1')
    expect(w.get('[data-testid="set-counter-draft"]').text()).toContain('Draf')
    expect(w.get('[data-testid="set-counter-participation"]').text()).toContain('Penyertaan')
    expect(w.get('[data-testid="set-counter-participation"]').text()).toContain('7')
  })

  it('shows the empty state with "Cipta Set Pertama"', async () => {
    api.fetchGuruSets.mockResolvedValue(sets([]))
    const w = await mountPage()
    const empty = w.get('[data-testid="set-empty"]')
    expect(empty.text()).toContain('Belum ada set soalan')
    expect(empty.text()).toContain('Cipta set soalan tersendiri dan kongsi dengan kelas anda.')
    expect(w.get('[data-testid="set-empty-create"]').text()).toBe('Cipta Set Pertama')
    expect(w.get('[data-testid="set-empty-create"]').attributes('href')).toBe('/guru/set-soalan/cipta')
  })

  it('AC-GUR-8b-1: a draft card shows title, status "Draf", subject, "{n} soalan" and "{n} siap"', async () => {
    api.fetchGuruSets.mockResolvedValue(sets([row('1', { title: 'Ujian 1' })]))
    const w = await mountPage()
    const card = w.get('[data-testid="set-card"]')
    expect(card.get('[data-testid="set-title"]').text()).toBe('Ujian 1')
    expect(card.get('[data-testid="set-status"]').text()).toBe('Draf')
    expect(card.get('[data-testid="set-subject"]').text()).toBe('Matematik')
    expect(card.get('[data-testid="set-questions"]').text()).toBe('5 soalan')
    expect(card.get('[data-testid="set-siap"]').text()).toBe('2 siap')
    expect(card.get('[data-testid="set-results"]').text()).toBe('Hasil')
    expect(card.get('[data-testid="set-results"]').attributes('href')).toBe('/guru/set-soalan/1/keputusan')
    expect(card.get('[data-testid="set-manage"]').text()).toBe('Urus →')
    expect(card.get('[data-testid="set-manage"]').attributes('href')).toBe('/guru/set-soalan/1')
    expect(card.get('[data-testid="set-copy"]').text()).toBe('Salin')
    expect(card.get('[data-testid="set-toggle"]').text()).toBe('Terbit')
    expect(card.get('[data-testid="set-delete"]').text()).toBe('Padam')
  })

  it('AC-GUR-8b-6: the action buttons are 44 px touch targets', async () => {
    api.fetchGuruSets.mockResolvedValue(sets([row('1')]))
    const w = await mountPage()
    for (const id of ['set-results', 'set-manage', 'set-copy', 'set-toggle', 'set-delete'])
      expect(w.get(`[data-testid="${id}"]`).classes(), id).toContain('min-h-11')
  })

  it('AC-GUR-8b-2: "Terbit" publishes (toast "Set diterbitkan."); a published card offers "Jadikan Draf"', async () => {
    api.fetchGuruSets.mockResolvedValue(sets([row('1')]))
    api.setGuruSetStatus.mockResolvedValue({})
    const w = await mountPage()
    api.fetchGuruSets.mockResolvedValue(sets([row('1', { status: 'published' })]))
    await w.get('[data-testid="set-toggle"]').trigger('click')
    await flushPromises()
    expect(api.setGuruSetStatus).toHaveBeenCalledWith('1', 'published')
    expect(useFlashStore().current?.message ?? useFlashStore().pending?.message).toBe('Set diterbitkan.')
    expect(w.get('[data-testid="set-status"]').text()).toBe('Diterbitkan')
    expect(w.get('[data-testid="set-toggle"]').text()).toBe('Jadikan Draf')

    api.fetchGuruSets.mockResolvedValue(sets([row('1')]))
    await w.get('[data-testid="set-toggle"]').trigger('click')
    await flushPromises()
    expect(api.setGuruSetStatus).toHaveBeenLastCalledWith('1', 'draft')
    expect(useFlashStore().current?.message ?? useFlashStore().pending?.message).toBe('Set dijadikan draf.')
  })

  it('AC-GUR-8b-8: "Terbit" of a set with no class shows the server message and the set stays "Draf"', async () => {
    api.fetchGuruSets.mockResolvedValue(sets([row('1')]))
    api.setGuruSetStatus.mockRejectedValue(
      new ApiError({
        status: 422,
        code: 'VALIDATION_ERROR',
        message: 'x',
        fields: { classroomIds: 'Pilih sekurang-kurangnya satu kelas sebelum menerbitkan.' },
      }),
    )
    const w = await mountPage()
    await w.get('[data-testid="set-toggle"]').trigger('click')
    await flushPromises()
    const flash = useFlashStore()
    expect((flash.current ?? flash.pending)?.message).toBe(
      'Pilih sekurang-kurangnya satu kelas sebelum menerbitkan.',
    )
    expect(w.get('[data-testid="set-status"]').text()).toBe('Draf')
  })

  it('"Padam" asks "Padam set "{title}"? Tindakan ini tidak boleh diundur." and deletes only when confirmed', async () => {
    api.fetchGuruSets.mockResolvedValue(sets([row('1', { title: 'Ujian 1' })]))
    api.deleteGuruSet.mockResolvedValue({ deleted: 1 })
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValue(true)
    const w = await mountPage()
    await w.get('[data-testid="set-delete"]').trigger('click')
    await flushPromises()
    expect(confirmSpy).toHaveBeenCalledWith('Padam set "Ujian 1"? Tindakan ini tidak boleh diundur.')
    expect(api.deleteGuruSet).not.toHaveBeenCalled()

    api.fetchGuruSets.mockResolvedValue(sets([]))
    await w.get('[data-testid="set-delete"]').trigger('click')
    await flushPromises()
    expect(api.deleteGuruSet).toHaveBeenCalledWith('1')
    expect(w.find('[data-testid="set-card"]').exists()).toBe(false)
  })

  it('AC-GUR-8b-4 / 8b-13: "Salin" asks for a target class and sends a one-element classroomIds', async () => {
    api.fetchGuruSets.mockResolvedValue(sets([row('1', { title: 'Ujian 1' })]))
    api.copyGuruSet.mockResolvedValue({})
    const w = await mountPage()
    await w.get('[data-testid="set-copy"]').trigger('click')
    await settle()
    expect(dlg('[data-slot="title"]')?.textContent).toBe('Salin Set ke Kelas')
    expect(document.body.textContent).toContain(
      'Set baharu akan dicipta sebagai draf dengan semua soalan disalin.',
    )
    expect(document.body.textContent).toContain('Pilih Kelas Sasaran')
    const select = dlg<HTMLSelectElement>('[data-testid="set-copy-class"]')!
    expect([...select.options].map((o) => o.textContent?.trim())).toEqual([
      '-- Pilih kelas --',
      '5 Bestari',
      '5 Cekap',
    ])

    // Nothing chosen: "Sila pilih kelas sasaran." and no request.
    dlg('[data-testid="set-copy-submit"]')?.click()
    await settle()
    expect(document.body.textContent).toContain('Sila pilih kelas sasaran.')
    expect(api.copyGuruSet).not.toHaveBeenCalled()

    select.value = '2'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    await settle()
    dlg('[data-testid="set-copy-submit"]')?.click()
    await settle()
    expect(api.copyGuruSet).toHaveBeenCalledWith('1', ['2'])
    const flash = useFlashStore()
    expect((flash.current ?? flash.pending)?.message).toBe('Set disalin.')
    expect(dlg('[role="dialog"]')).toBeNull()
  })

  it('shows an error box with a retry when the list fails', async () => {
    api.fetchGuruSets.mockRejectedValueOnce(new Error('boom'))
    const w = await mountPage()
    expect(w.get('[data-testid="set-error"]').text()).toContain('Gagal memuatkan senarai set soalan.')
    api.fetchGuruSets.mockResolvedValue(sets([row('1')]))
    await w.get('[data-testid="set-error"] button').trigger('click')
    await flushPromises()
    expect(w.find('[data-testid="set-card"]').exists()).toBe(true)
  })
})
