/**
 * S10-T09 (API-RPT-08): `GET /api/headcounts/me` and `/me/detail`: the pupil's own configs and own line only,
 * a foreign or unknown configId is 404, staff are 403, and the school admin lists the school scope.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import type { MockRuntime } from '@/mock/index'
import { classrooms } from '@/modules/m10-teacher-class/mock'

import type { HeadcountListItem, HeadcountStudent } from '../../api/headcount-types'
import { headcount } from '../../mock'
import { MemoryStorage, bootM08 } from './boot'
import { ADMIN, ADMIN_SEKOLAH, GURU, call, data, type ErrorBody } from './headcount-helpers'

let runtime: MockRuntime
/** A pupil of the class-516 anchors (BM / BI / MATH / SCI configs). */
const PUPIL = 3201

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  runtime = (await bootM08()).runtime
}, 180_000)
afterAll(() => {
  vi.unstubAllGlobals()
})

const get = <T>(as: number | null, url: string) => data<T>(runtime, as, 'GET', url)
const send = (as: number | null, url: string) => call<ErrorBody>(runtime, as, 'GET', url)

describe('GET /api/headcounts/me', () => {
  it('lists exactly the configs of the pupil own classes, with the own pill and the teacher name', async () => {
    const list = await get<HeadcountListItem[]>(PUPIL, '/api/headcounts/me')
    const expected = headcount
      .configs()
      .filter(
        (c) =>
          classrooms.memberIds('classroom', c.classroomId).includes(PUPIL) &&
          !headcount.entriesOfStudent(PUPIL).some((e) => e.configId === c.id && e.dropped),
      )
      .map((c) => c.id)
    expect(list.length).toBeGreaterThan(0)
    expect(list.map((i) => i.id).sort((a, b) => a - b)).toEqual(expected.sort((a, b) => a - b))
    for (const item of list) {
      expect(['active', 'draft']).toContain(item.entryStatus)
      // Draft = no ETR: always "Belum Ada Data"; Active never carries that reason.
      if (item.entryStatus === 'draft') expect(item.statusReason).toBe('belum_ada_data')
      else expect(item.statusReason).not.toBe('belum_ada_data')
      expect(item.teacherName).not.toBe('')
    }
  })

  it('a pupil who is in no configured class gets an empty list and an empty detail', async () => {
    const members = new Set(
      headcount.configs().flatMap((c) => classrooms.memberIds('classroom', c.classroomId)),
    )
    const lonely = [2, 3, 4, 7].find((id) => !members.has(id))
    if (lonely === undefined) return
    expect(await get<HeadcountListItem[]>(lonely, '/api/headcounts/me')).toEqual([])
    expect((await get<HeadcountStudent>(lonely, '/api/headcounts/me/detail')).sections).toEqual([])
  })

  it.each([
    ['admin', ADMIN],
    ['guru', GURU],
    ['admin sekolah', ADMIN_SEKOLAH],
  ])('%s is 403', async (_n, id) => {
    expect((await send(id, '/api/headcounts/me')).status).toBe(403)
    expect((await send(id, '/api/headcounts/me/detail')).status).toBe(403)
  })

  it('no session is 401', async () => {
    expect((await send(null, '/api/headcounts/me')).status).toBe(401)
  })

  it('the school admin lists the school scope on /api/headcounts with the teacher name (read-only)', async () => {
    const list = await get<HeadcountListItem[]>(ADMIN_SEKOLAH, '/api/headcounts')
    expect(list.length).toBeGreaterThan(0)
    expect(list.every((i) => i.teacherName !== '')).toBe(true)
  })
})

describe('GET /api/headcounts/me/detail', () => {
  it('without configId: own line of one config, no classmate data', async () => {
    const d = await get<HeadcountStudent>(PUPIL, '/api/headcounts/me/detail')
    expect(d.student.id).toBe(PUPIL)
    expect(d.sections).toHaveLength(1)
  })

  it('with an own configId: that config only', async () => {
    const list = await get<HeadcountListItem[]>(PUPIL, '/api/headcounts/me')
    for (const item of list) {
      const d = await get<HeadcountStudent>(PUPIL, `/api/headcounts/me/detail?configId=${String(item.id)}`)
      expect(d.sections.map((s) => s.configId)).toEqual([item.id])
      expect(d.sections[0]?.entryStatus).toBe(item.entryStatus)
      if (item.entryStatus === 'draft') expect(d.sections[0]?.statusReason).toBe('belum_ada_data')
    }
  })

  it('an unknown or foreign configId is 404, never 403', async () => {
    const own = new Set((await get<HeadcountListItem[]>(PUPIL, '/api/headcounts/me')).map((i) => i.id))
    const foreign = headcount.configs().find((c) => !own.has(c.id))
    expect(foreign).toBeDefined()
    expect((await send(PUPIL, `/api/headcounts/me/detail?configId=${String(foreign?.id)}`)).status).toBe(404)
    expect((await send(PUPIL, '/api/headcounts/me/detail?configId=99999')).status).toBe(404)
    expect((await send(PUPIL, '/api/headcounts/me/detail?configId=abc')).status).toBe(404)
  })
})
