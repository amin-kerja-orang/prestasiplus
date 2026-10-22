import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ http: false, list: vi.fn() }))
vi.mock('@/api', () => ({
  api: { list: h.list },
  isHttpMode: () => h.http,
}))

import { fetchQuestionSubmissions } from '../../api/submissions'
import { SubmissionsUnavailableError } from '../../lib/submissions-unavailable'

beforeEach(() => {
  h.list.mockReset().mockResolvedValue({ data: [], meta: {} })
})

describe('fetchQuestionSubmissions by transport mode', () => {
  it('http mode: raises the unavailable error without calling the API', async () => {
    h.http = true
    await expect(fetchQuestionSubmissions()).rejects.toBeInstanceOf(SubmissionsUnavailableError)
    expect(h.list).not.toHaveBeenCalled()
  })

  it('mock mode: requests /api/question-submissions as before', async () => {
    h.http = false
    await fetchQuestionSubmissions({ status: 'pending' })
    expect(h.list).toHaveBeenCalledWith(
      '/api/question-submissions',
      expect.objectContaining({ query: { status: 'pending' } }),
    )
  })
})
