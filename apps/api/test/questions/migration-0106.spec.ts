import { QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

/**
 * R1 perf, migration 0106 (T54 F3): pg_trgm and two partial GIN indexes on question_versions.stem_ms / stem_en for the admin list search.
 * The test database already ran the migration. The spec checks the objects, that the list search still returns exactly the right rows
 * (case-insensitive, % and _ literal, both stems, short terms), and that the planner uses the indexes for the same predicate text the
 * repository writes (a tiny table prefers a scan, so the plan is checked with sequential scans disabled inside one transaction).
 */
describe('migration 0106 question stem trigram indexes', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  const ids: Record<string, string> = {}

  const make = async (key: string, stemMs: string, stemEn: string | null): Promise<void> => {
    const res = await admin.post('/api/questions', mcqBody(refs, { questionText: stemMs }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    ids[key] = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    await t.db.query(`update question_versions set stem_en = $2 where question_id = $1`, [ids[key], stemEn])
  }

  beforeAll(async () => {
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    await make('log', 'Selesaikan persamaan logaritma berikut dengan teliti.', null)
    await make('en', 'Solve the following equation carefully for x.', 'Solve the logarithm equation below')
    await make('pct', 'Diskaun sebanyak 50% diberikan kepada pelanggan.', null)
    await make('us', 'Pemboleh ubah_pertama dan kedua dalam soalan ini.', null)
  })
  afterAll(async () => {
    await t.close()
  })

  it('the extension and both partial trigram indexes exist', async () => {
    expect((await t.db.query<{ extname: string }>(`select extname from pg_extension where extname = 'pg_trgm'`)).map((r) => r.extname)).toEqual(['pg_trgm'])
    const idx = await t.db.query<{ indexname: string; indexdef: string }>(
      `select indexname, indexdef from pg_indexes where tablename = 'question_versions' and indexname like 'ix_question_versions_stem_%_trgm' order by indexname`,
    )
    expect(idx.map((i) => i.indexname)).toEqual(['ix_question_versions_stem_en_trgm', 'ix_question_versions_stem_ms_trgm'])
    for (const i of idx) {
      expect(i.indexdef).toContain('USING gin')
      expect(i.indexdef).toContain('gin_trgm_ops')
      expect(i.indexdef).toMatch(/WHERE \(?stem_(ms|en) IS NOT NULL\)?/)
    }
  })

  const found = async (term: string): Promise<string[]> => {
    const res = await admin.get(`/api/questions?pageSize=100&search=${encodeURIComponent(term)}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const mine = new Set(Object.values(ids))
    return ((res.body as { data: { id: string }[] }).data ?? []).map((r) => r.id).filter((id) => mine.has(id)).sort()
  }
  const keys = (...k: string[]): string[] => k.map((x) => ids[x]!).sort()

  it('the list search still returns exactly the matching rows', async () => {
    expect(await found('logaritma')).toEqual(keys('log')) // the Malay stem
    expect(await found('LOGARITHM')).toEqual(keys('en')) // the English stem, case-insensitive
    expect(await found('persamaan')).toEqual(keys('log'))
    expect(await found('xyzxyz')).toEqual([])
    // % and _ are literal characters, never wildcards
    expect(await found('50%')).toEqual(keys('pct'))
    expect(await found('ubah_pertama')).toEqual(keys('us'))
    expect(await found('ubah-pertama')).toEqual([])
    // a term shorter than three characters has no trigram: the scan still answers it
    expect((await found('50')).includes(ids.pct!)).toBe(true)
    expect(await found('ub')).toContain(ids.us)
  })

  it('the planner uses the trigram indexes for the predicate of the list search, literal and as a bind parameter', async () => {
    // A tiny table prefers a plain index walk, so only bitmap scans are allowed here (the planner then has to pick the GIN indexes).
    const plan = async (explain: string, prepare = ''): Promise<string> =>
      t.db.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL enable_seqscan = off`)
        await tx.$executeRawUnsafe(`SET LOCAL enable_indexscan = off`)
        await tx.$executeRawUnsafe(`SET LOCAL enable_indexonlyscan = off`)
        if (prepare) await tx.$executeRawUnsafe(prepare)
        return JSON.stringify(await tx.$queryRawUnsafe(explain))
      })
    const where = `(v.stem_ms ILIKE %P% ESCAPE '\\' OR v.stem_en ILIKE %P% ESCAPE '\\')`
    const from = `FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no`
    const literal = await plan(`EXPLAIN (FORMAT JSON) SELECT q.id ${from} WHERE ${where.replaceAll('%P%', `'%logaritma%'`)}`)
    const bound = await plan(`EXPLAIN (FORMAT JSON) EXECUTE srch('%logaritma%')`, `PREPARE srch(text) AS SELECT q.id ${from} WHERE ${where.replaceAll('%P%', '$1')}`)
    for (const p of [literal, bound]) {
      expect(p).toContain('ix_question_versions_stem_ms_trgm')
      expect(p).toContain('ix_question_versions_stem_en_trgm')
      expect(p).toContain('BitmapOr')
    }
  })
})
