import { PerformanceSchoolSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, loginAs, parseData } from '../../../curriculum/helpers'
import { bootHeadcountWorld, insertConfig, insertEntry, PUPILS, type HeadcountWorld } from './headcount-boot'

/** Cohort suppression consistency of the S1 subject breakdown (GET /api/performance/school). */
let w: HeadcountWorld
let cfg2: string
const as: Record<string, Client> = {}

beforeAll(async () => {
  w = await bootHeadcountWorld()
  for (const k of ['guru', 'adminsekolah', 'pelajar']) as[k] = await loginAs(w, `${k}@demo.test`)

  // Subject 1: five pupils with one latest AR each = A+ (0), A (1), A- (2), B (4), C (6).
  const cfg1 = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId })
  const pupils = ['pelajar@demo.test', 'pelajar2@demo.test', ...PUPILS]
  const ars = [95, 85, 75, 62, 52]
  for (const [i, email] of pupils.entries()) await insertEntry(w, cfg1, email, { marks: [[80, ars[i] as number]] })
  // Subject 2: one pupil, D (7).
  cfg2 = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId2, subjectId: w.subjectId2 })
  await insertEntry(w, cfg2, 'pelajar@demo.test', { marks: [[60, 45]] })
}, 180_000)
afterAll(async () => {
  await w?.close()
})

const school = async (c: Client) => parseData(await c.get('/api/performance/school'), PerformanceSchoolSchema)

describe('Prestasi sekolah: subject breakdown and cohort suppression', () => {
  it('staff see every subject row', async () => {
    for (const k of ['adminsekolah', 'guru']) {
      const s = await school(as[k] as Client)
      expect(s.gps).toEqual({ value: 3.33, band: 'Baik', entries: 6 })
      expect(s.subjects.map((x) => [x.subjectId, x.gps, x.entries])).toEqual([
        [w.subjectId, 2.6, 5],
        [w.subjectId2, 7, 1],
      ])
    }
  })

  it('a pupil gets the same overall figure but no subject breakdown while one subject is below 5 pupils', async () => {
    for (const k of ['pelajar']) {
      const s = await school(as[k] as Client)
      expect(s.gps).toEqual({ value: 3.33, band: 'Baik', entries: 6 })
      expect(s.subjects).toEqual([])
    }
  })

  it('once every subject has at least 5 pupils the full breakdown is shown to non-staff and equals the staff one', async () => {
    for (const email of ['pelajar2@demo.test', ...PUPILS]) await insertEntry(w, cfg2, email, { marks: [[60, 45]] })
    const staff = await school(as.adminsekolah as Client)
    for (const k of ['pelajar']) {
      const s = await school(as[k] as Client)
      expect(s.gps).toEqual({ value: 4.8, band: 'Sederhana', entries: 10 })
      expect(s.subjects.map((x) => [x.subjectId, x.gps, x.entries])).toEqual([
        [w.subjectId, 2.6, 5],
        [w.subjectId2, 7, 5],
      ])
      expect(s.subjects).toEqual(staff.subjects)
    }
  })
})
