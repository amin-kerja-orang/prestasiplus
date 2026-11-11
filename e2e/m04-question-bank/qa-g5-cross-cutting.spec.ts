/**
 * M04 G5 QA specs (written by QA): responsive sweep and 12px text rule over every built M04 route,
 * lookups, counts (D11), PKSK, user-portal nav, structured list/detail details.
 * Covers AC-M04-22.x, 23.x, 28.4, 29.3, 29.4, 30.1, 30.6, 32.x, 26.2.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, isDesktopShell, moduleTag } from '../support'

const ADMIN = 'admin@demo.test'
const byId = (page: Page, id: string) => page.getByTestId(id)

const ROUTES: Array<[string, string]> = [
  ['S1', '/admin/questions'],
  ['S1 filtered archived', '/admin/questions?status=archived&page=2'],
  ['S1 empty', '/admin/questions?search=zzqxv'],
  ['S3', '/admin/questions/564159'],
  ['S4', '/admin/questions/564159/edit'],
  ['S5', '/admin/questions/import'],
  ['S5h', '/admin/questions/import-history'],
  ['S6', '/admin/questions/quality'],
  ['S8', '/admin/structured-questions'],
  ['S9', '/admin/structured-questions/3698'],
  ['S10', '/admin/question-submissions'],
  ['S11', '/admin/soalan-gambar'],
  ['S12 all', '/admin/master-notes?tab=all'],
]

test.describe('QA G5 responsive sweep and small text', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(120_000)

  for (const [name, path] of ROUTES) {
    test(`E2E-M04-58/64 ${name} ${path}: no horizontal scroll, text >= 12px (AC-30.1, 30.6)`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(ADMIN)
      await gotoApp(path)
      await page.waitForTimeout(1500)
      await expectNoHorizontalScroll(page)
      const m = await page.evaluate(() => ({
        sw: document.documentElement.scrollWidth,
        iw: window.innerWidth,
      }))
      expect(m.sw).toBeLessThanOrEqual(m.iw)
      const small = await page.evaluate(() => {
        const out: string[] = []
        const root = document.querySelector('main') ?? document.body
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        let n: Node | null
        while ((n = walker.nextNode())) {
          const t = (n.textContent ?? '').trim()
          if (!t) continue
          const el = n.parentElement
          if (!el) continue
          const cs = getComputedStyle(el)
          if (cs.display === 'none' || cs.visibility === 'hidden') continue
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          if (el.closest('script,style,option')) continue
          const fs = parseFloat(cs.fontSize)
          if (fs < 12)
            out.push(
              `${fs}px "${t.slice(0, 40)}" <${el.tagName.toLowerCase()} ${el.className.toString().slice(0, 60)}>`,
            )
        }
        return out.slice(0, 10)
      })
      expect(small, 'text nodes smaller than 12px').toEqual([])
    })
  }
})

test.describe('QA G5 lookups, counts, PKSK', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test('E2E-M04-59 S5/S8/S11 selects equal GET /api/subjects and education-levels (AC-29.4)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/import')
    await expect(byId(page, 'import-default-subject').locator('option')).toHaveCount(32)
    const s1Names = (await byId(page, 'import-default-subject').locator('option').allInnerTexts())
      .slice(1)
      .map((x) => x.trim())
    expect(s1Names).toHaveLength(31)

    // PO: /admin/structured-questions is retired; its Subjek filter is the Subjektif lane filter (lane-subject).
    await gotoApp('/admin/spm/subjektif')
    // Source rule: mock handlers/servability-lanes.ts:82-86 (active M03 subjects ordered by sort_order, data/curriculum.json subjects[].sort_order 1..31); http servability.controller.ts:104.
    // The 31 active subjects, in sort_order (not alphabetical), are the same set as GET /api/subjects (s1Names).
    await expect(byId(page, 'lane-subject').locator('option')).toHaveText([
      'Semua Subjek',
      'Bahasa Melayu',
      'Bahasa Inggeris',
      'Matematik',
      'Sains',
      'Sejarah',
      'Pendidikan Islam',
      'Pendidikan Moral',
      'Matematik Tambahan',
      'Fizik',
      'Kimia',
      'Biologi',
      'Geografi',
      'Pendidikan Seni Visual',
      'Pendidikan Muzik',
      'Pendidikan Jasmani & Kesihatan',
      'Reka Bentuk & Teknologi',
      'Sains Komputer',
      'Bahasa Arab',
      'Bahasa Cina',
      'Bahasa Tamil',
      'Prinsip Perakaunan',
      'Ekonomi',
      'Perniagaan',
      'Pendidikan Al-Quran & As-Sunnah',
      'Tasawwur Islam',
      'Jawi',
      'Pendidikan Syariah Islamiah',
      'Sains Rumah Tangga',
      'Pembuatan Pakaian Wanita',
      'Pertanian',
      'Sains Sukan',
    ])
    const laneNames = (await byId(page, 'lane-subject').locator('option').allInnerTexts()).slice(1).map((s) => s.trim())
    expect([...laneNames].sort()).toEqual([...s1Names].sort())

    await gotoApp('/admin/soalan-gambar')
    await expect(byId(page, 'diagrams-subject').locator('option')).toHaveCount(32)
    const dNames = (await byId(page, 'diagrams-subject').locator('option').allInnerTexts())
      .slice(1)
      .map((s) => s.trim())
    expect(dNames).toEqual([...dNames].sort((a, b) => a.localeCompare(b, 'ms')))
  })

  test('E2E-M04-57 counts agree: S11 diagram audit 6,144 / 522 / 6,666 (AC-29.3)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/soalan-gambar')
    await expect(page.getByTestId('diagrams-stat-mcq').locator('.tabular')).toHaveText('6,144')
    await expect(page.getByTestId('diagrams-stat-structured').locator('.tabular')).toHaveText('522')
    await expect(page.getByTestId('diagrams-stat-total').locator('.tabular')).toHaveText('6,666')
  })

})

test.describe('QA G5 Studio is server-only in the mock', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test('E2E-M04-57 /admin/questions shows the STUDIO_UNAVAILABLE placeholder (studio.ts:26)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions')
    await expect(page.getByText('Studio hanya tersedia apabila sistem disambungkan ke pelayan sebenar.')).toBeVisible()
  })
})

test.describe('QA G5 user-portal nav and S11 badge', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test('E2E-M04-55 Portal Pentadbiran menu entries (AC-28.4)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/master-notes')
    if (!isDesktopShell(page)) await byId(page, 'pentadbiran-menu-button').click()
    const nav = page.locator('[data-testid="pentadbiran-nav"]:visible')
    await expect(nav).toBeVisible()
    await expect(nav.locator('a[href="/admin/question-reports"]').first()).toContainText(
      'Laporan Soalan',
    )
    await expect(nav.locator('a[href="/admin/soalan-gambar"]').first()).toContainText('Audit Rajah')
    await expect(nav.locator('a[href="/admin/questions/quality"]').first()).toContainText(
      'Kualiti Soalan',
    )
  })

  test('E2E-M04-55 Kertas Soalan Guru is reached through Import & Semakan, tab Kiriman Guru', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions')
    if (!isDesktopShell(page)) await byId(page, 'pentadbiran-menu-button').click()
    const nav = page.locator('[data-testid="pentadbiran-nav"]:visible')
    await nav.locator('a[href="/admin/spm/soalan/ekstrak"]').first().click()
    await expect(page).toHaveURL(/\/admin\/spm\/soalan\/ekstrak/)
    await byId(page, 'import-tab-kiriman').click()
    await expect(page).toHaveURL(/\/admin\/question-submissions$/)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Kertas Soalan Guru')
  })

  test('E2E-M04-55 menu link Semakan Nota Master (R1 out of scope: M25 Pusat AI)', async () => {
    test.skip(true, 'R1 out of scope: M25 Semakan Nota Master not in menu (SCOPE-STATUS.md)')
  })

  test('E2E-M04-51 dismissing a diagram question lowers the MCQ diagram count by 1 (AC-26.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/soalan-gambar')
    const card = page.locator('[data-kind="mcq"][data-question-id]').first()
    await expect(card).toBeVisible()
    await card.getByTestId('diagram-dismiss').click()
    await expect(page.getByTestId('diagrams-stat-mcq').locator('.tabular')).toHaveText('6,143')
  })
})

test.describe('QA G5 S8/S9 details', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  // PO: /admin/structured-questions is retired and redirects to the Subjektif lane. Retired with /admin/structured-questions (PO):
  // the "Tambah Soalan" link, the Jumlah Soalan / Diluluskan tiles, the KBAT and Tahap filters, the subject pills and the
  // "Menunjukkan 1-25 daripada 4,064 soalan" counter. The lane has none of them (LaneSubjektifPage.vue, LaneShell.vue).
  test('E2E-M04-45 S8 header copy, filter options, redirect from the retired route (AC-22.1, 22.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/structured-questions')
    await expect(page).toHaveURL(/\/admin\/spm\/subjektif$/)
    await expect(page.getByRole('heading', { name: 'Subjektif' }).first()).toBeVisible()
    await expect(page.getByText('Soalan berstruktur dan esei.')).toBeVisible()
    await expect(page.locator('a[href*="soalan-berstruktur"]')).toHaveCount(0)
    await expect(byId(page, 'lane-count')).toHaveText('4,064 item ·')
    const status = (await byId(page, 'lane-status').locator('option').allInnerTexts()).map((s) => s.trim())
    expect(status).toEqual(['Semua Status', 'Draf', 'Menunggu Semakan', 'Diluluskan', 'Diarkibkan'])
    // Source rule: mock handlers/servability-lanes.ts:82-86 (active M03 subjects ordered by sort_order, data/curriculum.json subjects[].sort_order 1..31); http servability.controller.ts:104.
    await expect(byId(page, 'lane-subject').locator('option')).toHaveText([
      'Semua Subjek',
      'Bahasa Melayu',
      'Bahasa Inggeris',
      'Matematik',
      'Sains',
      'Sejarah',
      'Pendidikan Islam',
      'Pendidikan Moral',
      'Matematik Tambahan',
      'Fizik',
      'Kimia',
      'Biologi',
      'Geografi',
      'Pendidikan Seni Visual',
      'Pendidikan Muzik',
      'Pendidikan Jasmani & Kesihatan',
      'Reka Bentuk & Teknologi',
      'Sains Komputer',
      'Bahasa Arab',
      'Bahasa Cina',
      'Bahasa Tamil',
      'Prinsip Perakaunan',
      'Ekonomi',
      'Perniagaan',
      'Pendidikan Al-Quran & As-Sunnah',
      'Tasawwur Islam',
      'Jawi',
      'Pendidikan Syariah Islamiah',
      'Sains Rumah Tangga',
      'Pembuatan Pakaian Wanita',
      'Pertanian',
      'Sains Sukan',
    ])
    await expect(page.getByRole('button', { name: 'Set Semula' }).first()).toBeVisible()
  })

  // Retired with /admin/structured-questions (PO): the KBAT pill, the "Balik ke Senarai" button and the id pill; the editor has none.
  test('E2E-M04-47 S9: the Subjektif editor shows the question parts, links the lane back, no M10 edit link (AC-23.1, 23.3)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/structured-questions/3698')
    await expect(page).toHaveURL(/\/admin\/spm\/subjektif\/3698\/sunting$/)
    await expect(byId(page, 'rubric-meta')).toHaveText('Soalan #3698 · Sejarah · Tingkatan 5 · 10 markah')
    // The M10 edit form exists only for the teacher's own submissions (g{n}): no link on an approved question.
    await expect(page.locator('a[href*="soalan-berstruktur"]')).toHaveCount(0)
    await expect(byId(page, 'rubric-back')).toContainText('Kembali ke Subjektif')
    await expect(byId(page, 'rubric-back')).toHaveAttribute('href', '/admin/spm/subjektif')
    const lab = await byId(page, 'rubric-sub-number').allInnerTexts()
    expect(lab.map((s) => s.trim())).toEqual(['a', 'b', 'c'])
    await expectNoHorizontalScroll(page)
  })
})
