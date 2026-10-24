/**
 * M14-T2b developer E2E (SRS M14 §12; titles carry "SRS §12 #nn", not the E2E ids, which QA writes at
 * G5): student screens S14 `/gamification/leaderboard`, S15 `/gamification/achievements`,
 * S16 `/gamification/referral` and S18 `/gamification/kad-kongsi` at 375 / 768 / 1280. Runs only
 * after the M14 mock handlers are merged. Admin `admin@demo.test` (account 1) unless a test says
 * otherwise; every test runs at the project clock of the fixture default.
 *
 * Share targets (`window.open` to `wa.me`) and the clipboard are stubbed (SRS §12 preamble). The PNG
 * download of "Muat Turun" is real (D25: html2canvas capture); its file name is asserted through the
 * browser download event (SRS §12 #35, #39).
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  actAs,
  expectNoHorizontalScroll,
  expectTabTitle,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const PELAJARMAJU = 'pelajarmaju@demo.test'
const MODULE = { tag: [moduleTag(14)] }

test.use({ mockInit: { latency: 0 } })

/** Records `window.open` URLs and clipboard writes (read back with `opened()` / `clipboard()`). */
async function stubShareTargets(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const w = window as unknown as { __opened: string[]; __clip: string[] }
    w.__opened = []
    w.__clip = []
    window.open = (url?: string | URL) => {
      w.__opened.push(String(url))
      return null
    }
    Object.defineProperty(navigator, 'clipboard', {
      value: {
        writeText: (text: string) => {
          w.__clip.push(text)
          return Promise.resolve()
        },
      },
      configurable: true,
    })
  })
}
const opened = (page: Page) =>
  page.evaluate(() => (window as unknown as { __opened: string[] }).__opened)
const clipboard = (page: Page) =>
  page.evaluate(() => (window as unknown as { __clip: string[] }).__clip)

async function expectHeader(page: Page, title: string, subtitle: string): Promise<void> {
  await expect(page.getByTestId('shell-user-title')).toHaveText(title)
  await expect(page.getByTestId('shell-user-subtitle')).toHaveText(subtitle)
}

/** FR-M14-132: no text node inside `main` smaller than 12px. */
async function expectMinFont(page: Page): Promise<void> {
  const smallest = await page.evaluate(() => {
    const main = document.querySelector('main')
    if (!main) return 0
    let min = Infinity
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if ((n.textContent ?? '').trim() === '' || !n.parentElement) continue
      const el = n.parentElement
      if (el.closest('.sr-only')) continue
      min = Math.min(min, parseFloat(getComputedStyle(el).fontSize))
    }
    return min
  })
  expect(smallest).toBeGreaterThanOrEqual(12)
}

test.describe('M14 S14 /gamification/leaderboard', MODULE, () => {
  test.beforeEach(async ({ loginAs }) => {
    await loginAs(ADMIN)
  })

  test('SRS §12 #31 podium order and values, 47 rows, initials avatars', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/gamification/leaderboard')
    await expect(page.getByTestId('lb-podium-card')).toHaveCount(3)
    await expectTabTitle(page, 'Papan Pendahulu')
    await expectHeader(page, 'Papan Pendahulu', 'Selamat datang kembali')
    await expect(page.getByTestId('leaderboard-hero')).toContainText('🏆 Papan Pendahulu')
    await expect(page.getByTestId('leaderboard-hero')).toContainText('Siapa paling rajin belajar?')

    // silver, gold (raised), bronze
    const ranks = await page
      .getByTestId('lb-podium-card')
      .evaluateAll((els) => els.map((e) => e.getAttribute('data-rank')))
    expect(ranks).toEqual(['2', '1', '3'])
    await expect(page.getByTestId('lb-podium-score')).toHaveText([
      '686,730 syiling',
      '1,018,083 syiling',
      '135,760 syiling',
    ])
    for (const tier of await page.getByTestId('lb-podium-tier').allTextContents()) {
      expect(tier).toContain('Platinum')
    }

    await expect(page.getByTestId('lb-row')).toHaveCount(47)
    await expect(page.getByTestId('lb-row-rank').first()).toHaveText('#4')
    await expect(page.getByTestId('lb-row-rank').last()).toHaveText('#50')
    await expect(page.getByTestId('lb-row-title').first()).toHaveText('Mitos · Level 39')
    await expect(page.getByTestId('lb-row-score').first()).toHaveText('65,129')
    await expect(page.getByTestId('lb-row-tier').first()).toHaveText('💎')

    // rows are ordered by lifetime syiling, descending
    const scores = (await page.getByTestId('lb-row-score').allTextContents()).map((t) =>
      Number(t.replaceAll(',', '')),
    )
    expect(scores).toEqual([...scores].sort((a, b) => b - a))
  })

  test('SRS §12 #32 ?period=week shows the same list; no period filter, no own-rank card', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/gamification/leaderboard')
    await expect(page.getByTestId('lb-row')).toHaveCount(47)
    const plain = await page.getByTestId('lb-row-name').allTextContents()
    await gotoApp('/gamification/leaderboard?period=week')
    await expect(page.getByTestId('lb-row')).toHaveCount(47)
    expect(await page.getByTestId('lb-row-name').allTextContents()).toEqual(plain)
    await expect(page.getByRole('link', { name: /minggu ini|bulan ini|semua masa/i })).toHaveCount(
      0,
    )
    await expect(page.getByText('Kedudukan Anda')).toHaveCount(0)
  })

  test('SRS §12 #97 privacy: seed names, avatars are initials', async ({ page, gotoApp }) => {
    await gotoApp('/gamification/leaderboard')
    await expect(page.getByTestId('lb-row')).toHaveCount(47)
    await expect(page.locator('main img')).toHaveCount(0)
    expect(await page.getByTestId('lb-row-name').allTextContents()).not.toContain('<masked>')
    for (const initials of await page.getByTestId('lb-row-avatar').allTextContents()) {
      expect(initials.trim().length).toBeGreaterThan(0)
      expect(initials.trim().length).toBeLessThanOrEqual(3)
    }
  })

  test('SRS §12 #94 no horizontal scroll and the podium stays in the viewport (DV-M14-07)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/gamification/leaderboard')
    await expect(page.getByTestId('lb-podium-card')).toHaveCount(3)
    await expectNoHorizontalScroll(page)
    const width = viewportWidth(page)
    for (const card of await page.getByTestId('lb-podium-card').all()) {
      const box = await card.boundingBox()
      expect(box).not.toBeNull()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
    }
  })
})

test.describe('M14 S15 /gamification/achievements', MODULE, () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await stubShareTargets(page)
    await loginAs(ADMIN)
  })

  test('SRS §12 #33 header, streak card and 25 locked cards in live order', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/gamification/achievements')
    await expect(page.getByTestId('badge-card')).toHaveCount(25)
    await expectTabTitle(page, 'Pencapaian — PRESTASIPLUS')
    await expectHeader(page, 'Pencapaian Anda', 'Selamat datang kembali')
    await expect(page.getByTestId('achievements-hero')).toContainText('🏅 Pencapaian Anda')
    await expect(page.getByTestId('achievements-subtitle')).toHaveText(
      'Kumpul lencana dan capai pencapaian — 0/25 dicapai',
    )
    await expect(page.getByTestId('streak-current')).toHaveText('1')
    await expect(page.getByTestId('streak-bonus')).toHaveText('1.0x Bonus')
    await expect(page.getByTestId('streak-best')).toHaveText('Terbaik: 5 hari')

    const names = await page.getByTestId('badge-name').allTextContents()
    expect(names[0]).toBe('Langkah Pertama')
    expect(names[1]).toBe('Pelajar Rajin')
    expect(names[24]).toBe('Wira JomBelajar')
    for (const card of await page.getByTestId('badge-card').all()) {
      await expect(card).toHaveAttribute('data-locked', 'true')
    }
    await expect(page.getByTestId('badge-reward').first()).toHaveText('🪙 5 · ⭐ 3 XP')
    // progress only on the five kuiz-count badges
    await expect(page.getByTestId('badge-progress')).toHaveCount(5)
    await expect(page.getByTestId('badge-progress-text').first()).toHaveText('0/1')
  })

  test('SRS §12 #34 rarity pills filter the cards; purple when active; unknown shows nothing', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/gamification/achievements')
    await expect(page.getByTestId('badge-card')).toHaveCount(25)
    await expect(page.getByTestId('achievements-pill')).toHaveText([
      'Semua',
      'Biasa',
      'Jarang',
      'Epik',
      'Legenda',
    ])
    await expect(page.getByTestId('achievements-pill').first()).toHaveClass(/bg-purple-600/)
    const counts: Array<[string, number]> = [
      ['Biasa', 6],
      ['Jarang', 8],
      ['Epik', 6],
      ['Legenda', 5],
    ]
    for (const [label, count] of counts) {
      await page.getByTestId('achievements-pill').filter({ hasText: label }).click()
      await expect(page.getByTestId('badge-card')).toHaveCount(count)
      await expect(page.getByTestId('achievements-pill').filter({ hasText: label })).toHaveClass(
        /bg-purple-600/,
      )
    }
    await gotoApp('/gamification/achievements?rarity=zzz')
    await expect(page.getByTestId('achievements-pill')).toHaveCount(5)
    await expect(page.getByTestId('badge-card')).toHaveCount(0)
  })

  test('SRS §12 #94 no horizontal scroll', async ({ page, gotoApp }) => {
    await gotoApp('/gamification/achievements')
    await expect(page.getByTestId('badge-card')).toHaveCount(25)
    await expectNoHorizontalScroll(page)
  })

  test('SRS §12 #95 no visible text under 12px', async ({ page, gotoApp }) => {
    await gotoApp('/gamification/achievements')
    await expect(page.getByTestId('badge-card')).toHaveCount(25)
    await expectMinFont(page)
  })
})

test.describe('M14 S15 share modal (seeded unlocks)', MODULE, () => {
  test.beforeEach(async ({ page }) => {
    await stubShareTargets(page)
  })

  test(
    'SRS §12 #35 unlocked card opens the modal; WhatsApp uses the viewer profile; Tutup and backdrop close',
    provisional('unlocked-card styling and the pelajarmaju seed are PROPOSED (URS OQ-M14-01)'),
    async ({ page, gotoApp, mock }) => {
      await gotoApp('/login')
      await actAs(page, mock, gotoApp, PELAJARMAJU, '/gamification/achievements')
      await expect(page.getByTestId('badge-card')).toHaveCount(25)
      const unlocked = page.locator('[data-testid=badge-card][data-locked=false]')
      await expect(unlocked).toHaveCount(3)

      // a locked card does nothing
      await page.locator('[data-testid=badge-card][data-locked=true]').first().click()
      await expect(page.getByTestId('share-modal')).toHaveCount(0)

      await unlocked.first().click()
      await expect(page.getByTestId('share-modal')).toBeVisible()
      await expect(page.getByTestId('share-card')).toBeVisible()
      await expect(page.getByTestId('share-dialog')).toContainText('🎓 PRESTASIPLUS')
      await expect(page.getByTestId('share-download')).toHaveText('Muat Turun')

      const [download] = await Promise.all([
        page.waitForEvent('download'),
        page.getByTestId('share-download').click(),
      ])
      expect(download.suggestedFilename()).toMatch(/^pencapaian-[a-z0-9-]+\.png$/)

      await page.getByTestId('share-whatsapp').click()
      const urls = await opened(page)
      expect(urls).toHaveLength(1)
      expect(urls[0]).toMatch(/^https:\/\/wa\.me\/\?text=/)
      expect(decodeURIComponent(urls[0] ?? '')).toContain('https://prestasiplus.my/pelajar/4')

      await page.getByTestId('share-close').click()
      await expect(page.getByTestId('share-modal')).toHaveCount(0)
      await unlocked.first().click()
      await page.getByTestId('share-modal').click({ position: { x: 4, y: 4 } })
      await expect(page.getByTestId('share-modal')).toHaveCount(0)
    },
  )
})

test.describe('M14 S16 /gamification/referral', MODULE, () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await stubShareTargets(page)
    await loginAs(ADMIN)
  })

  test('SRS §12 #40 render, copy code, copy link, share links', async ({ page, gotoApp }) => {
    await gotoApp('/gamification/referral')
    await expect(page.getByTestId('referral-code')).toHaveText('4JURJTT')
    await expectTabTitle(page, 'Rujuk Kawan — PRESTASIPLUS')
    await expectHeader(page, 'Rujuk Kawan, Dapat Syiling!', 'Selamat datang kembali')
    await expect(page.getByTestId('referral-hero')).toContainText('🤝 Rujuk Kawan, Dapat Syiling!')
    await expect(page.getByTestId('referral-hero')).toContainText(
      'Jemput kawan anda ke PRESTASIPLUS — dua-dua dapat ganjaran!',
    )
    await expect(page.getByTestId('reward-you')).toHaveText('50')
    await expect(page.getByTestId('reward-friend')).toHaveText('25')
    await expect(page.getByTestId('referral-tiles')).toContainText('Syiling untuk ANDA')
    await expect(page.getByTestId('referral-tiles')).toContainText('Syiling untuk KAWAN')
    await expect(page.getByTestId('referral-stats')).toContainText('📊 Statistik Rujukan')
    await expect(page.getByTestId('stat-referrals')).toHaveText('0')
    await expect(page.getByTestId('stat-rewarded')).toHaveText('0')
    await expect(page.getByTestId('stat-earned')).toHaveText('0')

    // URL-encoded as live (FR-M14-58); compare the decoded targets
    const waHref = (await page.getByTestId('referral-whatsapp').getAttribute('href')) ?? ''
    expect(waHref.startsWith('https://wa.me/?text=')).toBe(true)
    expect(decodeURIComponent(waHref)).toBe(
      'https://wa.me/?text=Jom belajar matematik di PRESTASIPLUS! Guna kod 4JURJTT untuk dapat 25 syiling PERCUMA! https://prestasiplus.my/register?ref=4JURJTT',
    )
    await expect(page.getByTestId('referral-whatsapp')).toHaveAttribute('target', '_blank')
    const tgHref = (await page.getByTestId('referral-telegram').getAttribute('href')) ?? ''
    expect(tgHref.startsWith('https://t.me/share/url?url=')).toBe(true)
    expect(decodeURIComponent(tgHref)).toBe(
      'https://t.me/share/url?url=https://prestasiplus.my/register?ref=4JURJTT&text=Jom belajar matematik di PRESTASIPLUS! Guna kod 4JURJTT',
    )
    await expect(page.getByTestId('referral-telegram')).toHaveAttribute('target', '_blank')

    await page.getByTestId('referral-copy-code').click()
    await expect(page.getByTestId('referral-copy-code')).toHaveText('✓ Disalin!')
    expect(await clipboard(page)).toEqual(['4JURJTT'])
    await page.getByTestId('referral-copy-link').click()
    await expect(page.getByTestId('referral-copy-link')).toHaveText('✓ Pautan Disalin!')
    expect(await clipboard(page)).toEqual([
      '4JURJTT',
      'https://prestasiplus.my/register?ref=4JURJTT',
    ])
    // the first label stays until reload
    await expect(page.getByTestId('referral-copy-code')).toHaveText('✓ Disalin!')
  })

  test('SRS §12 #94 no horizontal scroll', async ({ page, gotoApp }) => {
    await gotoApp('/gamification/referral')
    await expect(page.getByTestId('referral-code')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M14 S18 /gamification/kad-kongsi', MODULE, () => {
  test.beforeEach(async ({ page, loginAs }) => {
    await stubShareTargets(page)
    await loginAs(ADMIN)
  })

  test('SRS §12 #37 tabs and card values', async ({ page, gotoApp }) => {
    await gotoApp('/gamification/kad-kongsi')
    await expect(page.getByTestId('kad-profil-card')).toBeVisible()
    await expectTabTitle(page, 'Kad Kongsi — PRESTASIPLUS')
    await expectHeader(page, 'Kad Kongsi', 'Kongsi pencapaian anda')
    await expect(page.getByTestId('kad-tabs').getByRole('button')).toHaveText([
      'Profil',
      'Kombo',
      'Penguasaan',
      'Kedudukan',
    ])
    await expect(page.getByTestId('kad-tab-profil')).toHaveAttribute('data-active', 'true')
    await expect(page.getByTestId('kad-profil-title')).toHaveText('Kad Profil Pelajar')
    await expect(page.getByTestId('kad-profil-answered')).toHaveText('119')
    await expect(page.getByTestId('kad-profil-accuracy')).toHaveText('38.7%')
    await expect(page.getByTestId('kad-profil-sessions')).toHaveText('4')
    await expect(page.getByTestId('kad-profil-tier')).toHaveText('🥉 Gangsa')
    await expect(page.getByTestId('kad-profil-level')).toHaveText('Tahap 2')
    await expect(page.getByTestId('kad-profil-syiling')).toHaveText('🪙 256')
    await expect(page.getByTestId('kad-profil-card')).toContainText('🎓 PRESTASIPLUS.MY')

    await page.getByTestId('kad-tab-kombo').click()
    await expect(page.getByTestId('kad-kombo-title')).toHaveText('Kad Kombo')
    await expect(page.getByTestId('kad-kombo-current')).toHaveText('1')
    await expect(page.getByTestId('kad-kombo-best')).toHaveText('5')
    await expect(page.getByTestId('kad-kombo-mult')).toHaveText('1.0x')
    await expect(page.getByTestId('kad-profil-card')).toHaveCount(0)

    await page.getByTestId('kad-tab-penguasaan').click()
    await expect(page.getByTestId('kad-mastery-subject')).toHaveText(['Bahasa Melayu', 'Sejarah'])
    await expect(page.getByTestId('kad-mastery-stage')).toHaveText([
      'Tahap 2 — Aktif',
      'Tahap 1 — Mula Belajar',
    ])
    await expect(page.getByTestId('kad-mastery-accuracy')).toHaveText(['48.9%', '35%'])
    await expect(page.getByTestId('kad-mastery-correct')).toHaveText(['46', '14'])
    await expect(page.getByTestId('kad-penguasaan-0-share')).toHaveText('Kongsi')

    await page.getByTestId('kad-tab-ranking').click()
    await expect(page.getByTestId('kad-kedudukan-title')).toHaveText('Kad Kedudukan')
    await expect(page.getByTestId('kad-ranking-line')).toHaveText('Ketepatan 38.7% · 46/119 betul')
  })

  test('SRS §12 #38 WhatsApp texts carry the value and the viewer profile link (DV-M14-02, 03)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/gamification/kad-kongsi')
    await expect(page.getByTestId('kad-profil-card')).toBeVisible()
    const link = '\n\nhttps://prestasiplus.my/pelajar/1'
    const last = async () => {
      const urls = await opened(page)
      return decodeURIComponent((urls.at(-1) ?? '').replace('https://wa.me/?text=', ''))
    }

    await page.getByTestId('kad-profil-share').click()
    expect(await last()).toBe(
      `Lihat profil saya di PRESTASIPLUS! 38.7% ketepatan dengan 119 soalan dijawab.${link}`,
    )
    await page.getByTestId('kad-tab-kombo').click()
    await page.getByTestId('kad-kombo-share').click()
    expect(await last()).toBe(
      `🔥 Kombo 1 hari berturut-turut di PRESTASIPLUS! Rekod terbaik: 5 hari. Jom cabaran!${link}`,
    )
    await page.getByTestId('kad-tab-penguasaan').click()
    await page.getByTestId('kad-penguasaan-0-share').click()
    expect(await last()).toBe(
      `🧠 Saya sudah capai Level 2 (Aktif) dalam Bahasa Melayu di PRESTASIPLUS! Ketepatan 48.9%. Jom bersaing!${link}`,
    )
    await page.getByTestId('kad-tab-ranking').click()
    await page.getByTestId('kad-kedudukan-share').click()
    expect(await last()).toBe(`🏆 Kedudukan saya di PRESTASIPLUS: 38.7%! Jom latih tubi!${link}`)
  })

  test('SRS §12 #39 Muat Turun saves prestasiplus-profil.png (a real PNG)', async ({
    page,
    gotoApp,
  }) => {
    await gotoApp('/gamification/kad-kongsi')
    await expect(page.getByTestId('kad-profil-card')).toBeVisible()
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByTestId('kad-profil-download').click(),
    ])
    expect(download.suggestedFilename()).toBe('prestasiplus-profil.png')
    const path = await download.path()
    const { readFileSync } = await import('node:fs')
    const bytes = readFileSync(path)
    expect(bytes.subarray(0, 4).toString('hex')).toBe('89504e47')
    expect(bytes.length).toBeGreaterThan(2000)

    // The colour conversion really worked: a card pixel is opaque and violet-ish (blue over red and
    // green), not black or blank. Sampled in the left padding, clear of the text.
    const px = await page.evaluate(async (b64) => {
      const blob = await (await fetch(`data:image/png;base64,${b64}`)).blob()
      const bmp = await createImageBitmap(blob)
      const c = document.createElement('canvas')
      c.width = bmp.width
      c.height = bmp.height
      const ctx = c.getContext('2d')!
      ctx.drawImage(bmp, 0, 0)
      const x = Math.round(bmp.width * 0.06)
      const y = Math.round(bmp.height * 0.5)
      const [r = 0, g = 0, b = 0, a = 0] = ctx.getImageData(x, y, 1, 1).data
      return { r, g, b, a, w: bmp.width, h: bmp.height }
    }, bytes.toString('base64'))
    expect(px.w).toBeGreaterThan(400) // scale 2 of a card about 340px wide
    expect(px.a).toBe(255)
    expect(px.b).toBeGreaterThan(180)
    expect(px.b - px.g).toBeGreaterThan(60)
    expect(px.b).toBeGreaterThan(px.r)
  })

  test('SRS §12 #94 no horizontal scroll on every tab', async ({ page, gotoApp }) => {
    await gotoApp('/gamification/kad-kongsi')
    await expect(page.getByTestId('kad-profil-card')).toBeVisible()
    for (const tab of ['profil', 'kombo', 'penguasaan', 'ranking']) {
      await page.getByTestId(`kad-tab-${tab}`).click()
      await expect(page.getByTestId('kad-panel')).toBeVisible()
      await expectNoHorizontalScroll(page)
    }
  })

  test('SRS §12 #95 no visible text under 12px', async ({ page, gotoApp }) => {
    await gotoApp('/gamification/kad-kongsi')
    await expect(page.getByTestId('kad-profil-card')).toBeVisible()
    await expectMinFont(page)
    for (const tab of ['kombo', 'penguasaan', 'ranking']) {
      await page.getByTestId(`kad-tab-${tab}`).click()
      await expectMinFont(page)
    }
  })
})
