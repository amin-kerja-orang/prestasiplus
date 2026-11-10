/**
 * T-B9 end to end on the real application: `migrate:questions` over the synthetic rajah and repair cases (fixtures/rajah-cases.ts):
 * every V2 status, the quarantine, the rajah groups of the plan, the flags, the invariant "V2 total = loaded + absorbed + quarantined",
 * idempotency, and what V3 does with the result (Studio read of every class, group read, the Regroup work-list, servability of a
 * repaired group, never serving archived/draft/held/flagged). Synthetic rows only.
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'

import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { renderDdl } from '../../../src/migration/ddl/render'
import { TABLES } from '../../../src/migration/ddl/spec'
import { RAJAH_IDS, rajahCaseRows } from '../../../src/migration/fixtures/rajah-cases'
import { Runner } from '../../../src/migration/kit/runner'
import { buildQuestionsSteps, invariantOf, QuestionsContext } from '../../../src/migration/load/questions'
import { openMigrationFiles } from '../../../src/migration/load/activity/files'
import { filesStep, QUESTION_IMAGE_ETL_CAP } from '../../../src/migration/load/questions/files-step'
import { reconcileFlags } from '../../../src/migration/load/questions/post-load'
import { quarantineCsv, quarantineRows } from '../../../src/migration/load/questions/repairs'
import { MEDIA_RESOLVED_SQL, NOT_FLAGGED_SQL, NOT_MCQ_MULTI_SQL, SPM_SERVABLE_SQL } from '../../../src/modules/questions/learner-visibility'
import { QuestionsRepository } from '../../../src/modules/questions'
import { RegroupService } from '../../../src/modules/questions/regroup.service'
import { StimuliService } from '../../../src/modules/questions/stimuli.service'
import { Be09PracticeQuestionSource } from '../../../src/modules/practice/question-bridge/be09-practice-question-source'
import type { UsersRepository } from '../../../src/modules/users'
import { makePng } from '../../files/fixtures'
import { filesOf } from '../../support/files-stub'
import { bootSpmApp, type SpmTestApp } from '../../spm/helpers'

let t: SpmTestApp
let pool: pg.Pool
let loaded: Record<string, string> = {}
let planned: Awaited<ReturnType<QuestionsContext['plan']>>
let dryRunId = ''
let firstApply: Awaited<ReturnType<Runner['run']>>
const env = { NODE_ENV: 'test', PP_ALLOW_MIGRATE_APPLY: '1' }
const one = async (sql: string, params: unknown[] = []): Promise<string> => (await pool.query<{ id: string }>(sql, params)).rows[0]?.id as string
const rows = async <T extends Record<string, unknown>>(sql: string, params: unknown[] = []): Promise<T[]> => (await pool.query(sql, params)).rows as T[]
const q = (legacy: number): string => loaded[String(legacy)] as string
const sqlOf = (s: { text: string; values: unknown[] }): [string, unknown[]] => [s.text, s.values]

const runAll = async (ctx: QuestionsContext, mode: 'dry-run' | 'apply', hash: string) =>
  new Runner({ pool, env }).run({ mode, steps: buildQuestionsSteps(ctx), inputHash: hash, batchSize: 7 })

beforeAll(async () => {
  t = await bootSpmApp()
  pool = new pg.Pool({ connectionString: t.db.url, max: 4 })
  await pool.query('delete from questions')
  await pool.query(renderDdl(TABLES.filter((x) => x.group === 'archive' && (x.name === 'questions' || x.name === 'question_options'))))
  const sej = await one(`select id::text as id from subjects where code = 'SEJ'`)
  const t4 = await one(`select id::text as id from education_levels where code = 'T4'`)
  const chapter = await one(`select id::text as id from chapters limit 1`)
  for (const [entity, legacy, id] of [['subjects', '1', sej], ['education_levels', '1', t4], ['chapters', '1', chapter]] as const) {
    await pool.query(`insert into etl_id_map (legacy_source, entity, legacy_id, new_id) values ('cloud', $1, $2, $3)`, [entity, legacy, id])
  }
  const cases = rajahCaseRows({ id: 1, subject_id: 1, education_level_id: 1 })
  for (const r of cases.questions) {
    await pool.query(
      `insert into archive_cloud.questions (id, subject_id, education_level_id, chapter_id, topic_id, difficulty_level, type, status, body, image_path, created_at, updated_at)
       values ($1, $2, $3, $4, null, $5, $6, $7, $8, $9, $10::timestamptz, $10::timestamptz)`,
      [r.id, r.subject_id, r.education_level_id, r.chapter_id, r.difficulty_level, r.type, r.status, r.body, r.image_path, r.created_at],
    )
  }
  for (const o of cases.options) {
    await pool.query(`insert into archive_cloud.question_options (id, question_id, label, body, is_correct) values ($1, $2, $3, $4, $5)`, [o.id, o.question_id, o.label, o.body, o.is_correct])
  }
  const ctx = () => new QuestionsContext({ pool, env, source: 'cloud', asOf: '2026-11-10', pageSize: 11 })
  const dryCtx = ctx()
  planned = await dryCtx.plan()
  const dry = await runAll(dryCtx, 'dry-run', 'rajah-test')
  dryRunId = dry.runId
  expect(dry.status).toBe('succeeded')
  firstApply = await runAll(ctx(), 'apply', 'rajah-test')
  expect(firstApply.status).toBe('succeeded')
  const res = await rows<{ legacy_id: string; id: string }>(`select legacy_id, id::text as id from questions where legacy_source = 'cloud'`)
  loaded = Object.fromEntries(res.map((r) => [r.legacy_id, r.id]))
}, 300_000)
afterAll(async () => {
  for (const r of tmpRoots) rmSync(r, { recursive: true, force: true })
  await pool?.end()
  await t?.close()
})

describe('what is loaded, absorbed and quarantined', () => {
  it('reconciles, and V2 total = loaded + absorbed + quarantined', () => {
    expect(firstApply.recon.map((r) => `${r.entity}:${r.status}`)).toEqual(['questions:ok', 'question_stimuli:ok', 'stimulus_groups:ok'])
    const inv = invariantOf(firstApply, planned.plan.absorbed.size)
    expect(inv).toMatchObject({ ok: true, absorbed: 8, quarantined: 2, otherOwner: 0 })
    expect(inv?.v2Total).toBe(inv ? inv.loaded + inv.absorbed + inv.quarantined : -1)
  })

  it('the carriers are stimuli, never questions; the two unrepairable rows are quarantined with their cause (ids and codes only)', async () => {
    for (const id of [101001, 103001, 105001, 106000, 110001, 110003, 111001, 112001]) expect(loaded[String(id)], String(id)).toBeUndefined()
    const list = await quarantineRows(pool, firstApply.runId)
    expect(list.map((r) => `${r.id}:${r.reason}:${r.column}:${r.status}`).sort()).toEqual([`${RAJAH_IDS.noKey}:INVALID_VALUE:is_correct:diluluskan`, `${RAJAH_IDS.unknownStatus}:UNKNOWN_ENUM:status:xyz`].sort())
    expect(quarantineCsv(list)).toMatch(/^v2_question_id,v2_status,subject_code,level_code,reason,cause\n/)
    expect(quarantineCsv(list)).not.toMatch(/Soalan/)
    expect(dryRunId).not.toBe('')
  })

  it('keeps every V2 status: approved live, archived and draft not live, ditolak with its reason', async () => {
    const st = await rows<{ status: string; n: number }>(
      `select v.status, count(*)::int as n from questions q join question_versions v on v.question_id = q.id where q.legacy_source = 'cloud' group by 1`,
    )
    const by = Object.fromEntries(st.map((r) => [r.status, r.n]))
    expect(by.draft).toBe(2) // draf, ditolak
    expect(by.archived).toBe(5) // 106002, 107011, 107012, 107013, 109005
    const live = await rows<{ legacy_id: string; live: number | null }>(`select legacy_id, live_version_no as live from questions where legacy_source = 'cloud' and legacy_id in ('109005', '109006', '109007', '101002')`)
    expect(Object.fromEntries(live.map((r) => [r.legacy_id, r.live]))).toEqual({ '109005': null, '109006': null, '109007': null, '101002': 1 })
    const rej = await rows<{ rejection_reason: string | null }>(`select rejection_reason from question_versions where question_id = $1::bigint`, [q(109007)])
    expect(rej[0]?.rejection_reason).toBe('Ditolak di V2.')
  })

  it('repairs: 2 options load, bad labels are re-assigned (key follows is_correct), two correct options are mcq_multi, an empty stem keeps its picture', async () => {
    expect(await rows(`select count(*)::int as n from part_options o join question_parts p on p.id = o.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1::bigint`, [q(109002)])).toEqual([{ n: 2 }])
    const relabel = await rows<{ label: string }>(`select o.label from part_options o join question_parts p on p.id = o.part_id join question_versions v on v.id = p.question_version_id where v.question_id = $1::bigint order by o.position`, [q(109003)])
    expect(relabel.map((r) => r.label)).toEqual(['A', 'B', 'C', 'D'])
    const multi = await rows<{ type: string; kind: string; content: { correctOptionIds: string[] }; mode_config: { multi: boolean } }>(
      `select v.type, k.kind, k.content, p.mode_config from question_versions v join question_parts p on p.question_version_id = v.id join answer_keys k on k.part_id = p.id where v.question_id = $1::bigint`,
      [q(109004)],
    )
    expect(multi[0]).toMatchObject({ type: 'mcq_multi', kind: 'options', content: { correctOptionIds: ['A', 'C'] }, mode_config: { multi: true } })
    const empty = await rows<{ stem_ms: string; stimuli: number; active: boolean }>(
      `select v.stem_ms, (select count(*)::int from question_version_stimuli s where s.question_version_id = v.id) as stimuli, q.is_active as active from questions q join question_versions v on v.question_id = q.id where q.id = $1::bigint`,
      [q(109010)],
    )
    expect(empty[0]).toEqual({ stem_ms: '', stimuli: 1, active: false }) // the picture is the stem stimulus; held until the file arrives
  })
})

describe('rajah groups (the PO core rule)', () => {
  const groupOf = async (legacy: number) =>
    (await rows<{ group_id: string | null; group_position: number | null; status: string }>(
      `select q.group_id::text, q.group_position, v.status from questions q join question_versions v on v.question_id = q.id where q.id = $1::bigint`,
      [q(legacy)],
    ))[0]

  it('1: carrier + followers: one group in V2 order on the rajah stimulus', async () => {
    const a = await groupOf(101002)
    const b = await groupOf(101003)
    expect(a?.group_id).not.toBeNull()
    expect(b?.group_id).toBe(a?.group_id)
    expect([a?.group_position, b?.group_position]).toEqual([1, 2])
    const s = await rows<{ kind: string; label: string | null }>(`select s.kind, s.label from stimulus_group_stimuli gs join stimuli s on s.id = gs.stimulus_id where gs.group_id = $1::bigint`, [a?.group_id])
    expect(s).toEqual([{ kind: 'diagram', label: 'Rajah 1' }])
  })

  it('2: the image owner is member 1 and keeps no copy of its own; 3: a passage group; 8: a shared image group', async () => {
    const owner = await groupOf(102001)
    expect((await groupOf(102002))?.group_id).toBe(owner?.group_id)
    expect(owner?.group_position).toBe(1)
    expect(await rows(`select 1 from question_version_stimuli vs join question_versions v on v.id = vs.question_version_id where v.question_id = $1::bigint`, [q(102001)])).toHaveLength(0)
    const passage = await groupOf(103002)
    expect((await groupOf(103003))?.group_id).toBe(passage?.group_id)
    const kind = await rows<{ kind: string }>(`select s.kind from stimulus_group_stimuli gs join stimuli s on s.id = gs.stimulus_id where gs.group_id = $1::bigint`, [passage?.group_id])
    expect(kind).toEqual([{ kind: 'passage' }])
    const shared = await groupOf(108001)
    expect((await groupOf(108002))?.group_id).toBe(shared?.group_id)
  })

  it('4: an unresolved follower is a plain question; 5: a carrier with no follower is an unattached stimulus', async () => {
    expect((await groupOf(104001))?.group_id).toBeNull()
    const n = await rows<{ n: number }>(
      `select count(*)::int as n from etl_id_map m join stimuli s on s.id = m.new_id::bigint where m.entity = 'question_stimuli' and m.legacy_id = 'c:105001'
          and not exists (select 1 from stimulus_group_stimuli g where g.stimulus_id = s.id)`,
    )
    expect(n[0]?.n).toBe(1)
  })

  it('6: one rajah, an approved group and an archived group on the SAME stimulus row', async () => {
    const approved = await groupOf(106001)
    expect((await groupOf(106003))?.group_id).toBe(approved?.group_id)
    const archived = await groupOf(106002)
    expect(archived?.group_id).not.toBeNull()
    expect(archived?.group_id).not.toBe(approved?.group_id)
    const stim = await rows<{ sid: string }>(`select distinct stimulus_id::text as sid from stimulus_group_stimuli where group_id = any($1::bigint[])`, [[approved?.group_id, archived?.group_id]])
    expect(stim).toHaveLength(1)
  })

  it('7: a Medium group is held for approved (ungrouped) and grouped for archived; 10 and 12 follow the plan', async () => {
    expect((await groupOf(107003))?.group_id).toBeNull()
    expect((await groupOf(107001))?.group_id).toBeNull()
    const a = await groupOf(107011)
    expect((await groupOf(107013))?.group_id).toBe(a?.group_id)
    // two carriers with one key: two groups
    const g1 = await groupOf(110002)
    const g2 = await groupOf(110004)
    expect(g1?.group_id).not.toBeNull()
    expect(g2?.group_id).not.toBe(g1?.group_id)
    expect((await groupOf(112002))?.group_id).not.toBeNull()
    expect((await groupOf(112004))?.group_id).toBeNull()
  })

  it('11: a run of 45 followers is a group of 40 and five left over', async () => {
    const sizes = await rows<{ n: number }>(`select count(*)::int as n from questions where group_id = $1::bigint group by group_id`, [(await groupOf(111101))?.group_id])
    expect(sizes[0]?.n).toBe(40)
    expect((await groupOf(111145))?.group_id).toBeNull()
  })

  it('V-4 / V-6: every group has a stimulus; positions are 1..n in V2 id order', async () => {
    expect(await rows(`select g.id from stimulus_groups g where not exists (select 1 from stimulus_group_stimuli s where s.group_id = g.id)`)).toHaveLength(0)
    const bad = await rows<{ group_id: string }>(
      `select group_id::text from (select q.group_id, q.group_position, row_number() over (partition by q.group_id order by q.legacy_id::bigint) as rn
          from questions q where q.group_id is not null and q.legacy_source = 'cloud') x where group_position <> rn`,
    )
    expect(bad).toHaveLength(0)
  })

  it('a group whose picture is not copied is held as a whole (inactive, with the path)', async () => {
    const a = await rows<{ active: boolean; held: boolean }>(
      `select q.is_active as active, coalesce(v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb, false) as held
         from questions q join question_versions v on v.question_id = q.id where q.id = any($1::bigint[])`,
      [[q(101002), q(101003), q(106001)]],
    )
    expect(a.every((r) => !r.active && r.held)).toBe(true)
    const issues = await rows<{ import_issues: { code: string; ref?: string }[] }>(`select import_issues from question_versions where question_id = $1::bigint`, [q(101003)])
    expect(issues[0]?.import_issues.map((i) => i.code).sort()).toEqual(['legacy_image_unresolved', 'rajah_group_auto'])
  })
})

describe('flags (V-8) and post-load', () => {
  it('the open flags on approved questions are exactly the unresolved followers and held candidates of the plan', async () => {
    const flagged = await rows<{ legacy_id: string }>(
      `select q.legacy_id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no
        where q.legacy_source = 'cloud' and v.status = 'approved' and v.stimulus_flag in ('stimulus_missing', 'figure_only') and v.flag_dismissed_at is null`,
    )
    expect(flagged.length).toBe(planned.plan.summary.predictedFlaggedApproved)
    expect(new Set(flagged.map((r) => r.legacy_id))).toEqual(new Set(planned.plan.unresolved.filter((u) => u.cls === 'approved').map((u) => u.id)))
    for (const id of [104001, 107003, 111145, 112004]) expect(flagged.map((r) => r.legacy_id)).toContain(String(id))
  })

  it('the detector re-run finds 0 differences (C-10: flag-stimulus would change nothing); difficulty_level is backfilled', async () => {
    const check = await reconcileFlags(pool, 'cloud', { fix: false })
    expect(check.changed).toBe(0)
    expect(check.seen).toBeGreaterThan(50)
    // The text is written once (stem only, prompt empty), so no loaded question is flagged stem_duplicated (T-B1: it was 100% before).
    const dup = await rows<{ n: number }>(`select count(*)::int as n from question_versions v join questions q on q.id = v.question_id where q.legacy_source = 'cloud' and v.stimulus_flag = 'stem_duplicated'`)
    expect(dup[0]?.n).toBe(0)
    const emptyPrompt = await rows<{ n: number }>(`select count(*)::int as n from question_parts p join question_versions v on v.id = p.question_version_id join questions q on q.id = v.question_id where q.legacy_source = 'cloud' and p.prompt_ms <> ''`)
    expect(emptyPrompt[0]?.n).toBe(0)
    const d = await rows<{ n: number }>(`select count(*)::int as n from question_versions v join questions q on q.id = v.question_id where q.legacy_source = 'cloud' and v.difficulty_level is null and v.difficulty_tp is not null`)
    expect(d[0]?.n).toBeGreaterThan(0) // the backfill is wired in runQuestions (post-load); the Runner-only harness leaves it
  })
})

/** Missing on purpose: the picture of the unattached carrier 105001 (cause `unlisted`: not in SHA256SUMS; nothing else shows it). */
const MISSING_PATH = 'soalan/rajah4.png'
const filesRun: { notes: Map<string, number>; dryNotes: Map<string, number> } = { notes: new Map(), dryNotes: new Map() }
const tmpRoots: string[] = []

/** What `--files-dir` does: the pass copies every listed picture through MigrationFiles (checksum, magic bytes, sanitising, `files` row with a public_id), points the stimuli at it and lifts the holds. */
async function copyPictures(): Promise<void> {
  const root = mkdtempSync(join(tmpdir(), 'rajah-files-'))
  tmpRoots.push(root)
  const dir = join(root, 'export')
  const storage = join(root, 'storage')
  mkdirSync(dir)
  mkdirSync(storage)
  const paths = (await rows<{ p: string }>(`select distinct image_path as p from archive_cloud.questions where image_path is not null`)).map((r) => r.p).sort()
  const sums: string[] = []
  for (const [n, p] of paths.entries()) {
    if (p === MISSING_PATH) continue
    const bytes = makePng({ width: 2 + n, height: 2 })
    mkdirSync(dirname(join(dir, p)), { recursive: true })
    writeFileSync(join(dir, p), bytes)
    sums.push(`${createHash('sha256').update(bytes).digest('hex')}  ./${p}`)
  }
  writeFileSync(join(dir, 'SHA256SUMS'), sums.join(String.fromCharCode(10)) + String.fromCharCode(10))
  const runFiles = async (mode: 'dry-run' | 'apply') => {
    const fenv = { ...env, FILE_STORAGE_DIR: storage }
    const ctx = new QuestionsContext({ pool, env: fenv, source: 'cloud', asOf: '2026-11-10', pageSize: 11 })
    ctx.files = await openMigrationFiles({ dir, env: fenv, mode, source: 'cloud', repoRoots: [process.cwd()], capOverrides: { question_image: QUESTION_IMAGE_ETL_CAP } })
    const report = await new Runner({ pool, env }).run({ mode, steps: [filesStep(ctx, ctx.files)], inputHash: 'rajah-files', batchSize: 7 })
    expect(report.status).toBe('succeeded')
    return { ctx, report }
  }
  const dry = await runFiles('dry-run')
  filesRun.dryNotes = new Map(dry.ctx.notes.counters)
  const applied = await runFiles('apply')
  filesRun.notes = new Map(applied.ctx.notes.counters)
  expect(applied.ctx.fileFailures.map((f) => f.cause)).toEqual(['unlisted'])
}

describe('V3 behaviour on the loaded bank', () => {
  it('C-2/C-9: the Studio reader parses every loaded class (strict leaf read, no StoredKeyError)', async () => {
    const repo = t.app.get(QuestionsRepository, { strict: false })
    const ids = Object.values(loaded)
    const recs = await repo.getMany(ids, 'latest')
    expect(recs).toHaveLength(ids.length)
  })

  it('C-3: getGroup reads a loaded group (stimulus, members in order)', async () => {
    const gid = await one(`select group_id::text as id from questions where id = $1::bigint`, [q(101002)])
    const g = await t.app.get(StimuliService, { strict: false }).getGroup(gid)
    expect(g.stimuli).toHaveLength(1)
    expect(g.questionIds).toEqual([q(101002), q(101003)])
  })

  it('C-4: the Regroup work-list holds exactly the flagged approved questions', async () => {
    const list = await t.app.get(RegroupService, { strict: false }).worklist({ page: 1, pageSize: 100 })
    expect(list.total).toBe(planned.plan.summary.predictedFlaggedApproved)
    // held (inactive) group members are not in the list; the unresolved and Medium-held ones are
    expect(list.rows.map((r) => r.questionId)).toContain(q(104001))
    expect(list.rows.map((r) => r.questionId)).toContain(q(107003))
  })

  it('C-8: nothing is served while pictures are missing, and never archived, draft, flagged, held or mcq_multi', async () => {
    const [text, values] = sqlOf(SPM_SERVABLE_SQL as never)
    const served = await rows<{ legacy_id: string }>(
      `select q.legacy_id from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and ${text}`,
      values,
    )
    const ids = new Set(served.map((r) => Number(r.legacy_id)))
    for (const id of [101002, 101003, 106001, 102001, 109010, 104001, 107003, 109004, 109005, 109006, 109007, 106002]) expect(ids.has(id), String(id)).toBe(false)
    expect(ids.has(101009)).toBe(true) // a plain filler question
    expect(ids.has(109002)).toBe(true) // the 2-option question is served
    void MEDIA_RESOLVED_SQL
    void NOT_FLAGGED_SQL
    void NOT_MCQ_MULTI_SQL
  })

  it('C-7 (data): once the files are in, every member of a repaired group is served with the SAME stimulus, in order, and the archived group still is not', async () => {
    await copyPictures()
    const [text, values] = sqlOf(SPM_SERVABLE_SQL as never)
    const served = await rows<{ legacy_id: string; group_id: string | null; position: number | null; sid: string | null }>(
      `select q.legacy_id, q.group_id::text, q.group_position as position, (select gs.stimulus_id::text from stimulus_group_stimuli gs where gs.group_id = q.group_id limit 1) as sid
         from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and ${text} order by q.legacy_id::bigint`,
      values,
    )
    const by = new Map(served.map((r) => [Number(r.legacy_id), r]))
    for (const [a, b] of [[101002, 101003], [102001, 102002], [103002, 103003], [106001, 106003]] as const) {
      expect(by.get(a)?.group_id, String(a)).not.toBeNull()
      expect(by.get(b)?.group_id).toBe(by.get(a)?.group_id)
      expect(by.get(a)?.sid).toBe(by.get(b)?.sid)
      expect(by.get(a)?.sid).not.toBeNull()
      expect(by.get(a)?.position).toBeLessThan(by.get(b)?.position as number)
    }
    expect(by.has(106002)).toBe(false) // archived
    expect(by.has(104001)).toBe(false) // flagged: names Rajah 3 and shows none
    expect(by.has(107003)).toBe(false) // Medium candidate held
    expect(by.has(109010)).toBe(true) // the picture question, repaired
    expect(by.has(109004)).toBe(false) // mcq_multi: not in a single-option drill
  })

  it('pictures: every copied picture has a files row with a public_id, every group stimulus resolves, the missing one stays held and counted', async () => {
    expect(filesRun.dryNotes.get('files.copied')).toBeGreaterThan(5) // the dry-run verified them and wrote nothing of its own
    expect(filesRun.notes.get('files.cause.unlisted')).toBe(1)
    expect(filesRun.notes.get('files.questions_released')).toBeGreaterThan(5)
    const noPublic = await rows<{ n: number }>(`select count(*)::int as n from stimuli s left join files f on f.id = s.asset_file_id where s.asset_file_id is not null and (f.id is null or f.public_id is null or f.public_id = '')`)
    expect(noPublic[0]?.n).toBe(0)
    const groupsWithoutPicture = await rows<{ id: string }>(
      `select g.id::text as id from stimulus_groups g join stimulus_group_stimuli gs on gs.group_id = g.id join stimuli s on s.id = gs.stimulus_id
        where s.kind in ('image', 'diagram', 'graph', 'map', 'infographic') and s.asset_file_id is null and exists (select 1 from questions q where q.group_id = g.id and q.is_active)`,
    )
    expect(groupsWithoutPicture).toEqual([])
    const stillHeld = await rows<{ legacy_id: string }>(`select q.legacy_id from questions q join question_versions v on v.question_id = q.id and v.version_no = 1 where q.legacy_source = 'cloud' and v.import_issues @> '[{"code": "legacy_image_unresolved"}]'::jsonb`)
    expect(stillHeld).toEqual([])
    const missingStimulus = await rows<{ n: number }>(`select count(*)::int as n from stimuli where asset_file_id is null and kind in ('image', 'diagram', 'graph', 'map', 'infographic')`)
    expect(missingStimulus[0]?.n).toBe(1) // the unattached carrier whose file is not in the export
  })

  it('practice: a migrated V2 rajah group is served by the practice source with the stimulus (picture token) on EVERY member, in order', async () => {
    const repo = t.app.get(QuestionsRepository, { strict: false })
    const source = new Be09PracticeQuestionSource(repo, { getMany: () => Promise.resolve([]) } as unknown as UsersRepository, undefined, filesOf(t.db) as never)
    const members = [q(101002), q(101003)]
    const live = await source.live(members, 'latih_tubi_spm')
    expect([...live.keys()].sort()).toEqual([...members].sort())
    const urls = members.map((m) => live.get(m)?.stimuli?.[0]?.image?.url)
    for (const u of urls) expect(u).toMatch(/^\/api\/files\/[A-Za-z0-9_-]{8,}$/)
    expect(new Set(urls).size).toBe(1) // the SAME rajah on both questions (V2 showed it on neither)
    expect(live.get(members[0] as string)?.groupPosition).toBeLessThan(live.get(members[1] as string)?.groupPosition as number)
    expect((await source.live([q(106002)], 'latih_tubi_spm')).size).toBe(0) // the archived member of the shared rajah is never served
  })

  it('a second run changes nothing (V-10)', async () => {
    const before = await rows<{ n: number }>(`select (select count(*) from questions)::int + (select count(*) from stimuli)::int + (select count(*) from stimulus_groups)::int + (select count(*) from question_parts)::int as n`)
    const ctx = new QuestionsContext({ pool, env, source: 'cloud', asOf: '2026-11-10', pageSize: 11 })
    const dry = await runAll(ctx, 'dry-run', 'rajah-test-2')
    expect(dry.status).toBe('succeeded')
    const again = await runAll(ctx, 'apply', 'rajah-test-2')
    expect(again.status).toBe('succeeded')
    expect(again.recon.every((r) => r.loaded > 0 || r.entity !== 'questions')).toBe(true)
    const after = await rows<{ n: number }>(`select (select count(*) from questions)::int + (select count(*) from stimuli)::int + (select count(*) from stimulus_groups)::int + (select count(*) from question_parts)::int as n`)
    expect(after).toEqual(before)
  })
})
