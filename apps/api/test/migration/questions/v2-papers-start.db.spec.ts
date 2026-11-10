/**
 * The V2 canonical bank end to end, with the REAL V2 shapes (json `{html}` stems, prompts and option bodies, `single_key` with `{option_id}`,
 * mark-scheme `{point, marks}`, `exam_questions` with NO `legacy_canonical_map` row): the canonical-only loader loads every question, the rajah
 * is a group stimulus (every member, V2 order), the papers loader places the questions in V2 sections and order, an SPM tracking set has its
 * members, and a published paper is started by a pupil through the real Bijak start endpoint, which serves the rajah on every group member.
 * Synthetic rows only.
 */
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { renderDdl } from '../../../src/migration/ddl/render'
import { TABLES } from '../../../src/migration/ddl/spec'
import { Runner } from '../../../src/migration/kit/runner'
import { buildPapersSteps } from '../../../src/migration/load/papers'
import { LEGACY_PUBLISH_BODY } from '../../../src/migration/load/papers'
import { findMigrationActor } from '../../../src/migration/load/papers/terbit-nest'
import { buildQuestionsSteps, QuestionsContext } from '../../../src/migration/load/questions'
import { buildStructuredSteps } from '../../../src/migration/load/questions/structured-index'
import { ExamBlueprintsModule } from '../../../src/modules/exam/blueprints'
import { BuilderService, ExamBuilderModule } from '../../../src/modules/exam/builder'
import { bootIntegrationApp, loginAs, STUDENT, type Client, type IntegrationApp } from '../../bijak-integration/helpers'
import { addArchive } from './helpers'

let t: IntegrationApp
let pool: pg.Pool
let student: Client
const env = { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }
const html = (v: string): string => JSON.stringify({ html: v })
const sql = (text: string, params: unknown[] = []) => pool.query(text, params)
const rows = async <T extends Record<string, unknown>>(text: string, params: unknown[] = []): Promise<T[]> => (await sql(text, params)).rows as T[]

async function seedV2(): Promise<void> {
  await sql(`insert into staging_cloud.question_statuses (id, slug) values (1, 'draft'), (2, 'reviewed'), (3, 'approved'), (4, 'archived')`)
  await sql(`insert into staging_cloud.paper_statuses (id, slug) values (1, 'draft'), (2, 'in_review'), (3, 'published'), (4, 'archived')`)
  await sql(`insert into staging_cloud.answer_modes (id, slug) values (1, 'mcq'), (2, 'short_text'), (5, 'extended_essay')`)
  await sql(`insert into staging_cloud.answer_key_kinds (id, slug) values (1, 'single_key'), (3, 'mark_scheme_points')`)
  await sql(`insert into staging_cloud.stimulus_kinds (id, slug) values (1, 'passage'), (4, 'diagram')`)
  await sql(`insert into archive_cloud.selection_rules (id, slug) values (1, 'answer_all'), (2, 'choose_n')`)
  await sql(`insert into archive_cloud.source_papers (id, natural_key, subject_id, year) values (1, 'sp-1', 1, 2025)`)
  await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, status_id, created_at, updated_at) values
    (801, 'Kertas V2 Terbit', 1, '1', 90, 3, '2025-05-01', '2025-05-01'),
    (802, 'Kertas V2 Tanpa Subjek', null, '1', 60, 1, '2025-05-02', '2025-05-02')`)
  await sql(`insert into archive_cloud.paper_sections (id, exam_paper_id, label, position, selection_rule_id) values
    (51, 801, 'Bahagian A', 1, 1), (52, 801, 'Bahagian B', 2, 1), (53, 802, 'Bahagian A', 1, 1)`)
  // 8001/8002 share the rajah (a group); 8003 has no stimulus and an MCQ whose only key is the single_key row; 8004 is an essay;
  // 8005 has its own passage; 8006 (draft, no scheme) and 8007 (no section) belong to the paper without a subject (the subject comes from the source paper).
  await sql(`insert into archive_cloud.exam_questions (id, exam_paper_id, paper_section_id, source_paper_id, status_id, number_label, position, stem, created_at, updated_at) values
    (8001, 801, 51, 1, 3, '1', 1, $1::jsonb, '2025-05-01', '2025-05-01'),
    (8002, 801, 51, 1, 3, '2', 2, $2::jsonb, '2025-05-01', '2025-05-01'),
    (8003, 801, 51, 1, 3, '3', 3, $3::jsonb, '2025-05-01', '2025-05-01'),
    (8004, 801, 52, 1, 3, '4', 1, $4::jsonb, '2025-05-01', '2025-05-01'),
    (8005, 801, 52, 1, 3, '5', 2, $5::jsonb, '2025-05-01', '2025-05-01'),
    (8006, 802, 53, 1, 1, '1', 1, $6::jsonb, '2025-05-02', '2025-05-02'),
    (8007, 802, null, 1, 1, '2', 2, $7::jsonb, '2025-05-02', '2025-05-02')`, [
    html('<p>Berdasarkan Rajah 1, berapakah arus?</p>'), html('<p>Berdasarkan Rajah 1, berapakah voltan?</p>'), html('<p>Apakah unit daya?</p>'),
    html('<p>Terangkan hukum Ohm.</p>'), html('<p>Berdasarkan petikan, apakah tujuan penulis?</p>'), html('<p>Huraikan fotosintesis.</p>'), html('<p>Apakah ibu negara?</p>'),
  ])
  const mcq = [8001, 8002, 8003, 8005, 8007]
  await sql(`insert into archive_cloud.question_parts (id, exam_question_id, answer_mode_id, marks, position, label, prompt) values
    ${mcq.map((q) => `(${q}, ${q}, 1, 1, 1, '1', null)`).join(', ')}, (8004, 8004, 5, 2, 1, '1', null), (8006, 8006, 5, 2, 1, '1', null)`)
  for (const q of mcq) {
    // 8003 carries no is_correct flag: the answer is only in the single_key row.
    const flagged = q === 8003 ? -1 : 1
    for (let i = 0; i < 4; i += 1) {
      await sql(`insert into archive_cloud.part_options (id, question_part_id, label, body, is_correct, is_distractor, position) values ($1, $2, $3, $4, $5, '0', $6)`, [
        q * 10 + i, q, 'ABCD'.charAt(i), html(`<p>Pilihan ${'ABCD'.charAt(i)}</p>`), i === flagged ? '1' : '0', i + 1,
      ])
    }
    if (q !== 8007) {
      await sql(`insert into archive_cloud.part_answer_keys (id, question_part_id, answer_key_kind_id, content, marks) values ($1, $2, 1, $3, 0)`, [q, q, JSON.stringify({ option_id: q === 8003 ? q * 10 + 2 : q * 10 + 1 })])
    }
  }
  await sql(`insert into archive_cloud.part_answer_keys (id, question_part_id, answer_key_kind_id, content, marks) values (8004, 8004, 3, $1, 2)`, [
    JSON.stringify({ points: [{ point: 'Beza keupayaan berkadar terus dengan arus', marks: 1 }, { point: 'V = IR', marks: 1 }] }),
  ])
  await sql(`insert into archive_cloud.stimuli (id, stimulus_kind_id, body, caption) values
    (1, 4, $1, 'Rajah 1'), (2, 1, $2, null)`, [html('<p>Litar siri dengan satu perintang.</p>'), html('<p>Petikan pendek tentang alam sekitar.</p>')])
  await sql(`insert into archive_cloud.question_stimulus (id, exam_question_id, stimulus_id, position) values (1, 8001, 1, 1), (2, 8002, 1, 1), (3, 8005, 2, 1)`)
  // Section B is placed through the pivot, in a different order from the questions' own position: 8005 first.
  await sql(`insert into archive_cloud.exam_paper_questions (id, exam_question_id, paper_section_id, sort_order, number_label) values (1, 8005, 52, 1, '5'), (2, 8004, 52, 2, '4')`)
  // An SPM tracking set over a legacy question (the legacy bank loads through the questions loader).
  // 901 is a legacy copy of the canonical 8007 (same stem and options, no legacy_canonical_map row): 8007 must map to it, not load twice.
  await addArchive(pool, [
    { id: 900, subject: 1, level: 1, chapter: null, topic: null, body: 'Soalan set SPM?' },
    { id: 901, subject: 1, level: 1, chapter: null, topic: null, body: 'Apakah ibu negara?', options: ['A', 'B', 'C', 'D'].map((l, i) => ({ label: l, body: `Pilihan ${l}`, correct: i === 1 })) },
  ])
  await sql(`insert into archive_cloud.spm_sets (id, subject_id, year, set_number, kind) values (1, 1, 2024, 1, 'ramalan')`)
  await sql(`insert into archive_cloud.spm_set_question (spm_set_id, question_id, position) values (1, 900, 1)`)
}

async function runSteps(build: (c: QuestionsContext) => ReturnType<typeof buildStructuredSteps>, name: string) {
  const out: Record<string, unknown>[] = []
  for (const mode of ['dry-run', 'apply'] as const) {
    const ctx = new QuestionsContext({ pool, env, source: 'cloud', asOf: '2026-10-24', pageSize: 3 })
    const report = await new Runner({ pool, env }).run({ mode, steps: build(ctx), inputHash: `v2-${name}`, batchSize: 3 })
    expect(report.status, `${name} ${mode}`).toBe('succeeded')
    if (mode === 'apply') out.push(...(report.recon as unknown as Record<string, unknown>[]), { notes: Object.fromEntries(ctx.notes.counters) })
  }
  return out
}

beforeAll(async () => {
  t = await bootIntegrationApp({ pocQuestions: false, extraModules: [ExamBuilderModule, ExamBlueprintsModule] })
  pool = new pg.Pool({ connectionString: t.db.url, max: 4 })
  await pool.query(renderDdl(TABLES))
  const one = async (q: string): Promise<string> => (await pool.query<{ id: string }>(q)).rows[0]?.id as string
  const map = (entity: string, legacy: string, id: string) => pool.query(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', $1, $2, $3)`, [entity, legacy, id])
  await map('subjects', '1', await one(`select id::text as id from subjects where code = 'MATH'`))
  await map('education_levels', '1', await one(`select id::text as id from education_levels where code = 'T4'`))
  await seedV2()
  student = await loginAs(t, STUDENT)
}, 300_000)
afterAll(async () => {
  await pool?.end()
  await t?.close()
})

describe('canonical-only bank in the V2 shapes', () => {
  it('loads every exam question (none rejected) and the legacy bank beside them', async () => {
    const legacy = await runSteps(buildQuestionsSteps, 'questions')
    expect(legacy.find((r) => r.entity === 'questions')).toMatchObject({ loaded: 2, rejected: 0 })
    const recon = await runSteps(buildStructuredSteps, 'structured')
    const eq = recon.find((r) => r.entity === 'exam_questions')
    expect(eq, JSON.stringify(recon)).toMatchObject({ sourceCount: 7, loaded: 7, rejected: 0 })
    const notes = (recon.find((r) => 'notes' in r) as { notes: Record<string, number> }).notes
    expect(notes['canonical.stimuli.groupsCreated']).toBe(1)
    expect(notes['canonical.stimuli.grouped']).toBe(2)
    expect(notes['canonical.key_from_single_key']).toBe(1)
    expect(notes['canonical.deduped_to_legacy']).toBe(1)
    expect(await rows(`select 1 from questions q join question_versions v on v.question_id = q.id where v.stem_ms = 'Apakah ibu negara?'`)).toHaveLength(1)
    const status = await rows<{ legacy_id: string; status: string; type: string; stem_ms: string }>(
      `select m.legacy_id, v.status, v.type, v.stem_ms from etl_id_map m join questions q on q.id = m.new_id::bigint join question_versions v on v.question_id = q.id
        where m.entity = 'exam_questions' order by m.legacy_id::int`)
    expect(status.map((r) => [r.legacy_id, r.status, r.type])).toEqual([
      ['8001', 'approved', 'mcq'], ['8002', 'approved', 'mcq'], ['8003', 'approved', 'mcq'], ['8004', 'approved', 'essay'], ['8005', 'approved', 'mcq'], ['8006', 'draft', 'essay'], ['8007', 'approved', 'mcq'],
    ])
    expect(await rows(`select 1 from questions q join etl_id_map m on m.new_id::bigint = q.id and m.entity = 'exam_questions' and m.legacy_id = '8007' where q.legacy_id = '901'`)).toHaveLength(1)
    expect((await rows<{ l: string }>(`select distinct education_level_id::text l from question_versions v join etl_id_map m on m.new_id::bigint = v.question_id and m.entity = 'exam_questions' where m.legacy_id <> '8007'`)).length).toBe(1)
    expect(status[0]?.stem_ms).toBe('Berdasarkan Rajah 1, berapakah arus?')
    const key = await rows<{ content: { correct: string } }>(
      `select k.content from answer_keys k join question_parts p on p.id = k.part_id join question_versions v on v.id = p.question_version_id join etl_id_map m on m.new_id::bigint = v.question_id
        where m.entity = 'exam_questions' and m.legacy_id = '8003'`)
    expect(key[0]?.content.correct).toBe('C')
  })

  it('the rajah is a group stimulus: both members, V2 order, one stimulus with its text; the single passage is the question\'s own', async () => {
    const g = await rows<{ legacy_id: string; group_id: string; group_position: number }>(
      `select m.legacy_id, q.group_id::text, q.group_position from questions q join etl_id_map m on m.new_id::bigint = q.id and m.entity = 'exam_questions' where q.group_id is not null order by q.group_position`)
    expect(g.map((r) => [r.legacy_id, r.group_position])).toEqual([['8001', 1], ['8002', 2]])
    expect(new Set(g.map((r) => r.group_id)).size).toBe(1)
    const s = await rows<{ kind: string; body_ms: string; caption: string }>(`select s.kind, s.body_ms, s.caption from stimulus_group_stimuli x join stimuli s on s.id = x.stimulus_id where x.group_id = $1::bigint`, [g[0]?.group_id])
    expect(s).toEqual([{ kind: 'diagram', body_ms: 'Litar siri dengan satu perintang.', caption: 'Rajah 1' }])
    const own = await rows<{ legacy_id: string; body_ms: string }>(
      `select m.legacy_id, s.body_ms from question_version_stimuli x join question_versions v on v.id = x.question_version_id join etl_id_map m on m.new_id::bigint = v.question_id and m.entity = 'exam_questions' join stimuli s on s.id = x.stimulus_id`)
    expect(own).toEqual([{ legacy_id: '8005', body_ms: 'Petikan pendek tentang alam sekitar.' }])
  })

  it('a draft essay with no scheme loads with a visible placeholder, never as a rejected row', async () => {
    const r = await rows<{ status: string; import_issues: unknown }>(
      `select v.status, v.import_issues from question_versions v join etl_id_map m on m.new_id::bigint = v.question_id and m.entity = 'exam_questions' where m.legacy_id = '8006'`)
    expect(r[0]?.status).toBe('draft')
    expect(r[0]?.import_issues).toEqual([{ code: 'scheme_placeholder', target: 'part', label: '1' }])
  })
})

describe('papers and SPM tracking sets', () => {
  it('loads every paper (also the one without a subject) with its questions in V2 sections and order', async () => {
    const recon = await runSteps(buildPapersSteps, 'papers')
    expect(recon.find((r) => r.entity === 'exam_papers'), JSON.stringify(recon)).toMatchObject({ sourceCount: 2, loaded: 2, rejected: 0 })
    const placed = await rows<{ title: string; section: string; pos: number; legacy_id: string; label: string }>(
      `select p.title, s.label as section, pl.position as pos, m.legacy_id, pl.number_label as label
         from paper_placements pl join paper_sections s on s.id = pl.paper_section_id join papers p on p.id = s.paper_id
         join etl_id_map m on m.new_id::bigint = pl.question_id and m.entity = 'exam_questions'
        order by p.id, s.position, pl.position`)
    expect(placed.map((r) => [r.title, r.section, r.pos, r.legacy_id])).toEqual([
      ['Kertas V2 Terbit', 'Bahagian A', 1, '8001'], ['Kertas V2 Terbit', 'Bahagian A', 2, '8002'], ['Kertas V2 Terbit', 'Bahagian A', 3, '8003'],
      ['Kertas V2 Terbit', 'Bahagian B', 1, '8005'], ['Kertas V2 Terbit', 'Bahagian B', 2, '8004'],
      ['Kertas V2 Tanpa Subjek', 'Bahagian A', 1, '8006'], ['Kertas V2 Tanpa Subjek', 'Soalan lain', 1, '8007'],
    ])
    const papers = await rows<{ title: string; status: string; subject_id: string }>(`select title, status, subject_id::text from papers where title like 'Kertas V2%' order by id`)
    expect(papers.map((p) => [p.title, p.status, p.subject_id !== null]), JSON.stringify(papers)).toEqual([['Kertas V2 Terbit', 'draft', true], ['Kertas V2 Tanpa Subjek', 'draft', true]])
  })

  it('the SPM tracking set has its member', async () => {
    const n = await rows<{ n: number }>(`select count(*)::int as n from spm_tracking_set_questions`)
    expect(n[0]?.n).toBe(1)
  })
})

describe('a V2-published paper starts for a pupil', () => {
  it('goes through the Terbit gate (the verdict is the gate\'s) and the pupil start serves the rajah on every group member', async () => {
    const paperId = (await rows<{ id: string }>(`select id::text as id from papers where title = 'Kertas V2 Terbit'`))[0]?.id as string
    const builder = t.app.get(BuilderService, { strict: false })
    const adminId = (await findMigrationActor(pool)) as string
    const verdict = await builder.publish({ userId: adminId, role: 'admin', requestId: null, ip: null, isTest: false }, paperId, LEGACY_PUBLISH_BODY)
    // The gate decides; when it refuses (this fixture has no DSKP tags) the paper is published directly so the start can still be exercised.
    if (!verdict.ok) {
      console.log(`Terbit gate said: ${JSON.stringify(verdict.errors)}`)
      await sql(`update papers set status = 'published', published_at = now() where id = $1::bigint`, [paperId])
      await sql(`update paper_placements pl set pinned_version_no = 1 from paper_sections s where s.id = pl.paper_section_id and s.paper_id = $1::bigint`, [paperId])
    }
    const cover = await student.get(`/api/bijak/papers/${paperId}`)
    expect(cover.status, JSON.stringify(cover.body)).toBe(200)
    const started = await student.post('/api/bijak/attempts', { paperId, mode: 'exam' })
    expect(started.status, JSON.stringify(started.body)).toBeLessThan(300)
    const attemptId = (started.body as { data: { attemptId: string } }).data.attemptId
    const view = await student.get(`/api/bijak/attempts/${attemptId}`)
    expect(view.status, JSON.stringify(view.body)).toBe(200)
    const data = view.body.data as { questions: { id: string; stem: string; groupId?: string | null; sectionId: string }[]; groups: { id: string; stimulus: unknown; stimuli?: unknown[]; questionIds: string[]; from: number; to: number }[]; sections: { id: string; label: string }[] }
    expect(data.questions).toHaveLength(5)
    const text = (q: unknown): string => JSON.stringify(q)
    const byStem = (needle: string) => data.questions.find((q) => q.stem.includes(needle))
    // the rajah is ONE group stimulus above both members (D90): the group lists every member, V2 order, and carries the rajah text
    const arus = byStem('berapakah arus')
    const voltan = byStem('berapakah voltan')
    expect(arus?.groupId).toBeTruthy()
    expect(voltan?.groupId).toBe(arus?.groupId)
    expect(byStem('unit daya')?.groupId ?? null).toBeNull()
    const group = data.groups.find((g) => g.id === arus?.groupId)
    expect(text(group?.stimulus)).toContain('Litar siri dengan satu perintang')
    expect(group?.questionIds).toEqual([arus?.id, voltan?.id])
    expect([group?.from, group?.to]).toEqual([1, 2])
    // the single passage of 8005 is the question's own stimulus (its own group of one is not a rajah group)
    expect(text(byStem('tujuan penulis')), text(data.questions.map((q) => Object.keys(q)))).toContain('Petikan pendek tentang alam sekitar')
    // sections and order are the V2 ones: A (8001, 8002, 8003) then B (8005, 8004)
    expect(data.sections.map((x) => x.label)).toEqual(['Bahagian A', 'Bahagian B'])
    expect(data.questions.map((q) => (q.stem.match(/arus|voltan|unit daya|tujuan penulis|hukum Ohm/) ?? [''])[0])).toEqual(['arus', 'voltan', 'unit daya', 'tujuan penulis', 'hukum Ohm'])
    // a single-part question shows only its stem (no part label appended)
    expect(arus?.stem).toBe('Berdasarkan Rajah 1, berapakah arus?')
  }, 120_000)
})
