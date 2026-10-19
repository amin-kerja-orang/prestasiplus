/**
 * Global smoke: mock persistence across tabs and reloads (F-07 carry-over; overview §6.11,
 * ADR-0005; build-plan F-07 acceptance "a two-page Playwright check (part of F-22) confirms
 * cross-tab apply").
 *
 * The write: the core `setUser` hook in tab A inserts a server-side session row (mock `sessions`
 * table) and writes `pp.auth`. Tab B booted before that write, so its in-memory mock only knows the
 * row if it applied A's broadcast commit. B then navigates to an auth route: `GET /api/me` with the
 * new token must answer 200 in B (a missing row would be a 401 and a redirect to `/login`).
 *
 * No module write exists yet; replace the hook write with a module write (e.g. an M05 answer) when
 * one is available, if a data-level check is wanted.
 */

import { createMockHandle, expect, gotoApp, reloadApp, test } from '../fixtures/test'
import { isDesktopShell, openProbeRoute, provisional, TAG } from '../support'
import type { Page } from '@playwright/test'

const SHELL_PROBE = { path: '/__e2e/user-shell', layout: 'user', access: 'auth' } as const

/** Starts recording the mock's cross-tab messages in `page` (a second listener on `pp-mock`). */
async function recordMockChannel(page: Page): Promise<void> {
  await page.evaluate(() => {
    const seen: string[] = []
    ;(window as unknown as { __e2eMockChannel: string[] }).__e2eMockChannel = seen
    // 'pp-mock' is MOCK_CHANNEL_NAME in src/mock/db/broadcast.ts (keep the two in step).
    const channel = new BroadcastChannel('pp-mock')
    channel.onmessage = (event: MessageEvent<{ type?: string }>) => {
      seen.push(String(event.data?.type))
    }
  })
}

function commitsSeen(page: Page): Promise<number> {
  return page.evaluate(
    () =>
      (window as unknown as { __e2eMockChannel: string[] }).__e2eMockChannel.filter(
        (t) => t === 'commit',
      ).length,
  )
}

test.describe('mock persistence (F-07)', { tag: [TAG.smoke] }, () => {
  test(
    'a write in tab A is applied in tab B without a reload (probe route)',
    provisional('probe route until M08/M01'),
    async ({ page, newTab }) => {
      const tabA = page
      const tabB = await newTab()
      await gotoApp(tabA, '/')
      await gotoApp(tabB, '/')
      await expect(tabA).toHaveURL('/login')
      await expect(tabB).toHaveURL('/login')

      const mockA = createMockHandle(tabA)
      const mockB = createMockHandle(tabB)
      await mockB.ready()
      await recordMockChannel(tabB)

      await mockA.setUser('pelajar@demo.test')
      // B's mock listener was created first, so it has applied the commit when ours sees it.
      await expect.poll(() => commitsSeen(tabB)).toBeGreaterThan(0)

      await openProbeRoute(tabB, SHELL_PROBE)
      await expect
        .poll(async () => (await mockB.lastRequest('GET /api/me'))?.status ?? null)
        .toBe(200)
      await expect(tabB).toHaveURL(SHELL_PROBE.path)
      const card = isDesktopShell(tabB)
        ? tabB.getByTestId('shell-user-sidebar-card')
        : tabB.getByTestId('shell-user-drawer-card')
      await expect(card).toContainText('Pelajar Demo')
    },
  )

  test(
    'a write survives a reload (IndexedDB) (probe route)',
    provisional('probe route until M08/M01'),
    async ({ page, mock }) => {
      await gotoApp(page, '/')
      await expect(page).toHaveURL('/login')
      await mock.setUser('pelajar@demo.test')

      // No __MOCK_INIT__.session here: the reload finds the session row in IndexedDB only.
      await reloadApp(page)
      await mock.ready()
      await openProbeRoute(page, SHELL_PROBE)
      await expect
        .poll(async () => (await mock.lastRequest('GET /api/me'))?.status ?? null)
        .toBe(200)
      await expect(page).toHaveURL(SHELL_PROBE.path)
      await expect(page.locator('[data-layout="user"]')).toBeVisible()
    },
  )
})
