/**
 * Client autosave (US-11, AC-13.2). Every change is written to local storage first (so a refresh or
 * crash loses nothing), then sent to the server debounced (default 800 ms) as an idempotent
 * per-part update with a revision. `flush()` sends everything pending; submit always calls it and
 * ALSO carries the full local answer set, which fixes the .cloud race (N-01) where the debounce
 * had not fired when the student tapped Hantar.
 */
import type { KeyValueStore } from '../server/store'
import type { PartAnswer, SavePayload, StoredAnswer } from '../domain/types'

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'offline' | 'error' | 'closed'

export interface AutosaveApi {
  save(payload: SavePayload): Promise<unknown>
}

interface LocalDoc {
  answers: Record<string, StoredAnswer>
  pending: string[]
  flags: string[]
  picks: Record<string, string[]>
  position: number
  metaDirty: boolean
}

export const LOCAL_PREFIX = 'pp.bijak.local.'

export interface AutosaveOptions {
  attemptId: string
  storage: KeyValueStore
  api: AutosaveApi
  debounceMs?: number
  retryMs?: number
  now?: () => number
  onStatus?: (status: SaveStatus) => void
  /** The server reports the attempt closed (deadline passed); the page then opens its Semakan and clears the local copy. */
  onClosed?: () => void
}

export interface Autosave {
  /** Merge what the server holds with what this device holds (higher revision wins per part). */
  init(server: {
    answers: Record<string, StoredAnswer>
    flags: string[]
    picks: Record<string, string[]>
    position: number
  }): void
  setAnswer(partId: string, answer: PartAnswer): void
  setFlags(flags: string[]): void
  setPicks(picks: Record<string, string[]>): void
  setPosition(position: number): void
  flush(): Promise<boolean>
  answers(): Record<string, PartAnswer>
  flags(): string[]
  picks(): Record<string, string[]>
  position(): number
  /** The complete local answer set, for the submit request. */
  snapshot(): {
    answers: Record<string, StoredAnswer>
    flags: string[]
    picks: Record<string, string[]>
    position: number
  }
  pendingCount(): number
  status(): SaveStatus
  dispose(): void
}

export function createAutosave(opts: AutosaveOptions): Autosave {
  const key = `${LOCAL_PREFIX}${opts.attemptId}`
  const debounceMs = opts.debounceMs ?? 800
  const retryMs = opts.retryMs ?? 5000
  const now = opts.now ?? (() => Date.now())
  let doc: LocalDoc = {
    answers: {},
    pending: [],
    flags: [],
    picks: {},
    position: 0,
    metaDirty: false,
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  let retry: ReturnType<typeof setTimeout> | undefined
  let current: SaveStatus = 'idle'
  let inFlight: Promise<boolean> | null = null
  let disposed = false
  let closed = false

  const setStatus = (s: SaveStatus): void => {
    current = s
    opts.onStatus?.(s)
  }

  const writeLocal = (): boolean => {
    try {
      opts.storage.setItem(key, JSON.stringify(doc))
      return true
    } catch {
      return false
    }
  }

  const readLocal = (): LocalDoc | null => {
    try {
      const raw = opts.storage.getItem(key)
      return raw ? (JSON.parse(raw) as LocalDoc) : null
    } catch {
      return null
    }
  }

  const schedule = (): void => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      timer = undefined
      void flush()
    }, debounceMs)
  }

  const touched = (): void => {
    writeLocal()
    setStatus('saving')
    schedule()
  }

  async function send(): Promise<boolean> {
    const parts = [...doc.pending]
    const revs = new Map(parts.map((p) => [p, doc.answers[p]?.rev ?? 0]))
    const payload: SavePayload = {
      changes: parts.map((partId) => {
        const st = doc.answers[partId]!
        return { partId, answer: st.answer, rev: st.rev, savedAt: st.savedAt }
      }),
      flags: doc.flags,
      picks: doc.picks,
      position: doc.position,
    }
    try {
      const res = (await opts.api.save(payload)) as { closed?: boolean } | undefined
      if (res?.closed) {
        closed = true
        setStatus('closed')
        opts.onClosed?.()
        return false
      }
    } catch (e) {
      setStatus((e as { code?: string }).code === 'offline' ? 'offline' : 'error')
      if (!disposed) {
        if (retry) clearTimeout(retry)
        retry = setTimeout(() => void flush(), retryMs)
      }
      return false
    }
    // Keep a part pending when it changed again while the request was in flight.
    doc.pending = doc.pending.filter((p) => (doc.answers[p]?.rev ?? 0) !== revs.get(p))
    if (!doc.pending.length) doc.metaDirty = false
    writeLocal()
    return true
  }

  async function flush(): Promise<boolean> {
    if (closed) return false
    if (timer) {
      clearTimeout(timer)
      timer = undefined
    }
    if (inFlight) await inFlight.catch(() => false)
    for (let round = 0; round < 4; round++) {
      if (!doc.pending.length && !doc.metaDirty) {
        setStatus('saved')
        return true
      }
      setStatus('saving')
      inFlight = send()
      const ok = await inFlight
      inFlight = null
      if (!ok) return false
    }
    return !doc.pending.length
  }

  return {
    init(server) {
      const local = readLocal()
      const merged: Record<string, StoredAnswer> = { ...server.answers }
      const pending = new Set(local?.pending ?? [])
      for (const [id, st] of Object.entries(local?.answers ?? {})) {
        const srv = merged[id]
        if (!srv || st.rev > srv.rev) {
          merged[id] = st
          pending.add(id)
        } else pending.delete(id)
      }
      const localNewer = !!local && local.metaDirty
      doc = {
        answers: merged,
        pending: [...pending],
        flags: localNewer ? local.flags : server.flags,
        picks: localNewer ? local.picks : server.picks,
        position: localNewer ? local.position : server.position,
        metaDirty: localNewer,
      }
      writeLocal()
      if (doc.pending.length || doc.metaDirty) {
        setStatus('saving')
        schedule()
      }
    },
    setAnswer(partId, answer) {
      const rev = (doc.answers[partId]?.rev ?? 0) + 1
      doc.answers[partId] = { answer, rev, savedAt: now() }
      if (!doc.pending.includes(partId)) doc.pending.push(partId)
      touched()
    },
    setFlags(flags) {
      doc.flags = flags
      doc.metaDirty = true
      touched()
    },
    setPicks(picks) {
      doc.picks = picks
      doc.metaDirty = true
      touched()
    },
    setPosition(position) {
      doc.position = position
      doc.metaDirty = true
      writeLocal()
      schedule()
    },
    flush,
    answers: () => Object.fromEntries(Object.entries(doc.answers).map(([k, v]) => [k, v.answer])),
    flags: () => doc.flags,
    picks: () => doc.picks,
    position: () => doc.position,
    snapshot: () => ({
      answers: { ...doc.answers },
      flags: doc.flags,
      picks: doc.picks,
      position: doc.position,
    }),
    pendingCount: () => doc.pending.length,
    status: () => current,
    dispose() {
      disposed = true
      if (timer) clearTimeout(timer)
      if (retry) clearTimeout(retry)
    },
  }
}

export function clearLocal(storage: KeyValueStore, attemptId: string): void {
  storage.removeItem(`${LOCAL_PREFIX}${attemptId}`)
}
