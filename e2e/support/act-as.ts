/**
 * `actAs`: switches the session of a running page and opens a path (L45 multi-role scenarios).
 *
 * The `loginAs` fixture re-applies its init-script session on every load, so a test that changes
 * user must not use `loginAs`. It opens `/login` first (so the mock is up), then calls `actAs` with an
 * e-mail (the `setUser` hook), or with `null` to clear the session and act as a guest.
 */

import type { Page } from '@playwright/test'

export async function actAs(
  page: Page,
  mock: { setUser: (...args: string[]) => Promise<unknown> },
  gotoApp: (path: string) => Promise<void>,
  who: string | null,
  path: string,
): Promise<void> {
  if (who === null) await page.evaluate(() => localStorage.removeItem('pp.auth'))
  else await mock.setUser(who)
  await gotoApp(path)
}
