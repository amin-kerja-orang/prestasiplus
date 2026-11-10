/**
 * T-B9-6, T-B9-7, T-B10-1..3 against a real PostgreSQL: structured, subjective and canonical-only loaders, SPM tracking sets, blueprints
 * and papers (group integrity included), idempotency, and a read of every loaded question through V3's own strict part reader.
 * Synthetic archive rows only.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runPapers } from '../../../src/migration/load/papers'
import { runStructured } from '../../../src/migration/load/questions/structured-index'
import { partsFromRows } from '../../../src/modules/questions/tree'
import { AS_OF, bootQuestions, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
beforeAll(async () => {
  h = await bootQuestions()
}, 300_000)
afterAll(async () => {
  await h?.close()
})

const sql = (text: string, params: unknown[] = []) => h.pool.query(text, params)
const opts = { pool: undefined as never, env: undefined as never }
async function runBank(mode: 'dry-run' | 'apply') {
  return runStructured({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode, batchSize: 2 })
}
async function runPaperSteps(mode: 'dry-run' | 'apply') {
  return runPapers({ ...opts, pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode, batchSize: 2 })
}
async function both(fn: typeof runBank) {
  const dry = await fn('dry-run')
  expect(dry.report.status).toBe('succeeded')
  const apply = await fn('apply')
  expect(apply.report.status).toBe('succeeded')
  return apply
}

async function seedArchive() {
  await sql(`insert into archive_cloud.questions (id, subject_id, education_level_id, type, status, body, explanation, created_at, updated_at) values
    (901, 1, 2, 'subjektif', 'diarkib', 'Huraikan satu contoh A.', 'Jawapan model A.', '2025-01-01', '2025-01-01'),
    (902, 1, 2, 'subjektif', 'diluluskan', 'Huraikan satu contoh B.', 'Jawapan model B.', '2025-01-01', '2025-01-01'),
    (903, 1, 2, 'subjektif', 'draf', 'Huraikan satu contoh C.', null, '2025-01-01', '2025-01-01'),
    (904, 2, 2, 'subjektif', 'diluluskan', 'Huraikan satu contoh D.', 'Jawapan model D.', '2025-01-01', '2025-01-01'),
    (905, 1, 2, 'subjektif', 'diluluskan', 'Huraikan satu contoh E.', 'Jawapan model E.', '2025-01-01', '2025-01-01')`)
  await sql(`insert into archive_cloud.structured_questions (id, subject_id, education_level_id, status, stimulus, kbat_level, total_marks, created_at, updated_at) values
    (1, 1, 2, 'diluluskan', 'Petikan struktur contoh.', 'menganalisis', 6, '2025-01-01', '2025-01-01'),
    (2, 1, 2, 'diluluskan', 'Petikan tanpa skema.', 'lots', 2, '2025-01-01', '2025-01-01'),
    (3, 1, 2, 'diarkib', 'Petikan arkib.', null, 1, '2025-01-01', '2025-01-01'),
    (4, 1, 2, 'xyz', 'Status tidak dikenali.', null, 1, '2025-01-01', '2025-01-01')`)
  await sql(`insert into archive_cloud.structured_sub_questions (id, structured_question_id, number, body, marks, scheme) values
    (11, 1, '(a)(i)', 'Sub satu.', 1, 'Skema satu.'),
    (12, 1, '(a)(ii)', 'Sub dua.', 2, 'Skema dua.'),
    (13, 1, '(b)', 'Sub tiga.', 3, 'Skema tiga.'),
    (21, 2, '(a)', 'Sub tanpa skema.', 2, null),
    (31, 3, '1', 'Sub arkib.', 1, 'Skema arkib.'),
    (41, 4, '1', 'Sub x.', 1, 'x')`)
  await sql(`insert into archive_cloud.structured_rubric_points (id, structured_sub_question_id, code, text, marks, position) values
    (1, 13, 'A1', 'Titik satu', 1, 0), (2, 13, 'A2', 'Titik dua', 2, 1)`)
}

describe('structured and subjective', () => {
  it('loads every class with its real status, a points key and nested labels; a rerun changes nothing', async () => {
    await seedArchive()
    const r = await both(runBank)
    const rows = Object.fromEntries(r.report.recon.map((x) => [x.entity, x]))
    expect(rows.structured_questions).toMatchObject({ sourceCount: 4, loaded: 3, rejected: 1, status: 'ok' })
    expect(rows.subjective_questions).toMatchObject({ sourceCount: 5, loaded: 5, rejected: 0, status: 'ok' })
    const rejects = await sql(`select entity, reason, column_name from etl_rejects where run_id = $1::bigint`, [r.report.runId])
    expect(rejects.rows).toEqual([{ entity: 'structured_questions', reason: 'UNKNOWN_ENUM', column_name: 'status' }])

    const statuses = await sql(`select q.legacy_id, v.status, v.type, q.is_active, q.live_version_no from questions q join question_versions v on v.question_id = q.id
      where q.legacy_source = 'cloud' and q.legacy_id like '90%' order by q.legacy_id`)
    expect(statuses.rows.map((x) => [x.legacy_id, x.status, x.type, x.live_version_no])).toEqual([
      ['901', 'archived', 'essay', null], ['902', 'approved', 'essay', 1], ['903', 'draft', 'essay', null], ['904', 'approved', 'essay', 1], ['905', 'approved', 'essay', 1],
    ])
    const st = await sql(
      `select m.legacy_id, v.status, v.declared_marks, v.kbat, v.import_issues from etl_id_map m join questions q on q.id = m.new_id::bigint join question_versions v on v.question_id = q.id
        where m.entity = 'structured_questions' order by m.legacy_id::int`,
    )
    expect(st.rows.map((x) => [x.legacy_id, x.status, x.declared_marks, x.kbat])).toEqual([['1', 'approved', 6, 'menganalisis'], ['2', 'review', 2, null], ['3', 'archived', 1, null]])

    // Studio read: V3's strict reader parses every loaded tree (no StoredKeyError) and the rubric editor's shape is there.
    const qid = (await sql(`select new_id from etl_id_map where entity = 'structured_questions' and legacy_id = '1'`)).rows[0]?.new_id as string
    const parts = (await sql(`select p.* , p.question_version_id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1::bigint order by p.depth, p.position`, [qid])).rows
    expect(parts.map((p) => [p.depth, p.label, p.mode])).toEqual([[1, '(a)', null], [1, '(b)', 'essay'], [2, '(i)', 'working'], [2, '(ii)', 'working']])
    const camel = (p: Record<string, unknown>) => ({
      id: p.id, questionVersionId: p.question_version_id, parentPartId: p.parent_part_id, position: p.position, depth: p.depth, label: p.label, promptMs: p.prompt_ms, promptEn: null,
      marks: p.marks, mode: p.mode, unit: null, decimals: null, sigFigs: null, blankCount: null, wordMin: null, wordMax: null, topics: null, drawingKind: null, tableGrid: null,
      modeConfig: null, stimulusId: null, choiceGroup: null, reveal: 'after_submit', difficultyTp: null, kbat: null, unitNodeId: null, formOrigin: null, cognitiveLevel: null,
    })
    const keys = (await sql(`select k.* from answer_keys k join question_parts p on p.id = k.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1::bigint`, [qid])).rows
    const tree = partsFromRows(parts.map(camel) as never, [], keys.map((k) => ({ id: k.id, partId: k.part_id, kind: k.kind, content: k.content })) as never)
    expect(tree).toHaveLength(2)
    const leafB = tree[1] as unknown as { key: { kind: string; marks: number; points: { marks: number }[]; modelText: string } }
    expect(leafB.key).toMatchObject({ kind: 'points', marks: 3, modelText: 'Skema tiga.' })
    expect(leafB.key.points.map((p) => p.marks)).toEqual([1, 2])

    const second = await runBank('dry-run')
    expect(second.report.recon.every((x) => x.status === 'ok')).toBe(true)
    const before = await h.count('questions')
    await runBank('apply')
    expect(await h.count('questions')).toBe(before)
  })
})

describe('canonical-only bank', () => {
  it('loads only the questions that are not projections of a legacy row, with the key from is_correct', async () => {
    await sql(`insert into staging_cloud.question_statuses (id, slug) values (91, 'approved') on conflict (id) do update set slug = 'approved'`)
    await sql(`insert into staging_cloud.answer_modes (id, slug) values (91, 'mcq'), (92, 'extended_essay') on conflict (id) do update set slug = excluded.slug`)
    await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, status_id) values (801, 'Kertas Kanonik', 1, '2', 90, 1) on conflict (id) do nothing`)
    await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, status_id, number_label, position, stem) values
      (7001, 801, 91, '1', 1, '{"ms":"Soalan kanonik satu."}'), (7002, 801, 91, '2', 2, '{"ms":"Soalan kanonik dua."}'), (7003, 801, 91, '3', 3, '{"ms":"Soalan terproyek."}')`)
    await sql(`insert into archive_cloud.legacy_canonical_map (id, source, legacy_id, canonical_type, canonical_id) values (9001, 'questions', '902', 'exam_question', 7003)`)
    await sql(`insert into archive_cloud.question_parts (id, exam_question_id, answer_mode_id, marks, position, label, prompt) values
      (1, 7001, 91, 1, 1, '1', '{"ms":"Pilih."}'), (2, 7002, 92, 2, 1, '1', '{"ms":"Huraikan."}'), (3, 7003, 91, 1, 1, '1', '{"ms":"Pilih."}')`)
    await sql(`insert into archive_cloud.part_options (id, question_part_id, label, body, is_correct, position) values
      (1, 1, 'A', '{"ms":"Satu"}', '0', 1), (2, 1, 'B', '{"ms":"Dua"}', '1', 2), (3, 3, 'A', '{"ms":"x"}', '1', 1), (4, 3, 'B', '{"ms":"y"}', '0', 2)`)
    await sql(`insert into archive_cloud.part_answer_keys (id, question_part_id, answer_key_kind_id, content, marks) values (1, 2, 1, '{"points":[{"text":"Isi satu","marks":1},{"text":"Isi dua","marks":1}]}', 2)`)
    const r = await both(runBank)
    const eq = r.report.recon.find((x) => x.entity === 'exam_questions')
    expect(eq).toMatchObject({ sourceCount: 2, loaded: 2, rejected: 0, status: 'ok' })
    expect(r.questions.notes.counters.get('canonical.mapped_to_legacy')).toBeGreaterThanOrEqual(1)
    const rows = await sql(`select m.legacy_id, v.type, v.status, v.education_level_id from etl_id_map m join questions q on q.id = m.new_id::bigint join question_versions v on v.question_id = q.id where m.entity = 'exam_questions' order by m.legacy_id`)
    expect(rows.rows.map((x) => [x.legacy_id, x.type, x.status, x.education_level_id])).toEqual([['7001', 'mcq', 'approved', null], ['7002', 'essay', 'approved', null]])
  })
})

describe('SPM sets, blueprints and papers', () => {
  it('loads tracking sets with INV-26 and subject checks, blueprints as non-serving reference Kontrak, and papers as drafts', async () => {
    const mapped = (legacy: string) => sql(`select new_id from etl_id_map where entity = 'questions' and legacy_id = $1`, [legacy]).then((x) => x.rows[0]?.new_id as string)
    expect(await mapped('902')).toBeTruthy()
    await sql(`insert into archive_cloud.spm_sets (id, subject_id, year, set_number, kind) values (1, 1, 2024, 1, 'ramalan'), (2, 1, 2024, 2, 'past_year'), (3, 1, 2024, 3, 'subjektif'), (4, 1, 2024, 1, 'past_year')`)
    await sql(`insert into archive_cloud.spm_set_question (spm_set_id, question_id, position) values
      (1, 902, 2), (1, 905, 1), (1, 904, 3), (1, 999, 4), (2, 902, 1), (2, 901, null)`)
    // Blueprints: (subject 1, kertas 2) loads; (subject 2, kertas 1) has no duration anywhere and is rejected.
    await sql(`insert into staging_cloud.paper_statuses (id, slug) values (91, 'published') on conflict (id) do update set slug = 'published'`)
    await sql(`insert into archive_cloud.selection_rules (id, slug) values (1, 'answer_all'), (2, 'choose_n') on conflict (id) do nothing`)
    await sql(`insert into archive_cloud.paper_blueprints (id, subject_id, kertas, paper_code, duration_minutes, total_marks, auto_markable, source) values
      (1, 1, 3, 'TB9B/3', 120, 100, '1', 'confirmed'), (2, 2, 1, 'TB9B/X', null, 50, '1', 'derived')`)
    await sql(`insert into archive_cloud.blueprint_sections (id, paper_blueprint_id, label, position, selection_rule_id, select_count, expected_answer_modes) values (1, 1, 'Bahagian A', 1, 1, 5, '["mcq","cloze"]')`)
    // Papers: V2-published paper with two placements (one mapped to a loaded question, one unresolved); kertas 3 has the blueprint above.
    await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, status_id, instructions) values (802, 'Kertas Dua', 1, '3', null, 91, '["Jawab semua."]')`)
    await sql(`insert into archive_cloud.paper_sections (id, exam_paper_id, label, position, selection_rule_id) values (1, 802, 'Bahagian A', 1, 1)`)
    await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, status_id, number_label, position) values (7010, 802, 91, '1', 1), (7011, 802, 91, '2', 2)`)
    await sql(`insert into archive_cloud.legacy_canonical_map (id, source, legacy_id, canonical_type, canonical_id) values (9002, 'questions', '905', 'exam_question', 7010)`)
    await sql(`insert into archive_cloud.exam_paper_questions (id, exam_question_id, paper_section_id, sort_order, number_label) values (1, 7010, 1, 1, '1'), (2, 7011, 1, 2, '2')`)

    const r = await both(runPaperSteps)
    const by = Object.fromEntries(r.report.recon.map((x) => [x.entity, x]))
    expect(by.spm_sets).toMatchObject({ sourceCount: 4, eligibleCount: 3, rejected: 1, status: 'ok' })
    expect(by.paper_blueprints).toMatchObject({ sourceCount: 2, loaded: 1, rejected: 1, status: 'ok' })
    expect(by.exam_papers?.status).toBe('ok')

    const sets = await sql(`select s.set_no, s.year, count(sq.*)::int n, array_agg(sq.position order by sq.position) pos from spm_tracking_sets s left join spm_tracking_set_questions sq on sq.set_id = s.id group by s.id order by s.set_no`)
    // set 1: 905 (pos 1) and 902 (pos 2) kept in V2 order; 904 is another subject; 999 unmapped. set 2: 902 repeats INV-26, 901 survives.
    expect(sets.rows.filter((x) => x.set_no <= 2).map((x) => [x.set_no, x.n, x.pos])).toEqual([[1, 2, [1, 2]], [2, 1, [1]]])
    expect(r.questions.notes.counters.get('spm_sets.member_inv26_duplicate')).toBe(1)
    expect(r.questions.notes.counters.get('spm_sets.member_subject_mismatch')).toBe(1)
    expect(r.questions.notes.counters.get('spm_sets.member_unmapped')).toBe(1)

    const bp = await sql(`select code, status, source, serves_students, verification_id, structure_hash, duration_min from blueprints where code = 'TB9B/3'`)
    expect(bp.rows).toHaveLength(1)
    expect(bp.rows[0]).toMatchObject({ status: 'active', source: 'spec', serves_students: false, verification_id: null, duration_min: 120 })
    expect(bp.rows[0]?.structure_hash).toMatch(/^[0-9a-f]{64}$/)
    const secs = await sql(`select s.rule_type, s.question_count, s.allowed_modes from blueprint_sections s join blueprints b on b.id = s.blueprint_id where b.code = 'TB9B/3'`)
    expect(secs.rows).toEqual([{ rule_type: 'all', question_count: 5, allowed_modes: ['mcq'] }])

    const papers = await sql(`select p.title, p.status, p.surface, p.kertas, p.printed_duration_min, p.instructions, (select count(*)::int from paper_placements pl join paper_sections ps on ps.id = pl.paper_section_id where ps.paper_id = p.id) placed from papers p order by p.id`)
    const two = papers.rows.find((x) => x.title === 'Kertas Dua')
    // kertas 3 has the loaded Kontrak -> simulasi, duration from it; one placement resolved, one dropped.
    expect(two).toMatchObject({ status: 'draft', surface: 'simulasi', kertas: 3, printed_duration_min: 120, instructions: ['Jawab semua.'], placed: 1 })
    const kanonik = papers.rows.find((x) => x.title === 'Kertas Kanonik')
    expect(kanonik).toMatchObject({ status: 'draft', surface: 'subjektif', printed_duration_min: 90 })
    expect(papers.rows.every((x) => x.status === 'draft')).toBe(true)
  })

  it('keeps a group whole: a paper that places only some members of a group is held (never Terbit-ed)', async () => {
    const q1 = (await sql(`select new_id from etl_id_map where entity = 'questions' and legacy_id = '902'`)).rows[0]?.new_id as string
    const q2 = (await sql(`select new_id from etl_id_map where entity = 'questions' and legacy_id = '905'`)).rows[0]?.new_id as string
    const g = (await sql(`insert into stimulus_groups (label, scope) values ('Rajah uji', 'section') returning id::text id`)).rows[0]?.id as string
    await sql(`update questions set group_id = $1::bigint, group_position = case id when $2::bigint then 1 else 2 end where id in ($2::bigint, $3::bigint)`, [g, q1, q2])
    await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, status_id) values (803, 'Kertas Kumpulan', 1, '3', 60, 91)`)
    await sql(`insert into archive_cloud.paper_sections (id, exam_paper_id, label, position, selection_rule_id) values (2, 803, 'Bahagian A', 1, 1)`)
    await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, status_id, position) values (7020, 803, 91, 1)`)
    await sql(`insert into archive_cloud.legacy_canonical_map (id, source, legacy_id, canonical_type, canonical_id) values (9003, 'questions', '902', 'exam_question', 7020) on conflict do nothing`)
    await sql(`insert into archive_cloud.exam_paper_questions (id, exam_question_id, paper_section_id, sort_order) values (3, 7020, 2, 1)`)
    const r = await both(runPaperSteps)
    expect(r.questions.notes.counters.get('papers.group_split')).toBe(1)
    const hold = await sql(`select new_id from etl_id_map where entity = 'exam_paper_holds'`)
    expect(hold.rows.map((x) => x.new_id)).toEqual(['group_split'])
  })
})
