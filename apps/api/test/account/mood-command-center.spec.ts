import { CommandCenterDailyActivityResponseSchema, CommandCenterGuruLiveDataSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bootCommandCenterApp, type CcTestApp, createClass, createUser, enrol, getAs, login, loginRole, type LoggedIn } from '../command-center/helpers'

/**
 * S5-T04 (AC-MUR-2-11): a pupil of a Guru's class checks in "Tertekan" today; the Guru's Command Center "Mood Pelajar" counts 1 for
 * stressed and its drill lists the pupil; the Admin Sekolah "Aktiviti Harian" mood panel counts it for the school and no other school.
 * Fixed clock: Monday 2026-10-19 09:00 +08:00. Uses the real MoodReadAdapter through the Command Center module.
 */
describe('AC-MUR-2-11: a "Tertekan" check-in reaches the Guru Command Center and the Aktiviti Harian mood panel', () => {
  let t: CcTestApp
  let pupilId: string
  let pupilName: string
  let teacher: LoggedIn
  let schoolAdmin: LoggedIn
  let otherSchoolAdmin: LoggedIn
  let schoolId: string

  const guruLive = async (who: LoggedIn) => {
    const res = await getAs(who, '/guru/command-center/live-data')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return CommandCenterGuruLiveDataSchema.parse(res.body)
  }
  const daily = async (who: LoggedIn) => {
    const res = await getAs(who, '/command-center/daily-activity')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return CommandCenterDailyActivityResponseSchema.parse(res.body).data
  }

  beforeAll(async () => {
    t = await bootCommandCenterApp()
    const rows = await t.db.query<{ id: string; code: string }>(`select id::text, code from schools where code in ('DEMO001','DEMO002')`)
    schoolId = rows.find((r) => r.code === 'DEMO001')!.id
    const school2 = rows.find((r) => r.code === 'DEMO002')!.id
    await t.db.query(`update schools set type = 'SMK' where id = $1::bigint`, [school2])
    const teacherId = (await t.db.query<{ id: string }>(`select id::text from users where email = 'guru@demo.test'`))[0]!.id
    pupilName = 'Murid Tertekan'
    const pupil = await createUser(t.db, { role: 'student', schoolId, name: pupilName })
    pupilId = pupil.id
    await enrol(t.db, await createClass(t.db, { teacherId, schoolId, name: 'Kelas Mood', grade: 10 }), pupilId)
    const admin2 = await createUser(t.db, { role: 'school_admin', schoolId: school2, name: 'Admin Sekolah Dua' })
    teacher = await loginRole(t, 'teacher')
    schoolAdmin = await loginRole(t, 'school_admin')
    otherSchoolAdmin = await login(t, admin2.email)
  })
  afterAll(async () => {
    await t.close()
  })

  it('shows nothing before the check-in', async () => {
    expect((await guruLive(teacher)).mood).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 0 })
    expect((await daily(schoolAdmin)).engagement.moodDist).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 0 })
  })

  it('the pupil checks in "tertekan" today by API', async () => {
    const who = await login(t, (await t.db.query<{ email: string }>(`select email from users where id = $1::bigint`, [pupilId]))[0]!.email)
    const res = await who.agent.post('/api/me/mood').set('X-CSRF-Token', who.csrf).send({ mood: 'tertekan' })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    expect(res.body.data).toEqual({ mood: 'tertekan', checkedOn: '2026-10-19' })
  })

  it('Guru Command Center "Mood Pelajar" counts 1 for Tertekan', async () => {
    expect((await guruLive(teacher)).mood).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 1 })
  })

  it('the Mood Pelajar drill lists the pupil, and the stressed filter keeps them while another filter drops them', async () => {
    const all = await getAs(teacher, '/guru/command-center/drill?type=mood')
    expect(all.status, JSON.stringify(all.body)).toBe(200)
    expect(all.body.title).toBe('Mood Pelajar')
    expect(all.body.students).toEqual([{ studentId: pupilId, name: pupilName, mood: 'stressed', date: '2026-10-19', reason: null }])
    const stressed = await getAs(teacher, '/guru/command-center/drill?type=mood&filter=stressed')
    expect(stressed.body.students.map((s: { studentId: string }) => s.studentId)).toEqual([pupilId])
    const happy = await getAs(teacher, '/guru/command-center/drill?type=mood&filter=happy')
    expect(happy.body.students).toEqual([])
  })

  it('the Admin Sekolah "Aktiviti Harian" mood panel counts it for the school', async () => {
    const d = await daily(schoolAdmin)
    expect(d.scope).toBe('school')
    expect(d.school?.id).toBe(schoolId)
    expect(d.engagement.moodCheckins).toBe(1)
    expect(d.engagement.moodDist).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 1 })
  })

  it('and no other school: another school\'s Admin Sekolah sees 0', async () => {
    const d = await daily(otherSchoolAdmin)
    expect(d.school?.id).not.toBe(schoolId)
    expect(d.engagement.moodCheckins).toBe(0)
    expect(d.engagement.moodDist).toEqual({ happy: 0, okay: 0, sad: 0, stressed: 0 })
  })
})
