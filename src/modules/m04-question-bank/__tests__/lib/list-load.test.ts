import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import { listLoadMessage, rateLimitedFallback } from '../../lib/list-load'
import { LOAD_ERROR } from '../../lib/ui-errors'

const limited = (message: string, retryAfter?: number) =>
  new ApiError({ status: 429, code: 'RATE_LIMITED', message, ...(retryAfter === undefined ? {} : { retryAfter }) })

describe('listLoadMessage (REQ-A-027)', () => {
  it('uses the server message of a 429', () => {
    expect(listLoadMessage(limited('Terlalu banyak permintaan.', 12))).toBe('Terlalu banyak permintaan.')
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
})
