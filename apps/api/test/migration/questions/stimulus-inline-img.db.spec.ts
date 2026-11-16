/**
 * Inline pictures and tables of V2 stimulus HTML in the canonical load (feature slug `etl-stimulus-inline-img`): an `<img src="/storage/stimuli/..">` is
 * copied through MigrationFiles and shown as a picture stimulus, text and a second picture become extra stimuli, a raw `<table>` becomes `table_data`, a
 * picture that cannot be used holds the question, and a second run changes nothing. Synthetic rows and generated pictures only.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { runQuestions } from '../../../src/migration/load/questions'
import { readCanonicalFindings } from '../../../src/migration/verify/group-checks'
import { runStructured } from '../../../src/migration/load/questions/structured-index'
import { makePng } from '../../files/fixtures'
import { addArchive, AS_OF, bootQuestions, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
let root: string
let env: Record<string, string>
const sql = (text: string, params: unknown[] = []) => h.pool.query(text, params)
const html = (v: string): string => JSON.stringify({ html: v })
const U = (n: number): string => `0b5f2f3c-9d1e-4c0a-8a43-5d2f6a1c7e${String(n).padStart(2, '0')}`
const img = (n: number, file = 'rajah.png'): string => `<img src="/storage/stimuli/${U(n)}/${file}" alt="Rajah ${n}">`

async function slugId(table: string, slug: string): Promise<number> {
  const have = await sql(`select id from staging_cloud.${table} where slug = $1`, [slug])
  if (have.rows[0]) return Number(have.rows[0].id)
  const id = Number((await sql(`select coalesce(max(id), 0) + 1 as id from staging_cloud.${table}`)).rows[0]?.id)
  await sql(`insert into staging_cloud.${table} (id, slug) values ($1, $2)`, [id, slug])
  return id
}

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

/** The export: SHA256SUMS plus a PNG for every uuid in `present` (uuid 5 is left out on purpose: cause `unlisted`). */
function writeExport(dir: string, present: number[]): void {
  mkdirSync(dir, { recursive: true })
  const sums: string[] = []
  for (const n of present) {
    const bytes = makePng({ width: 2 + n, height: 2 })
    mkdirSync(join(dir, 'stimuli', U(n)), { recursive: true })
    writeFileSync(join(dir, 'stimuli', U(n), 'rajah.png'), bytes)
    sums.push(`${createHash('sha256').update(bytes).digest('hex')}  stimuli/${U(n)}/rajah.png`)
  }
  writeFileSync(join(dir, 'SHA256SUMS'), `${sums.join('\n')}\n`)
}

async function load(): Promise<void> {
  const base = { pool: h.pool, env, source: 'cloud' as const, asOf: AS_OF, coreAsOf: AS_OF, batchSize: 2, filesDir: join(root, 'export') }
  for (const mode of ['dry-run', 'apply'] as const) {
    const r = await runStructured({ ...base, mode })
    expect(r.report.status).toBe('succeeded')
  }
}

const qOf = async (v2: number): Promise<string> => (await sql(`select new_id from etl_id_map where entity = 'exam_questions' and legacy_id = $1`, [String(v2)])).rows[0]?.new_id as string
const stimuliOf = async (v2: number) =>
  (await sql(
    `select s.kind, s.body_ms, s.alt_text, s.table_data, s.asset_file_id::text as file, vs.position::int as pos
       from question_version_stimuli vs join question_versions v on v.id = vs.question_version_id join stimuli s on s.id = vs.stimulus_id
      where v.question_id = $1::bigint and v.version_no = 1 order by vs.position`, [await qOf(v2)])).rows
const stateOf = async (v2: number) =>
  (await sql(`select q.is_active, v.import_issues from questions q join question_versions v on v.question_id = q.id and v.version_no = 1 where q.id = $1::bigint`, [await qOf(v2)])).rows[0]
const snapshot = async (): Promise<string> =>
  JSON.stringify((await sql(
    `select (select count(*) from stimuli) s, (select count(*) from files) f,
            (select md5(coalesce(string_agg(id || coalesce(kind, '') || coalesce(body_ms, '') || coalesce(asset_file_id::text, '-') || updated_at::text, ',' order by id), '')) from stimuli) sm,
            (select md5(coalesce(string_agg(question_version_id || ':' || stimulus_id || ':' || position, ',' order by id), '')) from question_version_stimuli) own,
            (select count(*) from questions where is_active) active`)).rows[0])

beforeAll(async () => {
  h = await bootQuestions()
  root = mkdtempSync(join(tmpdir(), 'stim-inline-'))
  env = { ...h.runEnv, FILE_STORAGE_DIR: join(root, 'storage') }
  mkdirSync(env.FILE_STORAGE_DIR as string)
  writeExport(join(root, 'export'), [1, 2, 3, 4, 6, 7])
  await sql(`insert into archive_cloud.source_papers (id, natural_key, subject_id, year) values (9901, 'sp-inline', 1, 2025)`)
  await sql(`insert into archive_cloud.exam_papers (id, title, subject_id, kertas, duration_minutes, created_at, updated_at) values (9801, 'Kertas', 1, '1', 90, '2025-05-01', '2025-05-01')`)
  await addArchive(h.pool, [{ id: 1, body: 'Soalan biasa tanpa rujukan.' }])
  for (const mode of ['dry-run', 'apply'] as const) {
    const r = await runQuestions({ pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode, batchSize: 2 })
    expect(r.report.status).toBe('succeeded')
  }
  await sql(`insert into staging_cloud.stimulus_kinds (id, slug) values (91, 'passage') on conflict (id) do update set slug = excluded.slug`)
  const table = '<table><tr><th>Tahun</th><th>Peristiwa</th></tr><tr><td>1957</td><td>Merdeka</td></tr></table>'
  const bodies: [number, string][] = [
    [5101, img(1)], // image only
    [5102, `<p>Perhatikan rajah berikut.</p>${img(2)}`], // image + text
    [5103, `${img(3)}<br>${img(4)}`], // two images
    [5104, img(5)], // picture missing from the export (unlisted)
    [5105, table], // table
    [5106, `${img(6)}`], // shared by two questions (a group)
    [5107, `<p>Teks sebelum rajah.</p>${img(7)}`], // text THEN picture: the text is linked first
    [5108, 'Petikan biasa.'],
  ]
  for (const [id, b] of bodies) await sql(`insert into archive_cloud.stimuli (id, stimulus_kind_id, body) values ($1, 91, $2)`, [id, html(b)])
  for (const [i, v2] of [9401, 9402, 9403, 9404, 9405].entries()) await canonical(v2, i + 1, `Soalan rajah ${i + 1}.`)
  await canonical(9408, 8, 'Soalan susunan.')
  await canonical(9406, 6, 'Soalan kumpulan A.')
  await canonical(9407, 7, 'Soalan kumpulan B.')
  await sql(`insert into archive_cloud.question_stimulus (id, exam_question_id, stimulus_id, position) values (1, 9401, 5101, 1), (2, 9402, 5102, 1), (3, 9403, 5103, 1), (4, 9404, 5104, 1), (5, 9405, 5105, 1), (6, 9406, 5106, 1), (7, 9407, 5106, 1), (8, 9408, 5107, 1), (9, 9408, 5108, 2)`)
}, 300_000)
afterAll(async () => {
  await h?.close()
  if (root) rmSync(root, { recursive: true, force: true })
})

describe('canonical stimuli with inline pictures and tables', () => {
  it('loads, copies the pictures and shows them', async () => {
    await load()
    // image only: a picture stimulus, no body, the file copied through MigrationFiles (public id, question_image), question served
    const only = await stimuliOf(9401)
    expect(only).toHaveLength(1)
    expect(only[0]).toMatchObject({ kind: 'image', body_ms: null, alt_text: 'Rajah 1' })
    expect(only[0]?.file).not.toBeNull()
    const file = (await sql(`select purpose, mime, public_id, legacy_id from files where id = $1::bigint`, [only[0]?.file])).rows[0]
    expect(file).toMatchObject({ purpose: 'question_image', mime: 'image/png' })
    expect(String(file?.public_id).length).toBeGreaterThan(10)
    expect((await stateOf(9401))?.is_active).toBe(true)

    // image + text: the picture first, the text as a passage stimulus after it
    const mixed = await stimuliOf(9402)
    expect(mixed.map((s) => [s.kind, s.pos])).toEqual([['passage', 1], ['image', 2]])
    expect(mixed[1]?.file).not.toBeNull()
    expect(mixed[0]).toMatchObject({ body_ms: 'Perhatikan rajah berikut.', file: null })
    expect((await stateOf(9402))?.is_active).toBe(true)

    // two images: two picture stimuli, each with its own file
    const two = await stimuliOf(9403)
    expect(two.map((s) => [s.kind, s.pos])).toEqual([['image', 1], ['image', 2]])
    expect(new Set(two.map((s) => s.file)).size).toBe(2)
    expect(two.every((s) => s.file !== null && s.body_ms === null)).toBe(true)
    expect((await stateOf(9403))?.is_active).toBe(true)

    // table: a table stimulus with the { head, rows } grid and no raw markup
    const tbl = await stimuliOf(9405)
    expect(tbl).toHaveLength(1)
    expect(tbl[0]).toMatchObject({ kind: 'table', body_ms: null, table_data: { head: ['Tahun', 'Peristiwa'], rows: [['1957', 'Merdeka']] } })
    expect((await stateOf(9405))?.is_active).toBe(true)

    // a stimulus shared by two questions is a group stimulus with the picture
    const grp = (await sql(`select s.kind, s.asset_file_id::text as file from questions q join stimulus_group_stimuli gs on gs.group_id = q.group_id join stimuli s on s.id = gs.stimulus_id where q.id = $1::bigint`, [await qOf(9406)])).rows
    expect(grp).toHaveLength(1)
    expect(grp[0]?.kind).toBe('image')
    expect(grp[0]?.file).not.toBeNull()

    // reading order of the body, and the other stimulus of the question after both parts
    expect((await stimuliOf(9408)).map((s) => [s.kind, s.pos])).toEqual([['passage', 1], ['image', 2], ['passage', 3]])

    // verify: the extra stimuli are not a stimulus V2 does not link
    const found = await readCanonicalFindings(h.pool, 'cloud')
    expect(found).toMatchObject({ foreignLink: 0, noStimulus: 0 })

    // no stimulus keeps markup
    expect((await sql(`select count(*)::int as n from stimuli where body_ms ~* '<(img|table)'`)).rows[0]?.n).toBe(0)
  })

  it('a picture that is not in the export holds the question (never dropped) and shows no picture', async () => {
    const s = await stimuliOf(9404)
    expect(s).toHaveLength(1)
    expect(s[0]).toMatchObject({ kind: 'image', file: null })
    const st = await stateOf(9404)
    expect(st?.is_active).toBe(false)
    expect(JSON.stringify(st?.import_issues)).toContain('legacy_image_unresolved')
    expect(JSON.stringify(st?.import_issues)).toContain(`stimuli/${U(5)}/rajah.png`)
  })

  it('a second run changes nothing, and a late file releases the held question', async () => {
    const before = await snapshot()
    await load()
    expect(await snapshot()).toBe(before)
    writeExport(join(root, 'export'), [1, 2, 3, 4, 5, 6, 7])
    await load()
    expect((await stateOf(9404))?.is_active).toBe(true)
    expect((await stimuliOf(9404))[0]?.file).not.toBeNull()
    const settled = await snapshot()
    await load()
    expect(await snapshot()).toBe(settled)
  })
})
