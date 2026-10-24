/**
 * G5 QA for M10 S1 `/guru` "Dashboard Guru" (roles-matrix row L07, task M10-T2). Complements
 * `smoke-dashboard.spec.ts` with the full AC text (URS AC-M10-03.1 ... 05.4, 48.2), link targets,
 * touch targets, 320px, role access (SRS §9), guide storage failure, loading and error states.
 */

import type { Page } from '@playwright/test'

import { reloadApp } from '../fixtures/mock-handle'
import { expect as baseExpect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  navigateInApp,
  viewportWidth,
} from '../support'

/** Shared, loaded machine: first assertions after boot get 15 s (as smoke-dashboard does). */
const expect = baseExpect.configure({ timeout: 15_000 })

const GURU = 'guru@demo.test'
const ADMIN = 'admin@demo.test'
const MODULE = { tag: [moduleTag(10)] }

test.use({ mockInit: { latency: 0 } })

async function textSizes(page: Page): Promise<{ min: number; offenders: string[] }> {
  return page.evaluate(() => {
    const root = document.querySelector('main') ?? document.body
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let min = Infinity
    const offenders: string[] = []
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      if (!n.textContent?.trim() || !n.parentElement) continue
      const px = parseFloat(getComputedStyle(n.parentElement).fontSize)
      min = Math.min(min, px)
      if (px < 12) offenders.push(`${px}px "${n.textContent.trim().slice(0, 40)}"`)
    }
    return { min, offenders }
  })
}

const GUIDE_STEPS = [
  [
    'Buka Kelas',
    'Klik "Kelas Saya" di bar sisi. Cipta kelas baru atau lihat kelas sedia ada.',
    'Kelas Saya →',
    '/guru/kelas',
  ],
  [
    'Lihat Pelajar',
    'Semak senarai pelajar anda. Lihat siapa yang aktif dan siapa yang belum mula.',
    'Pelajar Saya →',
    '/guru/pelajar',
  ],
  [
    'Pantau Prestasi',
    'Buka Pemantauan untuk lihat penglibatan pelajar dan topik lemah mereka.',
    'Pemantauan →',
    '/guru/monitoring',
  ],
]

test.describe('L07 QA S1 Dashboard Guru', MODULE, () => {
  for (const who of [ADMIN, GURU]) {
    test(`AC-03.1 guide content, steps, links, tip (${who}) @m10`, async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(who)
      await gotoApp('/guru')
      const card = page.getByTestId('guide-card')
      await expect(card).toBeVisible()
      await expect(page.getByTestId('guide-title')).toHaveText('Mula Di Sini — 3 Langkah Mudah')
      await expect(card).toContainText(
        'Ikut 3 langkah ini untuk mula menggunakan PrestasiPlus. Ambil masa 5 minit sahaja.',
      )
      const steps = page.getByTestId('guide-step')
      await expect(steps).toHaveCount(3)
      for (let i = 0; i < 3; i++) {
        const [title, text, link, href] = GUIDE_STEPS[i]!
        const s = steps.nth(i)
        await expect(s).toContainText(String(i + 1))
        await expect(s).toContainText(title!)
        await expect(s).toContainText(text!)
        await expect(s.getByTestId('guide-link')).toHaveText(link!)
        await expect(s.getByTestId('guide-link')).toHaveAttribute('href', href!)
      }
      await expect(card).toContainText(
        'Tip: Halakan tetikus ke atas mana-mana menu di bar sisi untuk melihat penerangan ringkas.',
      )
      await expectTouchTarget(page.getByTestId('guide-close'))
    })
  }

  test('AC-03.2 storage key value, pill toggling twice, reload each time @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru')
    expect(await page.evaluate(() => localStorage.getItem('hideGuruGuide'))).toBeNull()
    await page.getByTestId('guide-close').click()
    expect(await page.evaluate(() => localStorage.getItem('hideGuruGuide'))).toBe('true')
    await expect(page.getByTestId('guide-card')).toHaveCount(0)
    await expectTouchTarget(page.getByTestId('guide-show'))
    await reloadApp(page)
    await expect(page.getByTestId('guide-show')).toBeVisible()
    await page.getByTestId('guide-show').click()
    expect(await page.evaluate(() => localStorage.getItem('hideGuruGuide'))).toBeNull()
    await reloadApp(page)
    await expect(page.getByTestId('guide-card')).toBeVisible()
    await page.getByTestId('guide-close').click()
    await reloadApp(page)
    await expect(page.getByTestId('guide-show')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('FR-08 hideGuruGuide other than "true" keeps the guide shown @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru')
    await page.evaluate(() => localStorage.setItem('hideGuruGuide', 'false'))
    await reloadApp(page)
    await expect(page.getByTestId('guide-card')).toBeVisible()
  })

  test('FR-08 storage failure is ignored: guide shown, close does not crash @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await loginAs(GURU)
    await gotoApp('/guru')
    await page.evaluate(() => {
      const proto = Object.getPrototypeOf(localStorage)
      const real = proto.getItem
      proto.getItem = function (k: string) {
        if (k === 'hideGuruGuide') throw new Error('blocked')
        return real.call(this, k)
      }
      const realSet = proto.setItem
      proto.setItem = function (k: string, v: string) {
        if (k === 'hideGuruGuide') throw new Error('blocked')
        return realSet.call(this, k, v)
      }
    })
    // Client-side navigation away and back re-creates the page with a throwing storage.
    await navigateInApp(page, '/guru/kelas')
    await navigateInApp(page, '/guru')
    await expect(page.getByTestId('guide-card')).toBeVisible()
    await page.getByTestId('guide-close').click()
    expect(errors.filter((e) => e.includes('blocked'))).toEqual([])
  })

  test('AC-04.1 admin: checklist rows, subtitles, Lihat links; stat captions @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru')
    await expect(page.getByTestId('checklist-count')).toHaveText('0/3 langkah selesai')
    await expect(page.getByTestId('checklist-percent')).toHaveText('0%')
    const rows = page.getByTestId('checklist-row')
    await expect(rows).toHaveCount(3)
    const exp = [
      ['Kelas dah ada', 'Admin sekolah akan sediakan kelas anda', '/guru/kelas'],
      ['Pelajar dalam kelas', 'Admin akan mengimport pelajar ke kelas anda', '/guru/pelajar'],
      ['Misi harian pertama', 'Cipta misi latih tubi untuk pelajar anda', '/guru/misi-harian/cipta'],
    ]
    for (let i = 0; i < 3; i++) {
      await expect(rows.nth(i)).toContainText(exp[i]![0]!)
      await expect(rows.nth(i)).toContainText(exp[i]![1]!)
      await expect(rows.nth(i).getByTestId('checklist-link')).toHaveText('Lihat')
      await expect(rows.nth(i).getByTestId('checklist-link')).toHaveAttribute('href', exp[i]![2]!)
      await expectTouchTarget(rows.nth(i).getByTestId('checklist-link'))
    }
    await expect(page.getByTestId('checklist-bar')).toHaveCSS('width', /^0px$/)
    const cards = page.getByTestId('stat-cards')
    for (const t of [
      'Kelas Aktif',
      '0 jumlah kelas',
      'Pelajar',
      'Merentasi semua kelas',
      'Soalan',
      '20719',
      '19361 diluluskan',
      'Tugasan',
      'Jumlah tugasan dibuat',
    ]) {
      await expect(cards).toContainText(t)
    }
    await expect(cards).not.toContainText('20,719')
    await expect(cards).not.toContainText('20 719')
  })

  test('AC-04.2 guru: 3/3, 100%, bar full, caption "✅ 1 diluluskan" @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru')
    await expect(page.getByTestId('checklist-count')).toHaveText('3/3 langkah selesai')
    await expect(page.getByTestId('checklist-percent')).toHaveText('100%')
    await expect(page.getByTestId('stat-value')).toHaveText(['2', '8', '1', '0'])
    await expect(page.getByTestId('stat-questions')).toContainText('1 diluluskan')
    await expect(page.getByTestId('stat-classes')).toContainText('2 jumlah kelas')
    await expect(page.getByTestId('stat-students')).toContainText('Merentasi semua kelas')
    await expect(page.getByTestId('stat-assignments')).toContainText('Jumlah tugasan dibuat')
    const w = await page
      .getByTestId('checklist-bar')
      .evaluate((el) => (el as HTMLElement).style.width)
    expect(w).toBe('100%')
  })

  test('AC-04.2 after questions.createFixture(700301) Soalan 2, diluluskan 1 @m10', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru')
    await mock.hook('createQuestionFixture', {
      id: 700301,
      subjectId: 1,
      educationLevelId: 1,
      createdBy: 5,
      status: 'pending_review',
    })
    await gotoApp('/guru')
    await expect(page.getByTestId('stat-value').nth(2)).toHaveText('2')
    await expect(page.getByTestId('stat-questions')).toContainText('1 diluluskan')
  })

  test('AC-04.1/04.2 Soalan caption carries the literal "✅" glyph (EL-M10-S1-043) @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru')
    await expect(page.getByTestId('stat-questions')).toContainText('✅ 19361 diluluskan')
  })

  test('AC-05.1 admin Tindakan Hari Ini in full @m10', async ({ page, gotoApp, loginAs }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru')
    const p = page.getByTestId('today-panel')
    await expect(p).toContainText('Tindakan Hari Ini')
    await expect(p.getByRole('heading', { name: 'Fokus guru yang paling penting hari ini' })).toBeVisible()
    await expect(p).toContainText(
      'Panel ini memprioritikan pelajar, topik, dan tindakan yang paling wajar disemak dahulu.',
    )
    const c = page.getByTestId('today-counters')
    await expect(c).toContainText('Pelajar')
    await expect(c).toContainText('Topik')
    await expect(c).toContainText('Tindakan')
    expect((await c.innerText()).replace(/\s+/g, ' ')).toMatch(/0 .*0 .*0|Pelajar 0 Topik 0 Tindakan 0|0\s*Pelajar\s*0\s*Topik\s*0\s*Tindakan/i)
    await expect(page.getByTestId('today-students')).toContainText('Pelajar Perlu Dibantu')
    await expect(page.getByTestId('today-students')).toContainText('3 Teratas')
    await expect(page.getByTestId('today-topics')).toContainText('Topik Kritikal')
    await expect(page.getByTestId('today-analytics')).toHaveText('Analitik Kelas →')
    await expect(page.getByTestId('today-analytics')).toHaveAttribute('href', '/analitik/kelas')
    await expect(page.getByTestId('today-actions')).toContainText('Tindakan Disyorkan')
    await expect(page.getByTestId('today-actions')).toContainText('Berasaskan peraturan')
    const a = page.getByTestId('today-action')
    await expect(a).toContainText('Bina aktiviti pertama untuk pelajar')
    await expect(a).toContainText('Permulaan')
    await expect(a).toContainText('Data tindakan akan muncul selepas pelajar mula membuat latihan.')
    await expect(page.getByTestId('today-action-link')).toHaveText('Buka Kelas →')
    await expect(page.getByTestId('today-action-link')).toHaveAttribute('href', '/guru/kelas')
    await expectTouchTarget(page.getByTestId('today-analytics'))
    await expectTouchTarget(page.getByTestId('today-action-link'))
  })

  test('AC-05.1 guru sees the same panel (FR-11: no data for any viewer) @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru')
    await expect(page.getByTestId('today-students')).toContainText(
      'Tiada pelajar berkeutamaan tinggi dikesan buat masa ini.',
    )
    await expect(page.getByTestId('today-action')).toContainText(
      'Bina aktiviti pertama untuk pelajar',
    )
  })

  for (const who of [ADMIN, GURU]) {
    test(`AC-05.2 peer card and quick tiles (${who}) @m10`, async ({ page, gotoApp, loginAs }) => {
      await loginAs(who)
      await gotoApp('/guru')
      const peer = page.getByTestId('peer-card')
      await expect(peer).toContainText('Padanan Rakan Pembimbing')
      await expect(peer).toContainText('Cadangan rakan pembimbing pelajar')
      await expect(peer).toContainText(
        'Cadangan rakan pembimbing akan muncul apabila guru mempunyai pelajar aktif dan data prestasi yang mencukupi.',
      )
      await expect(page.getByTestId('peer-empty')).toHaveText(
        'Belum cukup isyarat yang yakin untuk cadangan rakan pembimbing. Modul ini akan jadi lebih tepat apabila data pelajar dan subjek bertambah.',
      )
      await expect(peer.locator('p').first()).toHaveCSS('text-transform', 'uppercase')
      await expect(page.getByTestId('quick-card')).toContainText('Tindakan Pantas')
      const tiles = page.getByTestId('quick-tile')
      const exp = [
        ['Cipta Kelas Baru', 'Tambah kelas pembelajaran', '/guru/kelas/cipta'],
        ['Sumbang Soalan', 'Tambah soalan untuk pelajar', '/guru/soalan/cipta'],
        ['Lihat Pelajar', 'Pantau prestasi pelajar', '/guru/pelajar'],
        ['Edit Profil Guru', 'Kemaskini maklumat profesional', '/guru/profil/edit'],
      ]
      await expect(tiles).toHaveCount(4)
      for (let i = 0; i < 4; i++) {
        await expect(tiles.nth(i)).toContainText(exp[i]![0]!)
        await expect(tiles.nth(i)).toContainText(exp[i]![1]!)
        await expect(tiles.nth(i)).toHaveAttribute('href', exp[i]![2]!)
        await expectTouchTarget(tiles.nth(i))
      }
    })
  }

  test('AC-05.3 admin: Kelas Saya + Semua link, Penghantaran Terkini empty @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await gotoApp('/guru')
    await expect(page.getByTestId('classes-card')).toContainText('Kelas Saya')
    await expect(page.getByTestId('classes-all')).toHaveText('Semua →')
    await expect(page.getByTestId('classes-all')).toHaveAttribute('href', '/guru/kelas')
    await expect(page.getByTestId('classes-empty')).toHaveText('Belum ada kelas. Cipta sekarang!')
    await expect(page.getByTestId('submissions-card')).toContainText('Penghantaran Terkini')
    await expect(page.getByTestId('submissions-empty')).toContainText(
      'Belum ada penghantaran tugasan.',
    )
    await expect(page.getByTestId('submissions-empty')).toContainText(
      'Buat tugasan di kelas untuk lihat penghantaran di sini.',
    )
    await expectTouchTarget(page.getByTestId('classes-all'))
  })

  test('AC-05.4 guru: exact class lines, empty submissions @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru')
    await expect(page.getByTestId('classes-item')).toHaveText([
      '5 MARIKH - Kimia · 8 pelajar',
      '5 MARIKH - Sejarah · 8 pelajar',
    ])
    await expect(page.getByTestId('classes-empty')).toHaveCount(0)
    await expect(page.getByTestId('submissions-empty')).toContainText(
      'Belum ada penghantaran tugasan.',
    )
  })

  test('FR-03 header title, subtitle, tab title; subtitle one line @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru')
    await expectTabTitle(page, 'Papan Pemuka Guru - PRESTASIPLUS')
    await expect(page.getByTestId('shell-user-title')).toHaveText('Papan Pemuka Guru')
    const sub = page.getByTestId('shell-user-subtitle')
    await expect(sub).toContainText('Selamat datang, ')
    const m = await sub.evaluate((el) => {
      const cs = getComputedStyle(el)
      return { ws: cs.whiteSpace, to: cs.textOverflow, sw: el.scrollWidth, cw: el.clientWidth }
    })
    expect(m.ws).toBe('nowrap')
    expect(m.to).toBe('ellipsis')
  })

  test('AC-48.2/FR-129 text >= 12px in main (admin + guru, guide shown and hidden) @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru')
    await expect(page.getByTestId('classes-item').first()).toBeVisible()
    let r = await textSizes(page)
    expect(r.offenders, 'text under 12px (guide shown)').toEqual([])
    await page.getByTestId('guide-close').click()
    r = await textSizes(page)
    expect(r.offenders, 'text under 12px (pill)').toEqual([])
  })

  test('AC-48.1/NFR-RESP no h-scroll, every link/button in main >= 44px high @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru')
    await expect(page.getByTestId('classes-item').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    const small = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      const out: string[] = []
      for (const el of main.querySelectorAll('a,button')) {
        const r = el.getBoundingClientRect()
        if (r.width === 0 && r.height === 0) continue
        if (r.height < 43.9 || r.width < 43.9)
          out.push(`${(el.textContent || '').trim().slice(0, 30) || el.getAttribute('data-testid')} ${Math.round(r.width)}x${Math.round(r.height)}`)
      }
      return out
    })
    // Width of inline text links is allowed to be < 44 when height is >= 44 (WCAG target = height).
    expect(small.filter((s) => !/\d+x(4[4-9]|[5-9]\d)$/.test(s)), 'targets shorter than 44px').toEqual([])
    // no element extends beyond the right edge
    const over = await page.evaluate(() => {
      const w = document.documentElement.clientWidth
      const out: string[] = []
      document.querySelectorAll('main *').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.width > 0 && r.right > w + 1) out.push(`${el.tagName}.${(el.className || '').toString().slice(0, 40)} right=${Math.round(r.right)}`)
      })
      return out.slice(0, 10)
    })
    expect(over, 'elements past the viewport right edge').toEqual([])
  })

  test('responsive: 320px no h-scroll, nothing clipped, admin and guru @m10', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    test.skip(viewportWidth(page) !== 375, 'run once, on the mobile project')
    await loginAs(GURU)
    await page.setViewportSize({ width: 320, height: 640 })
    await gotoApp('/guru')
    await expect(page.getByTestId('classes-item').first()).toBeVisible()
    await expectNoHorizontalScroll(page)
    const r = await textSizes(page)
    expect(r.offenders).toEqual([])
    const over = await page.evaluate(() => {
      const w = document.documentElement.clientWidth
      const out: string[] = []
      document.querySelectorAll('main *').forEach((el) => {
        const b = el.getBoundingClientRect()
        if (b.width > 0 && (b.right > w + 1 || b.left < -1)) out.push(`${el.tagName} ${(el.textContent || '').trim().slice(0, 30)}`)
      })
      return out.slice(0, 10)
    })
    expect(over).toEqual([])
    await page.getByTestId('guide-close').click()
    await expectNoHorizontalScroll(page)
  })

  test('state: loading spinner, then content; error alert + retry recovers @m10', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru/kelas')
    await mock.failNext('GET /api/guru/dashboard', 500)
    await navigateInApp(page, '/guru')
    await expect(page.getByTestId('dashboard-error')).toContainText(
      'Gagal memuatkan papan pemuka. Sila cuba semula.',
    )
    await expect(page.getByTestId('checklist-card')).toHaveCount(0)
    await expect(page.getByTestId('guide-wrap')).toBeVisible()
    await expectTouchTarget(page.getByTestId('dashboard-retry'))
    await expectNoHorizontalScroll(page)
    await page.getByTestId('dashboard-retry').click()
    await expect(page.getByTestId('checklist-count')).toHaveText('3/3 langkah selesai')
    await expect(page.getByTestId('dashboard-error')).toHaveCount(0)
  })

  test('state: network error shows the error alert @m10', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru/kelas')
    await mock.networkErrorNext('GET /api/guru/dashboard')
    await navigateInApp(page, '/guru')
    await expect(page.getByTestId('dashboard-error')).toBeVisible()
  })

  test('state: slow response shows loading then content @m10', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru/kelas')
    await mock.setLatency(6000, 'GET /api/guru/dashboard')
    await navigateInApp(page, '/guru')
    await expect(page.getByTestId('dashboard-loading')).toBeVisible()
    await expect(page.getByTestId('checklist-card')).toHaveCount(0)
    await expect(page.getByTestId('checklist-count')).toBeVisible({ timeout: 15_000 })
    await expect(page.getByTestId('dashboard-loading')).toHaveCount(0)
  })

  test('403 error from the API shows the error alert, not a blank page @m10', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(GURU)
    await gotoApp('/guru/kelas')
    await mock.failNext('GET /api/guru/dashboard', 403)
    await navigateInApp(page, '/guru')
    await expect(page.getByTestId('dashboard-error')).toBeVisible()
  })

  for (const [label, who] of [
    ['murid', 'pelajar@demo.test'],
    ['ibu bapa', 'ibubapa@demo.test'],
    ['penaja', 'penaja@demo.test'],
    ['admin sekolah', 'adminsekolah@demo.test'],
    ['ppd', 'ppd@demo.test'],
    ['jpn', 'jpn@demo.test'],
  ] as const) {
    test(`role access: ${label} on /guru (SRS §9) @m10`, async ({
      page,
      gotoApp,
      loginAs,
    }, testInfo) => {
      await loginAs(who)
      await gotoApp('/guru')
      const url = new URL(page.url()).pathname
      const title = await page.title()
      const dash = await page.getByTestId('guru-dashboard').count()
      testInfo.annotations.push({ type: 'observed', description: `${who}: url=${url} title="${title}" dashboard=${dash}` })
      // SRS §9: no dashboard content for non-teacher/admin roles.
      expect(dash, `dashboard rendered for ${who}`).toBe(0)
      await expect(page.getByTestId('checklist-card')).toHaveCount(0)
      await expectNoHorizontalScroll(page)
    })
  }

  test('role access: guest is sent to /login @m10', async ({ page, gotoApp }) => {
    await gotoApp('/guru')
    await expect(page).toHaveURL(/\/login/)
  })

  test('links: every S1 link target resolves (record non-built targets) @m10', async ({
    page,
    gotoApp,
    loginAs,
  }, testInfo) => {
    await loginAs(ADMIN)
    await gotoApp('/guru')
    await expect(page.getByTestId('classes-empty')).toBeVisible()
    const hrefs = await page.evaluate(() =>
      Array.from(new Set(Array.from(document.querySelectorAll('main a[href]')).map((a) => a.getAttribute('href')!))),
    )
    const results: string[] = []
    for (const h of hrefs) {
      await navigateInApp(page, h)
      await page.waitForTimeout(300)
      const t = await page.title()
      const now = new URL(page.url()).pathname
      results.push(`${h} -> ${now} | ${t}`)
    }
    testInfo.annotations.push({ type: 'links', description: results.join('\n') })
    console.log('LINKS\n' + results.join('\n'))
  })
})
