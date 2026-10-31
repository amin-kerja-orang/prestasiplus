/**
 * QLOAD end to end on the real application: questions loaded by `migrate:questions` are read back by the question bank
 * (`QuestionsRepository.getMany(ids, 'live')`), served by a practice draw (`Be09PracticeQuestionSource`) and counted and
 * drawn by the SPM pool (`SpmPoolService`) like any other published question. Only public service methods are used.
 * The curriculum id maps that `migrate:core` would leave are written by hand (seeded subject, levels, chapter).
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { mulberry32 } from '../../../src/db/prng'
import { renderDdl } from '../../../src/migration/ddl/render'
import { TABLES } from '../../../src/migration/ddl/spec'
import { Runner } from '../../../src/migration/kit/runner'
import { buildQuestionsSteps, QuestionsContext } from '../../../src/migration/load/questions'
import { Be09PracticeQuestionSource, servableMcq } from '../../../src/modules/practice/question-bridge'
import { QuestionsRepository } from '../../../src/modules/questions'
import { UsersRepository } from '../../../src/modules/users'
import { SpmPoolService } from '../../../src/modules/spm/pool.service'
import { bootSpmApp, type SpmTestApp } from '../../spm/helpers'
import { addArchive, four } from './helpers'

let t: SpmTestApp
let pool: pg.Pool
let repo: QuestionsRepository
let practice: Be09PracticeQuestionSource
let spmPool: SpmPoolService
const v2 = { subject: '', other: '', t4: '', t5: '', d1: '', chapter: '' }
let loaded: Record<string, string> = {}

const one = async (sql: string, params: unknown[] = []): Promise<string> => (await pool.query<{ id: string }>(sql, params)).rows[0]?.id as string

beforeAll(async () => {
  t = await bootSpmApp()
  pool = new pg.Pool({ connectionString: t.db.url, max: 4 })
  await pool.query('delete from questions') // a controlled bank
  await pool.query(renderDdl(TABLES.filter((x) => x.group === 'archive' && (x.name === 'questions' || x.name === 'question_options'))))
  repo = t.app.get(QuestionsRepository, { strict: false })
  // The real practice source over the app's own question bank and users (what the application binds to PracticePorts).
  practice = new Be09PracticeQuestionSource(repo, t.app.get(UsersRepository, { strict: false }))
  spmPool = t.app.get(SpmPoolService, { strict: false })

  v2.subject = await one(`select id::text as id from subjects where code = 'SEJ'`)
  v2.other = await one(`select id::text as id from subjects where code = 'SCI'`)
  v2.t4 = await one(`select id::text as id from education_levels where code = 'T4'`)
  v2.t5 = await one(`select id::text as id from education_levels where code = 'T5'`)
  v2.d1 = await one(`select id::text as id from education_levels where code = 'D1'`)
  v2.chapter = await one(`select id::text as id from chapters limit 1`)
  const map = (entity: string, legacy: string, id: string) =>
    pool.query(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', $1, $2, $3)`, [entity, legacy, id])
  await map('subjects', '1', v2.subject)
  await map('subjects', '2', v2.other)
  await map('education_levels', '1', v2.t4)
  await map('education_levels', '2', v2.t5)
  await map('education_levels', '3', v2.d1)
  await map('chapters', '1', v2.chapter)

  await addArchive(pool, [
    { id: 1, subject: 1, level: 1, difficulty: '2', body: 'Soalan T4 satu?', explanation: 'Penjelasan satu.', options: four(1) },
    { id: 2, subject: 1, level: 1, difficulty: '4', body: 'Soalan T4 dua?', options: four(2) },
    { id: 3, subject: 1, level: 2, difficulty: '3', body: 'Soalan T5 tiga?', options: four(3) },
    { id: 4, subject: 1, level: 3, difficulty: '1', chapter: 1, topic: null, body: 'Soalan D1 empat?', options: four(0) },
    { id: 5, subject: 1, level: 1, body: 'Soalan bergambar?', image: 'questions/x.png' },
    { id: 6, subject: 2, level: 1, body: 'Soalan subjek lain?' },
    { id: 7, subject: 1, level: 1, status: 'draf', body: 'Soalan draf?' },
  ])
  const ctx = new QuestionsContext({ pool, env: { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }, source: 'cloud', asOf: '2026-10-24', pageSize: 3 })
  const runner = new Runner({ pool, env: { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' } })
  const run = (mode: 'dry-run' | 'apply') => runner.run({ mode, steps: buildQuestionsSteps(ctx), inputHash: 'served-test', batchSize: 3 })
  expect((await run('dry-run')).status).toBe('succeeded')
  const applied = await run('apply')
  expect(applied.status).toBe('succeeded')
  expect(applied.recon[0]).toMatchObject({ sourceCount: 7, eligibleCount: 6, loaded: 6, rejected: 0 })
  const rows = await pool.query<{ legacy_id: string; id: string }>(`select legacy_id, id::text as id from questions where legacy_source = 'cloud'`)
  loaded = Object.fromEntries(rows.rows.map((r) => [r.legacy_id, r.id]))
}, 300_000)
afterAll(async () => {
  await pool?.end()
  await t?.close()
})

describe('loaded questions through the question bank', () => {
  it('are read back as complete published single-part MCQs (the reader fails closed on a bad leaf, so this is the proof)', async () => {
    const records = await repo.getMany(Object.values(loaded), 'live')
    expect(records).toHaveLength(6)
    const first = records.find((r) => r.id === loaded['1'])
    expect(first).toBeDefined()
    expect(first?.liveVersionNo).toBe(1)
    expect(first?.isActive).toBe(true)
    expect(first?.version).toMatchObject({ status: 'approved', type: 'mcq', stemMs: 'Soalan T4 satu?', explanationMs: 'Penjelasan satu.', difficultyTp: 2, educationLevelId: v2.t4, subjectId: v2.subject, formOrigin: 't4' })
    const m = servableMcq(first as never)
    expect(m.ok).toBe(true)
    if (m.ok) {
      expect(m.leaf.options.map((o) => `${o.label}:${o.body.ms}`)).toEqual(['A:Satu', 'B:Dua', 'C:Tiga', 'D:Empat'])
      expect(m.leaf.key).toEqual({ kind: 'option', correct: 'B' })
    }
    expect(first?.spmPool).toBe(true)
    expect(records.find((r) => r.id === loaded['4'])?.spmPool).toBe(false) // Darjah: not in the SPM pool
    expect(records.find((r) => r.id === loaded['4'])?.version.chapterId).toBe(v2.chapter)
  })

  it('a held image question is live but not active', async () => {
    const [held] = await repo.getMany([loaded['5'] as string], 'live')
    expect(held?.isActive).toBe(false)
  })
})

describe('served by a practice draw', () => {
  it('draws only active loaded questions of the subject and level and serves their text and key', async () => {
    const ids = await practice.sample({ subjectId: v2.subject, educationLevelIds: [v2.t4] }, 10, mulberry32(7))
    expect(ids.sort()).toEqual([loaded['1'], loaded['2']].sort()) // 5 is held, 6 is another subject, 7 is a draft
    const live = await practice.live(ids)
    const q = live.get(loaded['1'] as string)
    expect(q).toMatchObject({ questionText: 'Soalan T4 satu?', correctLabel: 'B', explanation: 'Penjelasan satu.', difficulty: 2, hasDskp: true })
    expect(q?.options.map((o) => o.text)).toEqual(['Satu', 'Dua', 'Tiga', 'Empat'])
    expect(await practice.sample({ subjectId: v2.subject, educationLevelIds: [v2.d1], difficulty: 1 }, 5, mulberry32(1))).toEqual([loaded['4']])
    expect(await practice.sample({ subjectId: v2.subject, educationLevelIds: [v2.t4], difficulty: 4 }, 5, mulberry32(1))).toEqual([loaded['2']])
    // Chapter practice: every ACTIVE loaded question of the chapter (the held image one is not offered).
    expect((await practice.chapterQuestionIds(v2.chapter)).sort()).toEqual(['1', '2', '3', '4', '6'].map((k) => loaded[k] as string).sort())
  })

  it('Latih Tubi (SPM pool) draws only the Tingkatan 4 and 5 questions', async () => {
    const ids = await practice.sample({ subjectId: v2.subject, spmPool: true }, 10, mulberry32(3))
    expect(ids.sort()).toEqual([loaded['1'], loaded['2'], loaded['3']].sort())
  })
})

describe('counted and drawn by the SPM pool', () => {
  it('counts the loaded T4 and T5 questions per subject, level and difficulty; the held and the Darjah ones are not in it', async () => {
    expect(await spmPool.count(v2.subject)).toBe(3)
    expect(await spmPool.count(v2.subject, { levelId: v2.t4 })).toBe(2)
    expect(await spmPool.count(v2.subject, { levelId: v2.t5 })).toBe(1)
    expect(await spmPool.count(v2.subject, { difficulty: 4 })).toBe(1)
    expect(await spmPool.count(v2.other)).toBe(1) // the T4 question of the other subject
  })

  it('draws pool questions', async () => {
    const drawn = await spmPool.sample(v2.subject, 3, mulberry32(11))
    expect(drawn.map((r) => r.id).sort()).toEqual([loaded['1'], loaded['2'], loaded['3']].sort())
  })
})
