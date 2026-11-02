import { QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

/**
 * R1 perf, migration 0107 (T54 F4): partial expression index for the Kertas filter. The test database already ran the migration. The
 * spec checks the index exists, the filter returns exactly the right rows (trailing whitespace, a code without a digit, kertas 4), and that
 * the planner uses the index for the repository's predicate, as a literal and as a bind parameter.
 */
describe('migration 0107 question paper kertas index', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  const ids: Record<string, string> = {}

  const make = async (key: string, paperCode: string | null): Promise<void> => {
    const res = await admin.post('/api/questions', mcqBody(refs, { questionText: `Soalan indeks kertas ${key} untuk ujian.` }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    ids[key] = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    await t.db.query(`update question_versions set paper_code = $2 where question_id = $1`, [ids[key], paperCode])
  }

  beforeAll(async () => {
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    await make('k1', 'MATH/1')
    await make('k2', 'MATH/2')
    await make('k2sp', 'MATH/2 ' + String.fromCharCode(9) + ' ')
    await make('k3', 'MATH/3')
    await make('k4', 'MATH/4') // not a Kertas 1 to 3
    await make('nodigit', 'MATH') // a code without a digit
    await make('none', null)
  })
  afterAll(async () => {
    await t.close()
  })

  it('the partial expression index exists with the same expression text as the repository', async () => {
    const idx = await t.db.query<{ indexdef: string }>(`select indexdef from pg_indexes where indexname = 'ix_question_versions_paper_kertas'`)
    expect(idx).toHaveLength(1)
    expect(idx[0]!.indexdef).toContain(`'/([1-3])[[:space:]]*$'`)
    expect(idx[0]!.indexdef).toMatch(/WHERE \(?paper_code IS NOT NULL\)?/)
  })

  const found = async (kertas: string): Promise<string[]> => {
    const res = await admin.get(`/api/questions?pageSize=100&kertas=${kertas}`)
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const mine = new Set(Object.values(ids))
    return ((res.body as { data: { id: string }[] }).data ?? []).map((r) => r.id).filter((id) => mine.has(id)).sort()
  }
  const keys = (...k: string[]): string[] => k.map((x) => ids[x]!).sort()

  it('the Kertas filter returns exactly the matching rows', async () => {
    expect(await found('1')).toEqual(keys('k1'))
    expect(await found('2')).toEqual(keys('k2', 'k2sp')) // trailing spaces and a tab still match
    expect(await found('3')).toEqual(keys('k3'))
  })

  it('the planner uses the index for the predicate of the Kertas filter, literal and as a bind parameter', async () => {
    const plan = async (explain: string, prepare = ''): Promise<string> =>
      t.db.prisma.$transaction(async (tx) => {
        await tx.$executeRawUnsafe(`SET LOCAL enable_seqscan = off`)
        if (prepare) await tx.$executeRawUnsafe(prepare)
        return JSON.stringify(await tx.$queryRawUnsafe(explain))
      })
    const cond = `substring(v.paper_code from '/([1-3])[[:space:]]*$') = %P%`
    const from = `FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no`
    const literal = await plan(`EXPLAIN (FORMAT JSON) SELECT q.id ${from} WHERE ${cond.replace('%P%', `'2'`)}`)
    const bound = await plan(`EXPLAIN (FORMAT JSON) EXECUTE kert('2')`, `PREPARE kert(text) AS SELECT q.id ${from} WHERE ${cond.replace('%P%', '$1')}`)
    for (const p of [literal, bound]) expect(p).toContain('ix_question_versions_paper_kertas')
  })
})
