// @vitest-environment jsdom
import { flushPromises, mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { nextTick } from 'vue'

import StudioDskpFields from '../../components/studio/StudioDskpFields.vue'

const studio = vi.hoisted(() => ({ fetchStudioDskp: vi.fn() }))
vi.mock('../../api/studio', () => studio)

const unit = (n: number) => ({ id: String(290 + n), code: `${n}.0`, title: `Unit ${n}`, sps: [{ id: String(500 + n), code: `${n}.1.1`, title: `SP ${n}`, skCode: `${n}.1` }] })
const CHAPTERS = [1, 2, 3].map((n) => ({ id: 210 + n, name: `Bab ${n}`, chapterNumber: n }))

let wrapper: VueWrapper | null = null
const options = (w: VueWrapper): string[] => w.findAll('[data-testid="studio-unit"] option').map((o) => o.text()).filter((t) => t !== '' && !t.startsWith('Pilih'))

async function render(props: Record<string, unknown>): Promise<VueWrapper> {
  wrapper = mount(StudioDskpFields, { props: { subjectId: '3', levelId: '10', unitId: null, spIds: [], ...props } })
  await flushPromises()
  return wrapper
}

beforeEach(() => studio.fetchStudioDskp.mockReset().mockResolvedValue({ units: [unit(1), unit(2), unit(3)] }))
afterEach(() => {
  wrapper?.unmount()
  wrapper = null
})

describe('StudioDskpFields follows the Bab (G-02)', () => {
  it('offers every unit while no Bab is chosen', async () => {
    const w = await render({ chapterId: '', chapters: CHAPTERS })
    expect(options(w)).toEqual(['1.0 Unit 1', '2.0 Unit 2', '3.0 Unit 3'])
  })

  it('offers only the unit of the chosen Bab when the Bab and the units line up one to one', async () => {
    const w = await render({ chapterId: '213', chapters: CHAPTERS })
    expect(options(w)).toEqual(['3.0 Unit 3'])
  })

  it('offers every unit when the link is not known (a catch-all Bab)', async () => {
    const w = await render({ chapterId: '211', chapters: [CHAPTERS[0]] })
    expect(options(w)).toHaveLength(3)
  })

  it('drops a chosen unit that does not belong to the Bab chosen afterwards, and keeps one that does', async () => {
    const w = await render({ chapterId: '', chapters: CHAPTERS, unitId: '292', spIds: ['502'] })
    await w.setProps({ chapterId: '212' }) // Bab 2 keeps unit 2.0
    await nextTick()
    expect(w.emitted('update:unitId')).toBeUndefined()
    await w.setProps({ chapterId: '213' }) // Bab 3 drops unit 2.0 and its SP
    await flushPromises()
    expect(w.emitted('update:unitId')?.at(-1)).toEqual([null])
    expect(w.emitted('update:spIds')?.at(-1)).toEqual([[]])
  })
})
