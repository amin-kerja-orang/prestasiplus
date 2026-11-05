// @vitest-environment jsdom
import { flushPromises, mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'

import DrawingPad from '../DrawingPad.vue'
import PartInput from '../PartInput.vue'
import * as store from '../lib/photo-store'

vi.mock('../lib/photo-store', async (orig) => ({
  ...(await orig<typeof import('../lib/photo-store')>()),
  putPhoto: vi.fn((_a: string, _p: string, file: File, n: number) =>
    Promise.resolve({ key: `k${n}-${Math.random()}`, name: file.name, size: file.size }),
  ),
  photoUrl: vi.fn(() => Promise.resolve(null)),
  removePhoto: vi.fn(() => Promise.resolve()),
}))

const leaf = {
  id: 'p1',
  label: '(a)',
  prompt: 'Lukis.',
  marks: 3,
  kind: 'drawing' as const,
  depth: 0,
}
const png = () => new File([new Uint8Array(10)], 'lukisan.png', { type: 'image/png' })

/** Mount with a parent-like v-model so each emitted answer feeds back in. */
function mountLive(initial?: { photos: { key: string; name: string; size: number }[] }) {
  const w = mount(PartInput, {
    props: {
      leaf,
      modelValue: initial,
      attemptId: 'a1',
      optionBank: [],
      'onUpdate:modelValue': (v: unknown) => w.setProps({ modelValue: v as never }),
    },
  })
  return w
}
const photos = (w: ReturnType<typeof mountLive>) =>
  (w.props('modelValue') as { photos?: { key: string; name: string }[] } | undefined)?.photos ?? []

describe('PartInput pad photo (replace, not append)', () => {
  it('two saves store one pad photo and remove the old key', async () => {
    const w = mountLive()
    const pad = w.findComponent(DrawingPad)
    pad.vm.$emit('save', png())
    await flushPromises()
    const first = photos(w)[0]!.key
    pad.vm.$emit('save', png())
    await flushPromises()
    expect(photos(w)).toHaveLength(1)
    expect(photos(w)[0]!.key).not.toBe(first)
    expect(store.removePhoto).toHaveBeenCalledWith(first)
  })

  it('an emptied pad removes the pad photo but keeps camera photos', async () => {
    const w = mountLive({
      photos: [
        { key: 'cam', name: 'IMG_1.jpg', size: 5 },
        { key: 'pad', name: 'lukisan.png', size: 5 },
      ],
    })
    w.findComponent(DrawingPad).vm.$emit('change', { empty: true })
    await flushPromises()
    expect(photos(w).map((p) => p.key)).toEqual(['cam'])
    expect(store.removePhoto).toHaveBeenCalledWith('pad')
  })

  it('a pad photo replaces itself even when 3 photos are stored', async () => {
    const w = mountLive({
      photos: [
        { key: 'c1', name: 'a.jpg', size: 1 },
        { key: 'c2', name: 'b.jpg', size: 1 },
        { key: 'pad', name: 'lukisan.png', size: 1 },
      ],
    })
    w.findComponent(DrawingPad).vm.$emit('save', png())
    await flushPromises()
    expect(photos(w)).toHaveLength(3)
    expect(photos(w).map((p) => p.name)).toEqual(['a.jpg', 'b.jpg', 'lukisan.png'])
    expect(photos(w).some((p) => p.key === 'pad')).toBe(false)
  })
})
