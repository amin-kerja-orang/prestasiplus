import { describe, expect, it } from 'vitest'

import { errorFromResponse } from '@/api/errors'

import { pageMeta, pageParams, paged, paginate, unpaged } from '../paginate'
import {
  abort,
  blob,
  contentDisposition,
  created,
  fail,
  list,
  MockHttpError,
  noContent,
  ok,
  rateLimited,
  raw,
  summarizeFields,
  validationError,
} from '../respond'

describe('responders', () => {
  it('ok / created / noContent / list', () => {
    expect(ok({ a: 1 })).toEqual({
      status: 200,
      headers: { 'content-type': 'application/json' },
      body: { data: { a: 1 } },
    })
    expect(ok({ a: 1 }, { status: 'saved' }).body).toEqual({ data: { a: 1 }, status: 'saved' })
    expect(created({ id: 5 }).status).toBe(201)
    expect(noContent()).toEqual({ status: 204, headers: {}, body: null })
    const meta = { page: 1, pageSize: 2, totalItems: 1, totalPages: 1 }
    expect(list([1], meta).body).toEqual({ data: [1], meta })
    expect(() => ok(1, { data: 2 })).toThrow()
    expect(() => list([], meta, { meta: 1 })).toThrow()
  })

  it('fail builds the master SRS §7.3 error body that the client maps to ApiError', () => {
    const res = fail(422, 'VALIDATION_ERROR', 'Sila lengkapkan semua medan wajib.', {
      email: 'Format emel tidak sah.',
    })
    expect(res.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Sila lengkapkan semua medan wajib.',
        fields: { email: 'Format emel tidak sah.' },
      },
    })
    const err = errorFromResponse(res)
    expect(err).toMatchObject({
      status: 422,
      code: 'VALIDATION_ERROR',
      fields: { email: 'Format emel tidak sah.' },
    })
    expect(() => fail(200, 'X', 'no')).toThrow(RangeError)
    // Empty fields are left out.
    expect(fail(404, 'NOT_FOUND', 'x', {}).body).toEqual({
      error: { code: 'NOT_FOUND', message: 'x' },
    })
  })

  it('rateLimited sends retryAfter in the body and the Retry-After header', () => {
    const res = rateLimited(42, 'Too many login attempts. Please try again in 42 seconds.')
    expect(res.status).toBe(429)
    expect(res.headers['retry-after']).toBe('42')
    expect(errorFromResponse(res)).toMatchObject({ code: 'RATE_LIMITED', retryAfter: 42 })
  })

  it('validationError summarises like Laravel', () => {
    expect(summarizeFields({ a: 'A.' })).toBe('A.')
    expect(summarizeFields({ a: 'A.', b: 'B.' })).toBe('A. (and 1 more error)')
    expect(summarizeFields({ a: 'A.', b: 'B.', c: 'C.' })).toBe('A. (and 2 more errors)')
    expect(validationError({ a: 'A.' }, 'Custom').body).toMatchObject({
      error: { message: 'Custom' },
    })
  })

  it('raw keeps the body untouched; blob sets Content-Disposition', () => {
    expect(raw(200, [1, 2])).toMatchObject({ status: 200, body: [1, 2] })
    expect(raw(200, { ok: true, message: 'x' }, { 'X-Custom': 'y' }).headers['x-custom']).toBe('y')
    const b = new Blob(['a,b'], { type: 'text/csv' })
    const res = blob(b, 'templat soalan.csv')
    expect(res.body).toBe(b)
    expect(res.headers['content-type']).toBe('text/csv')
    expect(res.headers['content-disposition']).toBe(
      `attachment; filename="templat soalan.csv"; filename*=UTF-8''templat%20soalan.csv`,
    )
    expect(contentDisposition('résumé.pdf')).toContain(`filename*=UTF-8''r%C3%A9sum%C3%A9.pdf`)
  })

  it('abort throws a MockHttpError carrying the response', () => {
    expect(() => abort(409, 'CONFLICT', 'Sudah wujud.')).toThrow(MockHttpError)
    try {
      abort(noContent())
    } catch (err) {
      expect((err as MockHttpError).response.status).toBe(204)
    }
  })
})

describe('pagination (Laravel rules)', () => {
  const items = Array.from({ length: 45 }, (_, i) => i + 1)

  it('computes from/to/totalPages', () => {
    expect(paginate(items, { page: 1, pageSize: 20 }).body).toMatchObject({
      data: items.slice(0, 20),
      meta: { page: 1, pageSize: 20, totalItems: 45, totalPages: 3, from: 1, to: 20 },
    })
    expect(paginate(items, { page: 3, pageSize: 20 }).body).toMatchObject({
      data: [41, 42, 43, 44, 45],
      meta: { page: 3, totalPages: 3, from: 41, to: 45 },
    })
  })

  it('an out-of-range page is an empty page, not an error', () => {
    const res = paginate(items, { page: 9, pageSize: 20 })
    expect(res.status).toBe(200)
    expect(res.body).toEqual({
      data: [],
      meta: { page: 9, pageSize: 20, totalItems: 45, totalPages: 3, from: null, to: null },
    })
  })

  it('an empty list still has one page', () => {
    expect(pageMeta(0, { page: 1, pageSize: 20 }, 0)).toEqual({
      page: 1,
      pageSize: 20,
      totalItems: 0,
      totalPages: 1,
      from: null,
      to: null,
    })
  })

  it('extra meta (counts, aggregates) and pre-paged results', () => {
    const res = paginate(items, { page: 1, pageSize: 10 }, { counts: { all: 45, unread: 3 } })
    expect(res.body).toMatchObject({ meta: { counts: { all: 45, unread: 3 } } })
    expect(paged({ rows: [21, 22], total: 22 }, { page: 2, pageSize: 20 }).body).toMatchObject({
      data: [21, 22],
      meta: { totalItems: 22, totalPages: 2, from: 21, to: 22 },
    })
    expect(() => paged({ rows: [1, 2, 3], total: 3 }, { page: 1, pageSize: 2 })).toThrow()
    expect(unpaged([1, 2, 3]).body).toEqual({
      data: [1, 2, 3],
      meta: { page: 1, pageSize: 3, totalItems: 3, totalPages: 1, from: 1, to: 3 },
    })
  })

  it('pageParams: invalid page → 1; pageSize only when allowed, clamped', () => {
    expect(pageParams({}, { pageSize: 20 })).toEqual({ page: 1, pageSize: 20 })
    expect(pageParams({ page: 'abc' }, { pageSize: 20 }).page).toBe(1)
    expect(pageParams({ page: '0' }, { pageSize: 20 }).page).toBe(1)
    expect(pageParams({ page: ['4', '5'] }, { pageSize: 20 }).page).toBe(4)
    expect(pageParams({ pageSize: '50' }, { pageSize: 20 }).pageSize).toBe(20)
    expect(pageParams({ pageSize: '50' }, { pageSize: 20, maxPageSize: 30 }).pageSize).toBe(30)
    expect(pageParams({ pageSize: '5' }, { pageSize: 20, maxPageSize: 30 }).pageSize).toBe(5)
  })

  it('extra meta can never override the computed paging fields', () => {
    expect(() => paginate(items, { page: 1, pageSize: 10 }, { page: 9 } as never)).toThrow(
      /must not set 'page'/,
    )
    expect(() => unpaged([], { totalItems: 5 } as never)).toThrow(/must not set 'totalItems'/)
    expect(() =>
      paged({ rows: [], total: 0 }, { page: 1, pageSize: 5 }, { to: 1 } as never),
    ).toThrow(/'to'/)
  })

  it('unpaged([]) still has pageSize ≥ 1', () => {
    expect(unpaged([]).body).toEqual({
      data: [],
      meta: { page: 1, pageSize: 1, totalItems: 0, totalPages: 1, from: null, to: null },
    })
  })

  it('rejects invalid page requests from code', () => {
    expect(() => paginate([], { page: 0, pageSize: 10 })).toThrow(RangeError)
    expect(() => paginate([], { page: 1, pageSize: 0 })).toThrow(RangeError)
  })
})
