/**
 * Test fixtures for the mock server tests: a sample core (token → session) and a sample module
 * plugin with a `notes` table and routes that exercise guards, validation, pagination and
 * transactions.
 */

import { createClock, type Clock } from '@/lib/time'

import type { MockSession } from '../../auth/middleware'
import { requireAuth, requireOwner, requireRole } from '../../auth/middleware'
import { maxPlusOne } from '../../db/id-strategies'
import { defineTable } from '../../db/table'
import { bootMock, type BootMockOptions, type MockRuntime } from '../../index'
import { pageParams, paginate } from '../paginate'
import { defineMockCore, defineMockModule } from '../plugin'
import { abort, conflict, created, noContent, ok } from '../respond'
import { int, route } from '../router'
import type { MockRequest } from '../types'
import { max, required, validate } from '../validate'

export const TEST_NOW = '2026-09-25T15:40:00+08:00'

export interface Note {
  id: number
  userId: number
  text: string
  /** A value drawn from the seed streams, to prove seed data ignores `setRandomSeed`. */
  luck: number
}

export const SESSIONS: Record<string, MockSession> = {
  'tok-student': { token: 'tok-student', userId: 1, role: 'student' },
  'tok-other': { token: 'tok-other', userId: 3, role: 'student' },
  'tok-admin': { token: 'tok-admin', userId: 2, role: 'admin' },
}

export function sessionOf(req: MockRequest): MockSession {
  if (!req.session) throw new Error('no session')
  return req.session
}

export function makeCore() {
  return defineMockCore({
    resolveSession: (token) => SESSIONS[token] ?? null,
  })
}

export function makeNotesModule(id: `M${number}` = 'M90') {
  const notes = defineTable<Note>({
    name: `${id.toLowerCase()}.notes`,
    ids: maxPlusOne(),
    indexes: ['userId'],
  })

  const plugin = defineMockModule({
    id,
    dependsOn: ['core'],
    version: 1,
    tables: { notes },
    overrides: ['extraNotes'],
    seed(ctx) {
      const rng = ctx.prng.stream('m90:notes')
      notes.insert({ id: 1, userId: 1, text: 'hello', luck: rng.uint32() })
      notes.insert({ id: 2, userId: 2, text: 'admin note', luck: rng.uint32() })
      notes.insert({ id: 3, userId: 1, text: 'second', luck: rng.uint32() })
      const extra = ctx.overrides.extraNotes
      if (typeof extra === 'number') {
        for (let i = 0; i < extra; i++)
          notes.insert({ userId: 1, text: `extra ${String(i)}`, luck: 0 })
      }
    },
    routes: [
      route('GET', '/api/notes', [requireAuth()], (req) =>
        paginate(
          notes.query({ where: { userId: sessionOf(req).userId } }).rows,
          pageParams(req.query, { pageSize: 2 }),
        ),
      ),
      route(
        'GET',
        '/api/notes/:id',
        [requireOwner((req) => notes.get(req.params.id as number)?.userId)],
        (req) => ok(notes.get(req.params.id as number)),
        { params: { id: int() } },
      ),
      route('POST', '/api/notes', [requireAuth()], (req) => {
        const invalid = validate(req.body, { text: [required(), max(20)] })
        if (invalid) return invalid
        const { text } = req.body as { text: string }
        return created(notes.insert({ userId: sessionOf(req).userId, text, luck: 0 }))
      }),
      // Writes two rows, then fails: the whole request must roll back.
      route('POST', '/api/notes/bulk', [requireAuth()], (req) => {
        const { mode } = req.body as { mode: 'ok' | 'throw' | 'abort' }
        notes.insert({ userId: sessionOf(req).userId, text: 'bulk 1', luck: 0 })
        notes.insert({ userId: sessionOf(req).userId, text: 'bulk 2', luck: 0 })
        if (mode === 'throw') throw new Error('boom')
        if (mode === 'abort') abort(409, 'CONFLICT', 'Sudah wujud.')
        return created({ count: 2 })
      }),
      route(
        'DELETE',
        '/api/notes/:id',
        [requireRole('admin')],
        (req) => {
          notes.remove(req.params.id as number)
          return noContent()
        },
        { params: { id: int() } },
      ),
      // Side effects (outbox, emit) that must follow the transaction.
      route('POST', '/api/notes/notify', [requireAuth()], (req, ctx) => {
        const { mode } = req.body as { mode: 'ok' | 'throw' | 'abort' }
        ctx.outbox.send({ type: 'note-created', to: 'pelajar@demo.test' })
        ctx.emit('note-created', { mode })
        notes.insert({ userId: sessionOf(req).userId, text: 'notify', luck: 0 })
        if (mode === 'throw') throw new Error('boom')
        if (mode === 'abort') abort(409, 'CONFLICT', 'Sudah wujud.')
        return created(null)
      }),
      // Async handler: writes inside ctx.transaction (tracked) or outside it (untracked).
      route('POST', '/api/notes/async', [requireAuth()], async (req, ctx) => {
        const { mode } = req.body as { mode: 'tx' | 'tx-throw' | 'untracked' }
        await Promise.resolve()
        const userId = sessionOf(req).userId
        if (mode === 'untracked') {
          notes.insert({ userId, text: 'untracked', luck: 0 })
          ctx.outbox.send({ type: 'note-created', to: 'pelajar@demo.test' })
          return created(null)
        }
        try {
          ctx.transaction(() => {
            ctx.outbox.send({ type: 'note-created', to: 'pelajar@demo.test' })
            ctx.emit('note-created', { mode })
            notes.insert({ userId, text: 'async', luck: 0 })
            if (mode === 'tx-throw') throw new Error('rolled back')
          })
        } catch {
          return conflict('Gagal.')
        }
        return created(null)
      }),
      // Sampling stream (moved by setRandomSeed).
      route('GET', '/api/notes-sample', (_req, ctx) =>
        ok({ value: ctx.prng.fresh('m90:sample').uint32() }),
      ),
    ],
  })
  return { plugin, notes }
}

export interface TestRuntime {
  runtime: MockRuntime
  notes: ReturnType<typeof makeNotesModule>['notes']
  clock: Clock
  errors: unknown[]
}

export async function bootTest(options: Partial<BootMockOptions> = {}): Promise<TestRuntime> {
  const { plugin, notes } = makeNotesModule()
  const clock = createClock({ at: TEST_NOW })
  const errors: unknown[] = []
  const runtime = await bootMock({
    mode: 'test',
    core: makeCore(),
    plugins: [plugin],
    clock,
    latencyMs: 0,
    onError: (err) => errors.push(err),
    ...options,
  })
  return { runtime, notes, clock, errors }
}

export function authHeaders(token = 'tok-student'): Record<string, string> {
  return { authorization: `Bearer ${token}`, accept: 'application/json' }
}
