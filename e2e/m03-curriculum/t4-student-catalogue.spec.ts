/**
 * M03-T4 E2E for S12 Topik, S13 topic detail and S14 Peta Belajar at 375 / 768 / 1280
 * (SRS §12: E2E-M03-35..47, 49, and the guest part of 50). Values are the SRS §6.9 seeds and live
 * observations (discovery Appendix B). Tests over INFERRED or UNVERIFIED copy are `@provisional`.
 */

import type { Locator, Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

const PELAJAR = 'pelajar@demo.test'
const MAJU = 'pelajarmaju@demo.test'
const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(3)] }

type Goto = (path: string) => Promise<void>

async function openTopics(page: Page, gotoApp: Goto, query = ''): Promise<void> {
  await gotoApp(`/topics${query}`)
  await expect(page.getByTestId('topics-page')).toBeVisible()
  await expect(page.getByTestId('grade-chip').first()).toBeVisible()
}

async function openMap(page: Page, gotoApp: Goto, query = ''): Promise<void> {
  await gotoApp(`/peta-belajar${query}`)
  await expect(page.getByTestId('map-hero')).toBeVisible()
}

async function header(page: Page): Promise<{ title: string; subtitle: string }> {
  const title = (await page.getByTestId('shell-user-title').first().innerText()).trim()
  const sub = page.getByTestId('shell-user-subtitle')
  const subtitle = (await sub.count()) > 0 ? (await sub.first().innerText()).trim() : ''
  return { title, subtitle }
}

const hrefs = (loc: Locator) =>
  loc.evaluateAll((els) => els.map((e) => e.getAttribute('href') ?? ''))
const texts = (loc: Locator) =>
  loc.evaluateAll((els) => els.map((e) => (e.textContent ?? '').trim().replace(/\s+/g, ' ')))
const actives = (loc: Locator) =>
  loc.evaluateAll((els) => els.map((e) => e.getAttribute('data-active') === 'true'))

async function columns(grid: Locator): Promise<number> {
  return grid.evaluate((el) => {
    const tracks = getComputedStyle(el).gridTemplateColumns.trim().split(/\s+/)
    return tracks.length
  })
}

test.describe('M03 S12 Topik', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M03-35 default list: header, chips, 125 cards, no pagination', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openTopics(page, gotoApp)
    await expectTabTitle(page, 'Topik - PRESTASIPLUS')
    expect(await header(page)).toEqual({
      title: 'Topik Pembelajaran',
      subtitle: 'Terokai semua topik pembelajaran',
    })
    const grades = page.getByTestId('grade-chip')
    expect(await texts(grades)).toEqual([
      'Semua Darjah',
      'Darjah 1',
      'Darjah 2',
      'Darjah 3',
      'Darjah 4',
      'Darjah 5',
      'Darjah 6',
    ])
    expect(await hrefs(grades)).toEqual([
      '/topics',
      ...[1, 2, 3, 4, 5, 6].map((n) => `/topics?grade_level=DARJAH_${String(n)}`),
    ])
    expect(await actives(grades)).toEqual([true, false, false, false, false, false, false])
    const subjects = page.getByTestId('subject-chip')
    expect(await texts(subjects)).toEqual([
      'Semua Subjek',
      'MATEMATIK',
      'BAHASA MELAYU',
      'BAHASA INGGERIS',
      'SAINS',
      'PENDIDIKAN ISLAM',
      'PENDIDIKAN MORAL',
      'SEJARAH',
    ])
    expect((await hrefs(subjects)).slice(0, 3)).toEqual([
      '/topics',
      '/topics?subject=MATEMATIK',
      '/topics?subject=BAHASA_MELAYU',
    ])
    expect((await actives(subjects))[0]).toBe(true)
    await expect(page.getByTestId('topic-card')).toHaveCount(125)
    await expect(page.getByTestId('topic-name').filter({ hasText: 'Kemahiran Geografi' })).toHaveCount(1)
    await expect(
      page.getByTestId('topic-name').filter({ hasText: 'Kemahiran Bahasa Tingkatan 4' }),
    ).toHaveCount(1)
    await expect(page.getByRole('navigation', { name: /halaman|pagination/i })).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-36 filters combine, are case-insensitive and keep the other filter', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.slow() // reloads the whole app six times
    await loginAs(PELAJAR)
    await openTopics(page, gotoApp, '?grade_level=DARJAH_1&subject=SAINS')
    await expect(page.getByTestId('topic-card')).toHaveCount(4)
    expect(await texts(page.getByTestId('topic-name'))).toEqual([
      'Haiwan',
      'Hidupan',
      'Tumbuhan',
      'Fizikal dan Bahan',
    ])
    const grades = page.getByTestId('grade-chip')
    const subjects = page.getByTestId('subject-chip')
    expect((await hrefs(grades))[0]).toBe('/topics?subject=SAINS')
    expect((await hrefs(grades))[2]).toBe('/topics?grade_level=DARJAH_2&subject=SAINS')
    expect((await hrefs(subjects))[0]).toBe('/topics?grade_level=DARJAH_1')
    expect((await actives(grades))[1]).toBe(true)
    expect((await actives(subjects))[4]).toBe(true)

    await openTopics(page, gotoApp, '?grade_level=TINGKATAN_4')
    await expect(page.getByTestId('topic-card')).toHaveCount(19)
    expect(await actives(grades)).toEqual([false, false, false, false, false, false, false])

    await openTopics(page, gotoApp, '?subject=GEOGRAFI')
    await expect(page.getByTestId('topic-card')).toHaveCount(5)
    expect((await actives(subjects)).every((a) => !a)).toBe(true)

    await openTopics(page, gotoApp, '?grade_level=darjah_1')
    await expect(page.getByTestId('topic-card')).toHaveCount(17)
    expect(await actives(grades)).toEqual([false, false, false, false, false, false, false])

    await openTopics(page, gotoApp, '?grade_level=TINGKATAN_2')
    await expect(page.getByTestId('topics-empty')).toContainText('Tiada topik tersedia buat masa ini.')
    await expect(page.getByTestId('topic-card')).toHaveCount(0)

    await openTopics(page, gotoApp, '?subject=ZZZ')
    await expect(page.getByTestId('topics-empty')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-37 cards: content, null description, link and columns by viewport', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openTopics(page, gotoApp)
    const nombor = page.locator('[data-testid=topic-card][data-topic-id="1"]')
    await expect(nombor.getByTestId('topic-name')).toHaveText('Nombor')
    await expect(nombor.getByTestId('topic-subject')).toHaveText('MATEMATIK')
    await expect(nombor.getByTestId('topic-subtopic-count')).toContainText('Subtopik')
    await expect(nombor.getByTestId('topic-description')).toHaveText('Belajar nombor 1 hingga 100')
    await expect(nombor).toContainText('Lihat Topik')
    await expect(nombor.getByText('Subtopik:', { exact: true })).toHaveCSS('text-transform', 'uppercase')
    expect(await nombor.getByTestId('topic-subtopic').count()).toBeLessThanOrEqual(3)

    const t7 = page.locator('[data-testid=topic-card][data-topic-id="7"]')
    await expect(t7.getByTestId('topic-subtopic-count')).toHaveText('4 Subtopik')
    await expect(t7.getByTestId('topic-more')).toHaveText('+1 lagi...')
    await expect(t7).toHaveAttribute('href', '/topics/7')

    // A null-description card has no description line (Kemahiran Geografi, topic 69).
    const t69 = page.locator('[data-testid=topic-card][data-topic-id="69"]')
    await expect(t69.getByTestId('topic-description')).toHaveCount(0)

    const width = viewportWidth(page)
    const expected = width >= 1024 ? 3 : width >= 640 ? 2 : 1
    expect(await columns(page.getByTestId('topic-grid'))).toBe(expected)
    await expectNoHorizontalScroll(page)

    await t7.click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/topics/7')
  })
})

test.describe('M03 S13 Topic detail', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M03-38 topic 7: header, hero, stats, subtopic cards and 404', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/topics?grade_level=DARJAH_1')
    await expect(page.getByTestId('topic-card').first()).toBeVisible()
    await page.locator('[data-testid=topic-card][data-topic-id="7"]').click()
    await expect(page.getByTestId('topic-hero')).toBeVisible()
    await expectTabTitle(page, 'Nombor Bulat Hingga 100 - PRESTASIPLUS')
    expect(await header(page)).toEqual({ title: 'Nombor Bulat Hingga 100', subtitle: 'MATEMATIK' })
    const back = page.getByTestId('topic-back')
    await expect(back).toHaveText('Kembali ke Senarai Topik')
    await expect(back).toHaveAttribute('href', '/topics')

    const hero = page.getByTestId('topic-hero')
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Nombor Bulat Hingga 100')
    await expect(page.getByTestId('topic-hero-description')).toHaveCSS('-webkit-line-clamp', '3')

    await expect(page.getByTestId('stat-subtopik')).toHaveText('4')
    await expect(page.getByTestId('stat-dijawab')).toHaveText('0')
    await expect(page.getByTestId('stat-kemajuan')).toHaveText('0%')
    await expect(page.getByTestId('stat-icon-subtopik')).toHaveClass(/text-purple-600/)
    await expect(page.getByTestId('stat-icon-dijawab')).toHaveClass(/text-green-600/)
    await expect(page.getByTestId('stat-icon-kemajuan')).toHaveClass(/text-amber-600/)
    // Three stat cards across at every width.
    const boxes = await page.getByTestId('topic-stats').locator('> div').evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().top),
    )
    expect(new Set(boxes.map((y) => Math.round(y))).size).toBe(1)

    const cards = page.getByTestId('subtopic-card')
    await expect(cards).toHaveCount(4)
    expect(await texts(page.getByTestId('subtopic-name'))).toEqual([
      'Membilang 1-20',
      'Membilang 21-50',
      'Membilang 51-100',
      'Menulis Nombor dalam Perkataan',
    ])
    expect(await texts(page.getByTestId('subtopic-number'))).toEqual(['1', '2', '3', '4'])
    expect(await texts(cards.first().getByTestId('subtopic-badge'))).toEqual([
      'Level 1',
      'Level 2',
      'Level 3',
    ])
    expect(await texts(page.getByTestId('subtopic-progress'))).toEqual(['0%', '0%', '0%', '0%'])
    await expectNoHorizontalScroll(page)

    // Topic 68 and topic 4 descriptions.
    await gotoApp('/topics/68')
    await expect(page.getByTestId('topic-hero-description')).toHaveText(
      'Kemahiran Bahasa Melayu SPM Tingkatan 5 berdasarkan DSKP KSSM',
    )
    expect(await texts(page.getByTestId('subtopic-name'))).toEqual(['Kemahiran Bahasa Tingkatan 5'])
    await gotoApp('/topics/4')
    await expect(page.getByTestId('subtopic-description').first()).toHaveText(
      'Mengenal haiwan peliharaan seperti kucing, anjing',
    )

    await gotoApp('/topics/99999')
    await expect(page.locator('[data-page=not-found]')).toBeVisible()
  })

  test(
    'E2E-M03-39 progress derived from the M05 answer-log anchors (pelajarmaju)',
    provisional('BR-19 derivation is INFERRED; the "+1 session" step needs the M05 quiz flow'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(MAJU)
      await gotoApp('/topics/1')
      await expect(page.getByTestId('stat-dijawab')).toHaveText('23')
      await expect(page.getByTestId('stat-kemajuan')).toHaveText('95%')
      expect(new Set(await texts(page.getByTestId('subtopic-progress')))).toEqual(new Set(['95%']))
      await gotoApp('/topics/7')
      await expect(page.getByTestId('stat-dijawab')).toHaveText('7')
      await expect(page.getByTestId('stat-kemajuan')).toHaveText('15%')
      expect(new Set(await texts(page.getByTestId('subtopic-progress')))).toEqual(new Set(['15%']))
      await expectNoHorizontalScroll(page)
    },
  )

  test('E2E-M03-40 "Mula Berlatih" targets the practice code of the subject', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.slow() // reloads the whole app eight times
    await loginAs(PELAJAR)
    const map: [number, string][] = [
      [7, 'MATH'],
      [68, 'BM'],
      [12, 'BI'],
      [4, 'SCI'],
      [15, 'PI'],
      [17, 'PM'],
      [18, 'SEJ'],
      [69, 'GEO'],
    ]
    for (const [id, code] of map) {
      await gotoApp(`/topics/${String(id)}`)
      await expect(page.getByTestId('subtopic-card').first()).toBeVisible()
      const links = page.getByTestId('subtopic-practice')
      const all = await hrefs(links)
      expect(all.length).toBeGreaterThan(0)
      expect(new Set(all)).toEqual(new Set([`/practice/${code}`]))
      await expect(links.first()).toContainText('Mula Berlatih')
    }
    await expectNoHorizontalScroll(page)
  })
})

test.describe('M03 S14 Peta Belajar', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M03-41 hero, tiles by width, static bar', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openMap(page, gotoApp)
    await expectTabTitle(page, 'Peta Belajar — PRESTASIPLUS')
    expect(await header(page)).toEqual({ title: 'Peta Belajar', subtitle: '' })
    await expect(page.getByTestId('map-hero')).toContainText('🗺️ Peta Belajar')
    await expect(page.getByTestId('map-subtitle')).toHaveText(
      'Terokai perjalanan Matematik — takluki setiap pulau! 🏝️',
    )
    const tiles = page.getByTestId('map-tiles')
    if (viewportWidth(page) >= 768) {
      await expect(tiles).toBeVisible()
      await expect(tiles).toContainText('Topik Selesai')
      await expect(tiles).toContainText('Kemajuan')
      await expect(page.getByTestId('map-done')).toHaveText('0/3')
      await expect(page.getByTestId('map-progress')).toHaveText('0%')
    } else {
      await expect(tiles).toBeHidden()
    }
    await expect(page.getByTestId('map-bar')).toHaveAttribute('style', /width: 0%/)
    const hasShimmer = await page.evaluate(() => {
      for (const sheet of document.styleSheets) {
        for (const rule of sheet.cssRules) {
          if (rule instanceof CSSKeyframesRule && rule.name === 'shimmer') return true
        }
      }
      return false
    })
    expect(hasShimmer).toBe(false)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-42 layout: path and alternation at 769+, centred below, fade-in on scroll', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openMap(page, gotoApp, '?subject=MATEMATIK&grade=DARJAH_1')
    const nodes = page.getByTestId('map-node')
    await expect(nodes).toHaveCount(5)
    const container = (await page.getByTestId('map-container').boundingBox())!
    const center = container.x + container.width / 2
    await nodes.first().scrollIntoViewIfNeeded()
    await expect(nodes.first()).toHaveAttribute('data-visible', 'true')
    const second = nodes.nth(1)
    await second.scrollIntoViewIfNeeded()
    await expect(second).toHaveAttribute('data-visible', 'true')
    const b0 = (await nodes.first().boundingBox())!
    const b1 = (await second.boundingBox())!
    if (viewportWidth(page) > 768) {
      await expect(page.getByTestId('map-path')).toBeVisible()
      await expect(page.getByTestId('path-dot')).toHaveCount(5)
      expect(b0.x).toBeGreaterThan(center - 2)
      expect(b1.x + b1.width).toBeLessThan(center + 2)
    } else {
      await expect(page.getByTestId('map-path')).toBeHidden()
      await expect(page.getByTestId('path-dot').first()).toBeHidden()
      expect(Math.abs(b0.x + b0.width / 2 - center)).toBeLessThan(2)
      expect(Math.abs(b1.x + b1.width / 2 - center)).toBeLessThan(2)
    }

    // Nodes below the fold are transparent until scrolled into view, then opaque.
    const last = nodes.last()
    await page.evaluate(() => window.scrollTo(0, 0))
    const below = await last.evaluate((el) => el.getBoundingClientRect().top > window.innerHeight)
    if (below) {
      await expect(last).toHaveAttribute('data-visible', 'false')
      await expect(last).toHaveCSS('opacity', '0')
    }
    await last.scrollIntoViewIfNeeded()
    await expect(last).toHaveAttribute('data-visible', 'true')
    await expect(last).toHaveCSS('opacity', '1')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-42 reduced motion changes nothing (as live)', async ({ page, loginAs, gotoApp }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await loginAs(PELAJAR)
    await openMap(page, gotoApp, '?subject=MATEMATIK&grade=DARJAH_1')
    const last = page.getByTestId('map-node').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toHaveAttribute('data-visible', 'true')
    await expect(last).toHaveCSS('opacity', '1')
  })

  test('E2E-M03-43 selectors: pills, colours, subtitles, grade chips', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openMap(page, gotoApp)
    const pills = page.getByTestId('map-subject-pill')
    expect(await texts(pills)).toEqual([
      '🔢 Matematik',
      '📝 Bahasa Melayu',
      '🇬🇧 Bahasa Inggeris',
      '🔬 Sains',
      '☪️ Pend. Islam',
      '🤝 Pend. Moral',
      '🏛️ Sejarah',
    ])
    expect((await hrefs(pills))[0]).toBe('/peta-belajar?subject=MATEMATIK&grade=DARJAH_4')
    expect((await hrefs(pills))[6]).toBe('/peta-belajar?subject=SEJARAH&grade=DARJAH_4')
    await expect(page.getByText('Geografi', { exact: false }).first()).toHaveCount(0)
    await expect(pills.first()).toHaveCSS('background-color', 'rgb(59, 130, 246)')
    await expect(pills.first()).toHaveCSS('border-top-color', 'rgb(59, 130, 246)')
    await expect(pills.nth(1)).not.toHaveCSS('background-color', 'rgb(16, 185, 129)')

    await openMap(page, gotoApp, '?subject=PENDIDIKAN_ISLAM&grade=DARJAH_1')
    await expect(pills.nth(4)).toHaveCSS('background-color', 'rgb(20, 184, 166)')
    await expect(page.getByTestId('map-subtitle')).toHaveText(
      'Terokai perjalanan Pend. Islam — takluki setiap pulau! 🏝️',
    )
    await openMap(page, gotoApp, '?subject=PENDIDIKAN_MORAL&grade=DARJAH_1')
    await expect(page.getByTestId('map-subtitle')).toContainText('Terokai perjalanan Pend. Moral —')
    await openMap(page, gotoApp, '?subject=SEJARAH&grade=DARJAH_1')
    await expect(pills.nth(6)).toHaveCSS('background-color', 'rgb(239, 68, 68)')

    const chips = page.getByTestId('map-grade-chip')
    expect(await texts(chips)).toEqual(['Darjah 1', 'Darjah 2', 'Darjah 3', 'Darjah 4'])
    expect(await hrefs(chips)).toEqual(
      [1, 2, 3, 4].map((n) => `/peta-belajar?subject=SEJARAH&grade=DARJAH_${String(n)}`),
    )
    expect(await actives(chips)).toEqual([true, false, false, false])
    await expect(chips.first()).toHaveCSS('background-image', /linear-gradient/)
    // One row, no wrap.
    const tops = await chips.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-44 parameters: defaults and the Darjah 4 fallback', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openMap(page, gotoApp)
    await expect(page.getByTestId('map-node')).toHaveCount(3)
    expect(await actives(page.getByTestId('map-grade-chip'))).toEqual([false, false, false, true])
    expect((await actives(page.getByTestId('map-subject-pill')))[0]).toBe(true)

    for (const q of [
      '?subject=SAINS&grade=DARJAH_5',
      '?subject=SAINS&grade=TINGKATAN_1',
      '?subject=SAINS&grade=darjah_2',
      '?subject=SAINS&grade=XYZ',
    ]) {
      await openMap(page, gotoApp, q)
      expect(await actives(page.getByTestId('map-grade-chip'))).toEqual([false, false, false, true])
      expect((await actives(page.getByTestId('map-subject-pill')))[3]).toBe(true)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-44 admin default is Matematik + Darjah 4', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openMap(page, gotoApp)
    await expect(page.getByTestId('map-node')).toHaveCount(3)
    expect(await actives(page.getByTestId('map-grade-chip'))).toEqual([false, false, false, true])
  })

  test('E2E-M03-45 empty map: Geografi and unknown subject', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await openMap(page, gotoApp, '?subject=GEOGRAFI&grade=DARJAH_1')
    await expect(page.getByTestId('map-empty')).toContainText('Tiada Topik Dijumpai')
    await expect(page.getByTestId('map-empty')).toContainText(
      'Pilih subjek dan darjah yang lain untuk melihat peta belajar',
    )
    await expect(page.getByTestId('map-empty')).toContainText('🗺️')
    await expect(page.getByTestId('map-subtitle')).toContainText('Terokai perjalanan Geografi —')
    expect((await actives(page.getByTestId('map-subject-pill'))).every((a) => !a)).toBe(true)
    if (viewportWidth(page) >= 768) {
      await expect(page.getByTestId('map-done')).toHaveText('0/0')
      await expect(page.getByTestId('map-progress')).toHaveText('0%')
    }
    await openMap(page, gotoApp, '?subject=ZZZ&grade=DARJAH_1')
    await expect(page.getByTestId('map-empty')).toBeVisible()
    await expect(page.getByTestId('map-subtitle')).toHaveText(
      'Terokai perjalanan Zzz — takluki setiap pulau! 🏝️',
    )
    await expect(page.getByTestId('map-node')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-46 islands without history: 2 open, 3 locked', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await openMap(page, gotoApp, '?subject=MATEMATIK&grade=DARJAH_1')
    const nodes = page.getByTestId('map-node')
    await expect(nodes).toHaveCount(5)
    expect(await nodes.evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))).toEqual([
      'unlocked',
      'unlocked',
      'locked',
      'locked',
      'locked',
    ])
    const islands = page.getByTestId('island')
    const first = islands.nth(0)
    await expect(first).toHaveAttribute('href', '/practice?topic_id=1')
    await expect(islands.nth(1)).toHaveAttribute('href', '/practice?topic_id=7')
    await expect(first.getByTestId('island-label')).toHaveText('🎯 BUKA')
    await expect(first.getByTestId('island-emoji')).toHaveText('🔢')
    await expect(first.getByTestId('island-name')).toHaveText('Nombor')
    await expect(first.getByTestId('island-progress')).toHaveText('0%')
    await expect(first.getByTestId('island-sessions')).toHaveText('0 sesi · 0 soalan dijawab')
    for (const i of [2, 3, 4]) {
      const locked = islands.nth(i)
      await expect(locked).not.toHaveAttribute('href', /.*/)
      await expect(locked.getByTestId('island-label')).toHaveText('🔒 TERKUNCI')
      await expect(locked).toContainText('Selesaikan topik sebelumnya dulu')
      await expect(locked).toHaveCSS('cursor', 'not-allowed')
    }
    if (viewportWidth(page) >= 768) await expect(page.getByTestId('map-done')).toHaveText('0/5')
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M03-47 islands with the M05 answer-log anchors (pelajarmaju)',
    provisional('state labels "⭐ DIKUASAI" / "📘 SEDANG BELAJAR" are UNVERIFIED COPY; BR-14/19 INFERRED'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(MAJU)
      await openMap(page, gotoApp, '?subject=MATEMATIK&grade=DARJAH_1')
      const nodes = page.getByTestId('map-node')
      await expect(nodes).toHaveCount(5)
      expect(await nodes.evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))).toEqual([
        'mastered',
        'started',
        'started',
        'unlocked',
        'locked',
      ])
      const islands = page.getByTestId('island')
      await expect(islands.nth(0).getByTestId('island-label')).toHaveText('⭐ DIKUASAI')
      await expect(islands.nth(0).getByTestId('island-sessions')).toHaveText('3 sesi · 23 soalan dijawab')
      await expect(islands.nth(1).getByTestId('island-label')).toHaveText('📘 SEDANG BELAJAR')
      await expect(islands.nth(2).getByTestId('island-emoji')).toHaveText('')
      await expect(islands.nth(2).getByTestId('island-name')).toHaveText('Bentuk')
      await expect(islands.nth(3).getByTestId('island-name')).toHaveText('Operasi Tambah dan Tolak')
      await expect(islands.nth(3).getByTestId('island-label')).toHaveText('🎯 BUKA')
      await expect(islands.nth(4).getByTestId('island-label')).toHaveText('🔒 TERKUNCI')
      if (viewportWidth(page) >= 768) {
        await expect(page.getByTestId('map-done')).toHaveText('1/5')
        await expect(page.getByTestId('map-progress')).toHaveText('26%')
      }
      await expectNoHorizontalScroll(page)
    },
  )
})

test.describe('M03 student menus and access', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M03-49 user menus: Topik and Peta Belajar links and active states', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    const surface = async (): Promise<Locator> => {
      if (isDesktopShell(page)) return page.getByTestId('shell-user-sidebar')
      await page.getByTestId('shell-user-hamburger').click()
      const drawer = page.getByTestId('shell-user-drawer')
      await expect(drawer).toHaveClass(/\bopen\b/)
      return drawer
    }
    const check = async (path: string, activeId: string, other: string): Promise<void> => {
      await gotoApp(path)
      await expect(page.getByTestId('shell-user-main')).toBeVisible()
      const root = await surface()
      const topik = root.locator('[data-nav-id="topik"]')
      const peta = root.locator('[data-nav-id="peta-belajar"]')
      await expect(topik).toHaveAttribute('href', '/topics')
      await expect(peta).toHaveAttribute('href', '/peta-belajar')
      await expect(root.locator(`[data-nav-id="${activeId}"]`)).toHaveClass(/\bactive\b/)
      await expect(root.locator(`[data-nav-id="${other}"]`)).not.toHaveClass(/\bactive\b/)
      if (!isDesktopShell(page)) await page.getByTestId('shell-user-drawer-close').click()
    }
    await check('/topics', 'topik', 'peta-belajar')
    await check('/topics/7', 'topik', 'peta-belajar')
    await check('/peta-belajar', 'peta-belajar', 'topik')
    if (!isDesktopShell(page)) {
      const bottom = page.getByTestId('shell-user-bottom-nav')
      await expect(bottom.locator('[data-nav-id="bottom-topik"]')).toHaveAttribute('href', '/topics')
      await expect(bottom.locator('[data-nav-id="bottom-peta-belajar"]')).toHaveCount(0)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-50 a guest is sent to /login from S12-S14', async ({ page, gotoApp }) => {
    for (const path of ['/topics', '/topics/7', '/peta-belajar']) {
      await gotoApp(path)
      await expect.poll(() => new URL(page.url()).pathname).toBe('/login')
    }
  })
})
