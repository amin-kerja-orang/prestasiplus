/**
 * M27-T0a: the M02 school-admin write contract (`schoolAdminUsers`, XR-M27-17; M27 SRS BR-M27-31…34, 41,
 * G1-1, G1-2, G1-9). One shared boot; every test creates its own users, so the order does not matter.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { bootMock } from '@/mock/index'
import { users, type UserRow } from '@/modules/m01-authentication/mock'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import {
  MSG_ACCOUNT_INACTIVE,
  MSG_ROLE_NOT_MANAGED,
  MSG_USER_NOT_FOUND,
  SchoolAdminWriteError,
  schoolAdminUsers as svc,
} from '../../mock'
import { M02_CONFIG_DEFAULTS } from '../../mock/m02-config'

const NOW = Date.parse(CLOCK_ANCHOR_ISO)
const ACTOR = 8

let school = 0
let otherSchool = 0
let classId = 0
let foreignClassId = 0
let foreignPupil: UserRow
let foreignAdminLike: UserRow
let n = 0

beforeAll(async () => {
  await bootMock({
    mode: 'test',
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
  const rooms = classrooms.list({ kind: 'classroom' }).filter((c) => c.schoolId !== null)
  const first = rooms[0]
  const other = rooms.find((c) => c.schoolId !== first?.schoolId)
  if (!first?.schoolId || !other?.schoolId) throw new Error('no two schools with classrooms')
  school = first.schoolId
  classId = first.classId
  otherSchool = other.schoolId
  foreignClassId = other.classId
  const pupil = users.adminList({ role: 'student', schoolId: otherSchool, page: 1, pageSize: 1 })
    .rows[0]
  if (!pupil) throw new Error('no foreign pupil')
  foreignPupil = pupil
  foreignAdminLike = users.create(
    {
      name: 'Pentadbir Rakan',
      email: 'rakan.admin@demo.test',
      role: 'school_admin',
      schoolId: school,
    },
    NOW,
  )
}, 400_000)

function mail(): string {
  n++
  return `ujian.t0a${String(n)}@demo.test`
}

function teacher(extra: Partial<Parameters<typeof svc.createTeacher>[1]> = {}): UserRow {
  return svc.createTeacher(
    school,
    {
      name: 'Guru Ujian',
      email: mail(),
      password: 'rahsia123',
      passwordConfirmation: 'rahsia123',
      ...extra,
    },
    ACTOR,
    NOW,
  )
}

function pupil(extra: Partial<Parameters<typeof svc.createPupil>[1]> = {}) {
  return svc.createPupil(school, { name: 'Murid Ujian', email: mail(), ...extra }, ACTOR, NOW)
}

function refused(fn: () => unknown): SchoolAdminWriteError {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(SchoolAdminWriteError)
    return e as SchoolAdminWriteError
  }
  throw new Error('expected a SchoolAdminWriteError')
}

describe('createTeacher', () => {
  it('creates an active teacher of the school with createdById and a working password', () => {
    const row = teacher({ phone: '0123456789' })
    expect(row).toMatchObject({
      role: 'teacher',
      schoolId: school,
      isActive: true,
      createdById: ACTOR,
      phone: '0123456789',
      grade: null,
    })
    expect(users.verifyPassword(row.id, 'rahsia123')).toBe(true)
  })

  it('ignores role, schoolId and isActive keys of the input', () => {
    const input = {
      name: 'Guru Lain',
      email: mail(),
      password: 'rahsia123',
      passwordConfirmation: 'rahsia123',
      role: 'admin',
      schoolId: otherSchool,
      isActive: false,
    }
    const row = svc.createTeacher(school, input, ACTOR, NOW)
    expect(row).toMatchObject({ role: 'teacher', schoolId: school, isActive: true })
  })

  it('refuses with 422 fields: name, e-mail (invalid, used), phone, password min 6 and confirmation', () => {
    const e = refused(() =>
      svc.createTeacher(
        school,
        {
          name: '',
          email: 'bukan-emel',
          phone: '1'.repeat(15),
          password: '12345',
          passwordConfirmation: 'x',
        },
        ACTOR,
        NOW,
      ),
    )
    expect(e.status).toBe(422)
    expect(Object.keys(e.fields ?? {}).sort()).toEqual(['email', 'name', 'password', 'phone'])
    const used = teacher()
    const dup = refused(() => teacher({ email: used.email }))
    expect(dup.fields).toHaveProperty('email')
    expect(
      refused(() => teacher({ password: 'rahsia123', passwordConfirmation: 'lain' })).fields,
    ).toHaveProperty('password')
  })

  it('accepts a 6 character password (M02 minimum) and a missing phone', () => {
    expect(teacher({ password: '123456', passwordConfirmation: '123456' }).phone).toBeNull()
  })
})

describe('createPupil', () => {
  it('creates an active pupil, empty password means the default, returned once', () => {
    const r = pupil({ password: '' })
    expect(r.password).toBe(M02_CONFIG_DEFAULTS.bulkImportDefaultPassword)
    expect(r.user).toMatchObject({
      role: 'student',
      schoolId: school,
      isActive: true,
      createdById: ACTOR,
    })
    expect(users.verifyPassword(r.user.id, r.password)).toBe(true)
    expect(JSON.stringify(r.user)).not.toContain(r.password)
  })

  it('honours a supplied default password (handler override) only when the password is empty', () => {
    const a = svc.createPupil(school, { name: 'Murid Ujian', email: mail() }, ACTOR, NOW, {
      defaultPassword: 'LainLalai99',
    })
    expect(a.password).toBe('LainLalai99')
    const b = svc.createPupil(
      school,
      { name: 'Murid Ujian', email: mail(), password: 'sendiri123' },
      ACTOR,
      NOW,
      { defaultPassword: 'LainLalai99' },
    )
    expect(b.password).toBe('sendiri123')
  })

  it('password minimum is 8 here (7 refused, 8 accepted), maximum 255', () => {
    expect(refused(() => pupil({ password: '1234567' })).fields).toHaveProperty('password')
    expect(pupil({ password: '12345678' }).password).toBe('12345678')
    expect(refused(() => pupil({ password: 'a'.repeat(256) })).fields).toHaveProperty('password')
    expect(pupil({ password: 'a'.repeat(255) }).user.role).toBe('student')
  })

  it('name is 3 to 255 characters', () => {
    expect(refused(() => pupil({ name: 'Ab' })).fields).toHaveProperty('name')
    expect(refused(() => pupil({ name: 'a'.repeat(256) })).fields).toHaveProperty('name')
    expect(pupil({ name: 'Abu' }).user.name).toBe('Abu')
  })

  it('e-mail is required, valid and unique', () => {
    expect(refused(() => pupil({ email: '' })).fields).toHaveProperty('email')
    expect(refused(() => pupil({ email: 'xx' })).fields).toHaveProperty('email')
    const first = pupil()
    expect(refused(() => pupil({ email: first.user.email })).fields).toHaveProperty('email')
  })

  it('enrols into a classroom of the school with source school_admin', () => {
    const r = pupil({ classId })
    const enrolment = classrooms.enrolmentsOf(r.user.id).find((e) => e.classroomId === classId)
    expect(enrolment).toMatchObject({
      classroomKind: 'classroom',
      source: 'school_admin',
      status: 'active',
    })
  })

  it('a foreign, unknown or non-numeric classId is 422 on classId and creates nobody', () => {
    const before = users.adminList({
      role: 'student',
      schoolId: school,
      page: 1,
      pageSize: 1,
    }).total
    for (const bad of [foreignClassId, 987_654_321, Number.NaN]) {
      const e = refused(() => pupil({ classId: bad }))
      expect(e.status).toBe(422)
      expect(Object.keys(e.fields ?? {})).toEqual(['classId'])
    }
    expect(users.adminList({ role: 'student', schoolId: school, page: 1, pageSize: 1 }).total).toBe(
      before,
    )
  })

  it('does not enrol when classId is absent', () => {
    expect(classrooms.enrolmentsOf(pupil().user.id)).toHaveLength(0)
  })
})

describe('updateUser', () => {
  it('updates name, e-mail and phone of a teacher; role, school and status stay', () => {
    const t = teacher()
    const out = svc.updateUser(
      school,
      'teacher',
      t.id,
      { name: 'Guru Baharu', email: mail(), phone: '0111111111' },
      NOW,
    )
    expect(out).toMatchObject({
      name: 'Guru Baharu',
      phone: '0111111111',
      role: 'teacher',
      schoolId: school,
      isActive: true,
    })
    expect(users.verifyPassword(t.id, 'rahsia123')).toBe(true)
  })

  it('updates a pupil and clears the phone with null', () => {
    const p = pupil().user
    svc.updateUser(
      school,
      'student',
      p.id,
      { name: 'Murid A', email: p.email, phone: '0100000000' },
      NOW,
    )
    expect(
      svc.updateUser(school, 'student', p.id, { name: 'Murid A', email: p.email, phone: null }, NOW)
        .phone,
    ).toBeNull()
  })

  it('keeps the phone when the key is absent; the own e-mail is not a duplicate', () => {
    const t = teacher({ phone: '0123456789' })
    const out = svc.updateUser(school, 'teacher', t.id, { name: 'Sama', email: t.email }, NOW)
    expect(out.phone).toBe('0123456789')
  })

  it('a filled new password replaces the old one (min 6, confirmed); empty keeps it', () => {
    const t = teacher()
    const base = { name: t.name, email: t.email }
    svc.updateUser(
      school,
      'teacher',
      t.id,
      { ...base, newPassword: '', newPasswordConfirmation: '' },
      NOW,
    )
    expect(users.verifyPassword(t.id, 'rahsia123')).toBe(true)
    expect(
      refused(() =>
        svc.updateUser(
          school,
          'teacher',
          t.id,
          { ...base, newPassword: '12345', newPasswordConfirmation: '12345' },
          NOW,
        ),
      ).fields,
    ).toHaveProperty('newPassword')
    expect(
      refused(() =>
        svc.updateUser(
          school,
          'teacher',
          t.id,
          { ...base, newPassword: 'abcdef', newPasswordConfirmation: 'abcdeg' },
          NOW,
        ),
      ).fields,
    ).toHaveProperty('newPassword')
    svc.updateUser(
      school,
      'teacher',
      t.id,
      { ...base, newPassword: 'abcdef', newPasswordConfirmation: 'abcdef' },
      NOW,
    )
    expect(users.verifyPassword(t.id, 'abcdef')).toBe(true)
    expect(users.verifyPassword(t.id, 'rahsia123')).toBe(false)
  })

  it('validates name, e-mail (unique against others), phone and changes nothing on refusal', () => {
    const a = teacher()
    const b = teacher()
    const e = refused(() =>
      svc.updateUser(
        school,
        'teacher',
        b.id,
        { name: '', email: a.email, phone: '1'.repeat(15) },
        NOW,
      ),
    )
    expect(Object.keys(e.fields ?? {}).sort()).toEqual(['email', 'name', 'phone'])
    expect(users.get(b.id)?.email).toBe(b.email)
  })

  it('a user of another school is 404 and untouched', () => {
    const e = refused(() =>
      svc.updateUser(school, 'student', foreignPupil.id, { name: 'Dirampas', email: mail() }, NOW),
    )
    expect(e).toMatchObject({ status: 404, message: MSG_USER_NOT_FOUND })
    expect(users.get(foreignPupil.id)?.name).toBe(foreignPupil.name)
  })

  it('the wrong role for the id, an unknown id and a non-managed role', () => {
    const t = teacher()
    expect(
      refused(() => svc.updateUser(school, 'student', t.id, { name: 'X Y', email: mail() }, NOW))
        .status,
    ).toBe(404)
    expect(
      refused(() =>
        svc.updateUser(school, 'teacher', 987_654_321, { name: 'X Y', email: mail() }, NOW),
      ).status,
    ).toBe(404)
    const e = refused(() =>
      svc.updateUser(
        school,
        'school_admin' as never,
        foreignAdminLike.id,
        { name: 'X Y', email: mail() },
        NOW,
      ),
    )
    expect(e).toMatchObject({ status: 403, message: MSG_ROLE_NOT_MANAGED })
    expect(
      refused(() =>
        svc.updateUser(school, 'teacher', foreignAdminLike.id, { name: 'X Y', email: mail() }, NOW),
      ).status,
    ).toBe(404)
  })

  it('an inactive account is 403', () => {
    const t = teacher()
    svc.setTeacherActive(school, t.id, false, NOW)
    const e = refused(() =>
      svc.updateUser(school, 'teacher', t.id, { name: 'Lagi', email: t.email }, NOW),
    )
    expect(e).toMatchObject({ status: 403, message: MSG_ACCOUNT_INACTIVE })
  })
})

describe('setTeacherActive', () => {
  it('switches both ways and works on an inactive account', () => {
    const t = teacher()
    expect(svc.setTeacherActive(school, t.id, false, NOW).isActive).toBe(false)
    expect(svc.setTeacherActive(school, t.id, false, NOW).isActive).toBe(false)
    expect(svc.setTeacherActive(school, t.id, true, NOW).isActive).toBe(true)
  })

  it('pupils are read-only (403) and a peer school admin is not manageable', () => {
    const p = pupil().user
    expect(refused(() => svc.setTeacherActive(school, p.id, false, NOW))).toMatchObject({
      status: 403,
    })
    expect(users.get(p.id)?.isActive).toBe(true)
    expect(
      refused(() => svc.setTeacherActive(school, foreignAdminLike.id, false, NOW)).status,
    ).toBe(403)
    expect(users.get(foreignAdminLike.id)?.isActive).toBe(true)
  })

  it('a teacher of another school or an unknown id is 404', () => {
    const t = teacher()
    expect(refused(() => svc.setTeacherActive(otherSchool, t.id, false, NOW)).status).toBe(404)
    expect(users.get(t.id)?.isActive).toBe(true)
    expect(refused(() => svc.setTeacherActive(school, 987_654_321, true, NOW)).status).toBe(404)
  })
})

describe('resetPassword', () => {
  it('replaces the password of a pupil and a teacher at once', () => {
    const t = teacher()
    svc.resetPassword(
      school,
      'teacher',
      t.id,
      { newPassword: 'baharu123', newPasswordConfirmation: 'baharu123' },
      NOW,
    )
    expect(users.verifyPassword(t.id, 'baharu123')).toBe(true)
    expect(users.verifyPassword(t.id, 'rahsia123')).toBe(false)
    const p = pupil().user
    svc.resetPassword(
      school,
      'student',
      p.id,
      { newPassword: 'abcdef', newPasswordConfirmation: 'abcdef' },
      NOW,
    )
    expect(users.verifyPassword(p.id, 'abcdef')).toBe(true)
  })

  it('min 6, confirmed, required; the old password stays on refusal', () => {
    const t = teacher()
    for (const input of [
      { newPassword: '12345', newPasswordConfirmation: '12345' },
      { newPassword: 'abcdef', newPasswordConfirmation: 'abcdeg' },
      { newPassword: '', newPasswordConfirmation: '' },
    ]) {
      expect(
        refused(() => svc.resetPassword(school, 'teacher', t.id, input, NOW)).fields,
      ).toHaveProperty('newPassword')
    }
    expect(users.verifyPassword(t.id, 'rahsia123')).toBe(true)
  })

  it('403 for an inactive account, 404 for another school', () => {
    const t = teacher()
    svc.setTeacherActive(school, t.id, false, NOW)
    const ok = { newPassword: 'abcdef', newPasswordConfirmation: 'abcdef' }
    expect(refused(() => svc.resetPassword(school, 'teacher', t.id, ok, NOW)).status).toBe(403)
    expect(users.verifyPassword(t.id, 'abcdef')).toBe(false)
    expect(
      refused(() => svc.resetPassword(school, 'student', foreignPupil.id, ok, NOW)).status,
    ).toBe(404)
  })
})
