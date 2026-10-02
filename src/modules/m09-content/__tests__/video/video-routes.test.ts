import { createMemoryHistory, createRouter } from 'vue-router'
import { describe, expect, it } from 'vitest'

import routes from '../../routes/video'

const router = createRouter({ history: createMemoryHistory(), routes })
const nameOf = (path: string) => router.resolve(path).name

describe('video routes (S17 to S20)', () => {
  it('resolves the four screens; /video/tambah never meets the :id route', () => {
    expect(nameOf('/video')).toBe('video-list')
    expect(nameOf('/video/tambah')).toBe('video-add')
    expect(nameOf('/video/2224')).toBe('video-detail')
    expect(nameOf('/video/2224/edit')).toBe('video-edit')
  })

  it('does not match a non-numeric id (falls to the global 404)', () => {
    expect(router.resolve('/video/abc').matched).toHaveLength(0)
    expect(router.resolve('/video/abc/edit').matched).toHaveLength(0)
  })

  it('S17 and S18 are public-or-user, S19 and S20 need a session; S17 carries the guest title', () => {
    const meta = (path: string) => router.resolve(path).meta
    expect(meta('/video')).toMatchObject({
      layout: 'public-or-user',
      access: 'public',
      title: 'Video Pembelajaran - PRESTASIPLUS',
      guestTitle: 'Video Pembelajaran — PRESTASIPLUS',
    })
    expect(meta('/video/1')).toMatchObject({ layout: 'public-or-user', access: 'public' })
    expect(meta('/video/tambah')).toMatchObject({
      layout: 'user',
      access: 'auth',
      title: 'Tambah Video',
    })
    expect(meta('/video/1/edit')).toMatchObject({ layout: 'user', access: 'auth' })
  })
})
