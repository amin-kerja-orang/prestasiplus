import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { createPrismaClient, type PrismaClient } from '../../src/db/client'
import {
  BOOTSTRAP_AUDIT,
  HOST_ACTOR_ROLE,
  parseBootstrapArgs,
  passwordFromStdin,
  passwordProblem,
  RefusedError,
  runAdminBootstrap,
  UsageError,
  type BootstrapInput,
} from '../../src/ops/admin-bootstrap/admin-bootstrap'
import { COOKIE_NAME, DEMO_PASSWORD, bootAuthApp, expectError, loginAs, type AuthTestApp, userIdOf } from '../auth/helpers'

/**
 * AZ-36: the host-only Admin Pusat bootstrap / reset command. The demo identity seed has exactly one Admin Pusat
 * (`admin@demo.test`), which is the "locked-out last admin" of these tests.
 */
const API_DIR = fileURLToPath(new URL('../../', import.meta.url))
const ADMIN = 'admin@demo.test'
const NEW_PASSWORD = 'Baru-Kuat-2026!x'
const OK_ARGS = ['--mode=reset', `--email=${ADMIN}`, `--confirm=${ADMIN}`]

describe('argument parsing (no database)', () => {
  it.each([
    ['--password=Rahsia-123456'],
    ['--password', 'Rahsia-123456'],
    ['--pass=Rahsia-123456'],
    ['--pwd=Rahsia-123456'],
    ['--pw=Rahsia-123456'],
    ['--new-password=Rahsia-123456'],
    ['--secret=Rahsia-123456'],
    ['-p', 'Rahsia-123456'],
    ['Rahsia-123456'],
  ])('refuses a password on argv (%s) without echoing it', (...extra) => {
    const attempt = () => parseBootstrapArgs([...OK_ARGS, ...extra])
    expect(attempt).toThrow(UsageError)
    try {
      attempt()
    } catch (e) {
      expect((e as Error).message).not.toContain('Rahsia')
    }
  })

  it('refuses without the explicit confirm flag, or when it names another e-mail', () => {
    expect(() => parseBootstrapArgs(['--mode=reset', `--email=${ADMIN}`])).toThrow(/--confirm/)
    expect(() => parseBootstrapArgs(['--mode=reset', `--email=${ADMIN}`, '--confirm'])).toThrow(UsageError)
    expect(() => parseBootstrapArgs(['--mode=reset', `--email=${ADMIN}`, '--confirm=lain@demo.test'])).toThrow(/repeat --email/)
  })

  it('validates mode, e-mail and the mode-specific flags', () => {
    expect(() => parseBootstrapArgs([`--email=${ADMIN}`, `--confirm=${ADMIN}`])).toThrow(/--mode/)
    expect(() => parseBootstrapArgs(['--mode=delete', `--email=${ADMIN}`, `--confirm=${ADMIN}`])).toThrow(/create or reset/)
    expect(() => parseBootstrapArgs(['--mode=reset', '--email=bukan-emel', '--confirm=bukan-emel'])).toThrow(/valid e-mail/)
    expect(() => parseBootstrapArgs(['--mode=create', `--email=${ADMIN}`, `--confirm=${ADMIN}`, '--reactivate'])).toThrow(/only for --mode=reset/)
    expect(() => parseBootstrapArgs([...OK_ARGS, '--name=X'])).toThrow(/only for --mode=create/)
    expect(() => parseBootstrapArgs([...OK_ARGS, '--Rahsia123'])).toThrow(/^Unknown flag \(see the usage below\)\.$/)
    expect(() => parseBootstrapArgs([...OK_ARGS, '--mode=reset'])).toThrow(/twice/)
    expect(parseBootstrapArgs(['--help'])).toBeNull()
  })

  it('parses both spellings of a value flag', () => {
    expect(parseBootstrapArgs(['--mode', 'create', '--email', 'baru@demo.test', '--confirm', 'baru@demo.test', '--name', 'Admin Kedua', '--password-stdin'])).toEqual({
      mode: 'create',
      email: 'baru@demo.test',
      name: 'Admin Kedua',
      passwordStdin: true,
      reactivate: false,
    })
    expect(parseBootstrapArgs([...OK_ARGS, '--reactivate'])).toMatchObject({ mode: 'reset', name: 'Admin Pusat', passwordStdin: false, reactivate: true })
  })

  it('password rules and the one-line standard input', () => {
    expect(passwordProblem('pendek', ADMIN)).toMatch(/at least 12/)
    expect(passwordProblem('x'.repeat(256), ADMIN)).toMatch(/at most 255/)
    expect(passwordProblem(' Baru-Kuat-2026', ADMIN)).toMatch(/space/)
    expect(passwordProblem('admin-Kuat-2026', ADMIN)).toMatch(/e-mail name/)
    expect(passwordProblem(NEW_PASSWORD, ADMIN)).toBeNull()
    expect(passwordFromStdin(`${NEW_PASSWORD}\n`)).toBe(NEW_PASSWORD)
    expect(passwordFromStdin(`${NEW_PASSWORD}\r\n`)).toBe(NEW_PASSWORD)
    expect(() => passwordFromStdin(`${NEW_PASSWORD}\nkedua\n`)).toThrow(/one line/)
    expect(passwordFromStdin(`\uFEFF${NEW_PASSWORD}\n`)).toBe(NEW_PASSWORD)
    expect(() => passwordFromStdin('x'.repeat(2000))).toThrow(/too long/)
  })
})

describe('host only: no HTTP route reaches the command', () => {
  it('nothing outside src/ops/admin-bootstrap imports it', () => {
    const src = join(API_DIR, 'src')
    const offenders: string[] = []
    const walk = (dir: string): void => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name)
        if (statSync(path).isDirectory()) {
          if (path === join(src, 'ops', 'admin-bootstrap') || path === join(src, 'db', 'generated')) continue
          walk(path)
        } else if (path.endsWith('.ts') && /(from|import\()\s*['"][^'"]*ops\/admin-bootstrap/.test(readFileSync(path, 'utf8'))) offenders.push(relative(API_DIR, path))
      }
    }
    walk(src)
    expect(offenders).toEqual([])
  })
})

describe('bootstrap / reset against the database', () => {
  let t: AuthTestApp
  let prisma: PrismaClient
  let adminId: string

  const input = (over: Partial<BootstrapInput> = {}): BootstrapInput => ({
    mode: 'reset',
    email: ADMIN,
    name: 'Admin Pusat',
    passwordStdin: true,
    reactivate: false,
    password: NEW_PASSWORD,
    now: new Date('2026-10-19T01:30:00Z'),
    hostUser: 'ppdeploy',
    ...over,
  })
  const auditRows = () =>
    t.db.query<{ action: string; actor_user_id: string | null; actor_role: string; target_type: string; target_id: string; scope_level: string; detail: Record<string, unknown> }>(
      `select action, actor_user_id::text, actor_role, target_type, target_id, scope_level, detail from audit_events where action like 'admin.bootstrap.%' order by id`,
    )
  const userRow = async (email: string) =>
    (
      await t.db.query<{ id: string; password_hash: string; must_reset_password: boolean; is_active: boolean; is_suspended: boolean }>(
        `select id::text, password_hash, must_reset_password, is_active, is_suspended from users where lower(email) = lower($1)`,
        [email],
      )
    )[0]

  beforeAll(async () => {
    t = await bootAuthApp()
    prisma = createPrismaClient(t.db.url)
    adminId = await userIdOf(t.db, ADMIN)
  }, 120_000)
  afterAll(async () => {
    await prisma.$disconnect()
    await t.close()
  })

  describe('refusals write nothing', () => {
    beforeEach(async () => {
      expect(await auditRows()).toEqual([])
    })

    it('create is refused while an active Admin Pusat exists', async () => {
      const before = await t.db.query(`select count(*)::int as n from users`)
      await expect(runAdminBootstrap(prisma, input({ mode: 'create', email: 'pusat.kedua@demo.test' }))).rejects.toThrow(RefusedError)
      expect(await t.db.query(`select count(*)::int as n from users`)).toEqual(before)
    })

    it('reset is refused while ANOTHER active Admin Pusat exists (that admin resets it on the screen)', async () => {
      const other = await userIdOf(t.db, 'guruadmin@demo.test')
      await t.db.query(`insert into user_roles (user_id, role) values ($1::bigint, 'admin')`, [other])
      try {
        const hashBefore = (await userRow(ADMIN))?.password_hash
        await expect(runAdminBootstrap(prisma, input())).rejects.toThrow(/another active Admin Pusat/)
        expect((await userRow(ADMIN))?.password_hash).toBe(hashBefore)
      } finally {
        await t.db.query(`delete from user_roles where user_id = $1::bigint and role = 'admin'`, [other])
      }
    })

    it('reset is refused for an e-mail that is not an Admin Pusat, and for an unknown e-mail', async () => {
      await expect(runAdminBootstrap(prisma, input({ email: 'guru@demo.test' }))).rejects.toThrow(/no Admin Pusat account/)
      await expect(runAdminBootstrap(prisma, input({ email: 'tiada@demo.test' }))).rejects.toThrow(/no Admin Pusat account/)
    })

    it('a weak password is refused before any write', async () => {
      await expect(runAdminBootstrap(prisma, input({ password: 'pendek' }))).rejects.toThrow(UsageError)
    })

    it('an inactive or suspended last admin is refused without --reactivate', async () => {
      await t.db.query(`update users set is_suspended = true where id = $1::bigint`, [adminId])
      try {
        await expect(runAdminBootstrap(prisma, input())).rejects.toThrow(/--reactivate/)
      } finally {
        await t.db.query(`update users set is_suspended = false where id = $1::bigint`, [adminId])
      }
    })
  })

  it('reset of the locked-out last admin: argon2id hash, forced change at next login, sessions ended, one audit row', async () => {
    const before = await loginAs(t, ADMIN)
    expect(before.session.mustChangePassword).toBe(false)

    // An earlier e-mail reset link (for example one an intruder holds) must be spent by the recovery.
    await t.db.query(`insert into password_resets (user_id, token_hash, channel, expires_at) values ($1::bigint, 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa', 'email', now() + interval '1 hour')`, [adminId])

    const out = await runAdminBootstrap(prisma, input())
    expect(out).toEqual({ mode: 'reset', userId: adminId, sessionsRevoked: 1, resetTokensSpent: 1, reactivated: false })
    expect(await t.db.query(`select used_at is not null as used from password_resets where token_hash = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'`)).toEqual([{ used: true }])

    const row = await userRow(ADMIN)
    expect(row?.password_hash.startsWith('$argon2id$')).toBe(true)
    expect(row?.must_reset_password).toBe(true)

    // The old session is over; the old password no longer works; the new one signs in but must be changed first.
    expectError(await t.http().get('/api/session').set('Cookie', `${COOKIE_NAME}=${before.token}`), 'UNAUTHORIZED')
    expect((await t.http().post('/api/auth/login').send({ identifier: ADMIN, password: DEMO_PASSWORD, remember: false })).status).toBe(401)
    const after = await loginAs(t, ADMIN, { password: NEW_PASSWORD })
    expect(after.session.mustChangePassword).toBe(true)
    expectError(await after.agent.post('/api/session/role').set('X-CSRF-Token', after.csrf).send({ role: 'admin' }), 'PASSWORD_CHANGE_REQUIRED')

    const audit = await auditRows()
    expect(audit).toHaveLength(1)
    expect(audit[0]).toMatchObject({
      action: BOOTSTRAP_AUDIT.RESET,
      actor_user_id: null,
      actor_role: HOST_ACTOR_ROLE,
      target_type: 'user',
      target_id: adminId,
      scope_level: 'national',
      detail: { mode: 'reset', hostUser: 'ppdeploy', mustChangePassword: true, sessionsRevoked: 1, resetTokensSpent: 1, reactivated: false, activeAdminsBefore: 1 },
    })
    const raw = JSON.stringify(audit[0])
    for (const secret of [NEW_PASSWORD, ADMIN, '$argon2']) expect(raw).not.toContain(secret)
  })

  it('reset with --reactivate brings back a suspended last admin, and says so in the audit row', async () => {
    await t.db.query(`update users set is_active = false where id = $1::bigint`, [adminId])
    const out = await runAdminBootstrap(prisma, input({ reactivate: true, password: 'Lain-Kuat-2026!y' }))
    expect(out.reactivated).toBe(true)
    expect(await userRow(ADMIN)).toMatchObject({ is_active: true, is_suspended: false, must_reset_password: true })
    expect((await auditRows()).at(-1)?.detail).toMatchObject({ reactivated: true, activeAdminsBefore: 0 })
  })

  it('create, when no active Admin Pusat exists: a national admin that must change its password', async () => {
    await t.db.query(`update users set is_active = false where id = $1::bigint`, [adminId])
    await expect(runAdminBootstrap(prisma, input({ mode: 'create', email: 'guru@demo.test' }))).rejects.toThrow(/already exists/)

    const out = await runAdminBootstrap(prisma, input({ mode: 'create', email: 'pusat.baru@demo.test', name: 'Admin Pusat Baru' }))
    expect(out).toMatchObject({ mode: 'create', sessionsRevoked: 0, reactivated: false })
    const roles = await t.db.query(`select role from user_roles where user_id = $1::bigint`, [out.userId])
    expect(roles).toEqual([{ role: 'admin' }])
    const scope = await t.db.query(`select role, level, school_id, state_code from user_scopes where user_id = $1::bigint`, [out.userId])
    expect(scope).toEqual([{ role: 'admin', level: 'national', school_id: null, state_code: null }])

    const me = await loginAs(t, 'pusat.baru@demo.test', { password: NEW_PASSWORD })
    expect(me.session.mustChangePassword).toBe(true)
    expect((await auditRows()).at(-1)).toMatchObject({ action: BOOTSTRAP_AUDIT.CREATED, target_id: out.userId, actor_role: HOST_ACTOR_ROLE })

    // A second create is refused now that an active admin exists again.
    await expect(runAdminBootstrap(prisma, input({ mode: 'create', email: 'ketiga@demo.test' }))).rejects.toThrow(/already exists/)
  })

  describe('the CLI process (tsx, as the host runs it)', () => {
    const cli = (args: string[], stdin?: string) =>
      spawnSync(process.execPath, ['--import', 'tsx', 'src/ops/admin-bootstrap/cli.ts', ...args], {
        cwd: API_DIR,
        input: stdin ?? '',
        encoding: 'utf8',
        env: { ...process.env, DATABASE_URL: t.db.url },
        timeout: 60_000,
      })

    it('exit 2 on a password argument, without printing it', () => {
      const r = cli(['--mode=reset', '--email=pusat.baru@demo.test', '--confirm=pusat.baru@demo.test', '--password=Rahsia-Sangat-99'])
      expect(r.status).toBe(2)
      expect(`${r.stdout}${r.stderr}`).not.toContain('Rahsia-Sangat-99')
    })

    it('exit 2 without the confirm flag, and without a terminal unless --password-stdin', () => {
      expect(cli(['--mode=reset', '--email=pusat.baru@demo.test']).status).toBe(2)
      const r = cli(['--mode=reset', '--email=pusat.baru@demo.test', '--confirm=pusat.baru@demo.test'], `${NEW_PASSWORD}\n`)
      expect(r.status).toBe(2)
      expect(r.stderr).toMatch(/--password-stdin/)
    })

    it('exit 3 when the state refuses, exit 0 on a real reset from standard input', async () => {
      // pusat.baru is the only active admin now (the seeded one was deactivated above).
      expect(cli(['--mode=create', '--email=empat@demo.test', '--confirm=empat@demo.test', '--password-stdin'], `${NEW_PASSWORD}\n`).status).toBe(3)
      const r = cli(['--mode=reset', '--email=pusat.baru@demo.test', '--confirm=pusat.baru@demo.test', '--password-stdin'], 'Ketiga-Kuat-2026!z\n')
      expect(r.stderr).toMatch(/OK reset/)
      expect(r.status).toBe(0)
      expect(`${r.stdout}${r.stderr}`).not.toContain('Ketiga-Kuat-2026!z')
      await loginAs(t, 'pusat.baru@demo.test', { password: 'Ketiga-Kuat-2026!z' })
    }, 120_000)
  })
})
