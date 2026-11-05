import { mkdtemp, readFile, readdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { QuestionSchema, mutationEnvelopeOf } from '@pp/contract'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from '../questions/helpers'
import { mcqBody, refsOf, tagOf, type Refs } from '../questions/http-helpers'
import { RegroupService } from '../../src/modules/questions/regroup.service'
import { buildReport, CELLS_SQL, EXCLUDED_SQL, NOT_FLAGGED_SQL, NOT_PKSK_SQL, NOT_PRIMARY_LEVEL_SQL, reportLines, run, SPEC, type CellRow } from '../../scripts/uat-ops/regroup-report'
import { parseUatArgs } from '../../scripts/uat-ops/lib'
import { NOT_FLAGGED_SQL as EXPORTED_NOT_FLAGGED, NOT_PKSK_SQL as EXPORTED_NOT_PKSK, NOT_PRIMARY_LEVEL_SQL as EXPORTED_NOT_PRIMARY } from '../../src/modules/questions/learner-visibility'

/** S4-T04 part 2 (U-OP-05 / U-OP-17): the regroup report. Pure parts first, then the real database against `RegroupService.worklist` (API-Q-13). */
const row = (over: Partial<CellRow>): CellRow => ({
  subject_id: '1',
  subject_code: 'MATEMATIK',
  level_id: '4',
  level_code: 'T4',
  stimulus_missing: 0,
  figure_only: 0,
  stem_duplicated: 0,
  dismissed_excluding: 0,
  ...over,
})

describe('regroup-report: predicates are the exported ones, not a second definition', () => {
  it('the inlined SQL text equals NOT_FLAGGED_SQL / NOT_PKSK_SQL / NOT_PRIMARY_LEVEL_SQL of learner-visibility.ts', () => {
    expect(NOT_FLAGGED_SQL).toBe(EXPORTED_NOT_FLAGGED.sql)
    expect(NOT_PKSK_SQL).toBe(EXPORTED_NOT_PKSK.sql)
    expect(NOT_PRIMARY_LEVEL_SQL).toBe(EXPORTED_NOT_PRIMARY.sql)
    expect(EXPORTED_NOT_FLAGGED.values).toEqual([])
  })

  it('the queries use them and contain no write statement', () => {
    expect(CELLS_SQL).toContain(NOT_PKSK_SQL)
    expect(CELLS_SQL).toContain(NOT_PRIMARY_LEVEL_SQL)
    expect(EXCLUDED_SQL).toContain(`NOT ${NOT_FLAGGED_SQL}`)
    for (const sql of [CELLS_SQL, EXCLUDED_SQL]) expect(sql).not.toMatch(/\b(insert|update|delete|truncate|alter|drop|create)\b/i)
  })
})

describe('regroup-report arguments', () => {
  it('is read-only: --apply is a usage error; --subject and --level are accepted', () => {
    expect(() => parseUatArgs(['--apply'], SPEC)).toThrow('regroup-report is read-only: there is no --apply')
    expect(parseUatArgs(['--dry-run', '--subject', 'matematik', '--level=T4'], SPEC).values).toEqual({ subject: 'matematik', level: 'T4' })
    expect(() => parseUatArgs(['--flag', 'x'], SPEC)).toThrow('unknown argument --flag')
  })
})

describe('buildReport / reportLines', () => {
  const rows = [row({ stimulus_missing: 3, figure_only: 2, stem_duplicated: 1, dismissed_excluding: 4 }), row({ subject_id: '2', subject_code: 'SAINS', level_id: '5', level_code: 'T5', figure_only: 1 })]
  const report = buildReport(rows)

  it('totals per flag; open = stimulus_missing + figure_only (the work-list `open`)', () => {
    expect(report.totals).toEqual({ byFlag: { stimulus_missing: 3, figure_only: 3, stem_duplicated: 1 }, open: 6, done: 4, cells: 2 })
  })

  it('prints one INFO line per cell, a total and a PASS cross-check; FAIL when the predicate disagrees; counts only', () => {
    const ok = reportLines(report, 6)
    expect(ok.map((l) => l.status)).toEqual(['INFO', 'INFO', 'INFO', 'PASS'])
    expect(ok[0]!.text).toBe('T4 MATEMATIK: stimulus_missing 3, figure_only 2, stem_duplicated 1, dismissed 4')
    expect(reportLines(report, 5).at(-1)!.status).toBe('FAIL')
    expect(JSON.stringify(report)).not.toMatch(/stem_ms|questionText|question_id/i)
  })

  it('reports SKIP when nothing is flagged', () => {
    expect(reportLines(buildReport([]), 0, { subject: 'XYZ' })[0]).toEqual({ status: 'SKIP', text: 'no open or dismissed flag for subject XYZ' })
  })
})

describe('regroup-report on a real database (parity with API-Q-13, read-only, exit codes)', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let service: RegroupService
  let root: string

  beforeAll(async () => {
    process.env.THROTTLE_QUESTIONS_WRITE_PER_MINUTE = '100000'
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    service = t.app.get(RegroupService)
    root = await mkdtemp(join(tmpdir(), 'pp-regroup-report-'))
    const sci = await tagOf(t.db, refs.sciId, refs.t4Id)
    const t5 = await tagOf(t.db, refs.mathId, refs.t5Id)
    await served('Rajah 41 menunjukkan satu mesin. Soalan satu.', 'stimulus_missing')
    await served('Rajah 42 menunjukkan satu mesin. Soalan dua.', 'stimulus_missing')
    await served('Rajah di atas menunjukkan satu mesin. Soalan tiga.', 'figure_only', { subjectId: refs.sciId, tag: sci })
    await served('Apakah hasil tambah dua nombor ganjil? Soalan empat.', 'stem_duplicated')
    await served('Apakah hasil tambah dua nombor genap? Soalan lima.', 'stem_duplicated', { educationLevelId: refs.t5Id, tag: t5 })
    const dismissed = await served('Rajah 43 menunjukkan satu mesin. Soalan enam.', 'stimulus_missing')
    await t.db.query(`update question_versions set flag_dismissed_at = now() where question_id = $1`, [dismissed])
    // A draft with a flag (never live) and an inactive question: neither belongs to the work-list.
    const draft = await served('Rajah 44 menunjukkan satu mesin. Soalan tujuh.', 'stimulus_missing')
    await t.db.query(`update question_versions set status = 'draft' where question_id = $1`, [draft])
    const inactive = await served('Rajah 45 menunjukkan satu mesin. Soalan lapan.', 'stimulus_missing')
    await t.db.query(`update questions set is_active = false where id = $1`, [inactive])

  })
  afterAll(async () => {
    await t.close()
    await rm(root, { recursive: true, force: true })
  })

  async function served(text: string, flag: string, over: Record<string, unknown> = {}): Promise<string> {
    const tag = (over.tag as Awaited<ReturnType<typeof tagOf>> | undefined) ?? (await tagOf(t.db, refs.mathId, refs.t4Id))
    const res = await admin.post('/api/questions', mcqBody(refs, { questionText: text, ...over, tag }))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    const id = mutationEnvelopeOf(QuestionSchema).parse(res.body).data.id
    await t.db.query(`update question_versions set status = 'approved', published_at = now(), paper_code = '1449/2', stimulus_flag = $2, stimulus_flag_at = now() where question_id = $1`, [id, flag])
    await t.db.query(`update questions set live_version_no = 1 where id = $1`, [id])
    return id
  }

  async function report(subject: string | null, level: string | null) {
    const c = new pg.Client({ connectionString: t.db.url })
    await c.connect()
    try {
      const rows = (await c.query<CellRow>(CELLS_SQL, [subject, level])).rows
      const excluded = (await c.query<{ n: number }>(EXCLUDED_SQL, [subject, level])).rows[0]!.n
      return { report: buildReport(rows), excluded }
    } finally {
      await c.end()
    }
  }

  it('[CI] parity: report totals equal RegroupService.worklist counts (byFlag, open, done, bySubject, byLevel)', async () => {
    const { report: r, excluded } = await report(null, null)
    const w = await service.worklist({ page: 1, pageSize: 1 })
    expect(r.totals.byFlag).toEqual(w.counts.byFlag)
    expect(r.totals.open).toBe(w.counts.open)
    expect(r.totals.done).toBe(w.counts.done)
    expect(excluded).toBe(w.total)
    expect(r.totals.byFlag.stimulus_missing).toBe(2)
    expect(r.totals.byFlag.figure_only).toBe(1)
    expect(r.totals.byFlag.stem_duplicated).toBe(2)
    expect(r.totals.done).toBe(1)
    const openBy = (key: 'subjectId' | 'levelId') => {
      const m: Record<string, number> = {}
      for (const c of r.cells) {
        const n = c.stimulus_missing + c.figure_only
        if (n > 0 && c[key] !== null) m[c[key]!] = (m[c[key]!] ?? 0) + n
      }
      return m
    }
    expect(openBy('subjectId')).toEqual(w.counts.bySubject)
    expect(openBy('levelId')).toEqual(w.counts.byLevel)
  })

  it('[CI] parity under the filters: subject and level code equal the work-list filtered by id', async () => {
    const sciCode = (await t.db.query<{ code: string }>(`select code from subjects where id = $1`, [refs.sciId]))[0]!.code
    const t4Code = (await t.db.query<{ code: string }>(`select code from education_levels where id = $1`, [refs.t4Id]))[0]!.code
    const bySubject = await report(sciCode, null)
    const w1 = await service.worklist({ subjectId: refs.sciId, page: 1, pageSize: 1 })
    expect(bySubject.report.totals.open).toBe(w1.counts.open)
    expect(bySubject.report.totals.byFlag).toEqual(w1.counts.byFlag)
    expect(bySubject.excluded).toBe(w1.total)
    const byLevel = await report(null, t4Code)
    const w2 = await service.worklist({ educationLevelId: refs.t4Id, page: 1, pageSize: 1 })
    expect(byLevel.report.totals.byFlag).toEqual(w2.counts.byFlag)
    expect(byLevel.report.totals.done).toBe(w2.counts.done)
  })

  it('[CI] read-only: the queries run in a read-only transaction and the data is unchanged after a run', async () => {
    const digest = async () => (await t.db.query<{ d: string }>(`select md5(string_agg(x::text, '|' order by x::text)) as d from (select * from question_versions) x`))[0]!.d
    const before = await digest()
    const lines: string[] = []
    const code = await run([], { DATABASE_URL: t.db.url }, (s) => lines.push(s), root)
    expect(code).toBe(0)
    expect(await digest()).toBe(before)
    expect(lines.some((l) => l.startsWith('PASS '))).toBe(true)
    // The same connection discipline the script uses refuses a write.
    const c = new pg.Client({ connectionString: t.db.url })
    await c.connect()
    try {
      await c.query('BEGIN READ ONLY')
      await expect(c.query(`update question_versions set stimulus_flag = null`)).rejects.toThrow(/read-only transaction/)
      await c.query('ROLLBACK')
    } finally {
      await c.end()
    }
  })

  it('[CI] writes .txt and .json under .evidence/uat-ops with counts and ids only (no question text, no connection string)', async () => {
    const files = await readdir(join(root, '.evidence', 'uat-ops'))
    expect(files.some((f) => /^regroup-report-.*\.txt$/.test(f))).toBe(true)
    const jsonName = files.find((f) => /^regroup-report-.*\.json$/.test(f))!
    const body = await readFile(join(root, '.evidence', 'uat-ops', jsonName), 'utf8')
    expect(JSON.parse(body).totals.byFlag).toEqual({ stimulus_missing: 2, figure_only: 1, stem_duplicated: 2 })
    expect(body).not.toMatch(/Rajah|Soalan|postgresql:/)
  })

  it('[CI] exit codes: 2 on --apply, a missing DATABASE_URL, an unknown argument; 0 on a run; no file written on a usage error', async () => {
    const quiet = () => undefined
    const err = console.error
    console.error = quiet
    try {
      const empty = await mkdtemp(join(tmpdir(), 'pp-regroup-report-empty-'))
      expect(await run(['--apply'], { DATABASE_URL: t.db.url }, quiet, empty)).toBe(2)
      expect(await run([], {}, quiet, empty)).toBe(2)
      expect(await run(['--bogus'], { DATABASE_URL: t.db.url }, quiet, empty)).toBe(2)
      await expect(readdir(join(empty, '.evidence'))).rejects.toThrow()
      expect(await run(['--subject', 'NOSUCH'], { DATABASE_URL: t.db.url }, quiet, empty)).toBe(0)
      await rm(empty, { recursive: true, force: true })
    } finally {
      console.error = err
    }
  })
})
