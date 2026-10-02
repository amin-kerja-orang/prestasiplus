import { describe, expect, it, vi } from 'vitest'

import type { TransportRequest } from '@/api/transport'
import { createClock } from '@/lib/time'

import { requireAuth } from '../../auth/middleware'
import { MockDbError } from '../../db/errors'
import { maxPlusOne } from '../../db/id-strategies'
import { defineTable } from '../../db/table'
import { createDb, type Db } from '../../db/transaction'
import { createPrngRegistry } from '../../determinism/prng'
import { createMockConfig } from '../config'
import { createMockEvents } from '../events'
import { createOutbox } from '../outbox'
import { EMPTY_CORE } from '../plugin'
import { created, ok } from '../respond'
import { route, type RouteDef } from '../router'
import { createMockServer, isAsyncHandler, type MockServerOptions } from '../server'
import type { Middleware, MockParams } from '../types'
import { authHeaders, bootTest, TEST_NOW } from './helpers'

function req(
  method: TransportRequest['method'],
  url: string,
  extra: Partial<TransportRequest> = {},
): TransportRequest {
  return { method, url, headers: authHeaders(), ...extra }
}

interface Row {
  id: number
  v: string
}

function bareServer(routes: RouteDef<MockParams>[], extra: Partial<MockServerOptions> = {}) {
  const db = createDb()
  const rows = db.register(defineTable<Row>({ name: 'rows', ids: maxPlusOne() }))
  db.baseline()
  const clock = createClock({ at: TEST_NOW })
  const errors: unknown[] = []
  const server = createMockServer({
    db,
    clock,
    prng: createPrngRegistry(),
    config: createMockConfig(),
    outbox: createOutbox(clock),
    events: createMockEvents(),
    routes,
    onError: (e) => errors.push(e),
    ...extra,
  })
  return { db, rows, server, errors }
}

describe('mock server: routing and errors', () => {
  it('unknown routes and rejected int params answer 404 NOT_FOUND', async () => {
    const { runtime } = await bootTest()
    const res = await runtime.server.handle(req('GET', '/api/nope'))
    expect(res).toMatchObject({
      status: 404,
      body: { error: { code: 'NOT_FOUND', message: 'Not Found.' } },
    })
    expect((await runtime.server.handle(req('GET', '/api/notes/abc'))).status).toBe(404)
    expect((await runtime.server.handle(req('PUT', '/api/notes'))).status).toBe(404)
  })

  it('passes params, merged query and a JSON-cloned body to the handler', async () => {
    const seen: unknown[] = []
    const { server } = bareServer([
      route('POST', '/api/echo/:id', (r) => {
        seen.push(r)
        return ok(null)
      }),
    ])
    const body = { when: new Date('2026-01-01T00:00:00Z'), skip: undefined, n: 1 }
    await server.handle(req('POST', '/api/echo/x%20y?a=1&a=2&b=3', { query: { b: '9' }, body }))
    expect(seen[0]).toMatchObject({
      method: 'POST',
      path: '/api/echo/x%20y',
      params: { id: 'x y' },
      query: { a: ['1', '2'], b: '9' },
      body: { when: '2026-01-01T00:00:00.000Z', n: 1 },
      token: 'tok-student',
      formData: null,
      session: null,
    })
    expect((seen[0] as { body: object }).body).not.toBe(body)
  })

  it('multipart: body holds the fields, formData the original', async () => {
    let got: { body: unknown; formData: FormData | null } | undefined
    const { server } = bareServer([
      route('POST', '/api/upload', (r) => {
        got = { body: r.body, formData: r.formData }
        return ok(null)
      }),
    ])
    const form = new FormData()
    form.append('title', 'a')
    form.append('tag', 'x')
    form.append('tag', 'y')
    const file = new File(['abc'], 'p.png', { type: 'image/png' })
    form.append('profilePicture', file)
    await server.handle(req('POST', '/api/upload', { body: form }))
    expect(got?.formData).toBe(form)
    expect(got?.body).toMatchObject({ title: 'a', tag: ['x', 'y'] })
    expect((got?.body as { profilePicture: File }).profilePicture.name).toBe('p.png')
  })

  it('an unexpected handler error answers 500 SERVER_ERROR and is reported', async () => {
    const { server, errors } = bareServer([
      route('GET', '/api/boom', () => {
        throw new Error('bug')
      }),
      route('GET', '/api/bad', () => 'not a response' as never),
    ])
    const res = await server.handle(req('GET', '/api/boom'))
    expect(res).toMatchObject({ status: 500, body: { error: { code: 'SERVER_ERROR' } } })
    expect((await server.handle(req('GET', '/api/bad'))).status).toBe(500)
    expect(errors).toHaveLength(2)
  })

  it('responses are JSON clones: the caller never holds mock rows', async () => {
    const { runtime, notes } = await bootTest()
    const res = await runtime.server.handle(req('GET', '/api/notes/1'))
    const data = (res.body as { data: { text: string } }).data
    expect(Object.isFrozen(data)).toBe(false)
    data.text = 'changed'
    expect(notes.get(1)?.text).toBe('hello')
  })
})

describe('mock server: auth middleware', () => {
  it('requireAuth: 401 without a token or with an unknown token', async () => {
    const { runtime } = await bootTest()
    const noToken = await runtime.server.handle(req('GET', '/api/notes', { headers: {} }))
    expect(noToken).toMatchObject({
      status: 401,
      body: { error: { code: 'UNAUTHORIZED', message: 'Unauthenticated.' } },
    })
    const bad = await runtime.server.handle(req('GET', '/api/notes', { headers: authHeaders('x') }))
    expect(bad.status).toBe(401)
    expect((await runtime.server.handle(req('GET', '/api/notes'))).status).toBe(200)
  })

  it('without a core resolver every guarded route is 401 (stub)', async () => {
    const { runtime } = await bootTest({ core: EMPTY_CORE })
    expect((await runtime.server.handle(req('GET', '/api/notes'))).status).toBe(401)
  })

  it('requireRole: 401 guest, 403 FORBIDDEN other role, pass for the role', async () => {
    const { runtime } = await bootTest()
    const guest = await runtime.server.handle(req('DELETE', '/api/notes/1', { headers: {} }))
    expect(guest.status).toBe(401)
    const student = await runtime.server.handle(req('DELETE', '/api/notes/1'))
    expect(student).toMatchObject({ status: 403, body: { error: { code: 'FORBIDDEN' } } })
    const admin = await runtime.server.handle(
      req('DELETE', '/api/notes/1', { headers: authHeaders('tok-admin') }),
    )
    expect(admin).toEqual({ status: 204, headers: {}, body: null })
  })

  it("requireOwner: someone else's or a missing resource is 404, not 403", async () => {
    const { runtime } = await bootTest()
    expect((await runtime.server.handle(req('GET', '/api/notes/1'))).status).toBe(200)
    const other = await runtime.server.handle(req('GET', '/api/notes/2'))
    expect(other).toMatchObject({ status: 404, body: { error: { code: 'NOT_FOUND' } } })
    expect((await runtime.server.handle(req('GET', '/api/notes/999'))).status).toBe(404)
    const guest = await runtime.server.handle(req('GET', '/api/notes/1', { headers: {} }))
    expect(guest.status).toBe(401)
  })
})

describe('mock server: middleware order', () => {
  it('runs global guards (in order) before route guards; the first response wins', async () => {
    const calls: string[] = []
    const mark =
      (name: string, stop = false): Middleware =>
      () => {
        calls.push(name)
        return stop ? ok({ stoppedBy: name }) : undefined
      }
    const { server } = bareServer(
      [
        route('GET', '/api/a', [mark('route1'), mark('route2')], () => {
          calls.push('handler')
          return ok(null)
        }),
        route('GET', '/api/b', [mark('route1', true), mark('route2')], () => {
          calls.push('handler')
          return ok(null)
        }),
      ],
      { middleware: [mark('global1')] },
    )
    server.use(mark('global2'))

    await server.handle(req('GET', '/api/a'))
    expect(calls).toEqual(['global1', 'global2', 'route1', 'route2', 'handler'])

    calls.length = 0
    const res = await server.handle(req('GET', '/api/b'))
    expect(calls).toEqual(['global1', 'global2', 'route1'])
    expect(res.body).toEqual({ data: { stoppedBy: 'route1' } })
  })

  it('the session is resolved before the guards and is visible to them', async () => {
    const resolveSession = vi.fn((token: string) =>
      token === 't' ? { token, userId: 7, role: 'student' as const } : null,
    )
    let seen: unknown
    const { server } = bareServer(
      [
        route('GET', '/api/me', [requireAuth()], (r) => {
          seen = r.session
          return ok(null)
        }),
      ],
      { resolveSession },
    )
    await server.handle(req('GET', '/api/me', { headers: { authorization: 'Bearer t' } }))
    expect(resolveSession).toHaveBeenCalledOnce()
    expect(seen).toEqual({ token: 't', userId: 7, role: 'student' })
  })
})

describe('mock server: transactions', () => {
  it('a thrown error rolls back every write of the request (500)', async () => {
    const { runtime, notes, errors } = await bootTest()
    const before = notes.size
    const res = await runtime.server.handle(
      req('POST', '/api/notes/bulk', { body: { mode: 'throw' } }),
    )
    expect(res.status).toBe(500)
    expect(notes.size).toBe(before)
    expect(errors).toHaveLength(1)
  })

  it('abort() answers its own error and also rolls back', async () => {
    const { runtime, notes, errors } = await bootTest()
    const before = notes.size
    const res = await runtime.server.handle(
      req('POST', '/api/notes/bulk', { body: { mode: 'abort' } }),
    )
    expect(res).toMatchObject({
      status: 409,
      body: { error: { code: 'CONFLICT', message: 'Sudah wujud.' } },
    })
    expect(notes.size).toBe(before)
    expect(errors).toHaveLength(0)
  })

  it('a successful request commits all its writes once', async () => {
    const { runtime, notes } = await bootTest()
    const commits: number[] = []
    runtime.db.onCommit((e) => void commits.push(e.seq))
    const res = await runtime.server.handle(
      req('POST', '/api/notes/bulk', { body: { mode: 'ok' } }),
    )
    expect(res.status).toBe(201)
    expect(notes.size).toBe(5)
    expect(commits).toHaveLength(1)
  })

  it('a non-async handler returning a promise is rolled back and answers 500', async () => {
    const { server, rows, errors } = bareServer([
      route('POST', '/api/x', () => {
        rows.insert({ v: 'written' })
        return Promise.resolve(ok(null))
      }),
    ])
    const res = await server.handle(req('POST', '/api/x'))
    expect(res.status).toBe(500)
    expect(rows.size).toBe(0)
    expect(errors[0]).toBeInstanceOf(MockDbError)
  })

  it('async handlers are not wrapped; ctx.transaction groups their writes', async () => {
    const handler = async (_r: unknown, ctx: { transaction<T>(fn: () => T): T }) => {
      await Promise.resolve()
      return ctx.transaction(() => created(rows.insert({ v: 'late' })))
    }
    expect(isAsyncHandler(handler)).toBe(true)
    expect(isAsyncHandler(() => null)).toBe(false)
    const { server, rows } = bareServer([route('POST', '/api/x', handler)])
    const res = await server.handle(req('POST', '/api/x'))
    expect(res).toMatchObject({ status: 201, body: { data: { id: 1, v: 'late' } } })
  })
})

describe('mock server: write-through', () => {
  function persistedDb(db: Db, delayMs: number, fail = false) {
    const stored: number[] = []
    db.onCommit(
      (e) =>
        new Promise<void>((resolve, reject) =>
          setTimeout(() => {
            if (fail) reject(new Error('disk full'))
            else {
              stored.push(e.seq)
              resolve()
            }
          }, delayMs),
        ),
    )
    return stored
  }

  it('a mutating request answers only after its commit is stored', async () => {
    const { server, db } = bareServer([
      route('POST', '/api/x', () => created(rowsOf(db).insert({ v: 'a' }))),
    ])
    const stored = persistedDb(db, 20)
    const res = await server.handle(req('POST', '/api/x'))
    expect(res.status).toBe(201)
    expect(stored).toEqual([1])
  })

  it('a request waits only for its own commits', async () => {
    const { server, db } = bareServer([
      route('GET', '/api/read', () => ok('r')),
      route('POST', '/api/x', () => created(rowsOf(db).insert({ v: 'a' }))),
    ])
    let release!: () => void
    db.onCommit(() => new Promise<void>((resolve) => (release = resolve)))
    const write = server.handle(req('POST', '/api/x'))
    // A read issued while the write is still being stored is not held up by it.
    await expect(server.handle(req('GET', '/api/read'))).resolves.toMatchObject({ status: 200 })
    let done = false
    void write.then(() => (done = true))
    await Promise.resolve()
    expect(done).toBe(false)
    release()
    await expect(write).resolves.toMatchObject({ status: 201 })
  })

  it('a failed commit (COMMIT_FAILED) answers 500 SERVER_ERROR', async () => {
    const { server, db, errors } = bareServer([
      route('POST', '/api/x', () => created(rowsOf(db).insert({ v: 'a' }))),
    ])
    persistedDb(db, 1, true)
    const res = await server.handle(req('POST', '/api/x'))
    expect(res).toMatchObject({ status: 500, body: { error: { code: 'SERVER_ERROR' } } })
    expect(errors[0]).toMatchObject({ code: 'COMMIT_FAILED', seq: 1 })
  })
})

function rowsOf(db: Db) {
  return db.store('rows') as ReturnType<typeof defineTable<Row>>
}
