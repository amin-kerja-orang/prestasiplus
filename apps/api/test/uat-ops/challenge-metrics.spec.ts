import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import pg from 'pg'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { MIGRATED_CHALLENGE_METRICS } from '../../src/modules/gamification/gamification.constants'
import { parseUatArgs, writeReport } from '../../scripts/uat-ops/lib'
import { planChallengeMetrics, planLines, runChallengeMetrics, SPEC, type ChallengeRow } from '../../scripts/uat-ops/challenge-metrics'
import { createTestDatabase, type TestDatabase } from '../support/db'

/** S7-T04 part 15 (ruling 18): the migrated challenges get their metric; "Kombo 10" becomes `combo` (pure plan [CI], database [CI]). */
const TITLES = Object.keys(MIGRATED_CHALLENGE_METRICS)
const TYPE_OF: Record<string, string> = { 'Kombo 10': 'streak', 'Kombo 2 Hari': 'streak', 'Si Tepat': 'accuracy', 'Ketepatan 80%': 'accuracy', 'Ketepatan 90%': 'accuracy' }
const migrated = (titles: readonly string[] = TITLES): ChallengeRow[] =>
  titles.map((title, i) => ({ id: String(i + 1), title, challenge_type: TYPE_OF[title] ?? 'quiz_count', metric: null }))

describe('planChallengeMetrics', () => {
  it('sets every NULL metric by exact title and moves Kombo 10', () => {
    const plan = planChallengeMetrics(migrated())
    expect(plan.metricUpdates).toHaveLength(15)
    expect(plan.metricUpdates.find((u) => u.title === 'Cabaran Kilat')?.metric).toBe('best_correct_in_session')
    expect(plan.missing).toEqual([])
    expect(plan.komboMoves).toEqual([{ id: '8', fromType: 'streak', fromMetric: null }])
  })

  it('never overwrites a metric and never touches another title', () => {
    const rows = [...migrated(['Si Tepat']).map((r) => ({ ...r, metric: 'sessions' })), { id: '99', title: 'Cabaran Lain', challenge_type: 'quiz_count', metric: null }]
    const plan = planChallengeMetrics(rows)
    expect(plan.metricUpdates).toEqual([])
    expect(plan.alreadySet).toBe(1)
  })

  it('matches the title exactly', () => {
    const plan = planChallengeMetrics([{ id: '1', title: 'si tepat', challenge_type: 'accuracy', metric: null }])
    expect(plan.metricUpdates).toEqual([])
    expect(plan.missing).toHaveLength(15)
  })

  it('reports a missing title as FAIL and holds no personal data', () => {
    const lines = planLines(planChallengeMetrics(migrated(TITLES.filter((t) => t !== 'Mula Hari Ini'))), false)
    expect(lines.filter((l) => l.status === 'FAIL').map((l) => l.text)).toEqual(['expected title "Mula Hari Ini" is not in challenges (nothing inserted)', expect.stringContaining('1 title(s) missing')])
  })

  it('is read-write only with --apply', () => {
    expect(parseUatArgs([], SPEC).dryRun).toBe(true)
    expect(parseUatArgs(['--apply'], SPEC).apply).toBe(true)
  })
})

describe('runChallengeMetrics (database)', () => {
  let db: TestDatabase
  let client: pg.Client
  const snapshot = async () => (await client.query(`SELECT id::text, title, challenge_type, metric, updated_at FROM challenges ORDER BY id`)).rows
  const seed = async (titles: readonly string[] = TITLES) => {
    await client.query(`DELETE FROM challenges`)
    for (const r of migrated(titles)) {
      await client.query(`INSERT INTO challenges(title, challenge_type, metric, target_value) VALUES ($1, $2, NULL, 3)`, [r.title, r.challenge_type])
    }
  }
  beforeAll(async () => {
    db = await createTestDatabase()
    client = new pg.Client({ connectionString: db.url })
    await client.connect()
  })
  afterAll(async () => {
    await client.end()
    await db.drop()
  })
  beforeEach(() => seed())

  it('a dry run writes nothing', async () => {
    const before = await snapshot()
    const { plan, lines } = await runChallengeMetrics(client, { apply: false })
    expect(plan.metricUpdates).toHaveLength(15)
    expect(lines[1]?.text).toContain('would set 15')
    expect(await snapshot()).toEqual(before)
  })

  it('apply fills the NULL metrics from the table and moves Kombo 10 to combo / best_combo', async () => {
    await runChallengeMetrics(client, { apply: true })
    const rows = await snapshot()
    for (const r of rows) expect(r.metric).toBe(MIGRATED_CHALLENGE_METRICS[r.title as keyof typeof MIGRATED_CHALLENGE_METRICS])
    expect(rows.find((r) => r.title === 'Kombo 10')).toMatchObject({ challenge_type: 'combo', metric: 'best_combo' })
    expect(rows.find((r) => r.title === 'Kombo 2 Hari')).toMatchObject({ challenge_type: 'streak', metric: 'streak' })
  })

  it('moves Kombo 10 of type kombo-as-streak with a set metric to combo / best_combo and reports fromType/fromMetric', async () => {
    await client.query(`UPDATE challenges SET metric = 'streak' WHERE title = 'Kombo 10'`)
    const { lines } = await runChallengeMetrics(client, { apply: true })
    expect((await snapshot()).find((r) => r.title === 'Kombo 10')).toMatchObject({ challenge_type: 'combo', metric: 'best_combo' })
    expect(lines.some((l) => l.text === 'step 2: "Kombo 10" streak/streak -> combo/best_combo')).toBe(true)
  })

  it('reports an UPDATE that hits 0 rows as a mismatch and does not count it as written', async () => {
    const real = client.query.bind(client) as (sql: unknown, params?: unknown) => Promise<pg.QueryResult>
    let n = 0
    const proxy = {
      query: (sql: unknown, params?: unknown) => (typeof sql === 'string' && sql.startsWith('UPDATE') && ++n === 1 ? real('SELECT 1 WHERE false').then((r) => ({ ...r, rowCount: 0 })) : real(sql, params)),
    } as unknown as pg.Client
    const { lines } = await runChallengeMetrics(proxy, { apply: true })
    expect(lines.filter((l) => l.text.startsWith('mismatch:'))).toHaveLength(1)
    // 15 metric updates + 1 Kombo move are planned; the faked one is not counted.
    expect(lines.some((l) => l.text.startsWith('15 change(s) written'))).toBe(true)
  })

  it('leaves a set metric and an unlisted title alone, and inserts nothing', async () => {
    await client.query(`UPDATE challenges SET metric = 'minutes' WHERE title = 'Si Tepat'`)
    await client.query(`INSERT INTO challenges(title, challenge_type, metric, target_value) VALUES ('Cabaran Lain', 'quiz_count', NULL, 3)`)
    await runChallengeMetrics(client, { apply: true })
    const rows = await snapshot()
    expect(rows).toHaveLength(16)
    expect(rows.find((r) => r.title === 'Si Tepat')?.metric).toBe('minutes')
    expect(rows.find((r) => r.title === 'Cabaran Lain')?.metric).toBeNull()
  })

  it('reports a missing title and inserts nothing', async () => {
    await seed(TITLES.filter((t) => t !== 'Kombo 10'))
    const { plan, lines } = await runChallengeMetrics(client, { apply: true })
    expect(plan.missing).toEqual(['Kombo 10'])
    expect(lines.some((l) => l.status === 'FAIL' && l.text.includes('"Kombo 10"'))).toBe(true)
    expect(await snapshot()).toHaveLength(14)
  })

  it('is idempotent: a second apply changes nothing', async () => {
    await runChallengeMetrics(client, { apply: true })
    const after = await snapshot()
    const second = await runChallengeMetrics(client, { apply: true })
    expect(second.plan.metricUpdates).toEqual([])
    expect(second.plan.komboMoves).toEqual([])
    expect(await snapshot()).toEqual(after)
  })
})

describe('report', () => {
  const root = mkdtempSync(join(tmpdir(), 'challenge-metrics-'))
  afterAll(() => rmSync(root, { recursive: true, force: true }))
  it('writes lines to .evidence/uat-ops', () => {
    const path = writeReport('challenge-metrics', planLines(planChallengeMetrics(migrated()), false), { root, now: new Date('2026-11-06T00:00:00Z') })
    expect(existsSync(path)).toBe(true)
    expect(readdirSync(join(root, '.evidence', 'uat-ops'))).toHaveLength(1)
    expect(readFileSync(path, 'utf8')).toContain('step 1: "Cabaran Kilat" -> best_correct_in_session')
  })
})
