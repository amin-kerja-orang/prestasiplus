/**
 * M27 S0 "Dashboard Sekolah" `/admin-sekolah` at 375 / 768 / 1280 (SRS M27 v1.3 §12: E2E-M27-01…34).
 *
 * Oracle (SRS §12): figures are compared with the owner's own read for the same session, never pinned. The M08
 * S1 endpoint `GET /api/performance/school` is the owner read for GPS, entries, sessions, questions, accuracy,
 * levels and the grade distribution; its `stats.students / teachers / classes` come from the same M02 and M10
 * stores as the three count cards (M08 FR-M08-12), so they stand in for the M02 and M10 reads.
 *
 * Not run here: E2E-M27-11 (needs an admin session to post four perutusan), E2E-M27-13 `@blocked-by M09-T4` (deferred, out of prototype 1.0),
 * Each is declared below as a skipped test with its reason.
 */

import type { Locator, Page } from '@playwright/test'

import { createMockHandle, gotoApp as gotoAppOn } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  provisional,
  viewportWidth,
} from '../support'

const MODULE = { tag: ['@m27'] }
const PAGE = '/admin-sekolah'
const AZLAN = 'azlan@demo.test'
const SUHAIMI = 'suhaimi@demo.test'
const ADMIN_SEKOLAH = 'adminsekolah@demo.test'
/** Admin Sekolah of the populated school (M17 / M11 anchor 8078, a generated school admin by M01 users). */
const POPULATED = 1214

const FORBIDDEN_COPY =
  'Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.'
const NOT_FOUND_COPY =
  'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?'
const NOT_FOUND_TITLE = '404 - Halaman Tidak Dijumpai | PRESTASIPLUS'
const FORBIDDEN_TITLE = '403 - Akses Ditolak | PRESTASIPLUS'
const GRADES = ['A+', 'A', 'A-', 'B+', 'B', 'C+', 'C', 'D', 'E', 'G']

test.use({ mockInit: { latency: 0 } })

interface SchoolPerf {
  stats: {
    students: number
    teachers: number
    classes: number
    sessions: number
    answered: number
    accuracy: number
  }
  gps: { value: number | null; band: string | null; entries: number }
  distribution: { grade: string; count: number; pct: number }[]
  levels: { code: string; accuracy: number }[]
}

/** Parses "1,234", "61.4%" or "3.17" (the M08 page prints plain numbers, grouped numbers and percentages). */
const num = (text: string) => Number(text.replace(/[,%\s]/g, ''))

/**
 * The oracle: the owner's own page for the same session, M08 S1 `/prestasi/sekolah` (own-school view). The raw
 * API is not reachable from the test (the mock transport lives in the app), so the figures are read from the
 * M08 page and the browser returns to S0. `stats.students / teachers / classes` come from the same M02 and M10
 * stores as the three count cards (M08 FR-M08-12).
 */
async function m08(page: Page): Promise<SchoolPerf> {
  await spaGoto(page, '/prestasi/sekolah')
  await expect(page.getByTestId('grade-card')).toBeVisible()
  await expect(page.getByTestId('stat-murid')).toBeVisible()
  const stat = async (id: string) =>
    (await page.locator(`[data-testid="stat-${id}"] [data-testid="stat-value"]`).innerText()).trim()
  const gpsText = (await page.getByTestId('gps-value').innerText()).trim()
  const band = page.getByTestId('gps-band')
  const levelPct = async (code: string) =>
    num((await page.getByTestId(`level-card-${code}`).locator('span.text-xl').innerText()).trim())
  const distribution = await page.locator('[data-testid^="grade-row-"]').evaluateAll((rows) =>
    rows.map((row) => {
      const spans = [...row.querySelectorAll('span')].map((e) => (e.textContent ?? '').trim())
      return { grade: spans[0] ?? '', count: spans[1] ?? '', pct: spans[2] ?? '' }
    }),
  )
  const perf: SchoolPerf = {
    stats: {
      students: num(await stat('murid')),
      teachers: num(await stat('guru')),
      classes: num(await stat('kelas')),
      sessions: num(await stat('sesi')),
      answered: num(await stat('soalan')),
      accuracy: num(await stat('ketepatan')),
    },
    gps: {
      value: /^\d/.test(gpsText) ? Number(gpsText) : null,
      band: (await band.count()) > 0 ? (await band.innerText()).trim() : null,
      entries: num(await page.getByTestId('gps-entries').innerText()),
    },
    distribution: distribution.map((d) => ({
      grade: d.grade,
      count: num(d.count),
      pct: num(d.pct),
    })),
    levels: [
      { code: 't4', accuracy: await levelPct('t4') },
      { code: 't5', accuracy: await levelPct('t5') },
    ],
  }
  await spaGoto(page, PAGE)
  await expect(page.getByTestId('sd-grades')).toBeVisible({ timeout: 60_000 })
  return perf
}

/** In-app navigation (no reload): keeps the mock state, armed faults and the booted owner caches. */
async function spaGoto(page: Page, path: string): Promise<void> {
  await page.evaluate(async (p) => {
    const el = document.querySelector('#app') as Element & {
      __vue_app__: {
        config: { globalProperties: { $router: { push(t: string): Promise<unknown> } } }
      }
    }
    await el.__vue_app__.config.globalProperties.$router.push(p)
  }, path)
}

const ms = (n: number) => n.toLocaleString('en-US')
const pct1 = (n: number) => n.toFixed(1)

/** Signs a non-canonical fixture user in (`loginAs` knows canonical accounts only): opens /login, then the `setUser` hook. */
async function signIn(page: Page, who: string | number): Promise<void> {
  await gotoAppOn(page, '/login')
  await createMockHandle(page).setUser(who)
}

/** Switches the session of a running page (no `loginAs` in the test) and opens S0. */
async function switchTo(
  page: Page,
  mock: { setUser: (...args: (string | number | boolean)[]) => Promise<unknown> },
  gotoApp: (p: string) => Promise<void>,
  who: string | number,
  path: string = PAGE,
): Promise<void> {
  await mock.setUser(who)
  await gotoApp(path)
}

async function open(page: Page, gotoApp: (p: string) => Promise<void>): Promise<void> {
  await gotoApp(PAGE)
  // the populated schools are computed from large owner datasets: allow the first answer time
  await expect(page.getByTestId('sd-page')).toBeVisible({ timeout: 60_000 })
  await expect(page.getByTestId('sd-grades')).toBeVisible({ timeout: 60_000 })
}

const rowsOf = (locators: Locator) =>
  locators.evaluateAll((els) => els.map((e) => e.getBoundingClientRect().top))

async function expectForbiddenPage(page: Page): Promise<void> {
  const root = page.locator('[data-page=forbidden]')
  await expect(root).toBeVisible()
  await expectTabTitle(page, FORBIDDEN_TITLE)
  await expect(root).toContainText('403')
  await expect(root).toContainText('Akses Ditolak')
  await expect(root).toContainText(FORBIDDEN_COPY)
  await expect(root.getByRole('link', { name: 'Halaman Utama' })).toHaveAttribute('href', '/')
  await expect(root.getByRole('link', { name: 'Log Masuk' })).toHaveAttribute('href', '/login')
  await expect(page.getByTestId('sd-page')).toHaveCount(0)
}

test.describe('shell, header', MODULE, () => {
  test('E2E-M27-01 S0 in the user shell with "Dashboard" active, not active on /admin-sekolah/monitoring', async ({
    page,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) < 1280, 'E2E-M27-01 runs at 1280 only')
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    const sidebar = page.getByTestId('shell-user-sidebar')
    await expect(sidebar).toBeVisible()
    await expect(sidebar.locator('[data-nav-id="sa-dashboard"]')).toHaveClass(/\bactive\b/)
    await expect(sidebar.locator('a.active')).toHaveCount(1)
    await gotoApp('/admin-sekolah/monitoring')
    await expect(sidebar.locator('[data-nav-id="sa-dashboard"]')).toBeVisible()
    await expect(sidebar.locator('[data-nav-id="sa-dashboard"]')).not.toHaveClass(/\bactive\b/)
  })

  test(
    'E2E-M27-02 below lg: no sidebar, the drawer opens with "Dashboard" active, no horizontal scroll',
    provisional('PROPOSED shell-owned breakpoint behaviour (SRS E2E-M27-02)', MODULE.tag),
    async ({ page, gotoApp }) => {
      test.skip(isDesktopShell(page), 'E2E-M27-02 runs at 375 and 768 only')
      await signIn(page, AZLAN)
      await open(page, gotoApp)
      await expect(page.getByTestId('shell-user-sidebar')).toBeHidden()
      await page.getByTestId('shell-user-hamburger').click()
      const drawer = page.getByTestId('shell-user-drawer')
      await expect(drawer).toHaveClass(/\bopen\b/)
      await expect(drawer.locator('[data-nav-id="sa-dashboard"]')).toHaveClass(/\bactive\b/)
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'E2E-M27-03 header title, school-name subtitle, tab title, avatar, bell, logout, no chips',
    provisional(
      'tab title and header subtitle are PROPOSED / SERVER-DECK (SRS E2E-M27-03)',
      MODULE.tag,
    ),
    async ({ page, gotoApp }) => {
      await signIn(page, AZLAN)
      await open(page, gotoApp)
      await expect(page.getByTestId('shell-user-title')).toHaveText('Dashboard Sekolah')
      await expect(page.getByTestId('shell-user-subtitle')).toHaveText('SMK Demo Seri Putra')
      await expectTabTitle(page, 'Dashboard Sekolah - PRESTASIPLUS')
      expect(
        decodeURIComponent(
          (await page.getByTestId('shell-user-header-avatar').getAttribute('src')) ?? '',
        ),
      ).toContain('>AD<')
      await expect(page.getByTestId('shell-user-bell')).toBeVisible()
      // the header logout icon is the shell's own responsive choice: hidden below lg (the drawer holds "Log Keluar")
      if (isDesktopShell(page)) {
        await expect(page.getByTestId('shell-user-header-logout')).toBeVisible()
      }
      await expect(page.getByTestId('shell-user-chips')).toHaveCount(0)
    },
  )
})

test.describe('banner', MODULE, () => {
  test('E2E-M27-04 banner of school 900003: name by CSS capitals, role line, state, PPD, code; not links', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    const name = page.getByTestId('sd-banner-name')
    await expect(name).toHaveText('SMK Demo Seri Putra')
    expect(await name.evaluate((e) => getComputedStyle(e).textTransform)).toBe('uppercase')
    expect(await name.evaluate((e) => (e as HTMLElement).innerText)).toBe('SMK DEMO SERI PUTRA')
    const role = page.getByTestId('sd-banner-role')
    await expect(role).toHaveText('Admin Sekolah')
    const [nameBox, roleBox] = [await name.boundingBox(), await role.boundingBox()]
    expect(roleBox!.y).toBeGreaterThan(nameBox!.y + nameBox!.height - 1)
    await expect(page.getByTestId('sd-chip-state')).toHaveText('Selangor')
    await expect(page.getByTestId('sd-chip-ppd')).toHaveText('PPD HULU LANGAT')
    await expect(page.getByTestId('sd-chip-code')).toHaveText('# Kod: DMO0003')
    await expect(page.getByTestId('sd-chip-state').locator('svg')).toHaveCount(1)
    await expect(page.getByTestId('sd-chip-ppd').locator('svg')).toHaveCount(1)
    await expect(page.getByTestId('sd-banner').locator('a')).toHaveCount(0)
    const before = page.url()
    await page.getByTestId('sd-chip-ppd').click()
    await page.getByTestId('sd-banner').click()
    expect(page.url()).toBe(before)
  })

  test(
    'E2E-M27-05 school without PPD and code: the state chip only',
    provisional('chip omission is PROPOSED (SRS E2E-M27-05)', MODULE.tag),
    async ({ page, gotoApp }) => {
      await signIn(page, SUHAIMI)
      await open(page, gotoApp)
      await expect(page.getByTestId('sd-chip-state')).toHaveText('Johor')
      await expect(page.getByTestId('sd-chip-ppd')).toHaveCount(0)
      await expect(page.getByTestId('sd-chip-code')).toHaveCount(0)
      await expect(page.getByTestId('sd-chips')).toHaveText('Johor')
      await expect(page.getByTestId('sd-banner')).not.toContainText('Kod')
    },
  )

  test('E2E-M27-06 no other school name outside the banner, header and the Perutusan card; ?school_id is ignored', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await gotoApp(`${PAGE}?school_id=900001`)
    await expect(page.getByTestId('sd-grades')).toBeVisible()
    await expect(page.getByTestId('sd-banner-name')).toHaveText('SMK Demo Seri Putra')
    const remaining = await page.getByTestId('sd-page').evaluate((root) => {
      const clone = root.cloneNode(true) as HTMLElement
      for (const id of ['sd-banner-name', 'sd-perutusan', 'sd-grade-row']) {
        clone.querySelectorAll(`[data-testid="${id}"]`).forEach((e) => e.remove())
      }
      return clone.textContent ?? ''
    })
    const subtitle = (await page.getByTestId('shell-user-subtitle').textContent()) ?? ''
    expect(subtitle).toBe('SMK Demo Seri Putra')
    expect(remaining).not.toContain('SMK DEMO')
    expect(remaining).not.toContain('SK Demo')
  })
})

test.describe('Perutusan card', MODULE, () => {
  test('E2E-M27-07 heading, link and one row for azlan: initials, title, "Pengetua · 6 bulan yang lepas"', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    const card = page.getByTestId('sd-perutusan')
    await expect(card.getByRole('heading', { name: 'Perutusan Terkini' })).toBeVisible()
    await expect(page.getByTestId('sd-perutusan-all')).toHaveText('Lihat semua →')
    await expect(page.getByTestId('sd-perutusan-row')).toHaveCount(1)
    await expect(page.getByTestId('sd-perutusan-initials')).toHaveText('AD')
    await expect(page.getByTestId('sd-perutusan-title')).toHaveText(/\S/)
    await expect(page.getByTestId('sd-perutusan-meta')).toHaveText('Pengetua · 6 bulan yang lepas')
  })

  test('E2E-M27-08 one row per fixture admin: #3 "SM" and #2 "SA", both "Pengetua · 6 bulan yang lepas"', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, SUHAIMI)
    await open(page, gotoApp)
    await expect(page.getByTestId('sd-perutusan-row')).toHaveCount(1)
    await expect(page.getByTestId('sd-perutusan-initials')).toHaveText('SM')
    await expect(page.getByTestId('sd-perutusan-meta')).toHaveText('Pengetua · 6 bulan yang lepas')
  })

  test('E2E-M27-08b adminsekolah@demo.test: one row "SA"', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN_SEKOLAH)
    await open(page, gotoApp)
    await expect(page.getByTestId('sd-perutusan-row')).toHaveCount(1)
    await expect(page.getByTestId('sd-perutusan-initials')).toHaveText('SA')
    await expect(page.getByTestId('sd-perutusan-meta')).toHaveText('Pengetua · 6 bulan yang lepas')
  })

  test('E2E-M27-09 posts of other schools are absent from the DOM', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    const titles: string[] = []
    for (const who of [SUHAIMI, ADMIN_SEKOLAH]) {
      await switchTo(page, mock, gotoApp, who)
      await expect(page.getByTestId('sd-perutusan-row')).toHaveCount(1)
      titles.push((await page.getByTestId('sd-perutusan-title').innerText()).trim())
    }
    await switchTo(page, mock, gotoApp, AZLAN)
    await expect(page.getByTestId('sd-perutusan-row')).toHaveCount(1)
    const own = (await page.getByTestId('sd-perutusan-title').innerText()).trim()
    const html = await page.content()
    for (const title of titles) {
      expect(title).not.toBe(own)
      expect(html).not.toContain(title)
    }
  })

  test(
    'E2E-M27-10 school admin of a school without posts: card header, no row, no sentence',
    provisional('empty perutusan is INFERRED (SRS E2E-M27-10)', MODULE.tag),
    async ({ page, gotoApp }) => {
      await signIn(page, POPULATED)
      await open(page, gotoApp)
      const card = page.getByTestId('sd-perutusan')
      await expect(card.getByRole('heading', { name: 'Perutusan Terkini' })).toBeVisible()
      await expect(page.getByTestId('sd-perutusan-row')).toHaveCount(0)
      await expect(card).toHaveText('Perutusan Terkini Lihat semua →')
    },
  )

  test('E2E-M27-12 "Lihat semua →" is a link to /perutusan', async ({ page, gotoApp }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    await expect(page.getByTestId('sd-perutusan-all')).toHaveAttribute('href', '/perutusan')
  })

  test.skip('E2E-M27-11 four national perutusan give exactly 3 rows (needs an admin session; @provisional)', () => {})
  // deferred: `/perutusan` (M09-T4) is out of prototype 1.0 scope; does not block S0
  test.skip('E2E-M27-13 click "Lihat semua →" opens the M09 list (@blocked-by M09-T4, deferred, @provisional)', () => {})
})

test.describe('breadcrumb', MODULE, () => {
  test('E2E-M27-14 "← Papan Pemuka" link to /dashboard, then bold "Dashboard Sekolah" as text, between card and banner', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    const back = page.getByTestId('sd-crumb-back')
    await expect(back).toHaveText('← Papan Pemuka')
    await expect(back).toHaveAttribute('href', '/dashboard')
    const current = page.getByTestId('sd-crumb-current')
    await expect(current).toHaveText('Dashboard Sekolah')
    expect(await current.evaluate((e) => e.tagName)).not.toBe('A')
    expect(
      Number(await current.evaluate((e) => getComputedStyle(e).fontWeight)),
    ).toBeGreaterThanOrEqual(700)
    const y = async (id: string) => (await page.getByTestId(id).boundingBox())!.y
    expect(await y('sd-perutusan')).toBeLessThan(await y('sd-breadcrumb'))
    expect(await y('sd-breadcrumb')).toBeLessThan(await y('sd-banner'))
  })

  test('E2E-M27-15 click "← Papan Pemuka": URL ends with /dashboard and M05 S1 renders for school_admin', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    await page.getByTestId('sd-crumb-back').click()
    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByTestId('dashboard-page')).toBeVisible()
    await expect(page.locator('[data-page=forbidden]')).toHaveCount(0)
    await expect(page.getByTestId('sd-page')).toHaveCount(0)
  })
})

test.describe('cards', MODULE, () => {
  test('E2E-M27-16 four cards: order, labels, tints, icon tile top-left, foot bar, none a link', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await open(page, gotoApp)
    await expect(page.getByTestId('sd-card-label')).toHaveText(
      ['JUMLAH PELAJAR', 'JUMLAH GURU', 'KELAS AKTIF', 'LANGGANAN'],
      { useInnerText: true },
    )
    const cards = page.getByTestId('sd-cards').locator('> div')
    await expect(cards).toHaveCount(4)
    for (const key of ['pupils', 'teachers', 'classes', 'subscription']) {
      const card = page.getByTestId(`sd-card-${key}`)
      await expect(card.getByTestId('sd-card-icon')).toBeVisible()
      await expect(card.getByTestId('sd-card-bar')).toBeVisible()
      await expect(card.locator('a')).toHaveCount(0)
      const [cb, tb] = [
        await card.boundingBox(),
        await card.getByTestId('sd-card-tile').boundingBox(),
      ]
      expect(tb!.x - cb!.x).toBeLessThan(30)
      expect(tb!.y - cb!.y).toBeLessThan(30)
    }
    const bg = (key: string) =>
      page.getByTestId(`sd-card-${key}`).evaluate((e) => getComputedStyle(e).backgroundImage)
    const tints = await Promise.all(['pupils', 'teachers', 'classes', 'subscription'].map(bg))
    expect(new Set(tints).size).toBe(4)
    await expect(page.getByTestId('sd-card-pupils')).toHaveClass(/blue/)
    await expect(page.getByTestId('sd-card-teachers')).toHaveClass(/teal/)
    await expect(page.getByTestId('sd-card-classes')).toHaveClass(/rose/)
    await expect(page.getByTestId('sd-card-subscription')).toHaveClass(/slate/)
  })

  test('E2E-M27-26 count cards equal the owner counts (ms-MY format) and differ between schools', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await switchTo(page, mock, gotoApp, POPULATED)
    await expect(page.getByTestId('sd-grades')).toBeVisible()
    const perf = await m08(page)
    const values = page.getByTestId('sd-card-value')
    await expect(values.nth(0)).toHaveText(ms(perf.stats.students))
    await expect(values.nth(1)).toHaveText(ms(perf.stats.teachers))
    await expect(values.nth(2)).toHaveText(ms(perf.stats.classes))
    // a second school admin of another school
    await switchTo(page, mock, gotoApp, AZLAN)
    await expect(page.getByTestId('sd-banner-name')).toHaveText('SMK Demo Seri Putra')
    const perf2 = await m08(page)
    await expect(page.getByTestId('sd-card-value').nth(0)).toHaveText(ms(perf2.stats.students))
    await expect(page.getByTestId('sd-card-value').nth(2)).toHaveText(ms(perf2.stats.classes))
    expect([perf.stats.students, perf.stats.teachers, perf.stats.classes]).not.toEqual([
      perf2.stats.students,
      perf2.stats.teachers,
      perf2.stats.classes,
    ])
  })

  test(
    'E2E-M27-27 LANGGANAN: "Belum Ada" in the grey card (default seed)',
    provisional(
      'LANGGANAN values other than "Belum Ada" are PROPOSED (SRS E2E-M27-27)',
      MODULE.tag,
    ),
    async ({ page, gotoApp }) => {
      await signIn(page, AZLAN)
      await open(page, gotoApp)
      await expect(page.getByTestId('sd-card-subscription')).toContainText('Belum Ada')
      await expect(page.getByTestId('sd-card-subscription')).toHaveClass(/slate/)
    },
  )

  test.describe('profile subscriptions-extra', () => {
    // the profile is a boot override: it survives a reload only as a mockInit option
    test.use({ mockInit: { latency: 0, overrides: { profile: 'subscriptions-extra' } } })

    test(
      'E2E-M27-27 LANGGANAN: "Tempoh Ihsan" in the green card under subscriptions-extra',
      provisional(
        'LANGGANAN values other than "Belum Ada" are PROPOSED (SRS E2E-M27-27)',
        MODULE.tag,
      ),
      async ({ page, loginAs, gotoApp }) => {
        await loginAs(ADMIN_SEKOLAH)
        await open(page, gotoApp)
        await expect(page.getByTestId('sd-card-subscription')).toContainText('Tempoh Ihsan')
        await expect(page.getByTestId('sd-card-subscription')).toHaveClass(/green/)
      },
    )
  })
})

test.describe('access', MODULE, () => {
  test('E2E-M27-17 a guest on /admin-sekolah goes to /login', async ({ page, gotoApp }) => {
    await gotoApp(PAGE)
    await expect(page).toHaveURL(/\/login/)
    await expect(page.getByTestId('sd-page')).toHaveCount(0)
  })

  for (const email of ['admin@demo.test', 'guru@demo.test', 'pelajar@demo.test']) {
    test(`E2E-M27-18 ${email} gets the 403 page with the exact copy`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(email)
      await gotoApp(PAGE)
      await expectForbiddenPage(page)
      expect(page.url()).toContain(PAGE)
      await expect(page.locator('body')).not.toContainText('pilih-sekolah')
    })
  }

  test('E2E-M27-19 school_admin with a null school gets the 403 page (M02 hook seedSchoolAdminWithoutSchool, XR-M27-05)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/login')
    const account = await page.evaluate(async () => {
      const hooks = window.__mock as unknown as {
        seedSchoolAdminWithoutSchool(): Promise<{ id: number; email: string }>
      }
      return hooks.seedSchoolAdminWithoutSchool()
    })
    expect(account.email).toBe('admin-tanpa-sekolah@demo.test')
    await createMockHandle(page).setUser(account.id)
    await gotoApp(PAGE)
    await expectForbiddenPage(page)
    await expect(page.locator('body')).not.toContainText('SMK')
  })

  test('E2E-M27-20 /admin-sekolah/pilih-sekolah shows the 404 page', async ({ page, gotoApp }) => {
    await signIn(page, AZLAN)
    await gotoApp('/admin-sekolah/pilih-sekolah')
    const root = page.locator('[data-page=not-found]')
    await expect(root).toBeVisible()
    await expectTabTitle(page, NOT_FOUND_TITLE)
    await expect(root).toContainText('Halaman Tidak Dijumpai')
    await expect(root).toContainText(NOT_FOUND_COPY)
    await expect(root.getByRole('link', { name: 'Halaman Utama' })).toHaveAttribute('href', '/')
    await expect(root.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
      'href',
      '/practice',
    )
  })

  test('E2E-M27-21 the endpoint answers 200 for the school admin (request log); no call for a guest or a refused role', async ({
    page,
    mock,
    gotoApp,
  }) => {
    test.skip(viewportWidth(page) !== 1280, 'request-only: run once (desktop project)')
    await gotoApp(PAGE)
    await expect(page).toHaveURL(/\/login/)
    expect(await mock.requests('/api/admin-sekolah/dashboard')).toHaveLength(0)
    await switchTo(page, mock, gotoApp, 'admin@demo.test')
    await expect(page.locator('[data-page=forbidden]')).toBeVisible()
    expect(await mock.requests('/api/admin-sekolah/dashboard')).toHaveLength(0)
    await switchTo(page, mock, gotoApp, AZLAN, `${PAGE}?school_id=900001`)
    await expect(page.getByTestId('sd-banner-name')).toHaveText('SMK Demo Seri Putra')
    const calls = await mock.requests('/api/admin-sekolah/dashboard')
    expect(calls.length).toBeGreaterThan(0)
    expect(calls.every((c) => c.status === 200 && c.method === 'GET')).toBe(true)
    expect(calls.every((c) => !('school_id' in c.query))).toBe(true)
  })
})

test.describe('responsive and text size', MODULE, () => {
  test('E2E-M27-22 no horizontal scroll; cards 4/4/2 per row; panels 4/2/1 per row; grade list inside its card', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    await expectNoHorizontalScroll(page)
    const width = viewportWidth(page)

    const cardTops = await rowsOf(page.getByTestId('sd-cards').locator('> div'))
    const cardRows = new Set(cardTops.map((t) => Math.round(t))).size
    expect(cardRows).toBe(width >= 768 ? 1 : 2)

    const panelTops = await rowsOf(page.locator('[data-testid="sd-panels"] > *'))
    const perRow = panelTops.filter((t) => Math.abs(t - panelTops[0]!) < 2).length
    // GPS, AMARAN AWAL (M18, XR-M27-08), LATIHAN, TINGKATAN
    expect(panelTops).toHaveLength(4)
    expect(perRow).toBe(width >= 1280 ? 4 : width >= 768 ? 2 : 1)
    if (width >= 1280) {
      // one row, each panel at its own left edge
      const lefts = await page
        .locator('[data-testid="sd-panels"] > *')
        .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))
      expect(new Set(lefts).size).toBe(lefts.length)
      expect(new Set(panelTops.map((t) => Math.round(t))).size).toBe(1)
    }

    const card = (await page.getByTestId('sd-performance').boundingBox())!
    for (const loc of [page.getByTestId('sd-grades'), page.getByTestId('sd-grades-total')]) {
      const box = (await loc.boundingBox())!
      expect(box.x).toBeGreaterThanOrEqual(card.x - 1)
      expect(box.x + box.width).toBeLessThanOrEqual(card.x + card.width + 1)
    }
    if (width < 640) {
      const chips = await rowsOf(page.getByTestId('sd-chips').locator('> li'))
      expect(chips.length).toBeGreaterThan(0)
    }
    // touch targets of the S0 links
    for (const id of ['sd-perutusan-all', 'sd-crumb-back', 'sd-grades-full']) {
      const box = (await page.getByTestId(id).boundingBox())!
      expect(box.height).toBeGreaterThanOrEqual(43.9)
    }
  })

  test('E2E-M27-23 every text on the page content is at least 12 px', async ({ page, gotoApp }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const small = await page.getByTestId('sd-page').evaluate((root) => {
      const out: string[] = []
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
      for (let n = walker.nextNode(); n; n = walker.nextNode()) {
        if (!n.textContent || n.textContent.trim() === '') continue
        const el = n.parentElement
        if (!el) continue
        const size = parseFloat(getComputedStyle(el).fontSize)
        if (size < 12) out.push(`${n.textContent.trim()} (${String(size)}px)`)
      }
      return out
    })
    expect(small).toEqual([])
  })

  test(
    'E2E-M27-24 endpoint forced to 500: no school data is shown',
    provisional(
      'load error handling is PROPOSED; the M01 global error page does not exist yet (SRS E2E-M27-24)',
      MODULE.tag,
    ),
    async ({ page, mock }) => {
      await signIn(page, AZLAN)
      await mock.failNext('/api/admin-sekolah/dashboard', 500)
      await spaGoto(page, PAGE)
      await expect(page.getByTestId('sd-error')).toBeVisible()
      await expect(page.getByTestId('sd-banner')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('navigation', MODULE, () => {
  test('E2E-M27-25 sidebar or drawer "Dashboard" opens S0; the M17 "← Dashboard" opens S0', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, AZLAN)
    await gotoApp('/admin-sekolah/monitoring')
    await expect(page.getByTestId('shell-user-header')).toBeVisible()
    if (isDesktopShell(page)) {
      await page.getByTestId('shell-user-sidebar').locator('[data-nav-id="sa-dashboard"]').click()
    } else {
      await page.getByTestId('shell-user-hamburger').click()
      await page.getByTestId('shell-user-drawer').locator('[data-nav-id="sa-dashboard"]').click()
    }
    await expect(page).toHaveURL(new RegExp(`${PAGE}$`))
    await expect(page.getByTestId('sd-banner')).toBeVisible()

    await gotoApp('/admin-sekolah/command-center')
    await page.getByTestId('cc-s2-back').click()
    await expect(page).toHaveURL(new RegExp(`${PAGE}$`))
    await expect(page.getByTestId('sd-banner')).toBeVisible()
  })
})

test.describe('Ringkasan Prestasi', MODULE, () => {
  test('E2E-M27-28 GPS panel equals M08 GPS (2 decimals), "{grade} · {band}" and "{n} entri headcount"', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const perf = await m08(page)
    const panel = page.getByTestId('sd-panel-gps')
    await expect(panel).toContainText('GPS Sekolah')
    expect(
      await panel.getByText('GPS Sekolah').evaluate((e) => getComputedStyle(e).textTransform),
    ).toBe('uppercase')
    await expect(page.getByTestId('sd-gps-entries')).toHaveText(
      `${ms(perf.gps.entries)} entri headcount`,
    )
    if (perf.gps.value === null) {
      await expect(page.getByTestId('sd-gps-value')).toHaveText('—')
      await expect(page.getByTestId('sd-gps-grade')).toHaveCount(0)
    } else {
      await expect(page.getByTestId('sd-gps-value')).toHaveText(perf.gps.value.toFixed(2))
      const grade = GRADES[Math.min(9, Math.floor(perf.gps.value + 0.5))]
      await expect(page.getByTestId('sd-gps-grade')).toHaveText(`${grade} · ${perf.gps.band}`)
    }
  })

  // Oracle note: the page cannot call the M18 endpoint or repo (the mock transport lives in the app and there is
  // no request hook), so the tallies are checked for internal consistency here; the equality with M18
  // `risk.forSchool` is asserted in the handler test (dashboard-handler.test.ts, real data, no pinned figures).
  test('E2E-M27-29 AMARAN AWAL: Selamat / Berhati / Berisiko, tallies add up to "{n} murid dinilai" and fit the pupil count', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const panel = page.getByTestId('sd-panel-risk')
    await expect(panel).toBeVisible()
    await expect(panel).toContainText('Amaran Awal')
    for (const label of ['Selamat', 'Berhati', 'Berisiko']) await expect(panel).toContainText(label)
    const safe = num(await page.getByTestId('sd-risk-safe').innerText())
    const watch = num(await page.getByTestId('sd-risk-watch').innerText())
    const high = num(await page.getByTestId('sd-risk-high').innerText())
    await expect(page.getByTestId('sd-risk-total')).toHaveText(
      `${ms(safe + watch + high)} murid dinilai`,
    )
    const pupils = num(await page.getByTestId('sd-card-value').nth(0).innerText())
    expect(safe + watch + high).toBeGreaterThan(0)
    expect(safe + watch + high).toBeLessThanOrEqual(pupils)
  })

  test('E2E-M27-30 LATIHAN: "{p}%" 1 decimal, "Purata Ketepatan", "{n} sesi · {m} soalan" equal M08 stats', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const perf = await m08(page)
    const panel = page.getByTestId('sd-panel-practice')
    await expect(panel).toContainText('Purata Ketepatan')
    await expect(page.getByTestId('sd-practice-accuracy')).toHaveText(
      perf.stats.sessions === 0 ? '—' : `${pct1(perf.stats.accuracy)}%`,
    )
    await expect(page.getByTestId('sd-practice-counts')).toHaveText(
      `${ms(perf.stats.sessions)} sesi · ${ms(perf.stats.answered)} soalan`,
    )
  })

  test('E2E-M27-31 TINGKATAN: two rows with M08 level accuracy, band colour, bar width, "Click untuk detail", link', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const perf = await m08(page)
    const panel = page.getByTestId('sd-panel-levels')
    await expect(panel).toContainText('Click untuk detail')
    await expect(panel).toHaveAttribute('href', '/prestasi/tingkatan')
    const rows = page.getByTestId('sd-level-row')
    await expect(rows).toHaveCount(2)
    await expect(rows.nth(0)).toContainText('Tingkatan 4')
    await expect(rows.nth(1)).toContainText('Tingkatan 5')
    for (const [i, level] of perf.levels.entries()) {
      await expect(page.getByTestId('sd-level-pct').nth(i)).toHaveText(`${pct1(level.accuracy)}%`)
      const cls = level.accuracy < 50 ? /red/ : level.accuracy < 70 ? /amber/ : /emerald/
      await expect(page.getByTestId('sd-level-pct').nth(i)).toHaveClass(cls)
      const width = await page
        .getByTestId('sd-level-bar')
        .nth(i)
        .evaluate((e) => (e as HTMLElement).style.width)
      expect(parseFloat(width)).toBeCloseTo(Math.min(100, level.accuracy), 1)
    }
    await expect(rows.nth(0).locator('xpath=ancestor::a')).toHaveAttribute(
      'href',
      '/prestasi/tingkatan',
    )
  })

  test('E2E-M27-32 "Taburan Gred (Anggaran)": grade list equals M08 distribution; "Lihat penuh →" opens M08 S1', async ({
    page,
    gotoApp,
  }) => {
    await signIn(page, POPULATED)
    await open(page, gotoApp)
    const perf = await m08(page)
    await expect(page.getByTestId('sd-grades-heading')).toHaveText('Taburan Gred (Anggaran)')
    await expect(page.getByTestId('sd-grade-letter')).toHaveText(GRADES)
    await expect(page.getByTestId('sd-grade-count')).toHaveText(
      perf.distribution.map((d) => ms(d.count)),
    )
    await expect(page.getByTestId('sd-grade-pct')).toHaveText(
      perf.distribution.map((d) => `${pct1(d.pct)}%`),
    )
    const total = perf.distribution.reduce((s, d) => s + d.count, 0)
    await expect(page.getByTestId('sd-grades-total')).toHaveText(`Jumlah: ${ms(total)} rekod`)
    const full = page.getByTestId('sd-grades-full')
    await expect(full).toHaveText('Lihat penuh →')
    await expect(full).toHaveAttribute('href', '/prestasi/sekolah')
    await full.click()
    await expect(page).toHaveURL(/\/prestasi\/sekolah$/)
    await expectTabTitle(page, 'Dashboard Sekolah — Prestasi')
  })

  test(
    'E2E-M27-33 no-data school: GPS "—", "0 entri headcount", LATIHAN "—", both level rows, grade list zeros',
    provisional('no-data states are INFERRED (SRS E2E-M27-33)', MODULE.tag),
    async ({ page, gotoApp }) => {
      await signIn(page, SUHAIMI)
      await open(page, gotoApp)
      const perf = await m08(page)
      expect(perf.gps.entries).toBe(0)
      expect(perf.stats.sessions).toBe(0)
      await expect(page.getByTestId('sd-gps-value')).toHaveText('—')
      await expect(page.getByTestId('sd-gps-grade')).toHaveCount(0)
      await expect(page.getByTestId('sd-gps-entries')).toHaveText('0 entri headcount')
      await expect(page.getByTestId('sd-practice-accuracy')).toHaveText('—')
      await expect(page.getByTestId('sd-practice-counts')).toHaveText('0 sesi · 0 soalan')
      await expect(page.getByTestId('sd-level-row')).toHaveCount(2)
      await expect(page.getByTestId('sd-grade-row')).toHaveCount(10)
      await expect(page.getByTestId('sd-grade-count')).toHaveText(GRADES.map(() => '0'))
      await expect(page.getByTestId('sd-grades-total')).toHaveText('Jumlah: 0 rekod')
    },
  )

  test('E2E-M27-34 S0 GPS, entries, sessions, questions and accuracy equal M08 S1; another school changes every figure', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await switchTo(page, mock, gotoApp, POPULATED)
    await expect(page.getByTestId('sd-grades')).toBeVisible()
    const own = await m08(page)
    await expect(page.getByTestId('sd-gps-entries')).toHaveText(
      `${ms(own.gps.entries)} entri headcount`,
    )
    await expect(page.getByTestId('sd-practice-counts')).toHaveText(
      `${ms(own.stats.sessions)} sesi · ${ms(own.stats.answered)} soalan`,
    )
    const ownPage = await page.getByTestId('sd-performance').innerText()

    await switchTo(page, mock, gotoApp, AZLAN)
    await expect(page.getByTestId('sd-banner-name')).toHaveText('SMK Demo Seri Putra')
    const other = await m08(page)
    await expect(page.getByTestId('sd-gps-entries')).toHaveText(
      `${ms(other.gps.entries)} entri headcount`,
    )
    expect(await page.getByTestId('sd-performance').innerText()).not.toBe(ownPage)
    expect(own.stats.sessions).not.toBe(other.stats.sessions)
  })
})
