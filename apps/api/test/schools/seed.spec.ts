import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { DEMO_SCHOOLS, identitySeed } from '../../prisma/seed/core/identity'
import { EXTRA_SCHOOLS, ppdName, schoolsSeed } from '../../prisma/seed/core/schools'
import { createTestDatabase, type TestDatabase } from '../support/db'

describe('core schools seed (AC 11)', () => {
  let db: TestDatabase

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })
  })
  afterAll(async () => {
    await db.drop()
  })

  const counts = async () => ({
    schools: (await db.query(`select 1 from schools`)).length,
    jpns: (await db.query(`select 1 from jpns`)).length,
    ppds: (await db.query(`select 1 from ppds`)).length,
  })

  it('seeds the demo schools plus extras across 2 states', async () => {
    const c = await counts()
    expect(c.schools).toBe(DEMO_SCHOOLS.length + EXTRA_SCHOOLS.length)
    expect(await db.query(`select distinct state from schools`)).toHaveLength(2)
  })

  it('has one JPN per state and one PPD per district, ppds.code = district', async () => {
    const states = await db.query<{ n: number }>(`select count(distinct state)::int as n from schools`)
    const districts = await db.query<{ n: number }>(`select count(distinct district)::int as n from schools`)
    const c = await counts()
    expect(c.jpns).toBe(states[0]!.n)
    expect(c.ppds).toBe(districts[0]!.n)
    const jpns = await db.query<{ code: string; name: string }>(`select code, name from jpns order by code`)
    expect(jpns).toEqual([
      { code: 'JHR', name: 'Johor' },
      { code: 'SGR', name: 'Selangor' },
    ])
    const orphans = await db.query(
      `select 1 from (select distinct district from schools) d where d.district not in (select code from ppds)`,
    )
    expect(orphans).toEqual([])
    const wrongJpn = await db.query(
      `select 1 from ppds p join jpns j on j.id = p.jpn_id
        where not exists (select 1 from schools s where s.district = p.code and s.state = j.name)`,
    )
    expect(wrongJpn).toEqual([])
  })

  it('resolves every school to one JPN and one PPD of its own state and district', async () => {
    const rows = await db.query(
      `select s.code from schools s
         left join ppds p on p.id = s.ppd_id left join jpns j on j.id = s.jpn_id
        where p.id is null or j.id is null or p.code <> s.district or j.name <> s.state or p.jpn_id <> j.id`,
    )
    expect(rows).toEqual([])
  })

  it('completes the BE-03 demo schools and keeps their accounts', async () => {
    const rows = await db.query<{ code: string; type: string; join_code: string; users: number }>(
      `select s.code, s.type, s.join_code, (select count(*)::int from users u where u.school_id = s.id) as users
         from schools s where s.code in ('DEMO001','DEMO002') order by s.code`,
    )
    expect(rows.map((r) => r.type)).toEqual(['SMK', 'SK'])
    expect(rows.every((r) => r.join_code)).toBe(true)
    expect(rows[0]!.users).toBeGreaterThan(0)
  })

  it('sets no legacy columns', async () => {
    for (const t of ['schools', 'jpns', 'ppds']) {
      const r = await db.query(`select 1 from ${t} where legacy_source is not null or legacy_id is not null`)
      expect(r).toEqual([])
    }
  })

  it('is idempotent', async () => {
    const before = await counts()
    const snap = await db.query(`select code, type, join_code, jpn_id, ppd_id from schools order by code`)
    await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })
    expect(await counts()).toEqual(before)
    expect(await db.query(`select code, type, join_code, jpn_id, ppd_id from schools order by code`)).toEqual(snap)
  })

  it('titles the PPD display name', () => {
    expect(ppdName('PPD JOHOR BAHRU')).toBe('PPD Johor Bahru')
    expect(ppdName('Petaling')).toBe('Petaling')
  })
})
