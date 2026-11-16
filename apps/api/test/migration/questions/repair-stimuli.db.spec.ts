/**
 * `migrate:repair-stimuli` (feature slug `etl-stimulus-inline-img`): stimuli that an earlier load left with V2 HTML as text are repaired in place.
 * The broken state is written straight into the V3 tables (what production holds); pictures are generated PNGs. Synthetic rows only.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { ApplyRefusedError, Runner } from '../../../src/migration/kit/runner'
import { runQuestions } from '../../../src/migration/load/questions'
import { openMigrationFiles } from '../../../src/migration/load/activity/files'
import { CoreNotes } from '../../../src/migration/load/context'
import { parseRepairArgs } from '../../../src/migration/load/questions/repair-stimuli-command'
import { candidatesDigest, QUESTION_IMAGE_ETL_CAP, repairStimuliStep } from '../../../src/migration/load/questions/repair-stimuli'
import { makePng } from '../../files/fixtures'
import { addArchive, AS_OF, bootQuestions, type QuestionsHarness } from './helpers'

let h: QuestionsHarness
let root: string
let env: Record<string, string>
const sql = (text: string, params: unknown[] = []) => h.pool.query(text, params)
const U = (n: number): string => `1c5f2f3c-9d1e-4c0a-8a43-5d2f6a1c7e${String(n).padStart(2, '0')}`
const img = (n: number): string => `<img src="/storage/stimuli/${U(n)}/rajah.png">`
const TABLE = '<table><tr><th>Tahun</th><th>Peristiwa</th></tr><tr><td>1957</td><td>Merdeka</td></tr></table>'

const qid = async (v2: number): Promise<string> => (await sql(`select new_id from etl_id_map where entity = 'questions' and legacy_id = $1`, [String(v2)])).rows[0]?.new_id as string
const stimulus = async (kind: string, body: string | null): Promise<string> =>
  (await sql(`insert into stimuli (kind, body_ms, caption, reusable) values ($1, $2, 'Rajah', true) returning id::text as id`, [kind, body])).rows[0]?.id as string
async function own(v2: number, ...stimuli: string[]): Promise<void> {
  const v = (await sql(`select id from question_versions where question_id = $1::bigint and version_no = 1`, [await qid(v2)])).rows[0]?.id
  for (const [i, s] of stimuli.entries()) await sql(`insert into question_version_stimuli (question_version_id, stimulus_id, position) values ($1, $2::bigint, $3)`, [v, s, i + 1])
}
const ownOf = async (v2: number) =>
  (await sql(
    `select s.kind, s.body_ms, s.table_data, s.asset_file_id::text as file, vs.position::int as pos from question_version_stimuli vs
       join question_versions v on v.id = vs.question_version_id join stimuli s on s.id = vs.stimulus_id where v.question_id = $1::bigint and v.version_no = 1 order by vs.position`, [await qid(v2)])).rows
const stateOf = async (v2: number) =>
  (await sql(`select q.is_active, v.import_issues from questions q join question_versions v on v.question_id = q.id and v.version_no = 1 where q.id = $1::bigint`, [await qid(v2)])).rows[0]
const snapshot = async (): Promise<string> =>
  JSON.stringify((await sql(
    `select (select count(*) from stimuli) s, (select count(*) from files) f, (select count(*) from questions where is_active) a,
            (select md5(coalesce(string_agg(id || coalesce(kind, '') || coalesce(body_ms, '') || coalesce(asset_file_id::text, '-') || coalesce(table_data::text, '-') , ',' order by id), '')) from stimuli) sm,
            (select md5(coalesce(string_agg(question_version_id || ':' || stimulus_id || ':' || position, ',' order by id), '')) from question_version_stimuli) own,
            (select md5(coalesce(string_agg(import_issues::text, ',' order by id), '')) from question_versions) iss`)).rows[0])

function writeExport(dir: string, present: number[]): void {
  mkdirSync(dir, { recursive: true })
  const sums: string[] = []
  for (const n of present) {
    const bytes = makePng({ width: 2 + n, height: 2 })
    mkdirSync(join(dir, 'stimuli', U(n)), { recursive: true })
    writeFileSync(join(dir, 'stimuli', U(n), 'rajah.png'), bytes)
    sums.push(`${createHash('sha256').update(bytes).digest('hex')}  stimuli/${U(n)}/rajah.png`)
  }
  // a picture of /storage/exam-media/ (the first stimulus uses it)
  const em = makePng({ width: 20, height: 2 })
  mkdirSync(join(dir, 'exam-media', 'set a'), { recursive: true })
  writeFileSync(join(dir, 'exam-media', 'set a', 'rajah.png'), em)
  sums.push(`${createHash('sha256').update(em).digest('hex')}  exam-media/set a/rajah.png`)
  writeFileSync(join(dir, 'SHA256SUMS'), `${sums.join('\n')}\n`)
}

async function run(mode: 'dry-run' | 'apply'): Promise<{ status: string; notes: Map<string, number>; rejected: number; fixed: number }> {
  const files = await openMigrationFiles({ dir: join(root, 'export'), env, mode, source: 'cloud', repoRoots: [process.cwd()], capOverrides: { question_image: QUESTION_IMAGE_ETL_CAP } })
  const notes = new CoreNotes()
  const found = await candidatesDigest(h.pool)
  const report = await new Runner({ pool: h.pool, env }).run({ mode, steps: [repairStimuliStep({ pool: h.pool, files, notes })], inputHash: `repair-${found.digest}-${files.manifestHash}`, batchSize: 2 })
  const r = report.recon[0]
  return { status: report.status, notes: new Map(notes.counters), rejected: r?.rejected ?? 0, fixed: r?.loaded ?? 0 }
}

beforeAll(async () => {
  h = await bootQuestions()
  root = mkdtempSync(join(tmpdir(), 'stim-repair-'))
  env = { ...h.runEnv, FILE_STORAGE_DIR: join(root, 'storage') }
  mkdirSync(env.FILE_STORAGE_DIR as string)
  writeExport(join(root, 'export'), [1, 2, 3, 4, 6, 8])
  await addArchive(h.pool, Array.from({ length: 9 }, (_, i) => ({ id: i + 1, body: `Soalan ${i + 1}?` })))
  for (const mode of ['dry-run', 'apply'] as const) {
    const r = await runQuestions({ pool: h.pool, env: h.runEnv, source: 'cloud', asOf: AS_OF, coreAsOf: AS_OF, mode, batchSize: 2 })
    expect(r.report.status).toBe('succeeded')
  }
  await own(1, await stimulus('passage', '<img src="/storage/exam-media/set%20a/rajah.png">')) // image only, from exam-media
  const s2 = await stimulus('passage', `Perhatikan rajah.${img(2)}`)
  await sql(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', 'canonical_stimuli', '7002', $1)`, [s2])
  await own(2, s2) // text THEN image, with a V2 id
  await own(3, await stimulus('passage', `${img(3)}${img(4)}`)) // two images
  await own(4, await stimulus('passage', img(5))) // picture not in the export
  await own(5, await stimulus('table', TABLE)) // table
  await own(6, await stimulus('passage', 'Teks biasa.'), await stimulus('passage', 'Teks dua.'), await stimulus('passage', `${img(8)}Nota.`)) // no room for the extra
  await own(7, await stimulus('passage', 'Petikan biasa sahaja.')) // untouched
  await own(9, await stimulus('passage', `Teks A.${img(1)}`), await stimulus('passage', 'Teks B.')) // a later link is shifted, not overwritten
  // a group of two questions shows one picture stimulus
  const g = (await sql(`insert into stimulus_groups (label, scope) values (null, 'section') returning id::text as id`)).rows[0]?.id as string
  await sql(`insert into stimulus_group_stimuli (group_id, stimulus_id, position) values ($1::bigint, $2::bigint, 1)`, [g, await stimulus('passage', img(6))])
  await sql(`update questions set group_id = $1::bigint, group_position = case id when $2::bigint then 1 else 2 end where id in ($2::bigint, $3::bigint)`, [g, await qid(8), await qid(9)])
}, 300_000)
afterAll(async () => {
  await h?.close()
  if (root) rmSync(root, { recursive: true, force: true })
})

describe('parseRepairArgs', () => {
  const args = (flags: Record<string, string | true>) => ({ mode: 'dry-run' as const, flags: new Map(Object.entries(flags)), positional: [] as string[] })
  it('needs --files-dir and refuses unknown flags', () => {
    expect(() => parseRepairArgs(args({}), (d) => d)).toThrow('--files-dir')
    expect(() => parseRepairArgs(args({ 'files-dir': '/x', nope: '1' }), (d) => d)).toThrow('unknown flag --nope')
    expect(parseRepairArgs(args({ 'files-dir': '/x', 'batch-size': '5', 'out-dir': '/y' }), (d) => d)).toMatchObject({ filesDir: '/x', batchSize: 5, outDir: '/y' })
  })
})

describe('repair of loaded stimuli', () => {
  it('a dry-run reports the counts and changes nothing', async () => {
    const before = await snapshot()
    const dry = await run('dry-run')
    expect(dry.status).toBe('succeeded')
    expect(await snapshot()).toBe(before)
    expect(dry.fixed).toBe(7)
    expect(dry.rejected).toBe(1)
    expect(dry.notes.get('failed.unlisted')).toBe(1)
    expect(dry.notes.get('fixed.table')).toBe(1)
  })

  it('apply fixes every case, holds the unusable picture, and refuses without a dry-run on the same input', async () => {
    const applied = await run('apply')
    expect(applied.status).toBe('succeeded')
    expect(applied.fixed).toBe(7)

    const a = await ownOf(1)
    expect(a).toMatchObject([{ kind: 'image', body_ms: null }])
    expect(a[0]?.file).not.toBeNull()
    expect((await sql(`select purpose, mime from files where id = $1::bigint`, [a[0]?.file])).rows[0]).toMatchObject({ purpose: 'question_image', mime: 'image/png' })

    const b = await ownOf(2)
    expect(b.map((s) => [s.kind, s.pos, s.body_ms])).toEqual([['passage', 1, 'Perhatikan rajah.'], ['image', 2, null]])
    expect(b[1]?.file).not.toBeNull()
    // the extra is known to the id map under the loader's key (verify and rollback recognise it)
    expect((await sql(`select count(*)::int as n from etl_id_map where entity = 'canonical_stimulus_extras' and legacy_id = '7002#1'`)).rows[0]?.n).toBe(1)
    // the question that shows a repaired row first keeps its other stimulus after both parts
    expect((await ownOf(9)).map((s) => [s.kind, s.pos, s.body_ms])).toEqual([['passage', 1, 'Teks A.'], ['image', 2, null], ['passage', 3, 'Teks B.']])

    const c = await ownOf(3)
    expect(c.map((s) => [s.kind, s.pos])).toEqual([['image', 1], ['image', 2]])
    expect(new Set(c.map((s) => s.file)).size).toBe(2)

    expect((await ownOf(5))[0]).toMatchObject({ kind: 'table', body_ms: null, table_data: { head: ['Tahun', 'Peristiwa'], rows: [['1957', 'Merdeka']] } })

    // the group stimulus
    const grp = (await sql(`select s.kind, s.asset_file_id::text as file from questions q join stimulus_group_stimuli gs on gs.group_id = q.group_id join stimuli s on s.id = gs.stimulus_id where q.id = $1::bigint`, [await qid(8)])).rows
    expect(grp).toHaveLength(1)
    expect(grp[0]?.kind).toBe('image')
    expect(grp[0]?.file).not.toBeNull()

    // unusable picture: the question is held, nothing is dropped
    const d = await stateOf(4)
    expect(d?.is_active).toBe(false)
    expect(JSON.stringify(d?.import_issues)).toContain(`stimuli/${U(5)}/rajah.png`)

    // three stimuli already: the picture is fixed, the extra text has no position, so the question is held
    expect((await ownOf(6))).toHaveLength(3)
    expect((await stateOf(6))?.is_active).toBe(false)
    expect(JSON.stringify((await stateOf(6))?.import_issues)).toContain('stimulus-slot')

    // an untouched stimulus stays; no row keeps markup
    expect((await ownOf(7))[0]?.body_ms).toBe('Petikan biasa sahaja.')
    expect((await sql(`select count(*)::int as n from stimuli where body_ms ~* '<(img|table)'`)).rows[0]?.n).toBe(1) // only the unusable one
    await expect(run('apply')).rejects.toBeInstanceOf(ApplyRefusedError)
  })

  it('a second run changes nothing; a late file releases the held question', async () => {
    const before = await snapshot()
    expect((await run('dry-run')).status).toBe('succeeded')
    expect((await run('apply')).status).toBe('succeeded')
    expect(await snapshot()).toBe(before)

    writeExport(join(root, 'export'), [1, 2, 3, 4, 5, 6, 8])
    const dry = await run('dry-run')
    expect(dry.notes.get('questions.released')).toBe(1)
    expect((await run('apply')).status).toBe('succeeded')
    expect((await stateOf(4))?.is_active).toBe(true)
    expect((await ownOf(4))[0]?.file).not.toBeNull()
    const settled = await snapshot()
    expect((await run('dry-run')).fixed).toBe(0)
    expect((await run('apply')).status).toBe('succeeded')
    expect(await snapshot()).toBe(settled)
  })
})
