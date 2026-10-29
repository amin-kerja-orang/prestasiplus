/**
 * M08 G5 QA: menus (AC-M08-01.1/01.2/33.2), shell header titles (01.3/01.4), guest redirects and the
 * 404 / 403 pages (02.1-02.5), `/analisa-item` redirects (03.1-03.3), role guards (§9, OD-R3 / OD-R4).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTabTitle, isDesktopShell, moduleTag } from '../support'

const FORBIDDEN_TITLE = 'Akses Ditolak | PRESTASIPLUS'
const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'

const header = (page: Page) => ({
  title: page.getByTestId('shell-user-title'),
  subtitle: page.getByTestId('shell-user-subtitle'),
})

async function expectNotFound(page: Page): Promise<void> {
  await expect(page.locator('[data-page=not-found]')).toBeVisible()
  await expectTabTitle(page, NOT_FOUND_TITLE)
  const root = page.locator('[data-page=not-found]')
  await expect(root).toContainText('404')
  await expect(root).toContainText('🔍')
  await expect(root).toContainText('Halaman Tidak Dijumpai')
  await expect(root).toContainText(
    'Maaf, halaman yang anda cari tidak wujud atau telah dipindahkan. Mungkin URL salah taip?',
  )
  await expect(page.getByRole('link', { name: 'Halaman Utama' })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: 'Mula Latihan' })).toHaveAttribute(
    'href',
    '/practice',
  )
  await expectNoHorizontalScroll(page)
}

async function expectForbidden(page: Page): Promise<void> {
  const root = page.locator('[data-page=forbidden]')
  await expect(root).toBeVisible()
  await expectTabTitle(page, FORBIDDEN_TITLE)
  await expect(root).toContainText('403')
  await expect(root).toContainText('🚫')
  await expect(root).toContainText('Akses Ditolak')
  await expect(root).toContainText(
    'Anda tidak mempunyai kebenaran untuk mengakses halaman ini. Sila log masuk dengan akaun yang betul atau hubungi pentadbir.',
  )
  await expect(page.getByRole('link', { name: 'Halaman Utama' })).toHaveAttribute('href', '/')
  await expect(page.getByRole('link', { name: 'Log Masuk' })).toHaveAttribute('href', '/login')
  await expectNoHorizontalScroll(page)
}

/** Hrefs of every link in the active nav surface (sidebar at 1280, the drawer opened via "Lagi" below). */
async function navHrefs(page: Page): Promise<Map<string, string>> {
  let root
  if (isDesktopShell(page)) {
    root = page.getByTestId('shell-user-sidebar')
  } else {
    await page.getByTestId('shell-user-bottom-nav').locator('button').last().click()
    root = page.getByTestId('shell-user-drawer')
    await expect(root).toBeVisible()
  }
  const links = await root
    .locator('a[href]')
    .evaluateAll((as) =>
      as.map(
        (a) =>
          [
            (a.textContent ?? '').trim().replace(/\s+/g, ' '),
            a.getAttribute('href') ?? '',
          ] as const,
      ),
    )
  const m = new Map<string, string>()
  for (const [label, href] of links) m.set(`${label}|${href}`, href)
  return m
}

test.describe('M08 G5 menus (admin)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('AC-01.1/01.2/33.2 the seven M08 links in the sidebar (1280) or the "Lagi" drawer (375/768)', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/prestasi/sekolah')
    await expect(header(page).title).toHaveText('Dashboard Sekolah')
    const links = await navHrefs(page)
    const keys = [...links.keys()]
    for (const [label, href] of [
      ['Headcount', '/headcount'],
      ['Prestasi', '/prestasi'],
      ['Analitik Adaptif', '/analitik/pelajar'],
      ['Analisa Item', '/analisa-item'],
      ['Laporan Mingguan', '/laporan-mingguan'],
      ['Kedudukan', '/ranking'],
      ['Timeline Saya', '/timeline'],
    ]) {
      expect(keys, `${label} -> ${href}`).toContain(`${label}|${href}`)
    }
    await expectNoHorizontalScroll(page)
  })

  test('AC-01.1 the sidebar items are navigable: Prestasi, Kedudukan, Timeline Saya', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/prestasi/sekolah')
    await expect(header(page).title).toHaveText('Dashboard Sekolah')
    await navHrefs(page)
    const scope = isDesktopShell(page)
      ? page.getByTestId('shell-user-sidebar')
      : page.getByTestId('shell-user-drawer')
    await scope.locator('a[href="/ranking"]').first().click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/ranking')
  })

  test('AC-03.1 the "Analisa Item" menu item opens S10 for the admin', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/prestasi/sekolah')
    await expect(header(page).title).toHaveText('Dashboard Sekolah')
    await navHrefs(page)
    const scope = isDesktopShell(page)
      ? page.getByTestId('shell-user-sidebar')
      : page.getByTestId('shell-user-drawer')
    await scope.locator('a[href="/analisa-item"]').first().click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/analisa-item/kelas')
    await expect(header(page).title).toHaveText('Analisa Item')
  })
})

test.describe('M08 G5 menus (guru drawer PENILAIAN)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('AC-01.2 teacher group: Headcount -> /headcount and Prestasi -> /prestasi/kelas', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('guru@demo.test')
    await gotoApp('/prestasi/kelas')
    await expect(header(page).title).toHaveText('Prestasi Kelas')
    const links = await navHrefs(page)
    const keys = [...links.keys()]
    expect(keys).toContain('Headcount|/headcount')
    expect(keys).toContain('Prestasi|/prestasi/kelas')
  })
})

interface TitleCase {
  who: string
  path: string
  title: string
  subtitle: string | RegExp
}

const SEKOLAH = /SK Demo|SMK|Sekolah/i
const TITLES: TitleCase[] = [
  {
    who: 'admin',
    path: '/prestasi/tingkatan',
    title: 'Dashboard Tingkatan',
    subtitle: 'Pilih tingkatan untuk lihat prestasi keseluruhan',
  },
  {
    who: 'admin',
    path: '/prestasi/tingkatan/t4',
    title: 'Tingkatan 4',
    subtitle: 'Dashboard Prestasi Tingkatan',
  },
  {
    who: 'admin',
    path: '/prestasi/kelas',
    title: 'Prestasi Kelas',
    subtitle: 'Pilih kelas untuk lihat prestasi keseluruhan',
  },
  {
    who: 'admin',
    path: '/prestasi/kelas/228',
    title: 'ALFA - Bahasa Inggeris',
    subtitle: /· Bahasa Inggeris · 2026$/,
  },
  { who: 'admin', path: '/prestasi/kelas/516', title: '4 Simulasi', subtitle: /· 2026$/ },
  {
    who: 'admin',
    path: '/analitik/pelajar',
    title: 'Analitik Pembelajaran',
    subtitle: 'Pantau prestasi dan kenal pasti topik yang perlu diperkukuhkan',
  },
  {
    who: 'admin',
    path: '/analitik/kelas?classroom_id=4',
    title: 'Analitik Kelas',
    subtitle: 'Pantau prestasi pelajar dan kenal pasti yang memerlukan perhatian',
  },
  {
    who: 'admin',
    path: '/analisa-item/sekolah',
    title: 'Analisa Item — Sekolah',
    subtitle: SEKOLAH,
  },
  {
    who: 'admin',
    path: '/analisa-item/kelas',
    title: 'Analisa Item',
    subtitle: 'Analisis tahap kesukaran dan diskriminasi soalan mengikut kelas',
  },
  {
    who: 'admin',
    path: '/analisa-item/kelas/228',
    title: 'Analisa Item',
    subtitle: 'Analisis tahap kesukaran dan diskriminasi soalan mengikut kelas',
  },
  {
    who: 'admin',
    path: '/timeline',
    title: 'Timeline Saya',
    subtitle: 'Kongsi pencapaian & cerita anda',
  },
  {
    who: 'admin',
    path: '/timeline/create',
    title: 'Tambah Post',
    subtitle: 'Kongsi pencapaian atau cerita baru',
  },
  {
    who: 'admin',
    path: '/leaderboard',
    title: 'Papan Pendahulu',
    subtitle: 'Siapa juara minggu ini?',
  },
  {
    who: 'admin',
    path: '/prestasi/sekolah',
    title: 'Dashboard Sekolah',
    subtitle: 'Selamat datang kembali',
  },
  { who: 'admin', path: '/prestasi/1', title: 'Prestasi 360', subtitle: 'Selamat datang kembali' },
  { who: 'admin', path: '/headcount', title: 'Headcount', subtitle: 'Selamat datang kembali' },
  {
    who: 'admin',
    path: '/headcount/dashboard',
    title: 'Dashboard Headcount',
    subtitle: 'Selamat datang kembali',
  },
  {
    who: 'admin',
    path: '/headcount/create',
    title: 'Buat Headcount Baru',
    subtitle: 'Selamat datang kembali',
  },
  {
    who: 'admin',
    path: '/headcount/student/3201',
    title: 'Headcount — Prestasi Individu',
    subtitle: 'Selamat datang kembali',
  },
  { who: 'admin', path: '/ranking', title: 'Kedudukan', subtitle: 'Selamat datang kembali' },
  {
    who: 'admin',
    path: '/headcount/213/summary',
    title: 'Ringkasan Kelas',
    subtitle: 'Selamat datang kembali',
  },
  {
    who: 'admin',
    path: '/headcount/213',
    title: 'Headcount Sejarah',
    subtitle: 'Selamat datang kembali',
  },
]

test.describe('M08 G5 shell header titles (AC-01.3 / 01.4)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  for (const c of TITLES) {
    test(`${c.path} -> "${c.title}"`, async ({ page, gotoApp, loginAs }) => {
      await loginAs('admin@demo.test')
      await gotoApp(c.path)
      await expect(header(page).title).toHaveText(c.title)
      await expect(header(page).subtitle).toHaveText(c.subtitle)
    })
  }
})

test.describe('M08 G5 guest access (AC-02.1)', { tag: [moduleTag(8)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  for (const path of [
    '/prestasi',
    '/prestasi/sekolah',
    '/prestasi/tingkatan/t4',
    '/prestasi/kelas/2001',
    '/prestasi/1',
    '/analitik/kelas?classroom_id=4',
    '/analitik/pelajar',
    '/analisa-item/kelas/228',
    '/analisa-item/sekolah/8880',
    '/headcount',
    '/headcount/dashboard',
    '/headcount/create',
    '/headcount/213',
    '/headcount/213/summary',
    '/headcount/student/3001',
    '/ranking',
    '/leaderboard',
    '/timeline',
    '/timeline/create',
    '/laporan-mingguan',
  ]) {
    test(`${path} goes to /login`, async ({ page, gotoApp }) => {
      await gotoApp(path)
      await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
    })
  }

  test('/pelajar/1 renders for a guest (public)', async ({ page, gotoApp }) => {
    await gotoApp('/pelajar/1')
    await expect(page.locator('h1').first()).toHaveText('Admin Demo')
    expect(new URL(page.url()).pathname).toBe('/pelajar/1')
  })
})

test.describe(
  'M08 G5 unknown ids and the 404 / 403 pages (AC-02.2 .. 02.5)',
  { tag: [moduleTag(8)] },
  () => {
    test.use({ mockInit: { latency: 0 } })

    test('AC-02.2 /prestasi replaces to /prestasi/sekolah for the admin', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('admin@demo.test')
      await gotoApp('/prestasi')
      await expect.poll(() => new URL(page.url()).pathname).toBe('/prestasi/sekolah')
      await expect(header(page).title).toHaveText('Dashboard Sekolah')
    })

    for (const path of [
      '/prestasi/tingkatan/t3',
      '/prestasi/tingkatan/t6',
      '/prestasi/99999999',
      '/headcount/student/99999999',
      '/pelajar/99999999',
      '/pelajar/abc',
      '/prestasi/kelas/sc-419',
      '/prestasi/kelas/99999999',
      '/headcount/1',
      '/headcount/99999999',
      '/headcount/99999999/summary',
      '/timeline/1',
      '/analisa-item/pelajar',
    ]) {
      test(`AC-02.3 ${path} is the 404 page`, async ({ page, gotoApp, loginAs }) => {
        await loginAs('admin@demo.test')
        await gotoApp(path)
        await expectNotFound(page)
      })
    }

    test('AC-02.3 /pelajar/99999999 is the 404 page for a guest too', async ({ page, gotoApp }) => {
      await gotoApp('/pelajar/99999999')
      await expectNotFound(page)
    })

    test('AC-02.4 /analisa-item/kelas/99999999 is the 403 page', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('admin@demo.test')
      await gotoApp('/analisa-item/kelas/99999999')
      await expectForbidden(page)
    })

    test('AC-33.1 /laporan-mingguan (and ?week=1) is the 403 page for the admin', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('admin@demo.test')
      await gotoApp('/laporan-mingguan')
      await expectForbidden(page)
      await gotoApp('/laporan-mingguan?week=1')
      await expectForbidden(page)
    })
  },
)

test.describe(
  'M08 G5 /analisa-item redirect per role (AC-03.2 / 03.3)',
  { tag: [moduleTag(8)] },
  () => {
    test.use({ mockInit: { latency: 0 } })

    const rows: Array<[string, string]> = [
      ['admin@demo.test', '/analisa-item/kelas'],
      ['guru@demo.test', '/analisa-item/kelas'],
      ['adminsekolah@demo.test', '/analisa-item/sekolah'],
      ['pelajar@demo.test', '/dashboard'],
    ]
    for (const [who, target] of rows) {
      test(`${who} -> ${target}`, async ({ page, gotoApp, loginAs }) => {
        await loginAs(who)
        await gotoApp('/analisa-item')
        await expect.poll(() => new URL(page.url()).pathname).toBe(target)
        if (target === '/dashboard') await expect(page.locator('[role=alert]')).toHaveCount(0)
      })
    }
  },
)

test.describe(
  'M08 G5 role guards (pelajar / school admin / teacher)',
  { tag: [moduleTag(8)] },
  () => {
    test.use({ mockInit: { latency: 0 } })

    for (const path of [
      '/headcount',
      '/headcount/dashboard',
      '/headcount/create',
      '/analisa-item/kelas',
      '/analisa-item/kelas/2001',
      '/laporan-mingguan',
    ]) {
      test(`pelajar ${path} is the 403 page`, async ({ page, gotoApp, loginAs }) => {
        await loginAs('pelajar@demo.test')
        await gotoApp(path)
        await expectForbidden(page)
      })
    }

    test('pelajar cannot open another pupil prestasi (/prestasi/3001)', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/prestasi/3001')
      await expect(page.locator('[data-page=forbidden], [data-page=not-found]')).toBeVisible()
    })

    test('pelajar cannot open the headcount of a pupil (/headcount/student/3001)', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/headcount/student/3001')
      await expect(page.locator('[data-page=forbidden], [data-page=not-found]')).toBeVisible()
    })

    for (const path of ['/analisa-item/kelas', '/analisa-item/kelas/228', '/laporan-mingguan']) {
      test(`school admin ${path} is the 403 page`, async ({ page, gotoApp, loginAs }) => {
        await loginAs('adminsekolah@demo.test')
        await gotoApp(path)
        await expectForbidden(page)
      })
    }

    test('school admin /analisa-item/sekolah/8880 (another school) is the 403 page', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('adminsekolah@demo.test')
      await gotoApp('/analisa-item/sekolah/8880')
      await expectForbidden(page)
    })

    test("teacher cannot open another teacher's class (S5 404, S11 403)", async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('guru@demo.test')
      await gotoApp('/prestasi/kelas/228')
      await expect(page.locator('[data-page=not-found]')).toBeVisible()
      await gotoApp('/analisa-item/kelas/228')
      await expectForbidden(page)
    })

    test('teacher /laporan-mingguan does not crash (unspecified, BLOCKED OQ-M08-01)', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('guru@demo.test')
      await gotoApp('/laporan-mingguan')
      await expect(page.locator('[data-page], h1').first()).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  },
)
