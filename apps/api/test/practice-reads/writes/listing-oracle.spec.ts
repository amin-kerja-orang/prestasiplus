/**
 * KP-18 perf (UAT: the pupil structured list never answered): the listing now starts from a MATERIALIZED candidate step and `NOT_PKSK_SQL` is an
 * uncorrelated NOT IN. This spec keeps the PREVIOUS single-statement query (correlated NOT EXISTS, no candidate step) as an oracle and requires the
 * same page ids and the same counts, with and without `markable`, a search, a KBAT and a subject; and checks that a PKSK-tagged set is out of both.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { Prisma } from '../../../src/db/generated/client'
import { PrismaService } from '../../../src/db/prisma.service'
import { StructuredListingRepository } from '../../../src/modules/practice/reads/writes/listing.repository'
import { ALL_LEAVES_KEYED_SQL, BANK_VISIBLE_SQL, LEARNER_LEVEL_SQL, MEDIA_RESOLVED_SQL, NOT_FLAGGED_SQL, NOT_SOURCE_TAKEN_DOWN_SQL } from '../../../src/modules/questions/learner-visibility'
import { type WritesTestApp, bootWritesApp, leaf, publishStructured } from './helpers'

const OLD_NOT_PKSK = Prisma.sql`NOT EXISTS (SELECT 1 FROM question_tags pt WHERE pt.question_id = q.id AND pt.kind = 'pksk_domain')`

let t: WritesTestApp
beforeAll(async () => {
  t = await bootWritesApp()
}, 120_000)
afterAll(async () => {
  await t.close()
})

describe('structured listing equals the previous single-statement query', () => {
  it('same ids (page order) and counts for the filter combinations; a PKSK set is excluded', async () => {
    const ids: string[] = []
    for (let i = 1; i <= 5; i++) {
      ids.push(await publishStructured(t, 'SEED-MCQ-MATH-T4', { stem: `Oracle baris ${String(i)}`, cognitive: i, parts: [{ label: '(a)', prompt: { ms: 'Bahagian' }, children: [leaf('(i)', 2)] }] as never }))
    }
    // one without a key on a leaf (not markable), one tagged PKSK
    await t.db.query(`delete from answer_keys where part_id in (select p.id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1::bigint and p.mode is not null)`, [ids[0]])
    await t.db.query(`insert into question_tags (question_id, kind, code) values ($1::bigint, 'pksk_domain', 'X')`, [ids[1]])
    const levels = (await t.db.query<{ id: string }>(`select id::text id from education_levels where code in ('T4','T5')`)).map((r) => r.id)
    const subject = (await t.db.query<{ s: string }>(`select subject_id::text s from question_versions where question_id = $1::bigint`, [ids[2]]))[0]!.s
    const repo = t.app.get(StructuredListingRepository)
    const db = t.app.get(PrismaService).client

    const oracle = async (q: { subjects: string[] | null; kbat: number | null; q: string | null; markable: boolean; limit: number; offset: number }) => {
      const lv = levels.map((l) => BigInt(l))
      const subs = q.subjects === null ? null : q.subjects.map((s) => BigInt(s))
      const lk = q.q === null ? null : `%${q.q}%`
      const where = Prisma.sql`q.is_active AND v.status = 'approved' AND v.type = 'structured' AND ${BANK_VISIBLE_SQL} AND ${NOT_FLAGGED_SQL} AND ${MEDIA_RESOLVED_SQL}
          AND ${OLD_NOT_PKSK} AND ${LEARNER_LEVEL_SQL} AND ${NOT_SOURCE_TAKEN_DOWN_SQL}
          AND v.education_level_id = ANY(${lv}::bigint[]) AND (${subs}::bigint[] IS NULL OR v.subject_id = ANY(${subs}::bigint[]))
          AND (${q.kbat}::int IS NULL OR LEAST(6, GREATEST(1, COALESCE(v.cognitive_level, 1))) = ${q.kbat}::int)
          AND (${lk}::text IS NULL OR v.stem_ms ILIKE ${lk}::text)`
      const rows = await db.$queryRaw<{ id: bigint }[]>(Prisma.sql`SELECT q.id FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no
        WHERE ${where} AND (NOT ${q.markable}::boolean OR ${ALL_LEAVES_KEYED_SQL}) ORDER BY COALESCE(v.published_at, q.created_at) DESC, q.id ASC LIMIT ${q.limit} OFFSET ${q.offset}`)
      const c = await db.$queryRaw<{ n: number; pending: number }[]>(Prisma.sql`SELECT count(*) FILTER (WHERE NOT ${q.markable}::boolean OR ok)::int AS n, count(*) FILTER (WHERE NOT ok)::int AS pending
        FROM (SELECT ${ALL_LEAVES_KEYED_SQL} AS ok FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no WHERE ${where}) t`)
      return { ids: rows.map((r) => String(r.id)), total: c[0]!.n, pendingScheme: c[0]!.pending }
    }

    let compared = 0
    for (const markable of [false, true])
      for (const kbat of [null, 3])
        for (const subjects of [null, [subject]])
          for (const text of [null, 'oracle'])
            for (const [limit, offset] of [[20, 0], [2, 1]] as const) {
              const q = { levelIds: levels, subjectIds: subjects, kbat, subjectOrder: false, q: text, markable, limit, offset }
              const got = await repo.page(q)
              const want = await oracle({ subjects, kbat, q: text, markable, limit, offset })
              expect(got, JSON.stringify(q)).toEqual(want)
              compared += 1
            }
    expect(compared).toBe(32)
    const all = await repo.page({ levelIds: levels, subjectIds: null, kbat: null, subjectOrder: false, q: 'Oracle', markable: false, limit: 50, offset: 0 })
    expect(all.ids).not.toContain(ids[1])
    expect(all.ids).toContain(ids[0])
    const keyed = await repo.page({ levelIds: levels, subjectIds: null, kbat: null, subjectOrder: false, q: 'Oracle', markable: true, limit: 50, offset: 0 })
    expect(keyed.ids).not.toContain(ids[0])
    expect(keyed.pendingScheme).toBeGreaterThan(0)
  })
})
