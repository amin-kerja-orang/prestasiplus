import { describe, expect, it } from 'vitest'

import { ApiError } from '@/api'

import { isGenericServerText, moduleMessage } from '../../lib/generic-server-text'

const fail = (status: number, message: string) => new ApiError({ status, code: 'X', message })

describe('isGenericServerText', () => {
  it.each([
    '',
    'HTTP 502',
    'Server Error',
    'Not Found.',
    'This action is unauthorized.',
    'Unauthenticated.',
    'Conflict.',
    'The given data was invalid.',
    'Payload Too Large.',
  ])('treats "%s" as generic', (text) => {
    expect(isGenericServerText(text)).toBe(true)
  })

  it('keeps a BM module message', () => {
    expect(isGenericServerText('Pelajar sudah berada dalam kelas ini.')).toBe(false)
  })
})

describe('moduleMessage', () => {
  it('returns the BM message of a 4xx ApiError', () => {
    expect(moduleMessage(fail(409, 'Kelas sudah wujud.'))).toBe('Kelas sudah wujud.')
    expect(moduleMessage(fail(404, 'Kod kelas tidak sah.'))).toBe('Kod kelas tidak sah.')
  })

  it('returns null for 5xx, status 0, generic English defaults and non-API errors', () => {
    expect(moduleMessage(fail(500, 'Server Error'))).toBeNull()
    expect(moduleMessage(fail(503, 'Perkhidmatan tidak tersedia.'))).toBeNull()
    expect(moduleMessage(fail(0, 'Failed to fetch'))).toBeNull()
    expect(moduleMessage(fail(404, 'Not Found.'))).toBeNull()
    expect(moduleMessage(fail(422, 'The given data was invalid.'))).toBeNull()
    expect(moduleMessage(new Error('boom'))).toBeNull()
  })
})
