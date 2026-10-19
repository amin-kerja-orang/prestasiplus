/**
 * Pre-boot init (overview §6.13, ADR-0011): `window.__MOCK_INIT__ = { now?, latency?, seed?,
 * overrides?, session? }`, set by Playwright with `page.addInitScript` before the app script runs.
 *
 * `readMockInit` validates it (a typo in a test must fail loudly, not be ignored) and splits it into
 * the part `bootMock` applies (`now`, `latency`, `seed`, `overrides`) and the `session`, which is
 * applied after boot through the `setUser` hook (`applyInitSession`), before the first request.
 */

import type { MockInit } from '../index'
import type { MockInitData, MockInitSession, MockTestHooks } from './contract'
import type { HookTarget } from './hooks'

export const MOCK_INIT_GLOBAL = '__MOCK_INIT__'

const KNOWN_KEYS = new Set(['now', 'latency', 'seed', 'overrides', 'session'])

export interface ReadMockInit {
  /** What `bootMock({ init })` takes. */
  init: MockInit
  /** `__MOCK_INIT__.session`, if any (applied after boot). */
  session: MockInitSession | null
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function invalid(what: string, value: unknown): Error {
  return new TypeError(`__MOCK_INIT__.${what}: invalid value ${JSON.stringify(value)}`)
}

function checkMs(what: string, value: unknown): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) throw invalid(what, value)
  return value
}

function checkSession(value: unknown): MockInitSession | null {
  if (value === undefined || value === null) return null
  if (typeof value === 'string' && value.trim() !== '') return value
  if (typeof value === 'number' && Number.isInteger(value)) return value
  if (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((v) => ['string', 'number', 'boolean'].includes(typeof v))
  ) {
    return value as (string | number | boolean)[]
  }
  throw invalid('session', value)
}

/** Validates a `__MOCK_INIT__` value. Throws `TypeError` on unknown keys or wrong types. */
export function parseMockInit(raw: unknown): ReadMockInit {
  if (raw === undefined || raw === null) return { init: {}, session: null }
  if (!isPlainObject(raw)) throw new TypeError('__MOCK_INIT__ must be an object')
  for (const key of Object.keys(raw)) {
    if (!KNOWN_KEYS.has(key)) {
      throw new TypeError(
        `__MOCK_INIT__: unknown key '${key}' (expected ${[...KNOWN_KEYS].join(', ')})`,
      )
    }
  }
  const data = raw as MockInitData
  const init: MockInit = {}

  if (data.now !== undefined && data.now !== null) {
    if (typeof data.now !== 'string' && typeof data.now !== 'number') throw invalid('now', data.now)
    init.now = data.now
  }
  if (data.latency !== undefined) {
    if (typeof data.latency === 'number') {
      init.latency = checkMs('latency', data.latency)
    } else if (isPlainObject(data.latency)) {
      const rules: Record<string, number> = {}
      for (const [pattern, ms] of Object.entries(data.latency)) {
        rules[pattern] = checkMs(`latency['${pattern}']`, ms)
      }
      init.latency = rules
    } else {
      throw invalid('latency', data.latency)
    }
  }
  if (data.seed !== undefined) {
    if (typeof data.seed !== 'number' || !Number.isInteger(data.seed)) {
      throw invalid('seed', data.seed)
    }
    init.seed = data.seed
  }
  if (data.overrides !== undefined) {
    if (!isPlainObject(data.overrides)) throw invalid('overrides', data.overrides)
    init.overrides = data.overrides
  }
  return { init, session: checkSession(data.session) }
}

/** Reads and validates `window.__MOCK_INIT__` (absent → empty init). */
export function readMockInit(target: HookTarget = globalThis): ReadMockInit {
  return parseMockInit(target[MOCK_INIT_GLOBAL])
}

/** Logs in the pre-boot session through the `setUser` hook (F-11). */
export async function applyInitSession(
  hooks: MockTestHooks,
  session: MockInitSession | null,
): Promise<void> {
  if (session === null) return
  const args = Array.isArray(session) ? [...(session as (string | number | boolean)[])] : [session]
  await hooks.setUser(...(args as (string | number | boolean)[]))
}
