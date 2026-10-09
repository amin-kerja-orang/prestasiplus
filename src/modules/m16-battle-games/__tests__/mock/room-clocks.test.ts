/**
 * M16-T4 fix: the room clocks run on the server (SRS M16 v1.6 BR-M16-20, §7 #26 / #28): Perang Fakta 15
 * rounds of 10 s, Teka Silang Kata 5 minutes. `roundSecondsLeft` / `secondsLeft` are relative to the mock
 * clock; expired time is resolved lazily and idempotently on the poll (#26) and before an action (#28);
 * `optionId: null` is the explicit no-vote. Same boot as the T2 tests (real core, M01-M05, M07, M14, M16),
 * the clock moved with `booted.clock.advance`.
 */

import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

import { bootM16, MemoryStorage, setUser, type Answer, type Booted } from './helpers'

const HOST = 2 // grade 10

let booted: Booted

beforeAll(async () => {
  vi.stubGlobal('localStorage', new MemoryStorage())
  booted = await bootM16()
}, 300_000)

afterAll(async () => {
  await booted.runtime.reset()
  vi.unstubAllGlobals()
})

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any
interface Data<T> {
  data: T
}

async function call<T = unknown>(
  method: 'GET' | 'POST',
  url: string,
  body?: unknown,
): Promise<Answer<T>> {
  const headers: Record<string, string> = {
    accept: 'application/json',
    authorization: `Bearer ${setUser(HOST).token}`,
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

const getJson = <T>(url: string) => call<T>('GET', url)
const postJson = <T>(url: string, body: unknown) => call<T>('POST', url, body)

const roomPath = (game: string, code: string, tail = '') =>
  `/api/games/${game}/rooms/${code}${tail}`

const forms: Record<string, Any> = {
  'perang-fakta': { subject: 'SEJARAH', grade_level: 'TINGKATAN_4', match_mode: 'same_level' },
  'teka-silang-kata': {
    subject: 'BAHASA_INGGERIS',
    grade_level: 'TINGKATAN_4',
    match_mode: 'same_level',
  },
}

/** Creates a room, polls until the bot is in, starts it; returns the started view. */
async function startGame(game: string): Promise<Any> {
  const created = await postJson<Data<{ code: string }>>(`/api/games/${game}/rooms`, forms[game])
  expect(created.status).toBe(201)
  const code = created.body.data.code
  for (let i = 0; i < 3; i++) await getJson(roomPath(game, code))
  const r = await postJson<Data<Any>>(roomPath(game, code, '/start'), {})
  expect(r.status).toBe(200)
  return r.body.data
}

const view = async (game: string, code: string): Promise<Any> =>
  (await getJson<Data<Any>>(roomPath(game, code))).body.data

const advance = (seconds: number) => booted.clock.advance(seconds * 1000)

describe('Perang Fakta round clock (10 s a round)', () => {
  it('starts a round at 10 s and counts down on the server clock; a reload does not reset it', async () => {
    const started = await startGame('perang-fakta')
    expect(started.state.round).toBe(1)
    expect(started.state.roundSecondsLeft).toBe(10)
    advance(4)
    const a = await view('perang-fakta', started.code)
    expect(a.state.round).toBe(1)
    expect(a.state.roundSecondsLeft).toBe(6)
    // "Reload": a fresh read later continues from the same start, it does not restart the round.
    advance(3)
    const b = await view('perang-fakta', started.code)
    expect(b.state.roundSecondsLeft).toBe(3)
    expect(await view('perang-fakta', started.code)).toEqual(b) // idempotent at the same time
  })

  it('advances a round that is 10 s old as a no-vote on the poll (the host scored nothing)', async () => {
    const started = await startGame('perang-fakta')
    advance(10)
    const v = await view('perang-fakta', started.code)
    expect(v.state.round).toBe(2)
    expect(v.state.roundSecondsLeft).toBe(10)
    expect(v.question.id).not.toBe(started.question.id)
    expect(v.players.find((p: Any) => p.id === HOST).points).toBe(0)
    expect(await view('perang-fakta', started.code)).toEqual(v)
  })

  it('resolves several elapsed rounds after a long absence', async () => {
    const started = await startGame('perang-fakta')
    advance(35) // rounds 1-3 expired, round 4 is 5 s old
    const v = await view('perang-fakta', started.code)
    expect(v.state.round).toBe(4)
    expect(v.state.roundSecondsLeft).toBe(5)
  })

  it('a host who never comes back: all 15 rounds pass, the room finishes once with a result', async () => {
    const started = await startGame('perang-fakta')
    advance(15 * 10 + 7)
    const v = await view('perang-fakta', started.code)
    expect(v.status).toBe('finished')
    expect(v.result).toBeDefined()
    expect(v.result.scores.find((s: Any) => s.userId === HOST).points).toBe(0)
    expect(v.state.roundSecondsLeft).toBeUndefined()
    const again = await view('perang-fakta', started.code)
    expect(again).toEqual(v)
    advance(60)
    expect(await view('perang-fakta', started.code)).toEqual(v)
  })

  it('accepts optionId null as the explicit no-vote, and still refuses a vote that is neither', async () => {
    const started = await startGame('perang-fakta')
    const timeout = await postJson<Data<Any>>(roomPath('perang-fakta', started.code, '/action'), {
      type: 'answer',
      questionId: started.question.id,
      optionId: null,
      seconds: 0,
    })
    expect(timeout.status).toBe(200)
    expect(timeout.body.data.state.round).toBe(2)
    expect(timeout.body.data.state.roundSecondsLeft).toBe(10)
    expect(timeout.body.data.players.find((p: Any) => p.id === HOST).points).toBe(0)
    const bad = await postJson<Any>(roomPath('perang-fakta', started.code, '/action'), {
      type: 'answer',
      questionId: timeout.body.data.question.id,
      value: 'mungkin',
      seconds: 0,
    })
    expect(bad.status).toBe(422)
  })

  it('a vote still scores and restarts the round clock', async () => {
    const started = await startGame('perang-fakta')
    advance(6)
    const r = await postJson<Data<Any>>(roomPath('perang-fakta', started.code, '/action'), {
      type: 'answer',
      questionId: started.question.id,
      optionId: 0,
      seconds: 6,
    })
    expect(r.status).toBe(200)
    expect(r.body.data.state.round).toBe(2)
    expect(r.body.data.state.roundSecondsLeft).toBe(10)
  })
})

describe('Teka Silang Kata clock (5 minutes)', () => {
  it('counts 300 s down from the start and survives a reload', async () => {
    const started = await startGame('teka-silang-kata')
    expect(started.state.secondsLeft).toBe(300)
    advance(120)
    const v = await view('teka-silang-kata', started.code)
    expect(v.status).toBe('playing')
    expect(v.state.secondsLeft).toBe(180)
  })

  it('ends the game at 0:00 with the words found so far, once', async () => {
    const started = await startGame('teka-silang-kata')
    advance(299)
    expect((await view('teka-silang-kata', started.code)).status).toBe('playing')
    advance(2)
    const v = await view('teka-silang-kata', started.code)
    expect(v.status).toBe('finished')
    expect(v.result).toBeDefined()
    expect(v.state.secondsLeft).toBeUndefined()
    expect(await view('teka-silang-kata', started.code)).toEqual(v)
  })
})
