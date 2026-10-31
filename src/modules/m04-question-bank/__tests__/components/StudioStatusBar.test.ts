// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'
import { useFlashStore } from '@/stores/flash'

import StudioStatusBar from '../../components/studio/StudioStatusBar.vue'

const studio = vi.hoisted(() => ({
  moveQuestionStatus: vi.fn(),
  fetchGateCheck: vi.fn(),
  fetchServability: vi.fn(),
  editAsDraft: vi.fn(),
  EditAsDraftRefused: class EditAsDraftRefused extends Error {
    lines: string[] = []
  },
}))
vi.mock('../../api/studio', () => studio)

const REPORT = {
  questionId: '9',
  versionNo: 1,
  servedCount: 1,
  total: 2,
  activities: [
    { activity: 'databank', label: 'Databank Soalan', served: true, reasons: [] },
    { activity: 'bab', label: 'Latihan Bab', served: false, reasons: [{ code: 'no_chapter', message: 'Belum dipautkan kepada bab — pilih Bab di borang soalan.' }] },
  ],
}

let wrapper: VueWrapper | null = null
const mountBar = async (props: { status: string; dirty?: boolean; unsupported?: boolean }) => {
  wrapper = mount(StudioStatusBar, { props: { questionId: '9', dirty: false, unsupported: false, ...props }, attachTo: document.body })
  await flushPromises()
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const flashNow = () => useFlashStore().current

beforeEach(() => {
  setActivePinia(createPinia())
  for (const f of [studio.moveQuestionStatus, studio.fetchGateCheck, studio.fetchServability, studio.editAsDraft]) f.mockReset()
  studio.fetchServability.mockResolvedValue(REPORT)
  vi.spyOn(window, 'confirm').mockReturnValue(true)
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('StudioStatusBar', () => {
  it('shows the V2 badge word and sentence of a draft with its two buttons', async () => {
    const w = await mountBar({ status: 'draft' })
    expect(t(w, 'studio-status-badge').text()).toBe('Draft')
    expect(t(w, 'studio-status-text').text()).toBe('Belum dipapar kepada pelajar.')
    expect(w.findAll('[data-testid^="studio-action-"]').map((b) => b.text())).toEqual(['Hantar untuk semakan', 'Arkib'])
  })

  it('"Hantar untuk semakan" moves to review and flashes the V2 sentence', async () => {
    studio.moveQuestionStatus.mockResolvedValue({ question: { id: '9', status: 'review' }, servability: null })
    const w = await mountBar({ status: 'draft' })
    await t(w, 'studio-action-review').trigger('click')
    await flushPromises()
    expect(studio.moveQuestionStatus).toHaveBeenCalledWith('9', 'review', undefined)
    expect(flashNow()?.message).toBe('Soalan dihantar untuk semakan.')
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('"Terbitkan" asks no confirmation and flashes the V2 sentence', async () => {
    studio.moveQuestionStatus.mockResolvedValue({ question: { id: '9', status: 'approved' }, servability: REPORT })
    const w = await mountBar({ status: 'review' })
    await t(w, 'studio-action-approved').trigger('click')
    await flushPromises()
    expect(window.confirm).not.toHaveBeenCalled()
    expect(flashNow()?.message).toBe('Soalan diterbitkan — kini boleh dijawab oleh pelajar.')
    expect(t(w, 'studio-not-served').text()).toContain('Tidak dihidangkan di 1 aktiviti')
  })

  it('names every gap when the gate refuses, with the step', async () => {
    studio.moveQuestionStatus.mockRejectedValue(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'x', fields: { 'parts.b.cognitiveLevel': 'x' } }))
    studio.fetchGateCheck.mockResolvedValue({
      gate: 'approve',
      ok: false,
      issues: [
        { path: 'parts.b.cognitiveLevel', code: 'LEAF_COGNITIVE_LEVEL_MISSING', message: 'Bahagian (b) belum ada aras pemikiran.', step: 3 },
        { path: 'kertas', code: 'KERTAS_MISSING', message: 'Soalan SPM belum ada kertas.', step: 1 },
      ],
    })
    const w = await mountBar({ status: 'review' })
    await t(w, 'studio-action-approved').trigger('click')
    await flushPromises()
    expect(studio.fetchGateCheck).toHaveBeenCalledWith('9', 'approve')
    expect(t(w, 'studio-gate-refusal').text()).toContain('Soalan belum boleh diterbitkan — sila betulkan isu di bawah.')
    const lines = w.findAll('[data-testid="studio-gate-line"]').map((l) => l.text())
    expect(lines).toEqual(['Bahagian (b) belum ada aras pemikiran. — Langkah 3', 'Soalan SPM belum ada kertas. — Langkah 1'])
    expect(flashNow()).toBeNull()
  })

  it('"Arkib" asks "Arkibkan soalan ini?" first and sends a reason', async () => {
    studio.moveQuestionStatus.mockResolvedValue({ question: { id: '9', status: 'archived' }, servability: null })
    const confirmSpy = vi.mocked(window.confirm)
    const w = await mountBar({ status: 'approved' })
    await t(w, 'studio-action-archived').trigger('click')
    await flushPromises()
    expect(confirmSpy).toHaveBeenCalledWith('Soalan ini akan hilang daripada 1 aktiviti.')
    expect(studio.moveQuestionStatus).toHaveBeenCalledWith('9', 'archived', 'Disembunyikan dari Studio.')
    expect(flashNow()?.message).toBe('Soalan diarkibkan — tidak lagi dipapar kepada pelajar.')
  })

  it('does nothing when the archive dialog is cancelled', async () => {
    vi.mocked(window.confirm).mockReturnValue(false)
    const w = await mountBar({ status: 'draft' })
    await t(w, 'studio-action-archived').trigger('click')
    await flushPromises()
    expect(studio.moveQuestionStatus).not.toHaveBeenCalled()
  })

  it('"Edit sebagai draf" writes the draft at once and flashes the V2 sentence with the id', async () => {
    studio.editAsDraft.mockResolvedValue('9')
    const w = await mountBar({ status: 'approved' })
    await t(w, 'studio-action-edit-as-draft').trigger('click')
    await flushPromises()
    expect(studio.editAsDraft).toHaveBeenCalledWith('9')
    expect(flashNow()?.message).toBe('Draf baharu #9 dicipta. Soalan asal kekal diterbitkan sehingga draf ini diterbitkan.')
    expect(w.emitted('changed')).toHaveLength(1)
  })

  it('shows "Dilihat murid di x daripada n aktiviti" and the Boleh / Tidak boleh dilihat list behind Lihat', async () => {
    const w = await mountBar({ status: 'approved' })
    expect(t(w, 'studio-served-summary').text()).toBe('Dilihat murid di 1 daripada 2 aktiviti')
    expect(w.find('[data-testid="studio-served-list"]').exists()).toBe(false)
    await t(w, 'studio-served-toggle').trigger('click')
    expect(t(w, 'studio-served-databank').text()).toContain('Boleh dilihat')
    expect(t(w, 'studio-served-bab').text()).toContain('Tidak boleh dilihat — Belum dipautkan kepada bab')
  })

  it('keeps working when the servability read fails, with a retry', async () => {
    studio.fetchServability.mockRejectedValueOnce(new Error('x'))
    const w = await mountBar({ status: 'draft' })
    expect(t(w, 'studio-served-error').text()).toContain('tidak dapat dimuat')
    await t(w, 'studio-served-toggle').trigger('click')
    await flushPromises()
    expect(t(w, 'studio-served-summary').exists()).toBe(true)
  })

  it('waits for "Simpan draf" while the form has unsaved changes', async () => {
    const w = await mountBar({ status: 'draft', dirty: true })
    expect(t(w, 'studio-action-review').attributes('disabled')).toBeDefined()
    expect(t(w, 'studio-status-unsaved').text()).toBe('Simpan draf dahulu — perubahan belum disimpan.')
  })
})
