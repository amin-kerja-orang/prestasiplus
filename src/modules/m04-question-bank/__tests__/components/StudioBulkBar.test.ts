// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'

import StudioBulkBar from '../../components/studio/StudioBulkBar.vue'

vi.mock('../../api/studio', () => ({ bulkStudioAction: vi.fn() }))
vi.mock('../../api/questions', () => ({ bulkQuestionsByFilter: vi.fn() }))

let wrapper: VueWrapper | null = null
const mountBar = (props: Record<string, unknown> = {}): VueWrapper => {
  wrapper = mount(StudioBulkBar, {
    attachTo: document.body,
    props: { selectedIds: ['1', '2'], filter: { subjectId: '3', educationLevelId: '7' }, matched: 120, subjectId: '3', educationLevelId: '7', ...props },
  })
  return wrapper
}
const t = (w: VueWrapper, id: string) => w.get(`[data-testid="${id}"]`)
const disabled = (w: VueWrapper, id: string): boolean => t(w, id).attributes('disabled') !== undefined

afterEach(() => {
  wrapper?.unmount()
  wrapper = null
  document.body.innerHTML = ''
})

describe('StudioBulkBar: Tetapkan Bab (field 03-14, S2-T08)', () => {
  it('is offered beside the status actions and asks for the panel with the selected rows', async () => {
    const w = mountBar()
    expect(t(w, 'studio-bulk-chapter').text()).toBe('Tetapkan Bab')
    expect(disabled(w, 'studio-bulk-chapter')).toBe(false)
    expect(w.find('[data-testid="studio-bulk-chapter-needed"]').exists()).toBe(false)
    await t(w, 'studio-bulk-chapter').trigger('click')
    expect(w.emitted('chapter')).toEqual([[false]])
  })

  it('"Semua hasil tapisan" asks for the panel with the filter, not the ids', async () => {
    const w = mountBar({ selectedIds: [] })
    await w.get('[data-testid="studio-bulk-all"] [role="checkbox"], [data-testid="studio-bulk-all"]').trigger('click')
    await flushPromises()
    expect(t(w, 'studio-bulk-count').text()).toBe('120 soalan dipilih')
    await t(w, 'studio-bulk-chapter').trigger('click')
    expect(w.emitted('chapter')).toEqual([[true]])
  })

  it.each([
    ['no Subjek', { subjectId: '' }],
    ['no Tingkatan', { educationLevelId: '' }],
    ['neither', { subjectId: '', educationLevelId: '' }],
  ])('is disabled with the PRD message when the filter has %s', async (_n, props) => {
    const w = mountBar(props)
    expect(disabled(w, 'studio-bulk-chapter')).toBe(true)
    expect(t(w, 'studio-bulk-chapter-needed').text()).toBe(
      'Sila pilih sekurang-kurangnya satu penapis (subjek/aras/status/carian) sebelum meluluskan secara pukal.',
    )
    await t(w, 'studio-bulk-chapter').trigger('click')
    expect(w.emitted('chapter')).toBeUndefined()
  })

  it('refuses more than 64 selected rows and points to "Semua hasil tapisan"', async () => {
    const ids = Array.from({ length: 65 }, (_v, i) => String(i + 1))
    const w = mountBar({ selectedIds: ids })
    expect(disabled(w, 'studio-bulk-chapter')).toBe(true)
    expect(t(w, 'studio-bulk-cap').text()).toContain('semua hasil tapisan')
    await t(w, 'studio-bulk-chapter').trigger('click')
    expect(w.emitted('chapter')).toBeUndefined()
    // 64 is the last accepted size.
    await w.setProps({ selectedIds: ids.slice(0, 64) })
    expect(disabled(w, 'studio-bulk-chapter')).toBe(false)
  })

  it('an empty selection says so instead of opening the panel', async () => {
    const w = mountBar({ selectedIds: [], matched: 0 })
    await t(w, 'studio-bulk-chapter').trigger('click')
    expect(w.emitted('chapter')).toBeUndefined()
    expect(t(w, 'studio-bulk-problems').text()).toContain('Sila pilih sekurang-kurangnya satu soalan.')
  })
})
