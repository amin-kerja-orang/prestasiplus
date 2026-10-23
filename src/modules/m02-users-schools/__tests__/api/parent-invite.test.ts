import { beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({ get: vi.fn(), post: vi.fn() }))
vi.mock('@/api', () => ({ api }))

import { fetchInvitePreview, fetchParentInvite } from '../../api/parent-invite'

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
    expect(api.post).toHaveBeenCalledWith('/api/me/parent-invite/generate', {})
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

  it('concurrent loads with hasToken=false share one POST and the same token', async () => {
    api.get.mockResolvedValue({ hasToken: false, createdAt: null, expiresAt: null, parents: [] })
    api.post.mockResolvedValue({ token: TOKEN, createdAt: AT, expiresAt: AT, status: 'x' })
    const [a, b] = await Promise.all([fetchParentInvite(), fetchParentInvite()])
    expect(api.post).toHaveBeenCalledTimes(1)
    expect(a.token).toBe(TOKEN)
    expect(b.token).toBe(TOKEN)
  })

  it('passes the abort signal to the POST', async () => {
    const ctl = new AbortController()
    api.get.mockResolvedValue({ hasToken: false, createdAt: null, expiresAt: null, parents: [] })
    api.post.mockResolvedValue({ token: TOKEN, createdAt: AT, expiresAt: AT, status: 'x' })
    await fetchParentInvite({ signal: ctl.signal })
    expect(api.post).toHaveBeenCalledWith('/api/me/parent-invite/generate', { signal: ctl.signal })
  })

  it('aborted before the POST: no POST', async () => {
    const ctl = new AbortController()
    api.get.mockImplementation(() => {
      ctl.abort()
      return Promise.resolve({ hasToken: false, createdAt: null, expiresAt: null, parents: [] })
    })
    await expect(fetchParentInvite({ signal: ctl.signal })).rejects.toBeDefined()
    expect(api.post).not.toHaveBeenCalled()
  })
})

describe('fetchInvitePreview (D57f wire: firstName only)', () => {
  it('maps the contract body {firstName, schoolName} to the name and initials the page reads', async () => {
    api.get.mockResolvedValue({
      valid: true,
      student: { firstName: 'Ali', schoolName: 'SMK DEMO' },
      viewer: 'guest',
    })
    const view = await fetchInvitePreview(TOKEN)
    expect(api.get).toHaveBeenCalledWith(`/api/parent-invites/${TOKEN}`, {})
    expect(view).toEqual({
      valid: true,
      student: { name: 'Ali', initials: 'A', schoolName: 'SMK DEMO' },
      viewer: 'guest',
    })
  })

  it('upper-cases the initial and keeps a null school', async () => {
    api.get.mockResolvedValue({
      valid: true,
      student: { firstName: 'siti', schoolName: null },
      viewer: 'parent',
    })
    const view = await fetchInvitePreview(TOKEN)
    expect(view.student).toEqual({ name: 'siti', initials: 'S', schoolName: null })
  })

  it('mock shape (name + initials present) is unchanged', async () => {
    api.get.mockResolvedValue({
      valid: true,
      student: { name: 'Pelajar Demo', initials: 'PD', schoolName: 'SMK DEMO' },
      viewer: 'other',
    })
    const view = await fetchInvitePreview(TOKEN)
    expect(view.student).toEqual({ name: 'Pelajar Demo', initials: 'PD', schoolName: 'SMK DEMO' })
  })

  it('no name at all: empty name and "?" initials', async () => {
    api.get.mockResolvedValue({ valid: true, student: { schoolName: null }, viewer: 'guest' })
    const view = await fetchInvitePreview(TOKEN)
    expect(view.student).toEqual({ name: '', initials: '?', schoolName: null })
  })

  it('passes the abort signal', async () => {
    const ctl = new AbortController()
    api.get.mockResolvedValue({ valid: true, student: { firstName: 'Ali', schoolName: null }, viewer: 'guest' })
    await fetchInvitePreview(TOKEN, { signal: ctl.signal })
    expect(api.get).toHaveBeenCalledWith(`/api/parent-invites/${TOKEN}`, { signal: ctl.signal })
  })
})
