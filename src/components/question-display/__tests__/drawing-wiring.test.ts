// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import DrawingPad from '../DrawingPad.vue'
import PartInput from '../PartInput.vue'

vi.mock('../lib/photo-store', async (orig) => ({
  ...(await orig<typeof import('../lib/photo-store')>()),
  putPhoto: vi.fn((_a: string, _p: string, file: File, n: number) =>
    Promise.resolve({ key: `k${n}`, name: file.name, size: file.size }),
  ),
  photoUrl: vi.fn(() => Promise.resolve(null)),
}))

const leaf = {
  id: 'p1',
  label: '(a)',
  prompt: 'Lukis graf.',
  marks: 3,
  kind: 'drawing' as const,
  depth: 0,
  answerTemplate: { grid: { xMin: 0, xMax: 4, yMin: 0, yMax: 4, step: 1, scale: '1 cm = 1 unit' } },
}

/** FR-PA-08 / AC-PA-16: the Papan Lukisan sits in the drawing leaf and its PNG takes the photo path (`answer.photos[]`). */
describe('PartInput drawing leaf (S8-T03)', () => {
  it('shows the pad over the template and keeps the photo option', () => {
    const w = mount(PartInput, {
      props: { leaf, modelValue: undefined, attemptId: 'a1', optionBank: [] },
    })
    expect(w.find('[data-testid=drawing-pad]').exists()).toBe(true)
    expect(w.find('[data-testid=pad-template-grid]').exists()).toBe(true)
    expect(w.find('[data-testid=photo-button]').text()).toContain('Ambil gambar jawapan lukisan')
  })

  it('a saved drawing is stored like a photo: answer.photos gets one entry, no new field', async () => {
    const w = mount(PartInput, {
      props: { leaf, modelValue: undefined, attemptId: 'a1', optionBank: [] },
    })
    const png = new File([new Uint8Array(10)], 'lukisan.png', { type: 'image/png' })
    w.findComponent(DrawingPad).vm.$emit('save', png)
    await vi.waitFor(() => expect(w.emitted('update:modelValue')).toBeTruthy())
    const last = w.emitted('update:modelValue')!.at(-1)![0] as { photos?: { name: string }[] }
    expect(last).toMatchObject({ photos: [{ key: 'k0', name: 'lukisan.png', size: 10 }] })
  })

  it('a drawing beyond the 3-photo limit is refused with the photo message', async () => {
    const photos = [0, 1, 2].map((i) => ({ key: `x${i}`, name: `p${i}.png`, size: 1 }))
    const w = mount(PartInput, {
      props: { leaf, modelValue: { photos }, attemptId: 'a1', optionBank: [] },
    })
    w.findComponent(DrawingPad).vm.$emit(
      'save',
      new File([new Uint8Array(1)], 'lukisan.png', { type: 'image/png' }),
    )
    await vi.waitFor(() => expect(w.text()).toContain('Maksimum 3 gambar bagi setiap bahagian.'))
  })
})
