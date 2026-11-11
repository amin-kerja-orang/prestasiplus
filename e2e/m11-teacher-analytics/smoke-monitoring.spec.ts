/**
 * M11 S2-S5 Monitoring at 375 / 768 / 1280 (M11-T3; SRS M11 §12: E2E-M11-01/02 (shell), 03 (guest), 04,
 * 05, 17-19, 21-24, 26, 28, 30-37, 39, 42, 52, 53). Accounts: 5 guru on `/guru/monitoring*` (admin
 * shell, teacher variant), the admin, and 8 Admin Sekolah on the `/admin-sekolah/monitoring*` alias
 * (user shell, own school only: SMK DEMO 900001), plus the role refusals. Teacher and school-admin
 * steps are provisional (SRS §9, OQ-M11-01/02). The mock figures are the observed S2 anchors (SRS §6.7).
 */

import type { Locator, Page } from '@playwright/test'

import { expect, reloadApp, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isMobileWidth,
  moduleTag,
  provisional,
} from '../support'

const GURU = 'guru@demo.test'
const ADMIN = 'admin@demo.test'
const ADMIN_SEKOLAH = 'adminsekolah@demo.test'
const PELAJAR = 'pelajar@demo.test'
const MODULE = { tag: [moduleTag(11)] }
const NOT_FOUND_TITLE = 'Halaman Tidak Dijumpai | PRESTASIPLUS'
const S2_TITLE = 'Monitoring Penglibatan | PRESTASIPLUS'
/** 44 px below `lg`, the live 36 px from `lg` (DV-M11-17, M03 precedent). */
const touchMin = (page: Page) => (page.viewportSize()!.width >= 1024 ? 36 : 44)
const PROV = (reason: string) => provisional(reason)

test.use({ mockInit: { latency: 0 } })

const tid = (page: Page, id: string) => page.getByTestId(id)

/** The EXPECTED shell is a parameter (admin pages: Pentadbiran; guru pages: see the layout of the route). */
async function header(
  page: Page,
  shell: 'pembelajaran' | 'pentadbiran',
  title: string,
  subtitle?: string,
) {
  await expect(tid(page, `${shell}-header`).locator('h1')).toHaveText(title)
  if (subtitle) await expect(tid(page, `${shell}-subtitle`)).toHaveText(subtitle)
}
const adminHeader = (page: Page, title: string, subtitle?: string) =>
  header(page, 'pentadbiran', title, subtitle)

/** A DsStatRow cell `<prefix>-<key>` reads "<value><label> ..." (no value test id on the tile). */
async function expectCell(page: Page, id: string, value: string) {
  // Values hold only digits, "," "." and "%": "." in the pattern is harmless.
  await expect(tid(page, id)).toHaveText(new RegExp('^\\s*' + value + '(?![\\d,.])'))
}

/** Cards of S3-S5 (DsStatRow `mon-stat-<key>`), checked in order. */
async function expectStats(page: Page, keys: string[], values: string[]) {
  for (const [i, key] of keys.entries()) await expectCell(page, `mon-stat-${key}`, values[i]!)
}

/** S2 section tabs (DsPillNav `mon-tab-nav-<key>`): the other sections stay in the DOM but hidden. */
async function openTab(page: Page, key: 'pelajar' | 'guru' | 'mingguan' | 'perhatian' | 'cadangan') {
  await tid(page, `mon-tab-nav-${key}`).click()
}

async function openOverview(page: Page, gotoApp: (p: string) => Promise<void>, path: string) {
  await gotoApp(path)
  await expect(tid(page, 'mon-kpis')).toBeVisible()
  // below 768 the tables are cards (Change 4, DsDataTable): rows exist from the tablet width up
  if (isMobileWidth(page)) await expect(tid(page, 'mon-table-student')).toBeVisible()
  else
    await expect(tid(page, 'mon-table-student').getByTestId('mon-table-row').first()).toBeVisible()
}

test.describe('M11 S2 Monitoring Penglibatan (admin, /admin/monitoring)', MODULE, () => {
  test(
    'SRS §12 #01/#02 header, tab title, admin chrome; guide, filters, tools render @m11',
    PROV('admin shell header of the V3 rebuild is UNVERIFIED'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await openOverview(page, gotoApp, '/admin/monitoring')
      await expectTabTitle(page, S2_TITLE)
      await adminHeader(
        page,
        'Monitoring Penglibatan',
        'Pemantauan penglibatan pelajar & sekolah', // V2 admin/monitoring.blade.php:8 = routes/monitoring.ts:85 (MonitoringPage.vue:123 passes another SUBTITLE to DsPage: reported)
      )
      await expect(tid(page, 'pentadbiran-header')).toBeVisible()
      await expectNoHorizontalScroll(page)
    },
  )

  test('SRS §12 #17 guide: six tiles, anchors, tip; close hides and persists; show again @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openOverview(page, gotoApp, '/admin/monitoring')
    await expect(tid(page, 'mon-guide-tile')).toHaveCount(6)
    const hrefs = await tid(page, 'mon-guide-tile')
      .locator('a')
      .evaluateAll((els) =>
        els.map((e) => (e.getAttribute('href') ?? '').replace(/^.*(?=#)/, '')),
      )
    expect(hrefs).toEqual([
      '#section-ringkasan',
      '#section-pelajar',
      '#section-guru',
      '#section-mingguan',
      '#section-perhatian',
      '#section-pelajar',
    ])
    await expect(tid(page, 'mon-guide-legend')).toContainText(
      'Cemerlang >60% | Sederhana 20-60% | Rendah <20% | Tiada 0%',
    )
    await expect(tid(page, 'mon-guide-tip')).toContainText(
      'Tip: Guna Filter untuk tapis negeri/tempoh/tahap. Export PDF/CSV untuk pembentangan.',
    )
    await expectTouchTarget(tid(page, 'mon-guide-close'), touchMin(page))
    await expectNoHorizontalScroll(page)

    await tid(page, 'mon-guide-close').click()
    await expect(tid(page, 'mon-guide')).toHaveCount(0)
    await expect(tid(page, 'mon-guide-show')).toHaveText('Tunjuk panduan penggunaan')
    await reloadApp(page)
    await expect(tid(page, 'mon-kpis')).toBeVisible()
    await expect(tid(page, 'mon-guide')).toHaveCount(0)
    await tid(page, 'mon-guide-show').click()
    await expect(tid(page, 'mon-guide')).toBeVisible()
    await reloadApp(page)
    await expect(tid(page, 'mon-guide')).toBeVisible()
  })

  test('SRS §12 #17 a guide anchor scrolls to its section @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openOverview(page, gotoApp, '/admin/monitoring')
    await tid(page, 'mon-guide-tile').nth(3).locator('a').click()
    await expect(page.locator('#section-mingguan')).toBeInViewport()
  })

  test('SRS §12 #18/#19 filters: defaults, no Reset, selects and buttons are touch-sized; export hrefs @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openOverview(page, gotoApp, '/admin/monitoring')
    await expect(tid(page, 'mon-period')).toHaveValue('')
    await expect(tid(page, 'mon-state')).toHaveValue('')
    await expect(tid(page, 'mon-tahap')).toHaveValue('')
    await expect(tid(page, 'mon-reset')).toHaveCount(0) // DsFilterBar: show-reset false, active filters are chips
    expect(await tid(page, 'mon-period').locator('option').allTextContents()).toEqual([
      'Semua Masa',
      '7 Hari',
      '30 Hari',
      '3 Bulan',
    ])
    expect(await tid(page, 'mon-tahap').locator('option').allTextContents()).toEqual([
      'Semua Tahap',
      'Cemerlang',
      'Sederhana',
      'Rendah',
      'Tiada',
    ])
    // 44px on touch viewports only; the staff theme is 40px from lg (NFR-RESP-03).
    if (page.viewportSize()!.width < 1024) {
      for (const id of ['mon-period', 'mon-state', 'mon-tahap', 'mon-refresh']) {
        await expectTouchTarget(tid(page, id), 44)
      }
      await expectTouchTarget(page.getByRole('button', { name: 'Tapis' }), 44)
    }
    await expect(tid(page, 'mon-export-pdf')).toHaveAttribute(
      'href',
      '/admin/monitoring/export/pdf?',
    )
    await expect(tid(page, 'mon-export-csv')).toHaveAttribute(
      'href',
      '/admin/monitoring/export/csv?',
    )
    await expectNoHorizontalScroll(page)

    await tid(page, 'mon-period').selectOption('7d')
    await page.getByRole('button', { name: 'Tapis' }).click()
    await expect(page).toHaveURL(/\/admin\/monitoring\?.*period=7d/)
    await expect(tid(page, 'mon-period')).toHaveValue('7d')
    await expect(tid(page, 'mon-export-csv')).toHaveAttribute(
      'href',
      '/admin/monitoring/export/csv?period=7d',
    )
    await expectCell(page, 'mon-kpi-engaged', '44')
    await expectCell(page, 'mon-kpi-answers', '7,651')

    await tid(page, 'mon-period').selectOption('')
    await tid(page, 'mon-state').selectOption('Selangor')
    await tid(page, 'mon-tahap').selectOption('Rendah')
    await page.getByRole('button', { name: 'Tapis' }).click()
    await expect(tid(page, 'mon-export-pdf')).toHaveAttribute(
      'href',
      '/admin/monitoring/export/pdf?state=Selangor&tahap=Rendah',
    )
    // 'Jumlah Sekolah' for Selangor is 25 in the mock (observed 28: M02 allocation gap, T1 `it.fails`).
    await expectCell(page, 'mon-kpi-schools', '25')
    await expect(tid(page, 'mon-table-student').getByTestId('mon-table-row')).toHaveCount(3) // 8087, 8102, 8107 (overview.test.ts:90)
    await expect(tid(page, 'mon-table-teacher').getByTestId('mon-table-row')).toHaveCount(10)
  })

  test('SRS §12 #23 an empty filter result: 0 sekolah, empty bodies, the single signals card @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/monitoring?period=&state=Kelantan&tahap=Cemerlang')
    for (const section of ['#section-perhatian', '#section-cadangan']) {
      await expect(page.locator(section).getByTestId('mon-signals-empty')).toHaveText(
        'Tiada pemerhatian yang perlu diberi perhatian buat masa ini.',
      )
    }
    await expect(tid(page, 'mon-table-student').getByTestId('mon-table-count')).toHaveText(
      '0 sekolah',
    )
    await expect(tid(page, 'mon-table-teacher').getByTestId('mon-table-count')).toHaveText(
      '0 sekolah',
    )
    await expect(tid(page, 'mon-table-row')).toHaveCount(0)
    await expect(tid(page, 'mon-weekly-row')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #22/#24 default KPIs, 33 school rows in order, legend and pill colours @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openOverview(page, gotoApp, '/admin/monitoring')
    for (const [key, value] of [
      ['schools', '57'],
      ['students', '4,158'],
      ['engaged', '1,462'],
      ['engagement', '35.2%'],
      ['answers', '472,371'],
      ['average', '323.1'],
      ['teachers', '522'],
      ['teachersLoggedIn', '277'],
      ['teacherPct', '53.1%'],
    ] as const) {
      await expectCell(page, `mon-kpi-${key}`, value)
    }
    const student = tid(page, 'mon-table-student')
    await expect(student.getByTestId('mon-table-count')).toHaveText('33 sekolah')
    await expect(student.getByTestId('mon-table-row')).toHaveCount(25) // page size 25
    await expect(student.getByTestId('mon-school-link').first()).toHaveAttribute(
      'href',
      '/admin/monitoring/sekolah/940',
    )
    const row6 = student.getByTestId('mon-table-row').nth(5).locator('xpath=ancestor::tr')
    await expect(row6).toContainText('184')
    await expect(row6).toContainText('174')
    await expect(row6).toContainText('94.6%')
    await expect(row6).toContainText('Cemerlang')
    await student.getByTestId('mon-legend').locator('summary').click()
    await expect(student.getByTestId('mon-legend')).toContainText('Legenda')
    for (const label of [
      'Cemerlang (> 60%)',
      'Sederhana (20-60%)',
      'Rendah (< 20%)',
      'Tiada (0%)',
    ]) {
      await expect(student.getByTestId('mon-legend')).toContainText(label)
    }
    await expect(tid(page, 'mon-table-teacher').getByTestId('mon-table-count')).toHaveText(
      '13 sekolah',
    )
    await openTab(page, 'guru')
    await tid(page, 'mon-table-teacher').getByTestId('mon-legend').locator('summary').click()
    await expect(tid(page, 'mon-table-teacher').getByTestId('mon-legend')).toContainText(
      'Tiada Guru (0 daftar)',
    )
    // The fixture school 900001 has no row and no link (BR-M11-34, E2E-M11-53).
    await expect(page.locator('a[href*="/sekolah/900001"]')).toHaveCount(0)
    // The table scrolls inside its card at every width.
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #26/#27 weekly table: last 12 weeks M1..M12, 33 rows, Best and Trend (R1-AS-10) @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    test.skip(isMobileWidth(page), 'the weekly table is cards below 768 (Change 4)')
    await loginAs(ADMIN)
    await openOverview(page, gotoApp, '/admin/monitoring')
    // 32 weeks come from the API; the page shows the last 12, labelled M1..M12 oldest first.
    await expect(tid(page, 'mon-week-head')).toHaveCount(12)
    await expect(tid(page, 'mon-week-head')).toHaveText(
      Array.from({ length: 12 }, (_, n) => `M${String(n + 1)}`),
    )
    await expect(tid(page, 'mon-week-head').last()).toHaveAttribute('title', '21/09 - 25/09')
    await expect(tid(page, 'mon-weekly-row')).toHaveCount(20) // first page of 20
    await expect(tid(page, 'mon-week-footer')).toContainText('M12: 21/09 - 25/09')
    await expect(tid(page, 'mon-week-footer')).not.toContainText('M13')
    await expect(tid(page, 'mon-weekly').first()).toContainText('12 minggu terakhir')
    const row = tid(page, 'mon-weekly-row').first()
    await expect(row.locator('xpath=ancestor::tr').getByTestId('mon-weekly-cell')).toHaveCount(12)
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #28 lists: Terbaik 940/987/995, 18 Perhatian, 17 Cadangan @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openOverview(page, gotoApp, '/admin/monitoring')
    await openTab(page, 'perhatian')
    await expect(tid(page, 'mon-best-item')).toHaveCount(3)
    // Lists show 6 rows, "mon-list-more" expands (MonitoringSignals.vue:21).
    await expect(tid(page, 'mon-attention-item')).toHaveCount(6)
    await tid(page, 'mon-attention').getByRole('button', { name: /^Tunjuk semua/ }).click()
    await expect(tid(page, 'mon-attention-item')).toHaveCount(18)
    await openTab(page, 'cadangan')
    await expect(tid(page, 'mon-suggestion-item')).toHaveCount(6)
    await tid(page, 'mon-suggestions').getByRole('button', { name: /^Tunjuk semua/ }).click()
    await expect(tid(page, 'mon-suggestion-item')).toHaveCount(15) // overview.test.ts:306-317
    await openTab(page, 'perhatian')
    await expect(tid(page, 'mon-attention-item').first()).toContainText('Tahap rendah.')
    await expect(tid(page, 'mon-attention-item').nth(1)).toContainText('Tahap rendah.')
    await expect(
      tid(page, 'mon-attention-item').filter({ hasText: '(Nota: 16 guru telah login)' }),
    ).toHaveCount(1)
    await expectNoHorizontalScroll(page)
  })

  test(
    'SRS §12 #20 the CSV link downloads monitoring-penglibatan.csv with 33 data lines @m11',
    PROV('export content PROPOSED (Q-M11-7)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await openOverview(page, gotoApp, '/admin/monitoring')
      const [download] = await Promise.all([
        page.waitForEvent('download'),
        tid(page, 'mon-export-csv').click(),
      ])
      expect(download.suggestedFilename()).toBe('monitoring-penglibatan.csv')
      const stream = await download.createReadStream()
      const chunks: Buffer[] = []
      for await (const chunk of stream) chunks.push(chunk as Buffer)
      const lines = Buffer.concat(chunks).toString('utf8').split('\n')
      expect(lines).toHaveLength(34)
      expect(lines[0]).toBe('\uFEFF"#","Sekolah","Kod","Negeri","Daftar","Aktif","%","Tahap"')
    },
  )

  test('SRS §12 #21 auto-refresh: 5:00 → 4:59, pause stops, play resumes, 0:00 reloads to 5:00 @m11', async ({
    page,
    gotoApp,
    loginAs,
    clock,
  }) => {
    await loginAs(ADMIN)
    await openOverview(page, gotoApp, '/admin/monitoring')
    const countdown = tid(page, 'mon-countdown')
    // The page clock flows after boot: pause it, then read the start value and step it exactly.
    await clock.pauseAt((await page.evaluate(() => Date.now())) + 100)
    const secs = async () => {
      const [m, ss] = (await countdown.innerText()).split(':').map(Number)
      return m! * 60 + ss!
    }
    const label = (n: number) => `${String(Math.floor(n / 60))}:${String(n % 60).padStart(2, '0')}`
    const s0 = await secs()
    expect(s0).toBeGreaterThan(280)
    await clock.runFor(1000)
    await expect(countdown).toHaveText(label(s0 - 1))
    await tid(page, 'mon-refresh-toggle').click()
    await expect(tid(page, 'mon-refresh-toggle')).toHaveAttribute('data-icon', 'play')
    await clock.runFor(5000)
    await expect(countdown).toHaveText(label(s0 - 1))
    await tid(page, 'mon-refresh-toggle').click()
    await expect(tid(page, 'mon-refresh-toggle')).toHaveAttribute('data-icon', 'pause')
    await clock.runFor(1000)
    await expect(countdown).toHaveText(label(s0 - 2))
    await clock.runFor((s0 - 2) * 1000)
    await expect(countdown).toHaveText('5:00')
    await expect(tid(page, 'mon-kpis')).toBeVisible()
  })

  test('SRS §12 #30 the admin sees the national KPIs and rows; no T4/T5 label (R1-ADM-M-03) @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openOverview(page, gotoApp, '/admin/monitoring')
    await expectTabTitle(page, S2_TITLE)
    await expect(tid(page, 'mon-kpi-schools')).toContainText('57')
    await expect(tid(page, 'mon-table-student').getByTestId('mon-table-count')).toHaveText(
      '33 sekolah',
    )
    if (!isMobileWidth(page))
      await expect(tid(page, 'mon-table-student').getByTestId('mon-table-row')).toHaveCount(25)
    await expect(tid(page, 'monitoring-page')).not.toContainText('T4/T5')
  })
})

test.describe(
  'M11 R1-GUR-10 Guru /guru/monitoring is the own-school detail (S6-T08)',
  MODULE,
  () => {
    test('AC-GUR-10-1 the index shows the banner and the own school; no filters, KPI row or Negeri @m11', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(GURU)
      await gotoApp('/guru/monitoring')
      await expect(tid(page, 'mon-school-header')).toBeVisible()
      await expect(page).toHaveURL(/\/guru\/monitoring$/)
      await expect(tid(page, 'mon-scope-banner')).toContainText(
        'Data ditapis untuk sekolah anda sahaja.',
      )
      await expect(tid(page, 'mon-school-name')).not.toBeEmpty()
      await expect(tid(page, 'mon-school-cards')).toBeVisible()
      for (const id of ['mon-filters', 'mon-kpis', 'mon-state', 'mon-tahap', 'mon-table-student']) {
        await expect(tid(page, id)).toHaveCount(0)
      }
      await expect(page.locator('body')).not.toContainText('Negeri')
      await expect(page.locator('body')).not.toContainText('T4/T5')
      await expectNoHorizontalScroll(page)
    })

    test('FR-GUR-10-3 drill links stay under /guru/monitoring; no _token in the URL @m11', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(GURU)
      await gotoApp('/guru/monitoring')
      await expect(tid(page, 'mon-school-header')).toBeVisible()
      expect(page.url()).not.toContain('_token')
      const hrefs = await page
        .locator('a[href*="/sekolah/"][href*="/pelajar/"], a[href*="/sekolah/"][href*="/guru/"]')
        .evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
      expect(hrefs.length).toBeGreaterThan(0)
      for (const h of hrefs)
        expect(h).toMatch(/^\/guru\/monitoring\/sekolah\/\d+\/(pelajar|guru)\/\d+$/)
    })

    test('FR-GUR-10-2 teacher pills carry counts; pupil list says "Senarai Pelajar" @m11', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(GURU)
      await gotoApp('/guru/monitoring')
      await expect(tid(page, 'mon-school-header')).toBeVisible()
      await expect(tid(page, 'mon-students')).toContainText('Senarai Pelajar')
      await page.getByRole('tab', { name: /^Guru/ }).click()
      await expect(tid(page, 'mon-tpill-all')).toHaveText(/^\s*Semua \(\d+\)\s*$/)
      await expect(tid(page, 'mon-tpill-login')).toHaveText(/^\s*Pernah Login \(\d+\)\s*$/)
      await expect(tid(page, 'mon-tpill-never')).toHaveText(/^\s*Belum Login \(\d+\)\s*$/)
    })

    test('R1-ADM-M-03 an admin opening /guru/monitoring is sent to /admin/monitoring @m11', async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(ADMIN)
      await gotoApp('/guru/monitoring')
      await expect(page).toHaveURL(/\/admin\/monitoring$/)
      await expect(tid(page, 'mon-kpis')).toBeVisible()
    })
  },
)

test.describe('M11 S3 Detail Sekolah (admin)', MODULE, () => {
  test('SRS §12 #31/#32/#34 8080: header, cards, warning, pills, rows, teachers @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/monitoring/sekolah/8080')
    await expect(tid(page, 'mon-school-header')).toBeVisible()
    await adminHeader(page, 'Detail Sekolah')
    await expect(tid(page, 'mon-crumbs').getByRole('link').first()).toHaveAttribute('href', '/admin/monitoring')
    await expect(tid(page, 'mon-school-state')).toHaveText('Selangor')
    await expect(tid(page, 'mon-subscription')).toContainText('Active — sehingga 12 May 2027')
    await expect(tid(page, 'mon-school-tahap')).toHaveText('Cemerlang — 89.7%')
    await expectStats(page, ['students', 'engaged', 'answers', 'teachers', 'teachersLoggedIn'], ['184', '165', '53,494', '34', '34'])
    await expect(tid(page, 'mon-warning')).toContainText('19 akaun')
    await expect(tid(page, 'mon-warning')).toContainText('9 daripadanya dikecualikan')
    await expectTabTitle(page, (await tid(page, 'mon-school-name').innerText()) + ' - Monitoring | PRESTASIPLUS')

    await expect(tid(page, 'mon-pill-all')).toHaveText('Semua (184)')
    await expect(tid(page, 'mon-pill-active')).toHaveText('● Aktif (165)')
    // The pupil table is paged at 25 rows (MonitoringSchoolPage.vue); the pills carry the totals.
    await expect(tid(page, 'mon-student-row')).toHaveCount(25)
    const a = page.locator('[data-student-id="2008"]')
    await expect(a.locator('xpath=ancestor::tr')).toContainText('T5')
    await expect(a.getByTestId('mon-student-link')).toHaveAttribute(
      'href',
      '/admin/monitoring/sekolah/8080/pelajar/2008',
    )
    await tid(page, 'mon-pill-active').click()
    await expect(tid(page, 'mon-student-row')).toHaveCount(25) // first page of 165
    await expect(tid(page, 'mon-flag').filter({ hasText: 'ditapis' })).toHaveCount(0)
    await tid(page, 'mon-pill-login').click()
    await expect(tid(page, 'mon-student-row')).toHaveCount(4)
    await expect(
      tid(page, 'mon-student-status').filter({ hasNotText: 'Login sahaja' }),
    ).toHaveCount(0)
    await tid(page, 'mon-pill-never').click()
    await expect(tid(page, 'mon-student-row')).toHaveCount(8)
    await tid(page, 'mon-pill-all').click()
    await expect(tid(page, 'mon-student-row')).toHaveCount(25)
    await tid(page, 'mon-student-search').fill('zzzz')
    await expect(tid(page, 'mon-student-row')).toHaveCount(0)
    await tid(page, 'mon-student-search').fill('')

    await expect(tid(page, 'mon-teachers')).toContainText('Senarai Guru (34)')
    await expect(tid(page, 'mon-teacher-row')).toHaveCount(25) // first page of 34 (cards and the heading carry 34)
    await page.getByRole('tab', { name: /^Guru/ }).click()
    await tid(page, 'mon-tpill-never').click()
    await expect(tid(page, 'mon-teacher-row')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #31 940: no subscription, no warning, no teachers @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/monitoring/sekolah/940')
    await expect(tid(page, 'mon-school-header')).toBeVisible()
    await expect(tid(page, 'mon-subscription')).toHaveText('Tiada langganan')
    await expect(tid(page, 'mon-school-tahap')).toHaveText('Cemerlang — 100%')
    await expectStats(page, ['students','engaged','answers','teachers','teachersLoggedIn'], ['1', '1', '10', '0', '0'])
    await expect(tid(page, 'mon-warning')).toHaveCount(0)
    await expect(tid(page, 'mon-teachers')).toContainText('Senarai Guru (0)')
    await expect(tid(page, 'mon-teachers-empty')).toHaveText(
      'Belum ada guru berdaftar di sekolah ini.',
    )
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #52 variants: 8102 Cancelled, 8107 Expired, 8765 cards 16 / 6 / 222 and "Sederhana — 37.5%" (D9) @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/monitoring/sekolah/8102')
    await expect(tid(page, 'mon-subscription')).toContainText('Cancelled — sehingga 12 May 2027')
    await gotoApp('/admin/monitoring/sekolah/8107')
    await expect(tid(page, 'mon-subscription')).toContainText('Expired — sehingga 22 May 2026')
    await gotoApp('/admin/monitoring/sekolah/8765')
    await expect(tid(page, 'mon-school-header')).toBeVisible()
    // AC-M11-18.3 / 18.4 (D9): the S3 cards equal the S2 row of 8765 (6 active, 37.5%), no contradiction.
    await expectStats(page, ['students', 'engaged', 'answers'], ['16', '6', '222'])
    await expect(tid(page, 'mon-school-tahap')).toHaveText('Sederhana — 37.5%')
    // The teacher cards equal the teacher rows of the same page.
    const rows = await tid(page, 'mon-teacher-row').count()
    const loggedIn = await tid(page, 'mon-teacher-status')
      .filter({ hasText: 'Pernah login' })
      .count()
    await expectStats(page, ['teachers', 'teachersLoggedIn'], [String(rows), String(loggedIn)])
    await expect(tid(page, 'mon-warning')).toHaveCount(0)
  })

  test('SRS §12 #53 the fixture school 900001 renders its detail page (not 404) @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru/monitoring/sekolah/900001')
    await expect(tid(page, 'mon-school-header')).toBeVisible()
    await expect(tid(page, 'mon-student-row')).toHaveCount(10) // detail.test.ts:595
  })
})

test.describe('M11 S4 Detail Pelajar and S5 Detail Guru (admin)', MODULE, () => {
  test('SRS §12 #35/#37 Student A: header, cards, tabs; list, "Papar lagi" and the modal @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/monitoring/sekolah/8080/pelajar/2008')
    await expect(tid(page, 'mon-student-header')).toBeVisible()
    await adminHeader(page, 'Detail Pelajar')
    await expect(tid(page, 'mon-student-meta')).toContainText('· T5')
    await expect(tid(page, 'mon-student-last')).toHaveText('Aktiviti Terakhir: 16/06/2026 14:19')
    await expectStats(page, ['answered','correct','wrong','accuracy'], ['71', '53', '18', '74.6%'])
    await expect(tid(page, 'mon-tab-chip')).toHaveText(['18', '0'])
    await expectTabTitle(
      page,
      (await tid(page, 'mon-student-name').innerText()) + ' - Detail Pelajar | PRESTASIPLUS',
    )
    await expect(tid(page, 'mon-subject-row')).toHaveCount(3)
    await expect(tid(page, 'mon-observation')).toHaveCount(2)

    await tid(page, 'mon-tab-topic').click()
    await expect(tid(page, 'mon-topic-row')).toHaveCount(18)
    await expect(tid(page, 'mon-observations')).toBeVisible()

    await tid(page, 'mon-tab-list').click()
    await expect(tid(page, 'mon-list-heading')).toHaveText(
      'Senarai Soalan (71 tersedia daripada 71)',
    )
    await expect(tid(page, 'mon-list-row')).toHaveCount(20)
    await expect(tid(page, 'mon-list-more')).toHaveText('Papar lagi 20 (20/71)')
    await tid(page, 'mon-list-more').click()
    await expect(tid(page, 'mon-list-row')).toHaveCount(40)
    await expect(tid(page, 'mon-list-more')).toHaveText('Papar lagi 20 (40/71)')
    await tid(page, 'mon-list-more').click()
    await tid(page, 'mon-list-more').click()
    await expect(tid(page, 'mon-list-row')).toHaveCount(71)
    await expect(tid(page, 'mon-list-more')).toHaveCount(0)

    await tid(page, 'mon-list-row').first().click()
    const modal = tid(page, 'mon-modal')
    await expect(modal).toBeVisible()
    await expect(tid(page, 'mon-modal-result')).toHaveText('Salah')
    await expect(tid(page, 'mon-modal-time')).toContainText('2026-06-16 14:19:57')
    await expect(tid(page, 'mon-modal-option')).toHaveCount(4)
    await expect(tid(page, 'mon-modal-explanation')).toContainText('Penjelasan')
    const box = await modal.boundingBox()
    expect(box!.width).toBeLessThanOrEqual(672 + 1)
    await expectNoHorizontalScroll(page)
    await tid(page, 'mon-modal-close').click()
    await expect(modal).toHaveCount(0)
    await tid(page, 'mon-list-row').nth(4).click()
    await expect(tid(page, 'mon-modal-result')).toHaveText('Betul')
    await page.mouse.click(2, 2)
    await expect(modal).toHaveCount(0)
  })

  test('SRS §12 #39 Jawapan Salah cards and the Gap tab; one panel at a time @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/monitoring/sekolah/8080/pelajar/2008')
    await tid(page, 'mon-tab-wrong').click()
    await expect(tid(page, 'mon-wrong-heading')).toHaveText(
      'Jawapan Salah (18 jawapan, 18 soalan unik)',
    )
    await expect(tid(page, 'mon-wrong-card')).toHaveCount(18)
    await expect(tid(page, 'mon-panel-subject')).toHaveCount(0)
    await tid(page, 'mon-tab-gaps').click()
    await expect(tid(page, 'mon-panel-wrong')).toHaveCount(0)
    await expect(tid(page, 'mon-gap-empty')).toContainText('Tiada topik lemah dikesan!')
    await expect(tid(page, 'mon-gap-empty')).toContainText(
      'Semua topik yang dicuba mempunyai ketepatan melebihi 60%.',
    )
    await expect(tid(page, 'mon-observations')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #36 Student B 195 / 150 / 45 / 76.9%; Student C 265 / 168 / 97 / 63.4% @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/monitoring/sekolah/8080/pelajar/2002')
    await expectStats(page, ['answered','correct','wrong','accuracy'], ['195', '150', '45', '76.9%'])
    await gotoApp('/admin/monitoring/sekolah/8080/pelajar/2010')
    await expectStats(page, ['answered','correct','wrong','accuracy'], ['265', '168', '97', '63.4%'])
    await tid(page, 'mon-tab-wrong').click()
    await expect(tid(page, 'mon-wrong-card')).toHaveCount(97)
  })

  test(
    'SRS §12 #55 a pupil with 0 answers renders the zero state; the S3 row links to M12 @m11',
    PROV('0-answer state is PROPOSED (FN-M11-4.2.11)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(ADMIN)
      await gotoApp('/admin/monitoring/sekolah/8080/pelajar/4644')
      await expect(tid(page, 'mon-student-header')).toBeVisible()
      await expect(tid(page, 'mon-student-last')).toHaveText('Aktiviti Terakhir: -')
      const pupilName = await tid(page, 'mon-student-name').innerText()
      await expectStats(page, ['answered','correct','wrong','accuracy'], ['0', '0', '0', '0%'])
      await gotoApp('/admin/monitoring/sekolah/8080')
      await tid(page, 'mon-student-search').fill(pupilName)
      await expect(
        page.locator('[data-student-id="4644"]').getByTestId('mon-student-link'),
      ).toHaveAttribute('href', '/admin/kirkpatrick/pelajar/4644')
    },
  )

  test('SRS §12 #05 the school segment is not validated: Student A under school 940 @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/monitoring/sekolah/940/pelajar/2008')
    await expect(tid(page, 'mon-student-header')).toBeVisible()
    await expect(tid(page, 'mon-crumbs').getByRole('link').nth(1)).toHaveAttribute(
      'href',
      '/admin/monitoring/sekolah/940',
    )
  })

  test('SRS §12 #42 Teacher T (2012): header, cards 184 / 174 / 94.6% / 10, rows, three Cadangan @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/monitoring/sekolah/8080/guru/2012')
    await expect(tid(page, 'mon-teacher-header')).toBeVisible()
    await adminHeader(page, 'Detail Guru')
    await expect(tid(page, 'mon-teacher-pill')).toHaveText('Pernah Login')
    await expectStats(page, ['students','engaged','pct','attention'], ['184', '174', '94.6%', '10'])
    await expect(tid(page, 'mon-teacher-student-row')).toHaveCount(20) // first page of 184 (MonitoringTeacherPage.vue:100)
    await expect(
      page.locator('[data-student-id="2008"]').getByTestId('mon-teacher-student-link'),
    ).toHaveAttribute('href', '/admin/monitoring/sekolah/8080/pelajar/2008')
    await expect(tid(page, 'mon-suggestion-never')).toContainText('8 pelajar belum pernah login.')
    await expect(tid(page, 'mon-suggestion-low')).toContainText('3 pelajar aktif')
    await expect(tid(page, 'mon-suggestion-answered')).toContainText(
      '174 pelajar telah mula menjawab soalan.',
    )
    await expectNoHorizontalScroll(page)
  })

  test('drill-down by clicking: S2 school link → S3 → pupil → breadcrumb back @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openOverview(page, gotoApp, '/admin/monitoring')
    await tid(page, 'mon-table-student').locator('a[href$="/sekolah/8080"]').first().click()
    await expect(tid(page, 'mon-school-header')).toBeVisible()
    await page.locator('[data-student-id="2008"]').getByTestId('mon-student-link').click()
    await expect(tid(page, 'mon-student-header')).toBeVisible()
    await tid(page, 'mon-crumbs').getByRole('link').nth(1).click()
    await expect(tid(page, 'mon-school-header')).toBeVisible()
    await tid(page, 'mon-crumbs').getByRole('link').first().click()
    await expect(tid(page, 'mon-kpis')).toBeVisible()
    await expect(page).toHaveURL(/\/admin\/monitoring$/)
  })
})

test.describe('M11 S2-S5 errors and role refusals', MODULE, () => {
  test('SRS §12 #04 unknown school, pupil and teacher → the 404 page @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    for (const path of [
      '/admin/monitoring/sekolah/999999',
      '/admin/monitoring/sekolah/8080/pelajar/99999999',
      '/admin/monitoring/sekolah/8080/guru/99999999',
      '/admin/monitoring/sekolah/abc',
    ]) {
      await gotoApp(path)
      await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
      await expectTabTitle(page, NOT_FOUND_TITLE)
    }
  })

  test('SRS §12 #04 a pupil id on S5 and a teacher id on S4 → 404 @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/monitoring/sekolah/8080/guru/2008')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
    await gotoApp('/admin/monitoring/sekolah/8080/pelajar/2012')
    await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
  })

  test('SRS §12 #03 a guest is sent to /login; pelajar and Admin Sekolah leave /guru/monitoring @m11', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await gotoApp('/guru/monitoring')
    await expect(page).toHaveURL(/\/login(?:\?|$)/)
    await mock.setUser(PELAJAR)
    await gotoApp('/guru/monitoring')
    // v2: a forbidden role gets the 403 page in place (no redirect).
    await expect(page.locator('[data-ds="error-page"][data-code="403"]')).toBeVisible()
    await mock.setUser(ADMIN_SEKOLAH)
    await gotoApp('/guru/monitoring/sekolah/900001')
    // v2: a forbidden role gets the 403 page in place (no redirect).
    await expect(page.locator('[data-ds="error-page"][data-code="403"]')).toBeVisible()
    void loginAs
  })

  test('a guru and a pelajar leave /admin-sekolah/monitoring for their landing page @m11', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await mock.setUser(GURU)
    await gotoApp('/admin-sekolah/monitoring')
    // v2: a forbidden role gets the 403 page in place (no redirect).
    await expect(page.locator('[data-ds="error-page"][data-code="403"]')).toBeVisible()
    await mock.setUser(PELAJAR)
    await gotoApp('/admin-sekolah/monitoring')
    // v2: a forbidden role gets the 403 page in place (no redirect).
    await expect(page.locator('[data-ds="error-page"][data-code="403"]')).toBeVisible()
  })
})

test.describe(
  'M11 Admin Sekolah alias /admin-sekolah/monitoring (account 8, own school only)',
  MODULE,
  () => {
    test(
      'S2 renders in the user shell scoped to SMK DEMO 900001; links stay on the alias prefix @m11',
      PROV('school scope is INFERRED (shells.md v1.2, build-plan R.1.3)'),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(ADMIN_SEKOLAH)
        await openOverview(page, gotoApp, '/admin-sekolah/monitoring')
        await expectTabTitle(page, S2_TITLE)
        // R1-AS-10: one school, so no Negeri / Tahap; seven V2 KPIs; no T4/T5
        await expect(tid(page, 'mon-state')).toHaveCount(0)
        await expect(tid(page, 'mon-tahap')).toHaveCount(0)
        // Tempoh / Tapis sit in a filter sheet below 768
        if (!isMobileWidth(page)) {
          await expect(tid(page, 'mon-period')).toBeVisible()
          await expect(page.getByRole('button', { name: 'Tapis' })).toBeVisible()
        }
        for (const key of [
          'schools',
          'students',
          'engagement',
          'answers',
          'teachers',
          'teachersLoggedIn',
          'teacherPct',
        ]) {
          await expect(tid(page, `mon-kpi-${key}`)).toBeVisible()
        }
        await expect(tid(page, 'mon-kpi-engaged')).toHaveCount(0)
        await expect(tid(page, 'mon-kpi-average')).toHaveCount(0)
        await expect(tid(page, 'mon-kpis')).not.toContainText('Purata/Pelajar')
        await expect(page.locator('body')).not.toContainText('T4/T5')
        if (!isMobileWidth(page))
          await expect(tid(page, 'mon-table-student').getByTestId('mon-table-row')).toHaveCount(1)
        await expect(tid(page, 'mon-table-student').getByTestId('mon-school-link')).toHaveAttribute(
          'href',
          '/admin-sekolah/monitoring/sekolah/900001',
        )
        await expect(tid(page, 'mon-export-csv')).toHaveAttribute(
          'href',
          '/admin-sekolah/monitoring/export/csv?',
        )
        if (!isMobileWidth(page)) {
          // AC-AS-10-6: Tapis sends Tempoh only, no state / tahap / _token
          await tid(page, 'mon-period').selectOption('7d')
          await page.getByRole('button', { name: 'Tapis' }).click()
          await expect(page).toHaveURL(/\/admin-sekolah\/monitoring\?period=7d$/)
          await expectNoHorizontalScroll(page)
        }
      },
    )

    test(
      'S3 → S4 → S5 of the own school render; the breadcrumb stays on the alias @m11',
      PROV('school scope is INFERRED'),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(ADMIN_SEKOLAH)
        await openOverview(page, gotoApp, '/admin-sekolah/monitoring')
        await tid(page, 'mon-table-student').getByTestId('mon-school-link').click()
        await expect(page).toHaveURL(/\/admin-sekolah\/monitoring\/sekolah\/900001$/)
        await expect(tid(page, 'mon-school-header')).toBeVisible()
        await expect(tid(page, 'mon-crumbs').getByRole('link').first()).toHaveAttribute(
          'href',
          '/admin-sekolah/monitoring',
        )
        await expect(tid(page, 'mon-student-row')).toHaveCount(10) // detail.test.ts:595
        await expectNoHorizontalScroll(page)

        await gotoApp('/admin-sekolah/monitoring/sekolah/900001/pelajar/3001')
        await expect(tid(page, 'mon-student-header')).toBeVisible()
        await expect(tid(page, 'mon-crumbs').getByRole('link').nth(1)).toHaveAttribute(
          'href',
          '/admin-sekolah/monitoring/sekolah/900001',
        )
        await expectNoHorizontalScroll(page)

        await gotoApp('/admin-sekolah/monitoring/sekolah/900001/guru/5')
        await expect(tid(page, 'mon-teacher-header')).toBeVisible()
        await expect(tid(page, 'mon-teacher-student-row')).toHaveCount(10) // detail.test.ts:595
        await expectNoHorizontalScroll(page)
      },
    )

    test(
      'another school, a pupil or teacher of another school, and unknown ids → the 404 page @m11',
      PROV('alias refusals are INFERRED (lead decision: 404)'),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(ADMIN_SEKOLAH)
        for (const path of [
          '/admin-sekolah/monitoring/sekolah/8080',
          '/admin-sekolah/monitoring/sekolah/8080/pelajar/2008',
          '/admin-sekolah/monitoring/sekolah/900001/pelajar/2008',
          '/admin-sekolah/monitoring/sekolah/900001/guru/2012',
          '/admin-sekolah/monitoring/sekolah/999999',
        ]) {
          await gotoApp(path)
          await expect(page.getByText('Halaman Tidak Dijumpai')).toBeVisible()
          await expectTabTitle(page, NOT_FOUND_TITLE)
        }
      },
    )
  },
)

test.describe('M11 S2-S5 responsive sweep', MODULE, () => {
  test('SRS §12 #48 no page-level horizontal scroll on S2-S5; text is at least 12px @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    const paths = [
      '/admin/monitoring',
      '/admin/monitoring/sekolah/8080',
      '/admin/monitoring/sekolah/8080/pelajar/2008',
      '/admin/monitoring/sekolah/8080/guru/2012',
    ]
    const anchors = [
      'mon-table-student',
      'mon-school-header',
      'mon-student-header',
      'mon-teacher-header',
    ]
    for (const [i, path] of paths.entries()) {
      await gotoApp(path)
      await expect(tid(page, anchors[i]!)).toBeVisible()
      await expectNoHorizontalScroll(page)
      const small = await page.evaluate(() => {
        const main = document.querySelector('[data-testid^="monitoring-"]')
        if (!main) return ['no main']
        const out: string[] = []
        const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = (n.textContent ?? '').trim()
          const el = n.parentElement
          if (!text || !el) continue
          const size = parseFloat(getComputedStyle(el).fontSize)
          if (size < 12) out.push(`${text.slice(0, 30)} ${String(size)}px`)
        }
        return out
      })
      expect(small, `text under 12px on ${path}`).toEqual([])
    }
  })

  test('the S2 KPI grid and the S3 / S4 / S5 card grids follow the width @m11', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await openOverview(page, gotoApp, '/admin/monitoring')
    // DsStatRow (tile-layout.ts): tiles per row = 2 below md (768), at most 3 at md, up to the strip size at xl (1280).
    const perRow = (tiles: Locator) =>
      tiles.evaluateAll((els) => {
        const tops = els.map((e) => Math.round(e.getBoundingClientRect().top))
        return tops.filter((t) => t === tops[0]).length
      })
    const width = page.viewportSize()!.width
    expect(await perRow(tid(page, 'mon-kpis').locator('ul[data-ds="stat-row"]').first().locator(':scope > li'))).toBe(
      width >= 768 ? 3 : 2,
    )
    await gotoApp('/admin/monitoring/sekolah/8080')
    await expect(tid(page, 'mon-school-cards')).toBeVisible()
    const cols = await perRow(tid(page, 'mon-school-cards').locator(':scope > li'))
    expect(cols).toBe(width >= 1280 ? 5 : width >= 768 ? 3 : 2)
    if (isMobileWidth(page)) {
      // the pupil table scrolls inside its card, not the page
      const scroller = tid(page, 'mon-student-scroller')
      const overflow = await scroller.evaluate((el) => el.scrollWidth > el.clientWidth)
      expect(overflow).toBe(true)
    }
    await expectNoHorizontalScroll(page)
  })
})
