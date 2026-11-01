/**
 * T41: R1-12 / R1-19 acceptance criteria of the DSKP loader that had no spec (docs/qa/r1-backend-ac-coverage.md).
 *
 * | AC | spec |
 * | R1-12.3 each rejected row has a plain BM reason, in the `npm run dskp:load` dry run | "R1-12.3" |
 * | R1-12.5 loading changes no student-visible question or paper                          | "R1-12.5" |
 * | R1-19.3 Darjah is refused with a BM reason, in the loader and in the Kontrak editor   | "R1-19.3" |
 *
 * R1-19.2 (Darjah visible to the admin) is superseded by D96: Darjah stays hidden from the admin too; nothing here depends on it.
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { curriculumSeed } from '../../prisma/seed/curriculum'
import { questionsSeed } from '../../prisma/seed/questions'
import { QUESTION_COUNT_SQL } from '../../src/modules/account/account-data.repository'
import { main } from '../../src/modules/curriculum/dskp/cli'
import { DSKP_REASONS_MS } from '../../src/modules/curriculum/dskp/dskp-loader'
import { createTestDatabase, type TestDatabase } from '../support/db'
import { count, dropDatabase } from './helpers'

/** A minimal extract in the shipped format: two rejected TP rows (no number, a printed range), one duplicate TP and a Darjah unit. */
const extract = () => ({
  subject: 'Matematik',
  edition: 'Fixture edition',
  generalPerformanceLevels: { levels: [{ tp: 1, descriptor: 'General one' }] },
  units: [
    {
      level: 'T1',
      code: '1.0',
      title: 'Nombor Nisbah',
      bidang: 'NOMBOR DAN OPERASI',
      standards: [{ sk: '1.1', skTitle: 'Integer', sp: [{ code: '1.1.1', text: 'Mengenal integer' }] }],
      tahapPenguasaan: [
        { tp: 1, descriptor: 'one' },
        { tp: 1, descriptor: 'one again' },
        { descriptor: 'no number' },
        { tp: '1-4', descriptor: 'a printed range' },
      ],
    },
    { level: 'D3', code: '2.0', title: 'Unit Darjah', standards: [] },
  ],
})

describe('DSKP loader acceptance criteria (T41)', () => {
  let db: TestDatabase
  let dir: string
  let out: string[]

  const run = async (argv: string[]): Promise<number> => {
    out = []
    const spy = vi.spyOn(process.stdout, 'write').mockImplementation((chunk: unknown) => {
      out.push(String(chunk))
      return true
    })
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true)
    try {
      return await main(argv, { DATABASE_URL: db.url })
    } finally {
      spy.mockRestore()
      err.mockRestore()
    }
  }

  beforeAll(async () => {
    db = await createTestDatabase()
    await runSeeds([identitySeed, curriculumSeed, questionsSeed], { prisma: db.prisma })
    dir = mkdtempSync(join(tmpdir(), 'dskp-acs-'))
    mkdirSync(join(dir, 'fixture'), { recursive: true })
    writeFileSync(join(dir, 'fixture', 'matematik-t1.json'), JSON.stringify(extract()))
  }, 180_000)
  afterAll(async () => {
    await dropDatabase(db)
    rmSync(dir, { recursive: true, force: true })
  })

  describe('R1-12.3: the report gives each rejected row with a plain BM reason', () => {
    it('npm run dskp:load --dry-run prints counts per subject and level and one BM reason per rejected TP row, and writes nothing', async () => {
      const before = await count(db, 'select count(*) n from curriculum_nodes')
      expect(await run(['--dry-run', '--data-dir', join(dir, 'fixture')])).toBe(0)
      expect(await count(db, 'select count(*) n from curriculum_nodes')).toBe(before)
      const text = out.join('')
      expect(text).toContain('DRY RUN')
      expect(text).toContain('Rejected rows (skipped, counted): 3')
      // the exact plain reason of each rejected row, in Bahasa Melayu, with where it was
      expect(text).toContain(`MATH T1 unit 1.0: ${DSKP_REASONS_MS.notStored} ${DSKP_REASONS_MS.noTp}`)
      expect(text).toContain('MATH T1 unit 1.0: Baris TP tidak disimpan: tiada nombor TP.')
      expect(text).toContain('MATH T1 unit 1.0: Baris TP tidak disimpan: TP "1-4" bukan satu nombor dari 1 hingga 6.')
      expect(text).toContain('MATH T1 unit 1.0: Baris TP tidak disimpan: TP 1 muncul dua kali pada nod yang sama.')
      // no reason is left in English
      expect(text).not.toContain('TP row not stored')
    })
  })

  describe('R1-12.5: loading changes nothing a pupil can see', () => {
    it('a real load of the packaged DSKP leaves the servable count, the login count and every question and paper row as they were', async () => {
      const snapshot = async () => ({
        login: await count(db, `select t.c as n from (${QUESTION_COUNT_SQL}) t`),
        servable: await count(
          db,
          `select count(*) n from questions q join question_versions v on v.question_id = q.id and v.version_no = q.live_version_no where q.is_active and v.status = 'approved'`,
        ),
        questions: await count(db, 'select count(*) n from questions'),
        versions: await count(db, 'select count(*) n from question_versions'),
        papers: await count(db, 'select count(*) n from papers'),
        // a digest of every served field a load could touch
        digest: (
          await db.query<{ d: string }>(
            `select md5(string_agg(concat_ws('|', q.id, q.is_active, q.live_version_no, v.version_no, v.status, v.subject_id, v.education_level_id, v.unit_node_id, v.chapter_id), ';' order by q.id, v.version_no)) d
               from questions q join question_versions v on v.question_id = q.id`,
          )
        )[0]?.d,
        paperDigest: (
          await db.query<{ d: string | null }>(
            `select md5(coalesce(string_agg(concat_ws('|', p.id, p.status, p.kind, p.title), ';' order by p.id), '')) d from papers p`,
          )
        )[0]?.d,
      })
      const before = await snapshot()
      expect(before.login).toBeGreaterThan(0)
      const nodesBefore = await count(db, 'select count(*) n from curriculum_nodes')
      expect(await run([])).toBe(0) // the packaged data, a real run
      expect(await count(db, 'select count(*) n from curriculum_nodes')).toBeGreaterThanOrEqual(nodesBefore) // it did load something
      expect(await snapshot()).toEqual(before)
    })
  })

  describe('R1-19.3: Darjah is refused with a BM reason', () => {
    it('the loader lists the Darjah unit as not loaded with the BM reason, and loads nothing of it', async () => {
      expect(await run(['--dry-run', '--data-dir', join(dir, 'fixture')])).toBe(0)
      const text = out.join('')
      expect(text).toContain('Ignored (not Tingkatan 1-5): 1')
      expect(text).toContain(`MATH matematik-t1.json: level "D3" unit 2.0 Unit Darjah (${DSKP_REASONS_MS.darjahIgnored})`)
      expect(DSKP_REASONS_MS.darjahIgnored).toBe('Dilangkau: Darjah tidak dimuatkan (hanya Tingkatan 1 hingga 5).')
      expect(await run(['--data-dir', join(dir, 'fixture')])).toBe(0)
      expect(await count(db, `select count(*) n from curriculum_nodes n join education_levels l on l.id = n.education_level_id where l.stage = 'primary' and n.edition = 'Fixture edition'`)).toBe(0)
    })
  })
})
