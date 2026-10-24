/**
 * `migrate:questions` (QLOAD) against a real PostgreSQL: guards, dry-run, apply, reconciliation, idempotency, resume, rejects,
 * excluded counters, preflight, the source lock and the printed report. Synthetic archive rows only.
 */
import { randomBytes } from 'node:crypto'
import { readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApplyGuardError } from '../../../src/migration/kit/apply-guard'
import { ApplyRefusedError, Runner } from '../../../src/migration/kit/runner'
import { SourceLockBusyError } from '../../../src/migration/kit/source-lock'
import { buildQuestionsSteps, QuestionsContext, runQuestions } from '../../../src/migration/load/questions'
import { migrateQuestions } from '../../../src/migration/load/questions/command'
import { PreflightError } from '../../../src/migration/load/activity/preflight'
import { createStagingDb } from '../staging/helpers'
import { addArchive, AS_OF, bootQuestions, four, questionTableCounts, type QuestionsHarness } from './helpers'

let h: QuestionsHarness

beforeAll(async () => {
  h = await bootQuestions()
}, 300_000)
afterAll(async () => {
  await h?.close()
})

const rejects = async (runId: string): Promise<Record<string, number>> => {
  const rows = await h.q<{ k: string; n: number }>(
    `select reason || ':' || coalesce(column_name, '') as k, count(*)::int as n from etl_rejects where run_id = $1::bigint and entity = 'questions' group by 1`,
    [runId],
  )
  return Object.fromEntries(rows.map((r) => [r.k, r.n]))
}

describe('guards', () => {
  it('an apply needs PP_ALLOW_MIGRATE_APPLY=1 and a passing dry-run of the same input', async () => {
    await h.reset()
    await addArchive(h.pool, [{ id: 1 }])
    await expect(h.run('apply', { env: { NODE_ENV: 'test' } })).rejects.toThrow(ApplyGuardError)
    await expect(h.run('apply')).rejects.toThrow(ApplyRefusedError)
    expect(await h.count('questions', `t.legacy_source = 'cloud'`)).toBe(0)
  })

  it('refuses a database where migrate:core has not run (dry-run too)', async () => {
    const fresh = await createStagingDb()
    try {
      await expect(
        runQuestions({ pool: fresh.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, mode: 'dry-run' }),
      ).rejects.toThrow(PreflightError)
    } finally {
      await fresh.close()
    }
  })

  it('an apply is refused when the curriculum id map changed after the dry-run (a migrate:core re-run)', async () => {
    await h.reset()
    await addArchive(h.pool, [{ id: 2 }])
    const dry = await h.run('dry-run')
    expect(dry.report.status).toBe('succeeded')
    const row = (await h.q<{ id: string; new_id: string }>(`select id::text as id, new_id from etl_id_map where legacy_source = 'cloud' and entity = 'chapters' order by id limit 1`))[0]
    expect(row).toBeDefined()
    await h.q(`update etl_id_map set new_id = new_id || '0' where id = $1::bigint`, [row?.id])
    try {
      await expect(h.run('apply')).rejects.toThrow(ApplyRefusedError)
    } finally {
      await h.q(`update etl_id_map set new_id = $2 where id = $1::bigint`, [row?.id, row?.new_id])
    }
  })

  it('the questions table pairs legacy_source and legacy_id (migration 0043 check)', async () => {
    await expect(h.q(`insert into questions (legacy_source) values ('cloud')`)).rejects.toThrow(/ck_questions_legacy_pair/)
    await expect(h.q(`insert into questions (legacy_id) values ('1')`)).rejects.toThrow(/ck_questions_legacy_pair/)
  })

  it('refuses an archive staged before the new spec (a missing column), naming the column', async () => {
    await h.pool.query(`alter table archive_cloud.questions rename column explanation to explanation_gone`)
    try {
      await expect(h.run('dry-run')).rejects.toThrow(/lacks column\(s\) explanation/)
    } finally {
      await h.pool.query(`alter table archive_cloud.questions rename column explanation_gone to explanation`)
    }
  })
})

describe('dry-run, apply, reconciliation and the data written', () => {
  const ids = { ok: 10, held: 11, t4: 12, noChapter: 13 }

  it('dry-run writes nothing; apply loads, reconciles and counts excluded and rejected rows by reason', async () => {
    await h.reset()
    await addArchive(h.pool, [
      // loaded
      { id: ids.ok, difficulty: '4', explanation: 'Kerana contoh.', chapter: 1, topic: 4, body: 'Apakah warna langit?' },
      { id: ids.held, image: 'questions/gambar.png', options: four().map((o, i) => (i === 2 ? { ...o, image: 'options/c.png' } : o)) },
      { id: ids.t4, level: 2, subject: 2, chapter: 3, topic: 3, options: four(2) },
      { id: ids.noChapter, chapter: null, topic: null, difficulty: 'x' },
      // excluded (status / type)
      { id: 20, status: 'draf' }, { id: 21, status: 'ditolak' }, { id: 22, status: 'diarkib' }, { id: 23, type: 'subjective', options: [] },
      // rejected
      { id: 30, options: four().slice(0, 2) },
      { id: 31, options: four().map((o) => ({ ...o, correct: false })) },
      { id: 32, options: four().map((o) => ({ ...o, correct: true })) },
      { id: 33, body: '  ' },
      { id: 34, subject: 777 },
      { id: 35, level: 777 },
      { id: 36, options: four().map((o, i) => (i === 3 ? { ...o, label: 'A' } : o)) },
      { id: 37, options: four().map((o, i) => (i === 3 ? { ...o, body: '' } : o)) },
      { id: 38, options: four().map((o, i) => (i === 3 ? { ...o, label: 'Z' } : o)) },
    ])
    const before = await questionTableCounts(h.pool)
    const idMapBefore = await h.count('etl_id_map', `t.entity = 'questions'`)

    const dry = await h.run('dry-run')
    expect(dry.report.status).toBe('succeeded')
    expect(await questionTableCounts(h.pool)).toEqual(before)
    expect(await h.count('etl_id_map', `t.entity = 'questions'`)).toBe(idMapBefore)

    const applied = await h.run('apply')
    expect(applied.report.status).toBe('succeeded')
    const recon = applied.report.recon[0]
    expect(recon).toMatchObject({ entity: 'questions', sourceCount: 17, eligibleCount: 13, loaded: 4, rejected: 9, expectedDelta: 0, status: 'ok' })
    expect(await rejects(applied.report.runId)).toEqual({
      'INVALID_VALUE:options': 1, 'INVALID_VALUE:is_correct': 2, 'INVALID_VALUE:body': 1, 'ORPHAN_PARENT:subject_id': 1,
      'ORPHAN_PARENT:education_level_id': 1, 'DUPLICATE_KEY:label': 1, 'INVALID_VALUE:options.body': 1, 'INVALID_VALUE:label': 1,
    })
    expect(Object.fromEntries([...applied.notes].filter(([k]) => k.includes('excluded')))).toEqual({
      'questions.excluded.status.draf': 1, 'questions.excluded.status.ditolak': 1, 'questions.excluded.status.diarkib': 1, 'questions.excluded.type.subjective': 1,
    })
    expect(applied.notes.get('questions.held_image')).toBe(1)
    expect(applied.notes.get('questions.difficulty_missing')).toBe(1)
    expect(applied.notes.get('questions.chapter_missing')).toBe(1)
    // The run is recorded with its commit (best effort) and the id map points at the new questions.
    const run = await h.q<{ mode: string; status: string; entity_set: string[] }>(`select mode, status, entity_set from etl_runs where id = $1::bigint`, [applied.report.runId])
    expect(run[0]).toMatchObject({ mode: 'apply', status: 'succeeded', entity_set: ['questions'] })
    expect(await h.count('etl_id_map', `t.entity = 'questions'`)).toBe(4)

    expect(await questionTableCounts(h.pool)).toEqual({
      questions: before.questions + 4, question_versions: before.question_versions + 4, question_parts: before.question_parts + 4,
      part_options: before.part_options + 16, answer_keys: before.answer_keys + 4, question_tags: before.question_tags + 1,
    })
  })

  it('writes published, live, active single-part MCQs with the mapped curriculum, key, tag and held-image rule', async () => {
    const rows = await h.q<Record<string, unknown>>(
      `select q.legacy_id, q.is_active, q.live_version_no, q.latest_version_no, q.created_by_id, q.source_type, q.group_id,
              v.status, v.published_at is not null as published, v.type, v.stem_ms, v.explanation_ms, v.language, v.form_origin,
              v.difficulty_tp, v.cognitive_level, v.unit_node_id, v.rights_status, v.import_issues,
              v.subject_id::text as subject_id, v.education_level_id::text as level_id, v.chapter_id::text as chapter_id, v.topic_id::text as topic_id,
              p.label as part_label, p.prompt_ms, p.marks, p.mode, p.depth,
              (select count(*)::int from question_version_sp_nodes s where s.question_version_id = v.id) as sp_nodes,
              (select jsonb_agg(jsonb_build_object('l', o.label, 'b', o.body_ms, 'p', o.position, 'i', o.image_file_id) order by o.position) from part_options o where o.part_id = p.id) as options,
              (select k.kind || ':' || (k.content->>'correct') from answer_keys k where k.part_id = p.id) as key,
              (select string_agg(t.kind || ':' || t.code, ',') from question_tags t where t.question_id = q.id) as tags
         from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
         join question_parts p on p.question_version_id = v.id
        where q.legacy_source = 'cloud' order by q.legacy_id::int`,
    )
    expect(rows.map((r) => r.legacy_id)).toEqual(['10', '11', '12', '13'])
    const [ok, held, t4, none] = rows as [Record<string, unknown>, Record<string, unknown>, Record<string, unknown>, Record<string, unknown>]
    const map = async (entity: string, legacy: string) => (await h.q<{ new_id: string }>(`select new_id from etl_id_map where legacy_source = 'cloud' and entity = $1 and legacy_id = $2`, [entity, legacy]))[0]?.new_id
    expect(ok).toMatchObject({
      is_active: true, live_version_no: 1, latest_version_no: 1, created_by_id: null, source_type: null, group_id: null, status: 'published', published: true,
      type: 'mcq', stem_ms: 'Apakah warna langit?', prompt_ms: 'Apakah warna langit?', explanation_ms: 'Kerana contoh.', language: 'ms', form_origin: 't1_t3',
      difficulty_tp: 4, cognitive_level: null, unit_node_id: null, sp_nodes: 0, rights_status: 'unclear', import_issues: null,
      part_label: '1', marks: 1, mode: 'mcq', depth: 1, key: 'option:A', tags: null,
    })
    expect(ok.subject_id).toBe(await map('subjects', '1'))
    expect(ok.level_id).toBe(await map('education_levels', '1'))
    expect(ok.chapter_id).toBe(await map('chapters', '1'))
    expect(ok.topic_id).toBe(await map('topics', '4'))
    expect(ok.options).toEqual([{ l: 'A', b: 'Satu', p: 1, i: null }, { l: 'B', b: 'Dua', p: 2, i: null }, { l: 'C', b: 'Tiga', p: 3, i: null }, { l: 'D', b: 'Empat', p: 4, i: null }])
    // Held for a missing image: published and live, but not active; the paths are only kept as a list.
    expect(held).toMatchObject({ is_active: false, status: 'published', live_version_no: 1 })
    expect(held.import_issues).toEqual([
      { code: 'legacy_image_unresolved', target: 'question', path: 'questions/gambar.png' },
      { code: 'legacy_image_unresolved', target: 'option', label: 'C', path: 'options/c.png' },
    ])
    // Tingkatan 4: form origin t4 and the SPM pool tag, nothing else.
    expect(t4).toMatchObject({ form_origin: 't4', tags: 'pool:spm', key: 'option:C', unit_node_id: null })
    // Missing chapter and an unparsable difficulty are loaded, empty.
    expect(none).toMatchObject({ chapter_id: null, topic_id: null, difficulty_tp: null, is_active: true })
  })

  it('a second run changes nothing: every row unchanged, no new row in any table', async () => {
    const before = await questionTableCounts(h.pool)
    const { dry, apply } = await h.both()
    for (const r of [dry, apply]) expect(r.recon[0]).toMatchObject({ eligibleCount: 13, loaded: 4, rejected: 9, status: 'ok' })
    expect(apply.counters.questions).toMatchObject({ inserted: 0, updated: 0, unchanged: 4 })
    expect(await questionTableCounts(h.pool)).toEqual(before)
  })
})

describe('resume after a crash', () => {
  it('continues at the next batch of the same run and ends with exactly the rows of an uninterrupted run', async () => {
    await h.reset()
    await addArchive(h.pool, Array.from({ length: 9 }, (_, i) => ({ id: 100 + i, body: `Soalan resume ${i}?` })))
    const make = (failAt?: number) => {
      const ctx = new QuestionsContext({ pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, pageSize: 2 })
      const steps = buildQuestionsSteps(ctx).map((s) => {
        let n = 0
        return failAt === undefined ? s : { ...s, load: async (rows: unknown[], c: never) => (++n === failAt ? Promise.reject(new Error('simulated crash')) : s.load(rows, c)) }
      })
      return { steps, runner: new Runner({ pool: h.pool, env: h.runEnv }) }
    }
    const hash = 'questions-resume-test'
    const dry = await make().runner.run({ mode: 'dry-run', steps: make().steps, inputHash: hash, batchSize: 2 })
    expect(dry.status).toBe('succeeded')
    const crash = make(3)
    await expect(crash.runner.run({ mode: 'apply', steps: crash.steps, inputHash: hash, batchSize: 2 })).rejects.toThrow('simulated crash')
    expect(await h.count('questions', `t.legacy_source = 'cloud'`)).toBe(4) // two committed batches of two
    const resumed = make()
    const done = await resumed.runner.run({ mode: 'apply', steps: resumed.steps, inputHash: hash, batchSize: 2 })
    expect(done.status).toBe('succeeded')
    expect(done.resumedBatches).toBe(2)
    expect(await h.count('questions', `t.legacy_source = 'cloud'`)).toBe(9)
    expect(await h.count('question_versions', `t.question_id in (select id from questions where legacy_source = 'cloud')`)).toBe(9)
    expect(await h.count('etl_id_map', `t.entity = 'questions'`)).toBe(9)
    expect(await h.count('part_options', `t.part_id in (select p.id from question_parts p join question_versions v on v.id = p.question_version_id join questions q on q.id = v.question_id where q.legacy_source = 'cloud')`)).toBe(36)
  })
})

describe('the command', () => {
  const ctxOf = () => {
    const lines: string[] = []
    return { lines, ctx: { pool: h.pool, env: h.runEnv, out: (l: string) => void lines.push(l), err: (l: string) => void lines.push(l) } }
  }
  const args = (mode: 'dry-run' | 'apply', flags: [string, string | true][] = []) => ({ mode, flags: new Map<string, string | true>([['batch-size', '2'], ['as-of', AS_OF], ...flags]), positional: [] as string[] })

  it('prints the reconciliation table and counters, never a question text, and exits 0', async () => {
    await h.reset()
    await addArchive(h.pool, [{ id: 200, body: 'TEKS-RAHSIA-JANGAN-CETAK', explanation: 'PENJELASAN-RAHSIA' }, { id: 201, status: 'draf' }])
    const { lines, ctx } = ctxOf()
    expect(await migrateQuestions.run(args('dry-run', [['core-as-of', AS_OF]]), ctx)).toBe(0)
    const text = lines.join('\n')
    expect(text).toContain('migrate:questions dry-run')
    expect(text).toContain('entity | source | eligible | loaded | rejected | status')
    expect(text).toMatch(/questions \| 2 \| 1 \| 1 \| 0 \| ok/)
    expect(text).toContain('note questions.excluded.status.draf: 1')
    expect(text).not.toMatch(/RAHSIA/)
  })

  it('writes a counts-only JSON report to --out-dir and exits 1 when the archive has rows but none is eligible', async () => {
    await h.reset()
    await addArchive(h.pool, [{ id: 300, status: 'draf', body: 'TEKS-RAHSIA-2' }, { id: 301, type: 'subjective', options: [] }])
    const dir = join(process.cwd(), '.migration-out', `qload-test-${randomBytes(3).toString('hex')}`)
    const { lines, ctx } = ctxOf()
    expect(await migrateQuestions.run(args('dry-run', [['core-as-of', AS_OF], ['out-dir', dir]]), ctx)).toBe(1)
    expect(lines.join('\n')).toMatch(/migrate:questions FAILED: eligible = 0 of 2/)
    const files = readdirSync(dir).filter((f) => f.startsWith('questions-dry-run-'))
    expect(files).toHaveLength(1)
    const text = readFileSync(join(dir, files[0] as string), 'utf8')
    const report = JSON.parse(text) as { recon: { entity: string; sourceCount: number; eligibleCount: number }[]; notes: Record<string, number>; rejects: unknown[] }
    expect(report.recon[0]).toMatchObject({ entity: 'questions', sourceCount: 2, eligibleCount: 0 })
    expect(report.notes['questions.excluded.status.draf']).toBe(1)
    expect(text).not.toMatch(/RAHSIA/)
    expect(statSync(join(dir, files[0] as string)).mode & 0o777).toBe(0o600)
    rmSync(dir, { recursive: true, force: true })
  })

  it('refuses an unknown flag and a bad value (exit 2 family)', async () => {
    await expect(migrateQuestions.run(args('dry-run', [['talbe', 'x']]), ctxOf().ctx)).rejects.toThrow(ApplyGuardError)
    await expect(migrateQuestions.run(args('dry-run', [['as-of', '2026-13-45']]), ctxOf().ctx)).rejects.toThrow(/YYYY-MM-DD/)
    await expect(migrateQuestions.run(args('dry-run', [['batch-size', '0']]), ctxOf().ctx)).rejects.toThrow(/positive integer/)
  })

  it('refuses while another migration holds the source lock', async () => {
    const holder = await h.pool.connect()
    try {
      const got = await holder.query<{ ok: boolean }>(`select pg_try_advisory_lock(hashtextextended('etl:source:cloud', 0)) as ok`)
      expect(got.rows[0]?.ok).toBe(true)
      await expect(migrateQuestions.run(args('dry-run'), ctxOf().ctx)).rejects.toThrow(SourceLockBusyError)
    } finally {
      await holder.query(`select pg_advisory_unlock(hashtextextended('etl:source:cloud', 0))`)
      holder.release()
    }
  })
})

describe('statistics after the load', () => {
  it('an apply analyses the loaded tables after the last batch, one line; a dry-run does not', async () => {
    await h.reset()
    await addArchive(h.pool, [{ id: 61 }, { id: 62 }, { id: 63 }])
    const analyzeCount = async (): Promise<number> => {
      await h.q('select pg_stat_force_next_flush()')
      return Number((await h.q<{ n: string }>(`select coalesce(sum(analyze_count), 0)::text as n from pg_stat_user_tables where relname in ('questions','question_versions','question_parts','part_options','answer_keys','question_tags','etl_id_map')`))[0]?.n)
    }
    const lines: string[] = []
    const before = await analyzeCount()
    const dry = await h.run('dry-run', { progress: (l) => lines.push(l) })
    expect(dry.report.status).toBe('succeeded')
    expect(lines.filter((l) => l.startsWith('analyzed'))).toEqual([])
    expect(await analyzeCount()).toBe(before)
    const apply = await h.run('apply', { progress: (l) => lines.push(l) })
    expect(apply.report.status).toBe('succeeded')
    expect(lines.filter((l) => l.startsWith('analyzed'))).toEqual(['analyzed 7 tables: questions, question_versions, question_parts, part_options, answer_keys, question_tags, etl_id_map'])
    expect(await analyzeCount()).toBeGreaterThanOrEqual(before + 7)
  })
})
