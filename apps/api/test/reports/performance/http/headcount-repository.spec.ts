import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { HeadcountRepository } from '../../../../src/modules/reports/performance/headcount/headcount.repository'
import { bootHeadcountWorld, insertConfig, insertEntry, PUPILS, type HeadcountWorld } from './headcount-boot'

let w: HeadcountWorld
let repo: HeadcountRepository
const NOW = new Date('2026-10-19T01:00:00Z')

beforeAll(async () => {
  w = await bootHeadcountWorld()
  repo = w.app.get(HeadcountRepository)
}, 180_000)
afterAll(async () => {
  await w?.close()
})

const rejects = async (sql: string, params: unknown[]): Promise<string> => {
  try {
    await w.db.query(sql, params)
  } catch (err) {
    return String((err as Error).message)
  }
  throw new Error('expected the statement to be rejected')
}

describe('constraints of migration 0030', () => {
  it('rejects a bad OTR count, mode, year and percentage, and a duplicate key', async () => {
    const base = [w.ids['guru@demo.test'], w.classId, w.subjectId, w.levelId]
    const insert = `insert into headcount_configs (teacher_id, classroom_id, subject_id, education_level_id, academic_year, active_otrs, mode)
                    values ($1, $2, $3, $4, $5, $6, $7)`
    expect(await rejects(insert, [...base, 2026, 6, 'auto'])).toContain('ck_headcount_configs_active_otrs')
    expect(await rejects(insert, [...base, 2026, 3, 'both'])).toContain('ck_headcount_configs_mode')
    expect(await rejects(insert, [...base, 2019, 3, 'auto'])).toContain('ck_headcount_configs_academic_year')
    await w.db.query(insert, [...base, 2040, 3, 'auto'])
    expect(await rejects(insert, [...base, 2040, 4, 'auto'])).toContain('uq_headcount_configs_class_subject_year_mode')
    // Mode is part of the key (OQ-11).
    await w.db.query(insert, [...base, 2040, 3, 'manual'])
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2041 })
    expect(await rejects(`insert into headcount_entries (config_id, student_id, tov) values ($1, $2, 101)`, [cfg, w.ids['pelajar@demo.test']])).toContain('ck_headcount_entries_tov')
  })

  it('an entry is unique per pupil and config; a mark per checkpoint; checkpoints run 1 to 5', async () => {
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2042 })
    const entry = await insertEntry(w, cfg, 'pelajar@demo.test', { marks: [[60, 65]] })
    expect(await rejects(`insert into headcount_entries (config_id, student_id) values ($1, $2)`, [cfg, w.ids['pelajar@demo.test']])).toContain('uq_headcount_entries_config_id_student_id')
    expect(await rejects(`insert into headcount_entry_marks (entry_id, checkpoint) values ($1, 1)`, [entry])).toContain('uq_headcount_entry_marks_entry_id_checkpoint')
    expect(await rejects(`insert into headcount_entry_marks (entry_id, checkpoint) values ($1, 6)`, [entry])).toContain('ck_headcount_entry_marks_checkpoint')
  })

  it('timeline posts check the category and the title length', async () => {
    const user = w.ids['pelajar@demo.test']
    expect(await rejects(`insert into timeline_posts (user_id, title, category) values ($1, 't', 'lain-lain')`, [user])).toContain('ck_timeline_posts_category')
    expect(await rejects(`insert into timeline_posts (user_id, title, category) values ($1, repeat('a', 151), 'lain')`, [user])).toContain('ck_timeline_posts_title')
    expect(await rejects(`insert into timeline_posts (user_id, title, category) values ($1, '   ', 'lain')`, [user])).toContain('ck_timeline_posts_title')
  })
})

describe('HeadcountRepository', () => {
  it('sizes the marks to the config OTR count with blank slots, and ignores a mark beyond it', async () => {
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2043, otrs: 3 })
    const entry = await insertEntry(w, cfg, 'pelajar@demo.test', { tov: 50.5, marks: [[60, 65]] })
    await w.db.query(`insert into headcount_entry_marks (entry_id, checkpoint, target, actual) values ($1, 3, 80, null), ($1, 5, 99, 99)`, [entry])
    const config = await repo.configById(cfg)
    const [e] = await repo.entriesOf([config as NonNullable<typeof config>])
    expect(e?.marks).toEqual({ tov: 50.5, targets: [60, null, 80], actuals: [65, null, null], etr: null, rs: null })
  })

  it('an unknown or malformed id is absent, never an error', async () => {
    expect(await repo.configById('abc')).toBeNull()
    expect(await repo.configById('987654321')).toBeNull()
    expect(await repo.configsByIds(['abc', '987654321'])).toEqual([])
    expect(await repo.entriesOf([])).toEqual([])
  })

  it('the school of a config is the class school, else the teacher school', async () => {
    const own = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2044 })
    const orphanClass = (
      await w.db.query<{ id: string }>(
        `insert into classrooms (name, teacher_id, education_level_id, academic_year) values ('Kelas Tanpa Sekolah', $1, $2, 2026) returning id::text as id`,
        [w.ids['guru@demo.test'], w.levelId],
      )
    )[0]?.id as string
    const orphan = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: orphanClass, year: 2044 })
    const school1 = (await w.db.query<{ id: string }>(`select id::text from schools where code = 'DEMO001'`))[0]?.id as string
    const school2 = (await w.db.query<{ id: string }>(`select id::text from schools where code = 'DEMO002'`))[0]?.id as string
    const configs = await repo.configsByIds([own, orphan])
    const schools = await repo.schoolOfConfigs(configs)
    expect(schools.get(own)).toBe(school1)
    expect(schools.get(orphan)).toBe(school1)
    const inSchool1 = (await repo.configsOfSchool(school1)).map((c) => c.id)
    expect(inSchool1).toEqual(expect.arrayContaining([own, orphan]))
    expect((await repo.configsOfSchool(school2)).map((c) => c.id)).not.toContain(own)
  })

  it('createConfigsIfAbsent skips a twin and reports how many rows it inserted', async () => {
    const row = {
      teacherId: w.ids['guru@demo.test'] as string,
      classroomId: w.classId,
      subjectId: w.subjectId,
      educationLevelId: w.levelId,
      academicYear: 2045,
      activeOtrs: 3,
      mode: 'auto' as const,
      now: NOW,
    }
    expect(await repo.createConfigsIfAbsent([row])).toBe(1)
    expect(await repo.createConfigsIfAbsent([row, { ...row, classroomId: w.classId2, subjectId: w.subjectId2 }])).toBe(1)
    expect(await repo.createConfigsIfAbsent([])).toBe(0)
  })

  it('setDropped flips existing entries, creates an empty dropped one only when dropping, and counts changes', async () => {
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2046, otrs: 2 })
    await insertEntry(w, cfg, 'pelajar@demo.test', { tov: 50 })
    const ids = [w.ids['pelajar@demo.test'] as string, w.ids[PUPILS[0] as string] as string]
    expect(await repo.setDropped(cfg, ids, true, NOW)).toBe(2)
    expect(await repo.setDropped(cfg, ids, true, NOW)).toBe(0)
    expect(await repo.setDropped(cfg, ids, false, NOW)).toBe(2)
    expect(await repo.setDropped(cfg, [w.ids[PUPILS[1] as string] as string], false, NOW)).toBe(0)
    const rows = await w.db.query<{ dropped: boolean }>(`select dropped from headcount_entries where config_id = $1 order by student_id`, [cfg])
    expect(rows).toHaveLength(2)
    expect(rows.every((r) => !r.dropped)).toBe(true)
  })

  it('resetMarks clears marks, TOV, ETR and RS of every entry and keeps the entries', async () => {
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2047, otrs: 2 })
    await insertEntry(w, cfg, 'pelajar@demo.test', { tov: 50, etr: 80, rs: 70, marks: [[60, 65], [70, 75]] })
    expect(await repo.resetMarks(cfg, NOW)).toBe(1)
    const row = (await w.db.query<{ tov: string | null; etr: string | null; rs: string | null }>(`select tov, etr, rs from headcount_entries where config_id = $1`, [cfg]))[0]
    expect(row).toEqual({ tov: null, etr: null, rs: null })
    expect(await w.db.query(`select 1 from headcount_entry_marks m join headcount_entries e on e.id = m.entry_id where e.config_id = $1`, [cfg])).toHaveLength(0)
  })

  it('deleteConfig cascades to entries and marks', async () => {
    const cfg = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2048 })
    await insertEntry(w, cfg, 'pelajar@demo.test', { marks: [[1, 2]] })
    expect(await repo.deleteConfig(cfg)).toBe(true)
    expect(await repo.deleteConfig(cfg)).toBe(false)
    expect(await w.db.query(`select 1 from headcount_entries where config_id = $1`, [cfg])).toHaveLength(0)
  })

  it('level and subject lookups: T4 and T5 only, active subjects by name', async () => {
    const levels = await repo.headcountLevels()
    expect(levels.map((l) => l.code)).toEqual(['T4', 'T5'])
    const found = await repo.levelsByIdOrCode([w.levelId, 'abc'], ['T5', 'D1'])
    expect(found.map((l) => l.code).sort()).toEqual(expect.arrayContaining(['T4', 'T5']))
    const subjects = await repo.activeSubjects()
    expect(subjects.length).toBeGreaterThan(1)
    expect(await repo.subjectExists(w.subjectId)).toBe(true)
    expect(await repo.subjectExists('987654321')).toBe(false)
  })
})
