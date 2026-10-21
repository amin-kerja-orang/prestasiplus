import { SCHOOL_ADMIN_USER_CSV_COLUMNS, SchoolAdminPupilRowSchema, SchoolAdminTeacherRowSchema, SchoolAdminUserDetailSchema } from '@pp/contract'
import { describe, expect, it } from 'vitest'

import { gradeLabel, initialsOf, isEffectivelyActive, toPupilRow, toSchoolInfo, toTeacherRow, toUserDetail, usersCsv } from '../../src/modules/school-admin/people/people.mapper'
import type { SchoolRow } from '../../src/modules/schools'
import type { UserRecord } from '../../src/modules/users'

const user = (over: Partial<UserRecord> = {}): UserRecord => ({
  id: '101',
  name: 'Aina Binti Demo',
  email: 'aina@ujian.test',
  username: 'secret-username',
  phone: '0123456789',
  schoolId: '5',
  grade: 10,
  bio: null,
  idDelima: 'DELIMA-1',
  icMasked: 'xxxxxx-xx-xx34',
  isActive: true,
  isSuspended: false,
  mustChangePassword: false,
  createdAt: new Date('2026-10-01T02:00:00Z'),
  updatedAt: new Date('2026-10-02T02:00:00Z'),
  lastLoginAt: new Date('2026-10-20T01:00:00Z'),
  roles: ['student'],
  ppd: null,
  ...over,
})

const school: SchoolRow = {
  id: '5',
  name: 'SMK Demo Satu',
  code: 'DEMO001',
  type: 'SMK',
  state: 'Selangor',
  district: 'Petaling',
  city: null,
  joinCode: 'JOINSECRET',
  jpnId: null,
  ppdId: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
}

describe('people.mapper (pure)', () => {
  it('initials: first letters of the first two words, upper case, "?" when empty', () => {
    expect(initialsOf('aina binti demo')).toBe('AB')
    expect(initialsOf('  Aina ')).toBe('A')
    expect(initialsOf('')).toBe('?')
  })

  it('grade label: Darjah 1-6, Tingkatan 1-5 (grades 7-11), otherwise null', () => {
    expect([1, 6, 7, 10, 11].map(gradeLabel)).toEqual(['Darjah 1', 'Darjah 6', 'Tingkatan 1', 'Tingkatan 4', 'Tingkatan 5'])
    expect([null, 0, 12, 2.5].map((g) => gradeLabel(g))).toEqual([null, null, null, null])
  })

  it('a suspended account is shown as inactive and cannot be edited', () => {
    expect(isEffectivelyActive(user({ isSuspended: true }))).toBe(false)
    const row = toPupilRow(user({ isSuspended: true }), [])
    expect(row).toMatchObject({ isActive: false, canEdit: false })
  })

  it('teacher row matches the contract and carries the Malaysia timestamps', () => {
    const row = SchoolAdminTeacherRowSchema.parse(toTeacherRow(user({ roles: ['teacher'] }), 3))
    expect(row).toMatchObject({ classCount: 3, createdAt: '2026-10-01T10:00:00.000+08:00', lastLoginAt: '2026-10-20T09:00:00.000+08:00', canEdit: true })
    expect(toTeacherRow(user({ lastLoginAt: null }), 0).lastLoginAt).toBeNull()
  })

  it('pupil row matches the contract and leaks no IC, username, id-delima or join code', () => {
    const row = toPupilRow(user(), ['4 Amanah'])
    SchoolAdminPupilRowSchema.parse(row)
    expect(row).toMatchObject({ gradeLabel: 'Tingkatan 4', classNames: ['4 Amanah'] })
    const text = JSON.stringify([row, toTeacherRow(user(), 0), toUserDetail(user(), 'student', school)])
    for (const secret of ['secret-username', 'DELIMA-1', 'xxxxxx', 'JOINSECRET', 'icHash', 'passwordHash']) expect(text).not.toContain(secret)
  })

  it('detail matches the contract; a blank school code is null', () => {
    SchoolAdminUserDetailSchema.parse(toUserDetail(user(), 'student', school))
    expect(toSchoolInfo({ ...school, code: ' ' }).code).toBeNull()
    expect(toSchoolInfo({ ...school, state: null }).state).toBe('')
  })

  it('a user without an e-mail is an empty string, never null', () => {
    expect(toPupilRow(user({ email: null }), []).email).toBe('')
  })

  it('csv: BOM, contract header, LF, trailing newline, no IC and no phone column', () => {
    const csv = usersCsv([user(), user({ id: '102', name: 'Budi', isActive: false })], 'pelajar', 'SMK Demo Satu', (u) => (u.id === '101' ? 'A, B' : ''))
    expect(csv.startsWith('﻿' + SCHOOL_ADMIN_USER_CSV_COLUMNS.join(',') + '\n')).toBe(true)
    expect(csv.endsWith('\n')).toBe(true)
    expect(csv).not.toContain('\r')
    const lines = csv.slice(1).trimEnd().split('\n')
    expect(lines[1]).toBe('101,Aina Binti Demo,aina@ujian.test,pelajar,SMK Demo Satu,"A, B",1,2026-10-01T10:00:00.000+08:00')
    expect(lines[2]).toContain(',0,')
    for (const secret of ['0123456789', 'xxxxxx', 'secret-username']) expect(csv).not.toContain(secret)
  })

  it('csv: a pupil named =HYPERLINK(...) or starting with + - @ is neutralised', () => {
    const csv = usersCsv(
      [user({ name: '=HYPERLINK("http://x.test","klik")' }), user({ id: '2', name: '+1' }), user({ id: '3', name: '-2' }), user({ id: '4', name: '@SUM(A1)' })],
      'pelajar',
      'S',
      () => '',
    )
    expect(csv).toContain(`"'=HYPERLINK(""http://x.test"",""klik"")"`)
    expect(csv).toContain(",'+1,")
    expect(csv).toContain(",'-2,")
    expect(csv).toContain(",'@SUM(A1),")
  })
})
