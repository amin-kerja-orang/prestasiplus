/**
 * M16-T1: the battle endpoints (SRS M16 v1.6 §7 #2-#17, #21): start, simulated matchmaking and its polling
 * contract (§7.1), invitations, join requests, forfeit and the provisional arena. Booted with the real core
 * and M01-M05, M14 and M16 at the project clock (2026-09-25 15:40 MYT); the clock is frozen, so
 * time-based rules advance it explicitly. Tests share one runtime and run in order.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { users } from '@/modules/m01-authentication/mock'
import { questions } from '@/modules/m04-question-bank/mock'

import { battles } from '../../mock'
import { m16Hooks } from '../../mock/hooks'
import {
  belowT4Student,
  bootM16,
  MemoryStorage,
  setUser,
  type Answer,
  type Booted,
} from './helpers'

const ADMIN = 1
const T4_STUDENT = 2 // grade 10, SPM unlocked
const D5_STUDENT = 3 // grade 10 (D72: was Darjah 5), no school
const D1_STUDENT = 4 // grade 11 (D72: was Darjah 1), school 900001
const MATEMATIK = 3

let booted: Booted

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  booted = await bootM16()
}, 600_000)

afterAll(async () => {
  await booted.runtime.reset()
  vi.unstubAllGlobals()
}, 600_000)

async function call<T = unknown>(
  method: 'GET' | 'POST',
  url: string,
  as: number | null,
  body?: unknown,
): Promise<Answer<T>> {
  const headers: Record<string, string> = { accept: 'application/json' }
  if (as !== null) headers.authorization = `Bearer ${setUser(as).token}`
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await booted.runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}

const get = <T>(url: string, as: number | null) => call<T>('GET', url, as)
const post = <T>(url: string, as: number | null, body?: unknown) => call<T>('POST', url, as, body)

type Poll = {
  status: string
  battle_uuid?: string
  challenger?: { name: string; grade_label: string; school: string }
}

const biasa = { question_type: 'biasa', open_to_all: false, subject_id: MATEMATIK }

async function startQueue(
  as: number,
  body: unknown = biasa,
  kind = 'quick-match',
): Promise<number> {
  const r = await post<{ queue_id: number }>(`/api/battle/${kind}`, as, body)
  expect(r.status).toBe(200)
  return r.body.queue_id
}

const poll = (as: number, queueId: number) =>
  get<Poll>(`/api/battle/poll-match/${String(queueId)}`, as)

/** Polls until `matched` (the default 3rd poll) and returns the battle uuid. */
async function match(as: number, queueId: number): Promise<string> {
  let last: Poll = { status: '' }
  for (let i = 0; i < 4 && last.status !== 'matched'; i++) last = (await poll(as, queueId)).body
  expect(last.status).toBe('matched')
  return last.battle_uuid as string
}

describe('access', () => {
  it.each([
    ['POST', '/api/battle/quick-match'],
    ['POST', '/api/battle/school-battle'],
    ['GET', '/api/battle/poll-match/1'],
    ['POST', '/api/battle/accept-challenger/1'],
    ['POST', '/api/battle/reject-challenger/1'],
    ['POST', '/api/battle/queue/1/cancel'],
    ['GET', '/api/battle/search-opponent?q=ab'],
    ['POST', '/api/battle/invite'],
    ['GET', '/api/battle/invitations'],
    ['POST', '/api/battle/invite/x/accept'],
    ['POST', '/api/battle/invite/x/decline'],
    ['POST', '/api/battle/join-queue/1'],
    ['GET', '/api/battle/poll-challenger/1'],
    ['POST', '/api/battle/forfeit/x'],
    ['GET', '/api/battle/lobby'],
    ['GET', '/api/battle/arena/x'],
    ['POST', '/api/battle/arena/x/answer'],
    ['GET', '/api/battle/history'],
  ] as const)('%s %s answers 401 without a session', async (method, url) => {
    expect((await call(method, url, null)).status).toBe(401)
  })
})

describe('#15 lobby', () => {
  it('serves 31 subjects and 15 PKSK domains; the SPM list only from Tingkatan 4', async () => {
    const d5 = await get<{ data: Record<string, unknown> }>('/api/battle/lobby', belowT4Student())
    expect(d5.status).toBe(200)
    expect(d5.body.data).toMatchObject({ grade: 9, gradeLabel: 'Tingkatan 3', spmUnlocked: false })
    expect((d5.body.data.subjects as { id: number; core: boolean }[]).length).toBe(31)
    expect(
      (d5.body.data.subjects as { id: number; core: boolean }[])
        .filter((s) => s.core)
        .map((s) => s.id),
    ).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect((d5.body.data.pkskDomains as unknown[]).length).toBe(15)
    expect(d5.body.data).not.toHaveProperty('spmSubjects')

    const t4 = await get<{
      data: { spmUnlocked: boolean; gradeLabel: string; spmSubjects: { id: number }[] }
    }>('/api/battle/lobby', T4_STUDENT)
    expect(t4.body.data).toMatchObject({ spmUnlocked: true, gradeLabel: 'Tingkatan 4' })
    expect(t4.body.data.spmSubjects.length).toBeGreaterThan(0)
  })
})

describe('#2 / #3 start (BR-M16-03)', () => {
  it('answers 422 with an empty body for invalid parameters', async () => {
    for (const body of [
      {},
      { question_type: 'biasa', open_to_all: false },
      { question_type: 'biasa', open_to_all: false, subject_id: 99 },
      { question_type: 'pksk', open_to_all: false, pksk_domain_id: 3 },
      { question_type: 'pksk', open_to_all: false, pksk_domain_id: 16, pksk_target_level: 'T1' },
      { question_type: 'zzz', open_to_all: false },
    ]) {
      const r = await post('/api/battle/quick-match', D5_STUDENT, body)
      expect([r.status, r.body], JSON.stringify(body)).toEqual([422, {}])
    }
  })

  it('answers 422 for a pool with fewer than 10 questions', async () => {
    const r = await post('/api/battle/quick-match', D5_STUDENT, {
      question_type: 'biasa',
      open_to_all: false,
      subject_id: 17, // Sains Komputer: no objective question at Tingkatan 4 / 5
    })
    expect([r.status, r.body]).toEqual([422, {}])
  })

  it('answers 403 {} for SPM below Tingkatan 4 and accepts it from Tingkatan 4', async () => {
    const lobby = await get<{ data: { spmSubjects: { id: number }[] } }>(
      '/api/battle/lobby',
      T4_STUDENT,
    )
    const spm = {
      question_type: 'spm',
      open_to_all: false,
      subject_id: lobby.body.data.spmSubjects[0]?.id,
    }
    const denied = await post('/api/battle/quick-match', belowT4Student(), spm)
    expect([denied.status, denied.body]).toEqual([403, {}])
    expect(
      (await post<{ queue_id: number }>('/api/battle/quick-match', T4_STUDENT, spm)).status,
    ).toBe(200)
  })

  it('creates a queue for a PKSK battle', async () => {
    const r = await post<{ queue_id: number }>('/api/battle/quick-match', D5_STUDENT, {
      question_type: 'pksk',
      open_to_all: true,
      pksk_domain_id: 2,
      pksk_target_level: 'T1',
    })
    expect(r.status).toBe(200)
    expect(r.body.queue_id).toBeGreaterThan(0)
  })
})

describe('#4 poll-match (BR-M16-04/05, §7.1)', () => {
  it("answers not_found for id 0 and for another user's queue", async () => {
    expect((await poll(D5_STUDENT, 0)).body).toEqual({ status: 'not_found' })
    const q = await startQueue(D5_STUDENT)
    expect((await poll(D1_STUDENT, q)).body).toEqual({ status: 'not_found' })
  })

  it("matches a bot of the owner's grade on the 3rd poll, with the owner as player A", async () => {
    const q = await startQueue(D5_STUDENT)
    expect((await poll(D5_STUDENT, q)).body).toEqual({ status: 'waiting' })
    expect((await poll(D5_STUDENT, q)).body).toEqual({ status: 'waiting' })
    const m = (await poll(D5_STUDENT, q)).body
    expect(m.status).toBe('matched')
    const battle = battles.get(m.battle_uuid as string)
    expect(battle).toMatchObject({
      playerA: D5_STUDENT,
      status: 'active',
      mode: 'quick_match',
      questionType: 'biasa',
      subjectId: MATEMATIK,
    })
    expect(battle?.questionIds).toHaveLength(10)
    expect(battle?.playerB).not.toBe(D5_STUDENT)
    // The same uuid on every later poll.
    expect((await poll(D5_STUDENT, q)).body).toEqual(m)
  })

  it('a school battle draws an opponent of another school', async () => {
    const q = await startQueue(
      D1_STUDENT,
      { question_type: 'biasa', open_to_all: true, subject_id: MATEMATIK },
      'school-battle',
    )
    const uuid = await match(D1_STUDENT, q)
    const b = battles.get(uuid)
    expect(b?.schoolBId).not.toBeNull()
    expect(b?.schoolBId).not.toBe(b?.schoolAId)
    expect(b?.mode).toBe('school_battle')
  })

  it('an abandoned queue (no poll for 10 s) expires and is never matched', async () => {
    const q = await startQueue(D5_STUDENT)
    booted.clock.advance(11_000)
    expect((await poll(D5_STUDENT, q)).body).toEqual({ status: 'expired' })
    expect((await poll(D5_STUDENT, q)).body).toEqual({ status: 'expired' })
  })

  it('expires 120 s after creation when polled every 9 s without a match', async () => {
    m16Hooks.battleSim({ mode: 'never' })
    const q = await startQueue(D5_STUDENT)
    let last = ''
    for (let i = 0; i < 14 && last !== 'expired'; i++) {
      booted.clock.advance(9_000)
      last = (await poll(D5_STUDENT, q)).body.status
      if (i < 12) expect(last).toBe('waiting')
    }
    expect(last).toBe('expired')
  })

  it('the battleSim hook forces expired, not_found and error:<status> on the next queue only', async () => {
    m16Hooks.battleSim({ mode: 'expired' })
    const a = await startQueue(D5_STUDENT)
    expect((await poll(D5_STUDENT, a)).body).toEqual({ status: 'expired' })
    m16Hooks.battleSim({ mode: 'not_found' })
    const b = await startQueue(D5_STUDENT)
    expect((await poll(D5_STUDENT, b)).body).toEqual({ status: 'not_found' })
    m16Hooks.battleSim({ mode: 'error:500' })
    const c = await startQueue(D5_STUDENT)
    expect((await poll(D5_STUDENT, c)).status).toBe(500)
    const d = await startQueue(D5_STUDENT)
    await poll(D5_STUDENT, d)
    await poll(D5_STUDENT, d)
    expect((await poll(D5_STUDENT, d)).body.status).toBe('matched')
  })

  it('battleSim validates its input', () => {
    expect(() => m16Hooks.battleSim({ mode: 'bogus' })).toThrow(RangeError)
    expect(() => m16Hooks.battleSim({ mode: 'match', afterPolls: 0 })).toThrow(RangeError)
    expect(() => m16Hooks.battleSim({ mode: 'network' })).toThrow(/networkErrorNext/)
  })

  it('afterPolls moves the matching poll', async () => {
    m16Hooks.battleSim({ mode: 'match', afterPolls: 1 })
    const q = await startQueue(D5_STUDENT)
    expect((await poll(D5_STUDENT, q)).body.status).toBe('matched')
  })
})

describe('#5 / #6 incoming challenger', () => {
  it('shows the challenger on the 2nd poll; "Terima" matches with that opponent', async () => {
    m16Hooks.battleSim({ mode: 'incoming' })
    const q = await startQueue(D5_STUDENT)
    expect((await poll(D5_STUDENT, q)).body).toEqual({ status: 'waiting' })
    const inc = (await poll(D5_STUDENT, q)).body
    expect(inc.status).toBe('incoming_challenge')
    expect(Object.keys(inc.challenger ?? {}).sort()).toEqual(['grade_label', 'name', 'school'])
    // Polling continues to show the challenge.
    expect((await poll(D5_STUDENT, q)).body.status).toBe('incoming_challenge')
    const acc = await post<{ matched: boolean; battle_uuid: string }>(
      `/api/battle/accept-challenger/${String(q)}`,
      D5_STUDENT,
    )
    expect(acc.status).toBe(200)
    expect(acc.body.matched).toBe(true)
    expect(battles.get(acc.body.battle_uuid)?.playerA).toBe(D5_STUDENT)
    expect((await poll(D5_STUDENT, q)).body).toEqual({
      status: 'matched',
      battle_uuid: acc.body.battle_uuid,
    })
  })

  it('"Tolak" returns to waiting; the next bot comes on the 3rd poll after that', async () => {
    m16Hooks.battleSim({ mode: 'incoming' })
    const q = await startQueue(D5_STUDENT)
    await poll(D5_STUDENT, q)
    expect((await poll(D5_STUDENT, q)).body.status).toBe('incoming_challenge')
    const rej = await post(`/api/battle/reject-challenger/${String(q)}`, D5_STUDENT)
    expect([rej.status, rej.body]).toEqual([200, { success: true }])
    expect((await poll(D5_STUDENT, q)).body.status).toBe('waiting')
    expect((await poll(D5_STUDENT, q)).body.status).toBe('waiting')
    expect((await poll(D5_STUDENT, q)).body.status).toBe('matched')
  })

  it('API-GAME-14 cancel: 200 once and again, then the entry is gone; matched or foreign is 404', async () => {
    const q = await startQueue(D5_STUDENT)
    const url = `/api/battle/queue/${String(q)}/cancel`
    expect((await post(url, D1_STUDENT)).status).toBe(404)
    const first = await post<{ data: unknown }>(url, D5_STUDENT)
    expect([first.status, first.body.data]).toEqual([200, { cancelled: true }])
    expect((await post(url, D5_STUDENT)).status).toBe(200)
    expect((await post('/api/battle/queue/0/cancel', D5_STUDENT)).status).toBe(404)
  })

  it('answers 404 {error} for a queue without a challenger or of another user', async () => {
    const q = await startQueue(D5_STUDENT)
    const a = await post<{ error: string }>(
      `/api/battle/accept-challenger/${String(q)}`,
      D5_STUDENT,
    )
    expect(a.status).toBe(404)
    expect(typeof a.body.error).toBe('string')
    expect((await post(`/api/battle/accept-challenger/${String(q)}`, D1_STUDENT)).status).toBe(404)
    expect((await post('/api/battle/reject-challenger/0', D5_STUDENT)).status).toBe(404)
  })
})

describe('#7 search-opponent (BR-M16-11, FR-GM-01.6: own school only)', () => {
  type Found = { users: { id: number; name: string; school: string; avatar: string | null }[] }

  it('needs 2 characters, lists own-school students A to Z (at most 10) and not the viewer', async () => {
    expect((await get('/api/battle/search-opponent?q=a', T4_STUDENT)).body).toEqual({ users: [] })
    expect((await get('/api/battle/search-opponent', T4_STUDENT)).body).toEqual({ users: [] })
    const term = (users.get(D1_STUDENT)?.name ?? '').slice(0, 4).toLowerCase()
    const r = await get<Found>(`/api/battle/search-opponent?q=${encodeURIComponent(term)}`, T4_STUDENT)
    expect(r.status).toBe(200)
    expect(r.body.users.length).toBeGreaterThan(0)
    expect(r.body.users.length).toBeLessThanOrEqual(10)
    // Same school only: every hit is a pupil of school 900001, and D1_STUDENT is among them.
    expect(r.body.users.every((u) => users.get(u.id)?.schoolId === 900001)).toBe(true)
    expect(r.body.users.some((u) => u.id === D1_STUDENT)).toBe(true)
    const names = r.body.users.map((u) => u.name)
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b)))
    expect(Object.keys(r.body.users[0] as object).sort()).toEqual([
      'avatar',
      'id',
      'name',
      'school',
    ])
    expect(r.body.users.some((u) => u.id === T4_STUDENT)).toBe(false)
  })

  it('a pupil with no school finds nobody', async () => {
    const r = await get<Found>('/api/battle/search-opponent?q=Murid%20Demo', D5_STUDENT)
    expect(r.body).toEqual({ users: [] })
  })
})

describe('#7 search-opponent over a large school (BR-M16-11)', () => {
  it('takes the first 10 A to Z of every own-school name match; e-mail-only hits use no slot', async () => {
    const term = 'an'
    const viewer = 5990 // school 8102, 776 pupils
    const home = users.get(viewer)?.schoolId
    expect(home).toBe(8102)
    const all = users
      .search(term, { role: 'student', limit: Number.MAX_SAFE_INTEGER })
      .filter(
        (u) => u.id !== viewer && u.schoolId === home && u.name.toLowerCase().includes(term),
      )
    expect(all.length).toBeGreaterThan(10)
    const expected = all
      .sort((a, b) => a.name.localeCompare(b.name) || a.id - b.id)
      .slice(0, 10)
      .map((u) => u.id)
    const r = await get<{ users: { id: number }[] }>(
      `/api/battle/search-opponent?q=${term}`,
      viewer,
    )
    expect(r.body.users.map((u) => u.id)).toEqual(expected)
  })
})

describe('#17 a correct answer at exactly 15 s (BR-M16-07)', () => {
  it('scores 500, s runs 0-15 inclusive', async () => {
    const uuid = await match(D5_STUDENT, await startQueue(D5_STUDENT))
    const q = (
      await get<{ data: { question: { id: number } } }>(`/api/battle/arena/${uuid}`, D5_STUDENT)
    ).body.data.question
    const key = [0, 1, 2, 3].find((o) => questions.gradeAnswer(q.id, o)?.isCorrect) as number
    const r = await post<{ data: Record<string, unknown> }>(
      `/api/battle/arena/${uuid}/answer`,
      D5_STUDENT,
      { questionId: q.id, optionId: key, seconds: 15 },
    )
    expect(r.status).toBe(200)
    // The answer carries no key and no correctness (ruling 45): both come from the reveal.
    expect(r.body.data).toMatchObject({ accepted: true, phase: 'reveal' })
    expect(Object.keys(r.body.data)).not.toContain('correct')
    const view = await get<{
      data: { phase: string; reveal: { you: { correct: boolean; points: number } } }
    }>(`/api/battle/arena/${uuid}`, D5_STUDENT)
    expect(view.body.data.phase).toBe('reveal')
    expect(view.body.data.reveal.you).toMatchObject({ correct: true, points: 500 })
  })
})

describe('#8-#11 invitations (BR-M16-06)', () => {
  it('stores an invitation; the receiver lists it, accepts and the sender is player A', async () => {
    const sent = await post('/api/battle/invite', T4_STUDENT, { ...biasa, receiver_id: D1_STUDENT })
    expect([sent.status, sent.body]).toEqual([200, { success: true }])
    const list = await get<{
      invitations: { uuid: string; sender_name: string; sender_school: string }[]
    }>('/api/battle/invitations', D1_STUDENT)
    expect(list.body.invitations).toHaveLength(1)
    expect(Object.keys(list.body.invitations[0] as object).sort()).toEqual([
      'sender_name',
      'sender_school',
      'uuid',
    ])
    expect(
      (await get<{ invitations: unknown[] }>('/api/battle/invitations', T4_STUDENT)).body
        .invitations,
    ).toEqual([])
    const uuid = (list.body.invitations[0] as { uuid: string }).uuid
    // Only the receiver may answer.
    expect((await post(`/api/battle/invite/${uuid}/accept`, T4_STUDENT)).status).toBe(404)
    const acc = await post<{ success: boolean; battle_uuid: string }>(
      `/api/battle/invite/${uuid}/accept`,
      D1_STUDENT,
    )
    expect(acc.status).toBe(200)
    expect(acc.body.success).toBe(true)
    expect(battles.get(acc.body.battle_uuid)).toMatchObject({
      playerA: T4_STUDENT,
      playerB: D1_STUDENT,
      mode: 'challenge',
    })
    // Answered once.
    expect((await post(`/api/battle/invite/${uuid}/accept`, D1_STUDENT)).status).toBe(404)
    expect(
      (await get<{ invitations: unknown[] }>('/api/battle/invitations', D1_STUDENT)).body
        .invitations,
    ).toEqual([])
  })

  it('"Tolak" declines; an invitation older than 24 h is no longer listed', async () => {
    await post('/api/battle/invite', T4_STUDENT, { ...biasa, receiver_id: D1_STUDENT })
    const first = (
      await get<{ invitations: { uuid: string }[] }>('/api/battle/invitations', D1_STUDENT)
    ).body.invitations
    expect(first).toHaveLength(1)
    const dec = await post(
      `/api/battle/invite/${(first[0] as { uuid: string }).uuid}/decline`,
      D1_STUDENT,
    )
    expect([dec.status, dec.body]).toEqual([200, { success: true }])
    expect(
      (await get<{ invitations: unknown[] }>('/api/battle/invitations', D1_STUDENT)).body
        .invitations,
    ).toEqual([])

    await post('/api/battle/invite', T4_STUDENT, { ...biasa, receiver_id: D1_STUDENT })
    booted.clock.advance(25 * 3_600_000)
    expect(
      (await get<{ invitations: unknown[] }>('/api/battle/invitations', D1_STUDENT)).body
        .invitations,
    ).toEqual([])
  })

  it('refuses an unknown receiver, a non-student, the sender itself and an unknown uuid', async () => {
    for (const receiver_id of [999_999, 1, D5_STUDENT, 'x']) {
      const r = await post<{ error: string }>('/api/battle/invite', D5_STUDENT, {
        ...biasa,
        receiver_id,
      })
      expect(r.status, String(receiver_id)).toBe(422)
      expect(typeof r.body.error).toBe('string')
    }
    expect((await post('/api/battle/invite/nope/decline', D5_STUDENT)).status).toBe(404)
    expect((await post('/api/battle/invite/nope/accept', D5_STUDENT)).status).toBe(404)
  })

  it('refuses a receiver of another school or with no school (own school only)', async () => {
    for (const [sender, receiver_id] of [
      [T4_STUDENT, D5_STUDENT], // receiver has no school
      [T4_STUDENT, 5990], // receiver is in school 8102
      [D5_STUDENT, T4_STUDENT], // sender has no school
    ] as const) {
      const r = await post<{ error: string }>('/api/battle/invite', sender, {
        ...biasa,
        receiver_id,
      })
      expect([r.status, r.body.error], `${String(sender)}>${String(receiver_id)}`).toEqual([
        422,
        'Penerima tidak sah.',
      ])
    }
  })

  it('an expired invitation answers the receiver "Cabaran tamat tempoh."', async () => {
    await post('/api/battle/invite', T4_STUDENT, { ...biasa, receiver_id: D1_STUDENT })
    const id = (
      await get<{ invitations: { uuid: string }[] }>('/api/battle/invitations', D1_STUDENT)
    ).body.invitations[0]?.uuid as string
    booted.clock.advance(25 * 3_600_000)
    const r = await post<{ error: string }>(`/api/battle/invite/${id}/accept`, D1_STUDENT)
    expect([r.status, r.body]).toEqual([404, { error: 'Cabaran tamat tempoh.' }])
  })

  it('the invite takes question_count (5, 10, 15, 20) and refuses any other value', async () => {
    const bad = await post<{ error: string }>('/api/battle/invite', T4_STUDENT, {
      ...biasa,
      receiver_id: D1_STUDENT,
      question_count: 7,
    })
    expect([bad.status, bad.body.error]).toEqual([422, 'Nilai di luar julat.'])
    const ok = await post('/api/battle/invite', T4_STUDENT, {
      ...biasa,
      receiver_id: D1_STUDENT,
      question_count: 5,
    })
    expect(ok.status).toBe(200)
    const id = (
      await get<{ invitations: { uuid: string }[] }>('/api/battle/invitations', D1_STUDENT)
    ).body.invitations[0]?.uuid as string
    const acc = await post<{ battle_uuid: string }>(`/api/battle/invite/${id}/accept`, D1_STUDENT)
    expect(battles.get(acc.body.battle_uuid)).toMatchObject({ questionCount: 5 })
    expect(battles.get(acc.body.battle_uuid)?.questionIds).toHaveLength(5)
  })

  it('the invitation fixture is a pending invitation from 4301', async () => {
    m16Hooks.m16Fixture('invitation', { viewerId: D1_STUDENT })
    const list = await get<{ invitations: { sender_name: string; sender_school: string }[] }>(
      '/api/battle/invitations',
      D1_STUDENT,
    )
    expect(list.body.invitations).toHaveLength(1)
    expect(list.body.invitations[0]?.sender_name).toBe('Murid Demo 4301')
    expect(list.body.invitations[0]?.sender_school).not.toBe('')
  })
})

describe('#12 / #13 join request and its decision (DV-M16-06)', () => {
  it('a join request on a waiting queue reaches the owner as an incoming challenger', async () => {
    m16Hooks.battleSim({ mode: 'never' })
    const q = await startQueue(D5_STUDENT)
    const j = await post(`/api/battle/join-queue/${String(q)}`, D1_STUDENT)
    expect([j.status, j.body]).toEqual([200, { success: true }])
    expect((await get<Poll>(`/api/battle/poll-challenger/${String(q)}`, D1_STUDENT)).body).toEqual({
      status: 'waiting',
    })
    const inc = (await poll(D5_STUDENT, q)).body
    expect(inc.status).toBe('incoming_challenge')
    expect(inc.challenger?.name).toBe('Pelajar Maju Demo')
    const acc = await post<{ battle_uuid: string }>(
      `/api/battle/accept-challenger/${String(q)}`,
      D5_STUDENT,
    )
    expect(acc.status).toBe(200)
    const decided = (await get<Poll>(`/api/battle/poll-challenger/${String(q)}`, D1_STUDENT)).body
    expect(decided).toEqual({ status: 'matched', battle_uuid: acc.body.battle_uuid })
    expect(battles.get(acc.body.battle_uuid)).toMatchObject({
      playerA: D5_STUDENT,
      playerB: D1_STUDENT,
    })
  })

  it('answers 404 {error} for an unknown queue or your own queue', async () => {
    const own = await startQueue(D5_STUDENT)
    for (const [id, who] of [
      [0, D5_STUDENT],
      [own, D5_STUDENT],
    ] as const) {
      const r = await post<{ error: string }>(`/api/battle/join-queue/${String(id)}`, who)
      expect([r.status, r.body]).toEqual([404, { error: 'Ralat menghantar permohonan.' }])
    }
  })

  it('the battleWaiting hook reaches matched, rejected and expired', async () => {
    const pollWho = async (queueId: number) =>
      (await get<Poll>(`/api/battle/poll-challenger/${String(queueId)}`, D5_STUDENT)).body
    const matched = m16Hooks.battleWaiting({
      targetUserId: 4301,
      outcome: 'matched',
      viewerId: D5_STUDENT,
    })
    const m = await pollWho(matched.queueId)
    expect(m.status).toBe('matched')
    expect(battles.get(m.battle_uuid as string)).toMatchObject({
      playerA: 4301,
      playerB: D5_STUDENT,
    })
    expect(
      (
        await pollWho(
          m16Hooks.battleWaiting({ targetUserId: 4301, outcome: 'rejected', viewerId: D5_STUDENT })
            .queueId,
        )
      ).status,
    ).toBe('rejected')
    expect(
      (
        await pollWho(
          m16Hooks.battleWaiting({ targetUserId: 4301, outcome: 'expired', viewerId: D5_STUDENT })
            .queueId,
        )
      ).status,
    ).toBe('expired')
    expect((await pollWho(0)).status).toBe('not_found')
    expect(() => m16Hooks.battleWaiting({ targetUserId: 4301, outcome: 'x' as 'matched' })).toThrow(
      RangeError,
    )
  })

  it("a stranger polling someone else's join request gets not_found", async () => {
    const q = m16Hooks.battleWaiting({
      targetUserId: 4301,
      outcome: 'matched',
      viewerId: D5_STUDENT,
    })
    expect(
      (await get<Poll>(`/api/battle/poll-challenger/${String(q.queueId)}`, D1_STUDENT)).body,
    ).toEqual({ status: 'not_found' })
  })
})

describe('#16 / #17 arena (BR-M16-07/08, PROVISIONAL), #14 forfeit, #21 history', () => {
  let uuid = ''

  it('serves the arena to its players only, without answer keys', async () => {
    uuid = await match(D5_STUDENT, await startQueue(D5_STUDENT))
    const r = await get<{ data: Record<string, unknown> }>(`/api/battle/arena/${uuid}`, D5_STUDENT)
    expect(r.status).toBe(200)
    expect(r.body.data).toMatchObject({
      uuid,
      status: 'active',
      you: 'A',
      index: 1,
      total: 10,
      secondsLeft: 15,
      scores: { A: 0, B: 0 },
    })
    const q = r.body.data.question as {
      id: number
      text: string
      options: { id: number; label: string; text: string }[]
    }
    expect(q.options.map((o) => o.label)).toEqual(['A', 'B', 'C', 'D'])
    expect(JSON.stringify(q)).not.toMatch(/correct|isCorrect|explanation/i)
    expect((await get(`/api/battle/arena/${uuid}`, D1_STUDENT)).status).toBe(404)
    expect(
      (await get('/api/battle/arena/00000000-0000-4000-8000-0000000000ff', D5_STUDENT)).status,
    ).toBe(404)
  })

  it('refuses answers for the wrong question, out-of-range values and strangers', async () => {
    const q = (
      await get<{ data: { question: { id: number } } }>(`/api/battle/arena/${uuid}`, D5_STUDENT)
    ).body.data.question
    const url = `/api/battle/arena/${uuid}/answer`
    expect(
      (await post(url, D5_STUDENT, { questionId: q.id + 1, optionId: 0, seconds: 1 })).status,
    ).toBe(422)
    expect(
      (await post(url, D5_STUDENT, { questionId: q.id, optionId: 7, seconds: 1 })).status,
    ).toBe(422)
    expect(
      (await post(url, D5_STUDENT, { questionId: q.id, optionId: 0, seconds: 16 })).status,
    ).toBe(422)
    expect(
      (await post(url, D5_STUDENT, { questionId: q.id, optionId: 0, seconds: -1 })).status,
    ).toBe(422)
    expect(
      (await post(url, D1_STUDENT, { questionId: q.id, optionId: 0, seconds: 1 })).status,
    ).toBe(404)
  })

  it('plays 10 rounds: answer carries no key; the reveal shows it; points 1000 - round(500 s / 15)', async () => {
    type View = {
      data: {
        phase: 'answering' | 'reveal' | 'finished'
        index: number
        total: number
        question: { id: number } | null
        secondsLeft: number
        roundEndsAt?: string
        youAnswered?: boolean
        scores: { A: number; B: number }
        reveal?: {
          index: number
          correctOptionId: number
          you: { optionId: number | null; correct: boolean; points: number }
          opponent: { correct: boolean; points: number }
        }
        result?: { winner: 'A' | 'B' | null; scoreA: number; scoreB: number }
      }
    }
    type Ans = {
      data: {
        accepted: boolean
        phase: string
        roundEndsAt?: string
        result?: { winner: 'A' | 'B' | null; scoreA: number; scoreB: number }
      }
    }
    const keyOf = (id: number): number =>
      [0, 1, 2, 3].find((o) => questions.gradeAnswer(id, o)?.isCorrect) as number
    const view = () => get<View>(`/api/battle/arena/${uuid}`, D5_STUDENT)
    let current = (await view()).body.data.question?.id as number
    let mine = 0
    let last: Ans['data'] | undefined
    for (let i = 1; i <= 10; i++) {
      // Odd questions: the key after i seconds; even ones: a wrong option after 1 s (0 points).
      const right = i % 2 === 1
      const key = keyOf(current)
      const res = await post<Ans>(`/api/battle/arena/${uuid}/answer`, D5_STUDENT, {
        questionId: current,
        optionId: right ? key : (key + 1) % 4,
        seconds: right ? i : 1,
      })
      expect(res.status, `question ${String(i)}`).toBe(200)
      last = res.body.data
      // The answer is only accepted: no key, no correctness, no next question (ruling 45).
      expect(Object.keys(last).sort()).toEqual(
        i < 10 ? ['accepted', 'phase', 'roundEndsAt'] : ['accepted', 'phase', 'result'],
      )
      expect(last.accepted).toBe(true)
      const expected = right ? 1000 - Math.round((500 * i) / 15) : 0
      mine += expected
      if (i === 10) break
      expect(last.phase).toBe('reveal')
      // The reveal carries the key, both picks and points; the round stays on screen for 3 s.
      const rev = (await view()).body.data
      expect(rev).toMatchObject({ phase: 'reveal', index: i, total: 10, youAnswered: true })
      expect(rev.roundEndsAt).toBe(last.roundEndsAt)
      expect(rev.secondsLeft).toBe(0)
      expect(rev.reveal).toMatchObject({
        index: i,
        correctOptionId: key,
        you: { correct: right, points: expected },
      })
      expect(rev.reveal?.opponent.points).toBeGreaterThanOrEqual(0)
      expect(rev.scores.A).toBe(mine)
      expect(rev.question?.id).toBe(current)
      // Before the reveal ends the round is not over; 3 s later the next round opens.
      booted.clock.advance(2_000)
      expect((await view()).body.data.phase).toBe('reveal')
      booted.clock.advance(1_000)
      const next = (await view()).body.data
      expect(next).toMatchObject({
        phase: 'answering',
        index: i + 1,
        youAnswered: false,
        secondsLeft: 15,
      })
      expect(next.reveal).toBeUndefined()
      expect(next.question?.id).not.toBe(current)
      current = next.question?.id as number
    }
    const result = (last as Ans['data']).result as {
      winner: string | null
      scoreA: number
      scoreB: number
    }
    const opponent = result.scoreB
    expect(result).toMatchObject({ scoreA: mine })
    expect(result.winner).toBe(mine > opponent ? 'A' : mine < opponent ? 'B' : null)
    const done = battles.get(uuid)
    expect(done).toMatchObject({
      status: 'finished',
      answered: 10,
      scoreA: mine,
      scoreB: opponent,
      correctA: 5,
    })
    expect(done?.finishedAt).not.toBeNull()
    expect(
      (
        await post(`/api/battle/arena/${uuid}/answer`, D5_STUDENT, {
          questionId: 1,
          optionId: 0,
          seconds: 1,
        })
      ).status,
    ).toBe(409)
    const after = (await view()).body.data
    expect(after).toMatchObject({ phase: 'finished', secondsLeft: 0, question: null })
    expect(after.result?.winner).toBe(result.winner)
    expect(after.reveal?.index).toBe(10)
  })

  it('the answering countdown follows the round clock (secondsLeft counts N only; roundEndsAt adds the grace)', async () => {
    const id = await match(D5_STUDENT, await startQueue(D5_STUDENT))
    const v0 = (await get<{ data: { secondsLeft: number; roundEndsAt: string } }>(`/api/battle/arena/${id}`, D5_STUDENT)).body.data
    expect(v0.secondsLeft).toBe(15)
    booted.clock.advance(6_000)
    const v1 = (await get<{ data: { secondsLeft: number; roundEndsAt: string } }>(`/api/battle/arena/${id}`, D5_STUDENT)).body.data
    expect(v1.secondsLeft).toBe(9)
    expect(v1.roundEndsAt).toBe(v0.roundEndsAt)
    // 15 s question + 3 s grace after the round opened.
    expect(Date.parse(v0.roundEndsAt) - booted.clock.now() + 6_000).toBe(18_000)
    booted.clock.advance(17_000)
    expect(
      (await get<{ data: { secondsLeft: number } }>(`/api/battle/arena/${id}`, D5_STUDENT)).body.data
        .secondsLeft,
    ).toBe(0)
  })

  it('a timeout (null option) scores 0; with the opponent also on 0 the battle is a draw (48 GAME-01)', async () => {
    const id = await match(D1_STUDENT, await startQueue(D1_STUDENT))
    let q = (
      await get<{ data: { question: { id: number } } }>(`/api/battle/arena/${id}`, D1_STUDENT)
    ).body.data.question.id
    let last:
      | { data: { result?: { winner: string | null; scoreA: number; scoreB: number } } }
      | undefined
    for (let i = 1; i <= 10; i++) {
      const res = await post<NonNullable<typeof last>>(
        `/api/battle/arena/${id}/answer`,
        D1_STUDENT,
        { questionId: q, optionId: null, seconds: 15 },
      )
      expect(res.status).toBe(200)
      last = res.body
      if (i < 10) {
        booted.clock.advance(3_000)
        q = (
          await get<{ data: { question: { id: number } } }>(`/api/battle/arena/${id}`, D1_STUDENT)
        ).body.data.question.id
      }
    }
    const r = last?.data.result
    expect(r?.scoreA).toBe(0)
    // Higher total wins; 0-0 is "Seri" now, no longer player B.
    expect(r?.winner).toBe(r && r.scoreB > 0 ? 'B' : null)
  })

  it('forfeit: the opponent wins; a second forfeit is 409; strangers and unknown uuids 404', async () => {
    const id = await match(D5_STUDENT, await startQueue(D5_STUDENT))
    expect((await post(`/api/battle/forfeit/${id}`, D1_STUDENT)).status).toBe(404)
    expect((await post('/api/battle/forfeit/nope', D5_STUDENT)).status).toBe(404)
    const f = await post(`/api/battle/forfeit/${id}`, D5_STUDENT)
    expect([f.status, f.body]).toEqual([200, { success: true }])
    expect(battles.get(id)).toMatchObject({ status: 'forfeited', winner: 'B' })
    expect((await post(`/api/battle/forfeit/${id}`, D5_STUDENT)).status).toBe(409)
  })

  it('#21 history lists the finished and forfeited battles of the viewer, newest first', async () => {
    const r = await get<{
      data: {
        uuid: string
        playerA: { id: number; name: string; homeHere: boolean }
        scoreA: number
        scoreB: number
        winner: string | null
        createdAt: string
      }[]
    }>('/api/battle/history', D5_STUDENT)
    expect(r.status).toBe(200)
    expect(r.body.data.length).toBeGreaterThanOrEqual(2)
    const times = r.body.data.map((b) => Date.parse(b.createdAt))
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(r.body.data.every((b) => b.playerA.id === D5_STUDENT || b.uuid !== '')).toBe(true)
    expect(battles.countOf(D5_STUDENT)).toBe(r.body.data.length)
    // The admin has none (S5 empty state).
    expect((await get('/api/battle/history', ADMIN)).body).toEqual({ data: [] })
  })

  it('setBattleScores sets the scores of a finished battle and the winner follows', () => {
    const id = battles.all().find((b) => !b.seeded && b.status === 'finished')?.id as string
    m16Hooks.setBattleScores(id, { a: 500, b: 100 })
    expect(battles.get(id)).toMatchObject({ scoreA: 500, scoreB: 100, winner: 'A' })
    expect(() => m16Hooks.setBattleScores('nope', { a: 1, b: 2 })).toThrow()
  })
})

describe('GAME-01 start: question_count, daily limit, school, robot', () => {
  it('question_count (5, 10, 15, 20) sets the battle total; absent is 10; other values are 422 {}', async () => {
    for (const count of [5, 15]) {
      const id = await match(
        D5_STUDENT,
        await startQueue(D5_STUDENT, { ...biasa, question_count: count }),
      )
      const v = await get<{ data: { total: number; index: number } }>(
        `/api/battle/arena/${id}`,
        D5_STUDENT,
      )
      expect(v.body.data).toMatchObject({ total: count, index: 1 })
      expect(battles.get(id)?.questionIds).toHaveLength(count)
    }
    const dflt = await match(D5_STUDENT, await startQueue(D5_STUDENT))
    expect(
      (await get<{ data: { total: number } }>(`/api/battle/arena/${dflt}`, D5_STUDENT)).body.data
        .total,
    ).toBe(10)
    for (const bad of [7, 0, '10', null]) {
      const r = await post('/api/battle/quick-match', D5_STUDENT, { ...biasa, question_count: bad })
      expect([r.status, r.body], String(bad)).toEqual([422, {}])
    }
  })

  it('a matched poll carries robot: true only for a robot battle (battleSim robot), and seat B is "isBot"', async () => {
    m16Hooks.battleSim({ mode: 'match', robot: true })
    const q = await startQueue(D5_STUDENT)
    const r = await match(D5_STUDENT, q)
    expect((await poll(D5_STUDENT, q)).body).toMatchObject({
      status: 'matched',
      battle_uuid: r,
      robot: true,
    })
    const v = await get<{ data: { players: { B: { isBot?: boolean }; A: { isBot?: boolean } } } }>(
      `/api/battle/arena/${r}`,
      D5_STUDENT,
    )
    expect(v.body.data.players.B.isBot).toBe(true)
    expect(v.body.data.players.A.isBot).toBeUndefined()
    // A normal match has no robot flag.
    const q2 = await startQueue(D5_STUDENT)
    await match(D5_STUDENT, q2)
    expect((await poll(D5_STUDENT, q2)).body).not.toHaveProperty('robot')
    expect(() => m16Hooks.battleSim({ mode: 'never', robot: true })).toThrow(RangeError)
  })

  it('Battle Sekolah with no school answers 422 {}', async () => {
    const r = await post('/api/battle/school-battle', D5_STUDENT, biasa)
    expect([r.status, r.body]).toEqual([422, {}])
  })

  it('the 21st Quick Match or Battle Sekolah of a MYT day answers 429 BATTLE_DAILY_LIMIT; the next day resets', async () => {
    const viewer = 5989 // school 8102; no earlier queue in this file
    let started = 0
    for (; started < 20; started++) {
      const r = await post('/api/battle/quick-match', viewer, biasa)
      if (r.status !== 200) break
    }
    expect(started).toBe(20)
    const over = await post<{ error: { code: string; message: string; retryAfter: number } }>(
      '/api/battle/quick-match',
      viewer,
      biasa,
    )
    expect(over.status).toBe(429)
    expect(over.body.error).toMatchObject({
      code: 'BATTLE_DAILY_LIMIT',
      message: 'Had battle hari ini telah dicapai. Cuba lagi esok.',
    })
    expect(over.body.error.retryAfter).toBeGreaterThan(0)
    expect((await post('/api/battle/school-battle', viewer, biasa)).status).toBe(429)
    booted.clock.advance(24 * 3_600_000)
    expect((await post('/api/battle/quick-match', viewer, biasa)).status).toBe(200)
  })
})
