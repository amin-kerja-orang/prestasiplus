import { CommandCenterGuruAchievementsSchema, CommandCenterGuruBadgeHoldersSchema, CommandCenterGuruLiveDataSchema } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { BADGE_READ_PORT, type BadgeReadPort } from '../../src/modules/command-center'
import { bootCommandCenterApp, buildWorld, type CcTestApp, expectError, getAs, loginRole, type LoggedIn, type World } from './helpers'

let t: CcTestApp
let w: World
let teacher: LoggedIn
let empty: CcTestApp
let emptyTeacher: LoggedIn

/** A fake badge store: badge 1 held by two of the teacher's pupils and by the foreign pupil, badge 2 by nobody. */
function fakePort(getWorld: () => World): BadgeReadPort {
  return {
    async catalogue() {
      return [
        { id: '1', name: 'Pemula', icon: 'star' },
        { id: '2', name: 'Juara', icon: 'trophy' },
      ]
    },
    async awards(ids, opts) {
      const wd = getWorld()
      const all = [
        { userId: wd.pupils[0] as string, badgeId: '1', awardedAt: new Date('2026-10-19T08:30:00.000+08:00') },
        { userId: wd.pupils[1] as string, badgeId: '1', awardedAt: new Date('2026-10-10T08:30:00.000+08:00') },
        { userId: wd.otherPupil, badgeId: '1', awardedAt: new Date('2026-10-19T08:00:00+08:00') },
      ]
      return all.filter((a) => (ids === null || ids.includes(a.userId)) && (opts?.badgeId === undefined || a.badgeId === opts.badgeId))
    },
  }
}

beforeAll(async () => {
  t = await bootCommandCenterApp({ overrides: [{ token: BADGE_READ_PORT, useValue: fakePort(() => w) }] })
  w = await buildWorld(t)
  teacher = await loginRole(t, 'teacher')
  empty = await bootCommandCenterApp()
  await buildWorld(empty)
  emptyTeacher = await loginRole(empty, 'teacher')
})
afterAll(async () => {
  await t.close()
  await empty.close()
})

describe('badge-holders with the empty badge port', () => {
  it('a valid id is an unknown badge: 404 with the BM message', async () => {
    for (const id of ['1', '7', '999999']) expectError(await getAs(emptyTeacher, `/guru/command-center/badge-holders?badgeId=${id}`), 'NOT_FOUND', 'Lencana tidak dijumpai.')
  })

  it('a bad or missing id is 422 fields.badgeId', async () => {
    for (const q of ['', '?badgeId=', '?badgeId=0', '?badgeId=-1', '?badgeId=abc', '?badgeId=1.5', '?badgeId=01', '?badgeId=1&badgeId=2']) {
      const err = expectError(await getAs(emptyTeacher, `/guru/command-center/badge-holders${q}`), 'VALIDATION_ERROR', 'Lencana tidak sah.')
      expect(err.fields).toEqual({ badgeId: 'Lencana tidak sah.' })
    }
  })
})

describe('badges with a populated port', () => {
  it('achievements: catalogue, colours by holders, collectors and today\'s awards, own pupils only', async () => {
    const res = await getAs(teacher, '/guru/command-center/achievements')
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    const body = CommandCenterGuruAchievementsSchema.parse(res.body)
    expect(body.totalStudents).toBe(3)
    expect(body.badgeStats).toEqual([
      { id: '1', name: 'Pemula', icon: 'star', color: '#a855f7', holders: 2 },
      { id: '2', name: 'Juara', icon: 'trophy', color: '#f59e0b', holders: 0 },
    ])
    expect(body.topCollectors).toEqual([
      { name: 'Murid 1', count: 1 },
      { name: 'Murid 2', count: 1 },
    ])
    expect(body.totalNew).toBe(1)
    expect(body.newAwards).toEqual([{ studentId: w.pupils[0], name: 'Murid 1', badgeName: 'Pemula', icon: 'star', awardedAt: '2026-10-19T08:30:00.000+08:00' }])
  })

  it('badge-holders: only the viewer\'s pupils, with accuracy, ordered by award time', async () => {
    const body = CommandCenterGuruBadgeHoldersSchema.parse((await getAs(teacher, '/guru/command-center/badge-holders?badgeId=1')).body)
    expect(body.badge).toEqual({ name: 'Pemula', description: '' })
    expect(body.holders.map((h) => h.studentId)).toEqual([w.pupils[1], w.pupils[0]])
    expect(body.holders[0]).toMatchObject({ name: 'Murid 2', accuracy: 67 })
    expect(JSON.stringify(body)).not.toContain(w.otherPupil)
    const none = CommandCenterGuruBadgeHoldersSchema.parse((await getAs(teacher, '/guru/command-center/badge-holders?badgeId=2')).body)
    expect(none.holders).toEqual([])
    expectError(await getAs(teacher, '/guru/command-center/badge-holders?badgeId=3'), 'NOT_FOUND', 'Lencana tidak dijumpai.')
  })

  it('live-data recentBadges lists the latest awards newest first', async () => {
    const body = CommandCenterGuruLiveDataSchema.parse((await getAs(teacher, '/guru/command-center/live-data')).body)
    expect(body.recentBadges.map((b) => b.student)).toEqual(['Murid 1', 'Murid 2'])
    expect(body.recentBadges[0]).toMatchObject({ badge: 'Pemula', icon: 'star', awardedAt: '2026-10-19T08:30:00.000+08:00' })
  })
})
