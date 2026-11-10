/**
 * C-1: a rajah group member that was quarantined in an earlier run and loads in a later one is attached to the existing group, in V2 order,
 * counted `updated`; a pass with nothing new changes 0 rows.
 * C-3: a canonical group renumbers EVERY member after the +3000 shift, so positions never overflow SMALLINT over many batches.
 * Synthetic rows only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runQuestions } from '../../../src/migration/load/questions'
import { runStructured } from '../../../src/migration/load/questions/structured-index'
import { addArchive, AS_OF, bootQuestions, four, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
const sql = (text: string, params: unknown[] = []) => h.pool.query(text, params)
const html = (v: string): string => JSON.stringify({ html: v })
const opts = { pool: undefined as never, env: undefined as never }

beforeAll(async () => {
  h = await bootQuestions()
}, 300_000)
afterAll(async () => {
  await h?.close()
})

describe('C-1: a member loaded by a later run joins the existing rajah group', () => {
  const rows = async () =>
    (await sql(
      `select q.legacy_id, q.group_id::text as group_id, q.group_position, q.is_active, q.updated_at::text as updated_at,
              coalesce(v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb, false) as held
         from questions q join question_versions v on v.question_id = q.id and v.version_no = 1 where q.legacy_source = 'cloud' order by q.legacy_id::bigint`,
    )).rows
  const groupCounters = (r: { report: { counters: Record<string, { inserted: number; updated: number; unchanged: number }> } }) => r.report.counters.stimulus_groups

  it('first run with one member quarantined, a re-run that loads it, and a third run that changes 0 rows', async () => {
    await addArchive(h.pool, [
      { id: 301001, body: 'Rajah 1', image: 'soalan/late.png', options: [] },
      { id: 301002, body: 'Berdasarkan Rajah 1, hitung luas kawasan berlorek.', options: four() },
      { id: 301003, body: 'Berdasarkan Rajah 1, nyatakan jenis sudut.', status: 'xyz', options: four() }, // unknown status: quarantined
      { id: 301004, body: 'Berdasarkan Rajah 1, hitung perimeter.', options: four() },
      { id: 301005, body: 'Berdasarkan Rajah 1, hitung isipadu.', status: 'xyz', options: four() }, // a second late member
    ])
    const run = async () => {
      const dry = await runQuestions({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode: 'dry-run', batchSize: 2 })
      expect(dry.report.status).toBe('succeeded')
      const apply = await runQuestions({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode: 'apply', batchSize: 2 })
      expect(apply.report.status).toBe('succeeded')
      return { report: apply.report, notes: apply.questions.notes.counters as ReadonlyMap<string, number> }
    }

    const first = await run()
    expect(groupCounters(first)).toMatchObject({ inserted: 1 })
    const r1 = await rows()
    expect(r1.map((r) => r.legacy_id)).toEqual(['301002', '301004'])
    expect(r1.map((r) => r.group_position)).toEqual([1, 2])

    await sql(`update archive_cloud.questions set status = 'diluluskan' where id in (301003, 301005)`)
    const second = await run()
    // one GROUP row changed (two members were attached: the member count is the note, not the counter), and the reconciliation still balances
    expect(groupCounters(second)).toMatchObject({ inserted: 0, updated: 1, unchanged: 0 })
    expect(second.report.recon.find((x) => x.entity === 'stimulus_groups')?.status).toBe('ok')
    expect(second.notes.get('groups.late_attached')).toBe(2)
    const r2 = await rows()
    expect(r2.map((r) => r.legacy_id)).toEqual(['301002', '301003', '301004', '301005'])
    expect(new Set(r2.map((r) => r.group_id)).size).toBe(1)
    expect(r2[0]?.group_id).not.toBeNull()
    expect(r2.map((r) => r.group_position)).toEqual([1, 2, 3, 4]) // V2 order
    expect(r2[1]).toMatchObject({ is_active: false, held: true }) // the picture is still not copied: the late member joins the hold

    const before = JSON.stringify(await rows())
    const third = await run()
    expect(groupCounters(third)).toMatchObject({ inserted: 0, updated: 0 })
    expect(JSON.stringify(await rows())).toBe(before)
  })
})

describe('C-3: many batches renumber every member of a canonical group', () => {
  async function canonical(id: number): Promise<void> {
    const slug = async (table: string, s: string): Promise<number> => {
      const have = await sql(`select id from staging_cloud.${table} where slug = $1`, [s])
      if (have.rows[0]) return Number(have.rows[0].id)
      const nid = Number((await sql(`select coalesce(max(id), 0) + 1 as id from staging_cloud.${table}`)).rows[0]?.id)
      await sql(`insert into staging_cloud.${table} (id, slug) values ($1, $2)`, [nid, s])
      return nid
    }
    await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, source_paper_id, status_id, number_label, position, stem, created_at, updated_at)
               values ($1, 9802, 9902, $2, $4, $5, $3::jsonb, '2025-05-01', '2025-05-01')`, [id, await slug('question_statuses', 'approved'), html(`<p>Soalan kumpulan nombor ${id}?</p>`), String(id), id])
    await sql(`insert into archive_cloud.question_parts (id, exam_question_id, answer_mode_id, marks, position, label, prompt) values ($1, $1, $2, 1, 1, '1', null)`, [id, await slug('answer_modes', 'mcq')])
    for (let i = 0; i < 4; i += 1) {
      await sql(`insert into archive_cloud.part_options (id, question_part_id, label, body, is_correct, is_distractor, position) values ($1, $2, $3, $4, $5, '0', $6)`, [
        id * 10 + i, id, 'ABCD'.charAt(i), html(`<p>Jawapan ${id} ${'ABCD'.charAt(i)}</p>`), i === 0 ? '1' : '0', i + 1,
      ])
    }
    await sql(`insert into archive_cloud.part_answer_keys (id, question_part_id, answer_key_kind_id, content, marks) values ($1, $1, $2, $3, 0)`, [id, await slug('answer_key_kinds', 'single_key'), JSON.stringify({ option_id: id * 10 })])
  }
  const runBatches = async () => {
    for (const mode of ['dry-run', 'apply'] as const) {
      const r = await runStructured({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode, batchSize: 1 })
      expect(r.report.status).toBe('succeeded')
    }
  }

  it('keeps positions 1..n in V2 order with a non-exam member in the group and 13 batches', async () => {
    await sql(`insert into archive_cloud.source_papers (id, natural_key, subject_id, year) values (9902, 'sp-late', 1, 2025)`)
    await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, created_at, updated_at) values (9802, 'Kertas', 1, '1', 90, '2025-05-01', '2025-05-01')`)
    await sql(`insert into staging_cloud.stimulus_kinds (id, slug) values (92, 'passage') on conflict (id) do update set slug = excluded.slug`)
    await sql(`insert into archive_cloud.stimuli (id, stimulus_kind_id, body, caption) values (6001, 92, $1, null)`, [html('<p>Petikan bersama.</p>')])
    await canonical(9101)
    await canonical(9102)
    await sql(`insert into archive_cloud.question_stimulus (id, exam_question_id, stimulus_id, position) values (101, 9101, 6001, 1), (102, 9102, 6001, 1)`)
    await runBatches()
    const gid = (await sql(`select q.group_id::text as id from questions q join etl_id_map m on m.new_id::bigint = q.id and m.entity = 'exam_questions' and m.legacy_id = '9101'`)).rows[0]?.id as string
    expect(gid).toBeTruthy()
    // a member that is not an exam question (a legacy-bank question) sits in the group
    await addArchive(h.pool, [{ id: 777001, body: 'Soalan lama dalam kumpulan?', options: four() }])
    await runQuestions({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode: 'dry-run', batchSize: 2 })
    await runQuestions({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode: 'apply', batchSize: 2 })
    await sql(`update questions set group_id = $1::bigint, group_position = 50 where legacy_source = 'cloud' and legacy_id = '777001'`, [gid])

    for (let id = 9103; id <= 9114; id += 1) {
      await canonical(id)
      await sql(`insert into archive_cloud.question_stimulus (id, exam_question_id, stimulus_id, position) values ($1, $1, 6001, 1)`, [id])
    }
    await runBatches() // 12 batches of one question: the old shift reached 50 + 12 * 3000 > 32767

    const pos = (await sql(`select q.group_position as p, m.legacy_id as v2 from questions q left join etl_id_map m on m.new_id::bigint = q.id and m.entity = 'exam_questions' where q.group_id = $1::bigint order by q.group_position`, [gid])).rows
    expect(pos.map((r) => r.p)).toEqual(Array.from({ length: 15 }, (_, i) => i + 1))
    expect(pos.slice(0, 14).map((r) => r.v2)).toEqual(Array.from({ length: 14 }, (_, i) => String(9101 + i)))
    expect(pos[14]?.v2).toBeNull() // the non-exam member follows the exam questions
  }, 240_000)
})
