import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

const client = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  api: client,
}))

import { fetchMock, fetchMockResult, submitMock } from '../api/spm'

describe('mock exam client: empty id guard', () => {
  beforeEach(() => {
    client.get.mockReset()
    client.post.mockReset()
  })

  it('never calls the list endpoint with an empty id; it rejects as a 404', async () => {
    for (const call of [
      () => fetchMock(''),
      () => fetchMockResult(''),
      () => submitMock('', []),
    ]) {
      const err = await call().catch((e: unknown) => e)
      expect(err).toBeInstanceOf(ApiError)
      expect((err as ApiError).status).toBe(404)
    }
    expect(client.get).not.toHaveBeenCalled()
    expect(client.post).not.toHaveBeenCalled()
  })

  it('a real id still requests its own path', async () => {
    client.get.mockResolvedValue({})
    await fetchMock('6a46860a-d53b-443b-8437-6a0c52570ceb')
    expect(client.get).toHaveBeenCalledWith(
      '/api/spm-mocks/6a46860a-d53b-443b-8437-6a0c52570ceb',
      {},
    )
  })
})
