/**
 * M-B: a canonical V2 question is a copy of a legacy question only when subject, stem, options, correct option and stimulus set agree (case and
 * whitespace aside). Digits and the signs + - . / = % count ('2x+3' is not '2x-3', '1.5 is not '15'). A row that an earlier run wrongly mapped
 * to a legacy question is loaded as its own question on the re-run and its id-map entry is repointed; the legacy question is not touched.
 * Synthetic rows only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runQuestions } from '../../../src/migration/load/questions'
import { normText } from '../../../src/migration/load/questions/canonical-steps'
import { runStructured } from '../../../src/migration/load/questions/structured-index'
import { addArchive, AS_OF, bootQuestions, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
const sql = (text: string, params: unknown[] = []) => h.pool.query(text, params)
const html = (v: string): string => JSON.stringify({ html: v })
const opts = { pool: undefined as never, env: undefined as never }

async function slugId(table: string, slug: string): Promise<number> {
  const have = await sql(`select id from staging_cloud.${table} where slug = $1`, [slug])
  if (have.rows[0]) return Number(have.rows[0].id)
  const id = Number((await sql(`select coalesce(max(id), 0) + 1 as id from staging_cloud.${table}`)).rows[0]?.id)
  await sql(`insert into staging_cloud.${table} (id, slug) values ($1, $2)`, [id, slug])
  return id
}

const legacyOpts = (bodies: string[], correct: number) => bodies.map((body, i) => ({ label: 'ABCD'.charAt(i), body, correct: i === correct }))

/** Canonical exam question `id` (paper 801, subject 1) with MCQ options; the key is the option at `correct`. */
async function canonical(id: number, stem: string, bodies: string[], correct: number): Promise<void> {
  await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, source_paper_id, status_id, number_label, position, stem, created_at, updated_at)
             values ($1, 9801, 9901, $2, $3, $5, $4::jsonb, '2025-05-01', '2025-05-01')`, [id, await slugId('question_statuses', 'approved'), String(id), html(`<p>${stem}</p>`), id])
  await sql(`insert into archive_cloud.question_parts (id, exam_question_id, answer_mode_id, marks, position, label, prompt) values ($1, $1, $2, 1, 1, '1', null)`, [id, await slugId('answer_modes', 'mcq')])
  for (const [i, b] of bodies.entries()) {
    await sql(`insert into archive_cloud.part_options (id, question_part_id, label, body, is_correct, is_distractor, position) values ($1, $2, $3, $4, $5, '0', $6)`, [
      id * 10 + i, id, 'ABCD'.charAt(i), html(`<p>${b}</p>`), i === correct ? '1' : '0', i + 1,
    ])
  }
  await sql(`insert into archive_cloud.part_answer_keys (id, question_part_id, answer_key_kind_id, content, marks) values ($1, $1, $2, $3, 0)`, [
    id, await slugId('answer_key_kinds', 'single_key'), JSON.stringify({ option_id: id * 10 + correct }),
  ])
}

async function both(): Promise<Map<string, number>> {
  const dry = await runStructured({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode: 'dry-run', batchSize: 2 })
  expect(dry.report.status).toBe('succeeded')
  const apply = await runStructured({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode: 'apply', batchSize: 2 })
  expect(apply.report.status).toBe('succeeded')
  return new Map(apply.questions.notes.counters)
}

const snapshot = async (): Promise<string> =>
  JSON.stringify((await sql(
    `select (select count(*) from questions) q, (select count(*) from question_versions) v, (select count(*) from question_parts) p,
            (select md5(string_agg(entity || legacy_id || new_id, ',' order by entity, legacy_id)) from etl_id_map) m,
            (select md5(string_agg(id::text || updated_at::text, ',' order by id)) from questions) u`)).rows[0])

const same = ['Kuala Lumpur', 'Johor Bahru', 'Ipoh', 'Kuching']

beforeAll(async () => {
  h = await bootQuestions()
  await sql(`insert into archive_cloud.source_papers (id, natural_key, subject_id, year) values (9901, 'sp-dedupe', 1, 2025)`)
  await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, created_at, updated_at) values (9801, 'Kertas', 1, '1', 90, '2025-05-01', '2025-05-01')`)
  await addArchive(h.pool, [
    { id: 1, body: 'Apakah ibu negara Malaysia?', options: legacyOpts(same, 0) },
    { id: 2, body: 'Nilai 2x+3 ialah?', options: legacyOpts(['1', '2', '3', '4'], 0) },
    { id: 3, body: 'Berapakah tinggi pokok?', options: legacyOpts(['1.5', '2', '3', '4'], 0) },
    { id: 4, body: 'Pilih jawapan yang betul.', options: legacyOpts(['Satu', 'Dua', 'Tiga', 'Empat'], 0) },
    { id: 5, body: 'Rajah menunjukkan sebuah segi tiga. Hitung luas.', options: legacyOpts(['1', '2', '3', '4'], 0) },
    { id: 6, body: 'Berapakah jisim kotak?', options: legacyOpts(['1.5', '2', '3', '4'], 0) },
  ])
  for (const mode of ['dry-run', 'apply'] as const) {
    const r = await runQuestions({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode, batchSize: 2 })
    expect(r.report.status).toBe('succeeded')
  }
  await canonical(9001, 'APAKAH  ibu negara   Malaysia?', same, 0) // a true duplicate (case and spacing only)
  await canonical(9002, 'Nilai 2x-3 ialah?', ['1', '2', '3', '4'], 0) // sign
  await canonical(9003, 'Berapakah tinggi pokok?', ['15', '2', '3', '4'], 0) // 1.5 versus 15
  await canonical(9004, 'Pilih jawapan yang betul.', ['Satu', 'Dua', 'Tiga', 'Empat'], 1) // same options, other correct option
  await canonical(9005, 'Rajah menunjukkan sebuah segi tiga. Hitung luas.', ['1', '2', '3', '4'], 0)
  await sql(`insert into staging_cloud.stimulus_kinds (id, slug) values (91, 'diagram') on conflict (id) do update set slug = excluded.slug`)
  await sql(`insert into archive_cloud.stimuli (id, stimulus_kind_id, body, caption) values (5001, 91, null, 'Rajah 1')`)
  await sql(`insert into archive_cloud.question_stimulus (id, exam_question_id, stimulus_id, position) values (1, 9005, 5001, 1)`) // its own picture
  // 9006 differs from legacy 6 by digits only; an earlier run (the old rule) mapped it to legacy 6.
  await canonical(9006, 'Berapakah jisim kotak?', ['15', '2', '3', '4'], 0)
}, 300_000)
afterAll(async () => {
  await h?.close()
})

const legacyId = async (legacy: string): Promise<string> => (await sql(`select id::text as id from questions where legacy_source = 'cloud' and legacy_id = $1`, [legacy])).rows[0]?.id as string
const mapOf = async (v2: string): Promise<string | undefined> => (await sql(`select new_id from etl_id_map where entity = 'exam_questions' and legacy_id = $1`, [v2])).rows[0]?.new_id as string | undefined

describe('normText', () => {
  it('folds case and whitespace only', () => {
    expect(normText('  APAKAH   ibu\nnegara ')).toBe('apakah ibu negara')
    expect(normText('2x+3')).not.toBe(normText('2x-3'))
    expect(normText('1.5')).not.toBe(normText('15'))
    expect(normText('50%')).not.toBe(normText('50'))
  })
})

describe('canonical rows that look like legacy questions', () => {
  let wrongTarget = ''
  let legacySixBefore = ''

  it('a wrong dedupe of an earlier run is seeded (9006 mapped to legacy 6)', async () => {
    wrongTarget = await legacyId('6')
    await sql(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', 'exam_questions', '9006', $1)`, [wrongTarget])
    legacySixBefore = JSON.stringify((await sql(`select q.*, v.stem_ms, v.updated_at as vu from questions q join question_versions v on v.question_id = q.id where q.id = $1::bigint`, [wrongTarget])).rows)
    expect(await mapOf('9006')).toBe(wrongTarget)
  })

  it('dedupes only the true duplicate, loads every near miss as its own question, and repoints the wrong dedupe', async () => {
    const notes = await both()
    expect(notes.get('canonical.deduped_to_legacy')).toBe(1)
    expect(await mapOf('9001')).toBe(await legacyId('1'))
    for (const id of ['9002', '9003', '9004', '9005', '9006']) {
      const target = await mapOf(id)
      expect(target, id).toBeDefined()
      const q = (await sql(`select legacy_id from questions where id = $1::bigint`, [target])).rows[0]
      expect(q, id).toBeDefined()
      expect(q?.legacy_id, `${id} is its own canonical question`).toBeNull()
    }
    expect(notes.get('canonical.dedupe_repointed')).toBe(1)
    expect(await mapOf('9006')).not.toBe(wrongTarget)
    // the wrong legacy question is untouched
    const after = JSON.stringify((await sql(`select q.*, v.stem_ms, v.updated_at as vu from questions q join question_versions v on v.question_id = q.id where q.id = $1::bigint`, [wrongTarget])).rows)
    expect(after).toBe(legacySixBefore)
    // no canonical question was loaded for the true duplicate
    expect((await sql(`select count(*)::int as n from questions where legacy_id is null`)).rows[0]?.n).toBe(5)
  })

  it('a third run changes nothing', async () => {
    const before = await snapshot()
    const notes = await both()
    expect(notes.get('canonical.dedupe_repointed') ?? 0).toBe(0)
    expect(await snapshot()).toBe(before)
  })
})
