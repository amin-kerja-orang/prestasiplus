/**
 * Shared helpers for the `@api` specs in this folder (BE-32 AC3, slug `e2e-bijak`). Plain
 * `@playwright/test` only (no mock fixtures). Read-only imports from `../fixtures/api` and `../support`.
 *
 * Credentials: the seed demo accounts (BE-07 / poc-bijak-seed, all in school DEMO001). The password
 * is NEVER in the repo: `BIJAK_<ROLE>_PASS`, else one `E2E_DEMO_PASSWORD` for all roles, else the
 * fixture default `API_PASSWORD` (the public seed password of the local stack, see fixtures/api.ts).
 * Users can be overridden per role with `BIJAK_<ROLE>_USER`.
 */

import type { Browser, BrowserContext, Page, TestInfo } from '@playwright/test'

import { API_PASSWORD, expect } from '../fixtures/api'
import { H_SCROLL_SAMPLE_GAP_MS, H_SCROLL_SAMPLES } from '../support'

export type ApiRole = 'student' | 'studentB' | 'guru' | 'adminSekolah' | 'adminPusat'

const ACCOUNTS: Record<ApiRole, { user: string; env: string }> = {
  student: { user: 'pelajar@demo.test', env: 'STUDENT' },
  // A second pupil of the same school, for the foreign-attempt check.
  studentB: { user: 'murid4@demo.test', env: 'STUDENT_B' },
  guru: { user: 'guru@demo.test', env: 'GURU' },
  adminSekolah: { user: 'adminsekolah@demo.test', env: 'ADMIN_SEKOLAH' },
  adminPusat: { user: 'admin@demo.test', env: 'ADMIN_PUSAT' },
}

export interface Account {
  user: string
  pass: string
}

/** The login of a seed role; the password falls back to the shared one, then the fixture default. */
export function account(role: ApiRole): Account {
  const a = ACCOUNTS[role]
  return {
    user: process.env[`BIJAK_${a.env}_USER`] || a.user,
    pass:
      process.env[`BIJAK_${a.env}_PASS`] ||
      process.env.E2E_DEMO_PASSWORD ||
      // Pupil B shares pupil A's password unless its own is given.
      (role === 'studentB' ? process.env.BIJAK_STUDENT_PASS : undefined) ||
      API_PASSWORD,
  }
}

export const FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'

/** Where each role lands (scope home, src/app/prototype-scope.ts `scopeHomePath` + http student home). */
export const HOME: Record<'student' | 'guru' | 'adminSekolah' | 'adminPusat', string> = {
  student: '/spm/bijak',
  guru: '/guru',
  adminSekolah: '/admin-sekolah',
  adminPusat: '/admin/command-center',
}

/** Http-mode twin of `expectNoHorizontalScroll`: the app has booted when `#app.__vue_app__` exists. */
export async function expectNoHScroll(page: Page): Promise<void> {
  const samples: number[] = []
  for (let i = 0; i < H_SCROLL_SAMPLES; i++) {
    if (i > 0) await page.waitForTimeout(H_SCROLL_SAMPLE_GAP_MS)
    const sample = await page.evaluate(() => {
      const app = document.querySelector('#app') as (Element & { __vue_app__?: unknown }) | null
      if (!app?.__vue_app__) return null
      const el = document.documentElement
      return el.scrollWidth - el.clientWidth
    })
    expect(sample, 'expectNoHScroll: the app has not mounted').not.toBeNull()
    samples.push(sample!)
  }
  for (const overflow of samples) {
    expect(
      overflow,
      `horizontal page overflow in px (samples: ${samples.join(', ')})`,
    ).toBeLessThanOrEqual(0)
  }
}

/** A second, isolated browser context (own cookies) with the same base URL and viewport as the test. */
export async function newPeerContext(browser: Browser, info: TestInfo): Promise<BrowserContext> {
  const use = info.project.use
  return browser.newContext({
    ...(use.baseURL ? { baseURL: use.baseURL } : {}),
    ...(use.viewport ? { viewport: use.viewport } : {}),
  })
}

/** The CSRF token of the page's cookie session. */
export async function csrfOf(page: Page): Promise<string> {
  const res = await page.request.get('/api/session')
  expect(res.status(), 'GET /api/session').toBe(200)
  return ((await res.json()) as { data: { csrf: string } }).data.csrf
}

/** `pp_session` cookie of the context, if any. */
export async function sessionCookie(context: BrowserContext) {
  return (await context.cookies()).find((c) => c.name === 'pp_session')
}

/**
 * Opens the account menu of the current shell and clicks "Log Keluar". Both shells keep it in a
 * dropdown (src/shells/pembelajaran/PembelajaranLayout.vue `accountMenu`, src/shells/pentadbiran/
 * PentadbiranLayout.vue `accountItems`). Learner shell: the top-right avatar is always visible;
 * Pentadbiran: the menu lives in the sidebar footer, which is a slide-over below `lg`.
 */
export async function logoutViaMenu(
  page: Page,
  shell: 'pembelajaran' | 'pentadbiran',
): Promise<void> {
  if (shell === 'pembelajaran') {
    await page.getByTestId('pembelajaran-account-top').click()
  } else {
    const account = page.getByTestId('pentadbiran-account')
    if (!(await account.isVisible())) await page.getByTestId('pentadbiran-menu-button').click()
    await account.click()
  }
  await page.getByRole('menuitem', { name: 'Log Keluar' }).click()
}
