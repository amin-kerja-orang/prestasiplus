import { PerformanceTimelineSchema } from '@pp/contract'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { ApiError } from '../../../../src/common/errors/api-error'
import { FixedClock } from '../../../../src/db/clock'
import { PerformancePorts } from '../../../../src/modules/reports/performance/ports'
import type { TimelinePostView } from '../../../../src/modules/reports/performance/ports'
import { TimelineService, TIMELINE_FEED_LIMIT } from '../../../../src/modules/reports/performance/timeline/timeline.service'
import { InMemoryAnswerFacts } from '../fakes/in-memory-answer-facts'
import { InMemoryDirectory } from '../fakes/in-memory-directory'
import { InMemoryGamification } from '../fakes/in-memory-gamification'
import { ctxOf, NOW } from '../fakes/fixtures'

/** The feed of `TimelineService.mine` and `remove` on fakes (R1-MUR-39, S10-T08). Names are fictitious. */

const at = (iso: string): Date => new Date(iso)
const post = (id: string, createdAt: string, over: Partial<TimelinePostView> = {}): TimelinePostView => ({
  id,
  userId: '1',
  title: `Catatan ${id}`,
  category: 'cerita',
  eventDate: null,
  story: null,
  photos: [],
  createdAt: at(createdAt),
  ...over,
})

interface RepoFake {
  posts: TimelinePostView[]
  postsOf: ReturnType<typeof vi.fn>
  remove: ReturnType<typeof vi.fn>
}

let facts: InMemoryAnswerFacts
let gami: InMemoryGamification
let directory: InMemoryDirectory
let repo: RepoFake
let discard: ReturnType<typeof vi.fn>
let svc: TimelineService

beforeEach(() => {
  facts = new InMemoryAnswerFacts()
  gami = new InMemoryGamification()
  directory = new InMemoryDirectory().addSubject('SC', '7', 'Sains').addSubject('MAT', '8', 'Matematik')
  const ports = new PerformancePorts(undefined, undefined, undefined, gami, undefined, facts)
  repo = {
    posts: [],
    postsOf: vi.fn(async (userId: string) => repo.posts.filter((p) => p.userId === userId)),
    remove: vi.fn(async () => null),
  }
  discard = vi.fn(async () => undefined)
  const prisma = { transaction: async <T>(fn: () => Promise<T>) => fn() }
  svc = new TimelineService(repo as never, { discard } as never, prisma as never, new FixedClock(NOW), ports, directory)
})

const student = ctxOf('student', '1')

describe('Timeline feed (mine)', () => {
  it('merges a session, a badge and a post, newest first, and parses against the contract', async () => {
    facts.addMany('1', 4, 3, { mode: 'latih_tubi', subjectId: '7', sessionId: 'sA', answeredAt: at('2026-10-23T20:06:00+08:00') })
    gami.addBadge('1', { key: 'pemula', name: 'Pemula', icon: '🏅', earnedAt: at('2026-10-23T21:00:00+08:00') })
    repo.posts = [post('5', '2026-10-23T18:00:00+08:00')]
    const r = await svc.mine(student)
    expect(r.entries.map((e) => e.kind)).toEqual(['badge', 'session', 'post'])
    expect(r.entries[1]).toEqual({ kind: 'session', id: 's:sA', at: '2026-10-23T20:06:00.000+08:00', subjectName: 'Sains', correct: 3, answered: 4, accuracy: 75 })
    expect(r.entries[0]).toMatchObject({ kind: 'badge', name: 'Pemula', icon: '🏅', at: '2026-10-23T21:00:00.000+08:00' })
    expect(r.posts).toHaveLength(1)
    expect(r.profileUrl).toBe('/pelajar/1')
    expect(PerformanceTimelineSchema.safeParse(r).success).toBe(true)
  })

  it('a post is placed by createdAt, not by its back-dated event date', async () => {
    facts.addMany('1', 2, 1, { mode: 'latih_tubi', subjectId: '7', sessionId: 'sA', answeredAt: at('2026-10-23T10:00:00+08:00') })
    repo.posts = [post('5', '2026-10-24T09:00:00+08:00', { eventDate: '2025-01-01' })]
    expect((await svc.mine(student)).entries.map((e) => e.kind)).toEqual(['post', 'session'])
  })

  it('ties on the same instant go badge, post, session, then by id, whatever order the sources return', async () => {
    const t = '2026-10-23T20:00:00+08:00'
    facts.add({ userId: '1', mode: 'latih_tubi', subjectId: '7', isCorrect: true, answeredAt: at(t), sessionId: 'sB' })
    facts.add({ userId: '1', mode: 'latih_tubi', subjectId: '7', isCorrect: true, answeredAt: at(t), sessionId: 'sA' })
    gami.addBadge('1', { key: 'b2', name: 'Dua', icon: '', earnedAt: at(t) })
    gami.addBadge('1', { key: 'b1', name: 'Satu', icon: '', earnedAt: at(t) })
    repo.posts = [post('9', t), post('10', t)]
    const ids = (await svc.mine(student)).entries.map((e) => `${e.kind}:${e.id}`)
    expect(ids).toEqual(['badge:b:b1', 'badge:b:b2', 'post:10', 'post:9', 'session:s:sA', 'session:s:sB'])
    expect((await svc.mine(student)).entries.map((e) => `${e.kind}:${e.id}`)).toEqual(ids)
  })

  it('MYT day boundary: a 23:30 and a 00:30 sessionless run are two sessions on two days, with +08:00 times', async () => {
    facts.add({ userId: '1', mode: 'latih_tubi', subjectId: '7', isCorrect: true, answeredAt: at('2026-10-23T23:30:00+08:00') })
    facts.add({ userId: '1', mode: 'latih_tubi', subjectId: '7', isCorrect: false, answeredAt: at('2026-10-24T00:30:00+08:00') })
    const r = await svc.mine(student)
    expect(r.entries.map((e) => [e.id, e.at.slice(0, 16)])).toEqual([
      ['n:latih_tubi:2026-10-24', '2026-10-24T00:30'],
      ['n:latih_tubi:2026-10-23', '2026-10-23T23:30'],
    ])
  })

  it('leaves out game modes and test rows, and never shows another pupil', async () => {
    facts.addMany('1', 3, 3, { mode: 'battle', subjectId: '7', sessionId: 'g1', answeredAt: at('2026-10-23T10:00:00+08:00') })
    facts.addMany('1', 3, 3, { mode: 'game', subjectId: '7', sessionId: 'g2', answeredAt: at('2026-10-23T11:00:00+08:00') })
    facts.addMany('1', 3, 3, { mode: 'latih_tubi', subjectId: '7', sessionId: 't1', answeredAt: at('2026-10-23T12:00:00+08:00'), isTest: true })
    facts.addMany('2', 3, 3, { mode: 'latih_tubi', subjectId: '7', sessionId: 'o1', answeredAt: at('2026-10-23T13:00:00+08:00') })
    gami.addBadge('2', { key: 'lain', name: 'Orang Lain', icon: '', earnedAt: at('2026-10-23T13:00:00+08:00') })
    repo.posts = [post('77', '2026-10-23T13:00:00+08:00', { userId: '2' })]
    const r = await svc.mine(student)
    expect(r.entries).toEqual([])
    expect(r.posts).toEqual([])
  })

  it('accuracy is the whole percent, rounded half up; an unknown subject has an empty name', async () => {
    facts.addMany('1', 8, 5, { mode: 'simulasi', subjectId: '99', sessionId: 'sX', answeredAt: at('2026-10-23T10:00:00+08:00') })
    const [e] = (await svc.mine(student)).entries
    expect(e).toMatchObject({ kind: 'session', correct: 5, answered: 8, accuracy: 63, subjectName: '' })
  })

  it('cuts the merged feed at 100 rows, newest kept', async () => {
    for (let i = 0; i < 120; i++) {
      const minute = String(i % 60).padStart(2, '0')
      const hour = String(8 + Math.floor(i / 60)).padStart(2, '0')
      repo.posts.push(post(String(i + 1), `2026-10-23T${hour}:${minute}:00+08:00`))
    }
    const r = await svc.mine(student)
    expect(r.entries).toHaveLength(TIMELINE_FEED_LIMIT)
    expect(r.entries[0]?.id).toBe('120')
    expect(r.posts).toHaveLength(120)
  })
})

describe('Timeline delete (remove)', () => {
  it('deletes an own post and discards its photo files after the commit', async () => {
    repo.remove.mockResolvedValueOnce({ filePublicIds: ['f1', 'f2'] })
    expect(await svc.remove(student, '5')).toEqual({ deleted: 1 })
    expect(repo.remove).toHaveBeenCalledWith('1', '5', false)
    expect(discard.mock.calls).toEqual([
      ['f1', 'timeline_photo'],
      ['f2', 'timeline_photo'],
    ])
  })

  it('another pupil\'s post and an unknown id are the same 404, and no file is touched', async () => {
    const answer = async (id: string): Promise<string> => {
      try {
        await svc.remove(student, id)
        return 'no error'
      } catch (e) {
        const err = e as ApiError
        return JSON.stringify({ status: err.getStatus(), code: err.code, message: err.message })
      }
    }
    const [other, unknown] = [await answer('5'), await answer('999999')]
    expect(JSON.parse(other)).toMatchObject({ status: 404, code: 'NOT_FOUND' })
    expect(other).toBe(unknown)
    expect(discard).not.toHaveBeenCalled()
  })

  it('a teacher gets 403 and the repository is never asked', async () => {
    await expect(svc.remove(ctxOf('teacher', 't1'), '5')).rejects.toMatchObject({ code: 'FORBIDDEN' })
    expect(repo.remove).not.toHaveBeenCalled()
  })

  it('an admin in Mod Pelajar deletes only test posts (the flag is passed on)', async () => {
    repo.remove.mockResolvedValueOnce({ filePublicIds: [] })
    await svc.remove({ ...ctxOf('admin', 'a1'), isTest: true }, '5')
    expect(repo.remove).toHaveBeenCalledWith('a1', '5', true)
  })
})
