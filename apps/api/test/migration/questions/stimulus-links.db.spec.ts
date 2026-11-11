/**
 * Rajah links of canonical V2 questions (core DSKP rule, review item G-5): a question with its own stimulus shows it (own link), a stimulus shared
 * by several questions is a GROUP stimulus shown by every member in V2 order, a link an earlier run left out is made on the next run, and a re-run
 * changes nothing. The verify check starts from the V2 links and is a mismatch when a loaded question that V2 links to a stimulus shows none.
 * Synthetic rows only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runQuestions } from '../../../src/migration/load/questions'
import { runStructured } from '../../../src/migration/load/questions/structured-index'
import { isEmptyStimulus } from '../../../src/migration/verify/stimulus-link-checks'
import { runVerify } from '../../../src/migration/verify'
import { addArchive, AS_OF, bootQuestions, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
const sql = (text: string, params: unknown[] = []) => h.pool.query(text, params)
const html = (v: string): string => JSON.stringify({ html: v })
const opts = { pool: undefined as never, env: undefined as never }
const NAME = 'stimulus groups: members, order and completeness versus the V2 plan'
const check = async () => (await runVerify({ pool: h.pool, env: h.runEnv, source: 'cloud' })).checks.find((c) => c.name === NAME)

async function slugId(table: string, slug: string): Promise<number> {
  const have = await sql(`select id from staging_cloud.${table} where slug = $1`, [slug])
  if (have.rows[0]) return Number(have.rows[0].id)
  const id = Number((await sql(`select coalesce(max(id), 0) + 1 as id from staging_cloud.${table}`)).rows[0]?.id)
  await sql(`insert into staging_cloud.${table} (id, slug) values ($1, $2)`, [id, slug])
  return id
}

/** Canonical exam question `id` (paper 801, subject 1) at V2 `position`, one MCQ part with four options. */
async function canonical(id: number, position: number, stem: string): Promise<void> {
  await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, source_paper_id, status_id, number_label, position, stem, created_at, updated_at)
             values ($1, 9801, 9901, $2, $3, $5, $4::jsonb, '2025-05-01', '2025-05-01')`, [id, await slugId('question_statuses', 'approved'), String(id), html(`<p>${stem}</p>`), position])
  await sql(`insert into archive_cloud.question_parts (id, exam_question_id, answer_mode_id, marks, position, label, prompt) values ($1, $1, $2, 1, 1, '1', null)`, [id, await slugId('answer_modes', 'mcq')])
  for (const [i, b] of ['Satu', 'Dua', 'Tiga', 'Empat'].entries()) {
    await sql(`insert into archive_cloud.part_options (id, question_part_id, label, body, is_correct, is_distractor, position) values ($1, $2, $3, $4, $5, '0', $6)`, [
      id * 10 + i, id, 'ABCD'.charAt(i), html(`<p>${b} ${id}</p>`), i === 0 ? '1' : '0', i + 1,
    ])
  }
  await sql(`insert into archive_cloud.part_answer_keys (id, question_part_id, answer_key_kind_id, content, marks) values ($1, $1, $2, $3, 0)`, [
    id, await slugId('answer_key_kinds', 'single_key'), JSON.stringify({ option_id: id * 10 }),
  ])
}

async function load(): Promise<void> {
  const base = { ...opts, pool: h.pool, env: h.runEnv, source: 'cloud' as const, asOf: AS_OF, coreAsOf: AS_OF, batchSize: 2 }
  for (const mode of ['dry-run', 'apply'] as const) {
    const r = await runStructured({ ...base, mode })
    expect(r.report.status).toBe('succeeded')
  }
}

const snapshot = async (): Promise<string> =>
  JSON.stringify((await sql(
    `select (select count(*) from questions) q, (select count(*) from stimuli) s, (select count(*) from stimulus_groups) g, (select count(*) from stimulus_group_stimuli) gs,
            (select md5(coalesce(string_agg(question_version_id || ':' || stimulus_id || ':' || position, ',' order by id), '')) from question_version_stimuli) own,
            (select md5(string_agg(entity || legacy_id || new_id, ',' order by entity, legacy_id)) from etl_id_map) m,
            (select md5(string_agg(id::text || coalesce(group_id::text, '-') || coalesce(group_position::text, '-') || updated_at::text, ',' order by id)) from questions) u`)).rows[0])

const qOf = async (v2: number): Promise<string> => (await sql(`select new_id from etl_id_map where entity = 'exam_questions' and legacy_id = $1`, [String(v2)])).rows[0]?.new_id as string
const ownOf = async (v2: number): Promise<string[]> =>
  (await sql(`select s.stimulus_id::text as id from question_version_stimuli s join question_versions v on v.id = s.question_version_id where v.question_id = $1::bigint and v.version_no = 1 order by s.position`, [await qOf(v2)])).rows.map((r) => r.id as string)

beforeAll(async () => {
  h = await bootQuestions()
  await sql(`insert into archive_cloud.source_papers (id, natural_key, subject_id, year) values (9901, 'sp-stim', 1, 2025)`)
  await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, created_at, updated_at) values (9801, 'Kertas', 1, '1', 90, '2025-05-01', '2025-05-01')`)
  await addArchive(h.pool, [{ id: 1, body: 'Soalan biasa tanpa rujukan.' }])
  for (const mode of ['dry-run', 'apply'] as const) {
    const r = await runQuestions({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode, batchSize: 2 })
    expect(r.report.status).toBe('succeeded')
  }
  await sql(`insert into staging_cloud.stimulus_kinds (id, slug) values (91, 'diagram') on conflict (id) do update set slug = excluded.slug`)
  await sql(`insert into archive_cloud.stimuli (id, stimulus_kind_id, body, caption) values (5001, 91, null, 'Rajah 1'), (5002, 91, $1, 'Rajah 2'), (5003, 91, $2, null)`, [html('<p>Petikan bersama.</p>'), html('')])
  // 9101: its own rajah (nobody else uses 5001). 9202 sits BEFORE 9201 in V2 order and both share 5002. 9301 links only an empty stimulus (5003).
  await canonical(9101, 1, 'Rajah 1 menunjukkan sebuah segi tiga. Hitung luas.')
  await canonical(9201, 5, 'Berdasarkan petikan, nyatakan idea utama.')
  await canonical(9202, 4, 'Berdasarkan petikan, nyatakan watak utama.')
  await canonical(9301, 6, 'Soalan dengan rujukan kosong.')
  await sql(`insert into archive_cloud.question_stimulus (id, exam_question_id, stimulus_id, position) values (1, 9101, 5001, 1), (2, 9201, 5002, 1), (3, 9202, 5002, 1), (4, 9301, 5003, 1)`)
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('isEmptyStimulus', () => {
  it('follows the loader rule: no text, no caption, no picture', () => {
    expect(isEmptyStimulus({ body: html(''), caption: null, path: null })).toBe(true)
    expect(isEmptyStimulus({ body: null, caption: 'Rajah 1', path: null })).toBe(false)
    expect(isEmptyStimulus({ body: html(''), caption: null, path: 'exam-media/a.png' })).toBe(false)
  })
})

describe('canonical stimulus links', () => {
  it('links a single own-stimulus question, forms the shared group in V2 order, and verify passes', async () => {
    await load()
    expect(await ownOf(9101), 'own stimulus of 9101').toHaveLength(1)
    const own = (await sql(`select q.group_id from questions q where q.id = $1::bigint`, [await qOf(9101)])).rows[0]
    expect(own?.group_id).toBeNull()
    const g = (await sql(
      `select q.group_id::text as gid, m.legacy_id as v2, q.group_position::int as pos from questions q join etl_id_map m on m.new_id::bigint = q.id and m.entity = 'exam_questions'
        where q.group_id is not null order by q.group_position`)).rows
    expect(g.map((r) => [r.v2, r.pos])).toEqual([['9202', 1], ['9201', 2]])
    expect(new Set(g.map((r) => r.gid)).size).toBe(1)
    expect((await sql(`select count(*)::int as n from stimulus_group_stimuli where group_id = $1::bigint`, [g[0]?.gid])).rows[0]?.n).toBe(1)
    // the shared stimulus is not also an own link of a member, and the empty-stimulus question links nothing
    expect(await ownOf(9201)).toEqual([])
    expect(await ownOf(9301)).toEqual([])
    const c = await check()
    expect(c, JSON.stringify(c)).toMatchObject({ status: 'ok', expected: 0, actual: 0 })
    expect(c?.detail).toContain('4 loaded V2 questions with a stimulus link: 0 show no group and no own stimulus')
    expect(c?.detail).toContain('1 link only empty stimuli')
  })

  it('a second and third run change 0 rows', async () => {
    const before = await snapshot()
    await load()
    expect(await snapshot()).toBe(before)
    await load()
    expect(await snapshot()).toBe(before)
  })

  it('verify is a mismatch when a link is missing, and the next run makes it again (then 0 rows change)', async () => {
    const full = await snapshot()
    await sql(`delete from question_version_stimuli where question_version_id in (select id from question_versions where question_id = $1::bigint)`, [await qOf(9101)])
    const bad = await check()
    expect(bad?.status).toBe('mismatch')
    expect(bad?.actual).toBeGreaterThanOrEqual(1)
    expect(bad?.detail).toContain('1 show no group and no own stimulus (V2 ids 9101)')
    await load()
    expect(await ownOf(9101)).toHaveLength(1)
    expect((await check())?.status).toBe('ok')
    expect(await snapshot()).toBe(full)
    const settled = await snapshot()
    await load()
    expect(await snapshot()).toBe(settled)
  })

  it('verify is a mismatch for a group member detached from its group', async () => {
    await sql(`update questions set group_id = null, group_position = null where id = $1::bigint`, [await qOf(9201)])
    const c = await check()
    expect(c?.status).toBe('mismatch')
    expect(c?.detail).toContain('(V2 ids 9201)')
  })
})
