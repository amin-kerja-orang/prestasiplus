/**
 * F-07 mock persistence: IndexedDB diff (fake-indexeddb), write-through, seed-version discard,
 * clock offset, cross-tab apply (Node `BroadcastChannel`), reset, and graceful degradation.
 */

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { anchorOffset, createClock, type Clock } from '@/lib/time'

import { authHeaders, bootTest, TEST_NOW, type TestRuntime } from '../../server/__tests__/helpers'
import type { MockBroadcast } from '../broadcast'
import { maxPlusOne } from '../id-strategies'
import {
  CLOCK_KEY,
  createMockPersistence,
  idbBackend,
  META_KEY,
  PERSIST_FORMAT,
  STORE_KEY_PREFIX,
  type MockPersistenceAdapter,
  type MockPersistenceOptions,
  type PersistBackend,
} from '../persistence'
import { defineTable } from '../table'
import { createDb } from '../transaction'

const REAL_NOW = Date.parse('2027-03-01T00:00:00Z')

let channelName = ''
let adapters: MockPersistenceAdapter[] = []
let testSeq = 0

beforeEach(() => {
  // A fresh, empty IndexedDB and a private channel per test.
  globalThis.indexedDB = new IDBFactory()
  channelName = `pp-mock-test-${String(++testSeq)}`
  adapters = []
})

afterEach(async () => {
  for (const a of adapters) {
    await a.flush()
    a.detach() // closes the BroadcastChannel so the worker can exit
  }
})

function adapter(options: MockPersistenceOptions = {}): MockPersistenceAdapter {
  const a = createMockPersistence({ channelName, warn: () => undefined, ...options })
  adapters.push(a)
  return a
}

/** A "page load": a new runtime with a new adapter over the same IndexedDB. */
async function boot(options: MockPersistenceOptions & { clock?: Clock } = {}) {
  const { clock, ...rest } = options
  const persistence = adapter(rest)
  const t = await bootTest({
    persistence,
    clock: clock ?? createClock({ source: () => REAL_NOW }),
  })
  return { ...t, persistence }
}

async function post(t: TestRuntime, url: string, body: unknown, token = 'tok-student') {
  return t.runtime.transport.request({ method: 'POST', url, body, headers: authHeaders(token) })
}

async function stored(): Promise<Map<string, unknown>> {
  const b = idbBackend()
  if (!b) throw new Error('no IndexedDB')
  return b.readAll()
}

describe('write-through and reload', () => {
  it('a saved change is in IndexedDB when the request answers, and a rebuild restores it exactly', async () => {
    const tab = await boot()
    expect(tab.persistence.storageEnabled).toBe(true)

    const res = await post(tab, '/api/notes', { text: 'baru' })
    expect(res.status).toBe(201)
    // Write-through: stored before the response, without waiting for anything else.
    const afterPost = await stored()
    expect(afterPost.get(`${STORE_KEY_PREFIX}m90.notes`)).toMatchObject({
      kind: 'table',
      upserts: [{ id: 4, text: 'baru' }],
    })
    expect(afterPost.get(META_KEY)).toEqual({
      format: PERSIST_FORMAT,
      seedVersion: tab.runtime.seedVersion,
    })

    tab.notes.update(1, { text: 'diubah' })
    tab.notes.remove(2)
    await tab.runtime.db.settled()
    const before = tab.notes.query().rows

    const reloaded = await boot()
    expect(reloaded.notes.query().rows).toEqual(before)
    expect(reloaded.runtime.db.diff()).toEqual(tab.runtime.db.diff())
    // The id counter came back too: no id is reused.
    expect(reloaded.notes.insert({ userId: 1, text: 'next', luck: 0 }).id).toBe(5)
  })

  it('stores every store touched by one commit in one write', async () => {
    const writes: (readonly (readonly [string, unknown])[])[] = []
    const backend: PersistBackend = {
      readAll: () => Promise.resolve(new Map()),
      write: (list) => {
        writes.push(list)
        return Promise.resolve()
      },
      replace: () => Promise.resolve(),
    }
    const tab = await boot({ backend })
    await tab.persistence.flush()
    writes.length = 0
    tab.runtime.db.transaction(() => {
      tab.notes.insert({ userId: 1, text: 'a', luck: 0 })
      tab.notes.insert({ userId: 1, text: 'b', luck: 0 })
    })
    await tab.runtime.db.settled()
    expect(writes).toHaveLength(1)
    expect(writes[0]?.map(([k]) => k)).toEqual([`${STORE_KEY_PREFIX}m90.notes`, META_KEY])
  })

  it('round-trips Blobs and Dates (uploads)', async () => {
    interface Upload {
      id: number
      file: Blob
      at: Date
    }
    const makeRuntime = () => {
      const db = createDb()
      const uploads = db.register(defineTable<Upload>({ name: 'm99.uploads', ids: maxPlusOne() }))
      db.baseline()
      const clock = createClock({ at: TEST_NOW })
      return { db, uploads, clock, seedVersion: 'v1', reset: () => Promise.resolve() }
    }

    const first = makeRuntime()
    const a = adapter()
    expect(await a.load('v1')).toBeNull()
    a.attach(first)
    first.uploads.insert({
      file: new Blob(['avatar-bytes'], { type: 'image/png' }),
      at: new Date(TEST_NOW),
    })
    await first.db.settled()

    const second = makeRuntime()
    const state = await adapter().load('v1')
    second.db.loadDiff(state?.diffs ?? {})
    const row = second.uploads.get(1)
    expect(row?.file).toBeInstanceOf(Blob)
    expect(row?.file.type).toBe('image/png')
    expect(await row?.file.text()).toBe('avatar-bytes')
    expect(row?.at).toEqual(new Date(TEST_NOW))
  })
})

describe('seed version', () => {
  it('a different seed version discards the stored diff', async () => {
    const tab = await boot()
    await post(tab, '/api/notes', { text: 'lama' })
    expect((await stored()).size).toBeGreaterThan(0)

    expect(await adapter().load('another-seed-version')).toBeNull()
    expect((await stored()).size).toBe(0)

    // Even the original version finds nothing now: fresh seeds.
    const reloaded = await boot()
    expect(reloaded.notes.get(4)).toBeUndefined()
    expect(reloaded.runtime.db.diff()['m90.notes']).toMatchObject({ upserts: [], deletes: [] })
  })

  it('a different storage format is discarded too', async () => {
    const tab = await boot()
    await post(tab, '/api/notes', { text: 'x' })
    await idbBackend()?.write([[META_KEY, { format: 0, seedVersion: tab.runtime.seedVersion }]])
    expect(await adapter().load(tab.runtime.seedVersion)).toBeNull()
  })
})

describe('clock offset (overview §6.12)', () => {
  it('first boot stores the anchor offset; later changes survive a rebuild', async () => {
    const first = await boot({ clock: createClock({ source: () => REAL_NOW }) })
    expect(first.runtime.clockStart).toBe('anchor')
    await first.persistence.flush()
    expect((await stored()).get(CLOCK_KEY)).toBe(anchorOffset(REAL_NOW))

    first.runtime.clock.advance(90_000) // e.g. mock.advanceTime
    await first.persistence.flush()

    // A reload an hour later (real time): the mock clock continues from the stored offset.
    const laterClock = createClock({ source: () => REAL_NOW + 3_600_000 })
    const second = await boot({ clock: laterClock })
    expect(second.runtime.clockStart).toBe('persisted')
    expect(laterClock.getOffset()).toBe(anchorOffset(REAL_NOW) + 90_000)
    expect(laterClock.now()).toBe(Date.parse(TEST_NOW) + 90_000 + 3_600_000)
  })

  it('reset keeps the current clock offset', async () => {
    const tab = await boot()
    tab.runtime.clock.advance(5_000)
    await tab.runtime.reset()
    const reloaded = await boot()
    expect(reloaded.runtime.clockStart).toBe('persisted')
    expect(reloaded.runtime.clock.getOffset()).toBe(tab.runtime.clock.getOffset())
  })
})

describe('reset (clear)', () => {
  it('wipes the stored diff; a reload starts from fresh seeds', async () => {
    const tab = await boot()
    await post(tab, '/api/notes', { text: 'hilang' })
    tab.notes.remove(1)
    await tab.runtime.db.settled()

    await tab.runtime.reset()
    const keys = [...(await stored()).keys()].sort()
    expect(keys).toEqual([CLOCK_KEY, META_KEY].sort())

    const reloaded = await boot()
    expect(reloaded.notes.query().rows.map((r) => r.id)).toEqual([1, 2, 3])
  })
})

describe('cross-tab (BroadcastChannel)', () => {
  it('applies another tab’s commit in memory, and id counters merge forward only', async () => {
    const tabA = await boot()
    const tabB = await boot()
    expect(tabA.persistence.crossTabEnabled).toBe(true)

    await post(tabA, '/api/notes', { text: 'dari A' })
    await post(tabA, '/api/notes', { text: 'dari A lagi' })
    await vi.waitFor(() => expect(tabB.notes.get(5)?.text).toBe('dari A lagi'))
    expect(tabB.notes.get(4)?.text).toBe('dari A')

    // B's counter moved past A's ids: its next note does not collide.
    const res = await post(tabB, '/api/notes', { text: 'dari B' })
    expect(res.body).toMatchObject({ data: { id: 6 } })
    await vi.waitFor(() => expect(tabA.notes.get(6)?.text).toBe('dari B'))

    // A stale message (older counter) never moves B's counter back.
    const stale = new BroadcastChannel(channelName)
    const msg: MockBroadcast = {
      type: 'commit',
      seedVersion: tabB.runtime.seedVersion,
      seq: 1,
      changes: {
        'm90.notes': {
          kind: 'table',
          upserts: [{ id: 4, userId: 1, text: 'dari A', luck: 0 }],
          deletes: [],
          ids: { kind: 'maxPlusOne', hw: 4 },
        },
      },
    }
    stale.postMessage(msg)
    stale.close()
    await new Promise((r) => setTimeout(r, 20))
    expect(tabB.notes.insert({ userId: 1, text: 'B lagi', luck: 0 }).id).toBe(7)
  })

  it('ignores messages from another seed version', async () => {
    const tabB = await boot()
    const other = new BroadcastChannel(channelName)
    other.postMessage({
      type: 'commit',
      seedVersion: 'old-deploy',
      seq: 1,
      changes: {
        'm90.notes': {
          kind: 'table',
          upserts: [{ id: 40, userId: 1, text: 'lama', luck: 0 }],
          deletes: [],
          ids: null,
        },
      },
    } satisfies MockBroadcast)
    other.close()
    await new Promise((r) => setTimeout(r, 20))
    expect(tabB.notes.get(40)).toBeUndefined()
  })

  it('a reset in one tab re-seeds the others (with the same overrides)', async () => {
    const tabA = await boot()
    const tabB = await boot()
    await post(tabA, '/api/notes', { text: 'sebelum reset' })
    await vi.waitFor(() => expect(tabB.notes.get(4)).toBeDefined())

    await tabA.runtime.reset()
    await vi.waitFor(() => expect(tabB.notes.get(4)).toBeUndefined())
    expect(tabB.notes.size).toBe(3)

    // With overrides (what `runtime.reset(overrides)` sends once F-06 forwards them to `clear`).
    await tabA.persistence.clear({ extraNotes: 2 })
    await vi.waitFor(() => expect(tabB.notes.get(4)?.text).toBe('extra 0'))
    expect(tabB.notes.size).toBe(5)
    // The re-seed in B does not wipe or re-broadcast.
    expect([...(await stored()).keys()].sort()).toEqual([CLOCK_KEY, META_KEY].sort())
  })
})

describe('failures and degradation', () => {
  it('a failed IndexedDB write becomes COMMIT_FAILED (500 SERVER_ERROR)', async () => {
    const backend: PersistBackend = {
      readAll: () => Promise.resolve(new Map()),
      write: () => Promise.reject(new Error('QuotaExceededError')),
      replace: () => Promise.resolve(),
    }
    const tab = await boot({ backend })
    const res = await post(tab, '/api/notes', { text: 'penuh' })
    expect(res).toMatchObject({ status: 500, body: { error: { code: 'SERVER_ERROR' } } })
    expect(tab.errors[0]).toMatchObject({ code: 'COMMIT_FAILED' })

    tab.notes.insert({ userId: 1, text: 'direct', luck: 0 })
    await expect(tab.runtime.db.settled(tab.runtime.db.lastSeq)).rejects.toMatchObject({
      code: 'COMMIT_FAILED',
      seq: tab.runtime.db.lastSeq,
    })
  })

  it('works in memory only when IndexedDB is missing', async () => {
    const saved = globalThis.indexedDB
    // @ts-expect-error simulate a browser without IndexedDB
    delete globalThis.indexedDB
    try {
      const warn = vi.fn()
      const tab = await boot({ warn })
      expect(tab.persistence.storageEnabled).toBe(false)
      expect(warn).toHaveBeenCalled()
      const res = await post(tab, '/api/notes', { text: 'memori' })
      expect(res.status).toBe(201)
      expect(tab.notes.get(4)?.text).toBe('memori')
    } finally {
      globalThis.indexedDB = saved
    }
  })

  it('turns storage off when IndexedDB cannot be read (private mode)', async () => {
    const write = vi.fn(() => Promise.resolve())
    const backend: PersistBackend = {
      readAll: () => Promise.reject(new DOMException('denied', 'InvalidStateError')),
      write,
      replace: vi.fn(() => Promise.resolve()),
    }
    const tab = await boot({ backend })
    expect(tab.persistence.storageEnabled).toBe(false)
    expect((await post(tab, '/api/notes', { text: 'ok' })).status).toBe(201)
    expect(write).not.toHaveBeenCalled()
  })

  it('works in the current tab only when BroadcastChannel is missing', async () => {
    const tab = await boot({ channel: null })
    expect(tab.persistence.crossTabEnabled).toBe(false)
    expect((await post(tab, '/api/notes', { text: 'solo' })).status).toBe(201)
    const throwing = await boot({
      channel: () => {
        throw new Error('SecurityError')
      },
    })
    expect(throwing.persistence.crossTabEnabled).toBe(false)
  })
})
