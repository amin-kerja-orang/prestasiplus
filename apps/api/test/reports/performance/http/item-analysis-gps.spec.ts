import { PerformanceSchoolItemAnalysisSchema, PerformanceSchoolSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { type Client, loginAs, parseData } from '../../../curriculum/helpers'
import { bootHeadcountWorld, insertConfig, insertEntry, PUPILS, type HeadcountWorld } from './headcount-boot'

/** SW5-07: the "GPS Anggaran Sekolah" card of Analisa Item sekolah is the headcount GPS of Prestasi sekolah (DV-M08-31). */
let w: HeadcountWorld
const as: Record<string, Client> = {}

beforeAll(async () => {
  w = await bootHeadcountWorld()
  for (const k of ['guru', 'adminsekolah', 'admin2', 'pelajar']) as[k] = await loginAs(w, `${k}@demo.test`)

  // 2026, class DEMO4S: five pupils with one latest AR each = A+ (0), A (1), A- (2), B (4), C (6).
  const cfg2026 = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId, year: 2026 })
  const pupils = ['pelajar@demo.test', 'pelajar2@demo.test', ...PUPILS.slice(0, 2)]
  const ars = [95, 85, 75, 62]
  for (const [i, email] of pupils.entries()) await insertEntry(w, cfg2026, email, { marks: [[80, ars[i] as number]] })
  await insertEntry(w, cfg2026, PUPILS[2] as string, { marks: [[80, 52]] })
  // 2025, another class and subject: one pupil, D (7). Below the cohort on its own.
  const cfg2025 = await insertConfig(w, { teacher: 'guru@demo.test', classroomId: w.classId2, subjectId: w.subjectId2, year: 2025 })
  await insertEntry(w, cfg2025, 'pelajar@demo.test', { marks: [[60, 45]] })
}, 180_000)
afterAll(async () => {
  await w?.close()
})

const itemSchool = async (c: Client) => parseData(await c.get('/api/item-analysis/school'), PerformanceSchoolItemAnalysisSchema)

describe('Analisa Item sekolah GPS card (SW5-07)', () => {
  it('equals the Prestasi sekolah GPS (value, band, entries) and lists the yearly GPS', async () => {
    const s1 = parseData(await (as.adminsekolah as Client).get('/api/performance/school'), PerformanceSchoolSchema)
    const s9 = await itemSchool(as.adminsekolah as Client)
    // (0 + 1 + 2 + 4 + 6 + 7) / 6
    expect(s1.gps).toEqual({ value: 3.33, band: 'Baik', entries: 6 })
    expect({ value: s9.gps.value, band: s9.gps.band, entries: s9.gps.entries }).toEqual(s1.gps)
    expect(s9.gps.years).toEqual([
      { year: 2025, gps: 7 },
      { year: 2026, gps: 2.6 },
    ])
  })

  it('a pupil gets the same figure; a year below the cohort of 5 pupils is left out of the series', async () => {
    const s9 = await itemSchool(as.pelajar as Client)
    expect(s9.gps).toEqual({ value: 3.33, band: 'Baik', entries: 6, years: [{ year: 2026, gps: 2.6 }] })
  })

  it('a school without headcount entries keeps the empty card', async () => {
    const s9 = await itemSchool(as.admin2 as Client)
    expect(s9.gps).toEqual({ value: null, band: null, entries: 0, years: [] })
  })
})
