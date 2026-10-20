import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, loginAs } from '../../../curriculum/helpers'
import { bootHeadcountWorld, type HeadcountWorld } from './headcount-boot'

let w: HeadcountWorld
let guru: Client

beforeAll(async () => {
  w = await bootHeadcountWorld()
  guru = await loginAs(w, 'guru@demo.test')
}, 180_000)
afterAll(async () => {
  await w?.close()
})

const count = async (sql: string, params: unknown[] = []): Promise<number> => (await w.db.query(sql, params)).length

describe('privacy 13: concurrent writes keep the unique key', () => {
  it('concurrent creates of the same config give exactly one 201, the rest 409, and one row', async () => {
    const payload = {
      classroomId: w.classId,
      subjectId: w.subjectId,
      educationLevelId: w.levelId,
      academicYear: 2060,
      activeOtrs: 3,
      mode: 'auto',
    }
    const results = await Promise.all(Array.from({ length: 8 }, () => guru.post('/api/headcounts', payload)))
    const statuses = results.map((r) => r.status).sort()
    expect(statuses.filter((s) => s === 201)).toHaveLength(1)
    expect(statuses.filter((s) => s === 409)).toHaveLength(7)
    expect(await count(`select 1 from headcount_configs where classroom_id = $1 and academic_year = 2060 and mode = 'auto'`, [w.classId])).toBe(1)
  })

  it('concurrent auto-setup runs and a create of the same Auto config produce exactly one config', async () => {
    const year = 2026
    const create = guru.post('/api/headcounts', {
      classroomId: w.classId,
      subjectId: w.subjectId,
      educationLevelId: w.levelId,
      academicYear: year,
      activeOtrs: 3,
      mode: 'auto',
    })
    const setups = Array.from({ length: 4 }, () => guru.post('/api/headcounts/auto-setup', { levels: ['T4'] }))
    const results = await Promise.all([create, ...setups])
    for (const r of results) expect([200, 201, 409], JSON.stringify(r.body)).toContain(r.status)
    expect(await count(`select 1 from headcount_configs where classroom_id = $1 and subject_id = $2 and academic_year = $3 and mode = 'auto'`, [w.classId, w.subjectId, year])).toBe(1)
    expect(await count(`select 1 from headcount_configs where classroom_id = $1 and academic_year = $2`, [w.classId2, year])).toBeLessThanOrEqual(1)
  })

  it('a manual create racing auto-setup runs under the (class, subject, year) lock: auto-setup never adds a second config next to a manual one that won', async () => {
    const year = 2026
    await w.db.query(`delete from headcount_configs where classroom_id = $1 and academic_year = $2`, [w.classId, year])
    const manual = guru.post('/api/headcounts', {
      classroomId: w.classId,
      subjectId: w.subjectId,
      educationLevelId: w.levelId,
      academicYear: year,
      activeOtrs: 3,
      mode: 'manual',
    })
    const setups = Array.from({ length: 3 }, () => guru.post('/api/headcounts/auto-setup', { levels: ['T4'] }))
    const results = await Promise.all([manual, ...setups])
    for (const r of results) expect([200, 201, 409], JSON.stringify(r.body)).toContain(r.status)
    expect(results[0]?.status).toBe(201)
    const modes = (await w.db.query<{ mode: string }>(`select mode from headcount_configs where classroom_id = $1 and subject_id = $2 and academic_year = $3 order by mode`, [w.classId, w.subjectId, year])).map((r) => r.mode)
    // Serial outcomes only: manual alone, or auto first and then manual. Never two autos, never two manuals.
    expect(['manual'], modes.join()).toContain(modes.at(-1))
    expect(modes.filter((m) => m === 'auto').length).toBeLessThanOrEqual(1)
    expect(modes.filter((m) => m === 'manual')).toHaveLength(1)
  })

  it('concurrent drops of the same pupil leave one entry', async () => {
    const created = await guru.post('/api/headcounts', {
      classroomId: w.classId,
      subjectId: w.subjectId,
      educationLevelId: w.levelId,
      academicYear: 2061,
      activeOtrs: 2,
      mode: 'manual',
    })
    expect(created.status).toBe(201)
    const id = (created.body as { data: { id: string } }).data.id
    const pupil = w.ids['pelajar2@demo.test']
    const results = await Promise.all(Array.from({ length: 5 }, () => guru.post(`/api/headcounts/${id}/drop-students`, { action: 'drop', studentIds: [pupil] })))
    for (const r of results) expect(r.status, JSON.stringify(r.body)).toBe(200)
    expect(await count(`select 1 from headcount_entries where config_id = $1 and student_id = $2`, [id, pupil])).toBe(1)
  })
})
