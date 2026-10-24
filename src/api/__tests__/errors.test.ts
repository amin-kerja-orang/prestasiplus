import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  GENERIC_API_MESSAGES_BM,
  RATE_LIMITED_MESSAGE_BM,
  errorFromResponse,
  type ApiErrorCode,
} from '../errors'

function envelope(
  status: number,
  code: ApiErrorCode,
  message: string,
  extra: Record<string, unknown> = {},
) {
  return errorFromResponse({
    status,
    headers: {},
    body: { error: { code, message, ...extra } },
    method: 'GET',
    url: '/api/x',
  })
}

afterEach(() => {
  vi.unstubAllEnvs()
})

describe('errorFromResponse: http mode, generic API defaults to BM', () => {
  const cases: [number, ApiErrorCode, string, string][] = [
    [500, 'SERVER_ERROR', 'Server Error', 'Ralat pelayan. Sila cuba lagi.'],
    [404, 'NOT_FOUND', 'Not Found.', 'Rekod tidak dijumpai.'],
    [
      403,
      'FORBIDDEN',
      'This action is unauthorized.',
      'Anda tidak dibenarkan melakukan tindakan ini.',
    ],
    [401, 'UNAUTHORIZED', 'Unauthenticated.', 'Sesi anda telah tamat. Sila log masuk semula.'],
    [409, 'CONFLICT', 'Conflict.', 'Rekod telah berubah. Sila muat semula dan cuba lagi.'],
    [422, 'VALIDATION_ERROR', 'The given data was invalid.', 'Maklumat yang diberikan tidak sah.'],
    [400, 'VALIDATION_ERROR', 'The given data was invalid.', 'Maklumat yang diberikan tidak sah.'],
    [413, 'PAYLOAD_TOO_LARGE', 'Payload Too Large.', 'Saiz fail terlalu besar.'],
  ]

  it.each(cases)('%i %s "%s" becomes its BM line', (status, code, english, bm) => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const err = envelope(status, code, english)
    expect(err.message).toBe(bm)
    expect(err.status).toBe(status)
    expect(err.code).toBe(code)
  })

  it('covers exactly the seven generic defaults', () => {
    expect(Object.keys(GENERIC_API_MESSAGES_BM)).toHaveLength(7)
  })

  it('keeps code, status and fields unchanged', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const err = envelope(422, 'VALIDATION_ERROR', 'The given data was invalid.', {
      fields: { email: 'Format e-mel tidak sah.' },
    })
    expect(err).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      fields: { email: 'Format e-mel tidak sah.' },
    })
  })

  it('passes a module BM message through unchanged, on any status', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    expect(envelope(404, 'NOT_FOUND', 'Kelas tidak dijumpai.').message).toBe(
      'Kelas tidak dijumpai.',
    )
    expect(envelope(409, 'CLASS_FULL', 'Kelas sudah penuh.').message).toBe('Kelas sudah penuh.')
    expect(envelope(500, 'SERVER_ERROR', 'Ralat pelayan.').message).toBe('Ralat pelayan.')
  })

  it('matches the exact text only (no trimming, case or partial matching)', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    for (const text of ['not found.', 'Not Found', 'Server Error!', ' Conflict.', 'toString']) {
      expect(envelope(404, 'NOT_FOUND', text).message).toBe(text)
    }
  })

  it('strips the plural "(and N more errors)" tail', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const err = envelope(422, 'VALIDATION_ERROR', 'Nama diperlukan. (and 2 more errors)')
    expect(err.message).toBe('Nama diperlukan.')
  })

  it('strips the singular "(and 1 more error)" tail', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const err = envelope(422, 'VALIDATION_ERROR', 'Nama diperlukan. (and 1 more error)')
    expect(err.message).toBe('Nama diperlukan.')
  })

  it('strips the tail, then maps a generic default left underneath', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const err = envelope(422, 'VALIDATION_ERROR', 'The given data was invalid. (and 3 more errors)')
    expect(err.message).toBe('Maklumat yang diberikan tidak sah.')
  })

  it('only strips the tail at the end of the message', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const text = 'Nilai (and 2 more errors) tidak sah.'
    expect(envelope(422, 'VALIDATION_ERROR', text).message).toBe(text)
  })

  it('still maps 429 to RATE_LIMITED_MESSAGE_BM and keeps retryAfter', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    const err = envelope(429, 'RATE_LIMITED', 'Too Many Attempts.', { retryAfter: 30 })
    expect(err.message).toBe(RATE_LIMITED_MESSAGE_BM)
    expect(err.retryAfter).toBe(30)
  })

  it('leaves the non-envelope branch as "HTTP <status>"', () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    for (const status of [404, 500, 503]) {
      const err = errorFromResponse({ status, headers: {}, body: null })
      expect(err.message).toBe(`HTTP ${String(status)}`)
    }
  })
})

describe('errorFromResponse: mock mode is unchanged', () => {
  it.each([
    'Server Error',
    'Not Found.',
    'This action is unauthorized.',
    'Unauthenticated.',
    'Conflict.',
    'The given data was invalid.',
    'Payload Too Large.',
    'Nama diperlukan. (and 2 more errors)',
  ])('keeps "%s" as is', (text) => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    expect(envelope(422, 'VALIDATION_ERROR', text).message).toBe(text)
  })

  it('keeps an English 429 message as is', () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    expect(envelope(429, 'RATE_LIMITED', 'Too Many Attempts.').message).toBe('Too Many Attempts.')
  })
})
