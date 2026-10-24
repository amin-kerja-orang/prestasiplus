/**
 * M06-T3 S5/S6 Tracking A + Q3, S8 Subjektif (SRS M06 v1.5 §12: E2E-M06-15 … 17, 21 … 24, 26, and the
 * S5/S6/S8 part of -04, -06, -39). S7 and S9 are the M05 structured routes; they are only linked and
 * redirected to here. Every test runs on the three viewport projects. Q3 was never opened live (L-5).
 */

import { expect, test } from './fixtures'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  isDesktopShell,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'
import {
  ADMIN,
  answerFrom,
  columnsOf,
  NOT_FOUND,
  PELAJAR,
  PELAJAR2,
  smallTexts,
  tid,
} from './support'

const GURU = 'guru@demo.test'

/** First data load of a freshly booted mock can take long on a busy machine. */
const SLOW = { timeout: 30_000 }

/** Texts of the chips of an open card. */
const chipsOf = (card: import('@playwright/test').Locator) =>
  card.locator('[data-testid=open-chips] > span')

test.describe('M06 S5 Tracking A hub', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M06-15 header, lanes, bahasa section and the open cards GEO, AKAUN, PSI', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/ramalan')
    await expect(tid(page, 'lanes')).toBeVisible(SLOW)
    await expectTabTitle(page, 'Tracking A SPM - PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Tracking A SPM')
    if (isDesktopShell(page)) {
      await expect(tid(page, 'shell-user-subtitle')).toHaveText('Selamat datang kembali')
    }
    await expect(tid(page, 'spm-back')).toHaveText('Kembali ke Mod SPM')
    await expect(tid(page, 'spm-back')).toHaveAttribute('href', '/spm')
    await expect(tid(page, 'spm-heading')).toHaveText('Tracking A SPM')
    await expect(tid(page, 'tracking-pill')).toHaveText('TRACKING A')
    await expect(tid(page, 'spm-sub')).toHaveText(
      'Soalan Tracking A SPM — bersedia untuk apa yang mungkin keluar!',
    )

    const objektif = tid(page, 'lane-objektif')
    await expect(objektif).toContainText('Subjek objektif penuh')
    await expect(objektif).toContainText(
      'Khusus untuk kertas objektif penuh yang boleh terus berjalan ikut set.',
    )
    await expect(objektif.getByTestId('lane-badge')).toHaveText('3 subjek')
    await expect(objektif.getByTestId('lane-sets')).toHaveText('18 set')
    await expect(objektif.getByTestId('lane-questions')).toHaveText('747 soalan')
    const bahasa = tid(page, 'lane-bahasa')
    await expect(bahasa).toContainText('BM dan BI format sebenar')
    await expect(bahasa).toContainText(
      'Laluan khas untuk kertas bahasa tanpa memaksa format menjadi 40 MCQ.',
    )
    await expect(bahasa.getByTestId('lane-badge')).toHaveText('2 subjek')
    await expect(bahasa.getByTestId('lane-sets')).toHaveText('1,332 set')
    await expect(bahasa.getByTestId('lane-paper')).toHaveText('Penjejakan berasaskan kertas')

    // Bahasa section.
    const section = tid(page, 'bahasa-section')
    await expect(section).toContainText('BM dan BI ikut format kertas sebenar')
    await expect(section).toContainText(
      'Subjek bahasa tidak dipaksa menjadi 40 MCQ. Ia dibuka melalui set berstruktur dan komponen sebenar peperiksaan.',
    )
    const bm = tid(page, 'bahasa-card-BM')
    await expect(bm).toContainText('Bahasa Melayu')
    await expect(bm).toContainText('Malay Language')
    await expect(bm.getByTestId('bahasa-sets')).toHaveText('559 set')
    await expect(bm).toContainText('Berstruktur / respons sebenar')
    await expect(bm.getByTestId('bahasa-cta')).toHaveText('Buka Tracking A Bahasa')
    await expect(bm).toHaveAttribute(
      'href',
      '/latihan-berstruktur?subject_id=1&scope=spm&track=bahasa',
    )
    await expect(tid(page, 'bahasa-card-BI').getByTestId('bahasa-sets')).toHaveText('773 set')
    await expect(tid(page, 'bahasa-card-BI')).toHaveAttribute(
      'href',
      '/latihan-berstruktur?subject_id=2&scope=spm&track=bahasa',
    )

    // Open cards.
    const cards = page.locator('[data-testid^=open-card-]')
    await expect(cards).toHaveCount(3)
    await expect(
      cards.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid'))),
    ).resolves.toEqual(['open-card-GEO', 'open-card-AKAUN', 'open-card-PSI'])
    const geo = tid(page, 'open-card-GEO')
    await expect(geo).toHaveAttribute('href', '/spm/ramalan/GEO')
    await expect(geo.getByTestId('open-name')).toHaveText('Geografi')
    await expect(geo.getByTestId('open-name-en')).toHaveText('Geography')
    await expect(chipsOf(geo)).toHaveText([
      '40 soalan kuiz siap guna',
      '1 bank besar',
      'Target SPM: 40',
      'Bank source: 67',
      '1 set',
    ])
    await expect(chipsOf(tid(page, 'open-card-AKAUN'))).toHaveText([
      '640 soalan kuiz siap guna',
      '16 set',
    ])
    await expect(chipsOf(tid(page, 'open-card-PSI'))).toHaveText([
      '40 soalan kuiz siap guna',
      '1 set bersih',
      'Target Latihan: 40',
      '1 set',
    ])
    for (const c of ['GEO', 'AKAUN', 'PSI']) {
      await expect(tid(page, `open-card-${c}`).getByTestId('open-footer')).toContainText(
        'Pilih Set',
      )
    }

    const width = viewportWidth(page)
    expect(await columnsOf(page, 'lanes')).toBe(width >= 768 ? 2 : 1)
    expect(await columnsOf(page, 'open-subjects')).toBe(width >= 1280 ? 3 : width >= 768 ? 2 : 1)
    await expectNoHorizontalScroll(page)
    expect(await smallTexts(page)).toEqual([])
  })

  test('E2E-M06-16 admin readiness card: texts, chips, 15 tiles in order, values, lock chips, note', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/spm/ramalan')
    await expect(tid(page, 'readiness')).toBeVisible(SLOW)
    const card = tid(page, 'readiness')
    await expect(card).toBeVisible()
    await expect(card).toContainText('Kesediaan Admin')
    await expect(card).toContainText('Status set Tracking A SPM semasa')
    await expect(card).toContainText(
      'Laporan ini membezakan set bersih, set bank besar dan set yang masih terkunci supaya bacaan kesediaan lebih jujur.',
    )
    await expect(card.locator('[data-testid=readiness-summary] > span')).toHaveText([
      'Set Bersih: 1 set',
      'Bank Besar: 1 set',
      'Locked: 58 set',
    ])
    const tiles = page.locator('[data-testid=readiness-tiles] > article')
    await expect(tiles).toHaveCount(15)
    await expect(
      tiles.evaluateAll((els) => els.map((e) => e.getAttribute('data-testid'))),
    ).resolves.toEqual(
      [
        'BM',
        'BI',
        'MATH',
        'SCI',
        'SEJ',
        'PI',
        'PM',
        'ADDMATH',
        'PHY',
        'CHEM',
        'BIO',
        'GEO',
        'BA',
        'EKON',
        'PSI',
      ].map((c) => `tile-${c}`),
    )

    const geo = tid(page, 'tile-GEO')
    await expect(geo.getByTestId('tile-name')).toHaveText('Geografi')
    await expect(geo.getByTestId('tile-target')).toHaveText('GEO · Target set: 40 soalan')
    await expect(geo.getByTestId('tile-badge')).toHaveText('0/10 set bersih')
    await expect(geo.getByTestId('tile-bersih')).toHaveText('0')
    await expect(geo.getByTestId('tile-bank')).toHaveText('1')
    await expect(geo.getByTestId('tile-locked')).toHaveText('9')
    await expect(geo.getByTestId('tile-readiness')).toHaveText('10%')
    await expect(geo.getByTestId('tile-bank-note')).toHaveText(
      'Set bank besar boleh dibuka, tetapi bank sumber melebihi target set. Rujuk halaman subjek untuk perbezaan set bersih berbanding bank besar.',
    )
    await expect(page.getByTestId('tile-bank-note')).toHaveCount(1)
    await expect(geo.getByTestId('tile-lock-chip')).toHaveText([
      '2026 Set 2 · 31/40',
      '2026 Set 3 · 34/40',
      '2026 Set 4 · 30/40',
      '2026 Set 5 · 30/40',
      '2026 Set 6 · 31/40',
      '2026 Set 7 · 30/40',
    ])

    const bi = tid(page, 'tile-BI')
    await expect(bi.getByTestId('tile-target')).toHaveText('BI · Target set: 36 soalan')
    await expect(bi.getByTestId('tile-badge')).toHaveText('0/0 set bersih')
    await expect(bi.getByTestId('tile-readiness')).toHaveText('0%')
    await expect(bi.getByTestId('tile-locks')).toHaveCount(0)

    const math = tid(page, 'tile-MATH')
    await expect(math.getByTestId('tile-locked')).toHaveText('11')
    await expect(math.getByTestId('tile-lock-chip')).toHaveText([
      '2026 Set 43 · 34/40',
      '2026 Set 44 · 31/40',
      '2026 Set 45 · 34/40',
      '2026 Set 46 · 32/40',
      '2026 Set 47 · 35/40',
      '2026 Set 48 · 30/40',
    ])
    const psi = tid(page, 'tile-PSI')
    await expect(psi.getByTestId('tile-badge')).toHaveText('1/6 set bersih')
    await expect(psi.getByTestId('tile-readiness')).toHaveText('17%')

    await expectNoHorizontalScroll(page)
    expect(await smallTexts(page)).toEqual([])
  })

  for (const who of [PELAJAR, GURU]) {
    test(`E2E-M06-16 the readiness card is absent for ${who}`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(who)
      await gotoApp('/spm/ramalan')
      await expect(tid(page, 'lanes')).toBeVisible(SLOW)
      await expect(tid(page, 'readiness')).toHaveCount(0)
      await expect(page.getByText('Kesediaan Admin')).toHaveCount(0)
    })
  }

  test('E2E-M06-17 /spm/ramalan/BM and /BI land on the S7 lists; S7 is the M05 structured list', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/ramalan/BM')
    await expect(page).toHaveURL(/\/latihan-berstruktur\?subject_id=1&scope=spm&track=bahasa$/)
    await expect(tid(page, 'shell-user-title')).toHaveText('Tracking A Bahasa')
    await gotoApp('/spm/ramalan/BI')
    await expect(page).toHaveURL(/\/latihan-berstruktur\?subject_id=2&scope=spm&track=bahasa$/)

    // From S5 the BM card opens S7, whose back link returns to S5.
    await gotoApp('/spm/ramalan')
    await tid(page, 'bahasa-card-BM').click()
    await expect(page).toHaveURL(/\/latihan-berstruktur\?subject_id=1&scope=spm&track=bahasa$/)
    await page.getByRole('link', { name: /Kembali ke Tracking A SPM/ }).click()
    await expect(page).toHaveURL(/\/spm\/ramalan$/)
  })

  test(
    'E2E-M06-17b a BM Q3 URL is refused, replaced with S6 and lands on the S7 list (no alert)',
    provisional('L-5: the live Tracking A set quiz was never opened'),
    async ({ page, loginAs, gotoApp }) => {
      const dialogs: string[] = []
      page.on('dialog', (d) => {
        dialogs.push(d.message())
        void d.dismiss()
      })
      await loginAs(PELAJAR)
      await gotoApp('/spm/ramalan/BM?year=2026&set=1')
      await expect(page).toHaveURL(/\/latihan-berstruktur\?subject_id=1&scope=spm&track=bahasa$/)
      expect(dialogs).toEqual([])
    },
  )

  test('S5 shows a skeleton while loading and an error box with "Cuba Semula"', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm')
    await mock.setLatency(800, '/api/spm/tracking-a')
    await page.getByTestId('spm-module-tracking-a').click()
    await expect(tid(page, 'spm-skeleton')).toBeVisible()
    await expect(tid(page, 'lanes')).toBeVisible()
    await mock.clearLatency('/api/spm/tracking-a')

    await tid(page, 'spm-back').click()
    await mock.failNext('/api/spm/tracking-a', 500)
    await page.getByTestId('spm-module-tracking-a').click()
    await expect(page.getByText('Maaf, berlaku ralat. Sila cuba semula.')).toBeVisible()
    await tid(page, 'spm-retry').click()
    await expect(tid(page, 'lanes')).toBeVisible()
  })
})

test.describe('M06 S6 Tracking A set list and Q3', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M06-21 GEO: header, chips, Set 1 link and texts, Sets 2-10 inert', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/ramalan/GEO')
    await expectTabTitle(page, 'Tracking A SPM — Geografi')
    await expect(tid(page, 'shell-user-title')).toHaveText('Tracking A SPM — Geografi')
    await expect(tid(page, 'shell-user-subtitle')).toHaveCount(0)
    await expect(tid(page, 'spm-back')).toHaveText('Kembali')
    await expect(tid(page, 'spm-back')).toHaveAttribute('href', '/spm/ramalan')
    await expect(tid(page, 'subject-title')).toHaveText('Geografi')
    await expect(tid(page, 'subject-sub')).toHaveText(
      /Tracking A SPM\s*· Target SPM set: 40 soalan/,
    )
    await expect(tid(page, 'sum-bersih')).toHaveText('0 set bersih')
    await expect(tid(page, 'sum-bank')).toHaveText('1 set bank besar')
    await expect(tid(page, 'sum-ready')).toHaveText('309 soalan kuiz siap guna')
    await expect(tid(page, 'sum-locked')).toHaveText('9 set belum cukup')
    await expect(tid(page, 'sum-target')).toHaveText('Target SPM: 40 / set')
    await expect(tid(page, 'year-heading')).toHaveText('Tracking A 2026')

    const cards = page.locator('[data-testid^=set-card-]')
    await expect(cards).toHaveCount(10)
    const one = tid(page, 'set-card-1')
    await expect(one).toHaveAttribute('href', '/spm/ramalan/GEO?year=2026&set=1')
    await expect(one.getByTestId('set-title')).toHaveText('Set 1')
    await expect(one.getByTestId('set-badge')).toHaveText('Bank Besar Sedia')
    await expect(one.getByTestId('set-ready')).toHaveText('40 soalan kuiz siap guna')
    await expect(one.getByTestId('set-format')).toHaveText('Format set: 40 / 40')
    await expect(one.getByTestId('set-bank')).toHaveText(
      'Bank source: 67. Sistem tetap ambil 40 soalan ikut prioriti semasa.',
    )
    await expect(one.getByTestId('set-dskp')).toHaveText('DSKP: 67/67 (100%)')
    await expectTouchTarget(one)

    for (let n = 2; n <= 10; n++) {
      const locked = tid(page, `set-card-${n}`)
      await expect(locked.getByTestId('set-badge')).toHaveText('Belum Cukup')
      await expect(locked.getByTestId('set-locked-note')).toHaveText(
        'Belum cukup soalan untuk format KPM.',
      )
      await expect(locked).not.toHaveAttribute('href', /.+/)
      await expect(locked).toHaveCSS('pointer-events', 'none')
    }
    await expect(tid(page, 'set-card-9').getByTestId('set-format')).toHaveText(
      'Format set: 20 / 40',
    )

    const width = viewportWidth(page)
    expect(await columnsOf(page, 'set-grid')).toBe(width >= 768 ? 2 : 1)
    await expectNoHorizontalScroll(page)
    expect(await smallTexts(page)).toEqual([])
  })

  test('E2E-M06-21 AKAUN, PSI, MATH, EKON, SCI and CHEM set lists', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)

    await gotoApp('/spm/ramalan/AKAUN')
    await expect(tid(page, 'subject-sub')).toHaveText('Tracking A SPM')
    await expect(page.locator('[data-testid^=set-card-]')).toHaveCount(16)
    await expect(tid(page, 'sum-target')).toHaveCount(0)
    await expect(tid(page, 'sum-locked')).toHaveCount(0)
    await expect(tid(page, 'sum-bersih')).toHaveText('16 set bersih')
    await expect(tid(page, 'sum-ready')).toHaveText('640 soalan kuiz siap guna')
    await expect(page.getByTestId('set-format')).toHaveCount(0)
    await expect(tid(page, 'set-card-1').getByTestId('set-badge')).toHaveText('Set Bersih')

    await gotoApp('/spm/ramalan/PSI')
    await expect(page.locator('[data-testid^=set-card-]').first()).toHaveAttribute(
      'data-testid',
      'set-card-4',
    )
    await expect(tid(page, 'sum-target')).toHaveText('Target Latihan: 40 / set')

    await gotoApp('/spm/ramalan/MATH')
    await expect(page.locator('[data-testid^=set-card-]')).toHaveCount(11)
    await expect(tid(page, 'sum-locked')).toHaveText('11 set belum cukup')
    await expect(page.locator('[data-status=belum_cukup]')).toHaveCount(11)

    await gotoApp('/spm/ramalan/EKON')
    await expect(tid(page, 'sum-ready')).toHaveText('145 soalan kuiz siap guna')
    await expect(tid(page, 'set-card-7').getByTestId('set-ready')).toHaveText(
      '19 soalan kuiz siap guna',
    )
    await expect(tid(page, 'set-card-8').getByTestId('set-ready')).toHaveText(
      '18 soalan kuiz siap guna',
    )

    await gotoApp('/spm/ramalan/SCI')
    await expect(tid(page, 'sum-ready')).toHaveText('35 soalan kuiz siap guna')
    await expect(page.locator('[data-testid^=set-card-]').getByTestId('set-ready')).toContainText([
      '22 soalan kuiz siap guna',
    ])
    for (const [n, c] of [
      [32, '2'],
      [33, '1'],
      [34, '1'],
    ] as const) {
      await expect(tid(page, `set-card-${String(n)}`).getByTestId('set-ready')).toHaveText(
        `${c} soalan kuiz siap guna`,
      )
    }

    await gotoApp('/spm/ramalan/CHEM')
    await expect(tid(page, 'sum-ready')).toHaveText('22 soalan kuiz siap guna')
    await expect(tid(page, 'set-card-9').getByTestId('set-ready')).toHaveText(
      '2 soalan kuiz siap guna',
    )
  })

  test('E2E-M06-22 BA: zero chips, target chip and the empty block', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/ramalan/BA')
    await expect(tid(page, 'sum-bersih')).toHaveText('0 set bersih')
    await expect(tid(page, 'sum-bank')).toHaveText('0 set bank besar')
    await expect(tid(page, 'sum-ready')).toHaveText('0 soalan kuiz siap guna')
    await expect(tid(page, 'sum-locked')).toHaveCount(0)
    await expect(tid(page, 'sum-target')).toHaveText('Target Latihan: 40 / set')
    await expect(tid(page, 'subject-empty')).toContainText('Belum Ada Set Tracking A')
    await expect(tid(page, 'subject-empty')).toContainText(
      'Set Tracking A untuk subjek ini akan ditambah tidak lama lagi.',
    )
    await expect(page.locator('[data-testid^=set-card-]')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-06 an unknown Tracking A code is the 404 page', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/ramalan/XYZ')
    await expectTabTitle(page, NOT_FOUND)
  })

  test('E2E-M06-06 a guest goes to /login from S5, S6 and S8', async ({ page, gotoApp }) => {
    for (const path of ['/spm/ramalan', '/spm/ramalan/GEO', '/spm/subjektif']) {
      await gotoApp(path)
      await expect(page).toHaveURL(/\/login/)
    }
  })

  test(
    'E2E-M06-23 AKAUN Set 3 starts a ramalan session of 40, finishing adds a Tracking A row to S10',
    provisional(
      'L-5: the live Tracking A set quiz was never opened; the quiz page is the M05 component',
    ),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs(PELAJAR)
      await gotoApp('/spm/ramalan/AKAUN')
      await tid(page, 'set-card-3').click()
      await expect(page).toHaveURL(/\/spm\/ramalan\/AKAUN\?year=2026&set=3$/)
      await expect(tid(page, 'quiz-title')).toHaveText('Prinsip Perakaunan')
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 40')

      const posts = (await mock.requests('/api/practice/sessions')).filter(
        (r) => r.method === 'POST',
      )
      expect(posts).toHaveLength(1)
      expect(posts[0]?.body).toMatchObject({
        mode: 'ramalan',
        subjectCode: 'AKAUN',
        year: 2026,
        setNo: 3,
      })
      await expectNoHorizontalScroll(page)

      await answerFrom(page, 1, 40)
      await expect(tid(page, 'quiz-results')).toBeVisible()

      await gotoApp('/spm/history?type=ramalan')
      const first = page.getByTestId('history-row').first()
      await expect(first.getByTestId('row-badge')).toHaveText('Tracking A')
      await expect(first.getByTestId('row-correct')).toHaveText(/^\d+\/40 betul\s*$/)
    },
  )

  test(
    'E2E-M06-23 GEO Set 1 takes 40 of its 67; a locked set URL goes back to S6 with no session',
    provisional('L-5: the live Tracking A set quiz was never opened'),
    async ({ page, loginAs, gotoApp, mock }) => {
      const dialogs: string[] = []
      page.on('dialog', (d) => {
        dialogs.push(d.message())
        void d.dismiss()
      })
      await loginAs(PELAJAR)
      await gotoApp('/spm/ramalan/GEO?year=2026&set=1')
      await expect(tid(page, 'quiz-progress-text')).toHaveText('Soalan 1 daripada 40')

      await gotoApp('/spm/ramalan/GEO?year=2026&set=2')
      await expect(page).toHaveURL(/\/spm\/ramalan\/GEO$/)
      await expect(tid(page, 'subject-title')).toHaveText('Geografi')
      // A refusal is quiet: the real QuizRunner raises no native alert (error flash) on the way to S6.
      expect(dialogs).toEqual([])
      const created = (await mock.requests('/api/practice/sessions')).filter(
        (r) => r.method === 'POST' && r.status === 201,
      )
      // Only the Set 1 session of the first visit exists (the page reload re-boots the mock).
      expect(created.length).toBeLessThanOrEqual(1)
      expect(created.some((r) => (r.body as { setNo?: number }).setNo === 2)).toBe(false)
    },
  )

  test('E2E-M06-04 S6 header for a second subject carries the subject name', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/ramalan/AKAUN')
    await expect(tid(page, 'shell-user-title')).toHaveText('Tracking A SPM — Prinsip Perakaunan')
  })
})

test.describe('M06 S8 Subjektif', { tag: [moduleTag(6)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M06-24 header, info box, empty stats, tabs and subject cards', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/spm/subjektif')
    await expectTabTitle(page, 'Latihan Subjektif SPM - PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Subjektif SPM')
    if (isDesktopShell(page)) {
      await expect(tid(page, 'shell-user-subtitle')).toHaveText('Selamat datang kembali')
    }
    await expect(tid(page, 'spm-back')).toHaveText('Kembali ke Mod SPM')
    await expect(tid(page, 'spm-back')).toHaveAttribute('href', '/spm')
    await expect(tid(page, 'spm-heading')).toHaveText('Latihan Subjektif SPM')
    await expect(tid(page, 'spm-sub')).toHaveText(
      'Pilih subjek untuk menjawab set struktur dan esei SPM berasaskan bank subjektif Tingkatan 4 dan 5.',
    )
    await expect(tid(page, 'subjektif-info')).toContainText('Bagaimana ia berfungsi?')
    await expect(tid(page, 'subjektif-info')).toContainText(
      'Pilih subjek → jawab set struktur/subjektif SPM → semak markah dan model jawapan. Bank ini ditarik daripada soalan berstruktur Tingkatan 4 dan 5 yang telah diterbitkan.',
    )

    const stats = page.locator('[data-testid^=subjektif-stat-]')
    await expect(stats.getByTestId('stat-label')).toHaveText([
      'Set Dijawab',
      'Subjek Dicuba',
      'Skor Terbaik',
      'Set Terbaik Disimpan',
    ])
    await expect(stats.getByTestId('stat-value')).toHaveText(['0', '0', 'Belum Ada', '0'])
    await expect(stats.getByTestId('stat-caption')).toHaveText([
      'Percubaan subjektif SPM yang telah dihantar',
      'Bilangan subjek subjektif SPM yang pernah dicuba',
      'Skor tertinggi merentas semua set subjektif SPM',
      'Bilangan set yang mempunyai percubaan terbaik tersimpan',
    ])
    const width = viewportWidth(page)
    expect(await columnsOf(page, 'subjektif-stats')).toBe(width >= 768 ? 4 : 2)

    // Tabs: "Semua" is active and readable (DV-M06-09).
    await expect(tid(page, 'tab-all')).toHaveAttribute('data-active', 'true')
    await expect(tid(page, 'tab-all')).toContainText('Semua')
    await expect(tid(page, 'tab-all').getByTestId('tab-count')).toHaveText('15')
    await expect(tid(page, 'tab-teras').getByTestId('tab-count')).toHaveText('5')
    await expect(tid(page, 'tab-elektif').getByTestId('tab-count')).toHaveText('10')
    const contrast = await tid(page, 'tab-all').evaluate((el) => {
      const parse = (c: string) => (c.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)
      const lum = ([r = 0, g = 0, b = 0]: number[]) => {
        const f = (v: number) => {
          const s = v / 255
          return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
        }
        return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
      }
      const st = getComputedStyle(el)
      const a = lum(parse(st.color))
      const b = lum(parse(st.backgroundColor))
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05)
    })
    expect(contrast).toBeGreaterThanOrEqual(4.5)
    await expectTouchTarget(tid(page, 'tab-teras'))

    const cards = page.locator('[data-testid^=subjektif-card-]')
    await expect(cards).toHaveCount(15)
    expect(await columnsOf(page, 'subjektif-grid')).toBe(width >= 1024 ? 3 : width >= 768 ? 2 : 1)

    await tid(page, 'tab-teras').click()
    await expect(cards).toHaveCount(5)
    await expect(cards.getByTestId('subjektif-name')).toHaveText([
      'Bahasa Inggeris',
      'Bahasa Melayu',
      'Matematik',
      'Sains',
      'Sejarah',
    ])
    await expect(cards.getByTestId('subjektif-badge')).toHaveText(Array(5).fill('Teras'))
    await tid(page, 'tab-elektif').click()
    await expect(cards).toHaveCount(10)
    await expect(cards.getByTestId('subjektif-badge')).toHaveText(Array(10).fill('Elektif'))
    await tid(page, 'tab-all').click()
    await expect(cards).toHaveCount(15)

    const bi = tid(page, 'subjektif-card-2')
    await expect(bi.getByTestId('subjektif-name')).toHaveText('Bahasa Inggeris')
    await expect(bi.getByTestId('subjektif-name-en')).toHaveText('English Language')
    await expect(bi.getByTestId('subjektif-sets')).toHaveText('773 set subjektif')
    await expect(bi).toHaveAttribute('href', '/latihan-berstruktur?subject_id=2&scope=spm')
    const sk = tid(page, 'subjektif-card-17')
    await expect(sk.getByTestId('subjektif-sets')).toHaveText('22 set subjektif')
    await expect(sk).toHaveAttribute('href', '/latihan-berstruktur?subject_id=17&scope=spm')

    await expectNoHorizontalScroll(page)
    expect(await smallTexts(page)).toEqual([])
  })

  test('E2E-M06-24 the student with two attempts sees 2 / 2 / 75% / 2', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/subjektif')
    await expect(
      page.locator('[data-testid^=subjektif-stat-]').getByTestId('stat-value'),
    ).toHaveText(['2', '2', '75%', '2'])
  })

  test('E2E-M06-24 a card opens the S9 list for its subject', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm/subjektif')
    await tid(page, 'subjektif-card-3').click()
    await expect(page).toHaveURL(/\/latihan-berstruktur\?subject_id=3&scope=spm$/)
    await expect(tid(page, 'shell-user-title')).toHaveText('Subjektif SPM')
  })

  test(
    'E2E-M06-26 submitting an SPM attempt on set 2510 updates the S8 stats',
    provisional('L-7: the live subjective answer page and stat change were never observed'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(PELAJAR2)
      await gotoApp('/latihan-berstruktur/2510/jawab?scope=spm')
      const answers = page.getByTestId('sub-answer')
      await expect(answers.first()).toBeVisible(SLOW)
      const n = await answers.count()
      expect(n).toBeGreaterThan(0)
      for (let i = 0; i < n; i++) await answers.nth(i).fill(`Jawapan ${String(i + 1)}`)
      await tid(page, 'answer-submit').click()
      await expect(tid(page, 'answer-total')).toBeVisible()

      // In-app navigation keeps the mock state (a reload would boot a fresh one).
      await tid(page, 'answer-back').click()
      await expect(page).toHaveURL(/\/latihan-berstruktur\?subject_id=\d+&scope=spm/)
      await page.getByRole('link', { name: /Kembali ke Subjektif SPM/ }).click()
      await expect(page).toHaveURL(/\/spm\/subjektif$/)
      const values = page.locator('[data-testid^=subjektif-stat-]').getByTestId('stat-value')
      await expect(values.nth(0)).toHaveText('1')
      await expect(values.nth(1)).toHaveText('1')
      await expect(values.nth(2)).toHaveText(/^\d+%$/)
      await expect(values.nth(3)).toHaveText('1')
    },
  )

  test('S8 shows a skeleton while loading and an error box with "Cuba Semula"', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/spm')
    await mock.setLatency(800, '/api/spm/subjektif')
    await page.getByTestId('spm-module-subjektif').click()
    await expect(tid(page, 'spm-skeleton')).toBeVisible()
    await expect(tid(page, 'subjektif-stats')).toBeVisible()
    await mock.clearLatency('/api/spm/subjektif')

    await tid(page, 'spm-back').click()
    await mock.failNext('/api/spm/subjektif', 500)
    await page.getByTestId('spm-module-subjektif').click()
    await expect(page.getByText('Maaf, berlaku ralat. Sila cuba semula.')).toBeVisible()
    await tid(page, 'spm-retry').click()
    await expect(tid(page, 'subjektif-stats')).toBeVisible()
  })
})
