/**
 * K10 (PO acceptance rule): a question migrated from V2 must be fully compatible with V3's add-question process. This spec loads the
 * SYNTHETIC rajah and repair cases (fixtures/rajah-cases.ts) plus structured and subjective rows through the REAL ETL loaders into a V3
 * database, boots the REAL application (every feature module) and, over HTTP as Admin Pusat, walks each class of migrated question through
 * what the Studio does:
 *
 *   open (GET /api/questions/:id)  ->  Studio form read (the hydrate rules of StudioEditorPage, ported below)  ->  edit and save
 *   (PUT /api/questions/:id, the body the Studio sends)  ->  tag DSKP (Bab, Tajuk, SP, TP, Aras, Kesukaran, Kertas)  ->  gate-check
 *   ->  Semakan (POST .../status review)  ->  Terbitkan (approved)  ->  the pupil's Latih Tubi session.
 *
 * Every step is compared with a question created from scratch through the same Studio API: same refusals, same data shape (no field the
 * Studio cannot read or edit). The frontend code itself cannot be imported here (`@/` aliases), so `studioForm` ports the two pure
 * functions the page uses (`hydrate`, `toRequestBody` of src/modules/m04-question-bank/lib/studio/draft.ts), and the spec says when a
 * shape is one the Studio form shows read-only (a Studio limitation that a V3-made question of the same shape has too).
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { renderDdl } from '../../../src/migration/ddl/render'
import { RAJAH_IDS, rajahCaseRows } from '../../../src/migration/fixtures/rajah-cases'
import { Runner } from '../../../src/migration/kit/runner'
import { buildQuestionsSteps, QuestionsContext } from '../../../src/migration/load/questions'
import { openMigrationFiles } from '../../../src/migration/load/activity/files'
import { filesStep, QUESTION_IMAGE_ETL_CAP } from '../../../src/migration/load/questions/files-step'
import { runPostLoad } from '../../../src/migration/load/questions/post-load'
import { buildStructuredSteps } from '../../../src/migration/load/questions/structured-index'
import { detailView } from '../../../src/modules/questions/http/views'
import { QuestionsService } from '../../../src/modules/questions'
import { makePng } from '../../files/fixtures'
import { bootFullApp, loginFull, type FullApp, type FullClient } from '../../r1/full-app'

vi.setConfig({ testTimeout: 180_000, hookTimeout: 300_000 })

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Wire = Record<string, any>
const ENV = { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }
const AS_OF = '2026-11-10'

let t: FullApp
let pool: pg.Pool
let admin: FullClient
let pupil: FullClient
const loaded: Record<string, string> = {}
const structuredIds: Record<string, string> = {}
/** The curriculum the admin tags with (Matematik Tingkatan 4). */
const cur = { subject: '', level: '', unit: '', unitCode: '', sp: '', chapter: '', badChapter: '' }
let storageDir = ''
const tmpRoots: string[] = []

const rows = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => (await pool.query(sql, params)).rows as T[]
const one = async (sql: string, params: unknown[] = []): Promise<string> => (await pool.query<{ id: string }>(sql, params)).rows[0]?.id as string
const q = (legacy: number | string): string => loaded[String(legacy)] as string
const said = (r: { status: number; body: unknown }): string => `${String(r.status)} ${JSON.stringify(r.body).slice(0, 600)}`

/* ------------------------------------------------------------------------------------------ Studio form (port) */

const COGNITIVE = ['mengingat', 'memahami', 'mengaplikasi', 'menganalisis', 'menilai', 'mencipta']
const KBAT = ['mengaplikasi', 'menganalisis', 'menilai', 'mencipta']
const LEAF_KEYS = new Set(['label', 'prompt', 'marks', 'mode', 'options', 'key', 'difficultyTp', 'cognitiveLevel', 'kbat'])
const isSet = (v: unknown): boolean => v !== undefined && v !== null

/** Port of `lossOf` (draft.ts): what a Studio save would drop from a stored leaf. */
function lossOf(p: Wire): string[] {
  const lost: string[] = []
  for (const k of Object.keys(p)) if (!LEAF_KEYS.has(k) && isSet(p[k])) lost.push(k)
  if (isSet(p.prompt?.en)) lost.push('prompt.en')
  for (const o of (p.options ?? []) as Wire[]) if (isSet(o.body?.en) || Object.keys(o).some((k) => !['label', 'body', 'imageId'].includes(k))) lost.push('options')
  const key = p.key as Wire | undefined
  if (key) {
    for (const k of Object.keys(key)) if (!['kind', 'correct', 'values', 'caseSensitive', 'anyOrder'].includes(k)) lost.push(`key.${k}`)
    if (key.caseSensitive === true) lost.push('key.caseSensitive')
    if (key.anyOrder === true) lost.push('key.anyOrder')
    if (p.mode === 'short_text' && ((key.values ?? []) as unknown[]).some((v) => typeof v !== 'string' || v !== v.trim() || v.includes('\n'))) lost.push('key.values')
    if (p.mode === 'numeric') {
      const values = (key.values ?? []) as Wire[]
      if (values.length > 1) lost.push('key.values')
      for (const v of values) {
        if (typeof v !== 'object') continue
        if (isSet(v.tolKind) && v.tolKind !== 'abs') lost.push('key.tolKind')
        if ((v.unitAlt ?? []).length > 0) lost.push('key.unitAlt')
        if (isSet(v.sigFigs)) lost.push('key.sigFigs')
        if (isSet(v.decimals)) lost.push('key.decimals')
      }
    }
  }
  if (isSet(p.kbat) && COGNITIVE.includes(p.cognitiveLevel)) {
    const written = KBAT.includes(p.cognitiveLevel) ? p.cognitiveLevel : 'bukan'
    if (p.kbat !== written) lost.push('kbat')
  }
  return [...new Set(lost)]
}

/** Port of hydrate + leafToPart for one leaf; null when the form cannot hold it (the page then shows the question read-only). */
function formLeaf(p: Wire, cognitive?: string): { part: Wire | null; why: string[] } {
  if (Array.isArray(p.children)) return { part: null, why: ['nested'] }
  const lost = lossOf(p)
  if (lost.length > 0) return { part: null, why: lost }
  const cog = cognitive ?? (COGNITIVE.includes(p.cognitiveLevel) ? p.cognitiveLevel : COGNITIVE.includes(p.kbat) ? p.kbat : null)
  const base: Wire = {
    label: String(p.label).trim(),
    prompt: { ms: String(p.prompt?.ms ?? '').trim() },
    marks: Math.max(0, Math.trunc(p.marks ?? 1)),
    ...(typeof p.difficultyTp === 'number' ? { difficultyTp: p.difficultyTp } : {}),
    ...(cog === null ? {} : { cognitiveLevel: cog, kbat: KBAT.includes(cog) ? cog : 'bukan' }),
  }
  if (p.mode === 'mcq' && p.key?.kind === 'option') {
    return {
      why: [],
      part: {
        ...base,
        mode: 'mcq',
        options: (p.options as Wire[]).map((o) => {
          const text = o.body.ms === o.label ? '' : String(o.body.ms)
          return { label: o.label, body: { ms: text.trim() === '' ? o.label : text.trim() }, ...(o.imageId ? { imageId: o.imageId } : {}) }
        }),
        key: { kind: 'option', correct: p.key.correct },
      },
    }
  }
  if (p.mode === 'short_text' && p.key?.kind === 'accepted') return { why: [], part: { ...base, mode: 'short_text', key: { kind: 'accepted', values: p.key.values } } }
  return { part: null, why: [`mode ${String(p.mode)} key ${String(p.key?.kind)}`] }
}

/** What `StudioEditorPage` does with a stored question: `unsupported` is empty when the form can hold it. */
function studioForm(detail: Wire, cognitive?: string): { unsupported: string[]; parts: Wire[] } {
  const unsupported: string[] = []
  const parts: Wire[] = []
  for (const p of (detail.parts ?? []) as Wire[]) {
    const r = formLeaf(p, cognitive)
    if (r.part === null) unsupported.push(`${String(p.label)}: ${r.why.join(',')}`)
    else parts.push(r.part)
  }
  return { unsupported, parts }
}

/** Port of `toRequestBody` (save of the form), `tag` and the other fields as the form holds them. */
function saveBody(detail: Wire, over: Wire = {}, cognitive?: string): Wire {
  const f = studioForm(detail, cognitive)
  if (f.unsupported.length > 0) throw new Error(`the Studio form is read-only for this question: ${f.unsupported.join(' | ')}`)
  const tps = f.parts.map((p) => p.difficultyTp).filter((v): v is number => typeof v === 'number')
  const tp = tps.length > 0 ? Math.max(...tps) : (detail.tag?.tp ?? null)
  return {
    subjectId: detail.subjectId ?? '',
    educationLevelId: detail.educationLevelId ?? '',
    difficultyLevel: detail.difficultyLevel,
    questionType: 'essay',
    questionText: String(detail.questionText).trim(),
    parts: f.parts,
    tag: { unitId: detail.tag?.unitId ?? null, spIds: detail.tag?.spIds ?? [], tp },
    curriculumChapterId: detail.curriculumChapterId ?? null,
    kertas: detail.kertas ?? null,
    numberLabel: detail.numberLabel ?? null,
    questionImageFileId: detail.questionImage ?? null,
    explanation: detail.explanation === null || detail.explanation === undefined || String(detail.explanation).trim() === '' ? null : String(detail.explanation).trim(),
    ...over,
  }
}

/** Port of `editAsDraftBody`: the stored question sent back as read (what "Edit sebagai draf" does). */
const editAsDraftBody = (d: Wire): Wire => ({ subjectId: d.subjectId ?? '', educationLevelId: d.educationLevelId ?? '', difficultyLevel: d.difficultyLevel, questionText: d.questionText, ...(d.parts === undefined ? {} : { parts: d.parts }) })

/** The aras of every leaf of a tree (any depth), as the Studio writes it. */
function withCognitive(parts: Wire[], level: string): Wire[] {
  return parts.map((p) => (Array.isArray(p.children) ? { ...p, children: withCognitive(p.children, level) } : { ...p, cognitiveLevel: level, kbat: KBAT.includes(level) ? level : 'bukan' }))
}

/* ------------------------------------------------------------------------------------------------ HTTP helpers */

const get = async (id: string): Promise<Wire> => {
  const r = await admin.get(`/api/questions/${id}`)
  if (r.status === 500) {
    // The envelope hides the cause; run the same view mapper on the stored record to name it.
    try {
      detailView(await t.app.get(QuestionsService, { strict: false }).getAdmin(id))
    } catch (e) {
      throw new Error(`GET /api/questions/${id} is a 500: ${e instanceof Error ? e.message.slice(0, 1500) : String(e)}`)
    }
  }
  expect(r.status, `GET /api/questions/${id}: ${said(r)}`).toBe(200)
  return r.body.data as Wire
}
const put = async (id: string, body: Wire, expected = 200): Promise<Wire> => {
  const r = await admin.put(`/api/questions/${id}`, body)
  expect(r.status, `PUT /api/questions/${id}: ${said(r)}`).toBe(expected)
  return r.body as Wire
}
const gate = async (id: string, which: 'submit' | 'approve' = 'approve'): Promise<{ path: string; code: string; message: string }[]> => {
  const r = await admin.get(`/api/questions/${id}/gate-check?gate=${which}`)
  expect(r.status, `gate-check ${id}: ${said(r)}`).toBe(200)
  return r.body.data.issues as { path: string; code: string; message: string }[]
}
const move = async (id: string, to: string, expected = 200): Promise<Wire> => {
  const r = await admin.post(`/api/questions/${id}/status`, to === 'draft' ? { to, reason: 'Disemak semula di Studio.' } : { to })
  expect(r.status, `status ${id} -> ${to}: ${said(r)}`).toBe(expected)
  return r.body as Wire
}
const versions = (id: string) => rows<{ version_no: number; status: string }>(`select version_no, status from question_versions where question_id = $1::bigint order by version_no`, [id])
const latestStatus = async (id: string): Promise<string> => (await versions(id)).at(-1)?.status as string

/** Tags the question the way the Studio does (Bab, Tajuk, SP, TP on the question, Aras on every leaf, Kertas) and saves it. */
async function tagThroughStudio(id: string, over: Wire = {}): Promise<Wire> {
  const d = await get(id)
  const form = studioForm(d).unsupported.length === 0
  const base = form ? saveBody(d, {}, 'memahami') : { ...editAsDraftBody(d), parts: withCognitive(d.parts, 'memahami'), tag: { unitId: d.tag?.unitId ?? null, spIds: d.tag?.spIds ?? [], tp: d.tag?.tp ?? null } }
  return put(id, { ...base, tag: { unitId: cur.unit, spIds: [cur.sp], tp: 3 }, curriculumChapterId: cur.chapter, kertas: '1', difficultyLevel: d.difficultyLevel ?? 3, ...over })
}

/** Normalised shape of a wire question: every key path with the type of its value (texts and ids replaced). */
function shapeOf(v: unknown, path = '', out = new Set<string>()): Set<string> {
  if (Array.isArray(v)) {
    out.add(`${path}[]`)
    v.forEach((x) => shapeOf(x, `${path}[]`, out))
  } else if (v !== null && typeof v === 'object') {
    for (const [k, x] of Object.entries(v)) shapeOf(x, `${path}.${k}`, out)
  } else out.add(`${path}:${v === null ? 'null' : typeof v}`)
  return out
}
/** The DSKP tags of a leaf (Aras, KBAT, TP) are written by the Studio on any question; they are not part of the loaded shape. */
const isTag = (x: string): boolean => /\.(cognitiveLevel|kbat|difficultyTp):/.test(x)
const shapeDiff = (a: unknown, b: unknown): { onlyA: string[]; onlyB: string[] } => {
  const [sa, sb] = [new Set([...shapeOf(a)].filter((x) => !isTag(x))), new Set([...shapeOf(b)].filter((x) => !isTag(x)))]
  return { onlyA: [...sa].filter((x) => !sb.has(x)).sort(), onlyB: [...sb].filter((x) => !sa.has(x)).sort() }
}

/* --------------------------------------------------------------------------------------------------- the load */

async function runSteps(ctx: QuestionsContext, steps: ReturnType<typeof buildQuestionsSteps>, mode: 'dry-run' | 'apply', hash: string) {
  return new Runner({ pool, env: ENV }).run({ mode, steps, inputHash: hash, batchSize: 7 })
}

const MISSING_PATH = 'soalan/rajah4.png'

/** What `--files-dir` does (rajah.db.spec.ts copyPictures): the pictures go through MigrationFiles into the app's own storage and the holds lift. */
async function copyPictures(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'k10-files-'))
  tmpRoots.push(root)
  const dir = join(root, 'export')
  mkdirSync(dir)
  const paths = (await rows<{ p: string }>(`select distinct image_path as p from archive_cloud.questions where image_path is not null`)).map((r) => r.p).sort()
  const sums: string[] = []
  for (const [n, p] of paths.entries()) {
    if (p === MISSING_PATH) continue
    const bytes = makePng({ width: 2 + n, height: 2 })
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), bytes)
    sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ./${p}`)
  }
  writeFileSync(join(dir, 'SHA256SUMS'), sums.join('\n') + '\n')
  for (const mode of ['dry-run', 'apply'] as const) {
    const fenv = { ...ENV, FILE_STORAGE_DIR: storageDir }
    const ctx = new QuestionsContext({ pool, env: fenv, source: 'cloud', asOf: AS_OF, pageSize: 11 })
    ctx.files = await openMigrationFiles({ dir, env: fenv, mode, source: 'cloud', repoRoots: [process.cwd()], capOverrides: { question_image: QUESTION_IMAGE_ETL_CAP } })
    const report = await runSteps(ctx, [filesStep(ctx, ctx.files)], mode, 'k10-files')
    expect(report.status).toBe('succeeded')
  }
}

beforeAll(async () => {
  t = await bootFullApp()
  storageDir = process.env.FILE_STORAGE_DIR as string
  pool = new pg.Pool({ connectionString: t.db.url, max: 4 })
  admin = await loginFull(t, 'admin@demo.test')
  pupil = await loginFull(t, 'pelajar@demo.test')

  // The curriculum the V2 ids map to: Matematik, Tingkatan 4 (it has DSKP nodes AND chapters, so the Bab and Tajuk rules both bind).
  cur.subject = await one(`select id::text as id from subjects where code = 'MATH'`)
  cur.level = await one(`select id::text as id from education_levels where code = 'T4'`)
  const unit = (await rows<{ id: string; code: string }>(`select id::text, code from curriculum_nodes where kind = 'unit' and subject_id = $1::bigint and education_level_id = $2::bigint order by sort_order, id limit 1`, [cur.subject, cur.level]))[0]
  cur.unit = unit?.id as string
  cur.unitCode = unit?.code as string
  cur.sp = await one(`select id::text as id from curriculum_nodes where kind = 'sp' and subject_id = $1::bigint and education_level_id = $2::bigint order by sort_order, id limit 1`, [cur.subject, cur.level])
  const other = (await rows<{ code: string }>(`select code from curriculum_nodes where kind = 'unit' and subject_id = $1::bigint and education_level_id = $2::bigint and split_part(code, '.', 1) <> split_part($3, '.', 1) order by sort_order, id limit 1`, [cur.subject, cur.level, cur.unitCode]))[0]
  // Two chapters whose printed DSKP code decides the Bab-Tajuk pair (G-02): one belongs to the unit, one to another unit.
  const chapter = (code: string, n: number) =>
    one(`insert into chapters (subject_id, education_level_id, name, chapter_number, dskp_code, is_active) values ($1::bigint, $2::bigint, $3, $4, $5, true) returning id::text as id`, [cur.subject, cur.level, `Bab K10 ${String(n)}`, 900 + n, code])
  cur.chapter = await chapter(cur.unitCode, 1)
  cur.badChapter = await chapter(other?.code as string, 2)

  // The V2 staging tables, the V2 -> V3 id maps (what migrate:core leaves), and the synthetic V2 rows. V2 holds no Bab and no Topik (100% NULL).
  await pool.query(renderDdl())
  for (const [entity, legacy, id] of [['subjects', '1', cur.subject], ['education_levels', '1', cur.level]] as const) {
    await pool.query(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', $1, $2, $3)`, [entity, legacy, id])
  }
  const cases = rajahCaseRows({ id: 1, subject_id: 1, education_level_id: 1 })
  for (const r of cases.questions) {
    await pool.query(
      `insert into archive_cloud.questions (id, subject_id, education_level_id, chapter_id, topic_id, difficulty_level, type, status, body, image_path, created_at, updated_at)
       values ($1, $2, $3, null, null, $4, $5, $6, $7, $8, $9::timestamptz, $9::timestamptz)`,
      [r.id, r.subject_id, r.education_level_id, r.difficulty_level, r.type, r.status, r.body, r.image_path, r.created_at],
    )
  }
  for (const o of cases.options) {
    await pool.query(`insert into archive_cloud.question_options (id, question_id, label, body, is_correct) values ($1, $2, $3, $4, $5)`, [o.id, o.question_id, o.label, o.body, o.is_correct])
  }
  await pool.query(`insert into archive_cloud.questions (id, subject_id, education_level_id, type, status, body, explanation, created_at, updated_at) values
    (901, 1, 1, 'subjektif', 'diarkib', 'Huraikan satu contoh pencemaran udara.', 'Jawapan model: asap kilang dan kenderaan.', '2025-01-01', '2025-01-01'),
    (902, 1, 1, 'subjektif', 'diarkib', 'Terangkan satu kelebihan tenaga suria.', null, '2025-01-01', '2025-01-01')`)
  await pool.query(`insert into archive_cloud.structured_questions (id, subject_id, education_level_id, status, stimulus, kbat_level, total_marks, created_at, updated_at) values
    (1, 1, 1, 'diluluskan', 'Sebuah kilang membuang sisa ke sungai berdekatan.', 'menganalisis', 6, '2025-01-01', '2025-01-01'),
    (2, 1, 1, 'diarkib', 'Soalan struktur lama tentang pencemaran.', null, 2, '2025-01-01', '2025-01-01'),
    (3, 1, 1, 'draf', 'Soalan struktur draf tentang kitaran air.', null, 2, '2025-01-01', '2025-01-01'),
    (4, 1, 1, 'menunggu', 'Soalan struktur menunggu semakan tentang ekosistem.', null, 1, '2025-01-01', '2025-01-01')`)
  await pool.query(`insert into archive_cloud.structured_sub_questions (id, structured_question_id, number, body, marks, scheme) values
    (11, 1, '(a)', 'Namakan satu bahan pencemar.', 1, 'Mana-mana satu bahan pencemar yang munasabah.'),
    (12, 1, '(b)', 'Huraikan kesan terhadap hidupan sungai.', 3, 'Skema kesan terhadap hidupan.'),
    (13, 1, '(c)', 'Cadangkan dua langkah mengawal pencemaran.', 2, 'Langkah kawalan.'),
    (21, 2, '(a)', 'Nyatakan punca pencemaran.', 2, 'Punca pencemaran.'),
    (31, 3, '(a)', 'Namakan satu proses dalam kitaran air.', 2, 'Sejatan atau kondensasi.'),
    (41, 4, '(a)', 'Namakan satu pengeluar dalam ekosistem.', 1, 'Tumbuhan hijau.')`)
  await pool.query(`insert into archive_cloud.structured_rubric_points (id, structured_sub_question_id, code, text, marks, position) values
    (1, 12, 'A1', 'Hidupan air mati kerana kekurangan oksigen terlarut', 1, 0),
    (2, 12, 'A2', $1, 2, 1),
    (3, 13, 'B1', 'Kitar semula sisa', 1, 0), (4, 13, 'B2', 'Penguatkuasaan undang-undang', 1, 1)`, ['Rantai makanan terganggu kerana populasi ikan berkurang. '.repeat(5)])

  // 1. the legacy bank (all statuses, rajah repair), dry-run then apply; 2. structured + subjective; 3. the pictures; 4. post-load.
  const mkCtx = () => new QuestionsContext({ pool, env: ENV, source: 'cloud', asOf: AS_OF, pageSize: 11 })
  for (const mode of ['dry-run', 'apply'] as const) {
    const ctx = mkCtx()
    expect((await runSteps(ctx, buildQuestionsSteps(ctx), mode, 'k10-questions')).status).toBe('succeeded')
  }
  for (const mode of ['dry-run', 'apply'] as const) {
    const ctx = mkCtx()
    expect((await runSteps(ctx, buildStructuredSteps(ctx), mode, 'k10-structured')).status).toBe('succeeded')
  }
  await copyPictures()
  await runPostLoad(pool, 'cloud')
  for (const r of await rows<{ legacy_id: string; id: string }>(`select legacy_id, id::text as id from questions where legacy_source = 'cloud'`)) loaded[r.legacy_id] = r.id
  for (const r of await rows<{ legacy_id: string; new_id: string }>(`select legacy_id, new_id from etl_id_map where entity = 'structured_questions'`)) structuredIds[r.legacy_id] = r.new_id
}, 600_000)

afterAll(async () => {
  for (const r of tmpRoots) rmSync(r, { recursive: true, force: true })
  await pool?.end()
  await t?.close()
})

/* ------------------------------------------------------------------------------------------ scratch references */

/** A question created from scratch through the Studio API: the reference for "same validation, same data shape". */
const scratch = {
  async mcq(options = ['4', '5', '6', '7'], correct = 'B', over: Wire = {}): Promise<string> {
    const r = await admin.post('/api/questions', {
      subjectId: cur.subject,
      educationLevelId: cur.level,
      difficultyLevel: 3,
      questionType: 'essay',
      questionText: 'Berapakah hasil tambah dua dan tiga hari ini?',
      parts: [{ label: 'a', prompt: { ms: 'Pilih jawapan yang betul.' }, marks: 1, mode: 'mcq', options: options.map((o, i) => ({ label: 'ABCDEFGH'.charAt(i), body: { ms: o } })), key: { kind: 'option', correct } }],
      tag: { unitId: null, spIds: [], tp: null },
      curriculumChapterId: null,
      kertas: null,
      numberLabel: null,
      questionImageFileId: null,
      explanation: null,
      ...over,
    })
    expect(r.status, said(r)).toBe(201)
    return r.body.data.id as string
  },
}

/* ============================================================================================================ */

describe('the load itself: every class is there and reads back through the Studio endpoint', () => {
  it('opens every loaded question over HTTP (GET /api/questions/:id parses against the contract), and the V2 untagged state is what the gate sees', async () => {
    const ids = Object.values(loaded)
    expect(ids.length).toBeGreaterThan(80)
    for (const id of ids) await get(id) // a 500 here is a StoredKeyError / contract drift
    for (const id of Object.values(structuredIds)) {
      const r = await admin.get(`/api/structured-questions/${id}`)
      expect(r.status, said(r)).toBe(200)
      const rb = await admin.get(`/api/structured-questions/${id}/rubric`)
      expect(rb.status, said(rb)).toBe(200)
    }
  })
})

describe('the Studio list', () => {
  it('lists the migrated questions of every status with the status filter, and the four status tiles count them', async () => {
    for (const [status, legacy] of [['archived', RAJAH_IDS.archived], ['draft', RAJAH_IDS.draft], ['approved', 101009]] as const) {
      const r = await admin.get(`/api/questions?status=${status}&subjectId=${cur.subject}&pageSize=100&search=${encodeURIComponent('Soalan')}`)
      expect(r.status, said(r)).toBe(200)
      expect((r.body.data as Wire[]).map((x) => x.id), status).toContain(q(legacy))
    }
    const all = await admin.get(`/api/questions?subjectId=${cur.subject}&pageSize=10`)
    expect(all.body.meta.counts.archived).toBeGreaterThan(5)
    expect(all.body.meta.counts.approved).toBeGreaterThan(20)
  })
})

describe('MCQ: a migrated approved question vs one made in the Studio', () => {
  it('has the same data shape as a question created from scratch (no migration-only field in the part tree)', async () => {
    const migrated = await get(q(101009))
    const fresh = await get(await scratch.mcq(['Satu', 'Dua', 'Tiga', 'Empat'], 'A'))
    const { onlyA, onlyB } = shapeDiff(migrated.parts, fresh.parts)
    expect({ migratedOnly: onlyA, scratchOnly: onlyB }).toEqual({ migratedOnly: [], scratchOnly: [] })
    expect(Object.keys(migrated).sort()).toEqual(Object.keys(fresh).sort())
    expect(migrated.questionType).toBe(fresh.questionType)
  })

  it('opens in the Studio form, saves as an edit (Edit sebagai draf, then the form save) and keeps the answer key', async () => {
    const id = q(101009)
    const d0 = await get(id)
    expect(d0.status).toBe('approved')
    expect(studioForm(d0).unsupported).toEqual([])
    await put(id, editAsDraftBody(d0)) // "Edit sebagai draf": version 2 as a draft, version 1 keeps serving
    expect((await versions(id)).map((v) => v.status)).toEqual(['approved', 'draft'])
    const d1 = await get(id)
    expect(d1.status).toBe('draft')
    const res = await put(id, saveBody(d1, { questionText: `${String(d1.questionText)} (disunting)` }))
    expect(res.data.questionText).toMatch(/\(disunting\)$/)
    const d2 = await get(id)
    expect(d2.parts[0].key).toEqual(d0.parts[0].key)
    expect(d2.parts[0].options).toEqual(d0.parts[0].options)
  })

  it('is refused for the same reasons as a new question: no unit/SP/Bab/aras at Terbitkan, a Bab and Tajuk that do not belong together, a key that is not an option', async () => {
    const id = q(101009)
    const fresh = await scratch.mcq()
    const mine = (await gate(id)).map((i) => i.code).sort()
    const theirs = (await gate(fresh)).map((i) => i.code).sort()
    // The same gate and the same answers; the one difference is the TP, which V2 filled from its Kesukaran (so no LEAF_NO_TP).
    expect(theirs.filter((c) => !mine.includes(c))).toEqual(['LEAF_NO_TP', 'TP_MISSING'])
    expect(mine).toEqual(['LEAF_NO_ARAS', 'NO_CHAPTER', 'NO_KERTAS', 'NO_SP', 'NO_UNIT'])
    // Bab-Tajuk pair rule: a Bab whose printed DSKP code is another unit is refused, naming the Tajuk field, on both.
    const d = await get(id)
    const df = await get(fresh)
    const badOf = (x: Wire) => ({ ...saveBody(x), tag: { unitId: cur.unit, spIds: [cur.sp], tp: 3 }, curriculumChapterId: cur.badChapter })
    const [r1, r2] = [await admin.put(`/api/questions/${id}`, badOf(d)), await admin.put(`/api/questions/${fresh}`, badOf(df))]
    expect([r1.status, r2.status]).toEqual([422, 422])
    expect(r1.body.error.fields).toEqual(r2.body.error.fields)
    expect(Object.keys(r1.body.error.fields)).toEqual(['tag.unitId'])
    // answer key: a correct label outside the options
    const wrongKey = (x: Wire) => ({ ...saveBody(x), parts: [{ ...saveBody(x).parts[0], key: { kind: 'option', correct: 'Z' } }] })
    const [k1, k2] = [await admin.put(`/api/questions/${id}`, wrongKey(d)), await admin.put(`/api/questions/${fresh}`, wrongKey(df))]
    expect([k1.status, k2.status]).toEqual([422, 422])
    expect(Object.keys(k1.body.error.fields)).toEqual(Object.keys(k2.body.error.fields))
  })

  it('tags (Bab, Tajuk, SP, TP, Aras, Kertas), submits for review and is approved again; a refusal leaves it a draft', async () => {
    const id = q(101009)
    await move(id, 'review') // the submit gate has no DSKP rule
    await move(id, 'draft')
    const refused = await admin.post(`/api/questions/${id}/status`, { to: 'approved' })
    expect(refused.status, said(refused)).toBe(409) // from draft the lifecycle needs Semakan first (the same for a new question)
    await tagThroughStudio(id)
    expect(await gate(id)).toEqual([])
    await move(id, 'review')
    const done = await move(id, 'approved')
    expect(done.data.servability, 'approval answers where it is served').not.toBeNull()
    expect(await versions(id)).toEqual([{ version_no: 1, status: 'archived' }, { version_no: 2, status: 'approved' }])
    const live = await get(id)
    expect(live).toMatchObject({ status: 'approved', curriculumChapterId: cur.chapter, tag: { unitId: cur.unit, tp: 3 } })
  })
})

describe('MCQ variants: 2 options, relabelled, empty stem with a picture, answers by two options', () => {
  for (const [name, legacy, optionCount] of [
    ['2-option MCQ', RAJAH_IDS.twoOptions, 2],
    ['relabelled MCQ (labels a) a) x blank are re-assigned A-D)', RAJAH_IDS.badLabels, 4],
  ] as const) {
    it(`${name}: opens, edits in the Studio form, tags, goes to review and is approved`, async () => {
      const id = q(legacy)
      const d0 = await get(id)
      expect(d0.parts[0].options).toHaveLength(optionCount)
      expect(d0.parts[0].options.map((o: Wire) => o.label)).toEqual('ABCD'.slice(0, optionCount).split(''))
      expect(studioForm(d0).unsupported).toEqual([])
      await put(id, editAsDraftBody(d0))
      const d1 = await get(id)
      await put(id, saveBody(d1, { explanation: 'Penjelasan ditambah di Studio.' }))
      await tagThroughStudio(id)
      expect(await gate(id)).toEqual([])
      await move(id, 'review')
      await move(id, 'approved')
      expect((await get(id)).parts[0].options).toHaveLength(optionCount)
      expect(await latestStatus(id)).toBe('approved')
    })
  }

  it('a 2-option question made from scratch is stored with the same shape and accepted by the same endpoint', async () => {
    const fresh = await get(await scratch.mcq(['Betul', 'Salah'], 'A'))
    const migrated = await get(q(RAJAH_IDS.twoOptions))
    expect(shapeDiff(migrated.parts, fresh.parts)).toEqual({ onlyA: [], onlyB: [] })
  })

  it('two correct options (mcq_multi): the server opens, edits, tags and approves it; the stored shape equals a V3-made mcq_multi (the form shows it read-only, as for any V3 mcq_multi)', async () => {
    const id = q(RAJAH_IDS.multi)
    const d0 = await get(id)
    expect(d0.parts[0].key).toEqual({ kind: 'options', correctOptionIds: ['A', 'C'] })
    expect(studioForm(d0).unsupported.length, 'Studio form limitation: the editor holds only single-answer MCQ').toBeGreaterThan(0)
    // The V3-native twin, made through the same API.
    const native = await admin.post('/api/questions', {
      subjectId: cur.subject, educationLevelId: cur.level, difficultyLevel: 3, questionType: 'essay', questionText: 'Pilih dua jawapan yang betul daripada senarai.',
      parts: [{ label: 'a', prompt: { ms: 'Pilih dua jawapan.' }, marks: 1, mode: 'mcq', modeConfig: { multi: true }, options: ['P', 'Q', 'R', 'S'].map((o, i) => ({ label: 'ABCD'.charAt(i), body: { ms: o } })), key: { kind: 'options', correctOptionIds: ['A', 'C'] } }],
      tag: { unitId: null, spIds: [], tp: null },
    })
    expect(native.status, said(native)).toBe(201)
    const twin = await get(native.body.data.id)
    expect(shapeDiff(d0.parts, twin.parts)).toEqual({ onlyA: [], onlyB: [] })
    const storedType = (qid: string) => one(`select type as id from question_versions where question_id = $1::bigint order by version_no desc limit 1`, [qid])
    expect([await storedType(id), await storedType(native.body.data.id)]).toEqual(['mcq_multi', 'mcq_multi'])
    // edit as draft + tag + review + approve over the API (what the form cannot do)
    await put(id, editAsDraftBody(d0))
    await tagThroughStudio(id)
    expect(await gate(id)).toEqual([])
    await move(id, 'review')
    await move(id, 'approved')
    expect((await get(id)).parts[0].key).toEqual({ kind: 'options', correctOptionIds: ['A', 'C'] })
  })
})

describe('archived, draft and rejected V2 questions', () => {
  it('archived: opens, an edit writes version 2 as a draft (the archived version stays as it was), tag, review, approve (revived)', async () => {
    const id = q(RAJAH_IDS.archived)
    const d0 = await get(id)
    expect(d0.status).toBe('archived')
    expect(studioForm(d0).unsupported).toEqual([])
    await put(id, saveBody(d0, { questionText: `${String(d0.questionText)} (disunting)` }))
    expect(await versions(id)).toEqual([{ version_no: 1, status: 'archived' }, { version_no: 2, status: 'draft' }])
    await tagThroughStudio(id)
    expect(await gate(id)).toEqual([])
    await move(id, 'review')
    await move(id, 'approved')
    expect(await versions(id)).toEqual([{ version_no: 1, status: 'archived' }, { version_no: 2, status: 'approved' }])
    expect((await rows<{ live: number | null }>(`select live_version_no as live from questions where id = $1::bigint`, [id]))[0]?.live).toBe(2)
  })

  it('draft: opens, edits in place, tag, review, approve', async () => {
    const id = q(RAJAH_IDS.draft)
    const d0 = await get(id)
    expect(d0.status).toBe('draft')
    await put(id, saveBody(d0, { questionText: `${String(d0.questionText)} (disunting)` }))
    expect(await versions(id)).toEqual([{ version_no: 1, status: 'draft' }]) // rewritten in place
    await tagThroughStudio(id)
    expect(await gate(id)).toEqual([])
    await move(id, 'review')
    await move(id, 'approved')
    expect(await latestStatus(id)).toBe('approved')
  })

  it('rejected (ditolak -> draft with the reason): the reason is read, the question edited and sent for review again', async () => {
    const id = q(RAJAH_IDS.rejected)
    const d0 = await get(id)
    expect(d0).toMatchObject({ status: 'draft', rejectionReason: 'Ditolak di V2.' })
    await tagThroughStudio(id)
    await move(id, 'review')
    expect(await latestStatus(id)).toBe('review')
    await move(id, 'draft')
  })

  it('empty stem with a picture (109010): the picture is the stem image; the Studio sees it, and the stem gate is the one a new picture question meets', async () => {
    const id = q(RAJAH_IDS.emptyStem)
    const d0 = await get(id)
    expect(d0.questionText).toBe('')
    expect(d0.questionImage, 'the stem picture is readable in the Studio field').toMatch(/^[A-Za-z0-9_-]{8,}$/)
    expect(studioForm(d0).unsupported).toEqual([])
    // A save of the form as it stands is accepted (a V2 import must not become unsaveable), and the stem the admin types is kept.
    await put(id, editAsDraftBody({ ...d0 }))
    const d1 = await get(id)
    await put(id, saveBody(d1, { questionText: 'Berdasarkan gambar rajah, nyatakan nama bentuk itu.' }))
    await tagThroughStudio(id)
    expect(await gate(id)).toEqual([])
    await move(id, 'review')
    await move(id, 'approved')
    expect((await get(id)).questionImage).toBe(d0.questionImage)
  })
})

describe('stimulus groups: rajah and passage groups, the shared rajah, Regroup', () => {
  const group = async (legacy: number): Promise<Wire> => {
    const gid = await one(`select group_id::text as id from questions where id = $1::bigint`, [q(legacy)])
    const r = await admin.get(`/api/stimulus-groups/${gid}`)
    expect(r.status, said(r)).toBe(200)
    return r.body.data as Wire
  }

  it('a migrated rajah group opens in the group editor like a V3 group: stimulus with picture, members in order, the member reads group + rajah', async () => {
    const g = await group(101002)
    expect(g.stimuli).toHaveLength(1)
    expect(g.stimuli[0]).toMatchObject({ kind: 'diagram', label: 'Rajah 1' })
    expect(g.stimuli[0].imageId).toMatch(/^[A-Za-z0-9_-]{8,}$/)
    expect(g.questionIds).toEqual([q(101002), q(101003)])
    const m = await get(q(101003))
    expect(m.stimulusGroup.id).toBe(g.id)
    expect(m.stimulusGroup.stimuli[0].imageId).toBe(g.stimuli[0].imageId)
    // a V3 group has the same keys on the wire
    const fresh = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan V3', body: { ms: 'Teks.' } })
    expect(fresh.status, said(fresh)).toBe(201)
    const fg = await admin.post('/api/stimulus-groups', { stimulusIds: [fresh.body.data.id], questionIds: [] })
    expect(fg.status, said(fg)).toBe(201)
    const detail = (await admin.get(`/api/stimulus-groups/${fg.body.data.id}`)).body.data as Wire
    expect(Object.keys(g).sort()).toEqual(Object.keys(detail).sort())
  })

  it('rajah group, approved in V2: each member is edited (Edit sebagai draf), tagged, the whole group goes to review and is published as ONE unit', async () => {
    const members = [q(101002), q(101003)]
    for (const id of members) {
      const d0 = await get(id)
      expect(d0.status).toBe('approved')
      const edited = await put(id, editAsDraftBody(d0)) // a served member of a group may be edited as a draft
      expect(edited.data.status).toBe('draft')
      await tagThroughStudio(id)
    }
    // the group is one unit: a single member alone is refused (stimulus_group_split), then the whole group goes
    const split = await admin.post('/api/questions/bulk-action', { action: 'review', ids: [members[0]] })
    expect(split.status, said(split)).toBe(422)
    expect(split.body.error.details.reason).toBe('stimulus_group_split')
    const gid = (await group(101002)).id as string
    const rv = await admin.post('/api/questions/bulk-action', { action: 'review', groupId: gid })
    expect(rv.status, said(rv)).toBe(200)
    expect(rv.body.data).toMatchObject({ affected: 2, failed: [] })
    const pub = await admin.post(`/api/stimulus-groups/${gid}/publish`)
    expect(pub.status, said(pub)).toBe(200)
    for (const id of members) expect(await latestStatus(id)).toBe('approved')
    // still one group, one rajah, in order
    const after = await group(101002)
    expect(after.questionIds).toEqual(members)
    expect(after.stimuli).toHaveLength(1)
  })

  it('passage group: the Sunting kumpulan copy flow (draft copy, member edits, Semakan, publish = swap) works on a migrated group', async () => {
    const members = [q(103002), q(103003)]
    const gid = (await group(103002)).id as string
    const copy = await admin.post(`/api/stimulus-groups/${gid}/edit-as-draft`)
    expect(copy.status, said(copy)).toBe(201)
    const copyId = copy.body.data.id as string
    for (const id of members) {
      await put(id, editAsDraftBody(await get(id)))
      await tagThroughStudio(id)
    }
    const rv = await admin.post('/api/questions/bulk-action', { action: 'review', ids: members })
    // The two members sit in the live group, so the list is that whole group: it moves as a unit.
    expect(rv.status, said(rv)).toBe(200)
    const pub = await admin.post(`/api/stimulus-groups/${copyId}/publish`)
    expect(pub.status, said(pub)).toBe(200)
    for (const id of members) expect(await latestStatus(id)).toBe('approved')
    expect((await group(103002)).questionIds).toEqual(members)
  })

  it('the archived group on the SAME rajah (106002): opens, edit + tag + review + approve; the approved group beside it is not disturbed', async () => {
    const arch = q(106002)
    const approvedBefore = (await group(106001)).questionIds
    const d0 = await get(arch)
    expect(d0.status).toBe('archived')
    await put(arch, saveBody(d0, { questionText: `${String(d0.questionText)} (disunting)` }))
    await tagThroughStudio(arch)
    await move(arch, 'review')
    await move(arch, 'approved')
    expect(await latestStatus(arch)).toBe('approved')
    expect((await group(106001)).questionIds).toEqual(approvedBefore)
    expect((await group(106002)).stimuli[0].id).toBe((await group(106001)).stimuli[0].id) // still the one stimulus row
  })

  it('Regroup: an unresolved follower (names Rajah 3, no rajah) is on the work-list, is refused at Terbitkan, and is fixed by attaching a carrier stimulus (the Regroup stimulusId path)', async () => {
    const id = q(RAJAH_IDS.unresolved)
    const list = await admin.get('/api/admin/questions/regroup-worklist?pageSize=100')
    expect(list.status, said(list)).toBe(200)
    expect((list.body.data as Wire[]).map((r) => r.questionId)).toContain(id)
    await put(id, editAsDraftBody(await get(id)))
    await tagThroughStudio(id)
    const issues = await gate(id)
    expect(issues.map((i) => i.path)).toContain('stimulusMissing')
    const stim = await one(`select m.new_id as id from etl_id_map m where m.entity = 'question_stimuli' and m.legacy_id = 'c:110003'`)
    const rg = await admin.post('/api/admin/questions/regroup', { stimulusId: stim, memberQuestionIds: [id], label: 'Rajah 3' })
    expect(rg.status, said(rg)).toBe(200)
    expect((await gate(id)).map((i) => i.path)).not.toContain('stimulusMissing')
    await move(id, 'review')
    await move(id, 'approved')
    expect((await get(id)).stimulusGroup.stimuli[0].id).toBe(stim)
  })
})

describe('structured and subjective (essay) questions', () => {
  it('structured, approved in V2: the Skema & Rubrik panel reads and saves it; the tags save over the API; it is approved again', async () => {
    const id = structuredIds['1'] as string
    const detail = await admin.get(`/api/structured-questions/${id}`)
    expect(detail.status, said(detail)).toBe(200)
    const rb = (await admin.get(`/api/structured-questions/${id}/rubric`)).body.data as Wire
    expect(rb.subs.every((s: Wire) => s.editable)).toBe(true) // every leaf is a points leaf the panel edits
    // The panel saves exactly what it read, with a changed scheme (a rubric point text may be at most 200 characters in the panel).
    const subs = (rb.subs as Wire[]).map((s) => ({ id: s.id, scheme: `${String(s.scheme ?? '')} (disunting)`.trim(), points: (s.points as Wire[]).map((p) => ({ text: p.text, marks: p.marks })) }))
    const saved = await admin.put(`/api/structured-questions/${id}/rubric`, { subs })
    expect(saved.status, said(saved)).toBe(200)
    // The question is no longer the live version: the edit is version 2 as a draft.
    expect((await versions(id)).map((v) => v.status)).toEqual(['approved', 'draft'])
    await tagThroughStudio(id)
    expect(await gate(id)).toEqual([])
    await move(id, 'review')
    await move(id, 'approved')
    expect(await latestStatus(id)).toBe('approved')
  })

  it('structured archived / draft / menunggu (review) open and move through the lifecycle with their tags', async () => {
    for (const key of ['2', '3', '4'] as const) {
      const id = structuredIds[key] as string
      const d0 = await get(id)
      expect(['archived', 'draft', 'review']).toContain(d0.status)
      const rb = await admin.get(`/api/structured-questions/${id}/rubric`)
      expect(rb.status, said(rb)).toBe(200)
      if (d0.status === 'review') await move(id, 'draft')
      await tagThroughStudio(id)
      expect(await gate(id), `structured ${key}`).toEqual([])
      await move(id, 'review')
      await move(id, 'approved')
    }
  })

  it('subjective (essay, V2 archived): opens, is edited and tagged over the API, and is approved; the one without a model answer carries the placeholder', async () => {
    for (const legacy of [901, 902]) {
      const id = q(legacy)
      const d0 = await get(id)
      expect(d0).toMatchObject({ status: 'archived' })
      await put(id, editAsDraftBody(d0))
      await tagThroughStudio(id)
      const left = await gate(id)
      expect(left, `essay ${legacy}`).toEqual([])
      await move(id, 'review')
      await move(id, 'approved')
    }
  })

  it('a migrated structured question has the same part-tree shape as one made through the Studio API (points keys, labels, marks)', async () => {
    const native = await admin.post('/api/questions', {
      subjectId: cur.subject, educationLevelId: cur.level, difficultyLevel: 3, questionType: 'essay', questionText: 'Soalan struktur buatan Studio tentang pencemaran.',
      parts: [
        { label: '(a)', prompt: { ms: 'Namakan satu bahan.' }, marks: 1, mode: 'essay', key: { kind: 'points', marks: 1, modelText: 'Skema.', points: [{ id: 'p1', code: 'P', label: 'Skema', text: { ms: 'Skema' }, marks: 1 }] } },
      ],
      tag: { unitId: null, spIds: [], tp: null },
    })
    expect(native.status, said(native)).toBe(201)
    const twin = await get(native.body.data.id)
    const migrated = await get(structuredIds['3'] as string)
    const diff = shapeDiff(migrated.parts, twin.parts)
    expect(diff.onlyA, 'fields the migrated structured question has that a V3-made one does not').toEqual([])
  })
})

describe('what the pupil gets: a Latih Tubi session over the Studio-approved migrated questions', () => {
  it('serves the migrated MCQ and BOTH members of the rajah group, each with the SAME rajah picture, in order; the picture is readable by the pupil', async () => {
    const res = await pupil.post('/api/practice/sessions', { mode: 'latih_tubi', subjectCode: 'MATH', count: 40 })
    expect(res.status, said(res)).toBe(201)
    type Served = { id: string; stimuli?: { kind: string; image?: { url: string } }[]; group?: { id: string; index: number; size: number } | null }
    const qs = res.body.data.questions as Served[]
    const ids = qs.map((x) => x.id)
    expect(ids).toContain(q(101009))
    for (const m of [q(101002), q(101003)]) expect(ids, `member ${m}`).toContain(m)
    const a = qs.find((x) => x.id === q(101002)) as Served
    const b = qs.find((x) => x.id === q(101003)) as Served
    expect(a.stimuli?.[0]?.image?.url).toMatch(/^\/api\/files\//)
    expect(b.stimuli?.[0]?.image?.url).toBe(a.stimuli?.[0]?.image?.url)
    expect(a.group?.index).toBeLessThan(b.group?.index as number)
    expect(ids.indexOf(q(101003)) - ids.indexOf(q(101002))).toBe(1) // contiguous
    const file = await pupil.get(String(a.stimuli?.[0]?.image?.url))
    expect(file.status).toBe(200)
    // the key never leaks to the pupil
    expect(JSON.stringify(res.body)).not.toMatch(/"correct(Option)?(Id|s)?"|"key"/)
  })

  it('the passage group (a stimulus of text, no picture) is served whole too', async () => {
    const res = await pupil.post('/api/practice/sessions', { mode: 'latih_tubi', subjectCode: 'MATH', count: 40 })
    expect(res.status, said(res)).toBe(201)
    const qs = res.body.data.questions as { id: string; stimuli?: unknown[] }[]
    for (const m of [q(103002), q(103003)]) expect(qs.find((x) => x.id === m)?.stimuli?.length, `member ${m}`).toBeGreaterThan(0)
  })
})

describe('stimulus data shape (database level)', () => {
  it('a migrated group and stimulus fill no column that a Studio-made group and stimulus leave empty', async () => {
    const cols = async (table: string, where: string, id: string): Promise<string[]> => {
      const r = (await rows<Record<string, unknown>>(`select * from ${table} where ${where} = $1::bigint order by 1 limit 1`, [id]))[0] ?? {}
      return Object.entries(r).filter(([, v]) => v !== null).map(([k]) => k).sort()
    }
    const stim = await admin.post('/api/stimuli', { kind: 'passage', label: 'Petikan buatan Studio', body: { ms: 'Teks petikan.' } })
    expect(stim.status, said(stim)).toBe(201)
    const g = await admin.post('/api/stimulus-groups', { stimulusIds: [stim.body.data.id], questionIds: [await scratch.mcq()] })
    expect(g.status, said(g)).toBe(201)
    const migratedGroup = await one(`select group_id::text as id from questions where id = $1::bigint`, [q(103003)])
    const migratedStimulus = await one(`select stimulus_id::text as id from stimulus_group_stimuli where group_id = $1::bigint limit 1`, [migratedGroup])
    const only = async (table: string, where: string, mine: string, theirs: string) => {
      const [a, b] = [await cols(table, where, mine), await cols(table, where, theirs)]
      expect(a.filter((c) => !b.includes(c)), `${table}: columns only the migrated row fills`).toEqual([])
    }
    await only('stimulus_groups', 'id', migratedGroup, g.body.data.id as string)
    await only('stimuli', 'id', migratedStimulus, stim.body.data.id as string)
    await only('stimulus_group_stimuli', 'group_id', migratedGroup, g.body.data.id as string)
    const member = await cols('questions', 'id', q(103003))
    expect(member).toEqual(expect.arrayContaining(['group_id', 'group_position']))
  })
})

describe('the data shape after the Studio touched a migrated question is the one a new question has (database level)', () => {
  const nonNullColumns = async (table: string, key: string, id: string): Promise<string[]> => {
    const r = (await rows<Record<string, unknown>>(`select * from ${table} where ${key} = $1::bigint order by 1 limit 1`, [id]))[0] ?? {}
    return Object.entries(r).filter(([, v]) => v !== null).map(([k]) => k).sort()
  }
  // Provenance columns of the migration or of any import: allowed on a migrated row.
  // (rights_status is the provenance declaration the intake batch makes, carried over on every edit, never a Studio field for any question.)
  const PROVENANCE = new Set(['legacy_source', 'legacy_id', 'import_issues', 'contributor_id', 'rights_status'])

  it('question_versions, question_parts, part_options and answer_keys: a migrated row uses no column that a Studio-made row does not', async () => {
    // An untouched migrated approved MCQ (version 1 as the loader wrote it) against a Studio-made one taken to the same state.
    const mine = q(102009)
    const fresh = await scratch.mcq(['Satu', 'Dua', 'Tiga', 'Empat'], 'A')
    await tagThroughStudio(fresh)
    await move(fresh, 'review')
    await move(fresh, 'approved')
    const partOf = (id: string) =>
      one(`select p.id::text as id from question_parts p join question_versions v on v.id = p.question_version_id where v.question_id = $1::bigint order by v.version_no desc, p.position limit 1`, [id])
    const same = async (table: string, key: string, a: string, b: string, skip = new Set<string>()) => {
      const [cm, cf] = [await nonNullColumns(table, key, a), await nonNullColumns(table, key, b)]
      expect(cm.filter((c) => !cf.includes(c) && !skip.has(c)), `${table}: columns only the migrated question fills`).toEqual([])
    }
    await same('question_versions', 'question_id', mine, fresh, PROVENANCE)
    await same('question_parts', 'id', await partOf(mine), await partOf(fresh))
    await same('part_options', 'part_id', await partOf(mine), await partOf(fresh))
    await same('answer_keys', 'part_id', await partOf(mine), await partOf(fresh))
    await same('questions', 'id', mine, fresh, PROVENANCE) // the only extra on `questions` is the legacy pair
  })
})
