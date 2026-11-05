import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { parseUatArgs, UsageError } from '../../scripts/uat-ops/lib'
import { accountLines, collectAccounts, parseSchoolId, SPEC, type AccountGroup, type SchoolRow } from '../../scripts/uat-ops/u-op-12-accounts-check'
import { createTestDatabase, type TestDatabase } from '../support/db'

/** S4-T08 U-OP-12: acceptance accounts exist on the test school (pure lines [CI], queries on a real database [CI]). */
const group = (role: string, level_code: string | null, total: number, usable: number): AccountGroup => ({ role, level_code, total, usable, ids: usable > 0 ? ['1'] : null })
const school = (over: Partial<SchoolRow> = {}): SchoolRow => ({ id: '5', type: 'SMK', is_active: true, admins_usable: 1, admin_ids: ['9'], ...over })
const complete = [group('student', 'T1', 2, 2), group('student', 'T2', 1, 1), group('student', 'T4', 1, 1), group('student', 'T5', 1, 1), group('teacher', null, 3, 3)]
const failures = (lines: ReturnType<typeof accountLines>): string[] => lines.filter((l) => l.status === 'FAIL').map((l) => l.text)

describe('accountLines', () => {
  it('passes a complete set; T3 is optional (INFO) and the counts are INFO', () => {
    const lines = accountLines(complete, school(), 2)
    expect(failures(lines)).toEqual([])
    expect(lines.find((l) => l.text.startsWith('pupil T3'))?.status).toBe('INFO')
    expect(lines.filter((l) => l.status === 'PASS')).toHaveLength(7)
  })

  it('fails each missing slot: pupil level, teacher, school type, Admin Sekolah', () => {
    expect(failures(accountLines(complete.filter((g) => g.level_code !== 'T2'), school(), 1))).toEqual(['pupil T2: 0 usable of 0; create one'])
    expect(failures(accountLines(complete.filter((g) => g.role !== 'teacher'), school(), 1))).toEqual(['teacher: 0 usable of 0; create one'])
    expect(failures(accountLines(complete, school({ type: 'SK' }), 1))[0]).toContain('expected an active SMK')
    expect(failures(accountLines(complete, school({ is_active: false }), 1))[0]).toContain('inactive')
    expect(failures(accountLines(complete, school({ admins_usable: 0, admin_ids: null }), 1))[0]).toContain('Admin Sekolah: none usable')
  })

  it('counts a suspended-only level as missing (usable 0 of 1)', () => {
    expect(failures(accountLines([...complete.filter((g) => g.level_code !== 'T5'), group('student', 'T5', 1, 0)], school(), 1))).toEqual(['pupil T5: 0 usable of 1; create one'])
  })

  it('fails when the school id matches no school', () => {
    expect(accountLines([], null, 0)).toEqual([{ status: 'FAIL', text: 'the school id matches no school' }])
  })

  it('prints counts, levels, roles and ids only', () => {
    const text = accountLines(complete, school(), 2).map((l) => l.text).join('\n')
    expect(text).not.toMatch(/@|\$argon|password/i)
  })
})

describe('arguments', () => {
  it('needs a numeric --school-id and is read-only', () => {
    expect(parseSchoolId('12')).toBe('12')
    for (const bad of [undefined, '', '0', '-1', '1; DROP TABLE users', 'abc', '1e3']) expect(() => parseSchoolId(bad)).toThrow(UsageError)
    expect(() => parseUatArgs(['--apply'], SPEC)).toThrow('read-only')
    expect(parseUatArgs(['--school-id', '5'], SPEC).values).toEqual({ 'school-id': '5' })
  })
})

describe('collectAccounts (database)', () => {
  let db: TestDatabase
  let client: pg.Client
  let schoolId: string
  beforeAll(async () => {
    db = await createTestDatabase()
    await db.query(`INSERT INTO education_levels(code,name,name_en,stage,curriculum,grade) VALUES
      ('T1','Tingkatan 1','Form 1','lower_secondary','KSSM',7),('T2','Tingkatan 2','Form 2','lower_secondary','KSSM',8),
      ('T4','Tingkatan 4','Form 4','upper_secondary','KSSM',10),('T5','Tingkatan 5','Form 5','upper_secondary','KSSM',11)`)
    const [s] = await db.query<{ id: string }>(`INSERT INTO schools(name,type) VALUES ('Sekolah Ujian Fiksyen','SMK') RETURNING id::text`)
    const [other] = await db.query<{ id: string }>(`INSERT INTO schools(name,type) VALUES ('Sekolah Lain Fiksyen','SMK') RETURNING id::text`)
    schoolId = s!.id
    const add = async (name: string, school: string | null, grade: number | null, role: string, over: { suspended?: boolean; password?: boolean } = {}): Promise<void> => {
      const [u] = await db.query<{ id: string }>(
        `INSERT INTO users(name, school_id, grade, password_hash, is_suspended) VALUES ($1, $2, $3, $4, $5) RETURNING id::text`,
        [name, school, grade, over.password === false ? null : 'x', over.suspended ?? false],
      )
      await db.query(`INSERT INTO user_roles(user_id, role) VALUES ($1, $2)`, [u!.id, role])
    }
    await add('Murid Satu', schoolId, 7, 'student')
    await add('Murid Dua', schoolId, 8, 'student')
    await add('Murid Empat', schoolId, 10, 'student')
    await add('Murid Lima Gantung', schoolId, 11, 'student', { suspended: true })
    await add('Murid Lima Tanpa Kata Laluan', schoolId, 11, 'student', { password: false })
    await add('Guru Satu', schoolId, null, 'teacher')
    await add('Admin Sekolah Satu', schoolId, null, 'school_admin')
    await add('Murid Sekolah Lain', other!.id, 11, 'student')
    await add('Admin Pusat Satu', null, null, 'admin')
    client = new pg.Client({ connectionString: db.url })
    await client.connect()
  })
  afterAll(async () => {
    await client.end()
    await db.drop()
  })

  it('counts usable accounts of the given school only and reports T5 as missing', async () => {
    const { groups, school: sch, adminPusat } = await collectAccounts(client, schoolId)
    expect(sch).toMatchObject({ id: schoolId, type: 'SMK', is_active: true, admins_usable: 1 })
    expect(adminPusat).toBe(1)
    const t5 = groups.find((g) => g.role === 'student' && g.level_code === 'T5')
    expect(t5).toMatchObject({ total: 2, usable: 0 })
    expect(groups.find((g) => g.role === 'student' && g.level_code === 'T1')).toMatchObject({ total: 1, usable: 1 })
    expect(failures(accountLines(groups, sch, adminPusat))).toEqual(['pupil T5: 0 usable of 2; create one'])
  })

  it('returns no school for an unknown id', async () => {
    expect((await collectAccounts(client, '999999')).school).toBeNull()
  })
})
