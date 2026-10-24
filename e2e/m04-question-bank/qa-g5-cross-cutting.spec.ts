/**
 * M04 G5 QA specs (written by QA): responsive sweep and 12px text rule over every built M04 route,
 * lookups, counts (D11), PKSK, user-portal nav, structured list/detail details.
 * Covers AC-M04-22.x, 23.x, 28.4, 29.3, 29.4, 30.1, 30.6, 32.x, 26.2.
 */

import type { Page } from '@playwright/test'

import { waitForApp } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, isDesktopShell, moduleTag } from '../support'

const ADMIN = 'admin@demo.test'
const byId = (page: Page, id: string) => page.getByTestId(id)

const ROUTES: Array<[string, string]> = [
  ['S1', '/admin/questions'],
  ['S1 filtered archived', '/admin/questions?status=archived&page=2'],
  ['S1 empty', '/admin/questions?search=zzqxv'],
  ['S2', '/admin/questions/create'],
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

  test('E2E-M04-59 S1/S2/S5/S8/S11 selects equal GET /api/subjects and education-levels (AC-29.4)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions')
    await expect(byId(page, 'questions-subject').locator('option')).toHaveCount(32)
    const subjOpts = await byId(page, 'questions-subject')
      .locator('option')
      .evaluateAll((els) => els.slice(1).map((o) => Number((o as HTMLOptionElement).value)))
    expect(subjOpts).toHaveLength(31)
    expect(subjOpts).toEqual([...subjOpts].sort((a, b) => a - b))
    const lvOpts = await byId(page, 'questions-level')
      .locator('option')
      .evaluateAll((els) => els.slice(1).map((o) => Number((o as HTMLOptionElement).value)))
    expect(lvOpts).toHaveLength(11)
    expect(lvOpts).toEqual([...lvOpts].sort((a, b) => a - b))
    const s1Names = (await byId(page, 'questions-subject').locator('option').allInnerTexts())
      .slice(1)
      .map((x) => x.trim())

    await gotoApp('/admin/questions/create')
    await expect(byId(page, 'q-subject').locator('option')).toHaveCount(32)
    expect(
      (await byId(page, 'q-subject').locator('option').allInnerTexts())
        .slice(1)
        .map((x) => x.trim()),
    ).toEqual(s1Names)
    await gotoApp('/admin/questions/import')
    await expect(byId(page, 'import-default-subject').locator('option')).toHaveCount(32)
    expect(
      (await byId(page, 'import-default-subject').locator('option').allInnerTexts())
        .slice(1)
        .map((x) => x.trim()),
    ).toEqual(s1Names)

    await gotoApp('/admin/structured-questions')
    await expect(byId(page, 'structured-subject').locator('option')).toHaveCount(32)
    const sNames = (await byId(page, 'structured-subject').locator('option').allInnerTexts())
      .slice(1)
      .map((s) => s.trim())
    expect(sNames).toEqual([...sNames].sort((a, b) => a.localeCompare(b, 'ms')))
    expect([...sNames].sort()).toEqual([...s1Names].sort())

    await gotoApp('/admin/soalan-gambar')
    await expect(byId(page, 'diagrams-subject').locator('option')).toHaveCount(32)
    const dNames = (await byId(page, 'diagrams-subject').locator('option').allInnerTexts())
      .slice(1)
      .map((s) => s.trim())
    expect(dNames).toEqual([...dNames].sort((a, b) => a.localeCompare(b, 'ms')))
  })

  test('E2E-M04-57 counts agree: S1 total, tiles, S6, status split, Prinsip Perakaunan, S8, S11 (AC-29.3)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions')
    await expect(byId(page, 'questions-total')).toHaveText('Jumlah: 465,278 soalan')
    const tile = byId(page, 'questions-tile').filter({ hasText: /Prinsip Pera/ })
    await expect(tile).toContainText('2,970 lulus')
    await gotoApp('/admin/questions?status=approved')
    await expect(byId(page, 'questions-pager')).toBeVisible()
    await gotoApp('/admin/questions/quality')
    await expect(byId(page, 'kpi-total-value')).toHaveText('465,278')
    await gotoApp('/admin/structured-questions')
    await expect(byId(page, 'structured-stat-total-value')).toHaveText('4,064')
    await gotoApp('/admin/soalan-gambar')
    await expect(byId(page, 'diagrams-stat-mcq-value')).toHaveText('6,144')
    await expect(byId(page, 'diagrams-stat-structured-value')).toHaveText('522')
    await expect(byId(page, 'diagrams-stat-total-value')).toHaveText('6,666')
  })

  test('E2E-M04-57 status split 146,330 approved / 318,948 archived (AC-29.3)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions?status=approved')
    await expect(byId(page, 'question-row').first()).toBeVisible()
    const pg = byId(page, 'questions-pager')
    if (await pg.getByText(/Showing/).count()) await expect(pg).toContainText('of 146330 results')
    else {
      // mobile pager has no total: read it through the API
      const total = await page.evaluate(async () => {
        const r = await (await fetch('/api/questions?status=approved&page=1')).json()
        return r?.meta?.totalItems ?? r?.meta?.total ?? null
      })
      expect(total).toBe(146330)
    }
  })

  test('E2E-M04-62 PKSK: search finds no PKSK rows; S3 of 177698 shows text and "-" subject/level (AC-32.1, 32.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/177698')
    await expect(byId(page, 'question-text')).toBeVisible()
    const text = (await byId(page, 'question-text').innerText()).trim()
    expect(text.length).toBeGreaterThan(5)
    await expect(byId(page, 'info-subject')).toHaveText('-')
    await expect(byId(page, 'info-level')).toHaveText('-')
    await expectNoHorizontalScroll(page)
    await gotoApp(`/admin/questions?search=${encodeURIComponent(text.slice(0, 40))}`)
    await expect(byId(page, 'questions-empty')).toContainText('Tiada soalan dijumpai')
  })
})

test.describe('QA G5 PKSK anchor ids', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  for (const id of ['178460', '178000']) {
    test(`E2E-M04-62 S3 of PKSK id ${id} opens (AC-32.2)`, async ({ page, loginAs, gotoApp }) => {
      await loginAs(ADMIN)
      await gotoApp(`/admin/questions/${id}`)
      await expect(byId(page, 'question-detail-page')).toBeVisible()
      await expect(byId(page, 'question-text')).toBeVisible()
    })
  }
})

test.describe('QA G5 user-portal nav and S11 badge', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test('E2E-M04-55 user-portal sidebar entries (desktop) (AC-28.4)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(!isDesktopShell(page), 'sidebar is desktop only; drawer checked below')
    await loginAs(ADMIN)
    await gotoApp('/admin/master-notes')
    const sb = byId(page, 'shell-user-sidebar')
    await expect(sb).toContainText(/Kawalan Kualiti/i)
    await expect(sb.locator('a[href="/admin/master-notes"]')).toContainText('Semakan Nota Master')
    await expect(sb.locator('a[href="/laporan-soalan"]')).toContainText('Laporan Soalan')
    await expect(sb.locator('a[href="/admin/question-submissions"]')).toContainText(
      'Kertas Soalan Guru',
    )
    await expect(sb.locator('a[href="/admin/soalan-gambar"]')).toContainText('Gambar Rajah')
    await expect(sb.locator('a[href="/admin/soalan-gambar"]')).toContainText('6,144')
  })

  test('E2E-M04-55 mobile drawer shows the two M04 entries (AC-28.4)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(isDesktopShell(page), 'drawer is below 1024')
    await loginAs(ADMIN)
    await gotoApp('/admin/master-notes')
    await byId(page, 'shell-user-bottom-nav').getByText('Lagi').click()
    const dr = byId(page, 'shell-user-drawer')
    await expect(dr.locator('a[href="/admin/master-notes"]')).toContainText('Semakan Nota Master')
    await expect(dr.locator('a[href="/laporan-soalan"]')).toContainText('Laporan Soalan')
    await expect(dr.locator('a[href="/admin/question-submissions"]')).toHaveCount(0)
    await expect(dr.locator('a[href="/admin/soalan-gambar"]')).toHaveCount(0)
  })

  test('E2E-M04-51 dismissing a diagram question lowers the "Gambar Rajah" badge by 1 (AC-26.2, 28.4)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    test.skip(!isDesktopShell(page), 'badge is on the desktop user sidebar')
    await loginAs(ADMIN)
    await gotoApp('/admin/soalan-gambar')
    const card = page.locator('[data-kind="mcq"][data-question-id]').first()
    await expect(card).toBeVisible()
    await card.getByTestId('diagram-dismiss').click()
    await expect(byId(page, 'diagrams-stat-mcq-value')).toHaveText('6,143')
    await page.goto('/admin/master-notes')
    await waitForApp(page, 90_000)
    const badge = byId(page, 'shell-user-sidebar').locator('a[href="/admin/soalan-gambar"]')
    await expect(badge).toContainText('6,143')
  })
})

test.describe('QA G5 S8/S9 details', { tag: [moduleTag(4), '@qa'] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.setTimeout(150_000)

  test('E2E-M04-45 S8 header copy, add link, filter options, pills alphabetical (AC-22.1, 22.2)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/structured-questions')
    await expect(page.getByRole('heading', { name: 'Soalan Berstruktur' }).first()).toBeVisible()
    await expect(page.getByText('Semua soalan berstruktur SPM dalam sistem')).toBeVisible()
    await expect(byId(page, 'structured-add')).toHaveAttribute(
      'href',
      '/guru/soalan-berstruktur/cipta',
    )
    await expect(byId(page, 'structured-stat-total')).toContainText('Jumlah Soalan')
    await expect(byId(page, 'structured-stat-published')).toContainText('Diterbitkan')
    const kbat = (await byId(page, 'structured-kbat').locator('option').allInnerTexts()).map((s) =>
      s.trim(),
    )
    expect(kbat).toEqual([
      'Semua KBAT',
      'Memahami (L2)',
      'Mengaplikasi (L3)',
      'Menganalisis (L4)',
      'Menilai/Mencipta (L5)',
    ])
    await expect(byId(page, 'structured-level').locator('option')).toHaveCount(12)
    await expect(byId(page, 'structured-reset')).toHaveCount(0)
    const pills = (await byId(page, 'structured-subject-pill').allInnerTexts()).map((s) => s.trim())
    expect(pills.length).toBeGreaterThan(5)
    const names = pills.map((p) => (p.split(':')[0] ?? '').trim())
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'ms')))
    for (const p of pills) expect(p).toMatch(/^.+:\s*[\d,]+$/)
    await expect(byId(page, 'structured-counter')).toContainText(
      'Menunjukkan 1–25 daripada 4,064 soalan',
    )
  })

  test('E2E-M04-47 S9: edit link goes to the M10 route, back link returns (AC-23.1, 23.3)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/structured-questions/3698')
    await expect(byId(page, 'structured-id')).toContainText('ID: #3698')
    await expect(byId(page, 'structured-pill-marks')).toContainText('Markah')
    await expect(byId(page, 'structured-pill-kbat')).toContainText('KBAT:')
    await expect(byId(page, 'structured-subs-heading')).toContainText(
      'Bahagian Soalan (3 sub-soalan)',
    )
    await expect(byId(page, 'structured-edit')).toHaveAttribute(
      'href',
      '/guru/soalan-berstruktur/3698/edit',
    )
    await expect(byId(page, 'structured-back-list')).toContainText('Balik ke Senarai')
    await expect(byId(page, 'structured-back')).toContainText('Kembali ke senarai')
    const lab = await byId(page, 'structured-sub-label').allInnerTexts()
    expect(lab.map((s) => s.trim())).toEqual(['3(A)', '3(B)', '3(C)'])
    await expectNoHorizontalScroll(page)
  })
})
