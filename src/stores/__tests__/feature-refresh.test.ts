import { describe, expect, it, vi } from 'vitest'

import type { Transport, TransportRequest, TransportResponse } from '@/api'

import { FEATURE_REFRESH_GAP_MS, withFeatureRefresh } from '../http-session'

/** S0-T10: a 404 under an OFF-able api prefix re-reads the session once (debounced). */

const req = (url: string): TransportRequest => ({ method: 'GET', url, headers: {} })
const answer = (status: number): TransportResponse => ({ status, headers: {}, body: null })

function setup(status = 404) {
  const inner: Transport = { request: vi.fn(() => Promise.resolve(answer(status))) }
  let clock = 1_000_000
  const refresh = vi.fn(() => Promise.resolve())
  const wrapped = withFeatureRefresh(inner, refresh, () => clock)
  return { wrapped, refresh, advance: (ms: number) => (clock += ms) }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('withFeatureRefresh', () => {
  it('re-reads the session on a 404 under a feature api prefix and passes the response through', async () => {
    const { wrapped, refresh } = setup()
    const res = await wrapped.request(req('/api/games/hub'))
    expect(res.status).toBe(404)
    expect(refresh).toHaveBeenCalledTimes(1)
  })

  it('covers every seeded api prefix, on a segment boundary only', async () => {
    for (const url of ['/api/games', '/api/papan-bijak/x', '/api/cikgu/chat', '/api/mohon-keluarga-angkat']) {
      const { wrapped, refresh } = setup()
      await wrapped.request(req(url))
      expect(refresh, url).toHaveBeenCalledTimes(1)
    }
    const { wrapped, refresh } = setup()
    await wrapped.request(req('/api/gamesx'))
    await wrapped.request(req('/api/me'))
    expect(refresh).not.toHaveBeenCalled()
  })

  it('does nothing for a non-404 answer', async () => {
    for (const status of [200, 401, 403, 500]) {
      const { wrapped, refresh } = setup(status)
      await wrapped.request(req('/api/games/hub'))
      expect(refresh, String(status)).not.toHaveBeenCalled()
    }
  })

  it('reads once: not while a read runs, not again within the gap, again after it', async () => {
    const { wrapped, refresh, advance } = setup()
    await wrapped.request(req('/api/games/a'))
    await wrapped.request(req('/api/games/b'))
    expect(refresh).toHaveBeenCalledTimes(1)
    await flush()
    advance(FEATURE_REFRESH_GAP_MS - 1)
    await wrapped.request(req('/api/games/c'))
    expect(refresh).toHaveBeenCalledTimes(1)
    advance(1)
    await wrapped.request(req('/api/games/d'))
    expect(refresh).toHaveBeenCalledTimes(2)
  })
})
