/**
 * KP-18 perf: the Databank now counts and orders from an in-memory snapshot of the servable set. This spec holds the PREVIOUS per-request aggregate
 * (the `units` CTE over the servable scope) as an oracle and requires the same totals, unit order and tiles, for every subject, for searches, and for every page.
 */
import { DATABANK_PAGE_SIZE } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { questionPoolSeed } from '../../prisma/seed/questions/pool'
import { questionsSeed } from '../../prisma/seed/questions'
import { Prisma } from '../../src/db/generated/client'
import { PrismaService } from '../../src/db/prisma.service'
import { DatabankModule } from '../../src/modules/classes/teacher-tools/databank.module'
import { DatabankService } from '../../src/modules/classes/teacher-tools/databank.service'
import { QuestionsModule, QuestionsRepository } from '../../src/modules/questions'
import { bootClassesApp, type ClassesTestApp } from './helpers'

const TINGKATAN = Prisma.sql`EXISTS (SELECT 1 FROM education_levels dl WHERE dl.id = v.education_level_id AND dl.code ~ '^T[1-5]$' AND dl.stage <> 'primary' AND dl.is_active)`
const ACTIVE = Prisma.sql`EXISTS (SELECT 1 FROM subjects ds WHERE ds.id = v.subject_id AND ds.is_active)`
const like = (s: string): string => `%${s.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`

describe('Databank snapshot equals the per-request aggregate (oracle)', () => {
  let t: ClassesTestApp
  let service: DatabankService
  let prisma: PrismaService
  let bank: QuestionsRepository

  beforeAll(async () => {
    t = await bootClassesApp({ seeds: [questionsSeed, questionPoolSeed], modules: [QuestionsModule, DatabankModule] })
    service = t.get(DatabankService)
    prisma = t.get(PrismaService)
    bank = t.get(QuestionsRepository)
  }, 600_000)
  afterAll(async () => {
    await t.close()
  })

  const oracleUnits = async (subjectId: string | null, search: string | null): Promise<{ keys: string[]; members: number }> => {
    const scope = bank.scopeSql({ status: 'approved', active: true, wholeGroups: true }, true)
    const subject = subjectId === null ? Prisma.empty : Prisma.sql`AND v.subject_id = ${BigInt(subjectId)}`
    const hit = search === null ? Prisma.sql`TRUE` : Prisma.sql`(v.stem_ms ILIKE ${like(search)} ESCAPE '\' OR v.stem_en ILIKE ${like(search)} ESCAPE '\')`
    const rows = await prisma.client.$queryRaw<{ unit_key: string; members: number }[]>(Prisma.sql`
      WITH s AS (
        SELECT q.id, CASE WHEN q.group_id IS NULL THEN 'q' || q.id ELSE 'g' || q.group_id END AS unit_key, ${hit} AS hit
          ${scope.from} WHERE ${scope.where} AND ${TINGKATAN} AND ${ACTIVE} ${subject}
      ), u AS (SELECT unit_key, max(id) AS newest, count(*)::int AS members FROM s GROUP BY unit_key HAVING bool_or(hit))
      SELECT unit_key, members FROM u ORDER BY newest DESC, unit_key`)
    return { keys: rows.map((r) => r.unit_key), members: rows.reduce((n, r) => n + r.members, 0) }
  }

  const walk = async (subjectId: string | null, search: string | null) => {
    const query = { ...(subjectId ? { subjectId } : {}), ...(search ? { q: search } : {}) }
    const first = await service.questions(query)
    const keys = first.data.map((u) => u.unitId)
    for (let page = 2; page <= first.meta.totalPages; page++) keys.push(...(await service.questions({ ...query, page: String(page) })).data.map((u) => u.unitId))
    return { first, keys }
  }

  it('overview tiles, and for every subject and search the unit totals, member totals and the order of every page', async () => {
    const tiles = await service.overview()
    const subjects = [...tiles.teras, ...tiles.elektif]
    const oracleTotal = (await oracleUnits(null, null)).members
    expect(tiles.totalQuestions).toBe(oracleTotal)
    for (const tile of subjects) expect(tile.count, tile.nameMs).toBe((await oracleUnits(tile.subjectId, null)).members)
    const cases: [string | null, string | null][] = [[null, null], ...subjects.filter((s) => s.count > 0).map((s): [string, null] => [s.subjectId, null]), [null, 'Pasar tani'], [null, 'PASAR'], [null, 'zzzz-tiada-padanan'], [null, '__']]
    for (const [subjectId, search] of cases) {
      const want = await oracleUnits(subjectId, search)
      const got = await walk(subjectId, search)
      expect(got.first.meta.totalUnits, `${subjectId} ${search}`).toBe(want.keys.length)
      expect(got.first.meta.totalQuestions, `${subjectId} ${search}`).toBe(want.members)
      expect(got.keys, `${subjectId} ${search}`).toEqual(want.keys.slice(0, got.keys.length))
      expect(got.keys.length).toBe(want.keys.length)
      expect(DATABANK_PAGE_SIZE).toBeGreaterThan(0)
    }
  })
})
