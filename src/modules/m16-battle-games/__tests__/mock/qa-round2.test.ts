/**
 * M16 L26 G5 round 2 (QA): AC-M16-26.1 (SOURCE counts, M04 ids, session prefixes) and the AC-M16-40.x contracts
 * (M14 `onGameResult` once with `coinsCredited`, Q-ANS-ALL unchanged, the M11 reader counts, M01/M02 totals
 * unchanged). Booted like the other M16 mock tests; user ids as in `game-handlers.test.ts`.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { users } from '@/modules/m01-authentication/mock'
import { schools } from '@/modules/m02-users-schools/mock'
import { questions } from '@/modules/m04-question-bank/mock'
import { practiceAnswers } from '@/modules/m05-practice/mock'
import { gamification } from '@/modules/m14-gamification/mock'
import { ledger } from '@/modules/m14-gamification/mock/hooks'

import { battles, gameResults } from '../../mock'
import { m16Hooks } from '../../mock/hooks'
import { keyOf } from '../../mock/repository/games-common'
import { bootM16, MemoryStorage, setUser, type Answer, type Booted } from './helpers'

const ADMIN = 1
const D5_STUDENT = 3
const D1_STUDENT = 4
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
  as: number,
  body?: unknown,
): Promise<Answer<T>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${setUser(as).token}`,
  }
  if (body !== undefined) headers['content-type'] = 'application/json'
  const res = await booted.runtime.transport.request({
    method,
    url,
    headers,
    ...(body !== undefined ? { body } : {}),
  })
  return { status: res.status, body: res.body as T }
}

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any
const get = <T = Any>(url: string, as: number) => call<T>('GET', url, as)
const post = <T = Any>(url: string, as: number, body?: unknown) => call<T>('POST', url, as, body)

describe('QA round 2: AC-M16-26.1 payloads', () => {
  it('serves 40 / 30 / 30 / <=20 / 12 items, every item id is an M04 question, with the game session prefix', async () => {
    const data = async (game: string, q = '?darjah=4') =>
      (await get<{ data: Any }>(`/api/games/solo/${game}${q}`, D5_STUDENT)).body.data
    const bs = await data('betul-salah')
    const ck = await data('cabaran-kilat')
    const tj = await data('tembak-jawapan')
    const sj = await data('susun-jawapan')
    const km = await data('kad-memori', '')
    expect(bs.sessionId).toMatch(/^tf_/)
    expect(ck.sessionId).toMatch(/^speed_/)
    expect(tj.sessionId).toMatch(/^shoot_/)
    expect(sj.sessionId).toMatch(/^ws_/)
    expect(km.sessionId).toMatch(/^mem_/)
    const counts = {
      betulSalah: bs.statements.length,
      cabaranKilat: ck.questions.length,
      tembakJawapan: tj.questions.length,
      susunJawapan: sj.puzzles.length,
      kadMemori: km.cards.length,
    }
    // eslint-disable-next-line no-console
    console.log('QA-R2-26.1 counts', JSON.stringify(counts))
    expect(counts).toMatchObject({ betulSalah: 40, cabaranKilat: 30, tembakJawapan: 30, kadMemori: 12 })
    expect(counts.susunJawapan).toBeGreaterThan(0)
    expect(counts.susunJawapan).toBeLessThanOrEqual(20)
    const ids: number[] = [
      ...bs.statements.map((s: Any) => s.id),
      ...ck.questions.map((s: Any) => s.id),
      ...tj.questions.map((s: Any) => s.id),
    ]
    expect(ids.length).toBe(100)
    for (const id of ids) expect(questions.get(id), `M04 question ${String(id)}`).toBeDefined()
    // eslint-disable-next-line no-console
    console.log('QA-R2-26.1 susun puzzle ids', JSON.stringify(sj.puzzles.map((p: Any) => p.id ?? null)).slice(0, 120))
  })
})

describe('QA round 2: AC-M16-40.x cross-module contracts', () => {
  it('40.1 / 40.3 / 40.2 / 40.4: one battle and two games: onGameResult once each, readers count them, Q-ANS-ALL and M01/M02 totals unchanged', async () => {
    const answersBefore = practiceAnswers.count('Q-ANS-ALL')
    const usersBefore = users.count('U-ALL')
    const schoolsBefore = schools.count('S-ALL')
    expect(answersBefore).toBe(478_499)
    expect(usersBefore).toBe(5_159)
    expect(schoolsBefore).toBe(10_220)
    const far = { from: 0, to: Date.now() + 10 ** 13 }
    const battlesBefore = battles.countFor([D1_STUDENT], far).get(D1_STUDENT)?.count ?? 0
    const gamesBefore = gameResults.countFor([D1_STUDENT], far).get(D1_STUDENT)?.count ?? 0

    // The M14 settings pay game syiling only while the setting is on (fixture, as the Roda Nasib test does).
    m16Hooks.m16Fixture('settingCoins')
    const student = D1_STUDENT
    const can = gamification.canEarnSyiling(student)
    // eslint-disable-next-line no-console
    console.log('QA-R2-40.1 canEarnSyiling(user 4) =', can)

    // Game 1 and 2: two single-player submits: exactly one M14 credit each, equal to the displayed syiling.
    const credits: { game: string; displayed: number; ledgerRows: number }[] = []
    for (const game of ['cabaran-kilat', 'tembak-jawapan'] as const) {
      const rowsBefore = ledger(student).length
      const s = (await get<{ data: Any }>(`/api/games/solo/${game}?darjah=4`, student)).body.data
      const body =
        game === 'cabaran-kilat'
          ? { session_id: s.sessionId, correct_count: 4, total_answered: 5, max_combo: 4, score: 100, syiling_earned: 1 }
          : { session_id: s.sessionId, correct_count: 6, total_answered: 8, max_level: 2, score: 60, syiling_earned: 1 }
      const r = await post<Any>(`/api/games/solo/${game}/submit`, student, body)
      expect([r.status, JSON.stringify(r.body)]).toEqual([200, expect.any(String)])
      const rows = ledger(student)
      credits.push({ game, displayed: r.body.syiling_awarded, ledgerRows: rows.length - rowsBefore })
      if (can) {
        expect(rows.length - rowsBefore).toBe(1) // once per result
        expect(rows[0]?.amount).toBe(r.body.syiling_awarded) // the displayed syiling is what M14 credited
        expect(r.body.syiling_awarded).toBe(1)
      } else {
        expect(rows.length - rowsBefore).toBe(0)
        expect(r.body.syiling_awarded).toBe(0)
      }
    }
    // eslint-disable-next-line no-console
    console.log('QA-R2-40.1 solo credits', JSON.stringify(credits))

    // One battle: quick match, then forfeit (a finished and reported battle).
    const q = await post<{ queue_id: number }>('/api/battle/quick-match', student, {
      question_type: 'biasa',
      open_to_all: false,
      subject_id: MATEMATIK,
    })
    expect(q.status).toBe(200)
    let uuid = ''
    for (let i = 0; i < 4 && uuid === ''; i++) {
      const p = await get<Any>(`/api/battle/poll-match/${String(q.body.queue_id)}`, student)
      if (p.body.status === 'matched') uuid = p.body.battle_uuid
    }
    expect(uuid).not.toBe('')
    expect((await post(`/api/battle/forfeit/${uuid}`, student)).status).toBe(200)

    // M11 reader port: +1 battle, +2 games for the student; M05 / M01 / M02 totals unchanged.
    expect(battles.countFor([student], far).get(student)?.count).toBe(battlesBefore + 1)
    expect(gameResults.countFor([student], far).get(student)?.count).toBe(gamesBefore + 2)
    expect(practiceAnswers.count('Q-ANS-ALL')).toBe(answersBefore)
    expect(users.count('U-ALL')).toBe(usersBefore)
    expect(schools.count('S-ALL')).toBe(schoolsBefore)
  })

  it('the anchor users and schools of M16 exist as listed in 40.4', () => {
    for (const id of [4301, 4302, 4320, 4377, 4401]) expect(users.get(id), `user ${String(id)}`).toBeDefined()
    expect(users.get(4351)).toBeDefined() // listed as excluded from the anchor range, but it is an M01 row
    for (const id of [2710, 8078, 8080, 8082, 8090, 8106, 8880, 900]) {
      expect(schools.get(id), `school ${String(id)}`).toBeDefined()
    }
    expect(ADMIN).toBe(1)
  })
})

describe('QA round 2: AC-M16-19.3 a won room raises my wins in the lobby Pendahulu and the S29 Selesai count', () => {
  it('Benteng Ilmu: answering every question correctly wins; "Pendahulu" gains my row with 1 menang and /api/admin/games finished rises by 1', async () => {
    const student = D5_STUDENT
    const game = 'benteng-ilmu'
    const roomPath = (code: string, tail = '') => `/api/games/${game}/rooms/${code}${tail}`
    const leaders = async (): Promise<Any[]> =>
      (await get<{ data: Any }>(`/api/games/${game}/lobby`, student)).body.data.leaders
    const finished = async (): Promise<number> =>
      (await get<Any>('/api/admin/games', ADMIN)).body.data.stats.finished
    const mine = (rows: Any[]) => rows.find((l) => l.userId === student)?.value ?? 0
    for (const g of ['perang-fakta', 'benteng-ilmu', 'perlumbaan-matematik', 'kuiz-relay', 'teka-silang-kata']) {
      const rows = (await get<{ data: Any }>(`/api/games/${g}/lobby`, student)).body.data.leaders
      // eslint-disable-next-line no-console
      console.log('QA-R2-19.3 lobby rows', g, rows.length, 'min value', Math.min(...rows.map((r: Any) => r.value)))
    }
    const beforeRows = await leaders()
    const finishedBefore = await finished()
    const created = await post<{ data: { code: string } }>(`/api/games/${game}/rooms`, student, {
      subject: 'SAINS',
      grade_level: 'DARJAH_5',
      match_mode: 'same_level',
    })
    expect(created.status).toBe(201)
    const code = created.body.data.code
    for (let i = 0; i < 5; i++) await get(roomPath(code), student)
    const started = await post<{ data: Any }>(roomPath(code, '/start'), student)
    expect(started.status).toBe(200)
    let room = started.body.data
    for (let i = 0; i < 100 && room.status === 'playing'; i++) {
      const q = room.question
      const key = keyOf(q.id)
      expect(key).not.toBeNull()
      const r = await post<{ data: Any }>(roomPath(code, '/action'), student, {
        type: 'answer',
        questionId: q.id,
        optionId: key!.index,
        seconds: 1,
      })
      expect(r.status).toBe(200)
      room = r.body.data
    }
    expect(room.status).toBe('finished')
    // eslint-disable-next-line no-console
    console.log('QA-R2-19.3 result', JSON.stringify(room.result))
    expect(room.result.winnerId).toBe(student)
    const afterRows = await leaders()
    const finishedAfter = await finished()
    // eslint-disable-next-line no-console
    console.log(
      'QA-R2-19.3 pendahulu rows',
      beforeRows.length,
      '->',
      afterRows.length,
      '| mine',
      mine(beforeRows),
      '->',
      mine(afterRows),
      '| finished',
      finishedBefore,
      '->',
      finishedAfter,
    )
    expect(mine(afterRows)).toBe(mine(beforeRows) + 1)
    expect(finishedAfter).toBe(finishedBefore + 1)
  })
})
