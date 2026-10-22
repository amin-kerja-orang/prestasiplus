import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { featureModules } from '../../src/modules'
import { bootSchoolAdminApp, login, type SchoolAdminTestApp } from '../school-admin/helpers'

/**
 * TRIAGE-1 (D-11 of the AZ-32 rehearsal): every API behind the teacher's `/guru/monitoring*`, `/guru/kirkpatrick*`
 * and teacher report screens stays inside the teacher's own session school, on the PoC seed the demo runs on. The
 * scope comes from the session only: `schoolId`, `state` and `classroomId` in the query never widen it.
 */
describe('TRIAGE-1: teacher report and monitoring APIs are scoped to the own school (PoC seed)', () => {
  let t: SchoolAdminTestApp
  let own: string
  let others: { id: string; name: string }[]
  let foreignPupil: string
  let foreignSchoolOfPupil: string
  let foreignTeacher: { id: string; schoolId: string } | null
  let foreignClass: string
  let teacher: Awaited<ReturnType<typeof login>>

  const get = async (path: string) => teacher.agent.get(path)
  const json = (body: unknown) => JSON.stringify(body)

  beforeAll(async () => {
    // Pin the read throttles high: the sweep sends one request per other school per endpoint (G4 #155 minor 3).
    t = await bootSchoolAdminApp({
      modules: featureModules,
      env: { THROTTLE_KIRKPATRICK_READ_PER_MINUTE: '100000', THROTTLE_ANALYTICS_READ_PER_MINUTE: '100000' },
    })
    await runSeeds(seedModules, { prisma: t.db.prisma, profile: 'poc', env: { NODE_ENV: 'test' } })
    const p = t.db.prisma
    const guru = await p.user.findFirstOrThrow({ where: { email: 'guru@demo.test' }, select: { id: true, schoolId: true } })
    own = String(guru.schoolId)
    others = (await p.school.findMany({ where: { NOT: { id: guru.schoolId! } }, select: { id: true, name: true } })).map((s) => ({ id: String(s.id), name: s.name }))
    const pupil = await t.db.query<{ id: string; school_id: string }>(
      `select u.id::text as id, u.school_id::text as school_id from users u
       where u.school_id is not null and u.school_id <> $1
         and exists (select 1 from user_roles r where r.user_id = u.id and r.role = 'student')
       order by u.id limit 1`,
      [own],
    )
    foreignPupil = pupil[0]!.id
    foreignSchoolOfPupil = pupil[0]!.school_id
    const ft = await t.db.query<{ id: string; school_id: string }>(
      `select c.teacher_id::text as id, c.school_id::text as school_id from classrooms c
       where c.school_id <> $1 and c.teacher_id is not null order by c.id limit 1`,
      [own],
    )
    foreignTeacher = ft[0] ? { id: ft[0].id, schoolId: ft[0].school_id } : null
    // Prefer a class of another school; the PoC seed may only have other teachers' classes in the own school.
    const fc =
      (await p.classroom.findFirst({ where: { NOT: { teacherId: guru.id }, schoolId: { not: guru.schoolId } }, select: { id: true } })) ??
      (await p.classroom.findFirstOrThrow({ where: { NOT: { teacherId: guru.id } }, select: { id: true } }))
    foreignClass = String(fc.id)
    teacher = await login(t, 'guru@demo.test')
  }, 300_000)
  afterAll(async () => {
    await t.close()
  })

  it('the PoC seed has other schools to leak (precondition)', () => {
    expect(others.length).toBeGreaterThanOrEqual(1)
  })

  const tampered = (path: string): string[] => {
    const sep = path.includes('?') ? '&' : '?'
    return [path, ...others.map((s) => `${path}${sep}schoolId=${s.id}`), `${path}${sep}state=Johor`, `${path}${sep}classroomId=${foreignClass}`]
  }

  it('Kirkpatrick filter options list the own school only, whatever the query (the D-11 leak)', async () => {
    for (const path of tampered('/api/kirkpatrick/filter-options')) {
      const res = await get(path)
      expect(res.status, path).toBe(200)
      const data = res.body.data as { schools: { id: string }[] }
      expect(data.schools.map((s) => s.id), path).toEqual([own])
    }
  })

  it.each([
    '/api/kirkpatrick/overview',
    '/api/kirkpatrick/learning',
    '/api/kirkpatrick/behavior',
    '/api/kirkpatrick/results',
    '/api/kirkpatrick/reaction',
    '/api/kirkpatrick/chain',
    '/api/kirkpatrick/interventions',
    '/api/monitoring/overview',
    '/api/monitoring/export?format=csv',
    '/api/teacher/report',
    '/api/teacher/item-analysis',
  ])('%s never carries another school, with or without filter params', async (base) => {
    const plain = await get(base)
    expect(plain.status, base).toBe(200)
    for (const path of tampered(base)) {
      const res = await get(path)
      expect(res.status, path).toBe(200)
      const body = json(res.body)
      for (const s of others) {
        expect(body, `${path} names ${s.name}`).not.toContain(s.name)
        expect(body, `${path} carries schoolId ${s.id}`).not.toMatch(new RegExp(`"school(Id|_id)":"?${s.id}"?[,}]`))
      }
    }
  })

  it('a schoolId or classroomId in the query does not change the teacher view (param tampering is ignored)', async () => {
    for (const base of ['/api/kirkpatrick/overview', '/api/kirkpatrick/behavior', '/api/monitoring/overview', '/api/teacher/report']) {
      const plain = json((await get(base)).body.data)
      for (const s of others) expect(json((await get(`${base}?schoolId=${s.id}`)).body.data), `${base} schoolId=${s.id}`).toBe(plain)
      expect(json((await get(`${base}?classroomId=${foreignClass}`)).body.data), `${base} classroomId`).toBe(plain)
    }
  })

  it('another school and its pupils and teachers answer 404 or 403', async () => {
    for (const s of others) expect((await get(`/api/monitoring/schools/${s.id}`)).status, s.id).toBe(404)
    expect((await get(`/api/monitoring/schools/${own}`)).status).toBe(200)
    expect((await get(`/api/monitoring/schools/${foreignSchoolOfPupil}/students/${foreignPupil}`)).status).toBe(404)
    expect((await get(`/api/monitoring/schools/${own}/students/${foreignPupil}`)).status).toBe(404)
    expect((await get(`/api/kirkpatrick/students/${foreignPupil}`)).status).toBe(403)
    if (foreignTeacher) {
      expect((await get(`/api/monitoring/schools/${foreignTeacher.schoolId}/teachers/${foreignTeacher.id}`)).status).toBe(404)
      expect((await get(`/api/monitoring/schools/${own}/teachers/${foreignTeacher.id}`)).status).toBe(404)
    }
  })

  it('Amaran school drill-downs of another school answer 404 to the teacher', async () => {
    for (const o of others) {
      expect((await get(`/api/amaran/schools/${o.id}`)).status, o.id).toBe(404)
      expect((await get(`/api/amaran/summary?scope=school&schoolId=${o.id}`)).status, o.id).toBe(404)
    }
  })

  it('the school admin is held to the own school on the same endpoints (same pattern)', async () => {
    const sa = await login(t, 'adminsekolah@demo.test')
    const fo = (await sa.agent.get(`/api/kirkpatrick/filter-options?schoolId=${others[0]!.id}`)).body.data as { schools: { id: string }[] }
    expect(fo.schools.map((s) => s.id)).toEqual([own])
    for (const path of [
      `/api/kirkpatrick/overview?schoolId=${others[0]!.id}`,
      `/api/monitoring/overview?schoolId=${others[0]!.id}`,
      `/api/admin-sekolah/dashboard?schoolId=${others[0]!.id}`,
      `/api/admin-sekolah/pelajar?schoolId=${others[0]!.id}`,
      `/api/admin-sekolah/kelas?schoolId=${others[0]!.id}`,
      `/api/amaran/summary?schoolId=${others[0]!.id}`,
    ]) {
      const res = await sa.agent.get(path)
      expect(res.status, path).toBe(200)
      for (const s of others) expect(json(res.body), `${path} names ${s.name}`).not.toContain(s.name)
    }
    for (const o of others) {
      expect((await sa.agent.get(`/api/amaran/schools/${o.id}`)).status, o.id).toBe(404)
      expect((await sa.agent.get(`/api/amaran/summary?scope=school&schoolId=${o.id}`)).status, o.id).toBe(404)
    }
    expect((await sa.agent.get(`/api/monitoring/schools/${others[0]!.id}`)).status).toBe(404)
    expect((await sa.agent.get(`/api/admin-sekolah/pelajar/${foreignPupil}`)).status).toBe(404)
  })

  it('a parent cannot reach the staff report APIs', async () => {
    const parent = await login(t, 'ibubapa@demo.test')
    for (const path of ['/api/kirkpatrick/filter-options', '/api/monitoring/overview', '/api/teacher/report', `/api/kirkpatrick/students/${foreignPupil}`]) {
      expect((await parent.agent.get(path)).status, path).toBe(403)
    }
  })
})
