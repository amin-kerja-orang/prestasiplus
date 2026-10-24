import { describe, expect, it } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import { invalidFields, parsePupilCreate, parseReset, parseTeacherCreate, parseUserUpdate } from '../../src/modules/school-admin/people/people.input'

describe('people.input: Laravel-style body validation (pure)', () => {
  it('teacher create: required name and e-mail, valid e-mail, phone length', () => {
    expect(parseTeacherCreate({}).fields).toEqual({ name: 'The name field is required.', email: 'The email field is required.' })
    expect(parseTeacherCreate({ name: '   ', email: '' }).fields).toMatchObject({ name: 'The name field is required.' })
    expect(parseTeacherCreate({ name: 'Cikgu Demo', email: 'bukan-emel' }).fields).toEqual({ email: 'The email field must be a valid email address.' })
    expect(parseTeacherCreate({ name: 'Cikgu Demo', email: 'a@ujian.test', phone: '1'.repeat(15) }).fields).toEqual({ phone: 'The phone field must not be greater than 14 characters.' })
    expect(parseTeacherCreate({ name: 'x'.repeat(256), email: 'a@ujian.test' }).fields).toEqual({ name: 'The name field must not be greater than 255 characters.' })
    expect(parseTeacherCreate({ name: 5, email: 'a@ujian.test' }).fields).toEqual({ name: 'The name field must be a string.' })
  })

  it('teacher create: trims, blank phone is null', () => {
    const { value, fields } = parseTeacherCreate({ name: ' Cikgu Demo ', email: ' a@ujian.test ', phone: ' ' })
    expect(fields).toEqual({})
    expect(value).toEqual({ name: 'Cikgu Demo', email: 'a@ujian.test', phone: null })
  })

  it('teacher create is strict (#97): every other key is named in fields and no value is returned', () => {
    const { value, fields } = parseTeacherCreate({ name: 'Cikgu Demo', email: 'a@ujian.test', role: 'admin', schoolId: '9', isActive: false, password: 'x' })
    expect(value).toBeNull()
    expect(fields).toEqual({
      role: 'The role field is not allowed.',
      schoolId: 'The schoolId field is not allowed.',
      isActive: 'The isActive field is not allowed.',
      password: 'The password field is not allowed.',
    })
    // Listed after the field rules of the known keys; a `__proto__` key is named like any other.
    const mixed = parseTeacherCreate(JSON.parse('{"name":"","email":"a@ujian.test","__proto__":{"x":1}}'))
    expect(Object.keys(mixed.fields)).toEqual(['name', '__proto__'])
  })

  it('pupil create: name at least 3, classId must look like an id, role/grade/icNumber are ignored', () => {
    expect(parsePupilCreate({ name: 'Al', email: 'a@ujian.test' }).fields).toEqual({ name: 'The name field must be at least 3 characters.' })
    expect(parsePupilCreate({ name: 'Aina', email: 'a@ujian.test', classId: 'abc' }).fields).toEqual({ classId: 'The selected class id is invalid.' })
    expect(parsePupilCreate({ name: 'Aina', email: 'a@ujian.test', classId: 7 }).fields).toEqual({ classId: 'The selected class id is invalid.' })
    expect(parsePupilCreate({ name: 'Aina', email: 'a@ujian.test', classId: '' }).value).toEqual({ name: 'Aina', email: 'a@ujian.test', classId: null })
    const ok = parsePupilCreate({ name: 'Aina', email: 'a@ujian.test', classId: '42', role: 'admin', grade: 11, icNumber: '010101010101', isActive: false })
    expect(ok.value).toEqual({ name: 'Aina', email: 'a@ujian.test', classId: '42' })
    expect(JSON.stringify(ok)).not.toContain('010101010101')
  })

  it('update: name and e-mail required; absent phone keeps, null clears; password optional and confirmed', () => {
    expect(parseUserUpdate({}).fields).toMatchObject({ name: 'The name field is required.' })
    expect(parseUserUpdate({ name: 'A', email: 'a@ujian.test' }).value).toEqual({ name: 'A', email: 'a@ujian.test' })
    expect(parseUserUpdate({ name: 'A', email: 'a@ujian.test', phone: null }).value).toEqual({ name: 'A', email: 'a@ujian.test', phone: null })
    expect(parseUserUpdate({ name: 'A', email: 'a@ujian.test', newPassword: '' }).value).toEqual({ name: 'A', email: 'a@ujian.test' })
    expect(parseUserUpdate({ name: 'A', email: 'a@ujian.test', newPassword: 'short', newPasswordConfirmation: 'short' }).fields).toEqual({
      newPassword: 'The new password field must be at least 8 characters.',
    })
    expect(parseUserUpdate({ name: 'A', email: 'a@ujian.test', newPassword: 'panjang-123', newPasswordConfirmation: 'lain-123456' }).fields).toEqual({
      newPassword: 'The new password field confirmation does not match.',
    })
    expect(parseUserUpdate({ name: 'A', email: 'a@ujian.test', newPassword: 'x'.repeat(256), newPasswordConfirmation: 'x'.repeat(256) }).fields).toEqual({
      newPassword: 'The new password field must not be greater than 255 characters.',
    })
    expect(parseUserUpdate({ name: 'A', email: 'a@ujian.test', newPassword: 'panjang-123', newPasswordConfirmation: 'panjang-123' }).value).toMatchObject({ newPassword: 'panjang-123' })
  })

  it('reset: the password is required, 8 to 255 characters, confirmed', () => {
    expect(parseReset({}).fields).toEqual({ newPassword: 'The new password field is required.' })
    expect(parseReset({ newPassword: 123456789 }).fields).toEqual({ newPassword: 'The new password field must be a string.' })
    expect(parseReset({ newPassword: 'abc', newPasswordConfirmation: 'abc' }).fields.newPassword).toBe('The new password field must be at least 8 characters.')
    expect(parseReset({ newPassword: 'abcdefgh' }).fields.newPassword).toBe('The new password field confirmation does not match.')
    expect(parseReset({ newPassword: 'abcdefgh', newPasswordConfirmation: 'abcdefgh' })).toEqual({ value: 'abcdefgh', fields: {} })
    expect(parseReset('not an object').fields.newPassword).toBe('The new password field is required.')
    expect(parseReset(['x']).value).toBeNull()
  })

  it('the 422 message is the first one plus "(and N more error(s))"', () => {
    const one = invalidFields({ email: 'The email has already been taken.' })
    expect(one).toBeInstanceOf(ApiError)
    expect(one.getStatus()).toBe(422)
    expect(one.message).toBe('The email has already been taken.')
    expect(invalidFields({ a: 'A.', b: 'B.' }).message).toBe('A. (and 1 more error)')
    expect(invalidFields({ a: 'A.', b: 'B.', c: 'C.' }).message).toBe('A. (and 2 more errors)')
  })
})
