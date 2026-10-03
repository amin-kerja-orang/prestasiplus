/**
 * S1 chat logic (SRS M13 v1.1 FR-M13-15..22, 30): pure helpers, no DOM and no network.
 * Copy is the live copy (URS FN-M13-2.2.x), except the speaking status (PROPOSED, OQ-M13-09).
 */

import type { ChatErrorBody, ChatSendResponse } from '../../api'

export const CHAT_COPY = {
  botPrefix: 'Cikgu Alesa: ',
  userPrefix: 'Anda: ',
  thinking: 'Cikgu Alesa sedang berfikir…',
  noReply: '(tiada respon)',
  failed: 'Cikgu Alesa tak boleh respon. Cuba lagi.',
  quota: 'Quota habis untuk hari ni.',
  network: 'Ralat sambungan. Cuba lagi sebentar.',
  listening: 'Mendengar...',
  noHear: 'Maaf, tak dengar.',
  micTitle: 'Tekan untuk cakap',
  micUnsupported: 'Browser tidak sokong voice — guna Chrome/Edge',
} as const

/** The two storage keys keep their live names (NFR-M13-07). */
export const VOICE_STORAGE_KEY = 'cikgu_voice_mode'
export const PENDING_ESSAY_KEY = 'cikgu_pending_essay'

/** FR-M13-30: a reply is spoken only when longer than this. */
export const SPEAK_MIN_CHARS = 10
/** FR-M13-32: dictation auto-submits only when longer than this. */
export const AUTO_SUBMIT_MIN_CHARS = 5
/** Pause between the error status and the end step of the recogniser (PROPOSED). */
export const VOICE_ERROR_HOLD_MS = 1000

export interface ChatMessage {
  id: number
  role: 'bot' | 'user'
  text: string
}

/** Text with one line per `\n`; rendered as text nodes with a `<br>` between lines (FR-M13-15). */
export function messageLines(text: string): string[] {
  return text.split('\n')
}

/** FR-M13-19: the usage line under the history. */
export function formatMeta(body: ChatSendResponse): string {
  const tokens = body.tokens as { in?: number; out?: number } | undefined
  return (
    `Tier: ${String(body.tier)} · Turns remaining: ${String(body.turns_remaining)}` +
    ` · Tool hops: ${String(body.tool_hops)} · Tokens: in=${String(tokens?.in)} out=${String(tokens?.out)}`
  )
}

/** FR-M13-30: simulated speaking time, 60 ms per character clamped to 1,500 to 8,000 ms. */
export function speakDuration(text: string): number {
  return Math.min(8000, Math.max(1500, 60 * [...text].length))
}

export type ChatOutcome =
  | { kind: 'reply'; threadId: string | null; reply: string; meta: string; speak: boolean }
  | { kind: 'error'; text: string; meta: string }
  | { kind: 'network'; text: string }

const isObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * FR-M13-19, 20: maps the raw result of `POST /api/cikgu/send` to what the screen shows. A body that
 * is not a JSON object (the live `res.json()` throwing) is the network branch.
 */
export function resolveChat(
  status: number,
  body: ChatSendResponse | ChatErrorBody | null,
  voiceOn: boolean,
): ChatOutcome {
  if (!isObject(body)) return { kind: 'network', text: CHAT_COPY.network }
  if (status >= 200 && status < 300) {
    const ok = body as unknown as ChatSendResponse
    const reply = typeof ok.reply === 'string' ? ok.reply : ''
    return {
      kind: 'reply',
      threadId: typeof ok.thread_id === 'string' && ok.thread_id !== '' ? ok.thread_id : null,
      reply: reply === '' ? CHAT_COPY.noReply : reply,
      meta: formatMeta(ok),
      speak: voiceOn && reply.length > SPEAK_MIN_CHARS,
    }
  }
  const err = body as ChatErrorBody
  return {
    kind: 'error',
    text: typeof err.error === 'string' && err.error !== '' ? err.error : CHAT_COPY.failed,
    meta: err.quota_exhausted === true ? CHAT_COPY.quota : '',
  }
}

export interface HandoffParts {
  rubric: string | null
  subject: string | null
  level: string | null
  student: string | null
  title: string | null
  essay: string
}

export interface Prefill {
  /** The text for the input, or `null` when nothing is prefilled. */
  text: string | null
  /** `true` when the stored essay was read (the caller removes the key). */
  consumedEssay: boolean
}

/**
 * FR-M13-21, 22: `?ask=` wins; otherwise `action=mark_essay` with a stored essay builds the hand-off
 * message (BR-M13-08). `query` is the raw query string (`+` decodes to a space, empty keys give '').
 */
export function resolvePrefill(
  query: string,
  storedEssay: string | null,
  buildHandoff: (parts: HandoffParts) => string,
): Prefill {
  const params = new URLSearchParams(query)
  const ask = params.get('ask')
  if (ask !== null && ask !== '') return { text: ask, consumedEssay: false }
  if (params.get('action') === 'mark_essay') {
    if (storedEssay === null) return { text: null, consumedEssay: false }
    if (storedEssay.trim() === '') return { text: null, consumedEssay: true }
    return {
      text: buildHandoff({
        rubric: params.get('rubric'),
        subject: params.get('subject'),
        level: params.get('level'),
        student: params.get('student'),
        title: params.get('title'),
        essay: storedEssay,
      }),
      consumedEssay: true,
    }
  }
  return { text: null, consumedEssay: false }
}
