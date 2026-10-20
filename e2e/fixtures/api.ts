/**
 * Fixture for `@api` specs (BE-32, V2-T31 T8): the app built with `VITE_API_MODE=http` against the
 * real stack. Plain `@playwright/test` (no mock clock, no `__mock.ready`); navigate with
 * `gotoApi`, never `gotoApp`. Demo accounts come from the BE-07 seed, password `Demo1234`.
 */

import { expect, test, type Page } from '@playwright/test'

export { expect, test }

export const API_PASSWORD = 'Demo1234'

/** `page.goto` + wait until the SPA has rendered something into `#app`. */
export async function gotoApi(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await expect(page.locator('#app > *').first()).toBeAttached({ timeout: 20_000 })
}

/** Signs in through the real login form; resolves once the app has left `/login`. */
export async function loginViaUi(page: Page, email: string, password = API_PASSWORD): Promise<void> {
  await gotoApi(page, '/login')
  const form = page.getByTestId('login-form')
  await form.getByLabel('Alamat Email').fill(email)
  await form.getByLabel('Kata Laluan').fill(password)
  const response = page.waitForResponse((r) => r.url().endsWith('/api/auth/login'), { timeout: 30_000 })
  await form.getByRole('button', { name: 'Log Masuk' }).click()
  expect((await response).status(), 'POST /api/auth/login').toBe(200)
  await expect(page).not.toHaveURL(/\/login(\?|$)/, { timeout: 20_000 })
}

/** The cookie-session `Session` as the API returns it (envelope unwrapped). */
export interface ApiSessionBody {
  user: { id: string; email: string | null }
  roles: { role: string }[]
  active: { role: string; portal: string }
  landingPath: string
  csrf: string
}

export async function currentSession(page: Page): Promise<ApiSessionBody> {
  const res = await page.request.get('/api/session')
  expect(res.status()).toBe(200)
  return ((await res.json()) as { data: ApiSessionBody }).data
}
