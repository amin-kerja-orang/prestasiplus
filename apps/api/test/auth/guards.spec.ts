import 'reflect-metadata'

import { Controller, Get, Inject, Injectable, Module, Req } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import {
  AUTH_ERROR_MESSAGES,
  AUTH_ERROR_STATUS,
  capabilitiesFor,
  ErrorBodySchema,
  type RoleCode,
  type Scope,
} from '@pp/contract'
import type { Request } from 'express'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApiError } from '../../src/common/errors/api-error'
import {
  Capability,
  GUARD_PROVIDERS,
  Public,
  Roles,
  SESSION_RESOLVER,
  type SessionResolver,
} from '../../src/common/guards'
import { type AuthContext, type RequestWithAuth } from '../../src/common/scope/auth-context'
import { createTestApp } from '../support/app'

const SCHOOL_SCOPE: Scope = { level: 'school', schoolId: '10', label: 'SMK Ujian' }
const SELF_SCOPE: Scope = { level: 'self', label: 'Diri sendiri' }
const PORTAL = { school_admin: 'pentadbiran', teacher: 'pembelajaran', student: 'pembelajaran' } as const

function ctxFor(
  active: 'school_admin' | 'teacher' | 'student',
  all: ('school_admin' | 'teacher' | 'student')[],
): AuthContext {
  const scope = active === 'student' ? SELF_SCOPE : SCHOOL_SCOPE
  const grant = (role: (typeof all)[number]) => ({
    role: role as RoleCode,
    portal: PORTAL[role],
    scope: role === 'student' ? SELF_SCOPE : SCHOOL_SCOPE,
  })
  return {
    sessionRowId: '00000000-0000-4000-8000-000000000001',
    userId: '5',
    roles: all.map(grant),
    active: { ...grant(active), via: 'direct' },
    mode: null,
    capabilities: capabilitiesFor(active, scope).map((c) => c.key),
    mustChangePassword: false,
  }
}

// A user holding BOTH teacher and school_admin; the key tells which role is active.
const CONTEXTS: Record<string, AuthContext> = {
  admin_active: ctxFor('school_admin', ['teacher', 'school_admin']),
  teacher_active: ctxFor('teacher', ['teacher', 'school_admin']),
  student: ctxFor('student', ['student']),
  // Mod Pelajar: the account is school_admin, the request acts as student/self.
  mod_pelajar: {
    ...ctxFor('student', ['school_admin']),
    mode: { kind: 'mod_pelajar', returnRole: 'school_admin', since: '2026-10-19T08:00:00+08:00', isTest: true },
    active: { role: 'student', portal: 'pembelajaran', scope: SELF_SCOPE, via: 'mod_pelajar' },
  },
}
const ADMIN_CAP = capabilitiesFor('school_admin', SCHOOL_SCOPE)[0]!.key

@Injectable()
class FakeResolver implements SessionResolver {
  calls = 0
  async resolve(req: Request): Promise<AuthContext | null> {
    this.calls += 1
    if (req.header('x-csrf-fail')) {
      throw new ApiError({
        code: 'CSRF_INVALID',
        status: AUTH_ERROR_STATUS.CSRF_INVALID,
        message: AUTH_ERROR_MESSAGES.CSRF_INVALID,
      })
    }
    const key = req.header('x-ctx')
    return key ? (CONTEXTS[key] ?? null) : null
  }
}

@Controller('guard')
class GuardController {
  @Public() @Get('public') pub() {
    return { data: 'public' }
  }
  @Get('open') open(@Req() req: Request & RequestWithAuth) {
    return { data: { role: req.auth?.active.role } }
  }
  @Roles('school_admin') @Get('admin-only') adminOnly() {
    return { data: 'ok' }
  }
  @Roles('teacher', 'student') @Get('learners') learners() {
    return { data: 'ok' }
  }
  @Capability(ADMIN_CAP) @Get('cap') cap() {
    return { data: 'ok' }
  }
}

@Module({
  controllers: [GuardController],
  providers: [{ provide: SESSION_RESOLVER, useClass: FakeResolver }, ...GUARD_PROVIDERS],
  exports: [SESSION_RESOLVER],
})
class GuardTestModule {
  constructor(@Inject(SESSION_RESOLVER) readonly resolver: FakeResolver) {}
}

describe('guards (BE-03 part B)', () => {
  let app: INestApplication
  const http = () => request(app.getHttpServer())
  const resolver = () => app.get(SESSION_RESOLVER) as FakeResolver

  beforeAll(async () => {
    app = await createTestApp({ modules: [GuardTestModule], controllers: [] })
  })
  afterAll(async () => {
    await app.close()
  })

  describe('AuthGuard', () => {
    it('lets a @Public() route through without calling the resolver for a session', async () => {
      const before = resolver().calls
      const res = await http().get('/api/guard/public').expect(200)
      expect(res.body).toEqual({ data: 'public' })
      expect(resolver().calls).toBe(before)
    })

    it('returns 401 UNAUTHORIZED, parsing as ErrorBodySchema, when the resolver yields null', async () => {
      const res = await http().get('/api/guard/open').expect(401)
      const parsed = ErrorBodySchema.parse(res.body)
      expect(parsed.error.code).toBe('UNAUTHORIZED')
    })

    it('sets request.auth from the resolver result', async () => {
      const res = await http().get('/api/guard/open').set('x-ctx', 'student').expect(200)
      expect(res.body.data.role).toBe('student')
    })

    it('propagates a resolver CSRF error as 403 CSRF_INVALID with the contract message', async () => {
      const res = await http().get('/api/guard/open').set('x-ctx', 'student').set('x-csrf-fail', '1').expect(403)
      const parsed = ErrorBodySchema.parse(res.body)
      expect(AUTH_ERROR_STATUS.CSRF_INVALID).toBe(403)
      expect(parsed.error.code).toBe('CSRF_INVALID')
      expect(parsed.error.message).toBe(AUTH_ERROR_MESSAGES.CSRF_INVALID)
    })
  })

  describe('RolesGuard (AC 6: the ACTIVE role decides, not the role list)', () => {
    it('allows the active role', async () => {
      await http().get('/api/guard/admin-only').set('x-ctx', 'admin_active').expect(200)
    })

    it('refuses a dual-role user whose ACTIVE role is not listed, although another role is', async () => {
      const ctx = CONTEXTS.teacher_active!
      expect(ctx.roles.map((r) => r.role)).toContain('school_admin')
      const res = await http().get('/api/guard/admin-only').set('x-ctx', 'teacher_active').expect(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
    })

    it('refuses a role that is not listed', async () => {
      await http().get('/api/guard/admin-only').set('x-ctx', 'student').expect(403)
      await http().get('/api/guard/learners').set('x-ctx', 'admin_active').expect(403)
      await http().get('/api/guard/learners').set('x-ctx', 'teacher_active').expect(200)
    })

    it('refuses a Mod Pelajar session (account school_admin, active student/self) on @Roles(school_admin)', async () => {
      expect(CONTEXTS.mod_pelajar!.roles.map((r) => r.role)).toEqual(['school_admin'])
      await http().get('/api/guard/admin-only').set('x-ctx', 'mod_pelajar').expect(403)
      await http().get('/api/guard/learners').set('x-ctx', 'mod_pelajar').expect(200)
    })

    it('answers 401 before 403 when there is no session', async () => {
      await http().get('/api/guard/admin-only').expect(401)
    })
  })

  describe('CapabilityGuard (AC 6)', () => {
    it('allows a role whose capability list has the key', async () => {
      await http().get('/api/guard/cap').set('x-ctx', 'admin_active').expect(200)
    })

    it('refuses a role without the capability with 403', async () => {
      const res = await http().get('/api/guard/cap').set('x-ctx', 'student').expect(403)
      expect(ErrorBodySchema.parse(res.body).error.code).toBe('FORBIDDEN')
    })

    it('reads the capabilities of the ACTIVE role: a school_admin account acting as teacher is refused', async () => {
      expect(CONTEXTS.teacher_active!.roles.map((r) => r.role)).toContain('school_admin')
      expect(CONTEXTS.teacher_active!.capabilities).not.toContain(ADMIN_CAP)
      await http().get('/api/guard/cap').set('x-ctx', 'teacher_active').expect(403)
    })
  })
})
