import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  http: false,
  list: vi.fn(),
  post: vi.fn(),
  get: vi.fn(),
}))
vi.mock('@/api', () => ({
  api: { list: h.list, post: h.post, get: h.get },
  isHttpMode: () => h.http,
}))

import { bulkQuestionAction, fetchQuestions } from '../../api/questions'

beforeEach(() => {
  h.list.mockReset().mockResolvedValue({ data: [], meta: {} })
  h.get.mockReset()
  h.post.mockReset().mockResolvedValue({ data: { affected: 1 }, status: 'ok' })
})

describe('request building by transport mode', () => {
  it('http mode: the status filter and bulk action carry the v2 wire values', async () => {
    h.http = true
    await fetchQuestions({ status: 'pending_review' })
    expect(h.list.mock.calls[0][1].query.status).toBe('review')
    await fetchQuestions({ status: 'approved' })
    expect(h.list.mock.calls[1][1].query.status).toBe('approved')
    await fetchQuestions({ status: 'published' })
    expect(h.list.mock.calls[2][1].query.status).toBe('published')
    await bulkQuestionAction('approve', [7])
    expect(h.post.mock.calls[0][1].body).toEqual({ action: 'approved', ids: [7] })
    await bulkQuestionAction('publish', [7])
    expect(h.post.mock.calls[1][1].body).toEqual({ action: 'published', ids: [7] })
    await bulkQuestionAction('archive', [7])
    expect(h.post.mock.calls[2][1].body.action).toBe('archived')
  })

  it('http mode: a partial publish lists the questions the API left untouched, one by one', async () => {
    h.http = true
    h.post.mockResolvedValue({ data: { affected: 1 }, status: '1 soalan berjaya dikemaskini.' })
    h.get.mockImplementation((path: string) =>
      Promise.resolve({ status: path.endsWith('11') ? 'published' : 'approved' }),
    )
    const r = await bulkQuestionAction('publish', [11, 12, 13, 12])
    expect(r.notUpdated).toEqual([12, 13])
    h.post.mockResolvedValue({ data: { affected: 3 }, status: 'ok' })
    expect((await bulkQuestionAction('publish', [11, 12, 13])).notUpdated).toBeUndefined()
  })

  it('mock mode: values are sent unchanged', async () => {
    h.http = false
    await fetchQuestions({ status: 'pending_review' })
    expect(h.list.mock.calls[0][1].query.status).toBe('pending_review')
    await bulkQuestionAction('approve', [7])
    expect(h.post.mock.calls[0][1].body).toEqual({ action: 'approve', ids: [7] })
    expect(h.get).not.toHaveBeenCalled()
  })
})
