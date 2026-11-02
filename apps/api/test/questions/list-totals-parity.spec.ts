import { QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import { Prisma } from '../../src/db/generated/client'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { QuestionsRepository } from '../../src/modules/questions'
import type { AdminListFilter } from '../../src/modules/questions'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, type Refs } from './http-helpers'

/**
 * R1 perf (T54 F4) parity: `listIds` now derives `total` from the one per-status aggregate. This spec keeps the PREVIOUS implementation
 * (a separate `count(*)` over the filter with its status, plus the grouped counts over the filter without it) and requires identical
 * `total`, `counts` and page ids for many filter combinations on a mixed fixture.
 */
type Conds = (f: AdminListFilter) => Prisma.Sql[]
interface Db {
  $queryRaw<T>(strings: TemplateStringsArray, ...values: unknown[]): Promise<T>
}

describe('admin list totals: new aggregate equals the old separate count', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let repo: QuestionsRepository

  const makeOld = (r: QuestionsRepository) => {
    const conds = ((r as unknown as { adminConds: Conds }).adminConds).bind(r)
    const db = (r as unknown as { db: Db }).db
    return async (filter: AdminListFilter): Promise<{ ids: string[]; total: number; counts: Record<string, number> }> => {
      const base = conds({ ...filter, status: undefined })
      const withStatus = filter.status ? [...base, Prisma.sql`v.status = ${filter.status}`] : base
      const from = Prisma.sql`FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.latest_version_no`
      const whereAll = Prisma.join(withStatus, ' AND ')
      const whereBase = Prisma.join(base, ' AND ')
      const offset = (filter.page - 1) * filter.pageSize
      const rows = await db.$queryRaw<{ id: bigint }[]>`SELECT q.id ${from} WHERE ${whereAll} ORDER BY q.id DESC LIMIT ${filter.pageSize} OFFSET ${offset}`
      const totals = await db.$queryRaw<{ n: number }[]>`SELECT count(*)::int AS n ${from} WHERE ${whereAll}`
      const counted = await db.$queryRaw<{ status: string; n: number }[]>`SELECT v.status AS status, count(*)::int AS n ${from} WHERE ${whereBase} GROUP BY 1`
      const counts: Record<string, number> = { draft: 0, review: 0, approved: 0, archived: 0 }
      for (const c of counted) counts[c.status] = c.n
      return { ids: rows.map((x) => String(x.id)), total: totals[0]?.n ?? 0, counts }
    }
  }

  beforeAll(async () => {
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    repo = t.app.get(QuestionsRepository)
    const paper = async (year: number, board: string, type: string): Promise<string> =>
      (await t.db.query<{ id: string }>(`insert into source_papers (year, exam_board, exam_type, rights_status) values ($1, $2, $3, 'own') returning id::text`, [year, board, type]))[0]!.id
    const p1 = await paper(2024, 'Selangor', 'percubaan')
    const p2 = await paper(2023, 'Johor', 'sebenar')
    const statuses = ['draft', 'review', 'approved', 'archived', 'draft', 'approved', 'review', 'draft', 'approved', 'archived', 'draft', 'review'] as const
    for (const [i, status] of statuses.entries()) {
      const res = await admin.post(
        '/api/questions',
        mcqBody(refs, {
          subjectId: i % 3 === 0 ? refs.sciId : refs.mathId,
          educationLevelId: i % 2 === 0 ? refs.t4Id : refs.t5Id,
          difficultyLevel: (i % 5) + 1,
          kertas: String((i % 3) + 1),
          questionText: `Soalan pariti ${i % 2 === 0 ? 'logaritma' : 'indeks'} nombor ${String(i)} untuk ujian.`,
        }),
      )
      expect(res.status, JSON.stringify(res.body)).toBe(201)
      const id = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
      await t.db.query(`update question_versions set status = $2, source_paper_id = $3::bigint where question_id = $1`, [id, status, i % 4 === 0 ? null : i % 2 === 0 ? p1 : p2])
      if (i === 3) await t.db.query(`update question_versions set paper_code = 'MATH/1 ' || chr(9) where question_id = $1`, [id])
      if (i === 5) await t.db.query(`update question_versions set paper_code = 'MATH' where question_id = $1`, [id]) // a code without a digit
      if (status === 'approved') await t.db.query(`update questions set live_version_no = 1 where id = $1`, [id])
    }
  })
  afterAll(async () => {
    await t.close()
  })

  const page = { page: 1, pageSize: 5 }
  const combos: [string, Partial<AdminListFilter>][] = [
    ['no filter', {}],
    ['status only', { status: 'approved' }],
    ['kertas alone', { kertas: '2' }],
    ['kertas + status', { kertas: '1', status: 'draft' }],
    ['search', { search: 'logaritma' }],
    ['search + status', { search: 'indeks', status: 'review' }],
    ['search with no hit', { search: 'tiada-padanan-ini' }],
    ['tahun', { tahun: '2024' }],
    ['negeri', { negeri: 'johor' }],
    ['jenis', { jenis: 'sebenar' }],
    ['tahun + negeri + jenis + status', { tahun: '2024', negeri: 'Selangor', jenis: 'percubaan', status: 'draft' }],
    ['difficulty', { difficultyLevel: '5' }],
    ['dskp untagged', { dskpFilter: 'untagged' }],
    ['compliance verified', { complianceFilter: 'verified' }],
    ['compliance draft + status', { complianceFilter: 'draft', status: 'archived' }],
    ['page past the end', { status: 'draft', page: 40 }],
  ]

  it.each(combos)('%s', async (_name, over) => {
    const old = makeOld(repo)
    for (const status of [undefined, 'draft', 'review', 'approved', 'archived'] as const) {
      for (const [subjectId, educationLevelId] of [[undefined, undefined], [refs.mathId, undefined], [refs.sciId, refs.t4Id]] as const) {
        const filter: AdminListFilter = { ...page, ...over, ...(over.status === undefined && status ? { status } : {}), subjectId, educationLevelId }
        const before = await old(filter)
        const after = await repo.listIds(filter)
        expect(after.total, JSON.stringify(filter)).toBe(before.total)
        expect(after.counts, JSON.stringify(filter)).toEqual(before.counts)
        expect(after.ids, JSON.stringify(filter)).toEqual(before.ids)
      }
    }
  })

  it('the fixture is mixed (the combinations are not all empty)', async () => {
    const all = await repo.listIds({ ...page })
    expect(Object.values(all.counts).filter((n) => n > 0).length).toBe(4)
    expect(all.total).toBeGreaterThan(12)
  })
})
