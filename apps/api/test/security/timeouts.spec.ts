import { createServer } from 'node:http'

import { describe, expect, it } from 'vitest'

import { applyServerTimeouts, resolveServerTimeouts } from '../../src/common/health/server-timeouts'
import { loadEnv } from '../../src/common/config/env.schema'

describe('server timeouts (BE-33)', () => {
  it('applies the defaults: 120 s request, 60 s headers, 65 s keep-alive, 25 s shutdown grace', () => {
    expect(resolveServerTimeouts({})).toEqual({ requestTimeout: 120_000, headersTimeout: 60_000, keepAliveTimeout: 65_000, shutdownGraceMs: 25_000 })
  })

  it('reads the env values and keeps headersTimeout <= requestTimeout', () => {
    expect(resolveServerTimeouts({ REQUEST_TIMEOUT_MS: 30_000, HEADERS_TIMEOUT_MS: 90_000 })).toMatchObject({ requestTimeout: 30_000, headersTimeout: 30_000 })
    expect(resolveServerTimeouts({ REQUEST_TIMEOUT_MS: '0', HEADERS_TIMEOUT_MS: '90000' })).toMatchObject({ requestTimeout: 0, headersTimeout: 90_000 })
    expect(resolveServerTimeouts({ KEEP_ALIVE_TIMEOUT_MS: '70000', SHUTDOWN_GRACE_MS: '10000' })).toMatchObject({ keepAliveTimeout: 70_000, shutdownGraceMs: 10_000 })
  })

  it('falls back to the defaults for garbage and never allows a grace below 1 s', () => {
    expect(resolveServerTimeouts({ REQUEST_TIMEOUT_MS: 'abc', SHUTDOWN_GRACE_MS: 5 })).toMatchObject({ requestTimeout: 120_000, shutdownGraceMs: 1000 })
  })

  it('sets the values on a real Node http server', () => {
    const server = createServer()
    applyServerTimeouts(server, resolveServerTimeouts({ REQUEST_TIMEOUT_MS: 20_000, HEADERS_TIMEOUT_MS: 10_000, KEEP_ALIVE_TIMEOUT_MS: 61_000 }))
    expect([server.requestTimeout, server.headersTimeout, server.keepAliveTimeout]).toEqual([20_000, 10_000, 61_000])
  })

  it('the env schema accepts the keys as optional numbers and rejects non-numbers', () => {
    const base = { NODE_ENV: 'test', DATABASE_URL: 'postgresql://u:p@localhost:5432/x' }
    expect(loadEnv({ ...base, REQUEST_TIMEOUT_MS: '5000', METRICS_ENABLED: 'false' })).toMatchObject({ REQUEST_TIMEOUT_MS: 5000, METRICS_ENABLED: 'false' })
    expect(() => loadEnv({ ...base, KEEP_ALIVE_TIMEOUT_MS: 'soon' })).toThrow(/KEEP_ALIVE_TIMEOUT_MS/)
  })
})
