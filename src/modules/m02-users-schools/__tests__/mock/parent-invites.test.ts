/**
 * L45 "Jemput Ibu Bapa" mock (SRS L45 §4 BR-L45-01…12, §5, §7 #1–#4, §9; task L45-T1). Boots the whole
 * registry with latency 0 and a fixed clock; the tests share one boot and run in order (the token and link
 * state carries on from one test to the next, so the order below is part of the test).
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { DEMO_PASSWORD } from '@/mock/core-data/accounts'
import { sessionTokenSource } from '@/mock/auth/sessions'
import { bootMock, type MockRuntime } from '@/mock/index'
import { users } from '@/modules/m01-authentication/mock'

import type {
  AcceptResult,
  GeneratedParentInvite,
  InvitePreview,
  ParentInviteView,
} from '../../api/parent-invite'
import { parentInvites, parentLinks } from '../../mock'
import { initialsOf } from '../../mock/handlers/parent-invites'
import { deterministicInviteToken } from '../../mock/handlers/parent-invites-store'
import { setParentInviteToken } from '../../mock/hooks'

interface Reply<T = unknown> {
  status: number
  data: T
  error?: { code: string; message: string }
}

let runtime: MockRuntime
const clock = createClock({ at: CLOCK_ANCHOR_ISO })

beforeAll(async () => {
  runtime = await bootMock({ mode: 'test', clock, latencyMs: 0, onWarn: null })
}, 120_000)

async function call<T = unknown>(
  method: 'GET' | 'POST',
  url: string,
  token?: string,
): Promise<Reply<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (token) headers.authorization = `Bearer ${token}`
  const res = await runtime.transport.request({ method, url, headers })
  const body = (res.body ?? {}) as { data?: T; error?: { code: string; message: string } }
  return { status: res.status, data: body.data as T, ...(body.error ? { error: body.error } : {}) }
}

async function login(email: string): Promise<string> {
  const res = await runtime.transport.request({
    method: 'POST',
    url: '/api/auth/login',
    headers: { accept: 'application/json', 'content-type': 'application/json' },
    body: { email, password: DEMO_PASSWORD },
  })
  expect(res.status).toBe(200)
  return (res.body as { data: { token: string } }).data.token
}

const HEX64 = /^[0-9a-f]{64}$/
const view = (token: string) => call<ParentInviteView>('GET', '/api/me/parent-invite', token)
const generate = (token: string) =>
  call<GeneratedParentInvite>('POST', '/api/me/parent-invite/generate', token)
const preview = (invite: string, token?: string) =>
  call<InvitePreview>('GET', `/api/parent-invites/${encodeURIComponent(invite)}`, token)
const accept = (invite: string, token?: string) =>
  call<AcceptResult>('POST', `/api/parent-invites/${encodeURIComponent(invite)}/accept`, token)

let s2: string // Pelajar Demo (id 2, SMK DEMO, parent 6 linked)
let s3: string // Pelajar Dua Demo (id 3, no school, no parent)
let s4: string
let parent: string // Ibu Bapa Demo (6)
let admin: string
let teacher: string
let sponsor: string
let schoolAdmin: string

beforeAll(async () => {
  ;[s2, s3, s4, parent, admin, teacher, sponsor, schoolAdmin] = await Promise.all([
    login('pelajar@demo.test'),
    login('pelajar2@demo.test'),
    login('pelajarmaju@demo.test'),
    login('ibubapa@demo.test'),
    login('admin@demo.test'),
    login('guru@demo.test'),
    login('penaja@demo.test'),
    login('adminsekolah@demo.test'),
  ])
}, 120_000)

describe('permissions (§9) on #1 and #2', () => {
  it.each([
    ['GET', '/api/me/parent-invite'],
    ['POST', '/api/me/parent-invite/generate'],
  ] as const)('%s %s: guest 401; every non-student 403', async (method, url) => {
    expect((await call(method, url)).status).toBe(401)
    for (const t of [admin, teacher, parent, sponsor, schoolAdmin]) {
      const r = await call(method, url, t)
      expect(r.status).toBe(403)
      expect(r.error?.code).toBe('FORBIDDEN')
    }
  })

  it('a refused call creates no token', () => {
    expect(parentInvites.get(3)).toBeUndefined()
    expect(parentInvites.get(6)).toBeUndefined()
  })
})

describe('GET /api/me/parent-invite (#1): token lifecycle (BR-L45-01, FR-L45-13)', () => {
  it('has no seeded invite (§6.4)', () => {
    expect(parentInvites.get(2)).toBeUndefined()
    expect(parentInvites.get(3)).toBeUndefined()
  })

  it('creates a 64-hex token on the first call and keeps it afterwards', async () => {
    const first = await view(s3)
    expect(first.status).toBe(200)
    expect(first.data.token).toMatch(HEX64)
    expect(first.data.createdAt).toMatch(/\+08:00$/)
    const second = await view(s3)
    expect(second.data.token).toBe(first.data.token)
    expect(second.data.createdAt).toBe(first.data.createdAt)
    expect(parentInvites.get(3)?.token).toBe(first.data.token)
  })

  it('gives each student a different token and only ever shows its own', async () => {
    const a = (await view(s2)).data.token
    const b = (await view(s3)).data.token
    expect(a).toMatch(HEX64)
    expect(a).not.toBe(b)
  })

  it('an empty student list: student 3 has no parent; student 2 has parent 6 (§6.4, BR-L45-08)', async () => {
    expect((await view(s3)).data.parents).toEqual([])
    const two = (await view(s2)).data.parents
    expect(two).toHaveLength(1)
    expect(two[0]).toMatchObject({ id: 6, name: 'Ibu Bapa Demo', email: 'ibubapa@demo.test' })
    expect(two[0]?.linkedAt).toMatch(/\+08:00$/)
    expect(Object.keys(two[0] ?? {}).sort()).toEqual(['email', 'id', 'linkedAt', 'name'])
  })
})

describe('POST /api/me/parent-invite/generate (#2): BR-L45-03', () => {
  it('replaces the token, answers the status text and invalidates the old token at once', async () => {
    const before = (await view(s4)).data
    clock.setNow('2026-09-25T16:10:00+08:00')
    try {
      const r = await generate(s4)
      expect(r.status).toBe(200)
      expect(r.data.status).toBe('Link jemputan baru telah dijana!')
      expect(r.data.token).toMatch(HEX64)
      expect(r.data.token).not.toBe(before.token)
      expect(r.data.createdAt).toBe('2026-09-25T16:10:00+08:00')
      expect((await view(s4)).data.token).toBe(r.data.token)
      expect((await preview(before.token)).status).toBe(404)
      expect((await accept(before.token, parent)).status).toBe(404)
      expect((await preview(r.data.token)).status).toBe(200)
    } finally {
      clock.setNow(CLOCK_ANCHOR_ISO)
    }
  })

  it('leaves the existing links untouched', async () => {
    const before = parentLinks.all().map((l) => l.id)
    await generate(s2)
    expect(parentLinks.all().map((l) => l.id)).toEqual(before)
    expect((await view(s2)).data.parents).toHaveLength(1)
  })

  it('creates the token when the student never opened the page', async () => {
    const t = await login('pelajarmaju@demo.test')
    expect((await generate(t)).data.token).toMatch(HEX64)
  })
})

describe('GET /api/parent-invites/:token (#3)', () => {
  let t3: string
  beforeAll(async () => {
    t3 = (await view(s3)).data.token
  })

  it('is public: a guest sees the student name, initials and school (none for student 3)', async () => {
    const r = await preview(t3)
    expect(r.status).toBe(200)
    expect(r.data).toEqual({
      valid: true,
      student: { name: 'Pelajar Dua Demo', initials: 'PD', schoolName: null },
      viewer: 'guest',
    })
  })

  it('shows the school of a student that has one and no other personal data', async () => {
    const r = await preview((await view(s2)).data.token)
    expect(r.data.student).toEqual({ name: 'Pelajar Demo', initials: 'PD', schoolName: 'SMK DEMO' })
    expect(Object.keys(r.data).sort()).toEqual(['student', 'valid', 'viewer'])
  })

  it('computes `viewer` from the bearer token: parent, other (student, admin), guest for a stale token', async () => {
    expect((await preview(t3, parent)).data.viewer).toBe('parent')
    expect((await preview(t3, s2)).data.viewer).toBe('other')
    expect((await preview(t3, admin)).data.viewer).toBe('other')
    expect((await preview(t3, 'pp_notarealsession')).data.viewer).toBe('guest')
  })

  it('has no side effect: no link is created for a parent who only previews', async () => {
    const before = parentLinks.all().length
    await preview(t3, parent)
    expect(parentLinks.all()).toHaveLength(before)
  })

  it.each(['0000', 'zzzz', '0'.repeat(64), 'not-a-token', 'ÅBC', '%20'])(
    'any unknown string is 404 NOT_FOUND: %s (AUD-L45-01, no hex-only rule)',
    async (token) => {
      const r = await preview(token)
      expect(r.status).toBe(404)
      expect(r.error?.code).toBe('NOT_FOUND')
    },
  )

  it('matches case-insensitively (BR-L45-02)', async () => {
    expect((await preview(t3.toUpperCase())).status).toBe(200)
  })

  it('an unknown token is 404 for every viewer', async () => {
    for (const t of [undefined, parent, s2, admin]) {
      expect((await preview('0000', t)).status).toBe(404)
    }
  })
})

describe('POST /api/parent-invites/:token/accept (#4): BR-L45-05, BR-L45-06', () => {
  let t3: string
  beforeAll(async () => {
    t3 = (await view(s3)).data.token
  })

  it('401 for a guest and 403 for every non-parent; no link is created (BR-L45-06)', async () => {
    const before = parentLinks.all().length
    expect((await accept(t3)).status).toBe(401)
    for (const t of [s2, s3, admin, teacher, sponsor, schoolAdmin]) {
      const r = await accept(t3, t)
      expect(r.status).toBe(403)
      expect(r.error?.code).toBe('FORBIDDEN')
    }
    expect(parentLinks.all()).toHaveLength(before)
  })

  it('401 / 403 are answered before the token is looked up', async () => {
    expect((await accept('0000')).status).toBe(401)
    expect((await accept('0000', s2)).status).toBe(403)
  })

  it('a parent with an unknown token gets 404 NOT_FOUND and no link', async () => {
    const before = parentLinks.all().length
    for (const token of ['0000', 'zzzz', '0'.repeat(64)]) {
      const r = await accept(token, parent)
      expect(r.status).toBe(404)
      expect(r.error?.code).toBe('NOT_FOUND')
    }
    expect(parentLinks.all()).toHaveLength(before)
  })

  it('creates exactly one link (id from 1000, mock-clock date) and returns the AcceptResult', async () => {
    clock.setNow('2026-09-25T16:40:00+08:00')
    try {
      const r = await accept(t3, parent)
      expect(r.status).toBe(200)
      expect(r.data).toEqual({
        linked: true,
        created: true,
        student: { id: 3, name: 'Pelajar Dua Demo', schoolName: null },
        parent: { name: 'Ibu Bapa Demo' },
      })
      const rows = parentLinks.listParentsOfStudent(3)
      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({
        parentId: 6,
        studentId: 3,
        createdAt: '2026-09-25T16:40:00+08:00',
      })
      expect(rows[0]!.id).toBeGreaterThanOrEqual(1000)
    } finally {
      clock.setNow(CLOCK_ANCHOR_ISO)
    }
  })

  it('is idempotent (FR-L45-28): a repeat ends in the linked state with created=false and the same row', async () => {
    const first = parentLinks.listParentsOfStudent(3)[0]!
    const again = await accept(t3, parent)
    expect(again.status).toBe(200)
    expect(again.data.linked).toBe(true)
    expect(again.data.created).toBe(false)
    const rows = parentLinks.listParentsOfStudent(3)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toEqual(first)
    expect(parentLinks.studentIdsOf(6).filter((id) => id === 3)).toHaveLength(1)
  })

  it('a second student keeps the first link (a parent has many children)', async () => {
    const t4 = (await view(s4)).data.token
    // Parent 6 is already linked to 4 by the seed: created=false, the seeded link 2 is kept.
    const r = await accept(t4, parent)
    expect(r.data.created).toBe(false)
    expect(parentLinks.studentIdsOf(6).sort()).toEqual([2, 3, 4])
  })

  it('the new link shows on the student page (FR-L45-18), no other field changes', async () => {
    const parents = (await view(s3)).data.parents
    expect(parents.map((p) => p.id)).toEqual([6])
    expect(users.get(6)?.role).toBe('parent')
  })

  it('an accepted link shows in the M02 admin detail of the parent and survives a regenerate (BR-L45-03)', async () => {
    const detail = await call<{ linkedStudents: { id: number }[] }>(
      'GET',
      '/api/admin/users/6',
      admin,
    )
    expect(detail.data.linkedStudents.map((s) => s.id)).toContain(3)
    await generate(s3)
    expect(parentLinks.listParentsOfStudent(3)).toHaveLength(1)
  })

  it('the old token is 404 after a regenerate, the new one links (BR-L45-03)', async () => {
    const oldToken = (await view(s3)).data.token
    const fresh = (await generate(s3)).data.token
    expect(fresh).not.toBe(oldToken)
    const before = parentLinks.all().length
    expect((await accept(oldToken, parent)).status).toBe(404)
    expect(parentLinks.all()).toHaveLength(before)
    expect((await accept(fresh, parent)).data.created).toBe(false)
  })
})

describe('parents list order (BR-L45-08, FR-L45-15)', () => {
  it('orders by parent name, case-insensitive; skips a link whose user is not a parent', async () => {
    const created: number[] = []
    for (const name of ['aminah ujian', 'Zainab Ujian', 'Ibu Bapa Demo B']) {
      const r = await runtime.transport.request({
        method: 'POST',
        url: '/api/admin/users',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
          authorization: `Bearer ${admin}`,
        },
        body: {
          role: 'parent',
          name,
          email: `${name.replace(/\s/g, '.').toLowerCase()}@demo.test`,
          password: 'rahsia123',
          passwordConfirmation: 'rahsia123',
        },
      })
      expect(r.status).toBe(201)
      created.push((r.body as { data: { id: number } }).data.id)
    }
    const now = clock.now()
    for (const id of created) parentLinks.createIfAbsent(id, 4, now)
    // A link row that points at a non-parent user is not listed.
    parentLinks.createIfAbsent(1, 4, now)
    const names = (await view(s4)).data.parents.map((p) => p.name)
    expect(names).toEqual(['aminah ujian', 'Ibu Bapa Demo', 'Ibu Bapa Demo B', 'Zainab Ujian'])
  })
})

describe('BR-L45-04: the student must be an active student', () => {
  it('an inactive student`s token is 404 (preview and accept), and valid again once reactivated', async () => {
    const token = (await view(s3)).data.token
    expect((await preview(token)).status).toBe(200)
    const off = await call('POST', '/api/admin/users/3/toggle-active', admin)
    expect(off.status).toBe(200)
    expect(users.get(3)?.isActive).toBe(false)
    const before = parentLinks.all().length
    const p = await preview(token)
    expect(p.status).toBe(404)
    expect(p.error?.code).toBe('NOT_FOUND')
    expect((await accept(token, parent)).status).toBe(404)
    expect(parentLinks.all()).toHaveLength(before)
    // The token stays in place (invalid, not deleted): XR-L45-01(c).
    expect(parentInvites.get(3)?.token).toBe(token)
    await call('POST', '/api/admin/users/3/toggle-active', admin)
    expect((await preview(token)).status).toBe(200)
  })

  it('a token held by a non-student user is 404', () => {
    parentInvites.setToken(6, 'aa'.repeat(32), clock.now())
    return preview('aa'.repeat(32)).then((r) => {
      expect(r.status).toBe(404)
      parentInvites.removeForUser(6)
    })
  })

  it('deleting a student takes its invite (and links) with it (XR-L45-01 c)', async () => {
    const created = await runtime.transport.request({
      method: 'POST',
      url: '/api/admin/users',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        authorization: `Bearer ${admin}`,
      },
      body: {
        role: 'student',
        name: 'Murid Padam Ujian',
        grade: 8,
        icNumber: '090101101299',
        schoolId: 987,
        email: 'murid.padam@demo.test',
        password: 'rahsia123',
        passwordConfirmation: 'rahsia123',
      },
    })
    expect(created.status).toBe(201)
    const id = (created.body as { data: { id: number } }).data.id
    const t = parentInvites.getOrCreate(id, clock.now()).token
    expect((await preview(t)).status).toBe(200)
    const del = await runtime.transport.request({
      method: 'DELETE',
      url: `/api/admin/users/${String(id)}`,
      headers: { accept: 'application/json', authorization: `Bearer ${admin}` },
    })
    expect(del.status).toBe(200)
    expect(parentInvites.get(id)).toBeUndefined()
    expect((await preview(t)).status).toBe(404)
  })
})

describe('failure injection', () => {
  it('failNext on #1 answers 500, creates no token, and the next call works', async () => {
    parentInvites.removeForUser(4)
    runtime.faults.failNext('/api/me/parent-invite', { status: 500 })
    expect((await view(s4)).status).toBe(500)
    expect(parentInvites.get(4)).toBeUndefined()
    expect((await view(s4)).status).toBe(200)
  })

  it('failNext on #3 answers 500 once, then the preview works', async () => {
    const token = (await view(s2)).data.token
    runtime.faults.failNext('/api/parent-invites/*', { status: 500 })
    expect((await preview(token)).status).toBe(500)
    expect((await preview(token)).status).toBe(200)
  })

  it('failNext makes #1, #2 and #4 answer 500 without changing the token or links', async () => {
    const token = (await view(s2)).data.token
    runtime.faults.failNext('/api/me/parent-invite/generate', { status: 500 })
    expect((await generate(s2)).status).toBe(500)
    expect((await view(s2)).data.token).toBe(token)
    runtime.faults.failNext('/api/parent-invites/*/accept', { status: 500 })
    const before = parentLinks.all().length
    expect((await accept(token, parent)).status).toBe(500)
    expect(parentLinks.all()).toHaveLength(before)
  })
})

describe('token format (BR-L45-02) and the e2e convention', () => {
  it('the n-th deterministic token is n as 64 hex digits (first = 63 zeros then 1)', () => {
    expect(deterministicInviteToken(1)).toBe(`${'0'.repeat(63)}1`)
    expect(deterministicInviteToken(255)).toBe(`${'0'.repeat(62)}ff`)
    expect(deterministicInviteToken(1)).toMatch(HEX64)
  })

  it('in the e2e build tokens are issued in order, a regenerate takes the next number', () => {
    vi.stubEnv('MODE', 'e2e')
    try {
      // Precondition: the e2e switch is really on, and the test does not depend on earlier tests' rows.
      expect(sessionTokenSource()).toBe('deterministic')
      for (const row of [2, 3, 4, 6]) parentInvites.removeForUser(row)
      const a = parentInvites.getOrCreate(3, clock.now()).token
      const b = parentInvites.getOrCreate(2, clock.now()).token
      const c = parentInvites.rotate(3, clock.now()).token
      expect(a).toBe(deterministicInviteToken(1))
      expect(b).toBe(deterministicInviteToken(2))
      expect(c).toBe(deterministicInviteToken(3))
      expect(parentInvites.resolve(deterministicInviteToken(1))).toBeUndefined()
    } finally {
      vi.unstubAllEnvs()
    }
  })

  it('e2e: a hook-set 64-f token does not overflow; the next token is still 64 hex (BigInt)', () => {
    vi.stubEnv('MODE', 'e2e')
    try {
      expect(sessionTokenSource()).toBe('deterministic')
      for (const row of [2, 3, 4, 6]) parentInvites.removeForUser(row)
      const top = 'f'.repeat(64)
      parentInvites.setToken(2, top, clock.now())
      const next = parentInvites.getOrCreate(3, clock.now()).token
      expect(next).toMatch(HEX64)
      expect(next).not.toBe(top)
      expect(next).toBe(deterministicInviteToken(1))
      // A large (beyond 2^53) deterministic token is counted exactly (the 64-f row is gone first).
      parentInvites.removeForUser(2)
      parentInvites.setToken(4, deterministicInviteToken(2n ** 60n), clock.now())
      expect(parentInvites.rotate(3, clock.now()).token).toBe(
        deterministicInviteToken(2n ** 60n + 1n),
      )
    } finally {
      vi.unstubAllEnvs()
      for (const row of [2, 3, 4, 6]) parentInvites.removeForUser(row)
    }
  })

  it('initials: first letter of the first two words, upper case, "?" when empty (FR-L45-22)', () => {
    expect(initialsOf('Pelajar Dua Demo')).toBe('PD')
    expect(initialsOf('  siti  ')).toBe('S')
    expect(initialsOf('')).toBe('?')
    expect(initialsOf('   ')).toBe('?')
  })
})

describe('mock.setParentInviteToken', () => {
  it('fixes the token (stored lower-case) and the old one stops working', async () => {
    const old = (await view(s2)).data.token
    expect(setParentInviteToken(2, 'FIXED-TOKEN-2')).toBe('fixed-token-2')
    expect((await view(s2)).data.token).toBe('fixed-token-2')
    expect((await preview('FIXED-token-2')).status).toBe(200)
    expect((await preview(old)).status).toBe(404)
  })

  it('refuses bad input and a token that belongs to another student', () => {
    expect(() => setParentInviteToken(0, 'x')).toThrow(RangeError)
    expect(() => setParentInviteToken(6, 'x')).toThrow(/not a student/)
    expect(() => setParentInviteToken(999_999_999, 'x')).toThrow(RangeError)
    expect(() => setParentInviteToken(2, '  ')).toThrow(RangeError)
    expect(() => setParentInviteToken(3, 'fixed-token-2')).toThrow(/already belongs/)
  })

  it('is registered as a plugin hook', async () => {
    const { default: plugin } = await import('../../mock')
    expect(Object.keys(plugin.hooks)).toContain('setParentInviteToken')
  })
})

afterAll(() => {
  vi.unstubAllEnvs()
})
