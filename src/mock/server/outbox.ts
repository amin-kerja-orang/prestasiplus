/**
 * The mock outbox (overview §6.4 `ctx.outbox`, §6.13 `outbox.lastResetFor(email)`): messages the
 * real backend would send by e-mail or SMS, e.g. password-reset links (M01). Nothing leaves the
 * browser; tests read the messages back.
 */

import type { Clock } from '@/lib/time'

export interface OutboxMessageInput {
  /** Message kind, e.g. `'password-reset'`. */
  type: string
  /** Recipient, e.g. an e-mail address. Compared case-insensitively. */
  to: string
  subject?: string
  /** Any payload the test needs (token, link, …). */
  data?: Record<string, unknown>
}

export interface OutboxMessage extends OutboxMessageInput {
  /** 1, 2, 3… per outbox. */
  seq: number
  /** Mock-clock time (epoch ms) when it was sent. */
  sentAt: number
}

/**
 * What handlers get as `ctx.outbox`. Inside a request, messages are **queued** and delivered only
 * when the request's transaction commits, so a rolled-back write sends nothing.
 */
export interface OutboxWriter {
  send(message: OutboxMessageInput): void
}

export interface Outbox {
  send(message: OutboxMessageInput): OutboxMessage
  all(): readonly OutboxMessage[]
  /** The newest message of `type` (optionally to `to`), or `undefined`. */
  last(type: string, to?: string): OutboxMessage | undefined
  clear(): void
}

export function createOutbox(clock: Clock): Outbox {
  let messages: OutboxMessage[] = []
  let seq = 0

  return {
    send(input) {
      const message: OutboxMessage = { ...input, seq: ++seq, sentAt: clock.now() }
      messages.push(message)
      return message
    },
    all: () => messages,
    last(type, to) {
      const want = to?.toLowerCase()
      for (let i = messages.length - 1; i >= 0; i--) {
        const m = messages[i] as OutboxMessage
        if (m.type === type && (want === undefined || m.to.toLowerCase() === want)) return m
      }
      return undefined
    },
    clear() {
      messages = []
      seq = 0
    },
  }
}
