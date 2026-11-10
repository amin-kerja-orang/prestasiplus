import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { Prisma } from '../../src/db/generated/client'
import { createPrismaClient } from '../../src/db/client'
import { AccountDataRepository } from '../../src/modules/account/account-data.repository'
import { StatsService } from '../../src/modules/account/settings.service'
import { OverviewRepository } from '../../src/modules/practice/reads/overview/overview.repository'
import { OverviewService } from '../../src/modules/practice/reads/overview/overview.service'
import { QuestionsRepository } from '../../src/modules/questions'
import { MEDIA_RESOLVED_SQL, VERSION_STIMULI_SQL, mediaResolvedSql } from '../../src/modules/questions/learner-visibility'
import { SpmPoolService } from '../../src/modules/spm/pool.service'
import { OverviewCache } from '../../src/modules/questions/serving/overview-cache'
import { createTestDatabase, type TestDatabase } from '../support/db'

/**
 * UAT speed work on the pupil pages (real bank: 450 thousand questions): the rewrites must give the SAME answers as before.
 *  - MEDIA_RESOLVED_SQL (three anti-joins) = mediaResolvedSql(VERSION_STIMULI_SQL, ...) (the UNION form), row for row.
 *  - OverviewRepository.newestIdsOf reads id windows and returns exactly what one unbounded read returns.
 *  - the pool counts, the bank counts and the public counters are served while one refresh runs behind them.
 *  - every pooled connection runs with the JIT compiler off.
 */

describe('database', () => {
  let db: TestDatabase

  const ids = (rows: { id: string }[]): string[] => rows.map((r) => r.id)

  beforeAll(async () => {
    db = await createTestDatabase()
    await db.query(`INSERT INTO education_levels (code, name, name_en, stage, curriculum, sort_order, is_active) VALUES ('T4', 'Tingkatan 4', 'Form 4', 'upper_secondary', 'kssr', 4, true)`)
    await db.query(`INSERT INTO subjects (code, name, name_en, color, is_core, sort_order, is_active) VALUES ('PS1', 'Subjek', 'Subject', '#123456', false, 1, true)`)
  }, 120_000)

  afterAll(async () => {
    await db.drop()
  })

  /** One approved, active, single-MCQ question at explicit id `id` (no stimulus yet). */
  const addQuestion = async (id: number): Promise<void> => {
    await db.query(`INSERT INTO questions (id, is_active, live_version_no, latest_version_no, source_type) OVERRIDING SYSTEM VALUE VALUES ($1::bigint, true, 1, 1, 'manual')`, [id])
    await db.query(
      `INSERT INTO question_versions (id, question_id, version_no, status, type, stem_ms, subject_id, education_level_id, difficulty_tp, published_at)
       OVERRIDING SYSTEM VALUE SELECT $1::bigint, $1::bigint, 1, 'approved', 'mcq', 'Soalan ' || $1::text, (SELECT id FROM subjects LIMIT 1), (SELECT id FROM education_levels LIMIT 1), 2, now()`,
      [id],
    )
  }

  const addStimulus = async (kind: string, body: string | null, extra: { tableData?: unknown } = {}): Promise<number> => {
    const rows = await db.query<{ id: string }>(`INSERT INTO stimuli (kind, body_ms, table_data) VALUES ($1, $2, $3::jsonb) RETURNING id::text`, [kind, body, extra.tableData === undefined ? null : JSON.stringify(extra.tableData)])
    return Number((rows[0] as { id: string }).id)
  }

  const linkVersion = (questionId: number, stimulusId: number) => db.query(`INSERT INTO question_version_stimuli (question_version_id, stimulus_id, position) VALUES ($1, $2, 1)`, [questionId, stimulusId])

  it('MEDIA_RESOLVED_SQL gives the same rows as the UNION form on every kind of stimulus link', async () => {
    // 100.. : no stimulus; 110.. own link; 120.. part link; 130.. group link; 140: import hold.
    const none = [100, 101]
    for (const id of none) await addQuestion(id)
    // own link: image without file (bad), passage with text (ok), table with a pipe body (ok), table with no grid (bad), table with a grid (ok), empty passage (bad)
    const own: [number, string, string | null, { tableData?: unknown }][] = [
      [110, 'image', null, {}],
      [111, 'passage', 'Petikan', {}],
      [112, 'table', 'a | b', {}],
      [113, 'table', null, {}],
      [114, 'table', null, { tableData: { head: ['a'], rows: [['1']] } }],
      [115, 'passage', '   ', {}],
    ]
    for (const [id, kind, body, extra] of own) {
      await addQuestion(id)
      await linkVersion(id, await addStimulus(kind, body, extra))
    }
    // part link: a bad image on the part (bad), a good passage (ok)
    await addQuestion(120)
    await addQuestion(121)
    const part = (questionId: number, stimulusId: number) =>
      db.query(`INSERT INTO question_parts (question_version_id, position, depth, label, prompt_ms, mode, marks, stimulus_id) VALUES ($1, 1, 1, '1', 'x', 'mcq', 1, $2)`, [questionId, stimulusId])
    await part(120, await addStimulus('diagram', null))
    await part(121, await addStimulus('passage', 'Teks'))
    // group link: two members of a group holding a bad picture (both bad), two of a group holding a good passage (both ok)
    for (const id of [130, 131, 132, 133]) await addQuestion(id)
    const group = async (members: number[], stimulusId: number) => {
      const g = (await db.query<{ id: string }>(`INSERT INTO stimulus_groups (scope) VALUES ('section') RETURNING id::text`))[0] as { id: string }
      await db.query(`INSERT INTO stimulus_group_stimuli (group_id, stimulus_id, position) VALUES ($1, $2, 1)`, [g.id, stimulusId])
      for (const [i, m] of members.entries()) await db.query(`UPDATE questions SET group_id = $1, group_position = $2 WHERE id = $3`, [g.id, i + 1, m])
    }
    await group([130, 131], await addStimulus('map', null))
    await group([132, 133], await addStimulus('passage', 'Petikan kumpulan'))
    // import hold
    await addQuestion(140)
    await db.query(`UPDATE question_versions SET import_issues = '[{"code": "legacy_image_unresolved"}]'::jsonb WHERE id = 140`)
    await addQuestion(141)
    await db.query(`UPDATE question_versions SET import_issues = '[{"code": "other"}]'::jsonb WHERE id = 141`)

    const read = async (predicate: Prisma.Sql): Promise<string[]> => {
      const s = Prisma.sql`SELECT q.id::text AS id FROM questions q JOIN question_versions v ON v.question_id = q.id AND v.version_no = q.live_version_no WHERE ${predicate} ORDER BY q.id`
      return ids(await db.query<{ id: string }>(s.text, s.values))
    }
    const union = await read(mediaResolvedSql(VERSION_STIMULI_SQL, Prisma.sql`v.import_issues`))
    const anti = await read(MEDIA_RESOLVED_SQL)
    expect(anti).toEqual(union)
    // Not a trivial agreement: the served set is exactly the fixtures that can be shown.
    expect(anti).toEqual(['100', '101', '111', '112', '114', '121', '132', '133', '141'])
  })

  it('newestIdsOf reads id windows and returns what one unbounded read returns, newest first', async () => {
    // Ids far apart, so each window (16 384, 131 072, the rest) is crossed. Starts from an empty bank.
    await db.query(`DELETE FROM questions`)
    for (const id of [10, 20_000, 100_000, 700_000, 700_001]) await addQuestion(id)
    const q = new QuestionsRepository({ client: db.prisma } as never)
    const o = new OverviewRepository({ client: db.prisma } as never)
    const scope = q.scopeSql({ status: 'approved', active: true }, true)
    const all = Prisma.sql`SELECT q.id::text AS id ${scope.from} WHERE ${scope.where} ORDER BY q.id DESC`
    const oracle = ids(await db.query<{ id: string }>(all.text, all.values))
    expect(oracle).toEqual(['700001', '700000', '100000', '20000', '10'])
    expect(await o.newestIdsOf(scope, 60)).toEqual(oracle)
    expect(await o.newestIdsOf(scope, 3)).toEqual(oracle.slice(0, 3))
    expect(await o.newestIdsOf(scope, 1)).toEqual(['700001'])
    // paging backwards from a given id, across the empty windows
    expect(await o.newestIdsOf(scope, 60, '700000')).toEqual(['100000', '20000', '10'])
    expect(await o.newestIdsOf(scope, 2, '100000')).toEqual(['20000', '10'])
    expect(await o.newestIdsOf(scope, 60, '10')).toEqual([])
  })

  it('newestIdsOf on an empty bank returns nothing', async () => {
    await db.query(`DELETE FROM questions`)
    const q = new QuestionsRepository({ client: db.prisma } as never)
    const o = new OverviewRepository({ client: db.prisma } as never)
    expect(await o.newestIdsOf(q.scopeSql({ status: 'approved', active: true }, true), 60)).toEqual([])
  })

  it('every connection of the API pool runs with the JIT compiler off', async () => {
    const client = createPrismaClient(db.url)
    try {
      const rows = await client.$queryRaw<{ jit: string }[]>`SELECT current_setting('jit') AS jit`
      expect(rows[0]?.jit).toBe('off')
    } finally {
      await client.$disconnect()
    }
  })
})

describe('SPM pool counts: served while one refresh runs behind (stale-while-revalidate)', () => {
  const build = (ttlSeconds: string) => {
    let nowMs = 1_000_000
    let n = 0
    const release: (() => void)[] = []
    const repo = {
      unitCountsByLevelTp: () => {
        const value = ++n
        return new Promise<{ levelId: string; tp: number; n: number }[]>((resolve) => release.push(() => resolve([{ levelId: '4', tp: 1, n: value }])))
      },
    }
    const cache = new OverviewCache({ now: () => new Date(nowMs) } as never, {} as never)
    const pool = new SpmPoolService(repo as never, { get: () => ttlSeconds } as never, { now: () => new Date(nowMs) } as never, cache)
    return { pool, cache, release, advance: (ms: number) => (nowMs += ms), calls: () => n }
  }
  const settle = () => new Promise<void>((r) => setTimeout(r, 0))

  it('past the TTL the old count is returned at once and the next read has the new one', async () => {
    const t = build('10')
    const first = t.pool.latihTubiCount('1')
    t.release.shift()?.()
    expect(await first).toBe(1)
    expect(await t.pool.latihTubiCount('1')).toBe(1) // fresh: no second statement
    expect(t.calls()).toBe(1)

    t.advance(11_000)
    expect(await t.pool.latihTubiCount('1')).toBe(1) // stale: served without waiting for the statement
    await settle()
    expect(t.calls()).toBe(2) // ONE refresh started behind it
    expect(await t.pool.latihTubiCount('1')).toBe(1) // another stale read joins that refresh, no third statement
    expect(t.calls()).toBe(2)
    t.release.shift()?.()
    await settle()
    expect(await t.pool.latihTubiCount('1')).toBe(2)
  })

  it('a question event is NOT served stale: the next read waits for the fresh count', async () => {
    const t = build('600')
    const first = t.pool.latihTubiCount('1')
    t.release.shift()?.()
    expect(await first).toBe(1)
    t.cache.invalidate()
    const after = t.pool.latihTubiCount('1')
    await settle()
    expect(t.calls()).toBe(2)
    t.release.shift()?.()
    expect(await after).toBe(2)
  })

  it('a failed refresh keeps the stale count', async () => {
    let call = 0
    const cache = new OverviewCache({ now: () => new Date(0) } as never, {} as never)
    let nowMs = 0
    const repo = {
      unitCountsByLevelTp: () => (++call === 1 ? Promise.resolve([{ levelId: '4', tp: 1, n: 7 }]) : Promise.reject(new Error('db down'))),
    }
    const pool = new SpmPoolService(repo as never, { get: () => '1' } as never, { now: () => new Date(nowMs) } as never, cache)
    expect(await pool.latihTubiCount('1')).toBe(7)
    nowMs += 5_000
    expect(await pool.latihTubiCount('1')).toBe(7)
    await settle()
    expect(call).toBe(2)
    nowMs += 5_000
    expect(await pool.latihTubiCount('1')).toBe(7)
  })

  it('never more than two refreshes run at once when many subjects expire together', async () => {
    const t = build('1')
    const subjects = ['1', '2', '3', '4', '5']
    const loads = subjects.map((s) => t.pool.latihTubiCount(s))
    await settle()
    expect(t.calls()).toBe(5) // cold reads all compute (they are waited for)
    t.release.splice(0).forEach((r) => r())
    await Promise.all(loads)
    t.advance(5_000)
    for (const s of subjects) await t.pool.latihTubiCount(s)
    await settle()
    expect(t.calls()).toBe(5 + 2) // two refreshes started, three queued
    t.release.splice(0).forEach((r) => r())
    await settle()
    expect(t.calls()).toBe(5 + 4)
    t.release.splice(0).forEach((r) => r())
    await settle()
    expect(t.calls()).toBe(5 + 5)
  })
})

describe('practice bank counts: served while one refresh runs behind', () => {
  it('past bankTtlMs the old counts are returned at once, one recount runs behind them', async () => {
    let calls = 0
    const cell = (n: number) => [{ subjectId: '1', levelId: '4', tp: 1, mcq: true, n }]
    const repo = {
      bankMatrix: () => Promise.resolve(cell(++calls)),
    }
    const svc = new OverviewService(repo as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, {} as never, { bankTtlMs: 1000 }, {} as never)
    const facts = () => (svc as unknown as { bankFacts(): Promise<{ count(): number }> }).bankFacts()
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(10_000)
    expect((await facts()).count()).toBe(1)
    now.mockReturnValue(10_500)
    expect((await facts()).count()).toBe(1)
    expect(calls).toBe(1)
    now.mockReturnValue(12_000)
    expect((await facts()).count()).toBe(1) // stale, served at once
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(calls).toBe(2) // one recount behind it
    now.mockReturnValue(12_100)
    expect((await facts()).count()).toBe(2)
    expect(calls).toBe(2)
    now.mockRestore()
  })
})

describe('public stats: served while one recount runs behind', () => {
  it('counts on every call without a ConfigService (the unit specs), and keeps the figures with one', async () => {
    let calls = 0
    const repo = { platformCounts: () => Promise.resolve({ questionCount: ++calls, subjectCount: 1, levelCount: 5 }) } as unknown as AccountDataRepository
    const plain = new StatsService(repo)
    await plain.get()
    await plain.get()
    expect(calls).toBe(2)

    calls = 0
    const svc = new StatsService(repo, { get: () => '120' } as never)
    const now = vi.spyOn(performance, 'now')
    now.mockReturnValue(5_000)
    expect((await svc.get()).questionCount).toBe(1)
    expect((await svc.get()).questionCount).toBe(1)
    expect(calls).toBe(1)
    now.mockReturnValue(5_000 + 121_000)
    expect((await svc.get()).questionCount).toBe(1) // stale, at once
    await new Promise<void>((r) => setTimeout(r, 0))
    expect(calls).toBe(2)
    expect((await svc.get()).questionCount).toBe(2)
    now.mockRestore()
  })
})
