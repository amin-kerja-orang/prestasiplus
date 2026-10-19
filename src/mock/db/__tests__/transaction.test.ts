import { describe, expect, it, vi } from 'vitest'

import { createPrngRegistry } from '../../determinism/prng'
import { MockDbError } from '../errors'
import { floor, maxPlusOne, uuid } from '../id-strategies'
import { defineTable, type TableChanges } from '../table'
import { createDb, type CommitEvent } from '../transaction'

interface Session {
  id: number
  userId: number
  status: 'in_progress' | 'completed'
}
interface Answer {
  id: number
  sessionId: number
  correct: boolean
}

function setup() {
  const db = createDb()
  const sessions = db.register(
    defineTable<Session>({ name: 'practice.sessions', ids: maxPlusOne(), indexes: ['userId'] }),
  )
  const answers = db.register(
    defineTable<Answer>({
      name: 'practice.answers',
      ids: floor({ start: 100 }),
      indexes: ['sessionId'],
    }),
  )
  // Seed phase.
  sessions.insert({ id: 1, userId: 7, status: 'in_progress' })
  sessions.insert({ id: 2, userId: 7, status: 'completed' })
  answers.insert({ id: 1, sessionId: 2, correct: true })
  db.baseline()
  const events: CommitEvent[] = []
  db.onCommit((e) => void events.push(e))
  return { db, sessions, answers, events }
}

describe('createDb: phases and registration', () => {
  it('seed phase writes emit nothing; baseline switches to live', () => {
    const db = createDb()
    const t = db.register(defineTable<Session>({ name: 's', ids: maxPlusOne() }))
    const listener = vi.fn()
    db.onCommit(listener)
    expect(db.phase).toBe('seed')
    t.insert({ userId: 1, status: 'completed' })
    db.transaction(() => t.insert({ userId: 2, status: 'completed' }))
    expect(listener).not.toHaveBeenCalled()
    db.baseline()
    expect(db.phase).toBe('live')
    expect(() => db.baseline()).toThrow(expect.objectContaining({ code: 'PHASE' }))
  })

  it('store names are unique and registration is seed-phase only', () => {
    const db = createDb()
    db.register(defineTable<Session>({ name: 's', ids: maxPlusOne() }))
    expect(() => db.register(defineTable<Session>({ name: 's', ids: maxPlusOne() }))).toThrow(
      expect.objectContaining({ code: 'DUPLICATE_STORE' }),
    )
    expect(db.store('s')?.name).toBe('s')
    expect(db.stores()).toHaveLength(1)
    db.baseline()
    expect(() => db.register(defineTable<Session>({ name: 't', ids: maxPlusOne() }))).toThrow(
      expect.objectContaining({ code: 'PHASE' }),
    )
  })
})

describe('db.transaction', () => {
  it('commits the net changes of every touched store in one event', () => {
    const { db, sessions, answers, events } = setup()
    const result = db.transaction(() => {
      answers.insert({ sessionId: 1, correct: false })
      answers.insert({ sessionId: 1, correct: true })
      sessions.update(1, { status: 'completed' })
      return 'done'
    })
    expect(result).toBe('done')
    expect(events).toHaveLength(1)
    const [event] = events
    expect(event?.seq).toBe(1)
    expect(Object.keys(event?.changes ?? {})).toEqual(['practice.answers', 'practice.sessions'])
    const a = event?.changes['practice.answers'] as TableChanges<Answer>
    expect(a.upserts.map((r) => r.id)).toEqual([100, 101])
    expect(a.deletes).toEqual([])
    expect(a.ids).toEqual({ kind: 'floor', hw: 101 })
    const s = event?.changes['practice.sessions'] as TableChanges<Session>
    expect(s.upserts).toEqual([{ id: 1, userId: 7, status: 'completed' }])
  })

  it('rolls back every store (rows, indexes, id counters, diff) when the body throws', () => {
    const { db, sessions, answers, events } = setup()
    sessions.update(2, { status: 'in_progress' }) // an earlier committed change
    const before = { s: sessions.query().rows, a: answers.query().rows, diff: db.diff() }
    events.length = 0

    expect(() =>
      db.transaction(() => {
        answers.insert({ sessionId: 1, correct: false })
        sessions.update(1, { status: 'completed' })
        sessions.update(2, { status: 'completed' })
        answers.remove(1)
        sessions.insert({ userId: 9, status: 'in_progress' })
        throw new Error('boom')
      }),
    ).toThrow('boom')

    expect(sessions.query().rows).toEqual(before.s)
    expect(answers.query().rows).toEqual(before.a)
    expect(db.diff()).toEqual(before.diff)
    expect(sessions.count({ userId: 9 })).toBe(0)
    expect(answers.count({ sessionId: 2 })).toBe(1)
    expect(events).toEqual([])
    // Id counters were restored too.
    expect(db.transaction(() => answers.insert({ sessionId: 1, correct: true })).id).toBe(100)
    expect(sessions.insert({ userId: 9, status: 'in_progress' }).id).toBe(3)
  })

  it('a write outside a transaction is its own implicit transaction', () => {
    const { sessions, events } = setup()
    sessions.update(1, { status: 'completed' })
    expect(events).toHaveLength(1)
    expect(() => sessions.update(99, { status: 'completed' })).toThrow(MockDbError)
    expect(events).toHaveLength(1)
  })

  it('nested transactions join the outer one; the outermost decides', () => {
    const { db, sessions, answers, events } = setup()
    db.transaction(() => {
      sessions.update(1, { status: 'completed' })
      db.transaction(() => answers.insert({ sessionId: 1, correct: true }))
      expect(db.inTransaction).toBe(true)
    })
    expect(events).toHaveLength(1)
    expect(Object.keys(events[0]?.changes ?? {})).toHaveLength(2)

    expect(() =>
      db.transaction(() => {
        db.transaction(() => sessions.update(2, { status: 'in_progress' }))
        throw new Error('outer fails')
      }),
    ).toThrow('outer fails')
    expect(sessions.get(2)?.status).toBe('completed')
    expect(db.inTransaction).toBe(false)
  })

  it('a body that returns a promise is rolled back (bodies are synchronous)', () => {
    const { db, sessions, events } = setup()
    expect(() =>
      db.transaction(() => {
        sessions.update(1, { status: 'completed' })
        return Promise.resolve(1)
      }),
    ).toThrow(expect.objectContaining({ code: 'ASYNC_TRANSACTION' }))
    expect(sessions.get(1)?.status).toBe('in_progress')
    expect(events).toEqual([])
  })

  it('a transaction with no net change emits nothing', () => {
    const { db, answers, events } = setup()
    db.transaction(() => 42)
    expect(events).toEqual([])
    // Insert + delete of a runtime row moves the id counter, which is still a change to persist.
    db.transaction(() => {
      const row = answers.insert({ sessionId: 1, correct: true })
      answers.remove(row.id)
    })
    expect(events).toHaveLength(1)
    const c = events[0]?.changes['practice.answers'] as TableChanges<Answer>
    expect(c).toEqual({ kind: 'table', upserts: [], deletes: [], ids: { kind: 'floor', hw: 100 } })
  })
})

describe('write-through: settled()', () => {
  it('resolves after async commit listeners finish', async () => {
    const { db, sessions } = setup()
    let written = false
    db.onCommit(async () => {
      await new Promise((r) => setTimeout(r, 5))
      written = true
    })
    sessions.update(1, { status: 'completed' })
    expect(written).toBe(false)
    await db.settled()
    expect(written).toBe(true)
  })

  it('rejects with the first listener error, once', async () => {
    const { db, sessions } = setup()
    db.onCommit(() => Promise.reject(new Error('idb failed')))
    const off = db.onCommit(() => {
      throw new Error('sync failure')
    })
    sessions.update(1, { status: 'completed' })
    await expect(db.settled()).rejects.toThrow(/failed|failure/)
    off()
    await expect(db.settled()).resolves.toBeUndefined()
  })
})

describe('persistence contract (F-07)', () => {
  it('diff → loadDiff on a fresh seed rebuilds identical state', () => {
    const a = setup()
    a.db.transaction(() => {
      a.answers.insert({ sessionId: 1, correct: true })
      a.sessions.update(1, { status: 'completed' })
      a.answers.remove(1)
    })
    const stored = structuredClone(a.db.diff())

    const b = setup()
    b.db.loadDiff(stored)
    expect(b.sessions.query().rows).toEqual(a.sessions.query().rows)
    expect(b.answers.query().rows).toEqual(a.answers.query().rows)
    expect(b.db.diff()).toEqual(a.db.diff())
    expect(b.events).toEqual([]) // hydrate is not re-emitted
    expect(b.answers.insert({ sessionId: 1, correct: false }).id).toBe(101)
  })

  it('applyChanges applies another tab’s commit without re-emitting it', () => {
    const tab1 = setup()
    const tab2 = setup()
    tab1.sessions.update(1, { status: 'completed' })
    tab1.answers.insert({ sessionId: 1, correct: true })
    for (const e of tab1.events) tab2.db.applyChanges(structuredClone(e.changes))
    expect(tab2.sessions.query().rows).toEqual(tab1.sessions.query().rows)
    expect(tab2.answers.query().rows).toEqual(tab1.answers.query().rows)
    expect(tab2.events).toEqual([])
    expect(() => tab2.db.applyChanges({ nope: {} })).toThrow(
      expect.objectContaining({ code: 'INVALID' }),
    )
  })

  it('loadDiff and reset are refused inside a transaction; reset returns to the seed phase', () => {
    const { db, sessions } = setup()
    db.transaction(() => {
      expect(() => db.loadDiff({})).toThrow(expect.objectContaining({ code: 'PHASE' }))
      expect(() => db.reset()).toThrow(expect.objectContaining({ code: 'PHASE' }))
    })
    db.reset()
    expect(db.phase).toBe('seed')
    expect(sessions.size).toBe(0)
    expect(() => db.loadDiff({})).toThrow(expect.objectContaining({ code: 'PHASE' }))
  })
})

describe('id strategies inside a db use its PRNG streams', () => {
  it('uuid ids follow the db seed base', () => {
    const make = (seedBase: number) => {
      const db = createDb({ prng: createPrngRegistry({ seedBase }) })
      const t = db.register(
        defineTable<{ id: string; n: number }>({ name: 'u', ids: uuid('ids:u') }),
      )
      return t.insert({ n: 1 }).id
    }
    expect(make(1)).toBe(make(1))
    expect(make(1)).not.toBe(make(2))
  })
})

describe('settled(seq): failures are tagged with their commit', () => {
  it('reports a listener failure only to the caller of that commit', async () => {
    const { db, sessions, answers } = setup()
    db.onCommit((e) =>
      'practice.answers' in e.changes ? Promise.reject(new Error('idb quota')) : Promise.resolve(),
    )
    sessions.update(1, { status: 'completed' })
    const okSeq = db.lastSeq
    answers.insert({ sessionId: 1, correct: true })
    const badSeq = db.lastSeq
    expect(badSeq).toBe(okSeq + 1)

    await expect(db.settled(okSeq)).resolves.toBeUndefined()
    const err = await db.settled([badSeq]).then(
      () => null,
      (e: unknown) => e,
    )
    expect(err).toBeInstanceOf(MockDbError)
    expect(err).toMatchObject({ code: 'COMMIT_FAILED', seq: badSeq })
    expect((err as Error).cause).toEqual(new Error('idb quota'))
    // Consumed: not reported again, to anyone.
    await expect(db.settled()).resolves.toBeUndefined()
  })

  it('a synchronous listener throw is tagged too', async () => {
    const { db, sessions } = setup()
    db.onCommit(() => {
      throw new Error('sync')
    })
    sessions.update(1, { status: 'completed' })
    await expect(db.settled(db.lastSeq)).rejects.toMatchObject({ code: 'COMMIT_FAILED', seq: 1 })
  })
})
