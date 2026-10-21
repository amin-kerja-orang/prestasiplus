import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds, seedModules } from '../../prisma/seed'
import { featureModules } from '../../src/modules'
import { bootSchoolAdminApp, DEMO_PASSWORD, expectError, login, type SchoolAdminTestApp } from '../school-admin/helpers'

const DOC = fileURLToPath(new URL('../../../../docs/AKAUN-DEMO.md', import.meta.url))
const DEMO_ACCOUNTS = [...new Set([...readFileSync(DOC, 'utf8').matchAll(/`([a-z0-9._-]+@demo\.test)`/g)].map((m) => m[1] as string))].sort()

describe('PoC profile: every demo account of docs/AKAUN-DEMO.md', () => {
  let t: SchoolAdminTestApp
  beforeAll(async () => {
    t = await bootSchoolAdminApp({ modules: featureModules })
    await runSeeds(seedModules, { prisma: t.db.prisma, profile: 'poc', env: { NODE_ENV: 'test' } })
  }, 240_000)
  afterAll(async () => {
    await t.close()
  })

  it('parses the account list from the document', () => {
    expect(DEMO_ACCOUNTS).toEqual(
      expect.arrayContaining(['pelajar@demo.test', 'pelajarmaju@demo.test', 'pelajar2@demo.test', 'guru@demo.test', 'adminsekolah@demo.test', 'admin@demo.test', 'tidakaktif@demo.test']),
    )
    expect(DEMO_ACCOUNTS.length).toBeGreaterThanOrEqual(11)
  })

  const INACTIVE = 'tidakaktif@demo.test'

  it('every listed account logs in, except the documented inactive one which is refused', async () => {
    for (const email of DEMO_ACCOUNTS.filter((e) => e !== INACTIVE)) {
      const me = await login(t, email)
      expect(me.session.user.email, email).toBe(email)
    }
    expectError(await t.http().post('/api/auth/login').send({ identifier: INACTIVE, password: DEMO_PASSWORD }), 'ACCOUNT_INACTIVE')
  })

  const read = async (email: string, path: string): Promise<unknown> => {
    const me = await login(t, email)
    const res = await me.agent.get(path)
    expect(res.status, `${email} ${path}: ${JSON.stringify(res.body).slice(0, 200)}`).toBe(200)
    return res.body.data
  }

  it('students with data have practice history; the empty demo student has an empty history', async () => {
    for (const email of ['pelajar@demo.test', 'pelajarmaju@demo.test']) {
      const rows = (await read(email, '/api/practice/history')) as unknown[]
      expect(rows.length, email).toBeGreaterThan(0)
    }
    expect(await read('pelajar2@demo.test', '/api/practice/history')).toEqual([])
  })

  it('the teacher has classes with rosters', async () => {
    expect(((await read('guru@demo.test', '/api/guru/classes')) as unknown[]).length).toBeGreaterThan(0)
    expect(((await read('guru@demo.test', '/api/guru/students')) as unknown[]).length).toBeGreaterThan(0)
  })

  it('the school admin has a school with pupils and active classes', async () => {
    const d = (await read('adminsekolah@demo.test', '/api/admin-sekolah/dashboard')) as { school: { code: string }; cards: { pupils: number; activeClasses: number } }
    expect(d.school.code).toBe('DEMO001')
    expect(d.cards.pupils).toBeGreaterThan(0)
    expect(d.cards.activeClasses).toBeGreaterThan(0)
  })

  it('the parent, sponsor, PPD and JPN accounts each complete a read with their own role (out of PoC scope, D43/D48)', async () => {
    for (const [email, role] of [
      ['ibubapa@demo.test', 'parent'],
      ['penaja@demo.test', 'sponsor'],
      ['ppd@demo.test', 'ppd_officer'],
      ['jpn@demo.test', 'ppd_officer'],
    ] as const) {
      const session = (await read(email, '/api/session')) as { active: { role: string } }
      expect(session.active.role, email).toBe(role)
      expect(await read(email, '/api/me/notifications/unread-count'), email).toBeDefined()
    }
  })

  it('the admin sees non-empty aggregates over several schools', async () => {
    const d = (await read('admin@demo.test', '/api/monitoring/overview')) as { kpi: { schools: number; students: number; answers: number } }
    expect(d.kpi.schools).toBeGreaterThan(1)
    expect(d.kpi.students).toBeGreaterThan(0)
    expect(d.kpi.answers).toBeGreaterThan(0)
  })
})
