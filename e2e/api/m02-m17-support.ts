/**
 * Shared helpers of the M02 / M17 `@api` specs (EX-4). Plain `@playwright/test`, no mock fixtures.
 * Accounts and the password come from `./helpers` (`account()`), the password is never written here.
 *
 * - `openApiSession` signs a seed role in over the API in its own cookie jar (no browser page), so a
 *   spec can read and write as a second role while the page stays signed in as the first one.
 * - `filterControls` / `applyFilters` hide the one difference between the layouts: from `md` (768) the
 *   filter fields are inline with a "Cari" button, below it they sit in a bottom sheet behind "Penapis".
 */

import type { APIRequestContext, Browser, BrowserContext, Page, TestInfo } from '@playwright/test'

import { expect, test } from '../fixtures/api'
import { account, newPeerContext, type ApiRole } from './helpers'

/** Tailwind `md`: lists are tables from here, card lists below. */
export const TABLE_MIN_WIDTH = 768

/** The API error envelope (`{ error: { code, message, fields } }`). */
export interface ApiErrorBody {
  error: { code: string; message: string; fields?: Record<string, string> }
}

export interface ApiSession {
  /** GET `path`, returns status and the parsed JSON body (null when the body is not JSON). */
  get(path: string): Promise<{ status: number; body: unknown }>
  /** A write with the session's CSRF token. */
  send(
    method: 'POST' | 'PUT' | 'DELETE',
    path: string,
    data?: unknown,
  ): Promise<{ status: number; body: unknown }>
  dispose(): Promise<void>
}

async function parse(res: { text(): Promise<string> }): Promise<unknown> {
  const text = await res.text()
  try {
    return text === '' ? null : (JSON.parse(text) as unknown)
  } catch {
    return null
  }
}

/** Re-sends a request answered 429 (a per-user rate limit window) after the `retryAfter` the API names. */
async function withRetry(
  send: () => Promise<{ status: number; body: unknown }>,
): Promise<{ status: number; body: unknown }> {
  let res = await send()
  for (let attempt = 0; attempt < 4 && res.status === 429; attempt += 1) {
    const wait = (res.body as { error?: { retryAfter?: number } } | null)?.error?.retryAfter ?? 5
    await new Promise((resolve) => setTimeout(resolve, Math.min(wait, 20) * 1000 + 500))
    res = await send()
  }
  return res
}

async function sessionOf(context: BrowserContext): Promise<ApiSession> {
  const request: APIRequestContext = context.request
  const session = await request.get('/api/session')
  expect(session.status(), 'GET /api/session').toBe(200)
  const csrf = ((await session.json()) as { data: { csrf: string } }).data.csrf
  return {
    get: (path) =>
      withRetry(async () => {
        const res = await request.get(path)
        return { status: res.status(), body: await parse(res) }
      }),
    send: (method, path, data) =>
      withRetry(async () => {
        const res = await request.fetch(path, {
          method,
          headers: { 'x-csrf-token': csrf },
          ...(data === undefined ? {} : { data }),
        })
        return { status: res.status(), body: await parse(res) }
      }),
    dispose: () => context.close(),
  }
}

async function signedIn(
  browser: Browser,
  info: TestInfo,
  identifier: string,
  password: string,
): Promise<ApiSession> {
  const context = await newPeerContext(browser, info)
  const login = await context.request.post('/api/auth/login', { data: { identifier, password } })
  expect(login.status(), `POST /api/auth/login as ${identifier}`).toBe(200)
  return sessionOf(context)
}

/** Signs `role` in over the API (POST /api/auth/login) in an isolated cookie jar. */
export async function openApiSession(
  browser: Browser,
  info: TestInfo,
  role: ApiRole,
): Promise<ApiSession> {
  const { user, pass } = account(role)
  return signedIn(browser, info, user, pass)
}

/** The `data` member of a successful envelope; fails the test with the status when it is not one. */
export function dataOf<T>(res: { status: number; body: unknown }, what: string): T {
  expect(res.status, `${what}: ${JSON.stringify(res.body)}`).toBeLessThan(300)
  return (res.body as { data: T }).data
}

export function isTableLayout(page: Page): boolean {
  const size = page.viewportSize()
  if (!size) throw new Error('the page has no fixed viewport')
  return size.width >= TABLE_MIN_WIDTH
}

/** Below md the filter fields sit in a bottom sheet behind "Penapis"; from md they are inline. */
export async function filterControls(page: Page): Promise<void> {
  if (!isTableLayout(page)) {
    await page.locator('[data-ds="filter-open"]').click()
    await expect(page.locator('[data-ds="filter-sheet"]')).toBeVisible()
  }
}

/** "Cari" (md and up) or "Guna" in the sheet (below md). */
export async function applyFilters(page: Page): Promise<void> {
  if (isTableLayout(page)) await page.getByRole('button', { name: 'Cari', exact: true }).click()
  else await page.locator('[data-ds="filter-sheet"]').getByRole('button', { name: 'Guna' }).click()
}

/** A short unique token for fixture names: unique per run, project and test. */
export function stamp(info: TestInfo): string {
  return `${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}${info.project.name[0]}`
}

/**
 * True when `locator` is really painted at its centre: the element under the centre point is the
 * locator or one of its descendants. A card that clips its overflow (SWX-4, RS5-M1) fails this.
 */
export async function isPainted(locator: import('@playwright/test').Locator): Promise<boolean> {
  await locator.scrollIntoViewIfNeeded()
  return locator.evaluate((el) => {
    el.scrollIntoView({ block: 'center' })
    const r = el.getBoundingClientRect()
    if (r.width === 0 || r.height === 0) return false
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + Math.min(r.height / 2, 20))
    return top !== null && (el === top || el.contains(top))
  })
}

export interface TempUser {
  id: string
  email: string
  password: string
}

/**
 * Creates an account as `admin` over the API (POST /api/admin/users) and returns the one-time password the
 * server generated. The password only lives in memory for the test; it is never logged or attached.
 * `extra` carries role specific fields (`schoolId`, `grade`).
 */
export async function createUser(
  admin: ApiSession,
  info: TestInfo,
  role: string,
  extra: Record<string, unknown> = {},
  label = role,
): Promise<TempUser> {
  const email = `${label}.${stamp(info)}@example.test`.toLowerCase()
  const made = dataOf<{ id: string; generatedPassword?: string }>(
    await admin.send('POST', '/api/admin/users', {
      name: `Ujian ${label} ${stamp(info)}`,
      email,
      roles: [role],
      ...extra,
    }),
    `POST /api/admin/users (${role})`,
  )
  expect(made.generatedPassword, 'the server generated a one-time password').toBeTruthy()
  return { id: made.id, email, password: made.generatedPassword! }
}

/** A throw-away Admin Pusat: its own per-user rate limit buckets, and a session the spec may abuse. */
export const createTempAdmin = (admin: ApiSession, info: TestInfo): Promise<TempUser> =>
  createUser(admin, info, 'admin', {}, 'adminuji')

/** Signs a created account in over the API (own cookie jar). */
export function openTempSession(
  browser: Browser,
  info: TestInfo,
  user: TempUser,
): Promise<ApiSession> {
  return signedIn(browser, info, user.email, user.password)
}

/** Best-effort delete of accounts a spec created; a failure here must not hide the real failure. */
export async function removeUsers(admin: ApiSession, ids: string[]): Promise<void> {
  for (const id of ids) {
    const res = await admin.send('DELETE', `/api/admin/users/${id}`).catch(() => null)
    if (res === null || (res.status >= 300 && res.status !== 404)) {
      // 404 = already deleted by the test itself. Only the id is recorded, never credentials.
      test.info().annotations.push({
        type: 'cleanup-leftover-user',
        description: `${id} (DELETE ${res === null ? 'failed' : res.status})`,
      })
    }
  }
}

interface WireSubscription {
  id: string
  school: { id: string; name: string }
  status: string
}

/** Cancels every non-cancelled subscription of `schoolName` so a test starts from a known state. */
export async function cancelOpenSubscriptions(
  api: ApiSession,
  schoolName: string,
  { strict = true }: { strict?: boolean } = {},
): Promise<string> {
  const list = (await api.get('/api/admin/school-subscriptions?perPage=200')).body as {
    data: WireSubscription[]
  }
  let schoolId = ''
  for (const sub of list.data) {
    if (sub.school.name !== schoolName) continue
    schoolId = sub.school.id
    if (sub.status !== 'cancelled') {
      const status = (await api.send('POST', `/api/admin/school-subscriptions/${sub.id}/cancel`))
        .status
      if (strict) expect(status, `cancel subscription ${sub.id}`).toBe(200)
      else if (status !== 200) {
        test.info().annotations.push({
          type: 'cleanup-leftover-subscription',
          description: `${sub.id} (cancel ${status})`,
        })
      }
    }
  }
  if (schoolId !== '') return schoolId
  const options = dataOf<{ id: string; name: string }[]>(
    await api.get('/api/admin/schools/options'),
    'GET /api/admin/schools/options',
  )
  const found = options.find((o) => o.name === schoolName)
  expect(found, `the seed has the school ${schoolName}`).toBeTruthy()
  return found!.id
}

/** For `finally` blocks: cancels what is left, never throws, records a leftover as an annotation. */
export async function cancelOpenSubscriptionsQuietly(
  api: ApiSession,
  schoolName: string,
): Promise<void> {
  try {
    await cancelOpenSubscriptions(api, schoolName, { strict: false })
  } catch (error) {
    test.info().annotations.push({
      type: 'cleanup-leftover-subscription',
      description: `${schoolName}: ${error instanceof Error ? error.message.slice(0, 120) : 'failed'}`,
    })
  }
}
