import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { main, parseArgs, UsageError } from '../../src/modules/curriculum/dskp/cli'
import { exitCodeOf, formatDskpReport, readDskpSources, runDskpLoad, type LoadReport } from '../../src/modules/curriculum/dskp/dskp-load'
import { parseDskpExtract } from '../../src/modules/curriculum/dskp/dskp-loader'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { count, dropDatabase } from './helpers'

const NOW = new Date('2026-10-30T10:00:00Z')

const sum = (r: LoadReport, pick: (l: LoadReport['subjects'][number]['levels'][number]) => number): number =>
  r.subjects.reduce((n, s) => n + s.levels.reduce((m, l) => m + pick(l), 0), 0)

/** A minimal extract in the shipped format. */
const fixture = (over: Record<string, unknown> = {}) => ({
  subject: 'Matematik',
  edition: 'Fixture edition',
  generalPerformanceLevels: { levels: [{ tp: 1, descriptor: 'General one' }] },
  units: [
    {
      level: 'T1',
      code: '1.0',
      title: 'Nombor Nisbah',
      bidang: 'NOMBOR DAN OPERASI',
      standards: [
        {
          sk: '1.1',
          skTitle: 'Integer',
          sp: [
            { code: '1.1.1', text: 'Mengenal integer' },
            { code: '1.1.2', text: 'Membandingkan integer' },
          ],
        },
      ],
      tahapPenguasaan: [
        { tp: 1, descriptor: 'T1 tp one' },
        { tp: 2, descriptor: 'T1 tp two' },
        { descriptor: 'row without a number' },
      ],
    },
    { level: 'D3', code: '1.0', title: 'Darjah row', standards: [] },
  ],
  ...over,
})

describe('DSKP loader script (R1-B04)', () => {
  let db: TestDatabase
  let dir: string
  beforeAll(async () => {
    db = await createTestDatabase()
    // Levels and subjects come from the base curriculum; the DSKP tree is emptied so the script starts from UAT's state.
    await runSeeds([curriculumSeed], { prisma: db.prisma })
    await db.query('delete from curriculum_tp_descriptors')
    await db.query('delete from curriculum_nodes')
    dir = mkdtempSync(join(tmpdir(), 'dskp-fixture-'))
  })
  afterAll(async () => {
    await dropDatabase(db)
    rmSync(dir, { recursive: true, force: true })
  })

  const nodesNow = () => count(db, 'select count(*) n from curriculum_nodes')
  const tpsNow = () => count(db, 'select count(*) n from curriculum_tp_descriptors')

  it('starts with 0 nodes (the UAT state)', async () => {
    expect(await nodesNow()).toBe(0)
    expect(await tpsNow()).toBe(0)
  })

  it('dry run: reports every row as new and writes nothing', async () => {
    const sources = readDskpSources()
    const expectedNodes = sources.reduce((n, s) => n + (s.extract?.nodes.length ?? 0), 0)
    const expectedTps = sources.reduce((n, s) => n + (s.extract?.tps.length ?? 0), 0)
    const report = await runDskpLoad(db.prisma, sources, { dryRun: true, now: NOW })
    expect(exitCodeOf(report)).toBe(0)
    expect(report.subjects).toHaveLength(13)
    expect(sum(report, (l) => l.nodes.inserted)).toBe(expectedNodes)
    expect(sum(report, (l) => l.tps.inserted)).toBe(expectedTps)
    expect(sum(report, (l) => l.nodes.unchanged)).toBe(0)
    expect(await nodesNow()).toBe(0)
    expect(await tpsNow()).toBe(0)
    const text = formatDskpReport(report)
    expect(text).toContain('DRY RUN')
    expect(text).toContain('MATH')
    expect(text).toContain('T4')
    expect(text).toContain('Rejected rows')
    expect(text).toContain('Known limits')
    expect(text).toContain('RESULT: ok')
  })

  it('real run: inserts exactly what the dry run announced, per subject and level', async () => {
    const sources = readDskpSources()
    const dry = await runDskpLoad(db.prisma, sources, { dryRun: true, now: NOW })
    const real = await runDskpLoad(db.prisma, sources, { dryRun: false, now: NOW })
    expect(exitCodeOf(real)).toBe(0)
    expect(real.subjects.map((s) => [s.code, s.levels])).toEqual(dry.subjects.map((s) => [s.code, s.levels]))
    for (const s of real.subjects) {
      for (const l of s.levels.filter((x) => x.level !== 'general')) {
        const n = await count(
          db,
          `select count(*) n from curriculum_nodes where subject_id = (select id from subjects where code = $1)
             and education_level_id = (select id from education_levels where code = $2)`,
          [s.code, l.level],
        )
        expect(n, `${s.code} ${l.level}`).toBe(l.nodes.inserted)
      }
    }
    expect(await nodesNow()).toBe(sum(real, (l) => l.nodes.inserted))
    expect(await tpsNow()).toBe(sum(real, (l) => l.tps.inserted))
    // Tingkatan 4 and 5 only, an edition on every node, no orphans.
    const levels = await db.query<{ code: string }>(`select distinct l.code from curriculum_nodes n join education_levels l on l.id = n.education_level_id order by 1`)
    expect(levels.map((r) => r.code)).toEqual(['T4', 'T5'])
    expect(await count(db, `select count(*) n from curriculum_nodes where edition is null or edition = ''`)).toBe(0)
    expect(await count(db, `select count(*) n from curriculum_nodes c where parent_id is not null and not exists (select 1 from curriculum_nodes p where p.id = c.parent_id)`)).toBe(0)
  })

  it('idempotent: a second run inserts and updates nothing and the row counts do not move', async () => {
    const nodes = await nodesNow()
    const tps = await tpsNow()
    const again = await runDskpLoad(db.prisma, readDskpSources(), { dryRun: false, now: NOW })
    expect(exitCodeOf(again)).toBe(0)
    expect(sum(again, (l) => l.nodes.inserted)).toBe(0)
    expect(sum(again, (l) => l.nodes.updated)).toBe(0)
    expect(sum(again, (l) => l.tps.inserted)).toBe(0)
    expect(sum(again, (l) => l.nodes.unchanged)).toBe(nodes)
    expect(sum(again, (l) => l.tps.unchanged)).toBe(tps)
    expect(sum(again, (l) => l.nodes.drift)).toBe(0)
    expect(await nodesNow()).toBe(nodes)
    expect(await tpsNow()).toBe(tps)
  })

  it('--subject limits the run to one subject', async () => {
    const r = await runDskpLoad(db.prisma, readDskpSources(), { dryRun: true, only: ['math'], now: NOW })
    expect(r.subjects.map((s) => s.code)).toEqual(['MATH'])
    const byFile = await runDskpLoad(db.prisma, readDskpSources(), { dryRun: true, only: ['sejarah'], now: NOW })
    expect(byFile.subjects.map((s) => s.code)).toEqual(['SEJ'])
  })

  it('never overwrites an admin edit (insert-only) and reports it as drift', async () => {
    await db.query(
      `update curriculum_nodes set title = 'Edited by admin' where id = (select id from curriculum_nodes where kind = 'unit' and subject_id = (select id from subjects where code = 'SEJ') order by id limit 1)`,
    )
    const r = await runDskpLoad(db.prisma, readDskpSources(), { dryRun: false, only: ['SEJ'], now: NOW })
    expect(sum(r, (l) => l.nodes.drift)).toBe(1)
    expect(sum(r, (l) => l.nodes.inserted)).toBe(0)
    expect(await count(db, `select count(*) n from curriculum_nodes where title = 'Edited by admin'`)).toBe(1)
  })

  it('a new edition adds nodes beside the old ones and the old ones stay', async () => {
    const before = await count(db, `select count(*) n from curriculum_nodes where subject_id = (select id from subjects where code = 'SEJ')`)
    const sej = readDskpSources().find((s) => s.file === 'sejarah.json')
    const raw = JSON.parse(readFileSync(new URL('../../src/modules/curriculum/dskp/data/sejarah.json', import.meta.url), 'utf8')) as { edition: string }
    raw.edition = 'Edisi semakan 2027'
    mkdirSync(join(dir, 'ed'), { recursive: true })
    writeFileSync(join(dir, 'ed', 'sejarah.json'), JSON.stringify(raw))
    const r = await runDskpLoad(db.prisma, readDskpSources(join(dir, 'ed')), { dryRun: false, now: NOW })
    expect(sej?.extract?.nodes.length).toBeGreaterThan(0)
    expect(sum(r, (l) => l.nodes.inserted)).toBe(sej?.extract?.nodes.length)
    expect(await count(db, `select count(*) n from curriculum_nodes where subject_id = (select id from subjects where code = 'SEJ')`)).toBe(before + (sej?.extract?.nodes.length ?? 0))
    await db.query(`delete from curriculum_nodes where edition = 'Edisi semakan 2027'`)
  })

  describe('T1-T3 drop-in (no code change)', () => {
    it('a file in the same format for Tingkatan 1 loads, a Darjah row is ignored and listed, a TP row without a number is counted', async () => {
      const t = join(dir, 'dropin')
      mkdirSync(t, { recursive: true })
      writeFileSync(join(t, 'matematik-t1.json'), JSON.stringify(fixture()))
      const parsed = parseDskpExtract(fixture())
      expect(parsed.ignored).toEqual([{ level: 'D3', code: '1.0', title: 'Darjah row' }])
      expect(parsed.skipped.missingTp).toBe(1)
      expect(parsed.rejected).toEqual([{ level: 'T1', at: 'T1 unit 1.0', reason: 'Baris TP tidak disimpan: tiada nombor TP.' }])

      const before = await nodesNow()
      const sources = readDskpSources(t)
      expect(sources[0]?.subjectCode).toBeNull() // found by the extract's subject name
      const r = await runDskpLoad(db.prisma, sources, { dryRun: false, now: NOW })
      expect(exitCodeOf(r)).toBe(0)
      expect(r.subjects.map((s) => s.code)).toEqual(['MATH'])
      expect(r.subjects[0]?.ignored).toEqual([{ file: 'matematik-t1.json', level: 'D3', unit: '1.0', title: 'Darjah row' }])
      expect(r.subjects[0]?.rejected).toHaveLength(1)
      const t1 = r.subjects[0]?.levels.find((l) => l.level === 'T1')
      expect(t1?.nodes).toEqual({ inserted: 5, updated: 0, unchanged: 0, drift: 0 }) // grouping, unit, sk, 2 sp
      expect(t1?.tps).toEqual({ inserted: 2, unchanged: 0 })
      expect(await nodesNow()).toBe(before + 5)
      expect(await count(db, `select count(*) n from curriculum_nodes n join education_levels l on l.id = n.education_level_id where l.code = 'T1' and n.edition = 'Fixture edition'`)).toBe(5)
      // The printed text is stored as is.
      expect(await count(db, `select count(*) n from curriculum_nodes where code = '1.1.2' and title = 'Membandingkan integer'`)).toBe(1)
      // Existing T4/T5 nodes are untouched, and a second run changes nothing.
      const second = await runDskpLoad(db.prisma, sources, { dryRun: false, now: NOW })
      expect(sum(second, (l) => l.nodes.inserted) + sum(second, (l) => l.tps.inserted)).toBe(0)
      expect(await nodesNow()).toBe(before + 5)
      const text = formatDskpReport(r)
      expect(text).toContain('Ignored (not Tingkatan 1-5): 1')
      expect(text).toContain('Baris TP tidak disimpan: tiada nombor TP.')
    })
  })

  describe('failure handling', () => {
    it('a file that is not a DSKP extract fails its subject only: nothing from it is written, the others load, exit code 1', async () => {
      const t = join(dir, 'bad')
      mkdirSync(t, { recursive: true })
      writeFileSync(join(t, 'matematik.json'), '{"subject":"Matematik","units":"nope"}')
      writeFileSync(join(t, 'sejarah.json'), JSON.stringify({ ...fixture({ subject: 'Sejarah', units: [] }) }))
      const before = await nodesNow()
      const r = await runDskpLoad(db.prisma, readDskpSources(t), { dryRun: false, now: NOW })
      expect(exitCodeOf(r)).toBe(1)
      expect(r.subjects.find((s) => s.code === 'MATH')?.status).toBe('failed')
      expect(r.subjects.find((s) => s.code === 'SEJ')?.status).toBe('ok')
      expect(await nodesNow()).toBe(before)
      expect(formatDskpReport(r)).toContain('FAILED, nothing written')
    })

    it('a subject whose level is missing from education_levels writes nothing', async () => {
      const t = join(dir, 'half')
      mkdirSync(t, { recursive: true })
      // T3 is removed so the extract needs a level the table does not have (this database is private to the file).
      await db.query(`delete from education_levels where code = 'T3'`)
      writeFileSync(join(t, 'matematik-t3.json'), JSON.stringify(fixture({ units: [{ ...fixture().units[0], level: 'T3' }] })))
      const before = await nodesNow()
      const r = await runDskpLoad(db.prisma, readDskpSources(t), { dryRun: false, now: NOW })
      expect(exitCodeOf(r)).toBe(1)
      expect(r.subjects[0]?.error).toContain('education level "T3" is not in education_levels')
      expect(await nodesNow()).toBe(before)
    })

    it('a file naming an unknown subject is reported as unassigned, exit code 1', async () => {
      const t = join(dir, 'unknown')
      mkdirSync(t, { recursive: true })
      writeFileSync(join(t, 'x.json'), JSON.stringify(fixture({ subject: 'Mata Pelajaran Tiada' })))
      const r = await runDskpLoad(db.prisma, readDskpSources(t), { dryRun: true, now: NOW })
      expect(r.subjects).toEqual([])
      expect(r.unassigned[0]?.file).toBe('x.json')
      expect(exitCodeOf(r)).toBe(1)
    })

    it('a missing subject row fails with a clear message unless --create-missing-subjects, which adds LNR/KNP inactive', async () => {
      await db.query(`delete from subjects where code = 'LNR'`)
      const only = ['LNR']
      const failed = await runDskpLoad(db.prisma, readDskpSources(), { dryRun: false, only, now: NOW })
      expect(failed.subjects[0]?.status).toBe('failed')
      expect(failed.subjects[0]?.error).toContain('not in the subjects table')
      const dry = await runDskpLoad(db.prisma, readDskpSources(), { dryRun: true, only, createMissingSubjects: true, now: NOW })
      expect(dry.subjects[0]?.status).toBe('ok')
      expect(await count(db, `select count(*) n from subjects where code = 'LNR'`)).toBe(0)
      const made = await runDskpLoad(db.prisma, readDskpSources(), { dryRun: false, only, createMissingSubjects: true, now: NOW })
      expect(made.subjects[0]?.createdSubject).toBe(true)
      expect(await count(db, `select count(*) n from subjects where code = 'LNR' and not is_active`)).toBe(1)
      expect(await count(db, `select count(*) n from curriculum_nodes where subject_id = (select id from subjects where code = 'LNR')`)).toBeGreaterThan(0)
    })
  })

  describe('command line', () => {
    it('parses flags and refuses unknown ones', () => {
      expect(parseArgs(['--dry-run', '--subject', 'MATH,SCI', '--subject=BM', '--create-missing-subjects'])).toEqual({
        dryRun: true,
        subjects: ['MATH', 'SCI', 'BM'],
        dataDir: null,
        createMissingSubjects: true,
        help: false,
      })
      expect(() => parseArgs(['--wat'])).toThrow(UsageError)
      expect(() => parseArgs(['--subject'])).toThrow(UsageError)
    })

    it('main: no DATABASE_URL is a usage error (2); --dry-run prints the report and returns 0', async () => {
      const out: string[] = []
      const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
        out.push(String(chunk))
        return true
      })
      const errSpy = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
      try {
        expect(await main(['--dry-run'], {})).toBe(2)
        const nodes = await nodesNow()
        expect(await main(['--dry-run', '--subject', 'MATH'], { DATABASE_URL: db.url })).toBe(0)
        expect(await nodesNow()).toBe(nodes)
        expect(await main(['--bogus'], { DATABASE_URL: db.url })).toBe(2)
      } finally {
        spy.mockRestore()
        errSpy.mockRestore()
      }
      const text = out.join('')
      expect(text).toContain('Database: t_')
      expect(text).toContain('DRY RUN')
      expect(text).toContain('MATH')
    })
  })
})
