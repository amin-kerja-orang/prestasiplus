/**
 * Cross-tab channel of the mock (F-07; overview §6.11, ADR-0005 "Cross-tab").
 *
 * Every tab runs its own in-process mock. After a commit has been written to IndexedDB, the tab
 * posts it on `BroadcastChannel('pp-mock')`; the other tabs apply it in memory with
 * `db.applyChanges(...)` (id counters merge forward only). `mock.reset()` posts `reset`, and the
 * other tabs re-seed.
 *
 * Messages carry the seed version: a tab running a different seed version (an old tab left open
 * across a deploy) ignores them.
 *
 * The channel is optional. Where `BroadcastChannel` does not exist or cannot be opened, the opener
 * returns `null` and the mock keeps working in the current tab only.
 */

import type { ChangeSet } from './transaction'

/** `BroadcastChannel` name (ADR-0005). */
export const MOCK_CHANNEL_NAME = 'pp-mock'

/** A committed transaction of another tab (`CommitEvent` + the seed version). */
export interface MockCommitMessage {
  type: 'commit'
  seedVersion: string
  /** The sender's commit seq (diagnostics only; seqs are per tab). */
  seq: number
  changes: ChangeSet
}

/** Another tab ran `mock.reset(overrides)`. */
export interface MockResetMessage {
  type: 'reset'
  seedVersion: string
  overrides: Readonly<Record<string, unknown>>
}

export type MockBroadcast = MockCommitMessage | MockResetMessage

/** The part of `BroadcastChannel` the mock uses (tests may pass a fake). */
export interface BroadcastChannelLike {
  postMessage(message: unknown): void
  close(): void
  onmessage: ((event: MessageEvent) => void) | null
}

export interface MockChannel {
  /** Posts to every other tab. Never throws: a message that cannot be cloned is dropped with a warning. */
  post(message: MockBroadcast): void
  /** Receives well-formed messages from other tabs. Returns an unsubscribe function. */
  subscribe(listener: (message: MockBroadcast) => void): () => void
  close(): void
}

export type ChannelFactory = (name: string) => BroadcastChannelLike

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** Shape check for incoming messages (anything else on the channel is ignored). */
export function isMockBroadcast(value: unknown): value is MockBroadcast {
  if (!isRecord(value) || typeof value.seedVersion !== 'string') return false
  if (value.type === 'commit') return typeof value.seq === 'number' && isRecord(value.changes)
  if (value.type === 'reset') return isRecord(value.overrides)
  return false
}

function defaultFactory(): ChannelFactory | null {
  if (typeof BroadcastChannel === 'undefined') return null
  return (name) => new BroadcastChannel(name)
}

/**
 * Opens the cross-tab channel, or returns `null` when `BroadcastChannel` is unavailable (older
 * browsers, some private modes, or a factory that throws).
 */
export function openMockChannel(
  name: string = MOCK_CHANNEL_NAME,
  factory: ChannelFactory | null = defaultFactory(),
): MockChannel | null {
  if (!factory) return null
  let channel: BroadcastChannelLike
  try {
    channel = factory(name)
  } catch (error) {
    console.warn('[mock] BroadcastChannel unavailable; cross-tab sync is off', error)
    return null
  }

  const listeners = new Set<(message: MockBroadcast) => void>()
  channel.onmessage = (event: MessageEvent) => {
    const data: unknown = event.data
    if (!isMockBroadcast(data)) return
    for (const listener of listeners) {
      try {
        listener(data)
      } catch (error) {
        console.error('[mock] cross-tab listener failed', error)
      }
    }
  }

  return {
    post(message) {
      try {
        channel.postMessage(message)
      } catch (error) {
        console.warn('[mock] cross-tab message dropped', error)
      }
    },
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close() {
      listeners.clear()
      channel.onmessage = null
      channel.close()
    },
  }
}
