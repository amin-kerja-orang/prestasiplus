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

interface Req {
  query?: { status?: unknown }
  body?: { action?: string; ids?: (number | string)[] }
}
/** The options object (2nd argument) of the nth call of a mock. */
const reqOf = (fn: { mock: { calls: unknown[][] } }, n: number): Req =>
  (fn.mock.calls[n]?.[1] ?? {})

beforeEach(() => {
  h.list.mockReset().mockResolvedValue({ data: [], meta: {} })
  h.get.mockReset()
  h.post.mockReset().mockResolvedValue({ data: { affected: 1 }, status: 'ok' })
})

describe('request building by transport mode', () => {
  it('http mode: the status filter and bulk action carry the v2 wire values', async () => {
    h.http = true
    await fetchQuestions({ status: 'pending_review' })
    expect(reqOf(h.list, 0).query?.status).toBe('review')
    await fetchQuestions({ status: 'approved' })
    expect(reqOf(h.list, 1).query?.status).toBe('approved')
    await fetchQuestions({ status: 'published' })
    expect(reqOf(h.list, 2).query?.status).toBe('published') // unknown values pass through untouched
    await bulkQuestionAction('approve', [7])
    expect(reqOf(h.post, 0).body).toEqual({ action: 'approved', ids: ['7'] })
    await bulkQuestionAction('publish', [7])
    expect(reqOf(h.post, 1).body).toEqual({ action: 'approved', ids: ['7'] }) // Terbitkan = approve (ADR-0027)
    await bulkQuestionAction('archive', [7])
    expect(reqOf(h.post, 2).body?.action).toBe('archived')
    // REQ-B-002: the contract id shape is a string, never a number
    expect(reqOf(h.post, 2).body?.ids).toEqual(['7'])
  })

  it('http mode: a partial publish lists the questions the API left untouched, one by one', async () => {
    h.http = true
    h.post.mockResolvedValue({ data: { affected: 1 }, status: '1 soalan berjaya dikemaskini.' })
    h.get.mockImplementation((path: string) =>
      Promise.resolve({ status: path.endsWith('11') ? 'approved' : 'review' }),
    )
    const r = await bulkQuestionAction('publish', [11, 12, 13, 12])
    expect(r.notUpdated).toEqual([12, 13])
    h.post.mockResolvedValue({ data: { affected: 3 }, status: 'ok' })
    expect((await bulkQuestionAction('publish', [11, 12, 13])).notUpdated).toBeUndefined()
  })

  it('http mode: failed[] and skipped[] come back as numbers with the server text, and nothing is re-read', async () => {
    h.http = true
    h.get.mockReset()
    h.post.mockResolvedValue({
      data: {
        affected: 1,
        failed: [{ id: '12', code: 'VALIDATION_ERROR', message: 'Tag DSKP belum lengkap.', fields: {} }],
        skipped: [{ id: '11', reason: 'Soalan ini sudah diterbitkan.' }],
      },
      status: '1 soalan berjaya dikemaskini.',
    })
    const r = await bulkQuestionAction('publish', [10, 11, 12])
    expect(r.failed).toEqual([{ id: 12, code: 'VALIDATION_ERROR', message: 'Tag DSKP belum lengkap.' }])
    expect(r.skipped).toEqual([{ id: 11, reason: 'Soalan ini sudah diterbitkan.' }])
    expect(r.notUpdated).toBeUndefined()
    expect(h.get).not.toHaveBeenCalled()
    // an empty failed[] (the API always sends it) is an answer too: no per-id re-read
    h.post.mockResolvedValue({ data: { affected: 1, failed: [] }, status: 'ok' })
    expect((await bulkQuestionAction('publish', [10, 11])).notUpdated).toBeUndefined()
    expect(h.get).not.toHaveBeenCalled()
  })

  it('mock mode: values are sent unchanged', async () => {
    h.http = false
    await fetchQuestions({ status: 'pending_review' })
    expect(reqOf(h.list, 0).query?.status).toBe('pending_review')
    await bulkQuestionAction('approve', [7])
    expect(reqOf(h.post, 0).body).toEqual({ action: 'approve', ids: [7] })
    expect(h.get).not.toHaveBeenCalled()
  })
})
