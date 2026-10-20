import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = new Map<string, unknown>()
vi.mock('idb-keyval', () => ({
  set: vi.fn((k: string, v: unknown) => Promise.resolve(void store.set(k, v))),
  get: vi.fn((k: string) => Promise.resolve(store.get(k))),
  del: vi.fn((k: string) => Promise.resolve(void store.delete(k))),
}))

import { BijakServer } from '../server/store'

describe('BijakServer photos (mock keeps the device store)', () => {
  beforeEach(() => store.clear())

  it('uploadPhoto writes to the device store and returns a local key', async () => {
    const server = new BijakServer()
    const file = new File(['x'], 'kerja.png', { type: 'image/png' })
    const meta = await server.uploadPhoto(7, 'att-1', 'q-1', file, 0)
    expect(meta.key.startsWith('pp.bijak.photo.att-1.q-1.0.')).toBe(true)
    expect(meta).toMatchObject({ name: 'kerja.png', size: 1 })
    expect(store.get(meta.key)).toBe(file)
  })

  it('removePhoto deletes from the device store', async () => {
    const server = new BijakServer()
    const meta = await server.uploadPhoto(
      7,
      'att-1',
      'q-1',
      new File(['x'], 'a.png', { type: 'image/png' }),
      0,
    )
    await server.removePhoto(meta.key)
    expect(store.has(meta.key)).toBe(false)
  })
})
