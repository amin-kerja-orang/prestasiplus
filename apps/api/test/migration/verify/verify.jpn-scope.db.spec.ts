/**
 * `migrate:verify` rule for JPN officers (FIT-FIX): v2 has no `jpn_officer` role, so a staged `jpn_officer` becomes a
 * `ppd_officer` with a STATE scope taken from the state of the user's school. The scope rule of `migrate:verify` expects
 * one state scope per such officer whose school has a state, and none for one whose school has no state.
 *
 * Planted on the `cloud-tiny` fixture before the load (fictitious values): officer A at a planted school with a state but
 * NO district (a PPD officer there would get no scope, so this separates the state rule from the district rule), officer B at
 * a planted school with no state and no district. After a full apply verify passes; deleting A's scope row makes it fail.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runVerify, type VerifyReport } from '../../../src/migration/verify'
import { bootActivity, migrateAll } from './helpers-verify'
import type { ActivityHarness } from '../activity/helpers'

const CHECK = 'user_scopes rows versus admins and scoped officers'
let h: ActivityHarness
let officerA = ''
let officerB = ''

const verify = (): Promise<VerifyReport> => runVerify({ pool: h.env.pool, env: h.runEnv, source: 'cloud' })

/** Copies staged user 1 with the given overrides (every other column as user 1 has it, so the row is complete). */
async function plantOfficer(id: number, name: string, username: string, schoolId: number): Promise<void> {
  const cols = await h.q<{ column_name: string }>(
    `select column_name from information_schema.columns where table_schema = 'staging_cloud' and table_name = 'users' order by ordinal_position`,
  )
  const over: Record<string, string> = {
    id: String(id), name: `'${name}'`, email: 'null', username: `'${username}'`, ic: 'null', phone: 'null',
    role: `'jpn_officer'`, school_id: String(schoolId),
  }
  const list = cols.map((c) => `"${c.column_name}"`).join(', ')
  const exprs = cols.map((c) => over[c.column_name] ?? `"${c.column_name}"`).join(', ')
  await h.q(`insert into staging_cloud.users (${list}) select ${exprs} from staging_cloud.users where id = 1`)
}

beforeAll(async () => {
  h = await bootActivity({ core: false })
  await h.q(`insert into staging_cloud.schools (id, name, code, type, state, district, join_code, is_active, created_at)
             values (9001, 'Sekolah Tanpa Negeri', 'SC9001', 'sk', null, null, 'JOIN9001', '1', '2026-01-01T00:00:00Z'),
                    (9002, 'Sekolah Tanpa Daerah', 'SC9002', 'sk', 'Negeri C', null, 'JOIN9002', '1', '2026-01-01T00:00:00Z')`)
  officerA = '9101'
  officerB = '9102'
  await plantOfficer(9101, 'Pegawai JPN Contoh A', 'jpn_contoh_a', 9002)
  await plantOfficer(9102, 'Pegawai JPN Contoh B', 'jpn_contoh_b', 9001)
  await migrateAll(h)
}, 300_000)
afterAll(async () => {
  await h?.close()
})

const scopeOf = (legacyId: string) =>
  h.q<{ role: string; level: string; state_code: string | null; district_code: string | null; school_id: string | null }>(
    `select s.role, s.level, s.state_code, s.district_code, s.school_id::text from user_scopes s join users u on u.id = s.user_id
     where u.legacy_source = 'cloud' and u.legacy_id = $1`,
    [legacyId],
  )

describe('JPN officer state scope', () => {
  it('loads both officers as ppd_officer; only the one whose school has a state gets a state scope', async () => {
    const roles = await h.q<{ legacy_id: string; role: string }>(
      `select u.legacy_id, r.role from users u join user_roles r on r.user_id = u.id where u.legacy_source = 'cloud' and u.legacy_id in ('9101','9102') order by 1`,
    )
    expect(roles).toEqual([{ legacy_id: officerA, role: 'ppd_officer' }, { legacy_id: officerB, role: 'ppd_officer' }])
    const state = (await h.q<{ state: string }>(`select s.state from schools s where s.legacy_source = 'cloud' and s.legacy_id = '9002'`))[0]?.state
    expect(state).toBeTruthy()
    expect(await scopeOf(officerA)).toEqual([{ role: 'ppd_officer', level: 'state', state_code: state, district_code: null, school_id: null }])
    expect(await scopeOf(officerB)).toEqual([])
  })

  it('verify passes: one state scope for officer A, none for officer B', async () => {
    const report = await verify()
    const bad = report.checks.filter((c) => c.status === 'mismatch').map((c) => `${c.name}: ${c.detail ?? ''}`)
    expect(bad).toEqual([])
    expect(report.checks.find((c) => c.name === CHECK)?.status).toBe('ok')
    expect(report.status).toBe('pass')
  })

  it('verify fails when the state scope of officer A is missing', async () => {
    const before = (await verify()).checks.find((c) => c.name === CHECK)
    await h.q(`delete from user_scopes where user_id = (select id from users where legacy_source = 'cloud' and legacy_id = $1)`, [officerA])
    const report = await verify()
    const c = report.checks.find((x) => x.name === CHECK)
    expect(c?.status).toBe('mismatch')
    expect(Number(c?.expected)).toBe(Number(before?.expected))
    expect(Number(c?.actual)).toBe(Number(before?.expected) - 1)
    expect(report.status).toBe('fail')
  })
})
