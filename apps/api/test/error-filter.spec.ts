import { BadGatewayException, BadRequestException, HttpException, Logger, MethodNotAllowedException, PayloadTooLargeException, ServiceUnavailableException, UnsupportedMediaTypeException } from '@nestjs/common'
import { ERROR_CODES, ERROR_STATUS, ErrorBodySchema } from '@pp/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError, DEFAULT_ERROR_MESSAGES, unsupportedMediaTypeMessage } from '../src/common/errors/api-error'
import { DEFAULT_JSON_LIMIT_BYTES } from '../src/common/http/respond'
import { AllExceptionsFilter } from '../src/common/errors/all-exceptions.filter'

/** S0-T12 (X10.12 E-1): the BM defaults, the new codes and the unmapped 4xx, without a database. */
function run(exception: unknown, requestId = 'req-1', url = '/api/x') {
  const headers: Record<string, string> = { 'x-request-id': requestId }
  let status = 0
  let body: unknown
  const res = {
    setHeader: (k: string, v: string) => {
      headers[k.toLowerCase()] = v
    },
    status: (s: number) => {
      status = s
      return { json: (b: unknown) => (body = b) }
    },
  }
  const req = { id: requestId, method: 'GET', url, originalUrl: url }
  const host = { switchToHttp: () => ({ getResponse: () => res, getRequest: () => req }) }
  new AllExceptionsFilter().catch(exception, host as never)
  return { status, headers, error: ErrorBodySchema.parse(body).error }
}

describe('AllExceptionsFilter (S0-T12)', () => {
  let warn: ReturnType<typeof vi.spyOn>
  let error: ReturnType<typeof vi.spyOn>
  let info: ReturnType<typeof vi.spyOn>
  beforeEach(() => {
    warn = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined)
    error = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined)
    info = vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined)
  })
  afterEach(() => vi.restoreAllMocks())

  it('ApiError keeps its module message and carries requestId', () => {
    const r = run(ApiError.of('NOT_FOUND', { message: 'Pengguna tidak ditemui.' }))
    expect(r.status).toBe(404)
    expect(r.error).toMatchObject({ code: 'NOT_FOUND', message: 'Pengguna tidak ditemui.', requestId: 'req-1' })
    expect(r.headers['x-request-id']).toBe('req-1')
  })

  it('ApiError without a message gets the BM default', () => {
    expect(run(ApiError.of('UNAUTHORIZED')).error.message).toBe('Sesi anda telah tamat. Sila log masuk semula.')
    expect(run(ApiError.of('RATE_LIMITED', { retryAfter: 3 })).error.message).toBe('Terlalu banyak percubaan. Sila cuba sebentar lagi.')
  })

  it('400 keeps status 422 with code BAD_REQUEST and an info log without a stack', () => {
    const r = run(new BadRequestException('x'))
    expect(r.status).toBe(422)
    expect(r.error.code).toBe('BAD_REQUEST')
    expect(r.error.message).toBe('Permintaan tidak sah. Sila muat semula halaman dan cuba lagi.')
    expect(info).toHaveBeenCalledTimes(1)
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('405 (unmapped 4xx) keeps its status as BAD_REQUEST and is logged at info without a stack', () => {
    const r = run(new MethodNotAllowedException())
    expect(r.status).toBe(405)
    expect(r.error.code).toBe('BAD_REQUEST')
    expect(info).toHaveBeenCalledTimes(1)
    expect(String(info.mock.calls[0]?.[0])).not.toContain('\n    at ')
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
  })

  it('413 fills {n} from the body-parser limit, rounded up to whole MB (min 1)', () => {
    const big = Object.assign(new Error('too large'), { status: 413, limit: 2200 * 1024 })
    expect(run(big).error).toMatchObject({ code: 'PAYLOAD_TOO_LARGE', message: 'Fail atau data terlalu besar. Saiz maksimum ialah 3 MB.' })
    expect(run(new PayloadTooLargeException()).error.message).toBe('Fail atau data terlalu besar. Saiz maksimum ialah 1 MB.')
    expect(run(new PayloadTooLargeException()).status).toBe(413)
    // the default body limit (100kb) and a missing, NaN or zero limit all give the minimum 1 MB
    for (const limit of [100 * 1024, Number.NaN, 0]) {
      expect(run(Object.assign(new Error('too large'), { status: 413, limit })).error.message).toBe('Fail atau data terlalu besar. Saiz maksimum ialah 1 MB.')
    }
    expect(error).not.toHaveBeenCalled()
  })

  it('415 gives UNSUPPORTED_MEDIA_TYPE with the generic text', () => {
    const r = run(new UnsupportedMediaTypeException())
    expect(r.status).toBe(415)
    expect(r.error).toMatchObject({ code: 'UNSUPPORTED_MEDIA_TYPE', message: 'Jenis fail tidak disokong.' })
  })

  it.each([
    [502, 'BAD_GATEWAY', 'Sesuatu tidak kena di pihak kami. Pasukan teknikal telah dimaklumkan. Sila cuba sebentar lagi.'],
    [503, 'SERVICE_UNAVAILABLE', 'Sistem sedang diselenggara buat sementara waktu. Sila cuba semula dalam beberapa minit.'],
    [504, 'TIMEOUT', 'Permintaan mengambil masa terlalu lama. Cuba lagi.'],
  ])('%i keeps its status with code %s', (status, code, message) => {
    const ex = status === 502 ? new BadGatewayException() : status === 503 ? new ServiceUnavailableException() : new HttpException('x', 504)
    const r = run(ex)
    expect(r.status).toBe(status)
    expect(r.error).toMatchObject({ code, message })
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('another 5xx HttpException keeps its status as SERVER_ERROR with a stack log', () => {
    const r = run(new HttpException('x', 501))
    expect(r.status).toBe(501)
    expect(r.error.code).toBe('SERVER_ERROR')
    expect(error).toHaveBeenCalledTimes(1)
  })

  it('a plain Error is 500 SERVER_ERROR, the stack goes to the log only', () => {
    const boom = new Error('secret detail')
    const r = run(boom)
    expect(r.status).toBe(500)
    expect(r.error.code).toBe('SERVER_ERROR')
    expect(JSON.stringify(r.error)).not.toContain('secret detail')
    expect(String(error.mock.calls[0]?.[0])).toContain(boom.stack ?? 'no stack')
    expect(r.error.requestId).toBe('req-1')
  })

  it.each([
    [401, 'UNAUTHORIZED', 'Sesi anda telah tamat. Sila log masuk semula.'],
    [403, 'FORBIDDEN', 'Anda tidak dibenarkan melakukan tindakan ini.'],
    [404, 'NOT_FOUND', 'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?'],
    [409, 'CONFLICT', 'Tindakan ini bercanggah dengan keadaan semasa. Muat semula dan cuba lagi.'],
    [422, 'VALIDATION_ERROR', 'Data yang dihantar tidak sah. Sila semak dan cuba lagi.'],
    [429, 'RATE_LIMITED', 'Terlalu banyak percubaan. Sila cuba sebentar lagi.'],
  ])('plain %i HttpException gets the BM default for %s', (status, code, message) => {
    const r = run(new HttpException('x', status))
    expect(r.status).toBe(status)
    expect(r.error).toMatchObject({ code, message })
  })

  it('a 413 without a limit uses the configured default JSON limit (DEFAULT_JSON_LIMIT_BYTES)', () => {
    const mb = Math.max(1, Math.ceil(DEFAULT_JSON_LIMIT_BYTES / (1024 * 1024)))
    expect(run(new PayloadTooLargeException()).error.message).toBe(DEFAULT_ERROR_MESSAGES.PAYLOAD_TOO_LARGE.replace('{n}', String(mb)))
  })

  it('ERR-REQ-04 text: generic, and with the allowed list', () => {
    expect(unsupportedMediaTypeMessage()).toBe('Jenis fail tidak disokong.')
    expect(unsupportedMediaTypeMessage([])).toBe('Jenis fail tidak disokong.')
    expect(unsupportedMediaTypeMessage(['PDF', 'JPG', 'PNG'])).toBe('Jenis fail tidak disokong. Format dibenarkan: PDF, JPG, PNG.')
    const r = run(ApiError.of('UNSUPPORTED_MEDIA_TYPE', { message: unsupportedMediaTypeMessage(['PDF']) }))
    expect(r.status).toBe(415)
    expect(r.error.message).toBe('Jenis fail tidak disokong. Format dibenarkan: PDF.')
  })

  it.each([
    ['BAD_REQUEST', 422],
    ['PAYLOAD_TOO_LARGE', 413],
    ['UNSUPPORTED_MEDIA_TYPE', 415],
    ['BAD_GATEWAY', 502],
    ['SERVICE_UNAVAILABLE', 503],
    ['TIMEOUT', 504],
  ] as const)('%s is answered with HTTP %i (ERROR_STATUS and ApiError.of)', (code, status) => {
    expect(ERROR_STATUS[code]).toBe(status)
    expect(ApiError.of(code).getStatus()).toBe(status)
    expect(run(ApiError.of(code)).status).toBe(status)
  })

  it('every ErrorCode has a BM default message', () => {
    for (const code of ERROR_CODES) expect(DEFAULT_ERROR_MESSAGES[code].length).toBeGreaterThan(0)
  })

  it.each([
    [500, 'error'],
    [502, 'error'],
    [401, 'warn'],
    [403, 'warn'],
    [429, 'warn'],
    [404, 'info'],
    [409, 'info'],
    [422, 'info'],
    [405, 'info'],
  ] as const)('%i logs exactly one %s line (ApiError path too)', (status, level) => {
    const ex = status >= 500 || ![401, 403, 404, 409, 422, 429].includes(status) ? new HttpException('x', status) : new HttpException('x', status)
    run(ex)
    const spies = { error, warn, info }
    for (const [name, spy] of Object.entries(spies)) expect(spy).toHaveBeenCalledTimes(name === level ? 1 : 0)
    if (status < 500) expect(String(spies[level].mock.calls[0]?.[0])).not.toContain('\n    at ')
  })

  it('an ApiError 4xx is logged once at its level and an ApiError 5xx with a stack', () => {
    run(ApiError.of('FORBIDDEN'))
    expect(warn).toHaveBeenCalledTimes(1)
    run(new ApiError({ code: 'SERVER_ERROR', status: 500 }))
    expect(error).toHaveBeenCalledTimes(1)
    expect(String(error.mock.calls[0]?.[0])).toContain('Error')
  })

  it('the log line redacts a token-bearing path and the query values', () => {
    const token = '0123456789abcdef'.repeat(4)
    run(new HttpException('x', 404), 'req-1', `/api/parent-invites/${token}/accept?utm=secret`)
    run(new HttpException('x', 500), 'req-1', `/api/parent-invites/${token.toUpperCase()}`)
    const all = [...info.mock.calls, ...warn.mock.calls, ...error.mock.calls].map((c) => String(c[0])).join('\n')
    expect(all).not.toContain(token)
    expect(all).not.toContain(token.toUpperCase())
    expect(all).not.toContain('secret')
    expect(all).toContain('/api/parent-invites/[redacted]/accept?utm=[redacted]')
  })
})
