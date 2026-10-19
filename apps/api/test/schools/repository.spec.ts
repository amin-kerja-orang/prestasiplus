import { Test } from '@nestjs/testing'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { defineAppModule } from '../../src/app.module'
import { PrismaService } from '../../src/db/prisma.service'
import { SchoolsModule, SchoolsRepository } from '../../src/modules/schools'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { schoolIdOf } from '../auth/helpers'

describe('SchoolsRepository (the interface other modules use)', () => {
  let db: TestDatabase
  let repo: SchoolsRepository
  let prisma: PrismaService
  let close: () => Promise<void>

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })
    process.env.DATABASE_URL = db.url
    process.env.SESSION_SECRET = 'test-secret-0123456789abcdef'
    const ref = await Test.createTestingModule({ imports: [defineAppModule([SchoolsModule])] }).compile()
    await ref.init()
    repo = ref.get(SchoolsRepository)
    prisma = ref.get(PrismaService)
    close = () => ref.close()
  })
  afterAll(async () => {
    await close()
    await db.drop()
  })

  it('get returns the row with string ids and the join code; null for unknown or malformed ids', async () => {
    const id = await schoolIdOf(db, 'DEMO001')
    const row = await repo.get(id)
    expect(row).toMatchObject({ id, name: 'SMK Demo Satu', code: 'DEMO001', type: 'SMK', state: 'Selangor', isActive: true })
    expect(typeof row?.jpnId).toBe('string')
    expect(typeof row?.ppdId).toBe('string')
    for (const bad of ['999999', 'abc', '', '-1', '1.5', '99999999999999999999999', '007']) {
      expect(await repo.get(bad), bad).toBeNull()
    }
  })

  it('exists and getMany skip unknown and malformed ids', async () => {
    const a = await schoolIdOf(db, 'DEMO001')
    const b = await schoolIdOf(db, 'DEMO002')
    expect(await repo.exists(a)).toBe(true)
    expect(await repo.exists('999999')).toBe(false)
    expect(await repo.exists('abc')).toBe(false)
    const many = await repo.getMany([a, b, a, 'abc', '999999'])
    expect(many.map((r) => r.id).sort()).toEqual([a, b].sort())
    expect(await repo.getMany([])).toEqual([])
  })

  it('options lists every school by name; search lists only active ones and caps by limit', async () => {
    expect((await repo.options()).map((o) => o.name)).toEqual(['SJK(C) Demo Empat', 'SK Demo Dua', 'SK Demo Tiga', 'SMK Demo Satu'])
    await db.query(`update schools set is_active = false where code = 'DEMO003'`)
    expect((await repo.search({ limit: 10 })).map((s) => s.code)).toEqual(['DEMO004', 'DEMO002', 'DEMO001'])
    expect((await repo.search({ limit: 2 })).length).toBe(2)
    expect(await repo.search({ limit: 10, id: (await schoolIdOf(db, 'DEMO003')) })).toEqual([])
    expect((await repo.search({ limit: 10, q: 'satu' })).map((s) => s.code)).toEqual(['DEMO001'])
    expect(Object.keys((await repo.search({ limit: 1 }))[0] as object)).not.toContain('joinCode')
  })

  it('findByCode is trimmed and case-insensitive; a blank code never matches', async () => {
    expect((await repo.findByCode(' demo002 '))?.code).toBe('DEMO002')
    expect(await repo.findByCode('')).toBeNull()
    expect(await repo.findByCode('   ')).toBeNull()
    expect(await repo.findByCode('DEMO00')).toBeNull()
  })

  it('works inside a transaction of the caller and rolls back with it', async () => {
    const id = await schoolIdOf(db, 'DEMO002')
    await expect(
      prisma.transaction(async () => {
        expect(await repo.toggle(id, new Date())).toBe(false)
        expect((await repo.get(id))?.isActive).toBe(false)
        throw new Error('roll back')
      }),
    ).rejects.toThrow('roll back')
    expect((await repo.get(id))?.isActive).toBe(true)
  })

  it('memberCounts counts students and teachers per school (zero for a school without users)', async () => {
    const ids = [await schoolIdOf(db, 'DEMO001'), await schoolIdOf(db, 'DEMO002'), await schoolIdOf(db, 'DEMO004')]
    const counts = await repo.memberCounts([...ids, 'abc'])
    expect(counts.get(ids[0] as string)).toEqual({ studentCount: 5, teacherCount: 2 })
    expect(counts.get(ids[1] as string)).toEqual({ studentCount: 1, teacherCount: 0 })
    expect(counts.get(ids[2] as string)).toEqual({ studentCount: 0, teacherCount: 0 })
  })

  it('ppdList returns null for an unknown JPN, [] is not confused with it', async () => {
    expect(await repo.ppdList('999999')).toBeNull()
    expect(await repo.ppdList('abc')).toBeNull()
    const jpns = await repo.jpnList()
    expect(jpns.length).toBeGreaterThan(0)
    expect((await repo.ppdList(jpns[0]?.id as string))?.length).toBeGreaterThan(0)
  })
})
