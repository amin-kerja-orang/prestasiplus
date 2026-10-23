import { afterEach, describe, expect, it, vi } from 'vitest'

const get = vi.hoisted(() => vi.fn())
vi.mock('@/api', () => ({ api: { get } }))

import { fetchAdminDefaults } from '../../api/users'

afterEach(() => {
  vi.unstubAllEnvs()
  get.mockReset()
})

describe('fetchAdminDefaults (SWEEP-23OCT A5)', () => {
  it('http mode: rejects without sending a request (the real API has no such route)', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await expect(fetchAdminDefaults()).rejects.toThrow()
    expect(get).not.toHaveBeenCalled()
  })

  it('mock mode: still reads GET /api/admin/config/defaults', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    get.mockResolvedValue({ compStudentDefaultPassword: '12345678' })
    await expect(fetchAdminDefaults()).resolves.toEqual({ compStudentDefaultPassword: '12345678' })
    expect(get).toHaveBeenCalledWith('/api/admin/config/defaults', {})
  })
})
