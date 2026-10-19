// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '@/api'

import { pageOf, queryText } from '../../lib/route-query'
import { saveBlob } from '@/lib/save-blob'
import { errorLines, fieldErrors, GENERIC_ERROR, isNotFound, LOAD_ERROR } from '../../lib/ui-errors'

describe('ui-errors', () => {
  it('uses the SRS load-failure copy', () => {
    expect(LOAD_ERROR).toBe('Maaf, berlaku ralat. Sila cuba semula.')
  })

  it('errorLines prefers field messages, then the message, then the generic text', () => {
    const withFields = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'Data tidak sah.',
      fields: { image: 'Sila pilih fail gambar.' },
    })
    expect(errorLines(withFields)).toEqual(['Sila pilih fail gambar.'])
    expect(
      errorLines(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'Tidak dijumpai.' })),
    ).toEqual(['Tidak dijumpai.'])
    expect(
      errorLines(new ApiError({ status: 500, code: 'SERVER_ERROR', message: 'HTTP 500' })),
    ).toEqual([GENERIC_ERROR])
    expect(errorLines(new Error('x'))).toEqual([GENERIC_ERROR])
  })

  it('fieldErrors returns a copy of the server fields, else nothing', () => {
    const err = new ApiError({
      status: 422,
      code: 'VALIDATION_ERROR',
      message: 'x',
      fields: { image: 'a' },
    })
    expect(fieldErrors(err)).toEqual({ image: 'a' })
    expect(fieldErrors(new Error('x'))).toEqual({})
  })

  it('isNotFound is true only for a 404 ApiError', () => {
    expect(isNotFound(new ApiError({ status: 404, code: 'NOT_FOUND', message: 'x' }))).toBe(true)
    expect(isNotFound(new ApiError({ status: 500, code: 'E', message: 'x' }))).toBe(false)
    expect(isNotFound(null)).toBe(false)
  })
})

describe('route-query', () => {
  it('queryText takes the first value and defaults to empty', () => {
    expect(queryText(undefined)).toBe('')
    expect(queryText(null)).toBe('')
    expect(queryText('a')).toBe('a')
    expect(queryText(['b', 'c'])).toBe('b')
  })

  it('pageOf is 1-based and falls back to 1', () => {
    expect(pageOf('3')).toBe(3)
    expect(pageOf('0')).toBe(1)
    expect(pageOf('abc')).toBe(1)
    expect(pageOf(undefined)).toBe(1)
  })
})

describe('saveBlob', () => {
  afterEach(() => vi.useRealTimers())

  it('clicks a download link and releases the object URL only afterwards', () => {
    vi.useFakeTimers()
    const create = vi.fn(() => 'blob:x')
    const revoke = vi.fn()
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke })
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined)
    saveBlob(new Blob(['a']), 'a.txt')
    expect(click).toHaveBeenCalledOnce()
    expect(revoke).not.toHaveBeenCalled()
    vi.runAllTimers()
    expect(revoke).toHaveBeenCalledWith('blob:x')
  })
})
