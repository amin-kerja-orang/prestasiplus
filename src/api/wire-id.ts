/**
 * Entity ids on the wire (DEMO-FIX-1). The real API (`packages/contract`, `IdSchema`) takes every
 * entity id as an opaque string and answers 422 for a number; the in-browser mock parses numbers.
 * Http adapters pass ids through these helpers so one call site serves both transports:
 * http mode sends `String(id)`, mock mode keeps the value it was given.
 */

import { isHttpMode } from './mode'

/** An entity id as the UI holds it: a mock number, or the opaque string the real API returned. */
export type EntityId = number | string

/** The id as the active transport expects it (a string in http mode). */
export function wireId<T extends EntityId>(id: T): T | string {
  return isHttpMode() ? String(id) : id
}

/** `wireId` that keeps `null` and `undefined` as they are (optional / nullable body fields). */
export function wireIdOpt<T extends EntityId | null | undefined>(id: T): T | string {
  if (id === null || id === undefined) return id
  return wireId(id)
}
