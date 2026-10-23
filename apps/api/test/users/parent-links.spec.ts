import { CreatedUserSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ADMIN, apiOf, bootUsersApp, detailOf, fieldsOf, login, SCHOOL_ADMIN, schoolIdOf, type Api, type UsersTestApp } from './helpers'

const INVALID = 'The selected linked student ids is invalid.'
const byNumber = (a: string, b: string): number => Number(a) - Number(b)

/** SW2-08: the admin create/update of a parent stores "Anak yang Dipautkan" in `parent_links`. */
describe('admin users: parent links (SW2-08)', () => {
  let t: UsersTestApp
  let admin: Api
  let sa: Api
  let s1: string
  let s2: string
  let own: string[] = [] // students of school 1 (the school_admin's school)
  let other: string // a student of school 2
  let counter = 0

  const student = async (schoolId: string, name: string): Promise<string> => {
    const res = await admin.post('/admin/users', { roles: ['student'], name, email: `anak.${++counter}@ujian.test`, schoolId, grade: 3 })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return CreatedUserSchema.parse(res.body.data).id
  }
  const parent = async (over: Record<string, unknown> = {}) => {
    const res = await admin.post('/admin/users', { roles: ['parent'], name: 'Ibu Ujian', email: `ibu.${++counter}@ujian.test`, ...over })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res
  }
  const stored = async (parentId: string): Promise<string[]> =>
    (await t.db.query<{ s: string }>('select student_id::text s from parent_links where parent_id = $1', [parentId])).map((r) => r.s).sort(byNumber)
  const ids = (xs: { id: string }[]): string[] => xs.map((x) => x.id).sort(byNumber)

  beforeAll(async () => {
    t = await bootUsersApp({ env: { THROTTLE_ADMIN_WRITE_PER_MINUTE: '100000', THROTTLE_ADMIN_READ_PER_MINUTE: '100000' } })
    admin = apiOf(await login(t, ADMIN))
    sa = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    own = [await student(s1, 'Anak Satu'), await student(s1, 'Anak Dua'), await student(s1, 'Anak Tiga')]
    other = await student(s2, 'Anak Lain')
  })
  afterAll(async () => {
    await t.close()
  })

  it('create stores the links, answers them and the detail shows them after reopening', async () => {
    const res = await parent({ linkedStudentIds: [own[0], other] })
    const created = CreatedUserSchema.parse(res.body.data)
    const want = [own[0] as string, other].sort(byNumber)
    expect(ids(created.linkedStudents)).toEqual(want)
    expect(await stored(created.id)).toEqual(want)
    const detail = detailOf(await admin.get(`/admin/users/${created.id}`))
    expect(ids(detail.linkedStudents)).toEqual(want)
  })

  it('create without linkedStudentIds, or with an empty list, stores nothing', async () => {
    const a = CreatedUserSchema.parse((await parent()).body.data)
    const b = CreatedUserSchema.parse((await parent({ linkedStudentIds: [] })).body.data)
    expect(a.linkedStudents).toEqual([])
    expect(b.linkedStudents).toEqual([])
    expect(await stored(a.id)).toEqual([])
    expect(await stored(b.id)).toEqual([])
  })

  it('a duplicate id in the list is stored once', async () => {
    const created = CreatedUserSchema.parse((await parent({ linkedStudentIds: [own[0], own[0]] })).body.data)
    expect(await stored(created.id)).toEqual([own[0]])
  })

  it('update replaces the set; an absent list keeps it; an empty list clears it', async () => {
    const pid = CreatedUserSchema.parse((await parent({ linkedStudentIds: [own[0], own[1]] })).body.data).id
    const rowOf = async (student: string) =>
      (await t.db.query<{ id: string }>('select id::text from parent_links where parent_id = $1 and student_id = $2', [pid, student]))[0]?.id
    const keptId = await rowOf(own[1] as string)

    const replaced = await admin.put(`/admin/users/${pid}`, { roles: ['parent'], name: 'Ibu Ujian', linkedStudentIds: [own[1], own[2]] })
    expect(replaced.status, JSON.stringify(replaced.body)).toBe(200)
    const want = [own[1] as string, own[2] as string].sort(byNumber)
    expect(ids(detailOf(replaced).linkedStudents)).toEqual(want)
    expect(await stored(pid)).toEqual(want)
    // The pair that stays keeps its row.
    expect(await rowOf(own[1] as string)).toBe(keptId)
    expect(ids(detailOf(await admin.get(`/admin/users/${pid}`)).linkedStudents)).toEqual(want)

    const kept = await admin.put(`/admin/users/${pid}`, { roles: ['parent'], name: 'Ibu Baru' })
    expect(ids(detailOf(kept).linkedStudents)).toEqual(want)

    const cleared = await admin.put(`/admin/users/${pid}`, { roles: ['parent'], name: 'Ibu Baru', linkedStudentIds: [] })
    expect(detailOf(cleared).linkedStudents).toEqual([])
    expect(await stored(pid)).toEqual([])
  })

  it('an unknown id, or a user that is not a student, is still 422 and writes nothing', async () => {
    const count = async () => (await t.db.query<{ n: number }>('select count(*)::int n from parent_links'))[0]?.n
    const before = await count()
    const teacher = (await t.db.query<{ id: string }>(`select u.id::text from users u join user_roles r on r.user_id = u.id where r.role = 'teacher' limit 1`))[0]?.id
    const unknown = await admin.post('/admin/users', { roles: ['parent'], name: 'Ibu Gagal', email: 'gagal1@ujian.test', linkedStudentIds: [own[0], '9999999'] })
    expect(fieldsOf(unknown).linkedStudentIds).toBe(INVALID)
    const notStudent = await admin.post('/admin/users', { roles: ['parent'], name: 'Ibu Gagal', email: 'gagal2@ujian.test', linkedStudentIds: [teacher] })
    expect(fieldsOf(notStudent).linkedStudentIds).toBe(INVALID)
    expect(await count()).toBe(before)

    const pid = CreatedUserSchema.parse((await parent({ linkedStudentIds: [own[0]] })).body.data).id
    const bad = await admin.put(`/admin/users/${pid}`, { roles: ['parent'], name: 'Ibu Ujian', linkedStudentIds: [own[1], '9999999'] })
    expect(fieldsOf(bad).linkedStudentIds).toBe(INVALID)
    expect(await stored(pid)).toEqual([own[0]])
  })

  it('links are kept only for a parent: other roles ignore linkedStudentIds', async () => {
    const res = await admin.post('/admin/users', { roles: ['teacher'], name: 'Guru Ujian', email: 'guru.pautan@ujian.test', schoolId: s1, linkedStudentIds: [own[0]] })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const tid = CreatedUserSchema.parse(res.body.data).id
    expect(await stored(tid)).toEqual([])
    expect(detailOf(res).linkedStudents).toEqual([])
  })

  describe('a school_admin editing a parent of its own school', () => {
    it('replaces the links with students of its own school', async () => {
      const pid = CreatedUserSchema.parse((await parent({ linkedStudentIds: [own[0]] })).body.data).id
      const res = await sa.put(`/admin/users/${pid}`, { roles: ['parent'], name: 'Ibu Ujian', linkedStudentIds: [own[1], own[2]] })
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      const want = [own[1] as string, own[2] as string].sort(byNumber)
      expect(ids(detailOf(res).linkedStudents)).toEqual(want)
      expect(await stored(pid)).toEqual(want)
    })

    it('cannot link a student of another school: 422 (like an unknown id), nothing changes', async () => {
      const pid = CreatedUserSchema.parse((await parent({ linkedStudentIds: [own[0]] })).body.data).id
      const res = await sa.put(`/admin/users/${pid}`, { roles: ['parent'], name: 'Ibu Ujian', linkedStudentIds: [own[1], other] })
      expect(fieldsOf(res).linkedStudentIds).toBe(INVALID)
      expect(await stored(pid)).toEqual([own[0]])
    })

    it('a parent that also has a child in another school is hidden (404) and its links are not touched', async () => {
      const pid = CreatedUserSchema.parse((await parent({ linkedStudentIds: [own[0], other] })).body.data).id
      const res = await sa.put(`/admin/users/${pid}`, { roles: ['parent'], name: 'Ibu Ujian', linkedStudentIds: [own[1]] })
      expect(res.status).toBe(404)
      expect(await stored(pid)).toEqual([own[0] as string, other].sort(byNumber))
    })
  })
})
