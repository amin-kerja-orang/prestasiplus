import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  http: false,
  list: vi.fn(),
  post: vi.fn(),
}))
vi.mock('@/api', () => ({
  api: { list: h.list, post: h.post },
  isHttpMode: () => h.http,
}))

import { bulkQuestionAction, fetchQuestions } from '../../api/questions'

beforeEach(() => {
  h.list.mockReset().mockResolvedValue({ data: [], meta: {} })
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
    expect(h.post.mock.calls[0][1].body).toEqual({ action: 'published', ids: [7] })
    await bulkQuestionAction('archive', [7])
    expect(h.post.mock.calls[1][1].body.action).toBe('archived')
  })

  it('mock mode: values are sent unchanged', async () => {
    h.http = false
    await fetchQuestions({ status: 'pending_review' })
    expect(h.list.mock.calls[0][1].query.status).toBe('pending_review')
    await bulkQuestionAction('approve', [7])
    expect(h.post.mock.calls[0][1].body).toEqual({ action: 'approve', ids: [7] })
  })
})
