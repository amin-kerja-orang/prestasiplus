/**
 * The snapshot cache of `practiceAnswersStep` is per run (AM-08c): every build of the step starts with an empty
 * cache, so a second run reads the archive again and sees a question whose options changed in between, while the
 * batches of one run still share one read. No database: the pool is a fake that counts the snapshot queries and
 * serves the archive as it is "now". Values are fictitious; ids are surrogate.
 */
import type pg from 'pg'
import { describe, expect, it } from 'vitest'

import { ActivityContext } from '../../../src/migration/load/activity/context'
import { practiceAnswersStep } from '../../../src/migration/load/activity/practice-steps'
import type { BatchContext } from '../../../src/migration/kit/runner'

interface Archive {
  options: string[]
}

function fakePool(archive: Archive): { pool: pg.Pool; snapshotCalls: unknown[][] } {
  const snapshotCalls: unknown[][] = []
  const pool = {
    async query(_text: string, values?: unknown[]): Promise<pg.QueryResult> {
      snapshotCalls.push([...((values?.[0] as string[]) ?? [])])
      const row = {
        id: '11', subject_id: '1', education_level_id: '2', chapter_id: null, topic_id: null,
        difficulty: 'mudah', qtype: 'mcq', stem: 'Soalan 11', options: archive.options, natural_key: null, number_label: null,
      }
      return { rows: [row], rowCount: 1, command: 'SELECT', oid: 0, fields: [] }
    },
  } as unknown as pg.Pool
  return { pool, snapshotCalls }
}

/** A batch context whose id map resolves nothing: every attempt is rejected, only the snapshot read matters here. */
function fakeBatch(): BatchContext {
  return {
    db: { query: async () => ({ rows: [], rowCount: 0 }) },
    source: 'cloud',
    idMap: { resolveMany: async () => new Map() },
    rejects: { add: () => undefined },
  } as unknown as BatchContext
}

const attempt = (id: string) => ({ id, user_id: '1', practice_session_id: '1', question_id: '11' })

function build(pool: pg.Pool) {
  const a = new ActivityContext({ pool, env: {}, source: 'cloud', asOf: '2026-06-01' })
  return practiceAnswersStep(a)
}

describe('practiceAnswersStep snapshot cache scope', () => {
  it('a second build reads the archive again; the batches of one build share one read', async () => {
    const archive: Archive = { options: ['A', 'B'] }
    const { pool, snapshotCalls } = fakePool(archive)

    const run1 = build(pool)
    await run1.load([attempt('1')], fakeBatch())
    await run1.load([attempt('2')], fakeBatch())
    expect(snapshotCalls, 'two batches of one run share one read').toEqual([['11']])

    // The archive changes between the runs; the second build must query again (a module-level cache would not).
    archive.options = ['A', 'B', 'C']
    const run2 = build(pool)
    await run2.load([attempt('1')], fakeBatch())
    expect(snapshotCalls, 'a second run reads the archive again').toEqual([['11'], ['11']])
  })
})
