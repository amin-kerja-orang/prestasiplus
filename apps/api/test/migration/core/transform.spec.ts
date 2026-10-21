import { describe, expect, it } from 'vitest'

import {
  deriveClassGrade,
  transformClassroom,
  transformEnrolment,
  transformParentLink,
} from '../../../src/migration/transform/classes'
import {
  buildGeo,
  geoOf,
  levelIdentity,
  transformChapter,
  transformLevel,
  transformSchool,
  transformSubject,
  transformTopic,
} from '../../../src/migration/transform/reference'
import { dateOnly, transformSubscription } from '../../../src/migration/transform/subscriptions'
import { gradeFromClassLabel, transformUser, type UserContext } from '../../../src/migration/transform/users'
import { IcHasher } from '../../../src/migration/transform/secrets'

const ic = new IcHasher({ IC_HASH_KEY: 'test-ic-key-0123456789' })
const ctx = (over: Partial<UserContext> = {}): UserContext => ({
  schoolId: '5',
  school: { type: 'SMK', state: 'Selangor', district: 'PPD Petaling' },
  ic,
  defaultHashes: new Set(),
  ...over,
})
const HASH = `$2y$10$${'a'.repeat(22)}${'b'.repeat(31)}`
const user = (over: Record<string, string | null> = {}) => ({
  id: '1', name: 'Murid Contoh 001', email: 'a@contoh.invalid', username: 'c1', password: HASH, role: 'pelajar',
  school_id: '1', is_active: '1', is_suspended: '0', is_complimentary: '0', ic: '000000000001', kelas: '4 Contoh',
  created_at: '2026-01-01 00:00:00+00', updated_at: '2026-01-02 00:00:00+00', ...over,
})

describe('levels, subjects, chapters, topics', () => {
  it('derives the level code and grade from the name, with a surrogate for other names', () => {
    expect(levelIdentity('Darjah 3', '9')).toEqual({ code: 'D3', grade: 3 })
    expect(levelIdentity('Tingkatan 4', '9')).toEqual({ code: 'T4', grade: 10 })
    expect(levelIdentity('Darjah Contoh 1', '2')).toEqual({ code: 'LVL2', grade: null })
  })

  it('maps the stage and rejects an unknown one with the code, never defaulting', () => {
    const ok = transformLevel({ id: '1', name_bm: 'Darjah 1', stage: 'primary', curriculum: 'kssr', sort_order: '1' })
    expect(ok).toMatchObject({ ok: true, value: { code: 'D1', stage: 'primary', curriculum: 'KSSR', grade: 1, name_en: 'Darjah 1' } })
    const bad = transformLevel({ id: '2', name_bm: 'Darjah 2', stage: 'secondary', curriculum: 'kssr' })
    expect(bad).toEqual({ ok: false, reject: expect.objectContaining({ reason: 'UNKNOWN_ENUM', column: 'stage', enumValue: 'secondary' }) })
  })

  it('keeps the English name and colour of a seeded subject and falls back otherwise', () => {
    const seeded = transformSubject({ id: '1', name: 'Matematik', code: 'math', is_core: '1', color: null }, { name_en: 'Mathematics', color: '#EF4444' })
    expect(seeded).toMatchObject({ ok: true, value: { code: 'MATH', name_en: 'Mathematics', color: '#EF4444', is_core: true } })
    const fresh = transformSubject({ id: '4', name: 'Sains', code: null, is_core: '0', color: 'not-a-colour' })
    expect(fresh).toMatchObject({ ok: true, value: { code: 'SUBJ4', name_en: 'Sains', color: '#64748B' } })
    expect(transformSubject({ id: '5', name: 'X', is_core: 'maybe' })).toMatchObject({ ok: false })
  })

  it('quarantines orphan chapters and topics and marks out-of-tree chapters', () => {
    expect(transformChapter({ id: '1', title: 'Bab', number: '1' }, { subjectId: undefined, levelId: '2' })).toEqual({
      ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'subject_id' },
    })
    expect(transformChapter({ id: '1', title: 'Bab', number: '1' }, { subjectId: '1', levelId: undefined })).toMatchObject({ ok: false })
    expect(transformChapter({ id: '1', title: 'Bab', number: '1', strand: 'A' }, { subjectId: '1', levelId: '2' })).toMatchObject({
      ok: true, value: { in_tree: true, name: 'Bab', chapter_number: 1, strand: 'A' },
    })
    expect(transformChapter({ id: '2', title: null }, { subjectId: '1', levelId: null })).toMatchObject({ ok: true, value: { in_tree: false } })
    expect(transformTopic({ id: '1', name: 'T' }, { chapterId: undefined })).toMatchObject({ ok: false })
    expect(transformTopic({ id: '1', name: '  ' }, { chapterId: '3' })).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE' } })
  })
})

describe('schools and geography', () => {
  it('normalises spelling variants into one JPN and PPD with deterministic codes', () => {
    const geo = buildGeo([
      { state: 'Negeri B', district: 'Daerah B1', n: 2 },
      { state: 'negeri b', district: 'daerah b1', n: 1 },
      { state: 'Selangor', district: 'Daerah B1', n: 1 },
      { state: 'Johor', district: null, n: 1 },
      { state: null, district: null, n: 4 },
    ])
    expect(geo.jpns.map((j) => [j.key, j.name, j.code])).toEqual([
      ['JOHOR', 'Johor', 'JHR'],
      ['NEGERI B', 'Negeri B', 'NEGERI B'],
      ['SELANGOR', 'Selangor', 'SGR'],
    ])
    // The same district name under two states: the first state keeps the plain code, the other gets a suffix.
    expect(geo.ppds.map((p) => p.code)).toEqual(['Daerah B1', 'Daerah B1 (SGR)'])
    const found = geoOf(geo, ' negeri  b ', 'DAERAH B1')
    expect(found.jpn?.name).toBe('Negeri B')
    expect(found.ppd?.district).toBe('Daerah B1')
    expect(geoOf(geo, 'Johor', null).ppd).toBeNull()
  })

  it('maps the school type and rejects an unknown one', () => {
    const geo = { jpnId: null, ppdId: null, stateName: null, districtName: null }
    expect(transformSchool({ id: '1', name: 'Sekolah Contoh 1', type: 'SJK(C)', is_active: '1' }, geo)).toMatchObject({ ok: true, value: { type: 'SJK(C)', is_active: true } })
    expect(transformSchool({ id: '2', name: 'S', type: 'kolej' }, geo)).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'type' } })
    expect(transformSchool({ id: '3', name: 'S', type: null }, geo)).toMatchObject({ ok: true, value: { type: null } })
  })
})

describe('users', () => {
  it('maps the seven .cloud roles and rejects an unknown role (no default role)', () => {
    const roles: Record<string, string> = {
      pelajar: 'student', guru: 'teacher', ibu_bapa: 'parent', penaja: 'sponsor',
      admin_sekolah: 'school_admin', pegawai_ppd: 'ppd_officer', admin: 'admin',
    }
    for (const [source, target] of Object.entries(roles)) {
      expect(transformUser(user({ role: source }), ctx())).toMatchObject({ ok: true, value: { role: target } })
    }
    expect(transformUser(user({ role: 'super_guru' }), ctx())).toEqual({
      ok: false, reject: expect.objectContaining({ reason: 'UNKNOWN_ENUM', column: 'role', enumValue: 'super_guru' }),
    })
  })

  it('rejects an orphan school and keeps a user without a school', () => {
    expect(transformUser(user(), ctx({ schoolId: undefined }))).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT', column: 'school_id' } })
    expect(transformUser(user({ school_id: null }), ctx({ schoolId: null, school: null }))).toMatchObject({ ok: true, value: { user: { school_id: null } } })
  })

  it('hashes and masks the IC and never carries the clear value', () => {
    const out = transformUser(user({ ic: '900101-14-5678' }), ctx())
    if (!out.ok) throw new Error('expected ok')
    expect(out.value.user.ic_masked).toBe('xxxxxx-xx-xx78')
    expect(out.value.user.ic_hash).toMatch(/^[0-9a-f]{64}$/)
    expect(JSON.stringify(out.value)).not.toContain('9001011')
    expect(JSON.stringify(out.value)).not.toContain('900101')
    const bad = transformUser(user({ ic: '123' }), ctx())
    expect(bad).toMatchObject({ ok: true, value: { user: { ic_hash: null, ic_masked: null }, notes: { icInvalid: true } } })
  })

  it('copies a bcrypt hash and flags non-bcrypt, shared-default and roster accounts for reset', () => {
    const ok = transformUser(user(), ctx())
    expect(ok).toMatchObject({ ok: true, value: { user: { password_hash: HASH, must_reset_password: false } } })
    const plain = transformUser(user({ password: 'Rahsia123' }), ctx())
    expect(plain).toMatchObject({ ok: true, value: { user: { password_hash: null, must_reset_password: true } } })
    expect(JSON.stringify(plain)).not.toContain('Rahsia123')
    const shared = transformUser(user(), ctx({ defaultHashes: new Set([HASH]) }))
    expect(shared).toMatchObject({ ok: true, value: { user: { password_hash: HASH, must_reset_password: true } } })
    const roster = transformUser(user({ email: null }), ctx())
    expect(roster).toMatchObject({ ok: true, value: { user: { must_reset_password: true } } })
    const argon = transformUser(user({ password: '$argon2id$v=19$m=65536,t=4,p=1$ZmFrZQ$ZmFrZWZha2U' }), ctx())
    expect(argon).toMatchObject({ ok: true, value: { user: { must_reset_password: true } } })
    expect(transformUser(user({ password: null }), ctx())).toMatchObject({ ok: true, value: { user: { password_hash: null, must_reset_password: true } } })
  })

  it('derives scopes: national for admin, the school district for a PPD officer, none to report otherwise', () => {
    expect(transformUser(user({ role: 'admin' }), ctx())).toMatchObject({ ok: true, value: { scope: { level: 'national', role: 'admin' } } })
    expect(transformUser(user({ role: 'pegawai_ppd' }), ctx())).toMatchObject({
      ok: true, value: { scope: { level: 'district', state_code: 'Selangor', district_code: 'PPD Petaling' }, ppdUnscoped: false },
    })
    expect(transformUser(user({ role: 'pegawai_ppd' }), ctx({ school: { type: 'SMK', state: 'Selangor', district: null } }))).toMatchObject({
      ok: true, value: { scope: null, ppdUnscoped: true },
    })
    expect(transformUser(user({ role: 'pegawai_ppd', school_id: null }), ctx({ schoolId: null, school: null }))).toMatchObject({
      ok: true, value: { ppdUnscoped: true },
    })
  })

  it('creates a teacher profile only for teachers with teaching data and drops faith', () => {
    const t = transformUser(
      { ...user({ role: 'guru' }), teaching_subject: 'Matematik', teaching_experience_years: '5', faith: 'sensitive' },
      ctx(),
    )
    expect(t).toMatchObject({ ok: true, value: { teacher: { subject: 'Matematik', qualification: null, experience_years: 5 } } })
    expect(JSON.stringify(t)).not.toContain('sensitive')
    expect(transformUser(user({ role: 'guru' }), ctx())).toMatchObject({ ok: true, value: { teacher: null } })
    expect(transformUser({ ...user({ role: 'pelajar' }), teaching_subject: 'X' }, ctx())).toMatchObject({ ok: true, value: { teacher: null } })
  })

  it('reads the grade from the class label and the school type', () => {
    expect(gradeFromClassLabel('4 Amanah', 'SK')).toBe(4)
    expect(gradeFromClassLabel('4 Amanah', 'SMK')).toBe(10)
    expect(gradeFromClassLabel('Tingkatan 2 Bestari', 'SK')).toBe(8)
    expect(gradeFromClassLabel('Darjah 6 A', null)).toBe(6)
    expect(gradeFromClassLabel('7 A', 'SK')).toBeNull()
    expect(gradeFromClassLabel('Amanah', 'SMK')).toBeNull()
    expect(gradeFromClassLabel(null, 'SMK')).toBeNull()
  })

  it('rejects an invalid flag value and a blank name', () => {
    expect(transformUser(user({ is_active: 'perhaps' }), ctx())).toMatchObject({ ok: false, reject: { column: 'is_active' } })
    expect(transformUser(user({ name: '   ' }), ctx())).toMatchObject({ ok: false, reject: { column: 'name' } })
  })
})

describe('classes, enrolments, parent links', () => {
  const parents = { teacherId: '7', schoolId: '1', subjectId: '2', levelId: '3' }
  it('derives the class kind from the teacher and keeps the join code and year', () => {
    expect(transformClassroom({ id: '1', name: 'Kelas 1', code: 'KLS1', session_year: '2026/2027' }, parents)).toMatchObject({
      ok: true, value: { kind: 'classroom', join_code: 'KLS1', academic_year: 2026 },
    })
    expect(transformClassroom({ id: '1', name: 'Kelas 1', session_year: '2026' }, { ...parents, teacherId: null })).toMatchObject({
      ok: true, value: { kind: 'school_class', teacher_id: null },
    })
  })

  it('quarantines orphans and unplaceable classes', () => {
    expect(transformClassroom({ id: '1', name: 'K', session_year: '2026' }, { ...parents, teacherId: undefined })).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT' } })
    expect(transformClassroom({ id: '1', name: 'K', session_year: 'x' }, parents)).toMatchObject({ ok: false, reject: { column: 'session_year' } })
    expect(transformClassroom({ id: '1', name: 'K', session_year: '2026' }, { ...parents, levelId: null })).toMatchObject({ ok: false, reject: { column: 'education_level_id' } })
  })

  it('derives the class grade from its name, else from the most common pupil grade', () => {
    expect(deriveClassGrade('Tingkatan 4 Amanah', [7, 7])).toBe(10)
    expect(deriveClassGrade('Kelas A', [4, 5, 5, null])).toBe(5)
    expect(deriveClassGrade('Kelas A', [4, 5])).toBe(4)
    expect(deriveClassGrade('Kelas A', [null])).toBeNull()
  })

  it('maps rosters as active code joins and rejects orphans and self links', () => {
    expect(transformEnrolment({ classroom_id: '1', student_id: '2', created_at: '2026-01-01 00:00:00+00' }, { classroomId: '10', studentId: '20' })).toMatchObject({
      ok: true, value: { status: 'active', source: 'code', joined_at: '2026-01-01 00:00:00+00' },
    })
    expect(transformEnrolment({ classroom_id: '1', student_id: '9999' }, { classroomId: '10', studentId: undefined })).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT' } })
    expect(transformParentLink({ parent_id: '9', student_id: '1', relationship: ' bapa ' }, { parentId: '90', studentId: '10' })).toMatchObject({ ok: true, value: { relationship: 'bapa' } })
    expect(transformParentLink({ parent_id: '9', student_id: '9' }, { parentId: '90', studentId: '90' })).toMatchObject({ ok: false, reject: { reason: 'INVALID_VALUE' } })
    expect(transformParentLink({ parent_id: '9', student_id: '1', relationship: 'x'.repeat(51) }, { parentId: '90', studentId: '10' })).toMatchObject({ ok: false })
  })
})

describe('school subscriptions', () => {
  const sub = { id: '1', school_id: '1', package: 'asas', quota: '100', starts_at: '2026-01-01', ends_at: '2026-12-31' }
  const base = { schoolId: '1', schoolType: 'SK', packageIds: new Map([['D1_D6', '11'], ['T4', '12']]), asOf: '2026-06-01' }

  it('maps the tier, the quota and the dates, and derives the status from the run date', () => {
    expect(transformSubscription(sub, base)).toMatchObject({
      ok: true, value: { package_tier: 'basic', student_quota: 100, school_package_id: '11', status: 'active', starts_on: '2026-01-01', ends_on: '2026-12-31' },
    })
    expect(transformSubscription({ ...sub, package: 'premium' }, { ...base, schoolType: 'SMK', asOf: '2027-01-01' })).toMatchObject({
      ok: true, value: { package_tier: 'full', school_package_id: '12', status: 'expired' },
    })
  })

  it('rejects an unknown package, a bad quota or dates, a missing catalogue row and an orphan school', () => {
    expect(transformSubscription({ ...sub, package: 'emas' }, base)).toMatchObject({ ok: false, reject: { reason: 'UNKNOWN_ENUM', column: 'package' } })
    expect(transformSubscription({ ...sub, quota: '0' }, base)).toMatchObject({ ok: false, reject: { column: 'quota' } })
    expect(transformSubscription({ ...sub, ends_at: '2025-12-31' }, base)).toMatchObject({ ok: false, reject: { column: 'ends_at' } })
    expect(transformSubscription({ ...sub, starts_at: '2026-02-30' }, base)).toMatchObject({ ok: false, reject: { column: 'starts_at' } })
    expect(transformSubscription(sub, { ...base, schoolType: null })).toMatchObject({ ok: false, reject: { reason: 'UNSUPPORTED' } })
    expect(transformSubscription(sub, { ...base, schoolId: undefined })).toMatchObject({ ok: false, reject: { reason: 'ORPHAN_PARENT' } })
    expect(dateOnly('2026-03-04 00:00:00+00')).toBe('2026-03-04')
  })
})
