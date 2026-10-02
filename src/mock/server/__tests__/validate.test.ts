import { describe, expect, it } from 'vitest'

import {
  assertValid,
  attributeName,
  confirmed,
  email,
  exists,
  max,
  min,
  oneOf,
  required,
  rule,
  unique,
  validate,
  validationErrors,
} from '../validate'
import { MockHttpError } from '../respond'

describe('validation helper', () => {
  it('produces the M01 §5 (Laravel 11) messages', () => {
    const taken = new Set(['ada@demo.test'])
    const fields = validationErrors(
      {
        email: 'ada@demo.test',
        password: 'abc',
        passwordConfirmation: 'abd',
        bio: 'x'.repeat(501),
      },
      {
        name: [required()],
        email: [required(), email(), unique((v) => taken.has(String(v)))],
        password: [required(), min(6), confirmed()],
        bio: [max(500)],
      },
    )
    expect(fields).toEqual({
      name: 'The name field is required.',
      email: 'The email has already been taken.',
      password: 'The password field must be at least 6 characters.',
      bio: 'The bio field must not be greater than 500 characters.',
    })
  })

  it('reports the first failing rule per field and skips optional empty values', () => {
    expect(validationErrors({ password: 'abc' }, { password: [min(6), confirmed()] })).toEqual({
      password: 'The password field must be at least 6 characters.',
    })
    expect(validationErrors({ bio: '' }, { bio: [max(5)], phone: [min(3)] })).toBeNull()
    expect(validationErrors({ name: '   ' }, { name: [required()] })).toEqual({
      name: 'The name field is required.',
    })
  })

  it('measures numbers, arrays and files', () => {
    const big = new Blob([new Uint8Array(3 * 1024)])
    expect(
      validationErrors(
        { age: 3, ids: [1, 2, 3], profilePicture: big },
        { age: [min(5)], ids: [max(2)], profilePicture: [max(2)] },
      ),
    ).toEqual({
      age: 'The age field must be at least 5.',
      ids: 'The ids field must not have more than 2 items.',
      profilePicture: 'The profile picture field must not be greater than 2 kilobytes.',
    })
  })

  it('in / exists / email / custom rules', () => {
    expect(
      validationErrors(
        { role: 'pirate', schoolId: 99, email: 'not-an-email', grade: 'T6' },
        {
          role: [oneOf(['student', 'teacher'])],
          schoolId: [exists((v) => v === 900001)],
          email: [email()],
          grade: [rule('grade', (v) => (v === 'T6' ? 'Tingkatan tidak sah.' : null))],
        },
      ),
    ).toEqual({
      role: 'The selected role is invalid.',
      schoolId: 'The selected school id is invalid.',
      email: 'The email field must be a valid email address.',
      grade: 'Tingkatan tidak sah.',
    })
    expect(validationErrors({ level: 4 }, { level: [oneOf(['4', '5'])] })).toBeNull()
  })

  it('custom messages: per rule argument, per field.rule, per rule, and attribute names', () => {
    expect(validationErrors({}, { email: [required('Sila isi e-mel.')] })).toEqual({
      email: 'Sila isi e-mel.',
    })
    expect(
      validationErrors(
        {},
        { a: [required()], b: [required()] },
        {
          messages: { 'a.required': 'A wajib.', required: ':attribute wajib diisi.' },
          attributes: { b: 'Nama' },
        },
      ),
    ).toEqual({ a: 'A wajib.', b: 'Nama wajib diisi.' })
  })

  it('validate → 422 response; assertValid throws a MockHttpError', () => {
    const res = validate({}, { name: [required()], email: [required()] })
    expect(res?.status).toBe(422)
    expect(res?.body).toEqual({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'The name field is required. (and 1 more error)',
        fields: { name: 'The name field is required.', email: 'The email field is required.' },
      },
    })
    expect(validate({ name: 'x' }, { name: [required()] })).toBeNull()
    expect(() => assertValid({}, { name: [required()] })).toThrow(MockHttpError)
  })

  it('reads nested paths and non-object input', () => {
    expect(validationErrors({ a: { b: '' } }, { 'a.b': [required()] })).toEqual({
      'a.b': 'The a.b field is required.',
    })
    expect(validationErrors(null, { x: [required()] })).toEqual({ x: 'The x field is required.' })
  })

  it('attributeName', () => {
    expect(attributeName('profilePicture')).toBe('profile picture')
    expect(attributeName('password_confirmation')).toBe('password confirmation')
    expect(attributeName('icNumber')).toBe('ic number')
  })
})
