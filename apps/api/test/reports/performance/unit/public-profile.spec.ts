import { PerformancePublicProfileSchema } from '@pp/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../../src/common/errors/api-error'
import { PUBLIC_PROFILE_FLOOR_MS } from '../../../../src/modules/reports/performance/services/public-profile.service'
import { addPupil, socialWorld, type SocialWorld } from '../fakes/social-world'

let w: SocialWorld

beforeEach(() => {
  w = socialWorld()
  addPupil(w, '1', 'Aina Binti Hassan', 's1')
  w.directory.addPupil({ id: '1', name: 'Aina Binti Hassan', schoolId: 's1', createdAt: new Date('2026-08-26T09:00:00+08:00'), levelName: 'Tingkatan 4' })
  w.directory.addPupil({ id: 't', name: 'Cikgu Ujian', schoolId: 's1', isStudent: false })
  w.directory.addPupil({ id: 'p', name: 'Ibu Bapa Ujian', schoolId: 's1', isStudent: false })
  w.directory.addPupil({ id: 'x', name: 'Murid Tidak Aktif', schoolId: 's1', isActive: false })
  w.directory.addPupil({ id: 'sus', name: 'Murid Digantung', schoolId: 's1', isSuspended: true })
  w.gamification.add('1', {
    syiling: 120,
    level: 3,
    tier: { key: 'perak', name: 'Perak', emoji: 'S', ordinal: 2, progressPct: 40.5, toNext: 80, nextName: 'Emas', nextKey: 'emas' },
    streak: { current: 2, best: 5 },
  })
  w.practice.addSession({ userId: '1', completedAt: new Date('2026-09-22T10:00:00+08:00'), questionCount: 10, correctCount: 8, coins: 10 })
  w.practice.addSession({ userId: '1', completedAt: new Date('2026-09-22T20:00:00+08:00'), questionCount: 10, correctCount: 7, coins: 10 })
  w.practice.addSession({ userId: '1', completedAt: new Date('2026-09-24T10:00:00+08:00'), questionCount: 5, correctCount: 5, coins: 5 })
})

const refusal = async (id: string): Promise<string> => {
  try {
    await w.profile.profile(id)
    return 'no error'
  } catch (e) {
    const err = e as ApiError
    return JSON.stringify({ status: err.getStatus(), code: err.code, message: err.message })
  }
}

describe('Public profile (S18)', () => {
  it('shows the first name only, no school, and the figures of the pupil', async () => {
    const r = await w.profile.profile('1')
    expect(r).toMatchObject({
      id: '1',
      name: 'Aina',
      firstName: 'Aina',
      schoolName: null,
      levelName: 'Tingkatan 4',
      daysWith: 30,
      syiling: 120,
      streak: { current: 2, best: 5 },
      accuracy: 80,
      activity: { sessions: 3, practiceDays: 2, correct: 20, bestStreak: 5 },
      posts: [],
    })
    expect(r.tier).toEqual({ key: 'perak', name: 'Perak', emoji: 'S', level: 3, ordinal: 2, progressPct: 40.5, toNext: 80, nextName: 'Emas', nextKey: 'emas' })
    expect(r.joinedAt).toBe('2026-08-26T09:00:00.000+08:00')
    PerformancePublicProfileSchema.parse(r)
  })

  it('7. unknown, teacher, parent, inactive and suspended users all get the byte-identical 404', async () => {
    const answers = await Promise.all(['999', 't', 'p', 'x', 'sus'].map(refusal))
    expect(answers[0]).toBe(JSON.stringify({ status: 404, code: 'NOT_FOUND', message: 'Not Found.' }))
    expect(new Set(answers).size).toBe(1)
  })

  it('the anonymous profile never lists posts and does not even query the timeline', async () => {
    const post = { id: '5', userId: '1', title: 'Sijil', category: 'sijil' as const, eventDate: null, story: null, photos: [{ url: '/api/files/abc', caption: null }], createdAt: new Date('2026-09-20T10:00:00+08:00') }
    const postsOf = vi.fn(async () => [post])
    w.ports.provideTimeline({ postsOf })
    expect((await w.profile.profile('1')).posts).toEqual([])
    expect(postsOf).not.toHaveBeenCalled()
  })

  describe('response-time floor (L5)', () => {
    afterEach(() => vi.useRealTimers())

    it('holds every outcome, found or refused, until the floor has passed', async () => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'performance'] })
      for (const id of ['1', '999', 'sus']) {
        let settled = false
        const run = w.profile.profile(id).then(
          () => (settled = true),
          () => (settled = true),
        )
        await vi.advanceTimersByTimeAsync(PUBLIC_PROFILE_FLOOR_MS - 1)
        expect(settled, `id ${id} answered before the floor`).toBe(false)
        await vi.advanceTimersByTimeAsync(1)
        await run
        expect(settled).toBe(true)
      }
    })
  })

  it('a pupil without activity gets neutral figures', async () => {
    addPupil(w, '2', 'Bakar Bin Ismail', 's1')
    const r = await w.profile.profile('2')
    expect(r.activity).toEqual({ sessions: 0, practiceDays: 0, correct: 0, bestStreak: 0 })
    expect(r.accuracy).toBe(0)
    expect(r.tier.ordinal).toBe(1)
  })
})
