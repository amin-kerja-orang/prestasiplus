/**
 * Smoke for the prototype scope (TRACKER D43): Murid, Guru and Admin Sekolah see only the menu
 * items of docs/requirements/role-access-matrix.md, and a typed out-of-scope URL shows the
 * friendly "Belum tersedia dalam prototaip" page inside the shell.
 *
 * Needs a build with the scope ON (the e2e mode turns it off): run it with
 * `npx playwright test -c playwright.scope.config.mjs` (port 5190).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, isDesktopShell, TAG } from '../support'

// The regular e2e build has the scope off: only run against the scope-on build.
test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.scope.config.mjs',
)

interface RoleCase {
  email: string
  home: string
  /** Menu texts that must be present. */
  shown: string[]
  /** Menu texts that must not be present. */
  hidden: string[]
  /** An out-of-scope URL for the role. */
  blocked: string
}

const CASES: Record<string, RoleCase> = {
  Murid: {
    email: 'pelajar@demo.test',
    home: '/dashboard',
    shown: ['Latih Tubi', 'Soalan Berstruktur', 'Kedai Hadiah', 'Jemput Ibu Bapa', 'Tiket Bantuan'],
    hidden: ['Target SPM', 'Misi Harian', 'Kombo', 'Invois Saya', 'Cikgu Suara', 'Bilik Duta'],
    blocked: '/misi-harian',
  },
  Guru: {
    email: 'guru@demo.test',
    home: '/guru',
    shown: ['Command Center', 'Kelas Saya', 'Pelajar Saya', 'Pemantauan', 'Sumbang Soalan'],
    hidden: ['Misi Harian', 'Siaran', 'Databank Soalan', 'Liga Pertandingan', 'Jadual Belajar'],
    blocked: '/liga',
  },
  'Admin Sekolah': {
    email: 'adminsekolah@demo.test',
    home: '/admin-sekolah',
    shown: [
      'Senarai Pelajar',
      'Senarai Guru',
      'Kelas Sekolah',
      'Statistik Penggunaan',
      'Amaran Awal',
    ],
    hidden: [
      'Urus Pengguna',
      'Import Pelajar',
      'Langganan',
      'Invois',
      'Kombo Harian',
      'Kejohanan',
    ],
    blocked: '/admin-sekolah/pengguna',
  },
}

/**
 * The navigation container. Murid and Guru use the v2 Pembelajaran layout (sidebar on desktop, the
 * "Lagi" slide-over below `lg`); Admin Sekolah still uses the legacy user shell.
 */
async function menu(page: Page, v2: boolean) {
  if (v2) {
    if (isDesktopShell(page)) return page.getByTestId('pembelajaran-sidebar')
    await page.locator('[data-nav-id="tab-lagi"]').click()
    const panel = page.getByRole('navigation', { name: 'Menu penuh' })
    await expect(panel).toBeVisible()
    return panel
  }
  if (isDesktopShell(page)) return page.getByTestId('shell-user-sidebar')
  await page.getByTestId('shell-user-hamburger').click()
  const drawer = page.getByTestId('shell-user-drawer')
  await expect(drawer).toHaveClass(/\bopen\b/)
  return drawer
}

for (const [role, c] of Object.entries(CASES)) {
  test.describe(`prototype scope: ${role}`, { tag: [TAG.smoke] }, () => {
    test('the menu shows only the allowed items', async ({ page, loginAs, gotoApp }) => {
      // The friend picker opens on a Murid's first visit; a stored friend keeps it closed.
      await page.addInitScript(() => localStorage.setItem('pp.friend', 'aiman'))
      await loginAs(c.email)
      await gotoApp(c.home)
      const nav = await menu(page, role !== 'Admin Sekolah')
      const text = await nav.innerText()
      for (const label of c.shown) expect(text, label).toContain(label)
      // Exact item texts: "Invois" must not match "Invois Saya" and vice versa.
      const items = (await nav.locator('a').allInnerTexts()).map((t) => t.trim())
      for (const label of c.hidden) expect(items, label).not.toContain(label)
      await expectNoHorizontalScroll(page)
    })

    test('an out-of-scope URL goes to the role home, never "Belum tersedia"', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(c.email)
      await gotoApp(c.blocked)
      await expect(page).toHaveURL(new RegExp(`${c.home}$`))
      await expect(page.getByTestId('prototype-unavailable')).toHaveCount(0)
      await expect(page.locator('[data-layout]').first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  })
}

test.describe('prototype scope: accounts', { tag: [TAG.smoke] }, () => {
  for (const email of [
    'admin@demo.test',
    'ppd@demo.test',
    'ibubapa@demo.test',
    'penaja@demo.test',
  ]) {
    test(`${email} cannot log in`, async ({ page, gotoApp }) => {
      await gotoApp('/login')
      await page.getByTestId('login-email').fill(email)
      await page.getByTestId('login-password').fill('Demo1234')
      await page.getByTestId('login-submit').click()
      await expect(page.getByTestId('login-alert')).toContainText(
        'Peranan ini tidak termasuk dalam prototaip.',
      )
      await expect(page).toHaveURL(/\/login$/)
    })
  }

  // The e2e build has no dev routes at all; `/__ds` staying reachable in dev/demo is a unit test
  // (src/app/__tests__/prototype-scope-routes.test.ts) and a manual check on `npm run dev`.
  test('the /__dev pages do not exist', async ({ page, gotoApp }) => {
    await gotoApp('/__dev/shell')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
  })
})
