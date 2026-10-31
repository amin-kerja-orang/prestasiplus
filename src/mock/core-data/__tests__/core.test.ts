import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

import type { TransportResponse } from '@/api/transport'
import { CLOCK_ANCHOR_ISO, createClock, DAY_MS, MINUTE_MS, toEpochMs, type Clock } from '@/lib/time'

import { LANDING_PATHS } from '../../auth/landing'
import type { MockRole } from '../../auth/middleware'
import { randomSessionToken, sessionTokenSource } from '../../auth/sessions'
import { bootMock, type MockRuntime } from '../../index'
import { repositoryInfo } from '../../repository'
import { bootWithTestHooks, type HookTarget } from '../../testing'
import core, {
  CANONICAL_ACCOUNTS,
  DEMO_PASSWORD,
  PP_AUTH_STORAGE_KEY,
  sessions,
  users,
  type ClientSession,
  type UserMe,
} from '..'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'

import { canonicalAccount } from '../accounts'
import { setUser } from '../set-user'
import { sha256Hex } from '../sha256'
import { seedSalt } from '../users'

// ---------------------------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------------------------

class MemoryStorage {
  readonly items = new Map<string, string>()
  getItem(key: string) {
    return this.items.get(key) ?? null
  }
  setItem(key: string, value: string) {
    this.items.set(key, value)
  }
  removeItem(key: string) {
    this.items.delete(key)
  }
}

let storage: MemoryStorage

beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('localStorage', storage)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

/** The owners of the stores the core reads (users: M01, schools: M02). */
const CORE_PLUGINS = [m01, m02]

async function boot(): Promise<{ runtime: MockRuntime; clock: Clock }> {
  const clock = createClock({ at: CLOCK_ANCHOR_ISO })
  // No `core` option: the core is discovered from src/mock/core-data (import.meta.glob). The core
  // reads the M01 users store and the M02 schools store (F-23), so those two plugins boot with it.
  const runtime = await bootMock({ mode: 'test', plugins: CORE_PLUGINS, clock, latencyMs: 0 })
  return { runtime, clock }
}

function get(runtime: MockRuntime, url: string, token?: string): Promise<TransportResponse> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (token !== undefined) headers.authorization = `Bearer ${token}`
  return runtime.transport.request({ method: 'GET', url, headers })
}

async function me(runtime: MockRuntime, token?: string) {
  const res = await get(runtime, '/api/me', token)
  return { status: res.status, body: res.body as { data: UserMe } & { error?: { code: string } } }
}

function storedAuth(): ClientSession {
  const raw = storage.getItem(PP_AUTH_STORAGE_KEY)
  if (raw === null) throw new Error('pp.auth not written')
  return JSON.parse(raw) as ClientSession
}

/** TRACKER "Canonical seed accounts" (+ M01 §6.8 names, IC, isActive, lastLoginAt). */
const TRACKER: readonly {
  id: number
  email: string
  role: MockRole
  name: string
  grade: number | null
  schoolId: number | null
  isActive: boolean
  lastLoginAt: string | null
}[] = [
  {
    id: 1,
    email: 'admin@demo.test',
    role: 'admin',
    name: 'Admin Demo',
    grade: null,
    schoolId: null,
    isActive: true,
    lastLoginAt: '2026-09-25T09:00:00+08:00',
  },
  {
    id: 2,
    email: 'pelajar@demo.test',
    role: 'student',
    name: 'Pelajar Demo',
    grade: 10,
    schoolId: 900001,
    isActive: true,
    lastLoginAt: '2026-09-24T20:15:00+08:00',
  },
  {
    id: 3,
    email: 'pelajar2@demo.test',
    role: 'student',
    name: 'Pelajar Dua Demo',
    grade: 10,
    schoolId: null,
    isActive: true,
    lastLoginAt: '2026-09-20T19:30:00+08:00',
  },
  {
    id: 4,
    email: 'pelajarmaju@demo.test',
    role: 'student',
    name: 'Pelajar Maju Demo',
    grade: 11,
    schoolId: 900001,
    isActive: true,
    lastLoginAt: '2026-09-24T18:00:00+08:00',
  },
  {
    id: 5,
    email: 'guru@demo.test',
    role: 'teacher',
    name: 'Guru Demo',
    grade: null,
    schoolId: 900001,
    isActive: true,
    lastLoginAt: '2026-09-24T21:00:00+08:00',
  },
  {
    id: 6,
    email: 'ibubapa@demo.test',
    role: 'parent',
    name: 'Ibu Bapa Demo',
    grade: null,
    schoolId: null,
    isActive: true,
    lastLoginAt: '2026-09-10T21:00:00+08:00',
  },
  {
    id: 7,
    email: 'penaja@demo.test',
    role: 'sponsor',
    name: 'Penaja Demo',
    grade: null,
    schoolId: null,
    isActive: true,
    lastLoginAt: null,
  },
  {
    id: 8,
    email: 'adminsekolah@demo.test',
    role: 'school_admin',
    name: 'Pentadbir Sekolah Demo',
    grade: null,
    schoolId: 900001,
    isActive: true,
    lastLoginAt: '2026-09-20T10:00:00+08:00',
  },
  {
    id: 9,
    email: 'ppd@demo.test',
    role: 'ppd_officer',
    name: 'Pegawai PPD Demo',
    grade: null,
    schoolId: null,
    isActive: true,
    lastLoginAt: '2026-09-19T09:30:00+08:00',
  },
  {
    id: 10,
    email: 'jpn@demo.test',
    role: 'jpn_officer',
    name: 'Pegawai JPN Demo',
    grade: null,
    schoolId: null,
    isActive: true,
    lastLoginAt: '2026-09-19T10:00:00+08:00',
  },
  {
    id: 11,
    email: 'tidakaktif@demo.test',
    role: 'student',
    name: 'Pelajar Tidak Aktif Demo',
    grade: 7,
    schoolId: 9167,
    isActive: false,
    lastLoginAt: null,
  },
]

const USER_ME_KEYS = [
  'avatarUrl',
  'bio',
  'createdAt',
  'email',
  'grade',
  'id',
  'landingPath',
  'lastLoginAt',
  'name',
  'phone',
  'role',
  'school',
  'schoolId',
  'updatedAt',
]

// ---------------------------------------------------------------------------------------------
// Accounts and seed
// ---------------------------------------------------------------------------------------------

describe('canonical accounts (TRACKER, M01 §6.8)', () => {
  it('are exactly ids 1–11 with the TRACKER email, role, grade, school, state and lastLoginAt', () => {
    expect(
      CANONICAL_ACCOUNTS.map((a) => ({
        id: a.id,
        email: a.email,
        role: a.role,
        name: a.name,
        grade: a.grade,
        schoolId: a.schoolId,
        isActive: a.isActive,
        lastLoginAt: a.lastLoginAt,
      })),
    ).toEqual(TRACKER)
  })

  it('use the demo password, the M01 IC for pelajar only, and no phone/bio/avatar', () => {
    expect(DEMO_PASSWORD).toBe('Demo1234')
    for (const a of CANONICAL_ACCOUNTS) {
      expect(a.password).toBe('Demo1234')
      expect(a.icNumber).toBe(a.id === 2 ? '100101140001' : null)
      expect([a.phone, a.bio, a.avatarUrl]).toEqual([null, null, null])
    }
  })

  it('the admin was created on 6 Feb 2026 ("Ahli sejak 6 Februari 2026", observed)', () => {
    expect(canonicalAccount(1)?.createdAt.slice(0, 10)).toBe('2026-02-06')
    expect(canonicalAccount('PELAJAR@demo.test')?.id).toBe(2)
  })

  it('are anchors of the M01 users store (F-23) without passwords in the rows', async () => {
    await boot()
    for (const a of TRACKER) {
      const row = users.get(a.id)
      expect(row).toMatchObject(a)
      expect(row).not.toHaveProperty('password')
    }
    expect(users.verifyPassword(2, 'Demo1234')).toBe(true)
    expect(users.verifyPassword(2, 'demo1234')).toBe(false)
    expect(users.verifyPassword(99, 'Demo1234')).toBe(false)
    expect(users.findByEmail('  Pelajar@Demo.Test ')?.id).toBe(2)
    expect(users.findByEmail('nobody@demo.test')).toBeUndefined()
  })

  it('the core re-exports users (M01, F-23) and owns sessions (core); it registers setUser', () => {
    expect(repositoryInfo(users)).toMatchObject({
      owner: 'M01',
      provisional: false,
      kind: 'virtual',
    })
    expect(repositoryInfo(sessions)).toMatchObject({ owner: 'core', provisional: false })
    expect(Object.keys(core.repositories)).toEqual(['sessions'])
    expect(Object.keys(core.hooks)).toEqual(['setUser'])
    expect(core.resolveSession).toBeTypeOf('function')
  })
})

describe('landing paths (BR-07)', () => {
  it('maps every role', () => {
    expect(LANDING_PATHS).toEqual({
      admin: '/admin',
      ppd_officer: '/ppd/dashboard',
      jpn_officer: '/jpn/dashboard',
      student: '/dashboard',
      teacher: '/dashboard',
      parent: '/dashboard',
      sponsor: '/dashboard',
      school_admin: '/dashboard',
    })
  })
})

// ---------------------------------------------------------------------------------------------
// GET /api/me and session resolution
// ---------------------------------------------------------------------------------------------

describe('GET /api/me', () => {
  it('returns the UserMe shape: no password, IC, rememberToken or isActive', async () => {
    const { runtime } = await boot()
    const { token } = setUser('pelajar@demo.test')
    const { status, body } = await me(runtime, token)
    expect(status).toBe(200)
    expect(Object.keys(body.data).sort()).toEqual(USER_ME_KEYS)
    expect(body.data).toEqual({
      id: 2,
      name: 'Pelajar Demo',
      email: 'pelajar@demo.test',
      phone: null,
      role: 'student',
      grade: 10,
      schoolId: 900001,
      bio: null,
      avatarUrl: null,
      createdAt: '2026-02-06T09:00:00+08:00',
      updatedAt: '2026-02-06T09:00:00+08:00',
      lastLoginAt: '2026-09-24T20:15:00+08:00',
      // The M02 SchoolSummary of fixture school 900001 (F-23).
      school: {
        id: 900001,
        name: 'SMK DEMO',
        code: 'BEA4001',
        type: 'SMK',
        state: 'Selangor',
        district: 'PPD PETALING UTAMA',
        city: null,
      },
      landingPath: '/dashboard',
    })
    expect(JSON.stringify(body)).not.toMatch(/Demo1234|100101140001|isActive|password|icNumber/)
  })

  it.each(TRACKER.map((a) => [a.id, a.role] as const))(
    'resolves the session of account %i as role %s with its landing path',
    async (id, role) => {
      const { runtime } = await boot()
      const { token } = setUser(id)
      const { status, body } = await me(runtime, token)
      expect(status).toBe(200)
      expect(body.data.id).toBe(id)
      expect(body.data.role).toBe(role)
      expect(body.data.landingPath).toBe(LANDING_PATHS[role])
    },
  )

  it('answers 401 UNAUTHORIZED without a token, with an unknown token and after revoke', async () => {
    const { runtime } = await boot()
    for (const token of [undefined, 'pp_unknown']) {
      const { status, body } = await me(runtime, token)
      expect(status).toBe(401)
      expect(body.error?.code).toBe('UNAUTHORIZED')
    }
    const { token } = setUser(2)
    expect((await me(runtime, token)).status).toBe(200)
    expect(sessions.revoke(token)).toBe(true)
    expect((await me(runtime, token)).status).toBe(401)
    expect(sessions.revoke(token)).toBe(false)
  })

  it('keeps an inactive user’s open session (BR-23 refuses only the login)', async () => {
    const { runtime } = await boot()
    const { token } = setUser('tidakaktif@demo.test')
    expect((await me(runtime, token)).body.data.id).toBe(11)
  })

  it('revokeAllFor ends every session of one user only', async () => {
    const { runtime } = await boot()
    const a = setUser(2).token
    const b = setUser(2).token
    const c = setUser(4).token
    expect(a).not.toBe(b)
    expect(sessions.revokeAllFor(2)).toBe(2)
    expect((await me(runtime, a)).status).toBe(401)
    expect((await me(runtime, b)).status).toBe(401)
    expect((await me(runtime, c)).status).toBe(200)
  })
})

describe('session expiry (BR-06, DATA-M01-02)', () => {
  it('a non-remember session expires 120 min after the last request (sliding)', async () => {
    const { runtime, clock } = await boot()
    const session = setUser(2)
    const start = clock.now()
    expect(session.remember).toBe(false)
    expect(toEpochMs(session.expiresAt)).toBe(start + 120 * MINUTE_MS)

    clock.advance(100 * MINUTE_MS)
    expect((await me(runtime, session.token)).status).toBe(200)
    expect(sessions.peek(session.token)?.expiresAt).toBe(start + 220 * MINUTE_MS)

    clock.advance(119 * MINUTE_MS) // 119 min after the last request
    expect((await me(runtime, session.token)).status).toBe(200)

    clock.advance(120 * MINUTE_MS) // exactly 120 min after the last request
    expect((await me(runtime, session.token)).status).toBe(401)
    expect(sessions.peek(session.token)).toBeUndefined() // expired rows are removed
  })

  it('slides at most once per minute: requests within a minute write nothing (F11-3)', async () => {
    const { runtime, clock } = await boot()
    const { token } = setUser(2)
    const start = clock.now()
    const seq = runtime.db.lastSeq

    clock.advance(30 * 1000) // 30 s after login: no slide, no commit
    expect((await me(runtime, token)).status).toBe(200)
    expect(sessions.peek(token)?.expiresAt).toBe(start + 120 * MINUTE_MS)
    expect(runtime.db.lastSeq).toBe(seq)

    clock.advance(30 * 1000) // 60 s after the last slide: one commit
    expect((await me(runtime, token)).status).toBe(200)
    expect(sessions.peek(token)?.expiresAt).toBe(start + 121 * MINUTE_MS)
    expect(runtime.db.lastSeq).toBe(seq + 1)

    // Tolerance: last activity 59 s after the slide was not recorded, so the session ends
    // 119 min 1 s after that activity (within the 1-minute tolerance).
    clock.advance(59 * 1000)
    expect((await me(runtime, token)).status).toBe(200)
    expect(runtime.db.lastSeq).toBe(seq + 1)
    clock.setNow(start + 121 * MINUTE_MS) // 119 min 1 s after that last activity
    expect((await me(runtime, token)).status).toBe(401)
  })

  it('a remember session lasts 5 calendar years and does not slide', async () => {
    const { runtime, clock } = await boot()
    const session = setUser('pelajar@demo.test', true)
    expect(session.remember).toBe(true)
    expect(session.expiresAt).toBe('2031-09-25T15:40:00+08:00')

    clock.advance(4 * 365 * DAY_MS)
    expect((await me(runtime, session.token)).status).toBe(200)
    expect(session.expiresAt).toBe('2031-09-25T15:40:00+08:00')
    expect(sessions.peek(session.token)?.expiresAt).toBe(toEpochMs('2031-09-25T15:40:00+08:00'))

    clock.setNow('2031-09-25T15:40:00+08:00')
    expect((await me(runtime, session.token)).status).toBe(401)
  })

  it('guarded routes of other modules see the resolved session (role from the user)', async () => {
    const { runtime } = await boot()
    const { token } = setUser(1)
    const resolved = runtime.server.context.transaction(() =>
      core.resolveSession?.(token, {} as never, runtime.server.context),
    )
    expect(resolved).toMatchObject({ token, userId: 1, role: 'admin', remember: false })
  })
})

describe('GET /api/me/gamification-summary (provisional)', () => {
  it('returns 0 / 0 / 0 until the wallet store exists, and 401 without a session', async () => {
    const { runtime } = await boot()
    const { token } = setUser(2)
    const res = await get(runtime, '/api/me/gamification-summary', token)
    expect(res.status).toBe(200)
    expect(res.body).toEqual({ data: { coins: 0, points: 0, streakDays: 0 } })
    expect((await get(runtime, '/api/me/gamification-summary')).status).toBe(401)
  })
})

// ---------------------------------------------------------------------------------------------
// lastLoginAt (BR-25)
// ---------------------------------------------------------------------------------------------

describe('lastLoginAt (BR-25)', () => {
  it('recordLogin sets it to the mock clock now and leaves updatedAt alone', async () => {
    const { clock } = await boot()
    clock.setNow('2026-09-25T16:05:30+08:00')
    const row = users.recordLogin(3, clock.now())
    expect(row.lastLoginAt).toBe('2026-09-25T16:05:30+08:00')
    expect(row.updatedAt).toBe('2026-02-06T09:00:00+08:00')
    expect(users.get(7)?.lastLoginAt).toBeNull() // other users unchanged
  })

  it('setUser, session resolution and GET /api/me do not change it', async () => {
    const { runtime, clock } = await boot()
    const { token } = setUser(2)
    clock.advance(10 * MINUTE_MS)
    await me(runtime, token)
    expect(users.get(2)?.lastLoginAt).toBe('2026-09-24T20:15:00+08:00')
    setUser('penaja@demo.test')
    expect(users.get(7)?.lastLoginAt).toBeNull()
  })

  it('a changed user row is persisted without any password or IC (F11-1)', async () => {
    const { runtime, clock } = await boot()
    const commits: string[] = []
    runtime.db.onCommit((e) => void commits.push(JSON.stringify(e.changes)))
    users.recordLogin(2, clock.now())
    const diff = JSON.stringify(runtime.db.diff())
    expect(diff).toContain('"lastLoginAt"')
    for (const text of [diff, ...commits]) {
      expect(text).not.toContain('Demo1234')
      expect(text).not.toContain('100101140001')
      expect(text).not.toContain('icNumber')
      // No password field (`"password":`, `"passwordHash":`); a table name such as
      // `auth.passwordResets` (M01-T1) is not a secret.
      expect(text).not.toMatch(/"password\w*"\s*:/)
    }
    expect(commits).toHaveLength(1)
  })
})

// ---------------------------------------------------------------------------------------------
// Secrets: salted one-way hashes only (F11-1, Delivery Lead decision)
// ---------------------------------------------------------------------------------------------

describe('sha256Hex', () => {
  it('matches the FIPS 180-4 vectors and node:crypto', () => {
    expect(sha256Hex('')).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855')
    expect(sha256Hex('abc')).toBe(
      'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad',
    )
    expect(sha256Hex('abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq')).toBe(
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    )
    for (const text of [
      'Demo1234',
      'x'.repeat(55),
      'y'.repeat(64),
      'z'.repeat(1000),
      'Kata é 🔒',
    ]) {
      expect(sha256Hex(text)).toBe(createHash('sha256').update(text, 'utf8').digest('hex'))
    }
  })
})

describe('user secrets (password, IC)', () => {
  it('are hashes in users.secrets, never fields of the user row or plaintext', async () => {
    const { runtime } = await boot()
    const row = users.get(2)
    expect(row).not.toHaveProperty('icNumber')
    expect(row).not.toHaveProperty('password')
    expect(
      runtime.db
        .stores()
        .map((s) => s.name)
        .sort(),
    ).toEqual(expect.arrayContaining(['auth.sessions', 'users', 'users.secrets']))
    const secrets = runtime.db.store('users.secrets') as unknown as {
      get(id: number): Record<string, unknown> | undefined
    }
    const s = secrets.get(2)
    expect(Object.keys(s ?? {}).sort()).toEqual([
      'icHash',
      'icMasked',
      'id',
      'passwordHash',
      'salt',
    ])
    expect(s).toMatchObject({ icMasked: 'xxxxxx-xx-xx01', salt: seedSalt(2) })
    expect(JSON.stringify(s)).not.toMatch(/Demo1234|100101140001/)
    expect(secrets.get(3)).toMatchObject({ icHash: null, icMasked: null })
    expect(users.icMasked(2)).toBe('xxxxxx-xx-xx01')
  })

  it('verifyPassword and verifyIc compare hashes (seeded accounts)', async () => {
    await boot()
    expect(users.verifyPassword(2, 'Demo1234')).toBe(true)
    expect(users.verifyPassword(2, 'demo1234')).toBe(false)
    expect(users.verifyIc(2, '100101140001')).toBe(true)
    expect(users.verifyIc(2, ' 100101140001 ')).toBe(true) // trimmed
    expect(users.verifyIc(2, '100101140002')).toBe(false)
    expect(users.verifyIc(3, '')).toBe(false) // no IC → never matches
    expect(users.verifyIc(3, '100101140001')).toBe(false)
    expect(users.verifyIc(99, '100101140001')).toBe(false)
  })

  it('verifyIc works for an IC set at runtime; the admin sees the mask for it', async () => {
    const { runtime } = await boot()
    users.setIcNumber(3, ' 050505050507 ')
    expect(users.verifyIc(3, '050505050507')).toBe(true)
    expect(users.verifyIc(3, '050505050505')).toBe(false)
    expect(users.icMasked(3)).toBe('xxxxxx-xx-xx07')
    expect(JSON.stringify(runtime.db.diff())).not.toContain('050505050507')

    // SEC-M02-07 deviation: fixture plaintext only while unchanged; otherwise the mask.
    expect(users.adminIcNumber(2)).toBe('100101140001')
    expect(users.adminIcNumber(3)).toBe('xxxxxx-xx-xx07')
    users.setIcNumber(2, '100101149999')
    expect(users.adminIcNumber(2)).toBe('xxxxxx-xx-xx99')
    users.setIcNumber(2, null)
    expect(users.adminIcNumber(2)).toBeNull()
    expect(users.verifyIc(2, '100101140001')).toBe(false)
  })

  it('/api/me never returns a password, IC, hash, mask or salt', async () => {
    const { runtime } = await boot()
    const res = await get(runtime, '/api/me', setUser(2).token)
    expect(JSON.stringify(res.body)).not.toMatch(
      /icNumber|100101140001|password|Hash|icMasked|xxxxxx|salt/,
    )
  })

  it('a password change is persisted as a hash and survives a reload (loadDiff)', async () => {
    const first = await boot()
    const commits: string[] = []
    first.runtime.db.onCommit((e) => void commits.push(JSON.stringify(e.changes)))
    users.setPassword(2, 'Baru1234')
    users.setIcNumber(3, '050505050505')
    const stored = first.runtime.db.diff()
    for (const text of [JSON.stringify(stored), ...commits]) {
      expect(text).not.toMatch(/Baru1234|050505050505|Demo1234/)
    }
    expect(JSON.stringify(stored['users.secrets'])).toContain('passwordHash')

    // Reload: a fresh runtime (fresh seed) + the stored diff, as F-07 hydrates it.
    const second = await boot()
    expect(users.verifyPassword(2, 'Baru1234')).toBe(false)
    second.runtime.db.loadDiff(stored)
    expect(users.verifyPassword(2, 'Baru1234')).toBe(true)
    expect(users.verifyPassword(2, 'Demo1234')).toBe(false)
    expect(users.verifyIc(2, '100101140001')).toBe(true) // IC kept when the password changes
    expect(users.verifyIc(3, '050505050505')).toBe(true)
    // The new password logs in: a session opens for the user it verifies.
    const user = users.findByEmail('pelajar@demo.test')
    expect(user && users.verifyPassword(user.id, 'Baru1234')).toBe(true)
    expect((await me(second.runtime, setUser(2).token)).status).toBe(200)
  })

  it('secret writes roll back with the transaction', async () => {
    const { runtime } = await boot()
    expect(() =>
      runtime.db.transaction(() => {
        users.setPassword(2, 'Baru1234')
        users.setIcNumber(2, '999999999999')
        throw new Error('handler failed')
      }),
    ).toThrow('handler failed')
    expect(users.verifyPassword(2, 'Demo1234')).toBe(true)
    expect(users.verifyIc(2, '100101140001')).toBe(true)
    expect(JSON.stringify(runtime.db.diff()['users.secrets'])).not.toContain('passwordHash')
  })

  it('a reset restores the fixture secrets; unknown users throw', async () => {
    const { runtime } = await boot()
    users.setPassword(2, 'Baru1234')
    await runtime.reset()
    expect(users.verifyPassword(2, 'Demo1234')).toBe(true)
    // 7000 is outside every id range of the users dataset (generated 1–6,000, runtime ≥ 9,000,001).
    expect(() => users.setPassword(7000, 'x')).toThrow('no user 7000')
    expect(() => users.setIcNumber(7000, 'x')).toThrow('no user 7000')
  })
})

// ---------------------------------------------------------------------------------------------
// Session tokens (F11-2)
// ---------------------------------------------------------------------------------------------

describe('session tokens', () => {
  it('the source is deterministic only in the e2e mode', () => {
    expect(sessionTokenSource('e2e')).toBe('deterministic')
    for (const mode of ['development', 'demo', 'test', 'production']) {
      expect(sessionTokenSource(mode)).toBe('random')
    }
  })

  it('random mode draws from crypto.getRandomValues: tokens differ between boots', async () => {
    expect(sessionTokenSource()).toBe('random') // vitest MODE = 'test'
    const spy = vi.spyOn(crypto, 'getRandomValues')
    await boot()
    const first = setUser(2).token
    expect(spy).toHaveBeenCalled()
    await boot()
    const second = setUser(2).token
    expect(first).toMatch(/^pp_[0-9A-Za-z]{40}$/)
    expect(second).not.toBe(first)
    expect(randomSessionToken()).toMatch(/^pp_[0-9A-Za-z]{40}$/)
    spy.mockRestore()
  })

  it('e2e mode keeps the deterministic stream: the same token after every boot', async () => {
    vi.stubEnv('MODE', 'e2e')
    try {
      const spy = vi.spyOn(crypto, 'getRandomValues')
      await boot()
      const first = setUser(2).token
      const next = setUser(2).token
      await boot()
      expect(setUser(2).token).toBe(first)
      expect(next).not.toBe(first)
      expect(first).toMatch(/^pp_[0-9A-Za-z]{40}$/)
      expect(spy).not.toHaveBeenCalled()
      spy.mockRestore()
    } finally {
      vi.unstubAllEnvs()
    }
  })
})

// ---------------------------------------------------------------------------------------------
// setUser hook and __MOCK_INIT__.session
// ---------------------------------------------------------------------------------------------

describe('setUser hook', () => {
  it("setUser('pelajar@demo.test') writes pp.auth {token, remember, expiresAt, user}", async () => {
    const { runtime } = await boot()
    const result = setUser('pelajar@demo.test')
    const auth = storedAuth()
    expect(auth).toEqual(result)
    expect(Object.keys(auth).sort()).toEqual(['expiresAt', 'remember', 'token', 'user'])
    expect(auth.token).toMatch(/^pp_[0-9A-Za-z]{40}$/)
    expect(auth.expiresAt).toBe('2026-09-25T17:40:00+08:00')
    expect(auth.user.id).toBe(2)
    expect((await me(runtime, auth.token)).body.data).toEqual(auth.user)
  })

  it('accepts an id, (role, id) and a trailing remember flag', async () => {
    await boot()
    expect(setUser(5).user.email).toBe('guru@demo.test')
    expect(setUser('student', 2).user.id).toBe(2)
    expect(setUser('admin', 1, true)).toMatchObject({ remember: true, user: { id: 1 } })
  })

  it('rejects unknown users, a role mismatch and bad arguments', async () => {
    await boot()
    expect(() => setUser('nobody@demo.test')).toThrow('setUser: no user "nobody@demo.test"')
    expect(() => setUser(7000)).toThrow('setUser: no user 7000')
    expect(() => setUser('admin', 2)).toThrow("user 2 has role 'student', not 'admin'")
    expect(() => setUser()).toThrow(TypeError)
    expect(() => setUser(1, 2)).toThrow(TypeError)
    expect(storage.getItem(PP_AUTH_STORAGE_KEY)).toBeNull()
  })

  it('__MOCK_INIT__.session logs in before the first request, through window.__mock.setUser', async () => {
    const target: HookTarget = { __MOCK_INIT__: { session: 'pelajar@demo.test' } }
    const clock = createClock({ at: CLOCK_ANCHOR_ISO })
    const { runtime, hooks } = await bootWithTestHooks(bootMock, {
      target,
      mode: 'test',
      plugins: CORE_PLUGINS,
      clock,
      latencyMs: 0,
    })
    const auth = storedAuth()
    expect(auth.user.email).toBe('pelajar@demo.test')
    expect(runtime.log.entries()).toHaveLength(0) // no request was needed to log in
    expect((await me(runtime, auth.token)).status).toBe(200)

    // The delegated built-in is the core hook (async from the page's view).
    const again = (await hooks.setUser('student', 4)) as ClientSession
    expect(again.user.id).toBe(4)
    expect(storedAuth().user.id).toBe(4)
    expect(hooks.names()).toContain('setUser')
  })

  it('the array form of __MOCK_INIT__.session is spread into setUser', async () => {
    const target: HookTarget = { __MOCK_INIT__: { session: ['admin', 1, true] } }
    await bootWithTestHooks(bootMock, {
      target,
      mode: 'test',
      plugins: CORE_PLUGINS,
      clock: createClock({ at: CLOCK_ANCHOR_ISO }),
      latencyMs: 0,
    })
    expect(storedAuth()).toMatchObject({ remember: true, user: { id: 1, landingPath: '/admin' } })
  })

  it('a reset re-seeds: old tokens are gone, accounts are back to their seed values', async () => {
    const { runtime, clock } = await boot()
    const { token } = setUser(2)
    users.recordLogin(2, clock.now())
    await runtime.reset()
    expect((await me(runtime, token)).status).toBe(401)
    expect(users.get(2)?.lastLoginAt).toBe('2026-09-24T20:15:00+08:00')
    expect(users.get(11)?.isActive).toBe(false)
  })
})
