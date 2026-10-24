/**
 * M27-T0b (XR-M27-21): the school-admin impersonation switch. Boots the registry (latency 0, fixed
 * clock); the tests open sessions through `issueSession` and call `impersonation` directly.
 */

import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, createClock, MINUTE_MS, toEpochMs } from '@/lib/time'
import { sessions } from '@/mock/auth/sessions'
import { issueSession } from '@/mock/core-data/client-session'
import { bootMock } from '@/mock/index'

import {
  ImpersonationError,
  impersonation,
  isSessionUser,
  users,
  type ImpersonationErrorCode,
} from '../../mock'
import { impersonationAudit } from '../../mock/impersonation'

const clock = createClock({ at: CLOCK_ANCHOR_ISO })
const NOW = toEpochMs(CLOCK_ANCHOR_ISO)

const SCHOOL_ADMIN = 8 // smkDemo
const PUPIL = 2 // smkDemo
const TEACHER = 5 // smkDemo
const OTHER_SCHOOL_PUPIL = 3201 // school 8880 (M08 anchor; account 4 joined smkDemo, D54)
const ADMIN = 1
const PARENT = 6

beforeAll(async () => {
  await bootMock({ mode: 'test', clock, latencyMs: 0, onWarn: null })
}, 300_000)

beforeEach(() => {
  impersonation.resetAudit()
})

afterEach(() => {
  impersonation.resetAudit()
  for (const id of [SCHOOL_ADMIN, PUPIL, TEACHER, OTHER_SCHOOL_PUPIL, ADMIN, PARENT]) {
    sessions.revokeAllFor(id)
  }
})

function login(userId: number, now = NOW): string {
  const user = users.get(userId)
  if (!user || !isSessionUser(user)) throw new Error(`no session user ${String(userId)}`)
  return issueSession(user, false, now).token
}

function refusal(fn: () => unknown): ImpersonationError {
  try {
    fn()
  } catch (e) {
    if (e instanceof ImpersonationError) return e
    throw e
  }
  throw new Error('expected an ImpersonationError')
}

function expectRefused(fn: () => unknown, code: ImpersonationErrorCode, status: number): void {
  const e = refusal(fn)
  expect(e.code).toBe(code)
  expect(e.status).toBe(status)
}

describe('impersonation.start', () => {
  it('opens a target session carrying the actor token, leaves the actor session valid', () => {
    const adminToken = login(SCHOOL_ADMIN)
    const before = sessions.peek(adminToken)
    const { session, impersonator } = impersonation.start(
      { id: SCHOOL_ADMIN, sessionToken: adminToken },
      PUPIL,
      NOW,
    )
    expect(session.user.id).toBe(PUPIL)
    expect(session.token).not.toBe(adminToken)
    expect(session.remember).toBe(false)
    expect(impersonator).toEqual({ id: SCHOOL_ADMIN, name: users.get(SCHOOL_ADMIN)?.name })
    expect(session.impersonator).toEqual({
      ...impersonator,
      returnTo: '/admin-sekolah/pelajar',
    })
    expect(sessions.peek(session.token)?.parentToken).toBe(adminToken)
    expect(impersonation.isImpersonating(session.token)).toBe(true)
    expect(impersonation.isImpersonating(adminToken)).toBe(false)
    expect(sessions.peek(adminToken)).toEqual(before)
  })

  it('returnTo follows the target role (teacher -> guru)', () => {
    const adminToken = login(SCHOOL_ADMIN)
    const { session } = impersonation.start(
      { id: SCHOOL_ADMIN, sessionToken: adminToken },
      TEACHER,
      NOW,
    )
    expect(session.impersonator?.returnTo).toBe('/admin-sekolah/guru')
  })

  it('the target session has the target rights only and the actor session is not slid by it', () => {
    const adminToken = login(SCHOOL_ADMIN)
    const expiry = sessions.peek(adminToken)?.expiresAt
    const { session } = impersonation.start(
      { id: SCHOOL_ADMIN, sessionToken: adminToken },
      PUPIL,
      NOW,
    )
    expect(session.user.role).toBe('student')
    // The target keeps working for an hour; the actor row is not slid by it.
    const later = NOW + 60 * MINUTE_MS
    expect(sessions.resolve(session.token, later)?.userId).toBe(PUPIL)
    expect(sessions.peek(adminToken)?.expiresAt).toBe(expiry)
  })

  it('refuses a nested start with 409, before the role guard', () => {
    const adminToken = login(SCHOOL_ADMIN)
    const { session } = impersonation.start(
      { id: SCHOOL_ADMIN, sessionToken: adminToken },
      PUPIL,
      NOW,
    )
    const count = sessions.listFor(TEACHER).length
    expectRefused(
      () => impersonation.start({ id: PUPIL, sessionToken: session.token }, TEACHER, NOW),
      'NESTED',
      409,
    )
    expectRefused(
      () => impersonation.start({ id: SCHOOL_ADMIN, sessionToken: session.token }, TEACHER, NOW),
      'NESTED',
      409,
    )
    expect(sessions.listFor(TEACHER)).toHaveLength(count)
    expect(impersonationAudit()).toHaveLength(1)
  })

  it.each([
    ['another school', OTHER_SCHOOL_PUPIL, 'UNKNOWN_TARGET', 404],
    ['an unknown id', 99_999_999, 'UNKNOWN_TARGET', 404],
    ['the platform admin', ADMIN, 'UNKNOWN_TARGET', 404],
    ['a peer school admin', SCHOOL_ADMIN, 'STAFF_TARGET', 403],
  ] as const)('refuses %s', (_label, target, code, status) => {
    const adminToken = login(SCHOOL_ADMIN)
    const before = sessions.listFor(target).length
    expectRefused(
      () => impersonation.start({ id: SCHOOL_ADMIN, sessionToken: adminToken }, target, NOW),
      code,
      status,
    )
    expect(sessions.listFor(target)).toHaveLength(before)
    expect(impersonationAudit()).toEqual([])
  })

  it('refuses a staff target of the own school (403) and an inactive pupil (403)', () => {
    const adminToken = login(SCHOOL_ADMIN)
    const actor = { id: SCHOOL_ADMIN, sessionToken: adminToken }
    // Staff of the same school: move the parent account there for the check, then restore.
    const parent = users.get(PARENT)
    if (!parent) throw new Error('no parent')
    users.update(PARENT, { schoolId: users.get(SCHOOL_ADMIN)?.schoolId ?? null }, NOW)
    try {
      expectRefused(() => impersonation.start(actor, PARENT, NOW), 'STAFF_TARGET', 403)
    } finally {
      users.update(PARENT, { schoolId: parent.schoolId }, NOW)
    }

    users.update(PUPIL, { isActive: false }, NOW)
    try {
      expectRefused(() => impersonation.start(actor, PUPIL, NOW), 'INACTIVE_TARGET', 403)
    } finally {
      users.update(PUPIL, { isActive: true }, NOW)
    }
    expect(sessions.listFor(PUPIL)).toHaveLength(0)
    expect(impersonationAudit()).toEqual([])
  })

  it('refuses a caller that is not a school admin, or a session of another user', () => {
    const pupilToken = login(PUPIL)
    expectRefused(
      () => impersonation.start({ id: PUPIL, sessionToken: pupilToken }, TEACHER, NOW),
      'NOT_SCHOOL_ADMIN',
      403,
    )
    const adminToken = login(SCHOOL_ADMIN)
    expectRefused(
      () => impersonation.start({ id: SCHOOL_ADMIN, sessionToken: pupilToken }, TEACHER, NOW),
      'NOT_SCHOOL_ADMIN',
      403,
    )
    expect(adminToken).not.toBe(pupilToken)
  })
})

describe('impersonation.leave', () => {
  it('restores the actor session with the same token, revokes the target session, audits both', () => {
    const adminToken = login(SCHOOL_ADMIN)
    const { session } = impersonation.start(
      { id: SCHOOL_ADMIN, sessionToken: adminToken },
      PUPIL,
      NOW,
    )
    const out = impersonation.leave(session.token, NOW + 5 * MINUTE_MS)
    expect(out.returnTo).toBe('/admin-sekolah/pelajar')
    expect(out.session.token).toBe(adminToken)
    expect(out.session.user.id).toBe(SCHOOL_ADMIN)
    expect(out.session.impersonator).toBeUndefined()
    expect(sessions.peek(session.token)).toBeUndefined()
    expect(sessions.peek(adminToken)).toBeDefined()
    expect(impersonation.isImpersonating(session.token)).toBe(false)
    expect(impersonationAudit()).toEqual([
      { actorId: SCHOOL_ADMIN, targetId: PUPIL, action: 'impersonate.start', at: NOW },
      {
        actorId: SCHOOL_ADMIN,
        targetId: PUPIL,
        action: 'impersonate.leave',
        at: NOW + 5 * MINUTE_MS,
      },
    ])
    expect(JSON.stringify(impersonationAudit())).not.toMatch(/pass|token|pp_/i)
  })

  it('returns /admin-sekolah/guru after impersonating a teacher', () => {
    const adminToken = login(SCHOOL_ADMIN)
    const { session } = impersonation.start(
      { id: SCHOOL_ADMIN, sessionToken: adminToken },
      TEACHER,
      NOW,
    )
    expect(impersonation.leave(session.token, NOW).returnTo).toBe('/admin-sekolah/guru')
  })

  it('refuses leaving without an impersonation, and leaving twice', () => {
    const adminToken = login(SCHOOL_ADMIN)
    expectRefused(() => impersonation.leave(adminToken, NOW), 'NOT_IMPERSONATING', 403)
    expectRefused(() => impersonation.leave('pp_unknown', NOW), 'NOT_IMPERSONATING', 403)
    const { session } = impersonation.start(
      { id: SCHOOL_ADMIN, sessionToken: adminToken },
      PUPIL,
      NOW,
    )
    impersonation.leave(session.token, NOW)
    expectRefused(() => impersonation.leave(session.token, NOW), 'NOT_IMPERSONATING', 403)
    expect(impersonationAudit()).toHaveLength(2)
  })

  it('refuses when the actor session ended meanwhile, and still revokes the target session', () => {
    const adminToken = login(SCHOOL_ADMIN)
    const { session } = impersonation.start(
      { id: SCHOOL_ADMIN, sessionToken: adminToken },
      PUPIL,
      NOW,
    )
    sessions.revoke(adminToken)
    expectRefused(() => impersonation.leave(session.token, NOW), 'PARENT_EXPIRED', 403)
    expect(sessions.peek(session.token)).toBeUndefined()
  })

  it('the actor can impersonate again after leaving', () => {
    const adminToken = login(SCHOOL_ADMIN)
    const first = impersonation.start({ id: SCHOOL_ADMIN, sessionToken: adminToken }, PUPIL, NOW)
    impersonation.leave(first.session.token, NOW)
    const second = impersonation.start({ id: SCHOOL_ADMIN, sessionToken: adminToken }, TEACHER, NOW)
    expect(second.session.user.id).toBe(TEACHER)
  })
})

describe('sessions.revokeChildrenOf', () => {
  it('removes only the sessions whose parentToken is the given token', () => {
    const adminToken = login(SCHOOL_ADMIN)
    const unrelated = login(OTHER_SCHOOL_PUPIL)
    const a = impersonation.start({ id: SCHOOL_ADMIN, sessionToken: adminToken }, PUPIL, NOW)
    expect(sessions.revokeChildrenOf(adminToken)).toBe(1)
    expect(sessions.peek(a.session.token)).toBeUndefined()
    expect(sessions.peek(adminToken)).toBeDefined()
    expect(sessions.peek(unrelated)).toBeDefined()
    expect(sessions.revokeChildrenOf(adminToken)).toBe(0)
  })
})
