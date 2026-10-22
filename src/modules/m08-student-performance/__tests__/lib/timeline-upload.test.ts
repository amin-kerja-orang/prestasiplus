import { beforeEach, describe, expect, it, vi } from 'vitest'

const multipart = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ api: { multipart, get: vi.fn() } }))

import { createTimelinePost } from '../../api/performance'

/** BE-19 `POST /timeline`: multipart `title`, `category`, `eventDate`, `story`, `photos[]`, `captions[i]`. */
describe('createTimelinePost', () => {
  beforeEach(() => {
    multipart.mockReset()
    multipart.mockResolvedValue({})
  })

  it('posts the contract multipart fields to /api/timeline', async () => {
    const a = new File(['a'], 'a.png', { type: 'image/png' })
    const b = new File(['b'], 'b.jpg', { type: 'image/jpeg' })
    await createTimelinePost({
      title: 'Sijil',
      category: 'sijil',
      eventDate: '2026-08-14',
      story: 'Cerita',
      photos: [a, b],
      captions: ['satu', ''],
    })
    const [url, form] = multipart.mock.calls[0] as [string, FormData]
    expect(url).toBe('/api/timeline')
    expect(form.get('title')).toBe('Sijil')
    expect(form.get('category')).toBe('sijil')
    expect(form.get('eventDate')).toBe('2026-08-14')
    expect(form.get('story')).toBe('Cerita')
    expect(form.getAll('photos[]')).toHaveLength(2)
    expect(form.get('captions[0]')).toBe('satu')
    expect(form.get('captions[1]')).toBe('')
    expect(form.has('purpose')).toBe(false)
  })
})
