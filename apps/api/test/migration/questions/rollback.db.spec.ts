/**
 * `migrate:rollback` with a loaded question bank (QLOAD): the migrated questions leave with their versions, parts, options,
 * keys and tags; the id map is cleared; v2-born questions survive; a v2-born row that points at a migrated question pins it
 * and the rollback REFUSES (nothing changes).
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { rollbackLegacy, RollbackRefusedError } from '../../../src/migration/verify'
import { addArchive, bootQuestions, four, questionTableCounts, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
let db = ''
let v2Question = ''
let before: Record<string, number> = {}

const env = () => ({ ...h.runEnv, PP_ALLOW_MIGRATE_ROLLBACK: '1', PP_MIGRATE_TARGET_DB: db })
const call = (extra: object = {}) => rollbackLegacy({ pool: h.pool, env: env(), source: 'cloud', confirmDb: db, ...extra })

beforeAll(async () => {
  h = await bootQuestions()
  db = h.h.env.db.name
  // A v2-born question (no legacy pair) first, so "survives" is visible.
  v2Question = (await h.q<{ id: string }>(`insert into questions (live_version_no) values (null) returning id::text as id`))[0]?.id ?? ''
  before = await questionTableCounts(h.pool)
  await addArchive(h.pool, [{ id: 1 }, { id: 2, level: 2, subject: 2, chapter: 3, topic: 3, options: four(1) }, { id: 3 }])
  const { apply } = await h.both()
  expect(apply.status).toBe('succeeded')
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('rollback of the question bank', () => {
  it('a v2-born row that refers to a migrated question pins it: refused, nothing changed', async () => {
    const migrated = (await h.q<{ id: string }>(`select id::text as id from questions where legacy_source = 'cloud' order by id limit 1`))[0]?.id as string
    const child = (await h.q<{ id: string }>(`insert into questions (live_version_no, parent_question_id) values (null, $1) returning id::text as id`, [migrated]))[0]?.id as string
    const counts = await questionTableCounts(h.pool)
    await expect(call({ dryRun: true })).rejects.toThrow(RollbackRefusedError)
    await expect(call()).rejects.toThrow(/questions: 1 row\(s\) referenced by questions\.parent_question_id/)
    expect(await questionTableCounts(h.pool)).toEqual(counts)
    expect(await h.count('etl_id_map', `t.entity = 'questions'`)).toBe(3)
    await h.q(`delete from questions where id = $1`, [child])
  })

  it('a v2-born row that refers to a DESCENDANT of a migrated question (version, part, option, key) is refused by name, not by a raw FK error', async () => {
    const targets = [
      ['question_versions', 'question_version_id'],
      ['question_parts', 'part_id'],
      ['part_options', 'option_id'],
      ['answer_keys', 'key_id'],
    ] as const
    for (const [parent, col] of targets) {
      await h.q(`create table zz_pin_${parent} (id bigserial primary key, ${col} bigint not null references ${parent}(id) on delete restrict)`)
      await h.q(`insert into zz_pin_${parent} (${col}) select min(id) from ${parent}`)
    }
    const counts = await questionTableCounts(h.pool)
    try {
      for (const [parent, col] of targets) {
        await h.q(`truncate ${targets.map(([t]) => `zz_pin_${t}`).join(', ')}`)
        await h.q(`insert into zz_pin_${parent} (${col}) select min(id) from ${parent}`)
        const err = await call().catch((e: unknown) => e)
        expect(err, parent).toBeInstanceOf(RollbackRefusedError)
        expect((err as Error).message, parent).toContain(`${parent}: 1 row(s) referenced by zz_pin_${parent}.${col}`)
        expect((err as Error).message).toContain('Nothing was changed')
        expect(await questionTableCounts(h.pool)).toEqual(counts)
      }
    } finally {
      for (const [parent] of targets) await h.q(`drop table zz_pin_${parent}`)
    }
  })

  it('a migrated question edited in v2 (a later version, a changed live version) refuses the rollback', async () => {
    const migrated = (await h.q<{ id: string }>(`select id::text as id from questions where legacy_source = 'cloud' order by id limit 1`))[0]?.id as string
    const counts = await questionTableCounts(h.pool)
    for (const [label, set, undo] of [
      ['latest_version_no', `latest_version_no = 2`, `latest_version_no = 1`],
      ['live_version_no', `live_version_no = null`, `live_version_no = 1`],
    ] as const) {
      await h.q(`update questions set ${set} where id = $1`, [migrated])
      const err = await call().catch((e: unknown) => e)
      expect(err, label).toBeInstanceOf(RollbackRefusedError)
      expect((err as Error).message, label).toMatch(/1 migrated question\(s\) were edited in v2.*Nothing was changed/)
      await expect(call({ dryRun: true })).rejects.toThrow(RollbackRefusedError)
      await h.q(`update questions set ${undo} where id = $1`, [migrated])
    }
    // An extra version row (a v2 draft) refuses too.
    const v = (await h.q<{ id: string }>(`insert into question_versions (question_id, version_no, status, language, type, subject_id, education_level_id, stem_ms) select question_id, 2, 'draft', language, type, subject_id, education_level_id, stem_ms from question_versions where question_id = $1 returning id::text as id`, [migrated]))[0]?.id as string
    await expect(call()).rejects.toThrow(/edited in v2/)
    await h.q(`delete from question_versions where id = $1`, [v])
    expect(await questionTableCounts(h.pool)).toEqual(counts)
  })

  it('a dry-run reports the cascade and changes nothing; the apply removes exactly the migrated question rows', async () => {
    const loaded = await questionTableCounts(h.pool)
    const dry = await call({ dryRun: true })
    expect(dry.tables.find((t) => t.table === 'questions')?.deleted).toBe(3)
    expect(dry.tables.find((t) => t.table === 'question_versions')?.deleted).toBe(3)
    expect(dry.tables.find((t) => t.table === 'question_tags')?.deleted).toBe(1)
    expect(await questionTableCounts(h.pool)).toEqual(loaded)

    const report = await call()
    expect(report.status).toBe('succeeded')
    expect(await h.count('questions', `t.legacy_source = 'cloud'`)).toBe(0)
    expect(await questionTableCounts(h.pool)).toEqual(before) // versions, parts, options, keys, tags cascaded
    expect(await h.count('etl_id_map', `t.entity = 'questions'`)).toBe(0)
    expect(await h.count('questions', `t.id = ${v2Question}`)).toBe(1) // v2-born row survives
    // The archive is never touched.
    expect(await h.count('archive_cloud.questions')).toBe(3)
  })
})
