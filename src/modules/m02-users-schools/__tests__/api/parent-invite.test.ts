import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api', () => ({ api }))

import { fetchParentInvite } from '../../api/parent-invite'

const TOKEN = 'c'.repeat(64)
const AT = '2026-10-22T09:00:00+08:00'

beforeEach(() => {
  api.get.mockReset()
  api.post.mockReset()
})

describe('fetchParentInvite (D58 wire)', () => {
  it('hasToken=false: issues a token via POST /generate and returns it', async () => {
    api.get.mockResolvedValue({ hasToken: false, createdAt: null, expiresAt: null, parents: [] })
    api.post.mockResolvedValue({ token: TOKEN, createdAt: AT, expiresAt: AT, status: 'x' })
    const view = await fetchParentInvite()
    expect(api.post).toHaveBeenCalledWith('/api/me/parent-invite/generate')
    expect(view).toEqual({ token: TOKEN, createdAt: AT, parents: [] })
  })

  it('hasToken=true: no clear token, no POST', async () => {
    api.get.mockResolvedValue({ hasToken: true, createdAt: AT, expiresAt: AT, parents: [] })
    const view = await fetchParentInvite()
    expect(api.post).not.toHaveBeenCalled()
    expect(view.token).toBeNull()
  })

  it('mock shape (token present): passed through without a POST', async () => {
    api.get.mockResolvedValue({ token: TOKEN, createdAt: AT, parents: [] })
    const view = await fetchParentInvite()
    expect(api.post).not.toHaveBeenCalled()
    expect(view.token).toBe(TOKEN)
  })

  it('a failed issue rejects (the page shows its load error)', async () => {
    api.get.mockResolvedValue({ hasToken: false, createdAt: null, expiresAt: null, parents: [] })
    api.post.mockRejectedValue(new Error('429'))
    await expect(fetchParentInvite()).rejects.toThrow('429')
  })
})
