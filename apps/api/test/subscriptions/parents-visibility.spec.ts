import { UserListMetaSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import {
  ADMIN,
  SCHOOL_ADMIN,
  apiOf,
  bootParentsApp,
  expectError,
  login,
  newStudent,
  schoolIdOf,
  type Api,
  type UsersTestApp,
} from './parents-helpers'

/** BE-25 AC 7 (LEAD decision 2026-10-19): a school_admin sees a parent only with >= 1 child and ALL children in its school. */
describe('parent visibility for a school_admin (AC 7)', () => {
  let t: UsersTestApp
  let admin: Api
  let sa: Api
  let s1: string
  let s2: string
  let own: string
  let foreign: string
  let noChild: string
  let ownOnly: string
  let mixed: string
  let foreignOnly: string
  let n = 0

  const mkParent = async (name: string, schoolId?: string): Promise<string> => {
    const res = await admin.post('/admin/users', { roles: ['parent'], name, email: `p${String(++n)}@ujian.test`, ...(schoolId ? { schoolId } : {}) })
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return res.body.data.id as string
  }
  const link = (parent: string, student: string) => t.db.query('insert into parent_links (parent_id, student_id, relationship) values ($1, $2, $3)', [parent, student, 'Ibu'])
  const idsOf = (res: { body: { data: { id: string }[] } }) => res.body.data.map((r) => r.id)
  const ROUTES = (id: string) =>
    [
      ['get', `/admin/users/${id}`, undefined],
      ['put', `/admin/users/${id}`, { roles: ['parent'], name: 'X' }],
      ['post', `/admin/users/${id}/toggle-active`, undefined],
      ['del', `/admin/users/${id}`, undefined],
    ] as const

  beforeAll(async () => {
    t = await bootParentsApp()
    admin = apiOf(await login(t, ADMIN))
    sa = apiOf(await login(t, SCHOOL_ADMIN))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    own = await newStudent(admin, s1, 'anak.sendiri@ujian.test', 'Anak Sendiri')
    const own2 = await newStudent(admin, s1, 'anak.sendiri2@ujian.test', 'Anak Sendiri Dua')
    foreign = await newStudent(admin, s2, 'anak.lain@ujian.test', 'Anak Sekolah Lain')

    noChild = await mkParent('Ibu Tanpa Anak')
    ownOnly = await mkParent('Ibu Anak Sendiri') // no school of its own: visibility comes from the children
    mixed = await mkParent('Ibu Anak Campur', s1)
    foreignOnly = await mkParent('Ibu Anak Lain', s1)
    await link(ownOnly, own)
    await link(ownOnly, own2)
    await link(mixed, own)
    await link(mixed, foreign)
    await link(foreignOnly, foreign)
  })
  afterAll(async () => {
    await t.close()
  })

  it('a parent with no children is 404 on detail, update, toggle and delete (fail closed), even if it carries the own school', async () => {
    await t.db.query('update users set school_id = $1 where id = $2', [s1, noChild])
    for (const [m, path, body] of ROUTES(noChild)) expectError(await sa[m](path, body as object), 'NOT_FOUND')
    expect((await t.db.query('select 1 from users where id = $1', [noChild])).length).toBe(1)
  })

  it('a parent whose only children are in the own school is visible (detail lists them, own school only)', async () => {
    const res = await sa.get(`/admin/users/${ownOnly}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.linkedStudents.map((x: { name: string }) => x.name)).toEqual(['Anak Sendiri', 'Anak Sendiri Dua'])
    // The parent has no school of its own; nothing else leaks.
    expect(res.body.data.schoolId).toBeNull()
    expect(res.body.data.school).toBeNull()
  })

  it('a parent with one child in the own school and one in another school is 404 on every route', async () => {
    for (const [m, path, body] of ROUTES(mixed)) expectError(await sa[m](path, body as object), 'NOT_FOUND')
  })

  it('a parent whose only child is in another school is 404', async () => {
    for (const [m, path, body] of ROUTES(foreignOnly)) expectError(await sa[m](path, body as object), 'NOT_FOUND')
  })

  it('the list and roleCounts.parent follow the same rule', async () => {
    const res = await sa.get('/admin/users?role=parent')
    expect(idsOf(res)).toEqual([ownOnly])
    expect(UserListMetaSchema.parse(res.body.meta).roleCounts.parent).toBe(1)
    const all = await sa.get('/admin/users')
    const ids = idsOf(all)
    for (const hidden of [noChild, mixed, foreignOnly]) expect(ids).not.toContain(hidden)
    expect(ids).toContain(ownOnly)
    expect(UserListMetaSchema.parse(all.body.meta).roleCounts.parent).toBe(1)
    expect((await sa.get(`/admin/users?role=parent&search=${encodeURIComponent('Anak Campur')}`)).body.data).toEqual([])
    expect((await sa.get(`/admin/users?role=parent&schoolId=${s2}`)).body.data).toEqual([])
  })

  it('admin sees every parent; admin roleCounts.parent counts all of them and linkedStudents is not filtered', async () => {
    const res = await admin.get('/admin/users?role=parent')
    expect(idsOf(res).sort()).toEqual([noChild, ownOnly, mixed, foreignOnly].sort())
    expect(UserListMetaSchema.parse(res.body.meta).roleCounts.parent).toBe(4)
    for (const id of [noChild, mixed, foreignOnly]) expect((await admin.get(`/admin/users/${id}`)).status).toBe(200)
    const m = await admin.get(`/admin/users/${mixed}`)
    expect(m.body.data.linkedStudents.map((x: { id: string }) => x.id).sort()).toEqual([own, foreign].sort())
  })

  it('a link to another school makes a visible parent invisible again, and a new own-school link makes a childless one visible', async () => {
    const p = await mkParent('Ibu Berubah')
    expectError(await sa.get(`/admin/users/${p}`), 'NOT_FOUND')
    await link(p, own)
    expect((await sa.get(`/admin/users/${p}`)).status).toBe(200)
    await link(p, foreign)
    expectError(await sa.get(`/admin/users/${p}`), 'NOT_FOUND')
    await t.db.query('delete from parent_links where parent_id = $1 and student_id = $2', [p, foreign])
    expect((await sa.get(`/admin/users/${p}`)).status).toBe(200)
  })

  it('a school_admin may edit the non-role fields of a visible parent but cannot change its roles or school; the parent role stays admin-only', async () => {
    const res = await sa.put(`/admin/users/${ownOnly}`, { roles: ['parent'], name: 'Ibu Anak Sendiri Baru' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data.name).toBe('Ibu Anak Sendiri Baru')
    expect(res.body.data.linkedStudents).toHaveLength(2)
    expectError(await sa.put(`/admin/users/${ownOnly}`, { roles: ['teacher'], name: 'X' }), 'FORBIDDEN')
    expectError(await sa.put(`/admin/users/${ownOnly}`, { roles: ['parent', 'teacher'], name: 'X' }), 'FORBIDDEN')
    const moved = await sa.put(`/admin/users/${ownOnly}`, { roles: ['parent'], name: 'X', schoolId: s1 })
    expect(moved.status).toBe(422)
    expect((await t.db.query<{ s: string | null }>('select school_id::text s from users where id = $1', [ownOnly]))[0]?.s).toBeNull()
    // Creating a parent is still admin-only.
    expectError(await sa.post('/admin/users', { roles: ['parent'], name: 'Ibu Baru', email: 'baru@ujian.test', schoolId: s1 }), 'FORBIDDEN')
  })

  it('bulk delete skips hidden parents and removes visible ones', async () => {
    const res = await sa.post('/admin/users/bulk-delete', { ids: [noChild, mixed, foreignOnly] })
    expect(res.body.data).toEqual({ deleted: 0 })
    expect((await t.db.query('select 1 from users where id = any($1::bigint[])', [[noChild, mixed, foreignOnly]])).length).toBe(3)
    const vis = await mkParent('Ibu Untuk Dipadam')
    await link(vis, own)
    const ok = await sa.post('/admin/users/bulk-delete', { ids: [vis, noChild, mixed] })
    expect(ok.body.data).toEqual({ deleted: 1 })
    expect(await t.db.query('select 1 from users where id = $1', [vis])).toEqual([])
  })

  it('a visible parent that carries another school does not reveal it; the filters list only the own school', async () => {
    const p = await mkParent('Ibu Sekolah Lain', s2)
    await link(p, own)
    const res = await sa.get(`/admin/users/${p}`)
    expect(res.status).toBe(200)
    expect(res.body.data.schoolId).toBeNull()
    expect(res.body.data.school).toBeNull()
    const list = (await sa.get('/admin/users?role=parent')).body.data as { id: string; school: unknown }[]
    expect(list.find((r) => r.id === p)?.school).toBeNull()
    expect((await sa.get('/admin/users/filters')).body.data.schools.map((s: { id: string }) => s.id)).toEqual([s1])
  })
})
