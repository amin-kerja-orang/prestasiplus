/**
 * Answer checking of the five single-player games (D58a, issue #78).
 *
 * The real API (http mode) sends keyless payloads: the engines cannot read `is_true`, `correct`, `answer`,
 * `pair_id` or a Kad Memori face. Every answer is posted to `POST /games/solo/{game}/check` (Kad Memori: the
 * first card of a move to `POST /games/solo/kad-memori/reveal`), and the server returns the verdict plus the key
 * of that item. The in-browser mock still sends the keys and has no check route, so in mock mode the verdict is
 * computed from the payload, synchronously, exactly as before (the mock UX and its tests are unchanged).
 *
 * A judge returns the result directly in mock mode and a Promise in http mode (`Judged<T>`); `settle()` applies
 * it at once when it is not a Promise. In http mode a failed call resolves to `null` (logged as "Check error:");
 * the engine decides what `null` means (no score, the move is undone, or the tap is allowed again).
 */
import { isApiError } from '@/api'
import { isHttpMode } from '@/api/mode'

import { checkSoloAnswer, revealKadMemoriCard } from '../../api'
import type { KadMemoriPayload, SoloCheckBodies, SoloCheckResults, SoloGame, SoloItemId } from '../../api'
import { susunMatches } from './solo-lib'

export type Judged<T> = T | Promise<T>

/**
 * The server answered 409: the item was already checked (one check per item). It will never be accepted, so the
 * engine resolves the item locally with 0 points and must not post it again. A plain failure stays `null`.
 */
export const CONFLICT = 'conflict' as const
export type Conflict = typeof CONFLICT

/** What is safe to log about a failure: the HTTP status of an API error, else the error name (never a message or body). */
export function errorInfo(e: unknown): number | string {
  if (isApiError(e)) return e.status
  return e instanceof Error ? e.name : 'unknown'
}

/**
 * Applies `r` now when it is a value, or when the Promise settles (an error inside `apply` is not a check error).
 * An exception thrown by `apply` of a settled Promise is logged ("Apply error:", name only) and `onApplyError`
 * runs so the page can release its lock (it also runs when the Promise itself rejects); it never becomes an unhandled rejection.
 */
export function settle<T>(r: Judged<T>, apply: (v: T) => void, onApplyError?: () => void): void {
  if (r instanceof Promise) {
    r.then(apply, (e: unknown) => {
      console.error('Check error:', errorInfo(e))
      onApplyError?.() // a judge that rejects (not expected: they resolve null) must not leave the page locked either
    }).catch((e: unknown) => {
      console.error('Apply error:', errorInfo(e))
      onApplyError?.()
    })
  } else apply(r)
}

/** The item id of a check body: ids are opaque strings on the wire (ADR-0018 item 6). */
const wireId = (id: SoloItemId): string => String(id)

type Checked<R> = { ok: true; data: R } | { ok: false; conflict: boolean }

/** Logs a failed call (status or error name only, never a key, an answer or a message); `true` for a 409. */
function logFailure(e: unknown): boolean {
  console.error('Check error:', errorInfo(e))
  return isApiError(e) && e.status === 409
}

async function post<G extends SoloGame>(
  game: G,
  body: SoloCheckBodies[G],
  track: Inflight | undefined,
): Promise<Checked<SoloCheckResults[G]>> {
  const call: Promise<Checked<SoloCheckResults[G]>> = checkSoloAnswer(game, body).then(
    (data) => ({ ok: true as const, data }),
    (e: unknown) => ({ ok: false as const, conflict: logFailure(e) }),
  )
  track?.add(call)
  return call
}

/** `null` for a plain failure, `CONFLICT` for a 409, else the mapped result. */
function verdictOf<R, T>(c: Checked<R>, map: (r: R) => T): T | null | Conflict {
  if (c.ok) return map(c.data)
  return c.conflict ? CONFLICT : null
}

/**
 * The checks still in flight. The submit waits for them, so a check never reaches the server after the
 * session was submitted (that would be 409 and the answer would not count).
 */
export interface Inflight {
  add(p: Promise<unknown>): void
  idle(): Promise<void>
  readonly size: number
}

export function createInflight(): Inflight {
  const pending = new Set<Promise<unknown>>()
  return {
    add(p) {
      pending.add(p)
      void p.finally(() => pending.delete(p))
    },
    async idle() {
      while (pending.size > 0) await Promise.allSettled([...pending])
    },
    get size() {
      return pending.size
    },
  }
}

// --- Betul atau Salah -----------------------------------------------------------------------------------------

export function judgeBetulSalah(
  sessionId: string,
  item: { id: SoloItemId; is_true?: boolean },
  answer: boolean,
  track?: Inflight,
): Judged<{ correct: boolean } | null | Conflict> {
  if (!isHttpMode()) return { correct: answer === item.is_true }
  return post('betul-salah', { session_id: sessionId, item_id: wireId(item.id), answer }, track).then((c) =>
    verdictOf(c, (r) => ({ correct: r.correct })),
  )
}

// --- Cabaran Kilat ------------------------------------------------------------------------------------------------

export function judgeCabaranKilat(
  sessionId: string,
  question: { id: SoloItemId; options: { id: number; correct?: boolean }[] },
  optionId: number,
  track?: Inflight,
): Judged<{ correct: boolean; correctOptionId: number | null } | null | Conflict> {
  if (!isHttpMode()) {
    return {
      correct: question.options.find((o) => o.id === optionId)?.correct === true,
      correctOptionId: question.options.find((o) => o.correct === true)?.id ?? null,
    }
  }
  return post('cabaran-kilat', { session_id: sessionId, item_id: wireId(question.id), option_id: optionId }, track).then((c) =>
    verdictOf(c, (r) => ({ correct: r.correct, correctOptionId: r.correct_option_id })),
  )
}

// --- Tembak Jawapan -------------------------------------------------------------------------------------------------

export function judgeTembakJawapan(
  sessionId: string,
  question: { id: SoloItemId; options: { correct?: boolean }[] },
  optionIndex: number,
  track?: Inflight,
): Judged<{ correct: boolean; correctIndex: number | null } | null | Conflict> {
  if (!isHttpMode()) {
    const key = question.options.findIndex((o) => o.correct === true)
    return { correct: question.options[optionIndex]?.correct === true, correctIndex: key < 0 ? null : key }
  }
  return post(
    'tembak-jawapan',
    { session_id: sessionId, item_id: wireId(question.id), option_index: optionIndex },
    track,
  ).then((c) => verdictOf(c, (r) => ({ correct: r.correct, correctIndex: r.correct_option_index })))
}

// --- Susun Jawapan --------------------------------------------------------------------------------------------------

/** The answer string the placed tiles build (letters joined, words joined by a space). */
export function susunBuilt(tiles: readonly string[], type: 'letters' | 'words'): string {
  return tiles.join(type === 'words' ? ' ' : '')
}

export function judgeSusunJawapan(
  sessionId: string,
  puzzle: { id: SoloItemId; type: 'letters' | 'words'; answer?: string },
  tiles: string[],
  track?: Inflight,
): Judged<{ correct: boolean; answer: string | null } | null | Conflict> {
  if (!isHttpMode()) {
    return { correct: susunMatches(tiles, puzzle.type, puzzle.answer ?? ''), answer: puzzle.answer ?? null }
  }
  const answer = susunBuilt(tiles, puzzle.type).trim().slice(0, 200)
  return post('susun-jawapan', { session_id: sessionId, item_id: wireId(puzzle.id), answer }, track).then((c) =>
    verdictOf(c, (r) => ({ correct: r.correct, answer: r.answer })),
  )
}

// --- Kad Memori -----------------------------------------------------------------------------------------------------

type MemoryCard = KadMemoriPayload['cards'][number]
export interface Face {
  type: 'question' | 'answer'
  content: string
}

const faceOfCard = (c: MemoryCard | undefined): Face | null =>
  c?.type !== undefined && c.content !== undefined ? { type: c.type, content: c.content } : null

/** The face of the first card of a move: from the payload (mock) or the reveal route (http). */
export function revealCard(sessionId: string, card: MemoryCard, track?: Inflight): Judged<Face | null> {
  if (!isHttpMode()) return faceOfCard(card)
  const call = revealKadMemoriCard({ session_id: sessionId, card_id: wireId(card.id) })
    .then((f): Face => ({ type: f.type, content: f.content }))
    .catch((e: unknown) => {
      logFailure(e)
      return null
    })
  track?.add(call)
  return call
}

/** A move: both faces plus the verdict (mock: same pair and different type, as before). */
export function judgePair(
  sessionId: string,
  a: MemoryCard,
  b: MemoryCard,
  track?: Inflight,
): Judged<{ correct: boolean; faces: [Face | null, Face | null] } | null> {
  if (!isHttpMode()) {
    return {
      correct: a.pair_id !== undefined && a.pair_id === b.pair_id && a.type !== b.type,
      faces: [faceOfCard(a), faceOfCard(b)],
    }
  }
  return post('kad-memori', { session_id: sessionId, card_id: wireId(a.id), other_card_id: wireId(b.id) }, track).then(
    (c) => (c.ok ? { correct: c.data.correct, faces: [c.data.cards[0], c.data.cards[1]] } : null),
  )
}
