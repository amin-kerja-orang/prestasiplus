import 'reflect-metadata'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { INestApplication } from '@nestjs/common'
import { Logger } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import type { Response as SuperResponse } from 'supertest'
import { vi } from 'vitest'

import { runSeeds } from '../../prisma/seed'
import { identitySeed } from '../../prisma/seed/core/identity'
import { schoolsSeed } from '../../prisma/seed/core/schools'
import { defineAppModule } from '../../src/app.module'
import { configureApp } from '../../src/configure-app'
import { CLOCK, FixedClock } from '../../src/db/clock'
import { AiExtractionModule } from '../../src/modules/ai-extraction'
import { AiConfig } from '../../src/modules/ai-extraction/ai.config'
import { AI_FETCH, AI_RESOLVER, AI_SLEEP } from '../../src/modules/ai-extraction/ai.constants'
import type { AiFetch, AiFetchInit, AiResolver } from '../../src/modules/ai-extraction/ai.types'
import { AuthModule } from '../../src/modules/auth'
import { UsersModule } from '../../src/modules/users'
import { loginAs, START, type LoggedIn } from '../auth/helpers'
import { createTestDatabase, type TestDatabase } from '../support/db'

export { START, expectError } from '../auth/helpers'

export const ADMIN = 'admin@demo.test'
export const TEACHER = 'guru@demo.test'
export const SCHOOL_ADMIN = 'adminsekolah@demo.test'
export const STUDENT = 'pelajar@demo.test'

/** A fake key. Every leak test greps for it. */
export const FAKE_KEY = 'x'.repeat(40)

export interface FetchCall {
  url: string
  method: string
  headers: Record<string, string>
  body: string
  pinned: readonly string[] | undefined
  redirect: string
  signal: AbortSignal
}
export type FetchHandler = (call: FetchCall, n: number) => Response | Promise<Response>

export const jsonResponse = (body: unknown, status = 200, headers: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })

/** A fetch stand-in that records every call and answers with `handler`. Nothing here touches the network. */
export function stubFetch(handler: FetchHandler = () => jsonResponse({}, 500)): { fn: AiFetch; calls: FetchCall[]; handler: FetchHandler; set(h: FetchHandler): void } {
  const state = { calls: [] as FetchCall[], handler }
  const fn: AiFetch = async (url: string, init: AiFetchInit) => {
    const call: FetchCall = { url, method: init.method, headers: init.headers, body: init.body, pinned: init.pinnedAddresses, redirect: init.redirect, signal: init.signal }
    state.calls.push(call)
    return state.handler(call, state.calls.length)
  }
  return {
    fn,
    calls: state.calls,
    get handler() {
      return state.handler
    },
    set(h: FetchHandler) {
      state.handler = h
    },
  }
}

export const publicResolver: AiResolver = () => Promise.resolve(['93.184.216.34'])

export function fixture<T = Record<string, unknown>>(name: string): T {
  return JSON.parse(readFileSync(fileURLToPath(new URL(`./fixtures/${name}`, import.meta.url)), 'utf8')) as T
}

/** Every environment variable this module reads, unset, so a test starts from the defaults. */
const AI_ENV_KEYS = [
  'AI_PROVIDER', 'AI_MODEL', 'AI_API_KEY', 'AI_BASE_URL', 'AI_BASE_URL_ALLOWLIST', 'AI_TIMEOUT_MS', 'AI_MAX_CONCURRENCY',
  'AI_RATE_LIMIT_PER_MIN', 'AI_RATE_LIMIT_PER_USER_PER_MIN', 'AI_RATE_LIMIT_PER_SCHOOL_PER_MIN', 'AI_MAX_RETRIES', 'AI_RETRY_BASE_MS',
  'AI_MONTHLY_BUDGET_SEN', 'AI_PRICE_TABLE_JSON', 'THROTTLE_AI_READ_PER_MINUTE', 'THROTTLE_AI_WRITE_PER_MINUTE',
] as const

export interface AiTestApp {
  app: INestApplication
  db: TestDatabase
  clock: FixedClock
  fetch: ReturnType<typeof stubFetch>
  sleeps: number[]
  http(): TestAgent
  agent(): TestAgent
  close(): Promise<void>
}

export interface BootAiOptions {
  env?: Record<string, string | undefined>
  fetch?: ReturnType<typeof stubFetch>
  resolver?: AiResolver
  /** Default: records the delay and returns at once (no real waiting). */
  sleep?: (ms: number, signal?: AbortSignal) => Promise<void>
  db?: TestDatabase
  /** Extra Nest modules (the wiring test adds the intake files module). */
  modules?: Parameters<typeof defineAppModule>[0]
}

/** Nest app with auth, users and the AI module on a private migrated database; fetch, DNS, sleep and clock are stubs. */
export async function bootAiApp(opts: BootAiOptions = {}): Promise<AiTestApp> {
  const db = opts.db ?? (await createTestDatabase())
  if (!opts.db) await runSeeds([identitySeed, schoolsSeed], { prisma: db.prisma })
  const env: Record<string, string | undefined> = {
    DATABASE_URL: db.url,
    COOKIE_SECURE: 'false',
    SESSION_SECRET: 'test-secret-0123456789abcdef',
    SESSION_COOKIE_NAME: undefined,
    COOKIE_DOMAIN: undefined,
    THROTTLE_LOGIN_PER_MINUTE: undefined,
    TRUST_PROXY_HOPS: undefined,
    LEGACY_BCRYPT_DUMMY_COST: '4',
    LOGIN_FAILURE_FLOOR_MS: '0',
    LOGIN_IDENTIFIER_FAIL_LIMIT: undefined,
    ...Object.fromEntries(AI_ENV_KEYS.map((k) => [k, undefined])),
    AI_RATE_LIMIT_PER_MIN: '100000',
    AI_RATE_LIMIT_PER_USER_PER_MIN: '100000',
    AI_RATE_LIMIT_PER_SCHOOL_PER_MIN: '100000',
    THROTTLE_AI_READ_PER_MINUTE: '1000',
    THROTTLE_AI_WRITE_PER_MINUTE: '1000',
    ...opts.env,
  }
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k]
    else process.env[k] = v
  }
  const clock = new FixedClock(START)
  const fetch = opts.fetch ?? stubFetch()
  const sleeps: number[] = []
  const sleep = opts.sleep ?? ((ms: number) => (sleeps.push(ms), Promise.resolve()))
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule([AuthModule, UsersModule, AiExtractionModule, ...(opts.modules ?? [])])],
  })
    .overrideProvider(CLOCK)
    .useValue(clock)
    .overrideProvider(AI_FETCH)
    .useValue(fetch.fn)
    .overrideProvider(AI_RESOLVER)
    .useValue(opts.resolver ?? publicResolver)
    .overrideProvider(AI_SLEEP)
    .useValue(sleep)
    .compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  return {
    app,
    db,
    clock,
    fetch,
    sleeps,
    http: () => request(app.getHttpServer()) as unknown as TestAgent,
    agent: () => request.agent(app.getHttpServer()) as unknown as TestAgent,
    async close() {
      await app.close()
      if (!opts.db) await db.drop()
    },
  }
}

type AuthLike = Parameters<typeof loginAs>[0]
export const login = (t: AiTestApp, identifier: string): Promise<LoggedIn> => loginAs(t as unknown as AuthLike, identifier)

export const get = (who: LoggedIn, path: string): Promise<SuperResponse> => who.agent.get(`/api${path}`)
export const put = (who: LoggedIn, path: string, body: unknown, csrf: string | null = who.csrf): Promise<SuperResponse> => {
  const r = who.agent.put(`/api${path}`)
  return (csrf === null ? r : r.set('X-CSRF-Token', csrf)).send(body as object)
}
export const post = (who: LoggedIn, path: string, body: unknown = {}, csrf: string | null = who.csrf): Promise<SuperResponse> => {
  const r = who.agent.post(`/api${path}`)
  return (csrf === null ? r : r.set('X-CSRF-Token', csrf)).send(body as object)
}

/** Captures what the Nest `Logger` is asked to write while a test runs (all levels), without silencing it. */
export function captureLogs(): { lines: string[]; restore(): void } {
  const lines: string[] = []
  const spies = (['log', 'warn', 'error', 'debug', 'verbose', 'fatal'] as const).map((level) =>
    vi.spyOn(Logger.prototype, level).mockImplementation((...args: unknown[]) => {
      lines.push(args.map((a) => (typeof a === 'string' ? a : a instanceof Error ? `${a.name}: ${a.message}\n${a.stack ?? ''}` : JSON.stringify(a))).join(' '))
    }),
  )
  return { lines, restore: () => spies.forEach((s) => s.mockRestore()) }
}

/** Every text column of every AI table, as one string (the grep target of the "no key, no content in the database" test). */
export async function dumpAiTables(db: TestDatabase): Promise<string> {
  const parts: string[] = []
  for (const t of ['ai_usage_logs', 'ai_extraction_runs', 'ai_settings', 'audit_events', 'notifications']) {
    parts.push(JSON.stringify(await db.query(`select * from ${t}`)))
  }
  return parts.join('\n')
}

export async function insertAdmin(db: TestDatabase, email: string, opts: { active?: boolean; suspended?: boolean } = {}): Promise<string> {
  const rows = await db.query<{ id: string }>(`insert into users (name, email, is_active, is_suspended) values ('Admin Pusat Rekaan', $1, $2, $3) returning id::text`, [email, opts.active ?? true, opts.suspended ?? false])
  const id = rows[0]?.id as string
  await db.query(`insert into user_roles (user_id, role) values ($1::bigint, 'admin')`, [id])
  return id
}

export async function insertUsageRow(db: TestDatabase, row: { provider: string; costSen: number; at: string; purpose?: string }): Promise<void> {
  await db.query(`insert into ai_usage_logs (provider, model, purpose, cost_sen, created_at) values ($1, 'model-x', $2, $3, $4::timestamptz)`, [row.provider, row.purpose ?? 'extract_paper', row.costSen, row.at])
}

/** An `AiConfig` over a plain map (no Nest app): the unit tests of adapters and limits. */
export function makeConfig(env: Record<string, string>): AiConfig {
  return new AiConfig({ get: (k: string) => env[k] } as never)
}

export const VENDORS = [
  { id: 'anthropic', host: 'api.anthropic.com' },
  { id: 'openai', host: 'api.openai.com' },
  { id: 'gemini', host: 'generativelanguage.googleapis.com' },
  { id: 'openai-compatible', host: 'gateway.example.test' },
] as const

/** Environment of a configured real provider (fake key, fake gateway host). */
export function vendorEnv(id: (typeof VENDORS)[number]['id']): Record<string, string> {
  return {
    AI_PROVIDER: id,
    AI_MODEL: 'model-x',
    AI_API_KEY: FAKE_KEY,
    ...(id === 'openai-compatible' ? { AI_BASE_URL: 'https://gateway.example.test/v1', AI_BASE_URL_ALLOWLIST: 'gateway.example.test' } : {}),
  }
}
