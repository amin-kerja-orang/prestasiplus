/**
 * M27 endpoints #20 (start) and #21 (leave) "Menyamar" (M27-T1d; SRS Part B §19, FR-M27-121 to 124,
 * BR-M27-42, SEC-M27-11/12). Real core with the owners at the project clock. Every test creates the
 * users it impersonates. Personas: P2 school admin of school 900001, P3 school admin of school 900002.
 */

import { beforeAll, beforeEach, describe, expect, it } from 'vitest'

import type { HttpMethod, TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock } from '@/lib/time'
import { setUser } from '@/mock/core-data/set-user'
import { bootMock, type MockRuntime } from '@/mock/index'
import m01, { impersonation, users } from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'
import m08 from '@/modules/m08-student-performance/mock'
import m09 from '@/modules/m09-content/mock'
import m10 from '@/modules/m10-teacher-class/mock'

import type { ImpersonateResult, LeaveImpersonationResult } from '../../api/school-admin'
import m27 from '../../mock'
import { MSG_IMPERSONATE_LEAVE } from '../../mock/handlers/impersonate'

const ADMIN = 1
const PELAJAR = 2
const P2 = 8
const P3 = 3104
const S1 = 900001
const S2 = 900002
const NOW = Date.parse(CLOCK_ANCHOR_ISO)
const BASE = '/api/admin-sekolah'

let runtime: MockRuntime
let seq = 0

beforeAll(async () => {
  runtime = await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m08, m09, m10, m27],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
}, 600_000)

beforeEach(() => {
  impersonation.resetAudit()
})

async function callWith<T = unknown>(
  token: string | null,
  url: string,
  method: HttpMethod = 'POST',
): Promise<{ status: number; body: T }> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (token !== null) headers.authorization = `Bearer ${token}`
  const res: TransportResponse = await runtime.transport.request({ method, url, headers })
  return { status: res.status, body: res.body as T }
}

const as = <T = unknown>(userId: number, url: string) =>
  callWith<T>(setUser(userId).token, url)

const errCode = (r: { body: unknown }) => (r.body as { error: { code: string } }).error.code

const makeUser = (
  role: 'student' | 'teacher',
  schoolId: number,
  over: { isActive?: boolean } = {},
) =>
  users.create(
    {
      name: `Contoh ${role} ${String(++seq)}`,
      email: `${role}-t1d-${String(seq)}@demo.test`,
      role,
      schoolId,
      isActive: over.isActive ?? true,
    },
    NOW,
  )

const start = (adminId: number, targetId: number) =>
  as<ImpersonateResult>(adminId, `${BASE}/users/${String(targetId)}/impersonate`)

describe('#20 POST /users/:id/impersonate', () => {
  it('opens a pupil session of the own school with the target landing path, flash and audit row', async () => {
    const pupil = makeUser('student', S1)
    const r = await start(P2, pupil.id)
    expect(r.status).toBe(200)
    expect(r.body.status).toBe(`Anda kini menyamar sebagai ${pupil.name}.`)
    expect(r.body.data.user.id).toBe(pupil.id)
    expect(r.body.data.user.landingPath).toBe('/dashboard')
    expect(r.body.data.impersonator.id).toBe(P2)
    expect(typeof r.body.data.token).toBe('string')
    expect(r.body.data.token).not.toBe(setUser(P2).token)
    expect(impersonation.audit()).toEqual([
      { actorId: P2, targetId: pupil.id, action: 'impersonate.start', at: expect.any(Number) },
    ])
  })

  it('opens a teacher session of the own school', async () => {
    const teacher = makeUser('teacher', S1)
    const r = await start(P2, teacher.id)
    expect(r.status).toBe(200)
    expect(r.body.data.user.id).toBe(teacher.id)
    expect(r.body.data.user.role).toBe('teacher')
  })

  it('the returned token is a live session of the target', async () => {
    const pupil = makeUser('student', S1)
    const r = await start(P2, pupil.id)
    expect(impersonation.isImpersonating(r.body.data.token)).toBe(true)
  })

  it('a second start from the impersonated session answers 409 and opens nothing', async () => {
    const a = makeUser('student', S1)
    const b = makeUser('student', S1)
    const first = await start(P2, a.id)
    impersonation.resetAudit()
    const second = await callWith(first.body.data.token, `${BASE}/users/${String(b.id)}/impersonate`)
    expect(second.status).toBe(409)
    expect(errCode(second)).toBe('CONFLICT')
    expect(impersonation.audit()).toEqual([])
  })

  it('a user of another school and an unknown or malformed id answer 404', async () => {
    const foreign = makeUser('student', S2)
    for (const id of [String(foreign.id), '99999999', 'abc', '0']) {
      const r = await as(P2, `${BASE}/users/${id}/impersonate`)
      expect(r.status).toBe(404)
    }
    expect(impersonation.audit()).toEqual([])
  })

  it('a staff target answers 403', async () => {
    const r = await start(P2, P3)
    expect(r.status).toBe(404) // another school
    const staff = users.create(
      { name: 'Contoh staf', email: 'staf-t1d@demo.test', role: 'school_admin', schoolId: S1, isActive: true },
      NOW,
    )
    const same = await start(P2, staff.id)
    expect(same.status).toBe(403)
    expect(errCode(same)).toBe('FORBIDDEN')
    expect(impersonation.audit()).toEqual([])
  })

  it('an inactive target answers 403', async () => {
    const pupil = makeUser('student', S1, { isActive: false })
    const r = await start(P2, pupil.id)
    expect(r.status).toBe(403)
    expect(impersonation.audit()).toEqual([])
  })

  it('a caller who is not a school admin answers 403; a guest answers 401', async () => {
    const pupil = makeUser('student', S1)
    expect((await start(PELAJAR, pupil.id)).status).toBe(403)
    expect((await start(ADMIN, pupil.id)).status).toBe(403)
    const guest = await callWith(null, `${BASE}/users/${String(pupil.id)}/impersonate`)
    expect(guest.status).toBe(401)
    expect(impersonation.audit()).toEqual([])
  })
})

describe('#21 POST /impersonate/leave', () => {
  it('restores the actor session, answers returnTo S6 for a pupil and writes the audit row', async () => {
    const pupil = makeUser('student', S1)
    const adminToken = setUser(P2).token
    const s = await callWith<ImpersonateResult>(
      adminToken,
      `${BASE}/users/${String(pupil.id)}/impersonate`,
    )
    const r = await callWith<LeaveImpersonationResult>(s.body.data.token, `${BASE}/impersonate/leave`)
    expect(r.status).toBe(200)
    expect(r.body.status).toBe(MSG_IMPERSONATE_LEAVE)
    expect(r.body.data.token).toBe(adminToken)
    expect(r.body.data.user.id).toBe(P2)
    expect(r.body.data.returnTo).toBe('/admin-sekolah/pelajar')
    expect(impersonation.audit().map((row) => row.action)).toEqual([
      'impersonate.start',
      'impersonate.leave',
    ])
    // The impersonated session is revoked; the actor's own one still works.
    const again = await callWith(s.body.data.token, `${BASE}/impersonate/leave`)
    expect(again.status).toBe(401)
    const next = await callWith(adminToken, `${BASE}/users/${String(pupil.id)}/impersonate`)
    expect(next.status).toBe(200)
  })

  it('answers returnTo S7 for a teacher', async () => {
    const teacher = makeUser('teacher', S1)
    const s = await start(P2, teacher.id)
    const r = await callWith<LeaveImpersonationResult>(s.body.data.token, `${BASE}/impersonate/leave`)
    expect(r.status).toBe(200)
    expect(r.body.data.returnTo).toBe('/admin-sekolah/guru')
  })

  it('answers 403 without an impersonation and writes no audit row', async () => {
    const r = await as(P2, `${BASE}/impersonate/leave`)
    expect(r.status).toBe(403)
    expect(impersonation.audit()).toEqual([])
  })

  it('answers 401 for a guest', async () => {
    expect((await callWith(null, `${BASE}/impersonate/leave`)).status).toBe(401)
  })
})
