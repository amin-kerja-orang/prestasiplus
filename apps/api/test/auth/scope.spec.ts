import 'reflect-metadata'

import { Controller, Get, Inject, Module, Param, Post } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { capabilitiesFor, ErrorBodySchema, type Scope } from '@pp/contract'
import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { GUARD_PROVIDERS, SESSION_RESOLVER, type SessionResolver } from '../../src/common/guards'
import {
  type AuthContext,
  SCOPE_CONTEXT_PROVIDER,
  ScopeContext,
  ScopeFilter,
} from '../../src/common/scope'
import { PrismaService } from '../../src/db/prisma.service'
import { createTestApp } from '../support/app'
import { createTestDatabase, type TestDatabase } from '../support/db'

const USER_COLS = { schoolColumn: 'schoolId', schoolRelation: 'school', userColumn: 'id' } as const

function auth(role: AuthContext['active']['role'], scope: Scope, userId = '1'): AuthContext {
  const portal =
    role === 'school_admin' || role === 'admin' || role === 'ppd_officer' ? 'pentadbiran' : 'pembelajaran'
  return {
    sessionRowId: '00000000-0000-4000-8000-000000000002',
    userId,
    roles: [{ role, portal, scope }],
    active: { role, portal, scope, via: 'direct' },
    mode: null,
    capabilities: capabilitiesFor(role, scope).map((c) => c.key),
  }
}

// schoolId is filled in beforeAll, once the schools exist.
const schoolA: Scope = { level: 'school', schoolId: '', label: 'Sekolah A' }
const ids = { a: '', b: '', userA: '', userB: '' }

@Controller('scoped')
class ScopedController {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ScopeContext) private readonly scope: ScopeContext,
  ) {}

  @Get('users')
  async list() {
    const rows = await this.prisma.client.user.findMany({
      where: this.scope.filter().where(USER_COLS),
      select: { id: true },
      orderBy: { id: 'asc' },
    })
    return { data: rows.map((r) => String(r.id)) }
  }

  @Post('echo')
  echo() {
    return { data: this.scope.scope }
  }

  @Get('users/:id')
  async one(@Param('id') id: string) {
    const row = await this.prisma.client.user.findUnique({ where: { id: BigInt(id) } })
    const found = this.scope.filter().assertInScope(row, USER_COLS)
    return { data: { id: String(found.id) } }
  }
}

class FakeResolver implements SessionResolver {
  async resolve(): Promise<AuthContext | null> {
    return auth('school_admin', schoolA, ids.userA)
  }
}

@Module({
  controllers: [ScopedController],
  providers: [{ provide: SESSION_RESOLVER, useClass: FakeResolver }, ...GUARD_PROVIDERS, SCOPE_CONTEXT_PROVIDER],
})
class ScopeTestModule {}

describe('ScopeFilter and ScopeContext (AC 7)', () => {
  let db: TestDatabase
  let app: INestApplication

  beforeAll(async () => {
    db = await createTestDatabase()
    const q = async (sql: string, p: unknown[] = []) => (await db.query<{ id: string }>(sql, p))[0]!.id
    ids.a = await q(
      `insert into schools (name, code, state, district) values ('SMK A', 'SCA001', 'Selangor', 'Petaling') returning id::text`,
    )
    ids.b = await q(
      `insert into schools (name, code, state, district) values ('SMK B', 'SCB001', 'Johor', 'Muar') returning id::text`,
    )
    ids.userA = await q(`insert into users (name, school_id) values ('Pengguna A', $1) returning id::text`, [ids.a])
    ids.userB = await q(`insert into users (name, school_id) values ('Pengguna B', $1) returning id::text`, [ids.b])
    schoolA.schoolId = ids.a
    app = await createTestApp({ modules: [ScopeTestModule], controllers: [], db })
  })
  afterAll(async () => {
    await app.close()
    await db.drop()
  })

  const http = () => request(app.getHttpServer())

  it('a school admin of school A reading a school B record gets 404 NOT_FOUND, not 403', async () => {
    const res = await http().get(`/api/scoped/users/${ids.userB}`).expect(404)
    expect(ErrorBodySchema.parse(res.body).error.code).toBe('NOT_FOUND')
  })

  it('a missing record answers exactly like an out-of-scope one', async () => {
    const missing = await http().get('/api/scoped/users/999999').expect(404)
    const other = await http().get(`/api/scoped/users/${ids.userB}`).expect(404)
    expect({ ...missing.body.error, requestId: 0 }).toEqual({ ...other.body.error, requestId: 0 })
  })

  it('reads a record of the own school', async () => {
    const res = await http().get(`/api/scoped/users/${ids.userA}`).expect(200)
    expect(res.body.data.id).toBe(ids.userA)
  })

  it('list queries only return rows of the own school', async () => {
    const res = await http().get('/api/scoped/users').expect(200)
    expect(res.body.data).toEqual([ids.userA])
  })

  it('ignores scope values in the query and the body', async () => {
    const list = await http()
      .get(`/api/scoped/users?schoolId=${ids.b}&scope=national&level=national`)
      .expect(200)
    expect(list.body.data).toEqual([ids.userA])
    await http().get(`/api/scoped/users/${ids.userB}?schoolId=${ids.b}`).expect(404)
    const echo = await http()
      .post(`/api/scoped/echo?schoolId=${ids.b}`)
      .send({ scope: { level: 'national', label: 'x' }, schoolId: ids.b })
      .expect(201)
    expect(echo.body.data).toMatchObject({ level: 'school', schoolId: ids.a })
  })

  describe('where() and isInScope() per level (unit)', () => {
    it('national: no restriction', () => {
      const f = new ScopeFilter(auth('admin', { level: 'national', label: 'Kebangsaan' }))
      expect(f.where(USER_COLS)).toEqual({})
      expect(f.isInScope({ schoolId: 1n }, USER_COLS)).toBe(true)
    })

    it('school: schoolColumn equals the scope school as BigInt', () => {
      const f = new ScopeFilter(auth('school_admin', { level: 'school', schoolId: '7', label: 'S' }))
      expect(f.where(USER_COLS)).toEqual({ schoolId: 7n })
      expect(f.isInScope({ schoolId: 7n }, USER_COLS)).toBe(true)
      expect(f.isInScope({ schoolId: 8n }, USER_COLS)).toBe(false)
      expect(f.isInScope({ schoolId: null }, USER_COLS)).toBe(false)
    })

    it('district: filters through the school relation', () => {
      const f = new ScopeFilter(auth('ppd_officer', { level: 'district', districtCode: 'Muar', label: 'PPD' }))
      expect(f.where(USER_COLS)).toEqual({ school: { is: { district: 'Muar' } } })
      expect(f.isInScope({ school: { district: 'Muar' } }, USER_COLS)).toBe(true)
      expect(f.isInScope({ school: { district: 'Petaling' } }, USER_COLS)).toBe(false)
      expect(f.isInScope({ school: null }, USER_COLS)).toBe(false)
    })

    it('self: owner column equals the user id', () => {
      const f = new ScopeFilter(auth('student', { level: 'self', label: 'Diri' }, '42'))
      expect(f.where({ userColumn: 'userId' })).toEqual({ userId: 42n })
      expect(f.isInScope({ userId: 42n }, { userColumn: 'userId' })).toBe(true)
      expect(f.isInScope({ userId: 43n }, { userColumn: 'userId' })).toBe(false)
    })

    it('fails loudly (not open) when the model lacks the column the level needs', () => {
      const f = new ScopeFilter(auth('school_admin', { level: 'school', schoolId: '7', label: 'S' }))
      expect(() => f.where({})).toThrow(/schoolColumn/)
    })

    it('assertInScope throws 404 for null and returns the record when in scope', () => {
      const f = new ScopeFilter(auth('school_admin', { level: 'school', schoolId: '7', label: 'S' }))
      expect(() => f.assertInScope(null, USER_COLS)).toThrow(expect.objectContaining({ code: 'NOT_FOUND' }))
      const row = { schoolId: 7n }
      expect(f.assertInScope(row, USER_COLS)).toBe(row)
    })
  })
})
