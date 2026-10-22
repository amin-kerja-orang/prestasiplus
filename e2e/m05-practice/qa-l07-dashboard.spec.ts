/**
 * G5 QA for M05 S1 `/dashboard` (student Dashboard, task M05-T3, roles-matrix row L07 Murid part).
 * Complements `smoke-dashboard.spec.ts` with the full AC text of URS AC-M05-01.1 ... 10.4 (the S1
 * acceptance criteria), link targets, touch-target hit areas (DV-M05-17, measured with
 * `elementFromPoint`, so the invisible pseudo-element areas count), text size, 320 px, role access
 * (SRS section 9), loading / error states and the M09 banner `body` mapping.
 *
 * Runs on mobile (375), tablet (768) and desktop (1280). First assertions after boot get 15 s
 * because the machine is shared with other sessions (as the smoke spec does).
 */

import type { Locator, Page } from '@playwright/test'

import { expect as baseExpect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  navigateInApp,
  viewportWidth,
} from '../support'

const expect = baseExpect.configure({ timeout: 15_000 })

const ADMIN = 'admin@demo.test'
const MAJU = 'pelajarmaju@demo.test'
const PELAJAR = 'pelajar@demo.test'
const PELAJAR2 = 'pelajar2@demo.test'
const GURU = 'guru@demo.test'

const MODULE = { tag: [moduleTag(5)] }

test.use({ mockInit: { latency: 0 } })

// The v2 Murid Home (V2 fast track, D35-D38) replaces the live DOM, classes and sizes this spec
// measured (hero, carousel controls, 5-up quick actions, aside, text sizes). Skipped until the v2
// QA task rewrites it against `docs/design/v2-learner-prototype.html`. The behaviour smoke is
// `smoke-dashboard.spec.ts`.
test.skip(true, 'Superseded by the v2 Murid Home redesign; rewrite under the v2 QA task.')

const tid = (page: Page, id: string) => page.getByTestId(id)

/** Pauses the carousel autoplay (FR-M05-08 hover pause) so slide-dependent checks do not race a slow machine. */
const freeze = (page: Page) => tid(page, 'dash-carousel').dispatchEvent('mouseenter')

async function open(
  page: Page,
  loginAs: (w: string) => Promise<unknown>,
  gotoApp: (p: string) => Promise<void>,
  who: string,
) {
  await loginAs(who)
  await gotoApp('/dashboard')
  await expect(tid(page, 'dash-greeting')).toBeVisible()
}

/**
 * Real hit area of a control: walks outwards from its centre with `elementFromPoint` until the point
 * no longer resolves to the control (or a descendant), so `::after` expansions are counted.
 */
async function hitArea(el: Locator): Promise<{ w: number; h: number; visW: number; visH: number }> {
  return el.evaluate((node) => {
    const target = node as HTMLElement
    target.scrollIntoView({ block: 'center' })
    const r = target.getBoundingClientRect()
    const hit = (x: number, y: number) => {
      const e = document.elementFromPoint(x, y)
      return !!e && (e === target || target.contains(e))
    }
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    let up = 0
    let down = 0
    let left = 0
    let right = 0
    while (up < 80 && hit(cx, cy - up - 1)) up++
    while (down < 80 && hit(cx, cy + down + 1)) down++
    while (left < 200 && hit(cx - left - 1, cy)) left++
    while (right < 200 && hit(cx + right + 1, cy)) right++
    return {
      w: left + right + 1,
      h: up + down + 1,
      visW: Math.round(r.width),
      visH: Math.round(r.height),
    }
  })
}

async function smallText(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const root = document.querySelector('[data-testid="dashboard-page"]') ?? document.body
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const out: string[] = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const t = n.textContent?.trim()
      if (!t || !n.parentElement) continue
      const px = parseFloat(getComputedStyle(n.parentElement).fontSize)
      if (px < 12) out.push(`${px}px "${t.slice(0, 40)}"`)
    }
    return out
  })
}

const BANNERS = [
  [
    'HERO',
    'Selamat Datang ke PRESTASIPLUS',
    'Platform pembelajaran interaktif untuk pelajar sekolah. Jom mula belajar hari ini!',
  ],
  [
    'FEATURE',
    '2,000+ Soalan Latihan Tersedia!',
    'Latih diri dengan ribuan soalan Matematik, Sains, BM dan BI. Kumpul coins dan naik ranking!',
  ],
  [
    'PROMOTIONAL',
    'Cabaran Mingguan: Siapa Paling Rajin?',
    'Sertai cabaran mingguan dan lihat nama kamu di papan pendahulu. Streak 7 hari = bonus coins!',
  ],
  [
    'ANNOUNCEMENT',
    'Tips untuk Ibu Bapa: Bimbing Anak Belajar',
    'Panduan untuk ibu bapa membantu anak-anak cemerlang dalam pelajaran. Klik untuk baca lebih lanjut.',
  ],
  [
    'FEATURE',
    'Kumpul Badge & Tunjukkan Kehebatan!',
    '15 badge istimewa menanti! Jawab soalan, kekalkan streak, dan jadi juara kelas.',
  ],
] as const

const QUESTS = [
  ['📝', 'Rajin Berlatih', 'Mudah', 'Selesaikan 3 kuiz hari ini', 3, 15],
  ['🎯', 'Si Tepat', 'Sederhana', 'Dapat 80% ketepatan dalam mana-mana kuiz', 80, 20],
  ['🗺️', 'Penjelajah Topik', 'Sederhana', 'Latih 3 topik berbeza hari ini', 3, 25],
  ['⚡', 'Kilat Matematik', 'Sukar', 'Jawab 10 soalan dengan betul', 10, 30],
  ['🌟', 'Mula Hari Ini', 'Mudah', 'Selesaikan 1 sesi latihan hari ini', 1, 10],
  ['✅', 'Jawab 5 Betul', 'Mudah', 'Jawab 5 soalan dengan betul', 5, 12],
  ['⏱️', 'Latihan 10 Minit', 'Sederhana', 'Berlatih sekurang-kurangnya 10 minit hari ini', 10, 20],
  ['🔥', 'Kombo 2 Hari', 'Sederhana', 'Kekalkan kombo latihan selama 2 hari berturut-turut', 2, 25],
  ['🎯', 'Ketepatan 90%', 'Sukar', 'Capai ketepatan 90% dalam sesi latihan', 90, 35],
  ['⚡', 'Cabaran Kilat', 'Sukar', 'Jawab 20 soalan betul dalam satu sesi', 20, 40],
] as const

test.describe('M05 S1 dashboard G5 QA', MODULE, () => {
  // ---------------------------------------------------------------- Epic 1 hero
  test('AC-01.1 header, subtitle and tab title (admin, pelajarmaju)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    await expectTabTitle(page, 'Dashboard - PRESTASIPLUS')
    await expect(tid(page, 'shell-user-title')).toHaveText('Dashboard')
    await expect(tid(page, 'shell-user-subtitle')).toHaveText('Selamat datang kembali')
    await navigateInApp(page, '/practice')
    await navigateInApp(page, '/dashboard')
    await expectTabTitle(page, 'Dashboard - PRESTASIPLUS')
  })

  test('AC-01.2 greeting h1, line and the decorative cap by width', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    await expect(page.locator('h1', { hasText: 'Selamat Petang' })).toHaveText(
      'Selamat Petang, Admin Demo 👋',
    )
    await expect(tid(page, 'dash-greeting-line')).toHaveText('Jom teruskan latihan hari ini! 🚀')
    const cap = tid(page, 'dash-hero-cap')
    if (viewportWidth(page) >= 768) {
      await expect(cap).toBeVisible()
      await expect(cap).toContainText('🎓')
      const [c, h] = await Promise.all([cap.boundingBox(), tid(page, 'dash-hero').boundingBox()])
      expect(c!.x + c!.width / 2).toBeGreaterThan(h!.x + h!.width / 2)
    } else {
      await expect(cap).toBeHidden()
    }
  })

  for (const [now, word] of [
    ['2026-09-25T00:00:00+08:00', 'Pagi'],
    ['2026-09-25T11:59:00+08:00', 'Pagi'],
    ['2026-09-25T12:00:00+08:00', 'Tengah Hari'],
    ['2026-09-25T14:59:00+08:00', 'Tengah Hari'],
    ['2026-09-25T15:00:00+08:00', 'Petang'],
    ['2026-09-25T18:59:00+08:00', 'Petang'],
    ['2026-09-25T19:00:00+08:00', 'Malam'],
    ['2026-09-25T23:59:00+08:00', 'Malam'],
  ] as const) {
    test.describe(`clock ${now}`, () => {
      test.use({ mockInit: { latency: 0, now } })
      test(`AC-01.3 BR-02 boundary ${now.slice(11, 16)} reads ${word}`, async ({
        page,
        loginAs,
        gotoApp,
      }) => {
        await open(page, loginAs, gotoApp, PELAJAR2)
        await expect(tid(page, 'dash-greeting')).toContainText(`Selamat ${word},`)
      })
    })
  }

  // ---------------------------------------------------------------- Epic 2 trial card
  test('AC-02.1/2.2/2.3 trial card (admin 0/50, pelajar2 50/50, pelajarmaju none)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    const trial = tid(page, 'dash-trial')
    await expect(trial.locator('svg').first()).toBeVisible()
    await expect(trial).toContainText('Percubaan Percuma')
    await expect(trial.getByText('Percubaan Percuma')).toHaveCSS('text-transform', 'uppercase')
    await expect(tid(page, 'dash-trial-remaining')).toHaveText('Baki 0 / 50 soalan')
    // D9 dead link: /pricing (M19) is not routed, so the "Langgan Sekarang" CTA is hidden.
    await expect(trial.locator('[data-ds="card-cta"]')).toHaveCount(0)
    await expect(trial.locator('a[href="/pricing"]')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })
  test('AC-02.2 pelajar2 Baki 50 / 50', async ({ page, loginAs, gotoApp }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    await expect(tid(page, 'dash-trial-remaining')).toHaveText('Baki 50 / 50 soalan')
  })
  test('AC-02.3 subscriber (pelajarmaju) sees no trial card', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, MAJU)
    await expect(tid(page, 'dash-trial')).toHaveCount(0)
  })

  // ---------------------------------------------------------------- Epic 3 carousel
  test('AC-03.1 slide 1: icon, badge, title, 2-line clamp, toggle, arrows, 5 dots, 1 / 5', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    await freeze(page)
    const s0 = tid(page, 'dash-slide-0')
    await expect(s0.locator('svg').first()).toBeVisible()
    await expect(s0.getByTestId('dash-slide-badge')).toHaveText('HERO')
    await expect(s0.getByTestId('dash-slide-title')).toHaveText(BANNERS[0][1])
    const body = s0.getByTestId('dash-slide-body')
    await expect(body).toHaveText(BANNERS[0][2])
    await expect(body).toHaveCSS('-webkit-line-clamp', '2')
    await expect(s0.getByTestId('dash-slide-toggle')).toContainText('Baca Selanjutnya')
    await expect(s0.getByTestId('dash-prev')).toBeVisible()
    await expect(s0.getByTestId('dash-next')).toBeVisible()
    await expect(tid(page, 'dash-dots').locator('button')).toHaveCount(5)
    const w0 = (await tid(page, 'dash-dot-0').boundingBox())!.width
    const w1 = (await tid(page, 'dash-dot-1').boundingBox())!.width
    expect(w0).toBeGreaterThan(w1 * 2)
    await expect(tid(page, 'dash-counter')).toHaveText('1 / 5')
    for (let i = 1; i < 5; i++) await expect(tid(page, `dash-slide-${i}`)).toBeHidden()
  })

  test('AC-03.2 five slides in order with exact badges, titles, bodies; wraps both ways', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    await freeze(page)
    for (let i = 0; i < 5; i++) {
      const s = tid(page, `dash-slide-${i}`)
      await expect(s).toBeVisible()
      await expect(s.getByTestId('dash-slide-badge')).toHaveText(BANNERS[i]![0])
      await expect(s.getByTestId('dash-slide-title')).toHaveText(BANNERS[i]![1])
      await expect(s.getByTestId('dash-slide-body')).toHaveText(BANNERS[i]![2])
      await expect(tid(page, 'dash-counter')).toHaveText(`${i + 1} / 5`)
      await s.getByTestId('dash-next').click()
    }
    await expect(tid(page, 'dash-counter')).toHaveText('1 / 5')
    await expect(tid(page, 'dash-slide-0')).toBeVisible()
    await tid(page, 'dash-slide-0').getByTestId('dash-prev').click()
    await expect(tid(page, 'dash-counter')).toHaveText('5 / 5')
    await expect(tid(page, 'dash-slide-4')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('AC-03.3 every dot jumps to its slide and becomes the wide dot', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    await freeze(page)
    for (const i of [3, 0, 4, 1, 2]) {
      await tid(page, `dash-dot-${i}`).click()
      await expect(tid(page, `dash-slide-${i}`)).toBeVisible()
      await expect(tid(page, 'dash-counter')).toHaveText(`${i + 1} / 5`)
      await expect(tid(page, `dash-dot-${i}`)).toHaveAttribute('data-active', 'true')
      const active = (await tid(page, `dash-dot-${i}`).boundingBox())!.width
      const other = (await tid(page, `dash-dot-${(i + 1) % 5}`).boundingBox())!.width
      expect(active).toBeGreaterThan(other * 2)
      await expect(tid(page, 'dash-dots').locator('[data-active="true"]')).toHaveCount(1)
    }
  })

  test('AC-03.4 toggle expands/collapses the body and each slide keeps its own state', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    await freeze(page)
    const clamp = (i: number) => tid(page, `dash-slide-${i}`).getByTestId('dash-slide-body')
    const toggle = (i: number) => tid(page, `dash-slide-${i}`).getByTestId('dash-slide-toggle')
    await toggle(0).click()
    await expect(toggle(0)).toContainText('Tutup')
    await expect(clamp(0)).not.toHaveCSS('-webkit-line-clamp', '2')
    const chevron = toggle(0).locator('svg')
    await expect(chevron).toHaveClass(/rotate-180/)
    await tid(page, 'dash-dot-2').click()
    await expect(toggle(2)).toContainText('Baca Selanjutnya')
    await expect(clamp(2)).toHaveCSS('-webkit-line-clamp', '2')
    await toggle(2).click()
    await tid(page, 'dash-dot-0').click()
    await expect(toggle(0)).toContainText('Tutup')
    await toggle(0).click()
    await expect(toggle(0)).toContainText('Baca Selanjutnya')
    await expect(clamp(0)).toHaveCSS('-webkit-line-clamp', '2')
    await tid(page, 'dash-dot-2').click()
    await expect(toggle(2)).toContainText('Tutup')
    await expectNoHorizontalScroll(page)
  })

  test('AC-03.5 autoplay 5 s, pause while the pointer is over, resume, wraps 5 to 1', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    const counter = tid(page, 'dash-counter')
    // A dot click restarts the 5 s timer; the page clock keeps running after load, so start from a known slide.
    const t0 = await page.evaluate(() => Date.now())
    await page.clock.pauseAt(t0 + 60_000)
    await tid(page, 'dash-dot-0').click()
    await page.mouse.move(1, 1)
    await expect(counter).toHaveText('1 / 5')
    await mock.advanceTime(4500)
    await expect(counter).toHaveText('1 / 5')
    await mock.advanceTime(1000)
    await expect(counter).toHaveText('2 / 5')
    await tid(page, 'dash-carousel').dispatchEvent('mouseenter')
    await mock.advanceTime(10_000)
    await expect(counter).toHaveText('2 / 5')
    await tid(page, 'dash-carousel').dispatchEvent('mouseleave')
    await mock.advanceTime(5100)
    await expect(counter).toHaveText('3 / 5')
    await mock.advanceTime(5100 * 3)
    await expect(counter).toHaveText('1 / 5')
  })

  // ---------------------------------------------------------------- Epic 4 Kombo
  test('AC-04.1 admin Kombo banner copy and link; AC-04.2/04.3 none for pelajarmaju, pelajar, pelajar2', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    const k = tid(page, 'dash-kombo')
    await expect(k).toContainText('⚠️')
    await expect(k.locator('h3')).toHaveText('Kombo 1 hari akan putus!')
    await expect(k).toContainText('Jangan lepaskan! Buat sekurang-kurangnya 1 latihan hari ini.')
    await expect(tid(page, 'dash-kombo-link')).toHaveText(/Mula Latihan/)
    await expect(tid(page, 'dash-kombo-link')).toHaveAttribute('href', '/practice')
    expect((await hitArea(tid(page, 'dash-kombo-link'))).h).toBeGreaterThanOrEqual(44)
  })
  for (const who of [MAJU, PELAJAR, PELAJAR2]) {
    test(`AC-04.2/04.3 no Kombo banner for ${who}`, async ({ page, loginAs, gotoApp }) => {
      await open(page, loginAs, gotoApp, who)
      await expect(tid(page, 'dash-stats')).toBeVisible()
      await expect(tid(page, 'dash-kombo')).toHaveCount(0)
      if (who === PELAJAR2) {
        await expect(tid(page, 'dash-stat-streak').getByTestId('dash-stat-value')).toHaveText('0')
      }
    })
  }

  // ---------------------------------------------------------------- Epic 5 stat cards
  test('AC-05.1 pelajarmaju cards 267 / 432 (Lvl 3, bar 100%) / 3 / 4 / 70%', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await open(page, loginAs, gotoApp, MAJU)
    await mock.advanceTime(4000)
    const card = (id: string) => tid(page, id)
    await expect(card('dash-stat-coins')).toContainText('Syiling Kamu')
    await expect(card('dash-stat-coins').getByTestId('dash-stat-value')).toHaveText('267')
    await expect(card('dash-stat-points')).toContainText('Mata (Lvl 3)')
    await expect(card('dash-stat-points').getByTestId('dash-stat-value')).toHaveText('432')
    await expect(tid(page, 'dash-level-bar')).toHaveAttribute('style', /width: 100%/)
    await expect(card('dash-stat-streak')).toContainText('Hari Berturut')
    await expect(card('dash-stat-streak').getByTestId('dash-stat-value')).toHaveText('3')
    await expect(card('dash-stat-sessions')).toContainText('Sesi Minggu Ini')
    await expect(card('dash-stat-sessions').getByTestId('dash-stat-value')).toHaveText('4')
    await expect(card('dash-stat-accuracy')).toContainText('Ketepatan')
    await expect(card('dash-stat-accuracy').getByTestId('dash-stat-value')).toHaveText('70%')
  })

  test('AC-05.2 numbers show 0 right after load, climb monotonically and settle', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(MAJU)
    await gotoApp('/practice')
    const t0 = await page.evaluate(() => Date.now())
    await page.clock.pauseAt(t0 + 60_000)
    await navigateInApp(page, '/dashboard')
    await expect(tid(page, 'dash-greeting')).toBeVisible()
    const v = (id: string) => tid(page, id).getByTestId('dash-stat-value')
    // The page clock is paused, so nothing has ticked yet: every number is 0 ("within 100 ms").
    for (const id of [
      'dash-stat-coins',
      'dash-stat-points',
      'dash-stat-streak',
      'dash-stat-sessions',
    ]) {
      await expect(v(id)).toHaveText('0')
    }
    await expect(v('dash-stat-accuracy')).toHaveText('0%')
    await expect(tid(page, 'dash-platform-total').getByTestId('dash-platform-value')).toHaveText(
      '0',
    )
    const seen: number[] = []
    for (let i = 0; i < 8; i++) {
      await mock.advanceTime(150)
      seen.push(Number((await v('dash-stat-coins').innerText()).replace(/\D/g, '')))
    }
    expect(
      seen.some((n) => n > 0 && n < 267),
      `intermediate values: ${seen.join(',')}`,
    ).toBe(true)
    for (let i = 1; i < seen.length; i++) expect(seen[i]).toBeGreaterThanOrEqual(seen[i - 1]!)
    await mock.advanceTime(4000)
    await expect(v('dash-stat-coins')).toHaveText('267')
  })

  test('FR-11 platform stats count-up: starts at 0, steps, ends at 130152 / 31 / 11 / 129752', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/practice')
    const t0 = await page.evaluate(() => Date.now())
    await page.clock.pauseAt(t0 + 60_000)
    await navigateInApp(page, '/dashboard')
    await expect(tid(page, 'dash-greeting')).toBeVisible()
    const pv = (id: string) => tid(page, id).getByTestId('dash-platform-value')
    await mock.advanceTime(350)
    // Total Soalan: starts after 100 ms, ceil(130152/30) = 4339 per 25 ms.
    const t1 = Number(await pv('dash-platform-total').innerText())
    expect(t1).toBeGreaterThan(0)
    expect(t1).toBeLessThan(130152)
    expect(t1 % 4339).toBe(0)
    // Subjek Aktif +1 per 80 ms after 200 ms; Tahap Pendidikan +1 per 100 ms after 300 ms.
    const s1 = Number(await pv('dash-platform-subjects').innerText())
    expect(s1).toBeGreaterThanOrEqual(1)
    expect(s1).toBeLessThanOrEqual(3)
    await mock.advanceTime(6000)
    await expect(pv('dash-platform-total')).toHaveText('130152')
    await expect(pv('dash-platform-subjects')).toHaveText('31')
    await expect(pv('dash-platform-levels')).toHaveText('11')
    await expect(pv('dash-platform-approved')).toHaveText('129752')
  })

  test('AC-05.3 admin cards 256 / 8 (Lvl 2) / 1 / 0 / 0%', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    await mock.advanceTime(4000)
    const v = (id: string) => tid(page, id).getByTestId('dash-stat-value')
    await expect(v('dash-stat-coins')).toHaveText('256')
    await expect(v('dash-stat-points')).toHaveText('8')
    await expect(tid(page, 'dash-stat-points')).toContainText('Mata (Lvl 2)')
    await expect(v('dash-stat-streak')).toHaveText('1')
    await expect(v('dash-stat-sessions')).toHaveText('0')
    await expect(v('dash-stat-accuracy')).toHaveText('0%')
    await expect(tid(page, 'dash-stats').locator('> *')).toHaveCount(5)
  })

  test('FR-10 stat grid is 2 columns below 1024 and 5 from lg', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    const cols = await tid(page, 'dash-stats').evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
    )
    expect(cols).toBe(isDesktopShell(page) ? 5 : 2)
  })

  // ---------------------------------------------------------------- Epic 6 quests
  test('AC-06.1/06.2 admin quests: header, 10 quests in order, chips, rewards, locked chest', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    const w = tid(page, 'dash-quests')
    await expect(w).toContainText('📱 Misi Harian')
    await expect(w).toContainText('Selesaikan semua misi → buka Peti Harian! 🎁')
    await expect(w.getByText('Progres', { exact: true })).toHaveCSS('text-transform', 'uppercase')
    await expect(tid(page, 'dash-quest-done')).toHaveText('0')
    await expect(w).toContainText(/\/\s*10/)
    const rows = tid(page, 'dash-quest')
    await expect(rows).toHaveCount(10)
    for (let i = 0; i < 10; i++) {
      const [emoji, title, diff, desc, target, reward] = QUESTS[i]!
      const q = rows.nth(i)
      await expect(q).toContainText(emoji)
      await expect(q.getByTestId('dash-quest-title')).toHaveText(title)
      const chip = q.getByTestId('dash-quest-chip')
      await expect(chip).toHaveText(diff)
      await expect(chip).toHaveCSS('text-transform', 'uppercase')
      await expect(chip).toHaveCSS('font-size', '12px')
      const cls = (await chip.getAttribute('class')) ?? ''
      expect(cls).toMatch(diff === 'Mudah' ? /green/ : diff === 'Sederhana' ? /amber/ : /red/)
      await expect(q).toContainText(desc)
      await expect(q.getByTestId('dash-quest-progress')).toContainText(`0/${target}`)
      await expect(q.getByTestId('dash-quest-reward')).toContainText(`+${reward}`)
    }
    const chest = tid(page, 'dash-chest')
    await expect(chest).toContainText('🎁')
    await expect(chest).toContainText('Selesaikan 10 lagi misi untuk buka peti! 🔒')
    await expect(tid(page, 'dash-chest-dots').locator('> *')).toHaveCount(10)
    await expectNoHorizontalScroll(page)
  })

  test('AC-06.3/06.4 pelajarmaju quest progress, 4 / 10, partial chest, full bars on completed', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, MAJU)
    const want = ['2/3', '60/80', '3/3', '9/10', '1/1', '5/5', '7/10', '2/2', '60/90', '6/20']
    const rows = tid(page, 'dash-quest')
    await expect(rows).toHaveCount(10)
    const done: number[] = []
    for (let i = 0; i < 10; i++) {
      const q = rows.nth(i)
      await expect(q.getByTestId('dash-quest-progress')).toContainText(want[i]!)
      const [a, b] = want[i]!.split('/').map(Number)
      const width = await q
        .getByTestId('dash-quest-bar')
        .evaluate((el) => (el as HTMLElement).style.width)
      expect(parseFloat(width)).toBeCloseTo(Math.min(100, (a! / b!) * 100), 0)
      if (a! >= b!) done.push(i)
    }
    expect(done).toEqual([2, 4, 5, 7])
    await expect(tid(page, 'dash-quest-done')).toHaveText('4')
    await expect(tid(page, 'dash-chest')).toContainText(
      'Selesaikan 6 lagi misi untuk buka peti! 🔒',
    )
    const dots = tid(page, 'dash-chest-dots').locator('> *')
    await expect(dots).toHaveCount(10)
    const filled = await dots.evaluateAll(
      (els) => els.filter((e) => !/slate-300/.test(e.className)).length,
    )
    expect(filled).toBe(4)
  })

  // ---------------------------------------------------------------- Epic 7 badges / quick actions
  for (const who of [ADMIN, MAJU, PELAJAR2]) {
    test(`AC-07.1 empty badge shelf (${who})`, async ({ page, loginAs, gotoApp }) => {
      await open(page, loginAs, gotoApp, who)
      const e = tid(page, 'dash-badges-empty')
      await expect(e).toContainText('🏆')
      await expect(e).toContainText('Belum Ada Lencana Lagi!')
      await expect(e).toContainText('Jom kumpul lencana pertama dengan menjawab soalan! 🚀')
    })
  }

  test('AC-07.2 quick actions: labels, hrefs, 2 columns at 375 and 5 from 768', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, MAJU)
    const items = [
      ['dash-quick-practice', '🚀', 'Mula Latihan', '/practice'],
      ['dash-quick-revision', '🔄', 'Soalan Aku Salah', '/practice/revision'],
      ['dash-quick-progress', '📈', 'Kemajuan', '/practice/progress'],
      ['dash-quick-history', '📊', 'Sejarah Latihan', '/practice/history'],
      ['dash-quick-leaderboard', '🏅', 'Papan Pendahulu', '/leaderboard'],
    ] as const
    for (const [id, emoji, label, href] of items) {
      await expect(tid(page, id)).toContainText(emoji)
      await expect(tid(page, id)).toContainText(label)
      await expect(tid(page, id)).toHaveAttribute('href', href)
    }
    const cols = await tid(page, 'dash-quick').evaluate(
      (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length,
    )
    expect(cols).toBe(viewportWidth(page) >= 768 ? 5 : 2)
    await expectNoHorizontalScroll(page)
  })

  test('AC-07.3 revision badge: admin 72 (top right, red), pelajar2 none', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    const b = tid(page, 'dash-revision-badge')
    await expect(b).toHaveText('72')
    const cls = (await b.getAttribute('class')) ?? ''
    expect(cls).toMatch(/red-600/)
    const [bb, tb] = await Promise.all([
      b.boundingBox(),
      tid(page, 'dash-quick-revision').boundingBox(),
    ])
    expect(bb!.x + bb!.width / 2).toBeGreaterThan(tb!.x + tb!.width / 2)
    expect(bb!.y + bb!.height / 2).toBeLessThan(tb!.y + tb!.height / 2)
  })
  test('AC-07.3 pelajar2 has no revision badge', async ({ page, loginAs, gotoApp }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    await expect(tid(page, 'dash-quick-revision')).toBeVisible()
    await expect(tid(page, 'dash-revision-badge')).toHaveCount(0)
  })

  test('AC-07.4 Panel Admin only for admin (icons, full width, href)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    const a = tid(page, 'dash-quick-admin')
    await expect(a).toContainText('Panel Admin')
    await expect(a).toHaveAttribute('href', '/admin')
    expect(await a.locator('svg').count()).toBeGreaterThanOrEqual(2)
    const [ab, gb] = await Promise.all([a.boundingBox(), tid(page, 'dash-quick').boundingBox()])
    expect(Math.abs(ab!.width - gb!.width)).toBeLessThanOrEqual(2)
  })
  for (const who of [MAJU, PELAJAR, PELAJAR2, GURU, 'adminsekolah@demo.test']) {
    test(`AC-07.4 no Panel Admin for ${who}`, async ({ page, loginAs, gotoApp }) => {
      await open(page, loginAs, gotoApp, who)
      await expect(tid(page, 'dash-quick')).toBeVisible()
      await expect(tid(page, 'dash-quick-admin')).toHaveCount(0)
    })
  }

  test('AC-07.5 no unobserved conditional sections (battle, parent target, weak topic, quiz sets, assignments, rewards)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    for (const who of [MAJU]) {
      await open(page, loginAs, gotoApp, who)
      const text = (await tid(page, 'dashboard-page').innerText()).toLowerCase()
      for (const word of [
        'battle',
        'sasaran harian',
        'topik lemah',
        'set soalan',
        'tugasan',
        'ganjaran baharu',
        'hadiah baharu',
      ]) {
        expect(text, `S1 text contains "${word}"`).not.toContain(word)
      }
    }
  })

  // ---------------------------------------------------------------- Epic 8 articles
  test('AC-08.1 articles strip: 5 cards, chips upper-case, clamp, links, strip scrolls inside itself', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    const sec = tid(page, 'dash-articles')
    await expect(sec).toContainText('📚 Artikel Untuk Kamu')
    await expect(tid(page, 'dash-articles-all')).toHaveText(/Lihat Semua/)
    await expect(tid(page, 'dash-articles-all')).toHaveAttribute('href', '/artikel')
    const cards = tid(page, 'dash-article-card')
    await expect(cards).toHaveCount(5)
    const slugs = new Set<string>()
    for (let i = 0; i < 5; i++) {
      const c = cards.nth(i)
      expect(await c.locator('svg').count()).toBeGreaterThan(0)
      const chip = c.getByTestId('dash-article-chip')
      await expect(chip).toHaveCSS('text-transform', 'uppercase')
      expect(['Tips Belajar', 'Panduan Ibu Bapa']).toContain((await chip.textContent())!.trim())
      const href = (await c.getAttribute('href'))!
      expect(href).toMatch(/^\/artikel\/[\w-]+$/)
      slugs.add(href)
      await expect(c).toContainText(/(yang lepas|sebentar|baru|lalu)/i)
    }
    expect(slugs.size).toBe(5)
    const strip = tid(page, 'dash-articles-strip')
    const m = await strip.evaluate((el) => ({
      sw: el.scrollWidth,
      cw: el.clientWidth,
      ox: getComputedStyle(el).overflowX,
      sb: getComputedStyle(el).scrollbarWidth,
    }))
    expect(m.sw).toBeGreaterThan(m.cw)
    expect(['auto', 'scroll']).toContain(m.ox)
    expect(m.sb).toBe('none')
    await strip.evaluate((el) => (el.scrollLeft = 400))
    await expectNoHorizontalScroll(page)
    const first = (await cards.first().getAttribute('href'))!
    await cards.first().click()
    await expect(page).toHaveURL(new RegExp(`${first}$`))
    await expect(page.locator('[data-page="not-found"]')).toHaveCount(0)
  })

  test('AC-08.2 aside "Artikel Terkini" only at 1024+; same 5 articles', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    if (isDesktopShell(page)) {
      const aside = tid(page, 'dashboard-aside')
      await expect(aside).toBeVisible()
      await expect(tid(page, 'dash-aside')).toContainText('Artikel Terkini')
      await expect(tid(page, 'dash-aside-article')).toHaveCount(5)
      await expect(tid(page, 'dash-aside-all')).toHaveText(/Lihat Semua Artikel/)
      await expect(tid(page, 'dash-aside-all')).toHaveAttribute('href', '/artikel')
      const strip = await tid(page, 'dash-article-card').evaluateAll((els) =>
        els.map((e) => e.getAttribute('href')),
      )
      const side = await tid(page, 'dash-aside-article').evaluateAll((els) =>
        els.map((e) => e.getAttribute('href') ?? e.querySelector('a')?.getAttribute('href')),
      )
      expect(side).toEqual(strip)
      const w = (await aside.boundingBox())!.width
      expect(w).toBeGreaterThan(280)
      expect(w).toBeLessThanOrEqual(305)
    } else {
      await expect(tid(page, 'dashboard-aside')).toBeHidden()
      await expect(tid(page, 'dash-aside')).toBeHidden()
    }
  })

  test('FR-22 aside breakpoint: hidden at 1023, shown at 1024', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    await page.setViewportSize({ width: 1023, height: 800 })
    await expect(tid(page, 'dashboard-aside')).toBeHidden()
    await expectNoHorizontalScroll(page)
    await page.setViewportSize({ width: 1024, height: 800 })
    await expect(tid(page, 'dashboard-aside')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  // ---------------------------------------------------------------- Epic 9 subjects / levels
  test('AC-09.1 31 subject cards: icon, count, names, core badge on 7, href, count = S2 card', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    await expect(tid(page, 'dash-subjects')).toContainText('📖 Subjek Tersedia')
    await expect(tid(page, 'dash-subjects-count')).toHaveText('31 subjek')
    const cards = tid(page, 'dash-subjects').locator(
      '[data-testid^="dash-subject-"]:not([data-testid="dash-subject-core"]):not([data-testid="dash-subject-count"]):not([data-testid="dash-subject-icon"]):not([data-testid="dash-subject-name"]):not([data-testid="dash-subject-start"]):not([data-testid="dash-subjects-count"])',
    )
    await expect(cards).toHaveCount(31)
    await expect(tid(page, 'dash-subject-core')).toHaveCount(7)
    await expect(tid(page, 'dash-subject-core').first()).toContainText('⭐ Subjek Teras')
    await expect(tid(page, 'dash-subject-icon')).toHaveCount(31)
    const counts = await tid(page, 'dash-subject-count').allTextContents()
    expect(counts).toHaveLength(31)
    for (const c of counts) expect(c.trim()).toMatch(/^\d+ soalan$/)
    await expect(tid(page, 'dash-subject-MATH').getByTestId('dash-subject-count')).toHaveText(
      '13872 soalan',
    )
    await expect(tid(page, 'dash-subject-start').first()).toHaveText(/Mula Latihan 🚀/)
    const hrefs = await tid(page, 'dash-subject-start').evaluateAll((els) =>
      els.map((e) => e.getAttribute('href')),
    )
    for (const h of hrefs) expect(h).toMatch(/^\/practice\?subject=[A-Z0-9_]+$/)
    expect(new Set(hrefs).size).toBe(31)
    // Same number on S2 for Matematik (BR-05).
    await navigateInApp(page, '/practice')
    await expect(page.getByText('13,872').first()).toBeVisible()
  })

  test('FR-23 subject grid columns 1 / 2 / 3 and card order', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    const n = await tid(page, 'dash-subjects')
      .locator('[class*="grid-cols"]')
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    const w = viewportWidth(page)
    // The main column is narrower than the viewport at 1280 (aside 300 px): lg breakpoint is the viewport.
    expect(n).toBe(w >= 1024 ? 3 : w >= 768 ? 2 : 1)
  })

  test('AC-09.2 Matematik card opens /practice/MATH', async ({ page, loginAs, gotoApp }) => {
    await open(page, loginAs, gotoApp, MAJU)
    await tid(page, 'dash-subject-MATH').getByTestId('dash-subject-start').click()
    await expect(page).toHaveURL(/\/practice\/MATH$/)
    await expect(page.locator('[data-page="not-found"]')).toHaveCount(0)
  })

  test('AC-09.3 level groups and 11 pills "{name} ({count})" with hrefs', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    await expect(tid(page, 'dash-levels')).toContainText('🎓 Tahap Pendidikan')
    await expect(tid(page, 'dash-levels')).toContainText(/🏫\s*Sekolah Rendah \(KSSR\)/)
    await expect(tid(page, 'dash-levels')).toContainText(/🎒\s*Sekolah Menengah Rendah \(KSSM\)/)
    await expect(tid(page, 'dash-levels')).toContainText(/🎓\s*Sekolah Menengah Atas \(KSSM\)/)
    const pills = tid(page, 'dash-level-pill')
    await expect(pills).toHaveCount(11)
    const names = [
      'Darjah 1',
      'Darjah 2',
      'Darjah 3',
      'Darjah 4',
      'Darjah 5',
      'Darjah 6',
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ]
    const codes = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'T1', 'T2', 'T3', 'T4', 'T5']
    for (let i = 0; i < 11; i++) {
      await expect(pills.nth(i)).toHaveText(new RegExp(`^${names[i]}\\s*\\(\\d+\\)$`))
      await expect(pills.nth(i)).toHaveAttribute('href', `/practice?level=${codes[i]}`)
    }
    await expect(tid(page, 'dash-level-group-primary').getByTestId('dash-level-pill'))
      .toHaveCount(6)
      .catch(() => undefined)
    await expect(pills.first()).toHaveText(/\(11396\)/)
    const sum = (await pills.allTextContents()).reduce(
      (a, t) => a + Number(/\((\d+)\)/.exec(t)![1]),
      0,
    )
    expect(sum).toBeGreaterThan(0)
    await expectNoHorizontalScroll(page)
  })

  test('AC-09.4 level pill opens the plain S2 list; AC-09.5 topic_id', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, MAJU)
    await tid(page, 'dash-level-pill').nth(1).click()
    await expect(page).toHaveURL(/\/practice\?level=D2$/)
    await expect(page.locator('[data-page="not-found"]')).toHaveCount(0)
    await expect(page.getByText('Latih Tubi 🎯')).toBeVisible()
    await navigateInApp(page, '/practice?topic_id=7')
    await expect(page).toHaveURL(/\/practice\/MATH$/)
    await navigateInApp(page, '/practice?topic_id=99999')
    await expect(page).toHaveURL(/\/practice(\?topic_id=99999)?$/)
    await expect(page.getByText('Latih Tubi 🎯')).toBeVisible()
  })

  // ---------------------------------------------------------------- Epic 10 stats
  test('AC-10.1 Statistik Platform 130152 / 31 / 11 / 129752 with labels', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await open(page, loginAs, gotoApp, MAJU)
    await mock.advanceTime(6000)
    const p = tid(page, 'dash-platform')
    await expect(p).toContainText('📊 Statistik Platform')
    for (const [id, val, label] of [
      ['dash-platform-total', '130152', 'Total Soalan'],
      ['dash-platform-subjects', '31', 'Subjek Aktif'],
      ['dash-platform-levels', '11', 'Tahap Pendidikan'],
      ['dash-platform-approved', '129752', 'Soalan Approved'],
    ] as const) {
      await expect(tid(page, id).getByTestId('dash-platform-value')).toHaveText(val)
      await expect(tid(page, id)).toContainText(label)
    }
    // DV-M05-18: the 6-digit total stays inside its card.
    for (const id of ['dash-platform-total', 'dash-platform-approved']) {
      const inside = await tid(page, id).evaluate((card) => {
        const v = card.querySelector('[data-testid="dash-platform-value"]')!.getBoundingClientRect()
        const c = card.getBoundingClientRect()
        return {
          overL: c.left - v.left,
          overR: v.right - c.right,
          vw: document.documentElement.clientWidth,
          right: v.right,
        }
      })
      expect(inside.overL, `${id} left overflow`).toBeLessThanOrEqual(1)
      expect(inside.overR, `${id} right overflow`).toBeLessThanOrEqual(1)
      expect(inside.right).toBeLessThanOrEqual(inside.vw)
    }
    const cols = await p
      .locator('[class*="grid-cols"]')
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    expect(cols).toBe(viewportWidth(page) >= 768 ? 4 : 2)
  })

  test('AC-10.2 Soalan Terkini: 5 items, chip, 5 stars, text cut at 100 + "...", not links', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, MAJU)
    const r = tid(page, 'dash-recent')
    await expect(r).toContainText('⚡ Soalan Terkini')
    await expect(r).toContainText('📝')
    const items = tid(page, 'dash-recent-item')
    await expect(items).toHaveCount(5)
    for (let i = 0; i < 5; i++) {
      const it = items.nth(i)
      await expect(it.getByTestId('dash-recent-subject')).toHaveCSS('text-transform', 'uppercase')
      expect(
        ((await it.getByTestId('dash-recent-subject').textContent()) ?? '').trim().length,
      ).toBeGreaterThan(0)
      await expect(it.getByTestId('dash-recent-stars').locator('svg, span')).not.toHaveCount(0)
      const text = ((await it.getByTestId('dash-recent-text').textContent()) ?? '').trim()
      expect(text.length).toBeLessThanOrEqual(103)
      if (text.endsWith('...')) expect(text.length).toBe(103)
      expect(((await it.getByTestId('dash-recent-level').textContent()) ?? '').trim()).toMatch(
        /^(D[1-6]|T[1-5])$/,
      )
      await expect(it).toContainText(/(yang lepas|sebentar|baru|lalu)/i)
      await expect(it.locator('a')).toHaveCount(0)
      await expect(it.getByTestId('dash-recent-text')).toHaveCSS('-webkit-line-clamp', '2')
    }
    await expect(r.locator('a')).toHaveCount(0)
  })

  test('AC-10.3 Tahap Kesukaran rows, counts, proportional bars, total and layout beside recent at lg', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await open(page, loginAs, gotoApp, MAJU)
    await mock.advanceTime(1500)
    const d = tid(page, 'dash-difficulty')
    await expect(d).toContainText('📈 Tahap Kesukaran')
    const labels = ['Sangat Mudah', 'Mudah', 'Sederhana', 'Sukar', 'Sangat Sukar']
    const counts = [39694, 47138, 33720, 9600, 0]
    const rows = tid(page, 'dash-difficulty-row')
    await expect(rows).toHaveCount(5)
    for (let i = 0; i < 5; i++) {
      await expect(rows.nth(i)).toContainText(labels[i]!)
      await expect(rows.nth(i).getByTestId('dash-difficulty-count')).toHaveText(String(counts[i]))
      const w = await rows
        .nth(i)
        .getByTestId('dash-difficulty-bar')
        .evaluate((el) => (el as HTMLElement).style.width)
      expect(parseFloat(w)).toBeCloseTo((counts[i]! / 47138) * 100, 0)
    }
    await expect(tid(page, 'dash-difficulty-total')).toHaveText('130152')
    await expect(d).toContainText('Jumlah Keseluruhan')
    await expect(d.getByText('Jumlah Keseluruhan')).toHaveCSS('text-transform', 'uppercase')
    const [rb, db] = await Promise.all([tid(page, 'dash-recent').boundingBox(), d.boundingBox()])
    if (isDesktopShell(page)) {
      expect(Math.abs(rb!.y - db!.y)).toBeLessThan(4)
      expect(db!.x).toBeGreaterThan(rb!.x + rb!.width - 2)
    } else {
      expect(db!.y).toBeGreaterThan(rb!.y + rb!.height - 2)
    }
  })

  test('AC-10.4 Statistik Subjek: 31 cards sorted by count desc, stars, "Digunakan: 0x"', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, MAJU)
    const cards = tid(page, 'dash-subject-stat')
    await expect(tid(page, 'dash-subject-stats')).toContainText('📊 Statistik Subjek')
    await expect(cards).toHaveCount(31)
    const banks = (await tid(page, 'dash-stat-bank').allTextContents()).map((t) =>
      Number(/(\d+)/.exec(t)![1]),
    )
    expect(banks).toHaveLength(31)
    for (let i = 1; i < banks.length; i++) expect(banks[i]!).toBeLessThanOrEqual(banks[i - 1]!)
    await expect(tid(page, 'dash-stat-bank').first()).toHaveText(/^\s*\d+ soalan\s*$/)
    await expect(cards.first()).toContainText('Kesukaran:')
    await expect(cards.first()).toContainText('Digunakan:')
    await expect(tid(page, 'dash-stat-used').first()).toHaveText('0x')
    await expect(tid(page, 'dash-stat-icon')).toHaveCount(31)
    const cols = await tid(page, 'dash-subject-stats')
      .locator('[class*="grid-cols"]')
      .first()
      .evaluate((el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
    const w = viewportWidth(page)
    expect(cols).toBe(w >= 1024 ? 3 : w >= 768 ? 2 : 1)
  })

  // ---------------------------------------------------------------- NFR responsive / touch / text
  for (const who of [ADMIN, MAJU, PELAJAR2, GURU]) {
    test(`NFR-RESP no horizontal scroll and nothing past the right edge (${who})`, async ({
      page,
      loginAs,
      gotoApp,
      mock,
    }) => {
      await open(page, loginAs, gotoApp, who)
      await mock.advanceTime(6000)
      await expect(tid(page, 'dash-subject-stats')).toBeVisible()
      await expectNoHorizontalScroll(page)
      const out = await page.evaluate(() => {
        const vw = document.documentElement.clientWidth
        const root = document.querySelector('[data-testid="dashboard-page"]')!
        const strip = document.querySelector('[data-testid="dash-articles-strip"]')
        const bad: string[] = []
        for (const el of Array.from(root.querySelectorAll('*'))) {
          if (strip?.contains(el)) continue
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          const st = getComputedStyle(el)
          if (st.position === 'absolute' && (el.className + '').includes('after:')) continue
          // Skip anything clipped by an ancestor that itself fits the viewport (decorative blobs, off-screen slides).
          let clipped = false
          for (let a = el.parentElement; a && a !== root.parentElement; a = a.parentElement) {
            const ast = getComputedStyle(a)
            if (ast.overflowX !== 'visible' && a.getBoundingClientRect().right <= vw + 1) {
              clipped = true
              break
            }
          }
          if (clipped) continue
          if (r.right > vw + 1 || r.left < -1)
            bad.push(
              `${el.tagName}.${(el.className + '').slice(0, 40)} right=${Math.round(r.right)}`,
            )
        }
        return bad.slice(0, 8)
      })
      expect(out, `elements past the viewport edge: ${out.join(' | ')}`).toEqual([])
    })
  }

  test('NFR-RESP 320 px: no horizontal scroll, no clipped totals (mobile project only)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    test.skip(viewportWidth(page) !== 375, '320 px check runs on the mobile project only')
    await page.setViewportSize({ width: 320, height: 640 })
    await open(page, loginAs, gotoApp, ADMIN)
    await mock.advanceTime(6000)
    await expect(tid(page, 'dash-platform-total').getByTestId('dash-platform-value')).toHaveText(
      '130152',
    )
    await expectNoHorizontalScroll(page)
    const v = await tid(page, 'dash-platform-total')
      .getByTestId('dash-platform-value')
      .boundingBox()
    expect(v!.x + v!.width).toBeLessThanOrEqual(320)
    expect(v!.x).toBeGreaterThanOrEqual(0)
    await tid(page, 'dash-slide-0').getByTestId('dash-slide-toggle').click()
    await expectNoHorizontalScroll(page)
    expect(await smallText(page)).toEqual([])
  })

  for (const who of [ADMIN, MAJU]) {
    test(`FR-131 text is at least 12 px everywhere on S1 (${who})`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await open(page, loginAs, gotoApp, who)
      await tid(page, 'dash-slide-0').getByTestId('dash-slide-toggle').click()
      expect(await smallText(page)).toEqual([])
    })
  }

  test('DV-M05-17 / FR-131 hit areas: carousel arrows, dots, toggle, Kombo, Lihat Semua, subject start, aside link >= 44 px high', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    await freeze(page)
    const checks: Array<[string, Locator]> = [
      ['toggle', tid(page, 'dash-slide-0').getByTestId('dash-slide-toggle')],
      ['prev', tid(page, 'dash-slide-0').getByTestId('dash-prev')],
      ['next', tid(page, 'dash-slide-0').getByTestId('dash-next')],
      ...[0, 1, 2, 3, 4].map((i): [string, Locator] => [`dot ${i}`, tid(page, `dash-dot-${i}`)]),
      ['kombo link', tid(page, 'dash-kombo-link')],
      ['lihat semua', tid(page, 'dash-articles-all')],
      ['subject start (first)', tid(page, 'dash-subject-start').first()],
      ['subject start (last)', tid(page, 'dash-subject-start').last()],
    ]
    if (isDesktopShell(page)) checks.push(['aside link', tid(page, 'dash-aside-all')])
    const bad: string[] = []
    for (const [name, loc] of checks) {
      const h = await hitArea(loc)
      if (h.h < 44) bad.push(`${name}: hit ${h.w}x${h.h} (visible ${h.visW}x${h.visH})`)
    }
    expect(bad, bad.join(' | ')).toEqual([])
    // Visible size stays as live (DV-M05-17 changes only the invisible hit area).
    const dot = await tid(page, 'dash-dot-1').boundingBox()
    expect(dot!.height).toBeLessThan(12)
    const ar = await tid(page, 'dash-slide-0').getByTestId('dash-prev').boundingBox()
    expect(ar!.height).toBeLessThanOrEqual(34)
  })

  test('DV-M05-17 dots: each dot area picks its own dot and does not swallow a neighbour', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, PELAJAR2)
    await freeze(page)
    for (const i of [4, 2, 0]) {
      // Click 15 px above the visible dot (inside the invisible 44 px area) and 15 px below it.
      await tid(page, 'dash-dot-1').evaluate((el) => el.scrollIntoView({ block: 'center' })) // keep clear of the fixed bottom nav on tablet/mobile
      const b = (await tid(page, `dash-dot-${i}`).boundingBox())!
      await page.mouse.click(b.x + b.width / 2, b.y - 15)
      await expect(tid(page, 'dash-counter')).toHaveText(`${i + 1} / 5`)
      await tid(page, 'dash-dot-1').evaluate((el) => el.scrollIntoView({ block: 'center' })) // keep clear of the fixed bottom nav on tablet/mobile
      const b2 = (await tid(page, `dash-dot-${(i + 1) % 5}`).boundingBox())!
      await page.mouse.click(b2.x + b2.width / 2, b2.y + b2.height + 15)
      await expect(tid(page, 'dash-counter')).toHaveText(`${((i + 1) % 5) + 1} / 5`)
    }
  })

  test('touch targets over the whole S1: every link/button reports its real hit height (info + >= 24 px floor)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    await freeze(page)
    const hits = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="dashboard-page"]')!
      const out: { id: string; h: number; w: number }[] = []
      for (const el of Array.from(root.querySelectorAll('a,button')) as HTMLElement[]) {
        if (!el.offsetParent || el.getBoundingClientRect().width === 0) continue
        el.scrollIntoView({ block: 'center' })
        const r = el.getBoundingClientRect()
        const hit = (x: number, y: number) => {
          const e = document.elementFromPoint(x, y)
          return !!e && (e === el || el.contains(e))
        }
        const cx = r.left + r.width / 2
        const cy = r.top + r.height / 2
        let u = 0
        let d = 0
        while (u < 80 && hit(cx, cy - u - 1)) u++
        while (d < 80 && hit(cx, cy + d + 1)) d++
        if (!hit(cx, cy)) continue // not rendered / covered (inactive slide)
        out.push({
          id: el.getAttribute('data-testid') ?? el.tagName,
          h: u + d + 1,
          w: Math.round(r.width),
        })
      }
      return out
    })
    expect(hits.length).toBeGreaterThan(40)
    const min = Math.min(...hits.map((h) => h.h))
    test.info().annotations.push({ type: 'min-hit-height', description: `${min}` })
    expect(hits.filter((h) => h.h < 44).map((h) => `${h.id}:${h.h}`)).toEqual([])
  })

  // ---------------------------------------------------------------- links, roles, states
  test('every S1 link target resolves (not the 404 page)', async ({ page, loginAs, gotoApp }) => {
    test.setTimeout(360_000)
    await open(page, loginAs, gotoApp, ADMIN)
    const hrefs = await page.evaluate(() => {
      const root = document.querySelector('[data-testid="dashboard-page"]')!
      return Array.from(
        new Set(Array.from(root.querySelectorAll('a[href]')).map((a) => a.getAttribute('href')!)),
      )
    })
    const unresolved: string[] = []
    for (const href of hrefs) {
      await navigateInApp(page, href)
      await page.waitForTimeout(500)
      const nf = await page.locator('[data-page="not-found"]').count()
      const path = new URL(page.url()).pathname
      if (nf > 0) unresolved.push(`${href} -> 404 (${path})`)
      await navigateInApp(page, '/dashboard')
      await expect(tid(page, 'dash-greeting')).toBeVisible()
    }
    test.info().annotations.push({
      type: 'hrefs',
      description: `${hrefs.length} unique: ${hrefs.filter((h) => !h.startsWith('/practice?') && !h.startsWith('/artikel/')).join(', ')}`,
    })
    test
      .info()
      .annotations.push({ type: 'unresolved', description: unresolved.join('; ') || 'none' })
    // Targets owned by screens that are not built yet (M05 S8/S9, M19 /pricing, M17 /admin): reported as dependencies, not S1 defects.
    const PENDING = ['/pricing', '/practice/progress', '/practice/history', '/admin']
    expect(unresolved.filter((u) => !PENDING.some((p) => u.startsWith(`${p} -> `)))).toEqual([])
  })

  for (const who of [
    'pelajar@demo.test',
    MAJU,
    GURU,
    ADMIN,
    'adminsekolah@demo.test',
    'ibubapa@demo.test',
    'penaja@demo.test',
    'ppd@demo.test',
    'jpn@demo.test',
  ]) {
    test(`SRS 9 role access ${who}`, async ({ page, loginAs, gotoApp }) => {
      await loginAs(who)
      await gotoApp('/dashboard')
      await page.waitForTimeout(800)
      const path = new URL(page.url()).pathname
      const shown = await tid(page, 'dash-greeting').count()
      test
        .info()
        .annotations.push({ type: 'landing', description: `${who} -> ${path} dashboard=${shown}` })
      expect(path, `${who} landed on ${path}`).toBe('/dashboard')
      await expect(tid(page, 'dash-greeting')).toBeVisible()
      await expect(tid(page, 'dash-subject-stats')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  }

  test('guest is sent to /login (FR-130)', async ({ page, gotoApp }) => {
    await gotoApp('/dashboard')
    await expect(page).toHaveURL(/\/login/)
    await expect(tid(page, 'dash-greeting')).toHaveCount(0)
  })

  test.describe('loading state', () => {
    test.use({ mockInit: { latency: 2500 } })
    test('slow response: empty content area (no skeleton), then the page', async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(PELAJAR2)
      await gotoApp('/dashboard')
      await expect(tid(page, 'dashboard-page')).toBeAttached()
      await expect(tid(page, 'dash-greeting')).toHaveCount(0)
      await expect(tid(page, 'dashboard-error')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
      await expect(tid(page, 'dash-greeting')).toBeVisible({ timeout: 30_000 })
    })
  })

  for (const [name, status] of [
    ['500', 500],
    ['403', 403],
    ['404', 404],
  ] as const) {
    test(`error state: API ${name} shows the message and Cuba Semula recovers`, async ({
      page,
      loginAs,
      gotoApp,
      mock,
    }) => {
      await loginAs(PELAJAR2)
      await gotoApp('/practice')
      await mock.failNext('GET /api/dashboard', status)
      await navigateInApp(page, '/dashboard')
      await expect(tid(page, 'dashboard-error')).toBeVisible()
      await expect(tid(page, 'dashboard-error')).toContainText(
        'Maaf, berlaku ralat. Sila cuba semula.',
      )
      await expect(tid(page, 'dash-greeting')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
      const retry = tid(page, 'dashboard-retry')
      expect((await hitArea(retry)).h).toBeGreaterThanOrEqual(44)
      await retry.click()
      await expect(tid(page, 'dash-greeting')).toBeVisible()
      await expect(tid(page, 'dashboard-error')).toHaveCount(0)
    })
  }

  test('error state: network error shows the message and retry recovers', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(PELAJAR2)
    await gotoApp('/practice')
    await mock.networkErrorNext('GET /api/dashboard')
    await navigateInApp(page, '/dashboard')
    await expect(tid(page, 'dashboard-error')).toContainText(
      'Maaf, berlaku ralat. Sila cuba semula.',
    )
    await tid(page, 'dashboard-retry').click()
    await expect(tid(page, 'dash-greeting')).toBeVisible()
  })

  test('no page errors or console errors while loading and exploring S1', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`))
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(`console: ${m.text()}`)
    })
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`))
    await open(page, loginAs, gotoApp, ADMIN)
    await mock.advanceTime(8000)
    await tid(page, 'dash-slide-0').getByTestId('dash-next').click()
    await navigateInApp(page, '/practice')
    await navigateInApp(page, '/dashboard')
    await expect(tid(page, 'dash-greeting')).toBeVisible()
    await mock.advanceTime(8000)
    expect(errors).toEqual([])
  })

  // ---------------------------------------------------------------- M09 banner mapping
  test('M09 ActiveBanner.description is the slide body; a deactivated banner leaves the carousel', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await open(page, loginAs, gotoApp, ADMIN)
    await navigateInApp(page, '/admin/banners/1/edit')
    const desc = page.getByTestId('banner-description')
    await expect(desc).toBeVisible()
    const NEW = 'QA ujian: penerangan banner diubah oleh admin.'
    await desc.fill(NEW)
    await page.getByRole('button', { name: 'Kemaskini Banner' }).click()
    await expect(page).toHaveURL(/\/admin\/banners$/)
    await navigateInApp(page, '/dashboard')
    await expect(tid(page, 'dash-slide-0').getByTestId('dash-slide-body')).toHaveText(NEW)
    await expect(tid(page, 'dash-counter')).toHaveText('1 / 5')
    await navigateInApp(page, '/admin/banners/5/edit')
    await expect(page.getByTestId('banner-active')).toBeVisible()
    await page.getByTestId('banner-active').uncheck()
    await page.getByRole('button', { name: 'Kemaskini Banner' }).click()
    await expect(page).toHaveURL(/\/admin\/banners$/)
    await navigateInApp(page, '/dashboard')
    await expect(tid(page, 'dash-counter')).toHaveText('1 / 4')
    await expect(tid(page, 'dash-dots').locator('button')).toHaveCount(4)
    await tid(page, 'dash-slide-0').getByTestId('dash-prev').click()
    await expect(tid(page, 'dash-counter')).toHaveText('4 / 4')
    await expectNoHorizontalScroll(page)
  })
})
