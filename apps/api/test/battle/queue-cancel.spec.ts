import { BattleQueueCancelledSchema, ErrorBodySchema, envelopeOf } from '@pp/contract'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addMcqs, bootBattleApp, client, matchBot, parse, startQueue, STUDENT_G10, STUDENT_G10_B, subjectsOf, type BattleTestApp, type Client, type Subjects } from './arena-helpers'

const NOT_FOUND = 'Giliran tidak dijumpai.'
const cancelPath = (id: string) => `/battle/queue/${id}/cancel`

describe('cancel a queue entry (API-GAME-14)', () => {
  let t: BattleTestApp
  let a: Client
  let b: Client
  let s: Subjects

  const statusOf = async (id: string) =>
    (await t.db.query<{ status: string; joiner_outcome: string | null }>('select status, joiner_outcome from battle_queues where id = $1', [id]))[0]
  const expectNotFound = (res: { status: number; body: unknown }) => {
    expect(res.status).toBe(404)
    expect(ErrorBodySchema.parse(res.body).error).toMatchObject({ code: 'NOT_FOUND', message: NOT_FOUND })
  }

  beforeAll(async () => {
    t = await bootBattleApp()
    a = await client(t, STUDENT_G10)
    b = await client(t, STUDENT_G10_B)
    s = await subjectsOf(t)
    await addMcqs(t, s.math, s.t4, 12)
  }, 180_000)
  afterAll(async () => t.close())

  it('answers 200 {data:{cancelled:true}}, and the entry is never matched afterwards', async () => {
    const id = await startQueue(a, s.math)
    const res = await a.post(cancelPath(id), undefined)
    expect(res.status).toBe(200)
    expect(parse(envelopeOf(BattleQueueCancelledSchema), res)).toEqual({ data: { cancelled: true } })
    expect(res.headers['cache-control']).toBe('no-store')
    expect((await statusOf(id))?.status).toBe('cancelled')
    // BATTLE_RULES.matchOnPoll polls would match a waiting entry: "Batal" removes it at once (48 GAME-01).
    for (let i = 0; i < 4; i++) expect((await a.get(`/battle/poll-match/${id}`)).body).toEqual({ status: 'not_found' })
    expect((await statusOf(id))?.status).toBe('cancelled')
    expect(await t.db.query('select 1 from battles b join battle_queues q on q.battle_id = b.id where q.id = $1', [id])).toHaveLength(0)
  })

  it('cancelling again answers the same and changes nothing', async () => {
    const id = await startQueue(a, s.math)
    expect((await a.post(cancelPath(id), undefined)).status).toBe(200)
    const again = await a.post(cancelPath(id), undefined)
    expect(again.status).toBe(200)
    expect(again.body).toEqual({ data: { cancelled: true } })
    expect((await statusOf(id))?.status).toBe('cancelled')
  })

  it('a cancelled entry cannot be joined, and accept-challenger finds nothing', async () => {
    const id = await startQueue(a, s.math)
    expect((await a.post(cancelPath(id), undefined)).status).toBe(200)
    expect((await b.post(`/battle/join-queue/${id}`, undefined)).status).toBe(404)
    expect((await a.post(`/battle/accept-challenger/${id}`, undefined)).status).toBe(404)
    expect((await statusOf(id))?.status).toBe('cancelled')
    expect((await t.db.query('select joiner_user_id from battle_queues where id = $1', [id]))[0]).toEqual({ joiner_user_id: null })
  })

  it('another pupil polling a cancelled entry is told the same as for any entry not theirs', async () => {
    const id = await startQueue(a, s.math)
    expect((await a.post(cancelPath(id), undefined)).status).toBe(200)
    expect((await b.get(`/battle/poll-match/${id}`)).body).toEqual({ status: 'not_found' })
    expect((await b.get(`/battle/poll-challenger/${id}`)).body).toEqual({ status: 'not_found' })
  })

  it('an entry that already expired answers the same and keeps its status', async () => {
    const id = await startQueue(a, s.math)
    await t.db.query(`update battle_queues set status = 'expired' where id = $1`, [id])
    expect((await a.post(cancelPath(id), undefined)).status).toBe(200)
    expect((await statusOf(id))?.status).toBe('expired')
  })

  it("another pupil's entry is 404 and stays as it was", async () => {
    const id = await startQueue(a, s.math)
    expectNotFound(await b.post(cancelPath(id), undefined))
    expect((await statusOf(id))?.status).toBe('waiting')
  })

  it('an unknown or malformed id is the same 404', async () => {
    expectNotFound(await a.post(cancelPath('999999999'), undefined))
    expectNotFound(await a.post(cancelPath('abc'), undefined))
  })

  it('a Mod Pelajar entry is out of reach of an ordinary session', async () => {
    const id = await startQueue(a, s.math)
    await t.db.query('update battle_queues set is_test = true where id = $1', [id])
    expectNotFound(await a.post(cancelPath(id), undefined))
    expect((await statusOf(id))?.status).toBe('waiting')
  })

  it('an entry that has its battle is 404 and the battle stays', async () => {
    const id = await startQueue(a, s.math)
    const battle = await matchBot(a, id)
    expectNotFound(await a.post(cancelPath(id), undefined))
    expect((await statusOf(id))?.status).toBe('matched')
    expect(await t.db.query('select 1 from battles where id = $1', [battle])).toHaveLength(1)
  })

  it('tells a pending joiner the entry is gone', async () => {
    const id = await startQueue(a, s.math)
    expect((await b.post(`/battle/join-queue/${id}`, undefined)).status).toBe(200)
    expect((await a.get(`/battle/poll-match/${id}`)).body).toMatchObject({ status: 'incoming_challenge' })
    expect((await a.post(cancelPath(id), undefined)).status).toBe(200)
    expect(await statusOf(id)).toEqual({ status: 'cancelled', joiner_outcome: 'expired' })
    expect((await b.get(`/battle/poll-challenger/${id}`)).body).toEqual({ status: 'expired' })
  })

  it('needs a session and the CSRF header', async () => {
    const id = await startQueue(a, s.math)
    const anonymous = await t.http().post(`/api${cancelPath(id)}`).send()
    expect(anonymous.status).toBe(401)
    expect(ErrorBodySchema.parse(anonymous.body).error.code).toBe('UNAUTHORIZED')
    const noCsrf = await a.who.agent.post(`/api${cancelPath(id)}`).send()
    expect(noCsrf.status).toBe(403)
    expect(ErrorBodySchema.parse(noCsrf.body).error.code).toBe('CSRF_INVALID')
    expect((await statusOf(id))?.status).toBe('waiting')
  })
})
