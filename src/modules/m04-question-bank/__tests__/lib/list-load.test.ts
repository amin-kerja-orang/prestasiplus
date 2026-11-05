import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError, errorFromResponse } from '@/api'

import { listLoadMessage, rateLimitedFallback } from '../../lib/list-load'
import { LOAD_ERROR } from '../../lib/ui-errors'

const limited = (message: string, retryAfter?: number) =>
  new ApiError({ status: 429, code: 'RATE_LIMITED', message, ...(retryAfter === undefined ? {} : { retryAfter }) })

describe('listLoadMessage (REQ-A-027)', () => {
  afterEach(() => vi.unstubAllEnvs())
  it('uses the server message of a 429 that carries no wait', () => {
    expect(listLoadMessage(limited('Terlalu banyak permintaan.'))).toBe('Terlalu banyak permintaan.')
  })
  it('falls back to the proposed copy with the Retry-After seconds', () => {
    expect(listLoadMessage(limited('HTTP 429', 12))).toBe('Terlalu banyak carian dalam masa singkat. Cuba lagi dalam 12 saat.')
    expect(listLoadMessage(limited('', 5))).toContain('dalam 5 saat')
  })
  it('has wording when Retry-After is missing', () => {
    expect(rateLimitedFallback(undefined)).toBe('Terlalu banyak carian dalam masa singkat. Cuba lagi sebentar lagi.')
  })
  it('keeps the usual load error for any other failure', () => {
    expect(listLoadMessage(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'x' }))).toBe(LOAD_ERROR)
    expect(listLoadMessage(new Error('boom'))).toBe(LOAD_ERROR)
    expect(listLoadMessage(null)).toBe(LOAD_ERROR)
  })
  it('shows the wait for a 429 that went through errorFromResponse (real API replaces the message)', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const res = new Response(
      JSON.stringify({ error: { code: 'RATE_LIMITED', message: 'Too many requests.' } }),
      { status: 429, headers: { 'Retry-After': '17', 'Content-Type': 'application/json' } },
    )
    const err = errorFromResponse({
      status: res.status,
      headers: Object.fromEntries(res.headers.entries()),
      body: await res.json(),
    })
    expect(err.message).toBe('Terlalu banyak percubaan. Sila cuba sebentar lagi.')
    expect(listLoadMessage(err)).toBe('Terlalu banyak carian dalam masa singkat. Cuba lagi dalam 17 saat.')
  })
  it('uses the wait from the body when the header is absent, and the plain wording when neither exists', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const mk = (error: Record<string, unknown>) =>
      errorFromResponse({ status: 429, headers: {}, body: { error: { code: 'RATE_LIMITED', message: 'x', ...error } } })
    expect(listLoadMessage(mk({ retryAfter: 4 }))).toContain('dalam 4 saat')
    expect(listLoadMessage(mk({}))).toBe('Terlalu banyak percubaan. Sila cuba sebentar lagi.')
  })
})
