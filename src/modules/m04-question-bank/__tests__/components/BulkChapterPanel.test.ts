// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { ApiError } from '@/api'

import BulkChapterPanel from '../../components/BulkChapterPanel.vue'

const studio = vi.hoisted(() => ({ bulkChapter: vi.fn() }))
vi.mock('../../api/studio', () => studio)
const lookups = vi.hoisted(() => ({ fetchChapters: vi.fn() }))
vi.mock('../../api/lookups', () => lookups)

// The dialog teleports; render its slots in place so the test reads the panel directly.
const DsDialogStub = defineComponent({
  props: { open: Boolean, title: String, loading: Boolean },
  setup(props, { slots }) {
    return () => (props.open ? h('div', [h('h2', props.title), slots.default?.(), slots.footer?.()]) : null)
  },
})
const ChapterSelectStub = defineComponent({
  props: { modelValue: String, subjectId: String, levelId: String, error: String },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    return () =>
      h('div', [
        h('button', { 'data-testid': 'pick', onClick: () => emit('update:modelValue', '7') }, 'pick'),
        h('button', { 'data-testid': 'pick-other', onClick: () => emit('update:modelValue', '8') }, 'other'),
        props.error ? h('p', { 'data-testid': 'chapter-error' }, props.error) : null,
      ])
  },
})

const PREVIEW = { matched: 10, eligible: 7, refused: 3, applied: 0, cap: 10000, remaining: 0, capped: false, dryRun: true, auditId: null }
const DONE = { ...PREVIEW, applied: 7, dryRun: false, auditId: '55' }

let wrapper: VueWrapper | null = null
const mountPanel = (props: Record<string, unknown> = {}) => {
  wrapper = mount(BulkChapterPanel, {
    props: { open: true, subjectId: '2', educationLevelId: '10', ids: ['1', '2'], ...props },
    global: { stubs: { DsDialog: DsDialogStub, ChapterSelect: ChapterSelectStub, DsCallout: { props: ['description'], template: '<div>{{ description }}<slot /></div>' }, UButton: { template: '<button v-bind="$attrs"><slot /></button>' } } },
  })
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const has = (w: VueWrapper, id: string) => w.find(`[data-testid="${id}"]`).exists()
const pick = async (w: VueWrapper, id = 'pick') => {
  await t(w, id).trigger('click')
  await flushPromises()
}

beforeEach(() => {
  studio.bulkChapter.mockReset()
  lookups.fetchChapters.mockReset()
  lookups.fetchChapters.mockResolvedValue([
    { id: 7, name: 'Aljabar', chapterNumber: 3 },
    { id: 8, name: 'Geometri', chapterNumber: null },
  ])
})
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('BulkChapterPanel', () => {
  it('runs a dry run when the Bab is chosen and shows the line and the three counts', async () => {
    studio.bulkChapter.mockResolvedValue(PREVIEW)
    const w = mountPanel()
    await flushPromises()
    await pick(w)
    expect(studio.bulkChapter).toHaveBeenCalledWith({ chapterId: '7', dryRun: true, ids: ['1', '2'] })
    expect(t(w, 'bulk-chapter-dryline').text()).toBe('7 soalan akan dipautkan ke Bab 3: Aljabar')
    expect(t(w, 'bulk-chapter-matched').text()).toContain('10')
    expect(t(w, 'bulk-chapter-eligible').text()).toContain('7')
    expect(t(w, 'bulk-chapter-refused').text()).toContain('3')
  })

  it('sends the filter with Subjek and Tingkatan for "Semua hasil tapisan"', async () => {
    studio.bulkChapter.mockResolvedValue(PREVIEW)
    const w = mountPanel({ ids: undefined, filter: { search: 'pecahan' } })
    await flushPromises()
    await pick(w)
    expect(studio.bulkChapter).toHaveBeenCalledWith({
      chapterId: '7',
      dryRun: true,
      filter: { search: 'pecahan', subjectId: '2', educationLevelId: '10' },
    })
  })

  it('Terapkan sends expectedCount = matched, never overwrite, then shows the result', async () => {
    studio.bulkChapter.mockResolvedValueOnce(PREVIEW).mockResolvedValueOnce(DONE)
    const w = mountPanel()
    await flushPromises()
    await pick(w)
    await t(w, 'bulk-chapter-apply').trigger('click')
    await flushPromises()
    const sent = studio.bulkChapter.mock.calls[1]![0]
    expect(sent).toEqual({ chapterId: '7', expectedCount: 10, ids: ['1', '2'] })
    expect(sent).not.toHaveProperty('overwrite')
    expect(sent).not.toHaveProperty('dryRun')
    expect(t(w, 'bulk-chapter-result-line').text()).toBe('7 dikemas kini, 3 ditolak, baki 0')
    expect(has(w, 'bulk-chapter-capped')).toBe(false)
    expect(w.emitted('done')?.[0]).toEqual([DONE])
  })

  it('shows the capped line when the run hit the cap', async () => {
    studio.bulkChapter.mockResolvedValueOnce(PREVIEW).mockResolvedValueOnce({ ...DONE, remaining: 25, capped: true })
    const w = mountPanel()
    await flushPromises()
    await pick(w)
    await t(w, 'bulk-chapter-apply').trigger('click')
    await flushPromises()
    expect(t(w, 'bulk-chapter-capped').text()).toBe('Had setiap larian dicapai. Jalankan semula untuk baki 25.')
  })

  it('requires a Bab: "Sila pilih Bab." and no request', async () => {
    const w = mountPanel()
    await flushPromises()
    await t(w, 'bulk-chapter-apply').trigger('click')
    await flushPromises()
    expect(t(w, 'chapter-error').text()).toBe('Sila pilih Bab.')
    expect(studio.bulkChapter).not.toHaveBeenCalled()
  })

  it('shows "Bab tidak dijumpai." on 404', async () => {
    studio.bulkChapter.mockRejectedValue(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))
    const w = mountPanel()
    await flushPromises()
    await pick(w)
    expect(t(w, 'bulk-chapter-error').text()).toBe('Bab tidak dijumpai.')
  })

  it('shows the server message on 409 and refreshes the counts with a new dry run', async () => {
    const msg = 'Bilangan soalan hasil tapisan telah berubah (dijangka 10, kini 9). Muat semula senarai dan semak semula sebelum meneruskan.'
    studio.bulkChapter
      .mockResolvedValueOnce(PREVIEW)
      .mockRejectedValueOnce(new ApiError({ status: 409, code: 'CONFLICT', message: msg }))
      .mockResolvedValueOnce({ ...PREVIEW, matched: 9, eligible: 6, refused: 3 })
    const w = mountPanel()
    await flushPromises()
    await pick(w)
    await t(w, 'bulk-chapter-apply').trigger('click')
    await flushPromises()
    expect(t(w, 'bulk-chapter-error').text()).toBe(msg)
    expect(t(w, 'bulk-chapter-matched').text()).toContain('9')
    expect(studio.bulkChapter).toHaveBeenCalledTimes(3)
  })

  it('shows the server message on 422, or the mismatch copy when it has none', async () => {
    studio.bulkChapter.mockRejectedValueOnce(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'Bab tidak sah.' }))
    const w = mountPanel()
    await flushPromises()
    await pick(w)
    expect(t(w, 'bulk-chapter-error').text()).toBe('Bab tidak sah.')
    studio.bulkChapter.mockRejectedValueOnce(new ApiError({ status: 422, code: 'VALIDATION_ERROR', message: 'HTTP 422' }))
    await pick(w, 'pick-other')
    expect(t(w, 'bulk-chapter-error').text()).toBe('Bab tidak sepadan dengan subjek dan tahap.')
  })

  it('refuses more than 64 ids and points to "Semua hasil tapisan"', async () => {
    const w = mountPanel({ ids: Array.from({ length: 65 }, (_, i) => String(i + 1)) })
    await flushPromises()
    expect(t(w, 'bulk-chapter-blocked').text()).toContain('Semua hasil tapisan')
    expect(has(w, 'pick')).toBe(false)
    expect(studio.bulkChapter).not.toHaveBeenCalled()
  })

  it('blocks a run without Subjek and Tingkatan', async () => {
    const w = mountPanel({ subjectId: '' })
    await flushPromises()
    expect(t(w, 'bulk-chapter-blocked').text()).toContain('Sila pilih sekurang-kurangnya satu penapis')
    expect(studio.bulkChapter).not.toHaveBeenCalled()
  })

  it('does not offer Terapkan when no question is eligible', async () => {
    studio.bulkChapter.mockResolvedValue({ ...PREVIEW, eligible: 0, refused: 10 })
    const w = mountPanel()
    await flushPromises()
    await pick(w)
    expect(t(w, 'bulk-chapter-apply').attributes('disabled')).toBeDefined()
  })
})
