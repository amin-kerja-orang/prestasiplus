import { ParentLinkSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { TEACHER } from '../users/helpers'
import {
  ADMIN,
  SCHOOL_ADMIN,
  STUDENT,
  apiOf,
  bootParentsApp,
  expectError,
  login,
  newParent,
  newStudent,
  schoolIdOf,
  userIdOf,
  type Api,
  type UsersTestApp,
} from './parents-helpers'

/** Parent-child link routes of the contract: /me/parent-links and /admin/parent-links. */
describe('parent links (BE-25 part B)', () => {
  let t: UsersTestApp
  let admin: Api
  let sa: Api
  let student: Api
  let teacher: Api
  let s1: string
  let s2: string
  let own: string // the seeded student (school 1)
  let own2: string
  let foreign: string // a student of school 2
  let mum: Awaited<ReturnType<typeof newParent>>
  let dad: Awaited<ReturnType<typeof newParent>>
  let mixed: Awaited<ReturnType<typeof newParent>>
  let linkMumOwn: string
  let linkDadOwn2: string
  let linkMixedOwn: string
  let linkMixedForeign: string
  let linkOnlyForeign: string
  let strangerParent: Awaited<ReturnType<typeof newParent>>

  const link = async (parent: string, studentId: string, relationship: string | null = null): Promise<string> =>
    (await t.db.query<{ id: string }>('insert into parent_links (parent_id, student_id, relationship) values ($1, $2, $3) returning id::text', [parent, studentId, relationship]))[0]?.id as string
  const exists = async (id: string): Promise<boolean> => (await t.db.query('select 1 from parent_links where id = $1', [id])).length === 1
  const ids = (res: { body: { data: { linkId: string }[] } }) => res.body.data.map((x) => x.linkId)

  beforeAll(async () => {
    t = await bootParentsApp()
    admin = apiOf(await login(t, ADMIN))
    sa = apiOf(await login(t, SCHOOL_ADMIN))
    student = apiOf(await login(t, STUDENT))
    teacher = apiOf(await login(t, TEACHER))
    s1 = await schoolIdOf(t.db, 'DEMO001')
    s2 = await schoolIdOf(t.db, 'DEMO002')
    own = await userIdOf(t.db, STUDENT)
    own2 = await newStudent(admin, s1, 'anak.dua@ujian.test', 'Anak Dua')
    foreign = await newStudent(admin, s2, 'anak.lain@ujian.test', 'Anak Lain')
    mum = await newParent(t, admin, 'ibu.pautan@ujian.test', 'Ibu Pautan')
    dad = await newParent(t, admin, 'bapa.pautan@ujian.test', 'Bapa Pautan')
    mixed = await newParent(t, admin, 'ibu.campur@ujian.test', 'Ibu Campur')
    strangerParent = await newParent(t, admin, 'ibu.asing@ujian.test', 'Ibu Asing')
    linkMumOwn = await link(mum.id, own, 'Ibu')
    linkDadOwn2 = await link(dad.id, own2)
    linkMixedOwn = await link(mixed.id, own)
    linkMixedForeign = await link(mixed.id, foreign)
    linkOnlyForeign = await link(strangerParent.id, foreign)
  })
  afterAll(async () => {
    await t.close()
  })

  describe('GET /me/parent-links', () => {
    it('a student sees its own parents only, e-mail masked; no-store', async () => {
      const res = await student.get('/me/parent-links')
      expect(res.status, JSON.stringify(res.body)).toBe(200)
      expect(res.headers['cache-control']).toBe('no-store')
      for (const x of res.body.data) ParentLinkSchema.parse(x)
      expect(ids(res).sort()).toEqual([linkMumOwn, linkMixedOwn].sort())
      const m = res.body.data.find((x: { linkId: string }) => x.linkId === linkMumOwn)
      expect(m).toMatchObject({ parent: { id: mum.id, name: 'Ibu Pautan', emailMasked: 'i***@ujian.test' }, student: { id: own, schoolName: 'SMK Demo Satu' }, relationship: 'Ibu' })
      expect(JSON.stringify(res.body)).not.toContain('ibu.pautan@ujian.test')
    })

    it('a parent sees its own children only', async () => {
      expect(ids(await mum.api.get('/me/parent-links'))).toEqual([linkMumOwn])
      expect(ids(await mixed.api.get('/me/parent-links')).sort()).toEqual([linkMixedOwn, linkMixedForeign].sort())
    })

    it('401 without a session; 403 for a teacher, a school_admin and an admin', async () => {
      expectError(await t.http().get('/api/me/parent-links'), 'UNAUTHORIZED', 'Unauthenticated.')
      for (const who of [teacher, sa, admin]) expectError(await who.get('/me/parent-links'), 'FORBIDDEN')
    })
  })

  describe('DELETE /me/parent-links/:linkId', () => {
    it('401, 403 and CSRF are decided first', async () => {
      expectError(await t.http().delete(`/api/me/parent-links/${linkMumOwn}`), 'UNAUTHORIZED', 'Unauthenticated.')
      expectError(await teacher.del(`/me/parent-links/${linkMumOwn}`), 'FORBIDDEN')
      expectError(await admin.del(`/me/parent-links/${linkMumOwn}`), 'FORBIDDEN')
      const who = await login(t, STUDENT)
      expectError(await who.agent.delete(`/api/me/parent-links/${linkMumOwn}`), 'CSRF_INVALID')
      expect(await exists(linkMumOwn)).toBe(true)
    })

    it("someone else's link is 404 for a student and for a parent, and nothing is removed", async () => {
      expectError(await student.del(`/me/parent-links/${linkDadOwn2}`), 'NOT_FOUND')
      expectError(await student.del(`/me/parent-links/${linkOnlyForeign}`), 'NOT_FOUND')
      expectError(await mum.api.del(`/me/parent-links/${linkMixedOwn}`), 'NOT_FOUND')
      expectError(await mum.api.del('/me/parent-links/987654321'), 'NOT_FOUND')
      expect(await exists(linkDadOwn2)).toBe(true)
      expect(await exists(linkMixedOwn)).toBe(true)
    })

    it('a parent removes its own link: 204, no body, no-store, audited with ids only', async () => {
      const res = await dad.api.del(`/me/parent-links/${linkDadOwn2}`)
      expect(res.status).toBe(204)
      expect(res.text).toBe('')
      expect(res.headers['cache-control']).toBe('no-store')
      expect(await exists(linkDadOwn2)).toBe(false)
      const audit = await t.db.query<{ target_id: string; detail: Record<string, unknown> }>(`select target_id, detail from audit_events where action = 'parents.link.removed' and target_id = $1`, [linkDadOwn2])
      expect(audit).toHaveLength(1)
      expect(audit[0]?.detail).toMatchObject({ parentId: dad.id, studentId: own2, by: 'self' })
      expectError(await dad.api.del(`/me/parent-links/${linkDadOwn2}`), 'NOT_FOUND') // a repeat
    })

    it('a student removes the link of its own parent', async () => {
      expect((await student.del(`/me/parent-links/${linkMixedOwn}`)).status).toBe(204)
      expect(await exists(linkMixedOwn)).toBe(false)
      expect(await exists(linkMumOwn)).toBe(true)
    })

    it('a malformed id is 404, like an unknown one', async () => {
      expect((await student.del('/me/parent-links/abc')).status).toBe(404)
    })
  })

  describe('GET /admin/parent-links', () => {
    it('admin sees every link; filters by student and by parent; a bad page is page 1', async () => {
      const all = await admin.get('/admin/parent-links')
      expect(all.status, JSON.stringify(all.body)).toBe(200)
      expect(all.headers['cache-control']).toBe('no-store')
      for (const x of all.body.data) ParentLinkSchema.parse(x)
      expect(ids(all)).toEqual(expect.arrayContaining([linkMumOwn, linkMixedForeign, linkOnlyForeign]))
      expect(all.body.meta).toMatchObject({ page: 1, pageSize: 50 })
      expect(ids(await admin.get(`/admin/parent-links?studentId=${foreign}`)).sort()).toEqual([linkMixedForeign, linkOnlyForeign].sort())
      expect(ids(await admin.get(`/admin/parent-links?parentId=${mum.id}`))).toEqual([linkMumOwn])
      expect(ids(await admin.get('/admin/parent-links?studentId=abc'))).toEqual([])
      expect((await admin.get('/admin/parent-links?page=zzz')).body.meta.page).toBe(1)
      expect(ids(await admin.get('/admin/parent-links?page=99'))).toEqual([])
    })

    it('a school_admin sees links of students of the own school only (AC 7); the other school is never listed', async () => {
      const res = await sa.get('/admin/parent-links')
      expect(res.status).toBe(200)
      const got = ids(res)
      expect(got).toContain(linkMumOwn)
      for (const hidden of [linkMixedForeign, linkOnlyForeign]) expect(got).not.toContain(hidden)
      expect(ids(await sa.get(`/admin/parent-links?studentId=${foreign}`))).toEqual([])
      expect(ids(await sa.get(`/admin/parent-links?parentId=${strangerParent.id}`))).toEqual([])
    })

    it('401 without a session; 403 for a student, a teacher and a parent', async () => {
      expectError(await t.http().get('/api/admin/parent-links'), 'UNAUTHORIZED', 'Unauthenticated.')
      for (const who of [student, teacher, mum.api]) expectError(await who.get('/admin/parent-links'), 'FORBIDDEN')
    })
  })

  describe('DELETE /admin/parent-links/:linkId', () => {
    it('401, 403 and CSRF are decided first', async () => {
      expectError(await t.http().delete(`/api/admin/parent-links/${linkMumOwn}`), 'UNAUTHORIZED', 'Unauthenticated.')
      for (const who of [student, teacher, mum.api]) expectError(await who.del(`/admin/parent-links/${linkMumOwn}`), 'FORBIDDEN')
      const who = await login(t, SCHOOL_ADMIN)
      expectError(await who.agent.delete(`/api/admin/parent-links/${linkMumOwn}`), 'CSRF_INVALID')
      expect(await exists(linkMumOwn)).toBe(true)
    })

    it('a school_admin gets 404 (never 403) for a link of a student of another school, and nothing is removed', async () => {
      expectError(await sa.del(`/admin/parent-links/${linkMixedForeign}`), 'NOT_FOUND')
      expectError(await sa.del(`/admin/parent-links/${linkOnlyForeign}`), 'NOT_FOUND')
      expectError(await sa.del('/admin/parent-links/987654321'), 'NOT_FOUND')
      expect(await exists(linkMixedForeign)).toBe(true)
      expect(await exists(linkOnlyForeign)).toBe(true)
    })

    it('a school_admin removes a link of an own-school student: 204, audited with the role', async () => {
      const res = await sa.del(`/admin/parent-links/${linkMumOwn}`)
      expect(res.status).toBe(204)
      expect(res.headers['cache-control']).toBe('no-store')
      expect(await exists(linkMumOwn)).toBe(false)
      const audit = await t.db.query<{ detail: Record<string, unknown>; actor_role: string }>(`select detail, actor_role from audit_events where action = 'parents.link.removed' and target_id = $1`, [linkMumOwn])
      expect(audit).toHaveLength(1)
      expect(audit[0]?.actor_role).toBe('school_admin')
      expect(audit[0]?.detail).toMatchObject({ by: 'school_admin', studentId: own })
    })

    it('admin removes any link, in any school', async () => {
      expect((await admin.del(`/admin/parent-links/${linkOnlyForeign}`)).status).toBe(204)
      expect(await exists(linkOnlyForeign)).toBe(false)
      expectError(await admin.del(`/admin/parent-links/${linkOnlyForeign}`), 'NOT_FOUND')
    })

    it('a removed link changes parent visibility for a school_admin (AC 7)', async () => {
      // mixed parent: one own-school child (already unlinked by the student above) and one foreign child.
      expectError(await sa.get(`/admin/users/${mixed.id}`), 'NOT_FOUND')
      expect((await admin.del(`/admin/parent-links/${linkMixedForeign}`)).status).toBe(204)
      // now it has no child at all: still invisible (fail closed)
      expectError(await sa.get(`/admin/users/${mixed.id}`), 'NOT_FOUND')
      await link(mixed.id, own)
      expect((await sa.get(`/admin/users/${mixed.id}`)).status).toBe(200)
    })
  })
})
