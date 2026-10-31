/**
 * M02-T1: the admin users handlers (SRS M02 v1.28 §7 #1–#11, #39; BR-01…BR-13, FR-M02-99, DV-M02-13,
 * DV-M02-16). Boots the whole registry with latency 0 and a fixed clock; the tests share one boot, so the
 * read-only checks (totals, anchors) come first and every mutation works on users the test creates.
 */

import { beforeAll, describe, expect, it } from 'vitest'

import { api } from '@/api'
import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { CANONICAL_ACCOUNTS, DEMO_PASSWORD } from '@/mock/core-data/accounts'
import { bootMock, type MockRuntime } from '@/mock/index'
import { anchorUserIds, isAnchorUser, users } from '@/modules/m01-authentication/mock'

import {
  assignUserPackage,
  bulkDeleteAdminUsers,
  createAdminUser,
  deleteAdminUser,
  fetchAdminDefaults,
  fetchAdminUser,
  fetchAdminUsers,
  fetchUserFilters,
  fetchUserPackages,
  impersonateUser,
  searchStudents,
  toggleUserActive,
  updateAdminUser,
  type AdminDefaults,
  type AdminUserDetail,
  type AdminUserListItem,
  type AdminUserListMeta,
  type AdminUserPackages,
  type ImpersonationSession,
  type SchoolAdminPackage,
  type StudentSearchItem,
} from '../../api/users'
import { parentLinks, schoolAdminPackages, schools } from '../../mock'
import { M02_CONFIG_DEFAULTS } from '../../mock/m02-config'
import { showPrimarySchools } from '../../mock/repository/schools'

interface Reply {
  status: number
  body: {
    data?: unknown
    meta?: Record<string, unknown> & { roleCounts?: AdminUserListMeta['roleCounts'] }
    status?: string
    error?: { code: string; message: string; fields?: Record<string, string> }
  }
  res: TransportResponse
}

let runtime: MockRuntime
const clock = createClock({ at: CLOCK_ANCHOR_ISO })

beforeAll(async () => {
  // These tests assert the observed live totals (primary-type schools and Darjah pupils included); the
  // hiding (D72) is covered by secondary-only.test.ts.
  showPrimarySchools()
  runtime = await bootMock({ mode: 'test', clock, latencyMs: 0, onWarn: null })
}, 120_000)

async function call(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  url: string,
  body?: unknown,
  token?: string,
): Promise<Reply> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await runtime.transport.request({
    method,
    url,
    headers,
    ...(body === undefined ? {} : { body }),
  })
  return { status: res.status, body: res.body ?? {}, res }
}

async function loginToken(email: string, password = DEMO_PASSWORD): Promise<string> {
  const r = await call('POST', '/api/auth/login', { email, password })
  expect(r.status).toBe(200)
  return (r.body.data as { token: string }).token
}

let admin: string
let student: string
/**
 * Runs `fn` with the mock clock at `iso`. A session slides 120 minutes from its last request, so the
 * admin logs in again at that time (a token from the anchor time would be expired) and the clock and the
 * token are put back afterwards.
 */
async function atTime<T>(iso: string, fn: () => Promise<T>): Promise<T> {
  const keep = admin
  clock.setNow(iso)
  try {
    admin = await loginToken('admin@demo.test')
    return await fn()
  } finally {
    clock.setNow(CLOCK_ANCHOR_ISO)
    admin = keep
  }
}
beforeAll(async () => {
  admin = await loginToken('admin@demo.test')
  student = await loginToken('pelajar@demo.test')
}, 120_000)

const get = (url: string, token = admin) => call('GET', url, undefined, token)
const post = (url: string, body?: unknown, token = admin) => call('POST', url, body, token)
const put = (url: string, body: unknown, token = admin) => call('PUT', url, body, token)
const del = (url: string, token = admin) => call('DELETE', url, undefined, token)
const data = <T>(r: Reply): T => r.body.data as T
const detail = async (id: number) =>
  data<AdminUserDetail>(await get(`/api/admin/users/${String(id)}`))

let counter = 0
/** A valid create body; `overrides` win. Each call uses a fresh e-mail. */
function newUser(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  counter++
  return {
    role: 'teacher',
    name: `Guru Ujian ${String(counter)}`,
    email: `guru.ujian${String(counter)}@demo.test`,
    password: 'rahsia123',
    passwordConfirmation: 'rahsia123',
    ...overrides,
  }
}

async function createUser(overrides: Record<string, unknown> = {}): Promise<AdminUserDetail> {
  const r = await post('/api/admin/users', newUser(overrides))
  expect(r.status).toBe(201)
  return data<AdminUserDetail>(r)
}

const NOW_MYT = CLOCK_ANCHOR_ISO

// -------------------------------------------------------------------------------------------------
describe('guards: every /api/admin route is admin-only (FR-M02-99)', () => {
  const routes: [string, string, unknown?][] = [
    ['GET', '/api/admin/users'],
    ['GET', '/api/admin/users/filters'],
    ['GET', '/api/admin/users/2'],
    ['POST', '/api/admin/users', {}],
    ['PUT', '/api/admin/users/2', {}],
    ['DELETE', '/api/admin/users/2'],
    ['POST', '/api/admin/users/bulk-delete', { ids: [2] }],
    ['POST', '/api/admin/users/2/toggle-active'],
    ['POST', '/api/admin/users/2/impersonate'],
    ['GET', '/api/admin/users/8/packages'],
    ['POST', '/api/admin/users/8/packages', {}],
    ['GET', '/api/admin/config/defaults'],
  ]

  it.each(routes)('%s %s: guest 401, student 403', async (method, url, body) => {
    const m = method as 'GET' | 'POST' | 'PUT' | 'DELETE'
    const guest = await call(m, url, body)
    expect(guest.status).toBe(401)
    expect(guest.body.error?.code).toBe('UNAUTHORIZED')
    const forbidden = await call(m, url, body, student)
    expect(forbidden.status).toBe(403)
    expect(forbidden.body.error?.code).toBe('FORBIDDEN')
  })

  it('a refused call changes nothing', async () => {
    const before = users.countWhere({})
    await call('POST', '/api/admin/users/bulk-delete', { ids: [3] }, student)
    await call('DELETE', '/api/admin/users/3', undefined, student)
    expect(users.get(3)).toBeDefined()
    expect(users.countWhere({})).toBe(before)
  })

  it('a school admin, a teacher and an officer are refused as well', async () => {
    for (const email of ['adminsekolah@demo.test', 'guru@demo.test', 'ppd@demo.test']) {
      const token = await loginToken(email)
      expect((await get('/api/admin/users', token)).status).toBe(403)
    }
  })
})

// -------------------------------------------------------------------------------------------------
describe('GET /api/admin/users (#1)', () => {
  it('reports the live totals and the S1 role cards (§6.15 B)', async () => {
    const r = await get('/api/admin/users')
    expect(r.status).toBe(200)
    expect(r.body.meta).toMatchObject({
      page: 1,
      pageSize: 25,
      totalItems: 5159,
      totalPages: 207,
      from: 1,
      to: 25,
    })
    expect(r.body.meta?.roleCounts).toEqual({
      student: 4533,
      teacher: 551,
      parent: 38,
      sponsor: 6,
      schoolAdmin: 16,
      ppdOfficer: 5,
      admin: 2,
    })
    expect((r.body.data as unknown[]).length).toBe(25)
  })

  it('lists newest first with the AdminUserListItem shape and no secret field', async () => {
    const r = await get('/api/admin/users')
    const rows = data<AdminUserListItem[]>(r)
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i - 1]!.createdAt >= rows[i]!.createdAt).toBe(true)
    }
    expect(Object.keys(rows[0]!).sort()).toEqual(
      [
        'avatarUrl',
        'createdAt',
        'email',
        'id',
        'isActive',
        'name',
        'phone',
        'role',
        'school',
      ].sort(),
    )
    const text = JSON.stringify(r.body)
    for (const leak of ['password', 'icNumber', 'icHash', 'salt']) expect(text).not.toContain(leak)
  })

  it('shows the last page as "5151 to 5159" and an out-of-range page as an empty page', async () => {
    const last = await get('/api/admin/users?page=207')
    expect(last.body.meta).toMatchObject({ page: 207, from: 5151, to: 5159, totalPages: 207 })
    expect((last.body.data as unknown[]).length).toBe(9)
    const beyond = await get('/api/admin/users?page=300')
    expect(beyond.body.meta).toMatchObject({ page: 300, from: null, to: null, totalItems: 5159 })
    expect(beyond.body.data).toEqual([])
    // A bad page number means page 1 (Laravel).
    expect((await get('/api/admin/users?page=abc')).body.meta).toMatchObject({ page: 1 })
  })

  it.each([
    ['role=student', 4533],
    ['role=teacher', 551],
    ['role=parent', 38],
    ['role=sponsor', 6],
    ['role=school_admin', 16],
    ['role=ppd_officer', 5],
    ['role=jpn_officer', 2],
    ['role=admin', 2],
    ['isActive=0', 1432],
    ['isActive=1', 3727],
    ['schoolId=987', 2],
    ['role=student&isActive=0', 1371],
    ['role=teacher&isActive=0', 48],
  ])('filter ?%s → %i users', async (query, total) => {
    const r = await get(`/api/admin/users?${query}`)
    expect(r.body.meta?.totalItems).toBe(total)
  })

  it('pages the inactive filter over 58 pages and keeps the role cards unfiltered (BR-02)', async () => {
    const r = await get('/api/admin/users?isActive=0')
    expect(r.body.meta?.totalPages).toBe(58)
    const filtered = await get('/api/admin/users?role=jpn_officer&search=zzz-none')
    expect(filtered.body.meta?.totalItems).toBe(0)
    expect(filtered.body.meta?.roleCounts).toEqual(
      (await get('/api/admin/users')).body.meta?.roleCounts,
    )
  })

  it('searches name or e-mail (case-insensitive, trimmed) and ANDs the filters', async () => {
    const byEmail = data<AdminUserListItem[]>(await get('/api/admin/users?search=PELAJAR@demo'))
    expect(byEmail.map((u) => u.id)).toEqual([2])
    const byName = data<AdminUserListItem[]>(await get('/api/admin/users?search=Pelajar%20Dua'))
    expect(byName.map((u) => u.id)).toContain(3)
    const combined = await get('/api/admin/users?search=demo&role=jpn_officer&isActive=1')
    expect(data<AdminUserListItem[]>(combined).every((u) => u.role === 'jpn_officer')).toBe(true)
    expect(combined.body.meta?.totalItems).toBe(2)
  })

  it('a role outside the 8 codes, `unmapped`, or a non-numeric school matches nothing', async () => {
    for (const q of ['role=hacker', 'role=unmapped', 'schoolId=abc']) {
      const r = await get(`/api/admin/users?${q}`)
      expect(r.status).toBe(200)
      expect(r.body.meta?.totalItems).toBe(0)
    }
    // An empty filter value is no filter (an empty form field).
    expect(
      (await get('/api/admin/users?role=&schoolId=&isActive=&search=')).body.meta?.totalItems,
    ).toBe(5159)
  })

  it('carries the school {id, name} of a user and null without one', async () => {
    const rows = data<AdminUserListItem[]>(await get('/api/admin/users?search=pelajar2@demo.test'))
    expect(rows[0]).toMatchObject({ id: 3, school: null, role: 'student', isActive: true })
    const two = data<AdminUserListItem[]>(await get('/api/admin/users?search=pelajar@demo.test'))
    expect(two[0]!.school).toEqual({ id: 900_001, name: 'SMK DEMO' })
  })

  it('shows the 6 unmapped users with their raw badge code (D9)', () => {
    expect(users.adminList({ role: 'unmapped' }).total).toBe(6)
  })
})

// -------------------------------------------------------------------------------------------------
describe('GET /api/admin/users/filters (#2)', () => {
  it('lists the 60 schools with ≥ 1 user, sorted by name (BR-03, DV-M02-13)', async () => {
    const r = await get('/api/admin/users/filters')
    const list = data<{ schools: { id: number; name: string }[] }>(r).schools
    expect(list).toHaveLength(60)
    const ids = list.map((s) => s.id)
    for (const fixture of [900_001, 900_002, 900_003]) expect(ids).toContain(fixture)
    for (const anchor of [987, 8078, 8082, 8102, 8106, 8300, 1014, 995])
      expect(ids).toContain(anchor)
    const names = list.map((s) => s.name.toLowerCase())
    expect(names).toEqual([...names].sort())
    expect(list.find((s) => s.id === 900_001)?.name).toBe('SMK DEMO')
  })

  it('matches users.schoolsWithUsers() and every listed school exists', async () => {
    const list = data<{ schools: { id: number }[] }>(await get('/api/admin/users/filters')).schools
    expect(list.map((s) => s.id).sort((a, b) => a - b)).toEqual(users.schoolsWithUsers())
    expect(list.every((s) => schools.get(s.id) !== undefined)).toBe(true)
  })
})

// -------------------------------------------------------------------------------------------------
describe('GET /api/admin/users/:id (#3) and the anchors (§6.14, §6.15)', () => {
  it('returns the detail of the canonical admin: no IC, landing /admin, own school', async () => {
    const d = await detail(1)
    expect(d).toMatchObject({
      id: 1,
      email: 'admin@demo.test',
      role: 'admin',
      isActive: true,
      icNumber: null,
      landingPath: '/admin',
      linkedStudents: [],
      subscriptionPackage: 'none',
      hasPkskSubscription: false,
    })
    expect(d.school).toBeNull() // the central admin has no school (D72)
    expect(d.updatedAt).toBeTruthy()
  })

  it('returns the fictitious fixture IC of a seeded student and never a password', async () => {
    const pelajar = CANONICAL_ACCOUNTS.find((a) => a.id === 2)!
    const r = await get('/api/admin/users/2')
    expect(data<AdminUserDetail>(r).icNumber).toBe(pelajar.icNumber)
    expect(JSON.stringify(r.body)).not.toContain('passwordHash')
    expect(JSON.stringify(r.body)).not.toContain(DEMO_PASSWORD)
  })

  it('returns parent 6 with its 2 linked children (links 1 and 2) and parent 5401 with none', async () => {
    const d = await detail(6)
    expect(d.role).toBe('parent')
    expect(d.linkedStudents.map((s) => s.id)).toEqual([2, 4])
    expect(d.linkedStudents[0]).toEqual({
      id: 2,
      name: 'Pelajar Demo',
      classLevel: 'T4',
      schoolName: 'SMK DEMO',
    })
    expect(d.linkedStudents[1]).toMatchObject({
      id: 4,
      classLevel: 'T5',
      schoolName: 'SMK DEMO',
    })
    expect(parentLinks.all().map((l) => l.id)).toEqual(expect.arrayContaining([1, 2]))
    expect((await detail(5401)).linkedStudents).toEqual([])
    // Only a parent carries children.
    expect((await detail(2)).linkedStudents).toEqual([])
  })

  it('answers 404 for an unknown id and for a non-numeric id', async () => {
    expect((await get('/api/admin/users/8000000')).status).toBe(404)
    expect((await get('/api/admin/users/abc')).status).toBe(404)
  })

  it.each([
    [5001, 'student', 8102],
    [5210, 'student', 8102],
    [5301, 'teacher', null],
    [5302, 'teacher', 8102],
    [5329, 'teacher', null],
    [5401, 'parent', null],
    [5411, 'parent', null],
    [5501, 'sponsor', null],
    [5502, 'sponsor', null],
    [5601, 'school_admin', 8102],
    [5605, 'school_admin', 998],
    [5701, 'ppd_officer', null],
    [5703, 'ppd_officer', null],
    [5711, 'jpn_officer', null],
    [5801, 'admin', null],
    [5901, 'student', 8102],
    [5990, 'student', 8102],
  ])('fixture anchor %i is a %s at school %s', async (id, role, schoolId) => {
    expect(isAnchorUser(id)).toBe(true)
    const d = await detail(id)
    expect(d).toMatchObject({ id, role, schoolId })
    expect(d.isActive).toBe(true)
  })

  it('the fixture blocks are complete anchors (5001–5990) and the canonical accounts are 1–11', () => {
    const ids = anchorUserIds()
    for (const id of [
      1, 2, 11, 5001, 5210, 5301, 5329, 5401, 5411, 5501, 5502, 5601, 5605, 5701, 5711, 5801, 5901,
      5990,
    ]) {
      expect(ids).toContain(id)
    }
    expect(ids.filter((id) => id >= 5001 && id <= 5210)).toHaveLength(210)
    expect(ids.filter((id) => id >= 5901 && id <= 5990)).toHaveLength(90)
  })

  it('school admins 5601–5605 log in with a generator-style id and 5601 sits at the S16 school 8102', async () => {
    const d = await detail(5601)
    expect(d.email).toBe('bea4628@prestasiplus.my')
    expect(d.school?.name).toBe('SEKOLAH MENENGAH KEBANGSAAN BANDAR TASIK KESUMA')
    expect(d).toMatchObject({ ppdState: 'Selangor', ppdDistrict: 'PPD HULU LANGAT' })
  })

  it('officers: canonical 9 is a PPD officer, 10 and 5711 are JPN officers (DV-M02-03)', async () => {
    expect(await detail(9)).toMatchObject({
      role: 'ppd_officer',
      ppdState: 'Selangor',
      ppdDistrict: 'PPD HULU LANGAT',
      landingPath: '/ppd/dashboard',
    })
    expect(await detail(10)).toMatchObject({
      role: 'jpn_officer',
      ppdState: 'Selangor',
      landingPath: '/jpn/dashboard',
    })
    expect(await detail(5711)).toMatchObject({
      role: 'jpn_officer',
      ppdState: 'Johor',
      ppdDistrict: null,
    })
  })

  it('inactive account 11 is inactive; student 3 has no IC or school ("-" cells)', async () => {
    expect((await detail(11)).isActive).toBe(false)
    expect(await detail(3)).toMatchObject({ school: null, icNumber: null, phone: null })
  })

  it('never-logged-in fixtures have no lastLoginAt; 4202 keeps the observed 04/06/2026 05:47 login', async () => {
    for (const id of [5001, 5210, 5301, 5901, 5990])
      expect((await detail(id)).lastLoginAt).toBeNull()
    expect((await detail(4202)).lastLoginAt).toBe('2026-06-04T05:47:00+08:00')
  })

  it('DV row 4627: a generated login inside the register window, after its creation (v1.27)', async () => {
    const d = await detail(4627)
    expect(d).toMatchObject({ role: 'student', schoolId: 8082, grade: 11 })
    expect(d.lastLoginAt).not.toBeNull()
    expect(d.lastLoginAt! < '2026-08-21').toBe(true)
    expect(d.lastLoginAt! > d.createdAt).toBe(true)
  })

  it('the 6 M02 fixture schools admins and every role count add up to the live total', () => {
    const c = users.roleCounts()
    const sum = Object.values(c).reduce((a, b) => a + b, 0)
    // 5,151 on the seven cards + 2 jpn_officer + 6 unmapped (D9) = 5,159.
    expect(
      sum + users.countWhere({ role: 'jpn_officer' }) + users.countWhere({ role: 'unmapped' }),
    ).toBe(5159)
  })
})

// -------------------------------------------------------------------------------------------------
describe('POST /api/admin/users (#4)', () => {
  it('creates a teacher: 201, id from 9,000,001, active by default, status text (X-9)', async () => {
    const r = await post('/api/admin/users', newUser({ phone: '0191234567' }))
    expect(r.status).toBe(201)
    expect(r.body.status).toBe('Pengguna berjaya didaftarkan.')
    const d = data<AdminUserDetail>(r)
    expect(d.id).toBeGreaterThanOrEqual(9_000_001)
    expect(d).toMatchObject({
      role: 'teacher',
      isActive: true,
      phone: '0191234567',
      grade: null,
      landingPath: '/dashboard',
    })
    expect(users.get(d.id)?.createdById).toBe(1)
    // The list shows it first (newest) and counts it.
    const list = await get('/api/admin/users')
    expect(data<AdminUserListItem[]>(list)[0]!.id).toBe(d.id)
    expect(list.body.meta?.totalItems).toBe(5160)
    expect(list.body.meta?.roleCounts?.teacher).toBe(552)
  })

  it('the new user can log in with the password the admin typed (hashed at rest)', async () => {
    const body = newUser({ password: 'Kata2Laluan', passwordConfirmation: 'Kata2Laluan' })
    const d = await createUser(body)
    expect(
      (await call('POST', '/api/auth/login', { email: body.email, password: 'Kata2Laluan' }))
        .status,
    ).toBe(200)
    expect(users.verifyPassword(d.id, 'Kata2Laluan')).toBe(true)
  })

  it('creates an inactive user when the switch is off; that user is refused at login (BR-05)', async () => {
    const body = newUser({ isActive: false })
    const d = await createUser(body)
    expect(d.isActive).toBe(false)
    const login = await call('POST', '/api/auth/login', {
      email: body.email,
      password: body.password,
    })
    expect(login.status).toBe(403)
  })

  it('creates a student with a grade, an IC (returned masked, DV-M02-16) and a school', async () => {
    const d = await createUser({
      role: 'student',
      grade: 8,
      icNumber: '090101101234',
      schoolId: 987,
    })
    expect(d).toMatchObject({ role: 'student', grade: 8, schoolId: 987 })
    expect(d.school?.id).toBe(987)
    expect(d.icNumber).toBe('xxxxxx-xx-xx34')
    expect(users.get(d.id)?.classLevel).toBe('T2')
    expect(users.verifyIc(d.id, '090101101234')).toBe(true)
    // The plaintext IC is not in the payload of any read.
    expect(JSON.stringify((await get(`/api/admin/users/${String(d.id)}`)).body)).not.toContain(
      '090101101234',
    )
  })

  it('ignores the IC and the grade of a role that does not use them (hidden sections)', async () => {
    const d = await createUser({ role: 'teacher', grade: 5, icNumber: '090101101234' })
    expect(d.grade).toBeNull()
    expect(d.icNumber).toBeNull()
  })

  it('creates a parent with linked children; duplicates are ignored (BR-10)', async () => {
    const d = await createUser({ role: 'parent', linkedStudentIds: [2, 4, 2] })
    expect(d.linkedStudents.map((s) => s.id)).toEqual([2, 4])
    expect(parentLinks.parentIdsOf(2)).toEqual(expect.arrayContaining([6, d.id]))
    const link = parentLinks.all().find((l) => l.parentId === d.id)!
    expect(link.id).toBeGreaterThanOrEqual(1000)
    // A parent without children is fine ("Boleh juga ditambah kemudian").
    expect((await createUser({ role: 'parent' })).linkedStudents).toEqual([])
  })

  it('creates a school admin; JPN and PPD default to the school state and district (BR-09)', async () => {
    const d = await createUser({ role: 'school_admin', schoolId: 8102 })
    expect(d).toMatchObject({ role: 'school_admin', schoolId: 8102, ppdState: 'Selangor' })
    expect(d.ppdDistrict).toBe(schools.get(8102)!.district)
    const explicit = await createUser({
      role: 'school_admin',
      schoolId: 8102,
      ppdState: 'Selangor',
      ppdDistrict: 'PPD KLANG',
    })
    expect(explicit.ppdDistrict).toBe('PPD KLANG')
  })

  it('creates a PPD officer and a JPN officer with their JPN / PPD (BR-08)', async () => {
    const ppd = await createUser({
      role: 'ppd_officer',
      ppdState: 'Selangor',
      ppdDistrict: 'PPD GOMBAK',
    })
    expect(ppd).toMatchObject({
      role: 'ppd_officer',
      ppdState: 'Selangor',
      ppdDistrict: 'PPD GOMBAK',
      landingPath: '/ppd/dashboard',
    })
    const jpn = await createUser({
      role: 'jpn_officer',
      ppdState: 'Johor',
      ppdDistrict: 'PPD KLANG',
    })
    // A JPN officer has no PPD: it is not stored.
    expect(jpn).toMatchObject({
      role: 'jpn_officer',
      ppdState: 'Johor',
      ppdDistrict: null,
      landingPath: '/jpn/dashboard',
    })
  })

  it('creates the other standard roles and counts them on the cards', async () => {
    const before = users.roleCounts()
    await createUser({ role: 'sponsor' })
    await createUser({ role: 'admin' })
    const after = users.roleCounts()
    expect(after.sponsor).toBe(before.sponsor + 1)
    expect(after.admin).toBe(before.admin + 1)
  })

  it('numbers runtime users in creation order and never reuses an id', async () => {
    const a = await createUser()
    const b = await createUser()
    expect(b.id).toBe(a.id + 1)
    expect((await del(`/api/admin/users/${String(b.id)}`)).status).toBe(200)
    const c = await createUser()
    expect(c.id).toBe(b.id + 1)
  })

  describe('validation (422 VALIDATION_ERROR, §5 copy)', () => {
    const fieldsOf = async (overrides: Record<string, unknown>) => {
      const r = await post('/api/admin/users', overrides)
      expect(r.status).toBe(422)
      expect(r.body.error?.code).toBe('VALIDATION_ERROR')
      return r.body.error?.fields ?? {}
    }

    it('an empty body reports role, name, e-mail and password', async () => {
      expect(await fieldsOf({})).toEqual({
        role: 'The role field is required.',
        name: 'The name field is required.',
        email: 'The email field is required.',
        password: 'The password field is required.',
      })
    })

    it('rejects a bad e-mail, a taken e-mail (any case), a short and an unconfirmed password', async () => {
      expect((await fieldsOf(newUser({ email: 'bukan-emel' }))).email).toBe(
        'The email field must be a valid email address.',
      )
      expect((await fieldsOf(newUser({ email: 'Pelajar@Demo.TEST' }))).email).toBe(
        'The email has already been taken.',
      )
      expect(
        (await fieldsOf(newUser({ password: '12345', passwordConfirmation: '12345' }))).password,
      ).toBe('The password field must be at least 6 characters.')
      expect((await fieldsOf(newUser({ passwordConfirmation: 'lain-lain' }))).password).toBe(
        'The password field confirmation does not match.',
      )
    })

    it('rejects a role outside the 8 codes (also `unmapped`), a long name and a long phone', async () => {
      expect((await fieldsOf(newUser({ role: 'hacker' }))).role).toBe(
        'The selected role is invalid.',
      )
      expect((await fieldsOf(newUser({ role: 'unmapped' }))).role).toBe(
        'The selected role is invalid.',
      )
      expect((await fieldsOf(newUser({ name: 'x'.repeat(256) }))).name).toBe(
        'The name field must not be greater than 255 characters.',
      )
      expect((await fieldsOf(newUser({ phone: '0'.repeat(15) }))).phone).toBe(
        'The phone field must not be greater than 14 characters.',
      )
    })

    it('requires a grade 1–11 for a student', async () => {
      expect((await fieldsOf(newUser({ role: 'student' }))).grade).toBe(
        'The grade field is required when role is student.',
      )
      expect((await fieldsOf(newUser({ role: 'student', grade: 12 }))).grade).toBe(
        'The selected grade is invalid.',
      )
      expect((await fieldsOf(newUser({ role: 'student', grade: 0 }))).grade).toBe(
        'The selected grade is invalid.',
      )
    })

    it('limits the IC to 14 characters and checks that a school exists', async () => {
      expect(
        (await fieldsOf(newUser({ role: 'student', grade: 5, icNumber: '1'.repeat(15) }))).icNumber,
      ).toBe('The ic number field must not be greater than 14 characters.')
      expect((await fieldsOf(newUser({ schoolId: 7_777_777 }))).schoolId).toBe(
        'The selected school id is invalid.',
      )
    })

    it('requires a school for a school admin', async () => {
      expect((await fieldsOf(newUser({ role: 'school_admin' }))).schoolId).toBe(
        'The school id field is required when role is school_admin.',
      )
    })

    it('requires the JPN for an officer and the PPD for a PPD officer, and checks both', async () => {
      const noState = await fieldsOf(newUser({ role: 'ppd_officer' }))
      expect(noState.ppdState).toBe('The ppd state field is required.')
      expect(noState.ppdDistrict).toBe(
        'The ppd district field is required when role is ppd_officer.',
      )
      expect((await fieldsOf(newUser({ role: 'jpn_officer' }))).ppdState).toBe(
        'The ppd state field is required.',
      )
      expect(
        (
          await fieldsOf(
            newUser({ role: 'ppd_officer', ppdState: 'Atlantis', ppdDistrict: 'PPD GOMBAK' }),
          )
        ).ppdState,
      ).toBe('The selected ppd state is invalid.')
      // A PPD of another state.
      expect(
        (
          await fieldsOf(
            newUser({ role: 'ppd_officer', ppdState: 'Johor', ppdDistrict: 'PPD GOMBAK' }),
          )
        ).ppdDistrict,
      ).toBe('The selected ppd district is invalid.')
    })

    it('every linked id must be a student', async () => {
      expect(
        (await fieldsOf(newUser({ role: 'parent', linkedStudentIds: [2, 5] }))).linkedStudentIds,
      ).toBe('The selected linked student ids is invalid.')
      expect(
        (await fieldsOf(newUser({ role: 'parent', linkedStudentIds: [8_000_000] })))
          .linkedStudentIds,
      ).toBe('The selected linked student ids is invalid.')
    })

    it('a refused create writes nothing (no user, no link)', async () => {
      const total = users.countWhere({})
      const links = parentLinks.all().length
      await post('/api/admin/users', newUser({ role: 'parent', linkedStudentIds: [2, 5] }))
      expect(users.countWhere({})).toBe(total)
      expect(parentLinks.all().length).toBe(links)
    })
  })
})

// -------------------------------------------------------------------------------------------------
describe('PUT /api/admin/users/:id (#5)', () => {
  const base = (d: AdminUserDetail, extra: Record<string, unknown> = {}) => ({
    name: d.name,
    email: d.email,
    role: d.role,
    isActive: d.isActive,
    ...extra,
  })

  it('updates the common fields and stamps updatedAt (S3 "Kemaskini:")', async () => {
    const d = await createUser({ phone: '0123456789' })
    await atTime('2026-09-26T09:30:00+08:00', async () => {
      const r = await put(
        `/api/admin/users/${String(d.id)}`,
        base(d, { name: 'Nama Baru', phone: null }),
      )
      expect(r.status).toBe(200)
      expect(r.body.status).toBe('Pengguna berjaya dikemaskini.')
      const saved = data<AdminUserDetail>(r)
      expect(saved).toMatchObject({ id: d.id, name: 'Nama Baru', phone: null })
      expect(saved.updatedAt).toBe('2026-09-26T09:30:00+08:00')
      expect(saved.createdAt).toBe(d.createdAt)
    })
  })

  it('answers 404 for an unknown user', async () => {
    expect(
      (await put('/api/admin/users/8000000', { name: 'x', email: 'x@demo.test', role: 'teacher' }))
        .status,
    ).toBe(404)
  })

  it('validates like create, with the user itself excluded from "taken" (BR-08)', async () => {
    const d = await createUser()
    const other = await createUser()
    const same = await put(
      `/api/admin/users/${String(d.id)}`,
      base(d, { email: d.email.toUpperCase() }),
    )
    expect(same.status).toBe(200)
    const taken = await put(`/api/admin/users/${String(d.id)}`, base(d, { email: other.email }))
    expect(taken.status).toBe(422)
    expect(taken.body.error?.fields?.email).toBe('The email has already been taken.')
    const empty = await put(`/api/admin/users/${String(d.id)}`, {})
    expect(empty.body.error?.fields).toMatchObject({
      name: 'The name field is required.',
      email: 'The email field is required.',
      role: 'The role field is required.',
    })
  })

  it('sets a new password only when filled; it must be ≥ 6 and confirmed', async () => {
    const d = await createUser({ password: 'lama-lama', passwordConfirmation: 'lama-lama' })
    const url = `/api/admin/users/${String(d.id)}`
    const short = await put(url, base(d, { newPassword: '123', newPasswordConfirmation: '123' }))
    expect(short.body.error?.fields?.newPassword).toBe(
      'The new password field must be at least 6 characters.',
    )
    const mismatch = await put(
      url,
      base(d, { newPassword: 'baru-baru', newPasswordConfirmation: 'lain' }),
    )
    expect(mismatch.body.error?.fields?.newPassword).toBe(
      'The new password field confirmation does not match.',
    )
    expect(users.verifyPassword(d.id, 'lama-lama')).toBe(true)
    // Blank = keep the old password.
    expect((await put(url, base(d, { newPassword: '', newPasswordConfirmation: '' }))).status).toBe(
      200,
    )
    expect(users.verifyPassword(d.id, 'lama-lama')).toBe(true)
    expect(
      (await put(url, base(d, { newPassword: 'baru-baru', newPasswordConfirmation: 'baru-baru' })))
        .status,
    ).toBe(200)
    expect(users.verifyPassword(d.id, 'baru-baru')).toBe(true)
    expect(users.verifyPassword(d.id, 'lama-lama')).toBe(false)
  })

  it('takes effect at once: a deactivated user is refused at login (BR-05)', async () => {
    const created = newUser()
    const d = await createUser(created)
    await put(`/api/admin/users/${String(d.id)}`, base(d, { isActive: false }))
    expect(
      (await call('POST', '/api/auth/login', { email: created.email, password: created.password }))
        .status,
    ).toBe(403)
    await put(`/api/admin/users/${String(d.id)}`, base(d, { isActive: true }))
    expect(
      (await call('POST', '/api/auth/login', { email: created.email, password: created.password }))
        .status,
    ).toBe(200)
  })

  it('student section: grade, IC, school and PKSK; hidden fields keep their values (BR-11)', async () => {
    const d = await createUser({ role: 'student', grade: 5, icNumber: '090101101234' })
    const url = `/api/admin/users/${String(d.id)}`
    const r = await put(
      url,
      base(d, { grade: 9, hasPkskSubscription: true, schoolId: 987, icNumber: '090202105678' }),
    )
    expect(data<AdminUserDetail>(r)).toMatchObject({
      grade: 9,
      hasPkskSubscription: true,
      schoolId: 987,
      icNumber: 'xxxxxx-xx-xx78',
    })
    expect(users.get(d.id)?.classLevel).toBe('T3')
    // A later save that sends none of the section leaves it alone.
    const again = data<AdminUserDetail>(await put(url, base(d, { name: 'Sama Sahaja' })))
    expect(again).toMatchObject({
      grade: 9,
      hasPkskSubscription: true,
      schoolId: 987,
      icNumber: 'xxxxxx-xx-xx78',
    })
    // `null` clears the IC and the school.
    const cleared = data<AdminUserDetail>(
      await put(url, base(d, { icNumber: null, schoolId: null })),
    )
    expect(cleared).toMatchObject({ icNumber: null, schoolId: null, school: null })
    expect(users.verifyIc(d.id, '090202105678')).toBe(false)
  })

  it('requires a grade for a record that would be a student without one, and range-checks it', async () => {
    const t = await createUser({ role: 'teacher' })
    const url = `/api/admin/users/${String(t.id)}`
    const missing = await put(url, base(t, { role: 'student' }))
    expect(missing.body.error?.fields?.grade).toBe(
      'The grade field is required when role is student.',
    )
    expect(
      (await put(url, base(t, { role: 'student', grade: 99 }))).body.error?.fields?.grade,
    ).toBe('The selected grade is invalid.')
    const ok = await put(url, base(t, { role: 'student', grade: 3 }))
    expect(data<AdminUserDetail>(ok)).toMatchObject({ role: 'student', grade: 3 })
    // Once it has a grade, a student save without one is fine.
    expect((await put(url, base(t, { role: 'student' }))).status).toBe(200)
  })

  it('a role change takes effect at once and keeps the hidden section of the old role', async () => {
    const s = await createUser({ role: 'student', grade: 4 })
    const r = await put(`/api/admin/users/${String(s.id)}`, base(s, { role: 'teacher' }))
    expect(data<AdminUserDetail>(r)).toMatchObject({ role: 'teacher', grade: 4 })
    expect(users.roleCounts().teacher).toBeGreaterThan(0)
  })

  it('requires a school for a user made school admin without one, and the school must exist', async () => {
    const t = await createUser({ role: 'teacher' })
    const url = `/api/admin/users/${String(t.id)}`
    expect((await put(url, base(t, { role: 'school_admin' }))).body.error?.fields?.schoolId).toBe(
      'The school id field is required when role is school_admin.',
    )
    expect(
      (await put(url, base(t, { role: 'school_admin', schoolId: 7_777_777 }))).body.error?.fields
        ?.schoolId,
    ).toBe('The selected school id is invalid.')
    expect(
      data<AdminUserDetail>(await put(url, base(t, { role: 'school_admin', schoolId: 987 })))
        .schoolId,
    ).toBe(987)
  })

  it('an unknown role is refused; `unmapped` is not selectable', async () => {
    const d = await createUser()
    const r = await put(`/api/admin/users/${String(d.id)}`, base(d, { role: 'unmapped' }))
    expect(r.body.error?.fields?.role).toBe('The selected role is invalid.')
  })

  it('individual package: the expiry is computed only when the package changes (BR-12)', async () => {
    const s = await createUser({ role: 'student', grade: 6 })
    const url = `/api/admin/users/${String(s.id)}`
    // none → regular_monthly at the mock now: + 1 calendar month, same time.
    expect((await put(url, base(s, { subscriptionPackage: 'regular_monthly' }))).status).toBe(200)
    expect(users.get(s.id)).toMatchObject({
      subscriptionPackage: 'regular_monthly',
      subscriptionExpiresAt: '2026-10-25T15:40:00+08:00',
    })
    // Unchanged package, later clock: the stored expiry stays.
    await atTime('2026-09-28T10:00:00+08:00', async () => {
      await put(url, base(s, { subscriptionPackage: 'regular_monthly', name: 'Nama Lain' }))
      expect(users.get(s.id)?.subscriptionExpiresAt).toBe('2026-10-25T15:40:00+08:00')
      // regular_monthly → personal: the next 10 January 23:59:59.
      await put(url, base(s, { subscriptionPackage: 'personal' }))
      expect(users.get(s.id)).toMatchObject({
        subscriptionPackage: 'personal',
        subscriptionExpiresAt: '2027-01-10T23:59:59+08:00',
      })
      // → none: no expiry.
      await put(url, base(s, { subscriptionPackage: 'none' }))
      expect(users.get(s.id)).toMatchObject({
        subscriptionPackage: 'none',
        subscriptionExpiresAt: null,
      })
    })
    const bad = await put(url, base(s, { subscriptionPackage: 'gold' }))
    expect(bad.body.error?.fields?.subscriptionPackage).toBe(
      'The selected subscription package is invalid.',
    )
    // The detail exposes the saved package and PKSK state (FR-M02-40).
    expect(await detail(s.id)).toMatchObject({
      subscriptionPackage: 'none',
      hasPkskSubscription: false,
    })
  })

  it('parent section: the linked set is replaced, kept when not sent, and only for a parent (BR-10, BR-11)', async () => {
    const p = await createUser({ role: 'parent', linkedStudentIds: [2] })
    const url = `/api/admin/users/${String(p.id)}`
    const firstLink = parentLinks.all().find((l) => l.parentId === p.id)!
    const swap = data<AdminUserDetail>(await put(url, base(p, { linkedStudentIds: [2, 3] })))
    expect(swap.linkedStudents.map((s) => s.id)).toEqual([2, 3])
    // The link that stays keeps its id.
    expect(parentLinks.all().find((l) => l.parentId === p.id && l.studentId === 2)?.id).toBe(
      firstLink.id,
    )
    const kept = data<AdminUserDetail>(await put(url, base(p, { name: 'Ibu Lain' })))
    expect(kept.linkedStudents.map((s) => s.id)).toEqual([2, 3])
    const cleared = data<AdminUserDetail>(await put(url, base(p, { linkedStudentIds: [] })))
    expect(cleared.linkedStudents).toEqual([])
    expect(parentLinks.studentIdsOf(p.id)).toEqual([])
    const nonStudent = await put(url, base(p, { linkedStudentIds: [5] }))
    expect(nonStudent.body.error?.fields?.linkedStudentIds).toBe(
      'The selected linked student ids is invalid.',
    )
    // Another role: the ids are not applied.
    const t = await createUser({ role: 'teacher' })
    await put(`/api/admin/users/${String(t.id)}`, base(t, { linkedStudentIds: [2] }))
    expect(parentLinks.studentIdsOf(t.id)).toEqual([])
  })

  it('a refused update changes nothing', async () => {
    const d = await createUser()
    await put(
      `/api/admin/users/${String(d.id)}`,
      base(d, { name: 'Tidak Tersimpan', phone: '1'.repeat(15) }),
    )
    expect((await detail(d.id)).name).toBe(d.name)
  })
})

// -------------------------------------------------------------------------------------------------
describe('POST /api/admin/users/:id/toggle-active (#8)', () => {
  it('flips the status and answers the new state', async () => {
    const d = await createUser()
    const off = await post(`/api/admin/users/${String(d.id)}/toggle-active`)
    expect(off.status).toBe(200)
    expect(off.body.data).toEqual({ isActive: false })
    expect(off.body.status).toBe('Status pengguna berjaya dikemaskini.')
    expect(users.get(d.id)?.isActive).toBe(false)
    expect((await post(`/api/admin/users/${String(d.id)}/toggle-active`)).body.data).toEqual({
      isActive: true,
    })
  })

  it('moves the inactive filter total by one (computed, not stored)', async () => {
    const d = await createUser()
    const before = (await get('/api/admin/users?isActive=0')).body.meta?.totalItems as number
    await post(`/api/admin/users/${String(d.id)}/toggle-active`)
    expect((await get('/api/admin/users?isActive=0')).body.meta?.totalItems).toBe(before + 1)
  })

  it('answers 404 for an unknown user', async () => {
    expect((await post('/api/admin/users/8000000/toggle-active')).status).toBe(404)
  })

  it('the own row keeps its toggle (BR-04): the admin can deactivate and reactivate itself', async () => {
    const own = await post('/api/admin/users/1/toggle-active')
    expect(own.body.data).toEqual({ isActive: false })
    const back = await post('/api/admin/users/1/toggle-active')
    expect(back.body.data).toEqual({ isActive: true })
    expect(users.get(1)?.isActive).toBe(true)
  })
})

// -------------------------------------------------------------------------------------------------
describe('DELETE /api/admin/users/:id (#6) and bulk delete (#7)', () => {
  it('deletes a user for good, with its links, packages and sessions (BR-06)', async () => {
    const p = await createUser({ role: 'parent', linkedStudentIds: [2] })
    expect(parentLinks.studentIdsOf(p.id)).toEqual([2])
    const r = await del(`/api/admin/users/${String(p.id)}`)
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ deleted: 1 })
    expect(r.body.status).toBe('Pengguna berjaya dipadam.')
    expect((await get(`/api/admin/users/${String(p.id)}`)).status).toBe(404)
    expect(parentLinks.studentIdsOf(p.id)).toEqual([])
    expect(users.get(p.id)).toBeUndefined()
    expect((await del(`/api/admin/users/${String(p.id)}`)).status).toBe(404)
  })

  it('removes the link when the linked student is deleted, and the school admin packages of a deleted admin', async () => {
    const s = await createUser({ role: 'student', grade: 2 })
    const p = await createUser({ role: 'parent', linkedStudentIds: [s.id] })
    await del(`/api/admin/users/${String(s.id)}`)
    expect((await detail(p.id)).linkedStudents).toEqual([])
    const a = await createUser({ role: 'school_admin', schoolId: 987 })
    await post(`/api/admin/users/${String(a.id)}/packages`, {
      formLevel: 't4',
      packageId: 1,
      studentQuota: 10,
    })
    expect(schoolAdminPackages.forUser(a.id)).toHaveLength(1)
    await del(`/api/admin/users/${String(a.id)}`)
    expect(schoolAdminPackages.forUser(a.id)).toHaveLength(0)
  })

  it("ends the deleted user's sessions", async () => {
    const body = newUser()
    const d = await createUser(body)
    const token = await loginToken(String(body.email), String(body.password))
    expect((await get('/api/me', token)).status).toBe(200)
    await del(`/api/admin/users/${String(d.id)}`)
    expect((await get('/api/me', token)).status).toBe(401)
  })

  it("refuses to delete the admin's own account (INFERRED guard, BR-04)", async () => {
    const r = await del('/api/admin/users/1')
    expect(r.status).toBe(422)
    expect(r.body.error?.fields?.id).toBe('Anda tidak boleh memadam akaun sendiri.')
    expect(users.get(1)).toBeDefined()
  })

  it('deletes a generated user of the dataset and lowers every total', async () => {
    const before = (await get('/api/admin/users')).body.meta
    const target = data<AdminUserListItem[]>(
      await get('/api/admin/users?role=sponsor&search=Penaja Demo 0'),
    )[0]!
    expect((await del(`/api/admin/users/${String(target.id)}`)).status).toBe(200)
    const after = (await get('/api/admin/users')).body.meta
    expect(after?.totalItems).toBe((before?.totalItems as number) - 1)
    expect(after?.roleCounts?.sponsor).toBe((before?.roleCounts?.sponsor as number) - 1)
  })

  it('bulk delete: removes the selection, skips unknown ids and counts what was deleted', async () => {
    const a = await createUser()
    const b = await createUser()
    const c = await createUser({ role: 'parent', linkedStudentIds: [2] })
    const r = await post('/api/admin/users/bulk-delete', {
      ids: [a.id, b.id, c.id, c.id, 8_000_000],
    })
    expect(r.status).toBe(200)
    expect(r.body.data).toEqual({ deleted: 3 })
    expect(r.body.status).toBe('3 pengguna berjaya dipadam.')
    for (const id of [a.id, b.id, c.id]) expect(users.get(id)).toBeUndefined()
    expect(parentLinks.studentIdsOf(c.id)).toEqual([])
  })

  it('bulk delete: 422 without ids, with a non-list, with a non-integer, or with the own id', async () => {
    const empty = await post('/api/admin/users/bulk-delete', { ids: [] })
    expect(empty.status).toBe(422)
    expect(empty.body.error?.fields?.ids).toBe('The ids field is required.')
    expect((await post('/api/admin/users/bulk-delete', {})).status).toBe(422)
    expect(
      (await post('/api/admin/users/bulk-delete', { ids: 'semua' })).body.error?.fields?.ids,
    ).toBe('The ids field must be an array of integers.')
    expect((await post('/api/admin/users/bulk-delete', { ids: ['x', 3] })).status).toBe(422)
    const d = await createUser()
    const own = await post('/api/admin/users/bulk-delete', { ids: [d.id, 1] })
    expect(own.status).toBe(422)
    expect(users.get(d.id)).toBeDefined()
    expect(users.get(1)).toBeDefined()
  })
})

// -------------------------------------------------------------------------------------------------
describe('POST /api/admin/users/:id/impersonate (#9, "Login As")', () => {
  it.each([
    [2, 'student', '/dashboard'],
    [5, 'teacher', '/dashboard'],
    [6, 'parent', '/dashboard'],
    [8, 'school_admin', '/dashboard'],
    [9, 'ppd_officer', '/ppd/dashboard'],
    [10, 'jpn_officer', '/jpn/dashboard'],
    [5801, 'admin', '/admin'],
  ])('user %i: a session of the target that lands on its BR-07 path', async (id, role, landing) => {
    const r = await post(`/api/admin/users/${String(id)}/impersonate`)
    expect(r.status).toBe(200)
    const s = data<ImpersonationSession>(r)
    expect(s.token).toMatch(/^pp_/)
    expect(s.user).toMatchObject({ id, role, landingPath: landing })
    expect(Date.parse(s.expiresAt)).toBe(Date.parse(NOW_MYT) + 120 * 60_000)
    // The token is a live session of the target for every guarded route.
    const me = await get('/api/me', s.token)
    expect(me.status).toBe(200)
    expect((me.body.data as { id: number }).id).toBe(id)
  })

  it('never returns the password, IC or isActive of the target', async () => {
    const text = JSON.stringify((await post('/api/admin/users/2/impersonate')).body)
    for (const leak of ['password', 'icNumber', 'icHash', 'isActive', DEMO_PASSWORD]) {
      expect(text).not.toContain(leak)
    }
  })

  it("the target session has the target's rights: a student token cannot use /api/admin", async () => {
    const s = data<ImpersonationSession>(await post('/api/admin/users/2/impersonate'))
    expect((await get('/api/admin/users', s.token)).status).toBe(403)
    // …while an impersonated admin can.
    const other = data<ImpersonationSession>(await post('/api/admin/users/5801/impersonate'))
    expect((await get('/api/admin/users', other.token)).status).toBe(200)
  })

  it('is not a password login: lastLoginAt and updatedAt of the target are unchanged (INFERRED)', async () => {
    const before = users.get(5)!
    await atTime('2026-09-26T08:00:00+08:00', async () => {
      const s = data<ImpersonationSession>(await post('/api/admin/users/5/impersonate'))
      expect(s.user.lastLoginAt).toBe(before.lastLoginAt)
      expect(users.get(5)?.lastLoginAt).toBe(before.lastLoginAt)
      expect(users.get(5)?.updatedAt).toBe(before.updatedAt)
    })
  })

  it("leaves the admin's own session valid (the client replaces it, INFERRED)", async () => {
    await post('/api/admin/users/2/impersonate')
    expect((await get('/api/me')).status).toBe(200)
  })

  it('allows an inactive target (an admin override, INFERRED)', async () => {
    const r = await post('/api/admin/users/11/impersonate')
    expect(r.status).toBe(200)
    expect(data<ImpersonationSession>(r).user.id).toBe(11)
  })

  it('404 for an unknown user; 422 for the own account and for a user without a valid role', async () => {
    expect((await post('/api/admin/users/8000000/impersonate')).status).toBe(404)
    const own = await post('/api/admin/users/1/impersonate')
    expect(own.status).toBe(422)
    expect(own.body.error?.fields?.id).toBe('Anda tidak boleh Login As akaun sendiri.')
    const unmapped = users.adminList({ role: 'unmapped' }).rows[0]!
    const r = await post(`/api/admin/users/${String(unmapped.id)}/impersonate`)
    expect(r.status).toBe(422)
  })

  it('a user created by the admin can be impersonated at once', async () => {
    const d = await createUser({ role: 'sponsor' })
    const s = data<ImpersonationSession>(await post(`/api/admin/users/${String(d.id)}/impersonate`))
    expect(s.user).toMatchObject({ id: d.id, role: 'sponsor' })
  })
})

// -------------------------------------------------------------------------------------------------
describe('S16 packages (#10, #11)', () => {
  const url = (id: number) => `/api/admin/users/${String(id)}/packages`

  it('school admin 5601: T4 assigned with quota 150, T5 open, the school and the T5 count', async () => {
    const r = await get(url(5601))
    expect(r.status).toBe(200)
    const d = data<AdminUserPackages>(r)
    expect(d.user).toEqual({ id: 5601, name: 'Pentadbir Sekolah Demo 5601' })
    expect(d.school).toMatchObject({ id: 8102, code: 'BEA4628', state: 'Selangor' })
    expect(d.packages).toHaveLength(2)
    expect(d.packages[0]).toMatchObject({
      formLevel: 't4',
      packageId: 1,
      code: 'T4',
      name: 'Pakej SPM Tingkatan 4',
      priceLabel: 'RM 30/pelajar · 2 tahun',
      years: 2,
    })
    expect(d.packages[0]!.assigned).toMatchObject({ studentQuota: 150 })
    expect(d.packages[1]).toMatchObject({
      formLevel: 't5',
      packageId: 2,
      code: 'T5',
      name: 'Pakej SPM Tingkatan 5',
      priceLabel: 'RM 30/pelajar · 1 tahun',
      years: 1,
      assigned: null,
    })
    // "{n} pelajar T5 sedia ada": the 8102 students at class level T5 (grade 11), computed.
    expect(d.existingT5Count).toBe(users.countWhere({ role: 'student', schoolId: 8102, grade: 11 }))
    expect(d.existingT5Count).toBe(776)
    expect(schoolAdminPackages.forUser(5601)[0]?.id).toBe(1)
  })

  it('school admin 8 has no package ("Belum Ditetapkan"): both cards are open', async () => {
    const d = data<AdminUserPackages>(await get(url(8)))
    expect(d.packages.map((p) => p.assigned)).toEqual([null, null])
    expect(d.school?.id).toBe(900_001)
  })

  it('404 for an unknown user; 422 for a user that is not a school admin', async () => {
    expect((await get(url(8_000_000))).status).toBe(404)
    expect(
      (await post(url(8_000_000), { formLevel: 't4', packageId: 1, studentQuota: 5 })).status,
    ).toBe(404)
    const r = await get(url(2))
    expect(r.status).toBe(422)
    expect(r.body.error?.fields?.id).toBe('Pengguna ini bukan admin sekolah.')
    expect((await post(url(2), { formLevel: 't4', packageId: 1, studentQuota: 5 })).status).toBe(
      422,
    )
  })

  it('assigns a package; assigning again replaces the quota (BR-13)', async () => {
    const a = await createUser({ role: 'school_admin', schoolId: 8102 })
    const first = await post(url(a.id), { formLevel: 't5', packageId: 2, studentQuota: 120 })
    expect(first.status).toBe(200)
    expect(first.body.status).toBe('Pakej berjaya ditetapkan.')
    const row = data<SchoolAdminPackage>(first)
    expect(row).toMatchObject({
      userId: a.id,
      formLevel: 't5',
      packageId: 2,
      studentQuota: 120,
      assignedAt: NOW_MYT,
    })
    expect(row.id).toBeGreaterThanOrEqual(1000)
    await atTime('2026-09-27T11:00:00+08:00', async () => {
      const again = data<SchoolAdminPackage>(
        await post(url(a.id), { formLevel: 't5', packageId: 2, studentQuota: '2000' }),
      )
      expect(again.id).toBe(row.id)
      expect(again).toMatchObject({ studentQuota: 2000, assignedAt: '2026-09-27T11:00:00+08:00' })
    })
    await post(url(a.id), { formLevel: 't4', packageId: 1, studentQuota: 1 })
    expect(schoolAdminPackages.forUser(a.id)).toHaveLength(2)
    const d = data<AdminUserPackages>(await get(url(a.id)))
    expect(d.packages.map((p) => p.assigned?.studentQuota)).toEqual([1, 2000])
  })

  it('validates the quota range 1–2000 (DV-M02-07), the level and the package pairing', async () => {
    const a = await createUser({ role: 'school_admin', schoolId: 987 })
    const fields = async (body: unknown) => (await post(url(a.id), body)).body.error?.fields ?? {}
    expect((await fields({ formLevel: 't4', packageId: 1, studentQuota: 2001 })).studentQuota).toBe(
      'The student quota field must not be greater than 2000.',
    )
    expect((await fields({ formLevel: 't4', packageId: 1, studentQuota: 0 })).studentQuota).toBe(
      'The student quota field must be at least 1.',
    )
    expect((await fields({ formLevel: 't4', packageId: 1, studentQuota: 1.5 })).studentQuota).toBe(
      'The student quota field must be an integer.',
    )
    expect((await fields({ formLevel: 't4', packageId: 1 })).studentQuota).toBe(
      'The student quota field is required.',
    )
    expect((await fields({ formLevel: 't6', packageId: 1, studentQuota: 5 })).formLevel).toBe(
      'The selected form level is invalid.',
    )
    expect((await fields({ formLevel: 't4', packageId: 2, studentQuota: 5 })).packageId).toBe(
      'The selected package id is invalid.',
    )
    expect(await fields({})).toMatchObject({
      formLevel: 'The form level field is required.',
      packageId: 'The package id field is required.',
    })
    expect(schoolAdminPackages.forUser(a.id)).toHaveLength(0)
  })
})

// -------------------------------------------------------------------------------------------------
describe('GET /api/students/search (#39)', () => {
  it('answers 401 to a guest and works for any session', async () => {
    const guest = await call('GET', '/api/students/search?q=pelajar')
    expect(guest.status).toBe(401)
    for (const token of [student, admin]) {
      expect((await get('/api/students/search?q=pelajar', token)).status).toBe(200)
    }
  })

  it('finds a student by name or e-mail with {id, name, classLevel, schoolName}', async () => {
    const r = await get('/api/students/search?q=pelajar@demo')
    expect(data<StudentSearchItem[]>(r)).toEqual([
      { id: 2, name: 'Pelajar Demo', classLevel: 'T4', schoolName: 'SMK DEMO' },
    ])
    const two = data<StudentSearchItem[]>(await get('/api/students/search?q=Maju'))
    expect(two.find((s) => s.id === 4)).toEqual({
      id: 4,
      name: 'Pelajar Maju Demo',
      classLevel: 'T5',
      schoolName: 'SMK DEMO',
    })
    const none = data<StudentSearchItem[]>(await get('/api/students/search?q=pelajar2@demo'))
    expect(none).toEqual([{ id: 3, name: 'Pelajar Dua Demo', classLevel: 'T4', schoolName: null }])
  })

  it('is case-insensitive, returns at most 15 and only students', async () => {
    const many = data<StudentSearchItem[]>(await get('/api/students/search?q=DEMO'))
    expect(many).toHaveLength(15)
    for (const s of many) expect(users.get(s.id)?.role).toBe('student')
    // "Guru Demo" (teacher 5) is not a student.
    const teachers = data<StudentSearchItem[]>(await get('/api/students/search?q=guru@demo'))
    expect(teachers).toEqual([])
  })

  it('answers [] for a query under 2 characters or none (INFERRED)', async () => {
    for (const q of ['', 'p', ' a ']) {
      expect(data<unknown[]>(await get(`/api/students/search?q=${encodeURIComponent(q)}`))).toEqual(
        [],
      )
    }
    expect(data<unknown[]>(await get('/api/students/search'))).toEqual([])
  })

  it('finds a runtime student by name and shows its school name and class level', async () => {
    const d = await createUser({
      role: 'student',
      grade: 11,
      schoolId: 987,
      name: 'Pelajar Carian Unik',
    })
    const found = data<StudentSearchItem[]>(await get('/api/students/search?q=Carian Unik'))
    expect(found).toHaveLength(1)
    expect(found[0]).toMatchObject({ id: d.id, classLevel: 'T5' })
    expect(found[0]!.schoolName).toBe(schools.get(987)!.name)
  })
})

// -------------------------------------------------------------------------------------------------
describe('fixture config (hook `config`, DATA-M02-13)', () => {
  it('seeds the three dummy defaults on ctx.config and returns them to the admin', async () => {
    expect(runtime.config.get('schoolAdminDefaultPassword')).toBe(
      M02_CONFIG_DEFAULTS.schoolAdminDefaultPassword,
    )
    const r = await get('/api/admin/config/defaults')
    expect(r.status).toBe(200)
    expect(data<AdminDefaults>(r)).toEqual({
      schoolAdminDefaultPassword: M02_CONFIG_DEFAULTS.schoolAdminDefaultPassword,
      bulkImportDefaultPassword: M02_CONFIG_DEFAULTS.bulkImportDefaultPassword,
      compStudentDefaultPassword: M02_CONFIG_DEFAULTS.compStudentDefaultPassword,
    })
    // The complimentary default is the 8-digit one (BR-18).
    expect(data<AdminDefaults>(r).compStudentDefaultPassword).toMatch(/^\d{8}$/)
  })

  it('mock.config(key, value) changes what the endpoint returns', async () => {
    runtime.config.set('schoolAdminDefaultPassword', 'UjianSahaja1')
    try {
      expect(
        data<AdminDefaults>(await get('/api/admin/config/defaults')).schoolAdminDefaultPassword,
      ).toBe('UjianSahaja1')
    } finally {
      runtime.config.set(
        'schoolAdminDefaultPassword',
        M02_CONFIG_DEFAULTS.schoolAdminDefaultPassword,
      )
    }
  })
})

// -------------------------------------------------------------------------------------------------
describe('the typed api/ client against the handlers', () => {
  beforeAll(() => {
    api.configure({ transport: runtime.transport, getToken: () => admin, onUnauthorized: null })
  })

  it('lists, filters and reads with the S1 query mapping (isActive → 1/0, blank = none)', async () => {
    const page = await fetchAdminUsers({ role: 'jpn_officer', isActive: true, page: 1 })
    expect(page.meta.totalItems).toBe(users.countWhere({ role: 'jpn_officer', isActive: true }))
    expect(page.meta.roleCounts.student).toBeGreaterThan(4000)
    expect(page.data.every((u) => u.role === 'jpn_officer')).toBe(true)
    const inactive = await fetchAdminUsers({ isActive: false, role: '', search: '' })
    expect(inactive.meta.totalItems).toBe(users.countWhere({ isActive: false }))
    expect((await fetchUserFilters()).length).toBeGreaterThanOrEqual(60)
    expect((await fetchAdminUser(6)).linkedStudents).toHaveLength(2)
    await expect(fetchAdminUser(8_000_000)).rejects.toMatchObject({ status: 404 })
  })

  it('creates, updates, toggles, packages and deletes with the flash text in `status`', async () => {
    const created = await createAdminUser({
      role: 'school_admin',
      name: 'Pentadbir Klien',
      email: 'klien.ujian@demo.test',
      password: 'rahsia123',
      passwordConfirmation: 'rahsia123',
      schoolId: 8102,
    })
    expect(created.status).toBe('Pengguna berjaya didaftarkan.')
    const id = created.data.id
    const updated = await updateAdminUser(id, {
      name: 'Pentadbir Klien 2',
      email: 'klien.ujian@demo.test',
      role: 'school_admin',
      isActive: true,
    })
    expect(updated.data.name).toBe('Pentadbir Klien 2')
    expect((await toggleUserActive(id)).data).toEqual({ isActive: false })
    const pkg = await assignUserPackage(id, { formLevel: 't4', packageId: 1, studentQuota: 99 })
    expect(pkg.data.studentQuota).toBe(99)
    expect((await fetchUserPackages(id)).packages[0]!.assigned?.studentQuota).toBe(99)
    expect((await deleteAdminUser(id)).data).toEqual({ deleted: 1 })
    const other = await createAdminUser({
      role: 'sponsor',
      name: 'Penaja Klien',
      email: 'klien.ujian2@demo.test',
      password: 'rahsia123',
      passwordConfirmation: 'rahsia123',
    })
    expect((await bulkDeleteAdminUsers([other.data.id])).data).toEqual({ deleted: 1 })
  })

  it('reports a validation error with `fields`, impersonates, searches and reads the defaults', async () => {
    await expect(createAdminUser({ role: 'student' } as never)).rejects.toMatchObject({
      status: 422,
      fields: { name: 'The name field is required.' },
    })
    const session = await impersonateUser(2)
    expect(session.user).toMatchObject({ id: 2, landingPath: '/dashboard' })
    expect((await searchStudents('pelajar@demo'))[0]).toMatchObject({ id: 2, classLevel: 'T4' })
    expect((await fetchAdminDefaults()).compStudentDefaultPassword).toMatch(/^\d{8}$/)
  })
})
