import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { addAccount, bootWorkflowApp, del, draft, expectError, extractAndRun, itemsOf, loginAs, paper, patch, post, readyBatch, type LoggedIn, type WorkflowTestApp } from './helpers'

let t: WorkflowTestApp
let owner: LoggedIn
let other: LoggedIn
let admin: LoggedIn
let schoolAdmin: LoggedIn
let ppd: LoggedIn
let student: LoggedIn
let batchId: string
let itemId: string
let stimulusId: string

beforeAll(async () => {
  t = await bootWorkflowApp()
  await addAccount(t.db, 'guru.lain@demo.test', 'teacher', 'DEMO001')
  await addAccount(t.db, 'ppd.ujian@demo.test', 'ppd_officer', 'DEMO001')
  owner = await loginAs(t, 'guru@demo.test')
  other = await loginAs(t, 'guru.lain@demo.test')
  admin = await loginAs(t, 'admin@demo.test')
  schoolAdmin = await loginAs(t, 'adminsekolah@demo.test')
  ppd = await loginAs(t, 'ppd.ujian@demo.test')
  student = await loginAs(t, 'pelajar@demo.test')
  t.ai.paper = () => paper([draft(t.codes, '1'), draft(t.codes, '2')])
  batchId = (await readyBatch(t, owner)).batchId
  await extractAndRun(t, owner, batchId)
  itemId = (await itemsOf(owner, batchId))[0]!.id
  const s = await post(owner, `/intake/batches/${batchId}/stimuli`, { kind: 'passage', text: 'Petikan ujian.', alt: 'Petikan' })
  stimulusId = s.body.data.id
}, 120_000)
afterAll(async () => {
  await t.close()
})

const routes = (): Array<[string, (w: LoggedIn) => Promise<{ status: number }>]> => [
  ['POST extract', (w) => post(w, `/intake/batches/${batchId}/extract`)],
  ['GET review', (w) => w.agent.get(`/api/intake/batches/${batchId}/review`)],
  ['POST add item', (w) => post(w, `/intake/batches/${batchId}/items`)],
  ['POST add stimulus', (w) => post(w, `/intake/batches/${batchId}/stimuli`, { kind: 'passage' })],
  ['PATCH stimulus', (w) => patch(w, `/intake/stimuli/${stimulusId}`, { caption: 'x' })],
  ['GET items', (w) => w.agent.get('/api/intake/items')],
  ['GET item', (w) => w.agent.get(`/api/intake/items/${itemId}`)],
  ['PATCH item', (w) => patch(w, `/intake/items/${itemId}`, { marks: 1 })],
  ['POST accept', (w) => post(w, `/intake/items/${itemId}/accept`)],
  ['POST reject', (w) => post(w, `/intake/items/${itemId}/reject`, { reason: 'x' })],
  ['POST duplicate', (w) => post(w, `/intake/items/${itemId}/duplicate`, { decision: 'not_duplicate', duplicateId: '1' })],
  ['POST bulk', (w) => post(w, '/intake/items/bulk', { action: 'reject', ids: [itemId], reason: 'x' })],
  ['DELETE stimulus', (w) => del(w, `/intake/stimuli/${stimulusId}`)],
]

describe('roles (D40a)', () => {
  it('school admin, PPD and student get 403 on every route', async () => {
    for (const who of [schoolAdmin, ppd, student]) {
      for (const [name, call] of routes()) expect((await call(who)).status, name).toBe(403)
    }
  })

  it('anonymous callers get 401', async () => {
    const anon = t.agent()
    for (const [method, url] of [
      ['get', '/api/intake/items'],
      ['get', `/api/intake/items/${itemId}`],
      ['get', `/api/intake/batches/${batchId}/review`],
    ] as const) {
      expect((await anon[method](url)).status, url).toBe(401)
    }
  })
})

describe('IDOR (404, never 403 on an id)', () => {
  it('another Guru cannot see or touch the items, batch or stimuli of the owner', async () => {
    const calls = routes().filter(([name]) => name !== 'GET items' && name !== 'POST bulk')
    for (const [name, call] of calls) {
      const res = (await call(other)) as { status: number; body: { error?: { code: string } } }
      expect(res.status, name).toBe(404)
      expect(res.body.error?.code, name).toBe('NOT_FOUND')
    }
    const list = await other.agent.get('/api/intake/items')
    expect(list.status).toBe(200)
    expect(list.body.data).toHaveLength(0)
    expect(list.body.meta.counts).toMatchObject({ generated: 0, needs_review: 0 })
    // The owner's id filters change nothing for a Guru.
    const probe = await other.agent.get(`/api/intake/items?batchId=${batchId}`)
    expect(probe.body.data).toHaveLength(0)
    const bulk = await post(other, '/intake/items/bulk', { action: 'reject', ids: [itemId], reason: 'x' })
    expect(bulk.status).toBe(200)
    expect(bulk.body.data.results[0]).toMatchObject({ outcome: 'skipped', reason: 'NOT_FOUND', item: null })
    expect((await itemsOf(owner, batchId))[0]!.state).not.toBe('rejected')
  })

  it('malformed ids are 404', async () => {
    for (const id of ['abc', '0', '-1', '1.5', '99999999999999999999999']) {
      expect((await owner.agent.get(`/api/intake/items/${id}`)).status, id).toBe(404)
      expect((await owner.agent.get(`/api/intake/batches/${id}/review`)).status, id).toBe(404)
    }
  })

  it('Admin Pusat sees every batch', async () => {
    expect((await admin.agent.get(`/api/intake/items/${itemId}`)).status).toBe(200)
    expect((await admin.agent.get(`/api/intake/batches/${batchId}/review`)).status).toBe(200)
    const list = await admin.agent.get(`/api/intake/items?batchId=${batchId}`)
    expect(list.body.data.length).toBe(2)
    const byUploader = await admin.agent.get(`/api/intake/items?uploaderId=${list.body.data[0].uploader.id}`)
    expect(byUploader.body.data.length).toBeGreaterThanOrEqual(2)
  })
})

describe('CSRF and body rules', () => {
  it('a write without the CSRF token is refused', async () => {
    for (const url of [`/api/intake/items/${itemId}/reject`, `/api/intake/items/${itemId}/accept`, `/api/intake/batches/${batchId}/extract`]) {
      const res = await owner.agent.post(url).send({})
      expect(res.status, url).toBe(403)
    }
    expect((await owner.agent.patch(`/api/intake/items/${itemId}`).send({ marks: 1 })).status).toBe(403)
    expect((await owner.agent.delete(`/api/intake/stimuli/${stimulusId}`)).status).toBe(403)
    expect(expectError).toBeTypeOf('function')
  })

  it('unknown keys are rejected (strict bodies)', async () => {
    expect((await patch(owner, `/intake/items/${itemId}`, { marks: 1, state: 'accepted' })).status).toBe(422)
    expect((await patch(owner, `/intake/items/${itemId}`, { lowFields: [] })).status).toBe(422)
    expect((await post(owner, `/intake/items/${itemId}/accept`, { questionId: '1' })).status).toBe(422)
    expect((await post(owner, `/intake/batches/${batchId}/extract`, { force: true })).status).toBe(422)
  })
})
