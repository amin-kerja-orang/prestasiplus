import { CommandCenterGuruDrillSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootCommandCenterApp, buildWorld, type CcTestApp, expectError, getAs, loginRole, type LoggedIn, type World } from './helpers'

let t: CcTestApp
let w: World
let teacher: LoggedIn

beforeAll(async () => {
  t = await bootCommandCenterApp()
  w = await buildWorld(t)
  teacher = await loginRole(t, 'teacher')
})
afterAll(async () => {
  await t.close()
})

const drill = async (query: string) => getAs(teacher, `/guru/command-center/drill${query}`)

describe('GET /guru/command-center/drill: validation (422 with the BM texts)', () => {
  it('missing or unknown type -> fields.type', async () => {
    for (const q of ['', '?type=', '?type=nope', '?type=STUDENTS']) {
      const err = expectError(await drill(q), 'VALIDATION_ERROR', 'Jenis drill tidak sah.')
      expect(err.fields).toEqual({ type: 'Jenis drill tidak sah.' })
    }
  })

  it('an Object.prototype key is not a drill type (422, never a 500)', async () => {
    for (const q of ['?type=constructor', '?type=__proto__', '?type=toString', '?type=hasOwnProperty', '?type=constructor&filter=x']) {
      const err = expectError(await drill(q), 'VALIDATION_ERROR', 'Jenis drill tidak sah.')
      expect(err.fields).toEqual({ type: 'Jenis drill tidak sah.' })
    }
  })

  it('bad filter -> fields.filter, and the type check comes first', async () => {
    for (const q of ['?type=students&filter=x', '?type=today&filter=active', '?type=subjects&filter=t1', '?type=kirk', '?type=kirk&filter=t5', '?type=mood&filter=angry', '?type=engagement&filter=best', '?type=gps&filter=a']) {
      const err = expectError(await drill(q), 'VALIDATION_ERROR', 'Penapis tidak sah.')
      expect(err.fields).toEqual({ filter: 'Penapis tidak sah.' })
    }
    expectError(await drill('?type=nope&filter=x'), 'VALIDATION_ERROR', 'Jenis drill tidak sah.')
  })

  it('a filter is trimmed', async () => {
    expect((await drill('?type=students&filter=%20active%20')).status).toBe(200)
  })
})

describe('GET /guru/command-center/drill: rows', () => {
  it('students: own pupils only, class names, status', async () => {
    const res = await drill('?type=students')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const body = CommandCenterGuruDrillSchema.parse(res.body)
    expect(body.title).toBe('Pelajar Berdaftar')
    expect(body.students).toHaveLength(3)
    expect(body.students[0]).toMatchObject({ name: 'Murid 1', className: 'Kelas Satu', answered: 12, accuracy: 75, status: 'Aktif' })
    expect(JSON.stringify(body.students)).not.toContain(w.testPupil)
    expect(JSON.stringify(body.students)).not.toContain(w.loosePupil)
    const active = CommandCenterGuruDrillSchema.parse((await drill('?type=students&filter=active')).body)
    expect(active.students).toHaveLength(3)
  })

  it('today: one row per (pupil, subject) with today answers only; titles by filter', async () => {
    const body = CommandCenterGuruDrillSchema.parse((await drill('?type=today')).body)
    expect(body.title).toBe('Soalan Dijawab')
    expect(body.students).toHaveLength(3)
    expect(body.students[0]).toMatchObject({ answered: 10, time: '08:00' })
    const akt = CommandCenterGuruDrillSchema.parse((await drill('?type=today&filter=aktiviti')).body)
    expect(akt.title).toBe('Aktiviti Hari Ini')
  })

  it('subjects: totals equal the live-data total', async () => {
    const body = CommandCenterGuruDrillSchema.parse((await drill('?type=subjects')).body)
    expect(body.title).toBe('Ketepatan Purata')
    const answered = (body.students as { answered: number }[]).reduce((n, r) => n + r.answered, 0)
    expect(answered).toBe(36)
    expect(body.students).toHaveLength(2)
  })

  it('gps, kirk t1, mood are empty with their titles (ports are empty)', async () => {
    for (const [q, title] of [['?type=gps', 'GPS Sekolah'], ['?type=kirk&filter=t1', 'Kirkpatrick T1'], ['?type=mood', 'Mood Pelajar'], ['?type=mood&filter=sad', 'Mood Pelajar']] as const) {
      const body = CommandCenterGuruDrillSchema.parse((await drill(q)).body)
      expect(body).toEqual({ title, students: [] })
    }
  })

  it('kirk t2..t4: empty rows plus the month-over-month comparison', async () => {
    for (const f of ['t2', 't3', 't4']) {
      const body = CommandCenterGuruDrillSchema.parse((await drill(`?type=kirk&filter=${f}`)).body)
      expect(body.title).toBe(`Kirkpatrick ${f.toUpperCase()}`)
      expect(body.students).toEqual([])
      expect(body.vsLabel).toBe('Bulan Ini vs Bulan Lepas')
      expect(body.extra).toEqual({ accuracyNow: 72, accuracyPrev: 0, accuracyChange: 72, answersNow: 36, answersPrev: 0, activeNow: 3, activePrev: 0, newStudents: 3 })
    }
  })

  it('engagement: one row per pupil, filter by band', async () => {
    const all = CommandCenterGuruDrillSchema.parse((await drill('?type=engagement')).body)
    expect(all.title).toBe('Engagement Pelajar')
    expect(all.students).toHaveLength(3)
    expect(all.students[0]).toMatchObject({ band: 'developing', days: 2, answeredWeek: 12, accuracy: 75 })
    expect((CommandCenterGuruDrillSchema.parse((await drill('?type=engagement&filter=developing')).body)).students).toHaveLength(3)
    expect((CommandCenterGuruDrillSchema.parse((await drill('?type=engagement&filter=champion')).body)).students).toHaveLength(0)
  })

  it('a teacher without classes gets an empty list', async () => {
    const admin = await loginRole(t, 'admin')
    const body = CommandCenterGuruDrillSchema.parse((await getAs(admin, '/guru/command-center/drill?type=students')).body)
    expect(body.students).toEqual([])
  })
})
