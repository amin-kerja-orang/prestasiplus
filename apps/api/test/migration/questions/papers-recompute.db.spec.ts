/**
 * M-A: a paper loaded by an earlier run is recomputed by the next one while it is still an unedited migration paper.
 *  - draft: the placements of a question that loaded late are added in V2 order, a stale `group_split` hold is cleared, Terbit then picks the
 *    paper up, the paper counts `updated`, and a third run changes 0 rows;
 *  - a placement that points at the legacy question of a wrong dedupe is replaced by the canonical question's own question (read through the id
 *    map of `exam_questions`), V2 order kept;
 *  - published and unedited (audit trail = the migration Terbit only): recomputed and still published; published and edited (a Studio audit
 *    row with a request id): left untouched; a published paper with an exam attempt: left untouched.
 * Synthetic data only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runPapers, runTerbitPass, terbitCandidates } from '../../../src/migration/load/papers'
import { heldDetail } from '../../../src/migration/load/papers/terbit-pass'
import { AS_OF, addArchive, bootQuestions, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
const sql = (t: string, p: unknown[] = []) => h.pool.query(t, p)
const base = () => ({ pool: h.pool, env: h.runEnv, source: 'cloud' as const, asOf: AS_OF, coreAsOf: AS_OF, batchSize: 5 })
const t4 = { subject: 2, level: 2, chapter: 3, topic: 3 }

let lastRepoints: string[] = []
async function papersRun(): Promise<{ inserted: number; updated: number; unchanged: number }> {
  expect((await runPapers({ ...base(), mode: 'dry-run' })).report.status).toBe('succeeded')
  const r = await runPapers({ ...base(), mode: 'apply' })
  expect(r.report.status).toBe('succeeded')
  lastRepoints = r.questions.notes.ids.get('papers.repointed') ?? []
  return (r.report.counters as unknown as Record<string, { inserted: number; updated: number; unchanged: number }>)['exam_papers'] as { inserted: number; updated: number; unchanged: number }
}
const paperOf = async (v2: string): Promise<string> => (await sql(`select new_id from etl_id_map where entity = 'exam_papers' and legacy_id = $1`, [v2])).rows[0].new_id as string
const v3Of = async (legacy: string): Promise<string> => (await sql(`select id::text as id from questions where legacy_source = 'cloud' and legacy_id = $1`, [legacy])).rows[0].id as string
async function placed(v2: string): Promise<string[]> {
  const r = await sql(
    `select pl.question_id::text as q from paper_placements pl join paper_sections s on s.id = pl.paper_section_id
      where s.paper_id = $1::bigint order by s.position, pl.position`,
    [await paperOf(v2)],
  )
  return r.rows.map((x) => x.q as string)
}
const snapshot = async (): Promise<string> =>
  JSON.stringify([
    (await sql(`select id, paper_section_id, question_id, position, pinned_version_no, marks_override from paper_placements order by id`)).rows,
    (await sql(`select id, status, updated_at from papers order by id`)).rows,
    (await sql(`select entity, legacy_id, new_id from etl_id_map where entity like 'exam_paper%' order by entity, legacy_id`)).rows,
  ])

beforeAll(async () => {
  h = await bootQuestions()
  await sql(`insert into staging_cloud.paper_statuses (id, slug) values (91, 'published'), (92, 'draft') on conflict (id) do update set slug = excluded.slug`)
  await sql(`insert into archive_cloud.selection_rules (id, slug) values (1, 'answer_all') on conflict (id) do nothing`)
  await sql(`update education_levels set stage = 'upper_secondary', is_active = true where code = 'T4'`)
  // 973 is NOT in V2's archive yet: the first papers run drops its placements.
  await addArchive(h.pool, [{ id: 971, ...t4 }, { id: 972, ...t4 }, { id: 974, ...t4 }])
  await h.both()
  await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, status_id) values
      (881, 'Kertas Pulih Draf', 2, '1', 90, 91), (882, 'Kertas Pulih Terbit', 2, '1', 90, 91), (883, 'Kertas Pulih Disunting', 2, '1', 90, 91),
      (884, 'Kertas Pulih Gantian', 2, '1', 90, 92), (885, 'Kertas Pulih Percubaan', 2, '1', 90, 91)`)
  await sql(`insert into archive_cloud.paper_sections (id, exam_paper_id, label, position, selection_rule_id) values
      (71, 881, 'Bahagian A', 1, 1), (72, 882, 'Bahagian A', 1, 1), (73, 883, 'Bahagian A', 1, 1), (74, 884, 'Bahagian A', 1, 1), (75, 885, 'Bahagian A', 1, 1)`)
  // eq id -> (paper, position, legacy question)
  const eqs: [number, number, number, number][] = [
    [7081, 881, 1, 971], [7082, 881, 2, 972], [7083, 881, 3, 973],
    [7084, 882, 1, 971], [7085, 882, 2, 973],
    [7086, 883, 1, 971], [7087, 883, 2, 973],
    [7088, 884, 1, 971], [7089, 884, 2, 972],
    [7090, 885, 1, 971], [7091, 885, 2, 973],
  ]
  let pivot = 80
  for (const [eq, paper, pos, legacy] of eqs) {
    pivot += 1
    await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, status_id, position) values ($1, $2, 1, $3)`, [eq, paper, pos])
    await sql(`insert into archive_cloud.legacy_canonical_map (id, source, legacy_id, canonical_type, canonical_id) values ($1, 'questions', $2, 'exam_question', $3)`, [9000 + pivot, String(legacy), eq])
    await sql(`insert into archive_cloud.exam_paper_questions (id, exam_question_id, paper_section_id, sort_order) values ($1, $2, $3, $4)`, [pivot, eq, 70 + (paper - 880), pos])
  }
  // First run: 973 is unknown, so those placements are dropped; every paper holds the questions that resolve.
  const first = await papersRun()
  expect(first.inserted).toBe(5)
}, 600_000)
afterAll(async () => {
  await h?.close()
})

describe('papers recompute (M-A)', () => {
  it('first run: the placements of the late question are missing', async () => {
    expect(await placed('881')).toEqual([await v3Of('971'), await v3Of('972')])
    expect(await placed('882')).toEqual([await v3Of('971')])
  })

  it('sets up the published papers (one unedited, one edited, one with an attempt) and a stale hold', async () => {
    for (const [v2, requestId] of [['882', null], ['883', 'req-studio-1'], ['885', null]] as const) {
      const id = await paperOf(v2)
      await sql(`update papers set status = 'published', published_at = x.t, updated_at = x.t from (select now() as t) x where id = $1::bigint`, [id])
      await sql(`update paper_placements set pinned_version_no = 1, marks_override = 1 where paper_section_id in (select id from paper_sections where paper_id = $1::bigint)`, [id])
      await sql(`insert into audit_events (actor_user_id, action, target_type, target_id, request_id) values (null, 'bijak.paper.published', 'bijak_paper', $1, $2)`, [id, requestId])
    }
    await sql(
      `insert into exam_attempts (user_id, paper_id, paper_kind, title, subject, subject_name, kertas, paper_code, mode, status, started_at, duration_min)
       select (select min(id) from users), $1::bigint, 'pilihan', 'Kertas Pulih Percubaan', 'x', 'x', 1, 'K1', 'exam', 'submitted', now(), 90`,
      [await paperOf('885')],
    )
    // a stale hold on the draft paper that no longer applies once its question loads
    await sql(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', 'exam_paper_holds', '881', 'group_split')`)
    expect((await terbitCandidates(h.pool, 'cloud')).find((c) => c.v2Id === '881')?.holds).toEqual(['group_split'])
  })

  it('a re-run with nothing new changes 0 rows', async () => {
    const before = await snapshot()
    const r = await papersRun()
    // the stale hold is the only change on this run (the question is still missing: a hold of a split group is re-evaluated, here it clears)
    expect(r.inserted).toBe(0)
    expect(r.updated).toBe(1)
    expect(await placed('881')).toEqual([await v3Of('971'), await v3Of('972')])
    const again = await papersRun()
    expect(again).toMatchObject({ inserted: 0, updated: 0 })
    expect(await snapshot()).not.toBe(before)
    const stable = await snapshot()
    await papersRun()
    expect(await snapshot()).toBe(stable)
  })

  it('after the late question loads: draft placements added in V2 order, Terbit picks it up, counted updated, third run 0', async () => {
    await addArchive(h.pool, [{ id: 973, ...t4 }])
    await h.both()
    const r = await papersRun()
    expect(r.inserted).toBe(0)
    // 881 (draft), 882 and 885 (published, unedited; an attempt does not block an ADD) change; 883 (edited) and 884 (nothing new) do not
    expect(r.updated).toBe(3)
    expect(await placed('881')).toEqual([await v3Of('971'), await v3Of('972'), await v3Of('973')])
    expect((await sql(`select status from papers where id = $1::bigint`, [await paperOf('881')])).rows[0].status).toBe('draft')
    const candidates = await terbitCandidates(h.pool, 'cloud')
    expect(candidates.find((c) => c.v2Id === '881')?.holds).toEqual([])
    const report = await runTerbitPass(h.pool, 'cloud', async () => ({ ok: true, errors: [] }))
    expect(report.rows.find((x) => x.v2Id === '881')?.outcome).toBe('published')
    const third = await papersRun()
    expect(third).toMatchObject({ inserted: 0, updated: 0 })
  })

  it('a published, unedited paper is recomputed and stays published; its kept question keeps its pin', async () => {
    expect(await placed('882')).toEqual([await v3Of('971'), await v3Of('973')])
    const row = (await sql(`select status, version from papers where id = $1::bigint`, [await paperOf('882')])).rows[0]
    expect(row).toMatchObject({ status: 'published', version: 1 })
    const pins = (await sql(`select pl.pinned_version_no, pl.marks_override from paper_placements pl join paper_sections s on s.id = pl.paper_section_id where s.paper_id = $1::bigint order by pl.position`, [await paperOf('882')])).rows
    expect(pins[0]).toMatchObject({ pinned_version_no: 1, marks_override: 1 })
    expect(pins[1].pinned_version_no).toBe(1)
  })

  it('a published paper an admin edited (audit row with a request id) is left untouched', async () => {
    expect(await placed('883')).toEqual([await v3Of('971')])
  })

  it('a published paper with an exam attempt gets its missing placement added; the attempt is not touched', async () => {
    expect(await placed('885')).toEqual([await v3Of('971'), await v3Of('973')])
    expect(await h.count('exam_attempts', `t.title = 'Kertas Pulih Percubaan' and t.status = 'submitted'`)).toBe(1)
  })

  it('a placement on the legacy question of a wrong dedupe is replaced by the canonical question, V2 order kept', async () => {
    expect(await placed('884')).toEqual([await v3Of('971'), await v3Of('972')])
    // M-B: the canonical question 7088 is now loaded as its OWN question (id map of exam_questions); here it is the loaded question 974
    await sql(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', 'exam_questions', '7088', $1)`, [await v3Of('974')])
    const r = await papersRun()
    expect(r.updated).toBe(1)
    expect(await placed('884')).toEqual([await v3Of('974'), await v3Of('972')])
    expect(lastRepoints).toEqual([`paper:${await paperOf('884')}|position:1|old:${await v3Of('971')}|new:${await v3Of('974')}`])
    expect(await papersRun()).toMatchObject({ inserted: 0, updated: 0 })
  })

  it('a draft an admin edited (a Studio audit row) is left untouched', async () => {
    const id = await paperOf('884')
    await sql(`insert into audit_events (actor_user_id, action, target_type, target_id, request_id) values (null, 'bijak.paper.updated', 'bijak_paper', $1, 'req-studio-2')`, [id])
    await sql(`update etl_id_map set new_id = (select id::text from questions where legacy_source = 'cloud' and legacy_id = '971') where entity = 'exam_questions' and legacy_id = '7088'`)
    expect((await papersRun()).updated).toBe(0)
    expect(await placed('884')).toEqual([await v3Of('974'), await v3Of('972')])
  })

  it('explains a group_split hold: the group, the members placed out of its members, the Bahagian', async () => {
    const [a, b, c] = [await v3Of('971'), await v3Of('972'), await v3Of('973')]
    const g = (await sql(`insert into stimulus_groups (label, scope) values ('Rajah uji', 'section') returning id::text as id`)).rows[0].id as string
    await sql(`update questions set group_id = $1::bigint, group_position = case id when $2::bigint then 1 when $3::bigint then 2 else 3 end where id in ($2::bigint, $3::bigint, $4::bigint)`, [g, a, b, c])
    // paper 882 places 971 and 973 only (2 of the 3 members)
    expect(await heldDetail(h.pool, await paperOf('882'), ['group_split'])).toEqual(['group_split', `group_split: group ${g} has 2 of 3 members placed, in 1 Bahagian`])
    expect(await heldDetail(h.pool, await paperOf('882'), ['kertas_unknown:composite_document'])).toEqual(['kertas_unknown:composite_document'])
  })
})
