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

/**
 * The shell title (Pembelajaran or Pentadbiran navbar: `h1`, or `shell-title` when the page owns its h1). The subtitle
 * is `pembelajaran-subtitle` (absent when the route sets none).
 */
async function header(page: Page): Promise<{ title: string; subtitle: string }> {
  const title = (
    await page
      .locator('[data-testid=pembelajaran-header], [data-testid=pentadbiran-header]')
      .locator('h1, [data-testid=shell-title]')
      .first()
      .innerText()
  ).trim()
  const sub = page.locator('[data-testid=pembelajaran-subtitle], [data-testid=pentadbiran-subtitle]')
  const subtitle = (await sub.count()) > 0 ? ((await sub.first().textContent()) ?? '').trim() : ''
  return { title, subtitle }
}

/** The six subtopics of legacyTopics id 103 (curriculum.json legacySubtopics, in order). */
const SUBTOPICS_103 = [
  'Kelestarian alam sekitar',
  'Sektor tenaga',
  'Sektor pengurusan sisa dan air sisa',
  'Sektor pertanian dan perhutanan',
  'Sektor pengangkutan',
  'Teknologi hijau dan kehidupan',
]

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

  test('E2E-M03-35 default list: header, chips, the form 19 cards, no pagination', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openTopics(page, gotoApp)
    await expectTabTitle(page, 'Topik Pembelajaran | PRESTASIPLUS')
    expect(await header(page)).toEqual({
      title: 'Topik Pembelajaran',
      subtitle: 'Terokai semua topik pembelajaran',
    })
    const grades = page.getByTestId('grade-chip')
    // D72/D86: Semua Tingkatan + Tingkatan 1 to 5; no Darjah chip.
    expect(await texts(grades)).toEqual([
      'Semua Tingkatan',
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    expect(await hrefs(grades)).toEqual([
      '/topics?grade_level=SEMUA',
      '/topics?grade_level=TINGKATAN_1',
      '/topics?grade_level=TINGKATAN_2',
      '/topics?grade_level=TINGKATAN_3',
      '/topics?grade_level=TINGKATAN_4',
      '/topics?grade_level=TINGKATAN_5',
    ])
    // A bare URL opens the student's form: pelajar@demo.test has grade 10 = Tingkatan 4
    // (src/mock/core-data/accounts.ts:107; formGrade in lib/student-catalogue.ts).
    expect(await actives(grades)).toEqual([false, false, false, false, true, false])
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
      '/topics?grade_level=TINGKATAN_4',
      '/topics?grade_level=TINGKATAN_4&subject=MATEMATIK',
      '/topics?grade_level=TINGKATAN_4&subject=BAHASA_MELAYU',
    ])
    expect((await actives(subjects))[0]).toBe(true)
    // 19 Tingkatan 4 topics: curriculum.json legacyTopics, mock/repository/queries.ts:170 (LT-GRADE TINGKATAN_4 = 19).
    await expect(page.getByTestId('topic-card')).toHaveCount(19)
    await expect(page.getByTestId('topic-name').filter({ hasText: 'Geografi Tingkatan 4' })).toHaveCount(1)
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
    test.slow() // reloads the whole app nine times
    await loginAs(PELAJAR)
    await openTopics(page, gotoApp, '?grade_level=TINGKATAN_4&subject=SAINS')
    // 12 Sains topics at Tingkatan 4 (curriculum.json legacyTopics ids 100-111).
    await expect(page.getByTestId('topic-card')).toHaveCount(12)
    expect(await texts(page.getByTestId('topic-name'))).toEqual([
      'Alat pemadam api',
      'Heimlich Maneuver',
      'Indeks Jisim Badan (BMI)',
      'Teknologi Hijau untuk Kelestarian Alam Sekitar',
      'Mutasi',
      'Pergerakan dan pertumbuhan manusia',
      'Gangguan terhadap koordinasi badan',
      'Isotop',
      'Aloi',
      'Antioksidan',
      'Gerakan linear',
      'Aplikasi tenaga nuklear',
    ])
    const grades = page.getByTestId('grade-chip')
    const subjects = page.getByTestId('subject-chip')
    // Each chip keeps the other filter.
    expect((await hrefs(grades))[0]).toBe('/topics?grade_level=SEMUA&subject=SAINS')
    expect((await hrefs(grades))[2]).toBe('/topics?grade_level=TINGKATAN_2&subject=SAINS')
    expect((await hrefs(subjects))[0]).toBe('/topics?grade_level=TINGKATAN_4')
    expect((await actives(grades))[4]).toBe(true)
    expect((await actives(subjects))[4]).toBe(true)

    await openTopics(page, gotoApp, '?grade_level=TINGKATAN_4')
    await expect(page.getByTestId('topic-card')).toHaveCount(19)
    expect(await actives(grades)).toEqual([false, false, false, false, true, false])

    await openTopics(page, gotoApp, '?grade_level=TINGKATAN_5')
    // 10 Tingkatan 5 topics (queries.ts:171).
    await expect(page.getByTestId('topic-card')).toHaveCount(10)
    expect(await actives(grades)).toEqual([false, false, false, false, false, true])

    await openTopics(page, gotoApp, '?subject=GEOGRAFI')
    // One Geografi topic at Tingkatan 4 (curriculum.json legacyTopics id 73).
    await expect(page.getByTestId('topic-card')).toHaveCount(1)
    expect((await actives(subjects)).every((a) => !a)).toBe(true)

    // D72: an old Darjah link (any case) falls back to the pupil's form, Tingkatan 4; no Darjah chip.
    await openTopics(page, gotoApp, '?grade_level=DARJAH_1&subject=SAINS')
    await expect(page.getByTestId('topic-card')).toHaveCount(12)
    await openTopics(page, gotoApp, '?grade_level=darjah_1')
    await expect(page.getByTestId('topic-card')).toHaveCount(19)
    expect(await actives(grades)).toEqual([false, false, false, false, true, false])
    expect((await texts(grades)).some((t) => /darjah/i.test(t))).toBe(false)

    await openTopics(page, gotoApp, '?grade_level=TINGKATAN_2')
    // Tingkatan 2 has no topics (queries.ts:168 LT-GRADE TINGKATAN_2 = 0).
    await expect(page.getByTestId('topics-empty')).toContainText('Tiada topik buat masa ini')
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
    // Topic 103 (Sains Tingkatan 4): curriculum.json legacyTopics id 103, 6 subtopics, a description.
    const nombor = page.locator('[data-testid=topic-card][data-topic-id="103"]')
    await expect(nombor.getByTestId('topic-name')).toHaveText('Teknologi Hijau untuk Kelestarian Alam Sekitar')
    await expect(nombor.getByTestId('topic-subject')).toHaveText('SAINS')
    await expect(nombor.getByTestId('topic-subtopic-count')).toHaveText('6 Subtopik')
    await expect(nombor.getByTestId('topic-description')).toHaveText('Bidang DSKP 4.0 Sains Tingkatan 4')
    await expect(nombor).toContainText('Lihat Topik')
    // v2 design: the label is the overline token (no text-transform).
    await expect(nombor.getByText('Subtopik:', { exact: true })).toHaveClass(/text-overline/)
    expect(await nombor.getByTestId('topic-subtopic').count()).toBeLessThanOrEqual(3)
    await expect(nombor.getByTestId('topic-more')).toHaveText('+3 lagi...')

    // Topic 104 Mutasi has 5 subtopics (curriculum.json legacySubtopics): "+2 lagi...".
    const t7 = page.locator('[data-testid=topic-card][data-topic-id="104"]')
    await expect(t7.getByTestId('topic-subtopic-count')).toHaveText('5 Subtopik')
    await expect(t7.getByTestId('topic-more')).toHaveText('+2 lagi...')
    await expect(t7).toHaveAttribute('href', '/topics/104')

    // A null-description card has no description line (Geografi Tingkatan 4, topic 73).
    const t69 = page.locator('[data-testid=topic-card][data-topic-id="73"]')
    await expect(t69.getByTestId('topic-description')).toHaveCount(0)

    const width = viewportWidth(page)
    const expected = width >= 1024 ? 3 : width >= 640 ? 2 : 1
    expect(await columns(page.getByTestId('topic-grid'))).toBe(expected)
    await expectNoHorizontalScroll(page)

    await t7.click()
    await expect.poll(() => new URL(page.url()).pathname).toBe('/topics/104')
  })
})

test.describe('M03 S13 Topic detail', MODULE, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M03-38 topic 103: header, hero, stats, subtopic cards and 404', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp('/topics?grade_level=TINGKATAN_4&subject=SAINS')
    await expect(page.getByTestId('topic-card').first()).toBeVisible()
    await page.locator('[data-testid=topic-card][data-topic-id="103"]').click()
    await expect(page.getByTestId('topic-hero')).toBeVisible()
    await expectTabTitle(page, 'Teknologi Hijau untuk Kelestarian Alam Sekitar | PRESTASIPLUS')
    expect(await header(page)).toEqual({
      title: 'Teknologi Hijau untuk Kelestarian Alam Sekitar',
      subtitle: 'SAINS',
    })
    const back = page.getByTestId('topic-back')
    await expect(back).toHaveText('Kembali ke Senarai Topik')
    await expect(back).toHaveAttribute('href', '/topics')

    const hero = page.getByTestId('topic-hero')
    await expect(hero.getByRole('heading', { level: 1 })).toHaveText('Teknologi Hijau untuk Kelestarian Alam Sekitar')
    await expect(page.getByTestId('topic-hero-description')).toHaveCSS('-webkit-line-clamp', '3')

    await expect(page.getByTestId('stat-subtopik')).toHaveText('6')
    await expect(page.getByTestId('stat-dijawab')).toHaveText('0')
    await expect(page.getByTestId('stat-kemajuan')).toHaveText('0%')
    await expect(page.getByTestId('stat-icon-subtopik')).toHaveClass(/text-primary-t/)
    await expect(page.getByTestId('stat-icon-dijawab')).toHaveClass(/text-success/)
    await expect(page.getByTestId('stat-icon-kemajuan')).toHaveClass(/text-heat/)
    // Three stat cards across at every width.
    const boxes = await page.getByTestId('topic-stats').locator('> div').evaluateAll((els) =>
      els.map((e) => e.getBoundingClientRect().top),
    )
    expect(new Set(boxes.map((y) => Math.round(y))).size).toBe(1)

    const cards = page.getByTestId('subtopic-card')
    await expect(cards).toHaveCount(6)
    // The six subtopics of legacyTopics id 103 (curriculum.json legacySubtopics, in order).
    expect(await texts(page.getByTestId('subtopic-name'))).toEqual(SUBTOPICS_103)
    expect(await texts(page.getByTestId('subtopic-number'))).toEqual(['1', '2', '3', '4', '5', '6'])
    expect(await texts(cards.first().getByTestId('subtopic-badge'))).toEqual([
      'Level 1',
      'Level 2',
      'Level 3',
    ])
    expect(await texts(page.getByTestId('subtopic-progress'))).toEqual(['0%', '0%', '0%', '0%', '0%', '0%'])
    await expectNoHorizontalScroll(page)

    // Topic 68 and topic 103 descriptions.
    await gotoApp('/topics/68')
    await expect(page.getByTestId('topic-hero-description')).toHaveText(
      'Kemahiran Bahasa Melayu SPM Tingkatan 5 berdasarkan DSKP KSSM',
    )
    expect(await texts(page.getByTestId('subtopic-name'))).toEqual(['Kemahiran Bahasa Tingkatan 5'])
    await gotoApp('/topics/103')
    await expect(page.getByTestId('subtopic-description').first()).toHaveText('SK 4.6 Sains Tingkatan 4')

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
    await expectTabTitle(page, 'Peta Belajar | PRESTASIPLUS')
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
    await expect(
      page.locator('[data-testid=map-bar][role=progressbar], [data-testid=map-bar] [role=progressbar]').first(),
    ).toHaveAttribute('aria-valuenow', '0')
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

  test('E2E-M03-42 layout: alternating sides from md, centred below, fade-in on scroll', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openMap(page, gotoApp, '?subject=MATEMATIK&grade=TINGKATAN_4')
    const nodes = page.getByTestId('map-node')
    // 3 Tingkatan 4 Matematik topics (curriculum.json legacyTopics ids 86, 87, 88).
    await expect(nodes).toHaveCount(3)
    const container = (await page.getByTestId('map-container').boundingBox())!
    const center = container.x + container.width / 2
    await nodes.first().scrollIntoViewIfNeeded()
    await expect(nodes.first()).toHaveAttribute('data-visible', 'true')
    const second = nodes.nth(1)
    await second.scrollIntoViewIfNeeded()
    await expect(second).toHaveAttribute('data-visible', 'true')
    const b0 = (await nodes.first().boundingBox())!
    const b1 = (await second.boundingBox())!
    // v2 design: no path line or dots; from md the nodes alternate right then left of the centre.
    if (viewportWidth(page) >= 768) {
      expect(b0.x).toBeGreaterThan(center - 2)
      expect(b1.x + b1.width).toBeLessThan(center + 2)
    } else {
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
    await openMap(page, gotoApp, '?subject=MATEMATIK&grade=TINGKATAN_4')
    const last = page.getByTestId('map-node').last()
    await last.scrollIntoViewIfNeeded()
    await expect(last).toHaveAttribute('data-visible', 'true')
    await expect(last).toHaveCSS('opacity', '1')
  })

  test('DV-M03-10 no horizontal page scroll at 320 px', async ({ page, loginAs, gotoApp }) => {
    await page.setViewportSize({ width: 320, height: 800 })
    await loginAs(PELAJAR)
    await openMap(page, gotoApp)
    await expect(page.getByTestId('map-grade-chip')).toHaveCount(5)
    await expectNoHorizontalScroll(page)
    await openMap(page, gotoApp, '?subject=MATEMATIK&grade=TINGKATAN_4')
    await expect(page.getByTestId('map-node').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-43 selectors: pills, colours, subtitles, grade chips', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openMap(page, gotoApp)
    const pills = page.getByTestId('map-subject-pill')
    // The seven learner pills first, then one pill per other active subject: 31 subjects in
    // curriculum.json (SUBJ-ACTIVE), so 31 pills.
    const pillTexts = await texts(pills)
    expect(pillTexts.slice(0, 7)).toEqual([
      '🔢 Matematik',
      '📝 Bahasa Melayu',
      '🇬🇧 Bahasa Inggeris',
      '🔬 Sains',
      '☪️ Pend. Islam',
      '🤝 Pend. Moral',
      '🏛️ Sejarah',
    ])
    expect(pillTexts).toHaveLength(31)
    expect((await hrefs(pills))[0]).toBe('/peta-belajar?subject=MATEMATIK&grade=TINGKATAN_4')
    expect((await hrefs(pills))[6]).toBe('/peta-belajar?subject=SEJARAH&grade=TINGKATAN_4')
    // v2 design: no per-subject colours; the active pill is the solid primary one, the others are soft.
    const activeBg = await pills.first().evaluate((e) => getComputedStyle(e).backgroundColor)
    const idleBg = await pills.nth(1).evaluate((e) => getComputedStyle(e).backgroundColor)
    expect(activeBg).not.toBe(idleBg)

    await openMap(page, gotoApp, '?subject=PENDIDIKAN_ISLAM&grade=TINGKATAN_4')
    await expect(pills.nth(4)).toHaveAttribute('data-active', 'true')
    expect(await pills.nth(4).evaluate((e) => getComputedStyle(e).backgroundColor)).toBe(activeBg)
    await expect(page.getByTestId('map-subtitle')).toHaveText(
      'Terokai perjalanan Pend. Islam — takluki setiap pulau! 🏝️',
    )
    await openMap(page, gotoApp, '?subject=PENDIDIKAN_MORAL&grade=TINGKATAN_4')
    await expect(page.getByTestId('map-subtitle')).toContainText('Terokai perjalanan Pend. Moral —')
    await openMap(page, gotoApp, '?subject=SEJARAH&grade=TINGKATAN_4')
    await expect(pills.nth(6)).toHaveAttribute('data-active', 'true')

    const chips = page.getByTestId('map-grade-chip')
    expect(await texts(chips)).toEqual([
      'Tingkatan 1',
      'Tingkatan 2',
      'Tingkatan 3',
      'Tingkatan 4',
      'Tingkatan 5',
    ])
    expect(await hrefs(chips)).toEqual(
      [1, 2, 3, 4, 5].map((n) => `/peta-belajar?subject=SEJARAH&grade=TINGKATAN_${String(n)}`),
    )
    expect(await actives(chips)).toEqual([false, false, false, true, false])
    await expect(chips.nth(3)).toHaveCSS('background-image', /linear-gradient/)
    // One row, no wrap.
    const tops = await chips.evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().top)))
    expect(new Set(tops).size).toBe(1)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-44 parameters: defaults and the Tingkatan 4 fallback (D72)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(PELAJAR)
    await openMap(page, gotoApp)
    await expect(page.getByTestId('map-node')).toHaveCount(3)
    expect(await actives(page.getByTestId('map-grade-chip'))).toEqual([false, false, false, true, false])
    expect((await actives(page.getByTestId('map-subject-pill')))[0]).toBe(true)

    for (const q of [
      '?subject=SAINS&grade=DARJAH_5',
      '?subject=SAINS&grade=darjah_2',
      '?subject=SAINS&grade=XYZ',
    ]) {
      await openMap(page, gotoApp, q)
      expect(await actives(page.getByTestId('map-grade-chip'))).toEqual([false, false, false, true, false])
      expect((await actives(page.getByTestId('map-subject-pill')))[3]).toBe(true)
      expect((await texts(page.getByTestId('map-grade-chip'))).some((t) => /darjah/i.test(t))).toBe(false)
    }
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-44 admin default is Matematik + Tingkatan 4', async ({ page, loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await openMap(page, gotoApp)
    await expect(page.getByTestId('map-node')).toHaveCount(3)
    expect(await actives(page.getByTestId('map-grade-chip'))).toEqual([false, false, false, true, false])
  })

  test('E2E-M03-45 empty map: Geografi and unknown subject', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    // Geografi has no Tingkatan 5 topic (curriculum.json legacyTopics: only id 73 at Tingkatan 4 and Tingkatan 1).
    await openMap(page, gotoApp, '?subject=GEOGRAFI&grade=TINGKATAN_5')
    await expect(page.getByTestId('map-empty')).toContainText('Peta Belum Tersedia')
    await expect(page.getByTestId('map-empty')).toContainText(
      'Bab DSKP untuk subjek ini belum dimuatkan.',
    )
    await expect(page.getByTestId('map-empty')).toContainText('🗺️')
    await expect(page.getByTestId('map-subtitle')).toContainText('Terokai perjalanan Geografi —')
    // Geografi is an active subject, so its pill exists and is the one active pill.
    expect((await actives(page.getByTestId('map-subject-pill'))).filter(Boolean)).toHaveLength(1)
    if (viewportWidth(page) >= 768) {
      await expect(page.getByTestId('map-done')).toHaveText('0/0')
      await expect(page.getByTestId('map-progress')).toHaveText('0%')
    }
    await openMap(page, gotoApp, '?subject=ZZZ&grade=TINGKATAN_4')
    await expect(page.getByTestId('map-empty')).toBeVisible()
    await expect(page.getByTestId('map-subtitle')).toHaveText(
      'Terokai perjalanan Zzz — takluki setiap pulau! 🏝️',
    )
    await expect(page.getByTestId('map-node')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M03-46 islands without history: all open (D98, no lock)', async ({ page, loginAs, gotoApp }) => {
    await loginAs(PELAJAR)
    await openMap(page, gotoApp, '?subject=MATEMATIK&grade=TINGKATAN_4')
    const nodes = page.getByTestId('map-node')
    await expect(nodes).toHaveCount(3)
    expect(await nodes.evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))).toEqual([
      'unlocked',
      'unlocked',
      'unlocked',
    ])
    const islands = page.getByTestId('island')
    const first = islands.nth(0)
    await expect(first).toHaveAttribute('href', '/practice?topic_id=86')
    await expect(islands.nth(1)).toHaveAttribute('href', '/practice?topic_id=87')
    await expect(first.getByTestId('island-label')).toHaveText('🎯 BUKA')
    await expect(first.getByTestId('island-emoji')).toHaveText('')
    await expect(first.getByTestId('island-name')).toHaveText('Fungsi dan Persamaan Kuadratik')
    await expect(first.getByTestId('island-progress')).toHaveText('0%')
    await expect(first.getByTestId('island-sessions')).toHaveText('0 sesi · 0 soalan dijawab')
    for (const i of [2]) {
      const island = islands.nth(i)
      await expect(island).toHaveAttribute('href', /^\/practice\?topic_id=\d+$/)
      await expect(island.getByTestId('island-label')).toHaveText('🎯 BUKA')
    }
    if (viewportWidth(page) >= 768) await expect(page.getByTestId('map-done')).toHaveText('0/3')
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M03-47 islands of pelajarmaju: the Darjah 1 answer-log anchors do not surface on a Tingkatan map (D72)',
    provisional('BR-14/19 INFERRED'),
    async ({ page, loginAs, gotoApp }) => {
      // pelajarmaju's M05 answers are all on MATH Darjah 1 chapters (m05 mock datasets/canonical.ts:17-20), which
      // S14 no longer serves (D72), so the Tingkatan 4 Matematik map (3 topics, ids 86-88) has no history for
      // this pupil. The anchor-derived states (mastered / started) stay covered on the detail page by E2E-M03-39.
      await loginAs(MAJU)
      await openMap(page, gotoApp, '?subject=MATEMATIK&grade=TINGKATAN_4')
      const nodes = page.getByTestId('map-node')
      await expect(nodes).toHaveCount(3)
      expect(await nodes.evaluateAll((els) => els.map((e) => e.getAttribute('data-state')))).toEqual([
        'unlocked',
        'unlocked',
        'unlocked',
      ])
      const islands = page.getByTestId('island')
      for (const i of [0, 1, 2]) {
        await expect(islands.nth(i).getByTestId('island-label')).toHaveText('🎯 BUKA')
        await expect(islands.nth(i).getByTestId('island-sessions')).toHaveText('0 sesi · 0 soalan dijawab')
      }
      await expect(islands.nth(0).getByTestId('island-name')).toHaveText('Fungsi dan Persamaan Kuadratik')
      await expect(islands.nth(1).getByTestId('island-name')).toHaveText('Sistem Persamaan')
      await expect(islands.nth(2).getByTestId('island-name')).toHaveText('Indeks, Surd dan Logaritma')
      if (viewportWidth(page) >= 768) {
        await expect(page.getByTestId('map-done')).toHaveText('0/3')
        await expect(page.getByTestId('map-progress')).toHaveText('0%')
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
      if (isDesktopShell(page)) return page.getByTestId('pembelajaran-nav')
      await page.getByTestId('pembelajaran-bottom-nav').locator('[data-nav-id="tab-lagi"]').click()
      const drawer = page.getByTestId('pembelajaran-lagi-nav')
      await expect(drawer).toBeVisible()
      return drawer
    }
    const check = async (path: string, activeHref: string, otherHref: string): Promise<void> => {
      await gotoApp(path)
      await expect(page.getByTestId('pembelajaran-main')).toBeVisible()
      const root = await surface()
      await expect(root.locator('a[href="/topics"]').first()).toBeVisible()
      await expect(root.locator('a[href="/peta-belajar"]').first()).toBeVisible()
      await expect(root.locator(`a[href="${activeHref}"]`).first()).toHaveAttribute(
        'aria-current',
        'page',
      )
      await expect(root.locator(`a[href="${otherHref}"]`).first()).not.toHaveAttribute(
        'aria-current',
        'page',
      )
      if (!isDesktopShell(page)) await page.keyboard.press('Escape')
    }
    await check('/topics', '/topics', '/peta-belajar')
    await check('/topics/7', '/topics', '/peta-belajar')
    await check('/peta-belajar', '/peta-belajar', '/topics')
    if (!isDesktopShell(page)) {
      const bottom = page.getByTestId('pembelajaran-bottom-nav')
      await expect(bottom.locator('[data-nav-id="tab-topik"]')).toHaveAttribute('href', '/topics')
      await expect(bottom.locator('[data-nav-id="tab-peta-belajar"]')).toHaveCount(0)
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
