/**
 * QA G5 (M07 PKSK, roles-matrix row L24 + the admin screens): access guards, the level gate, unknown
 * ids and the responsive sweep of every M07 route at 375 / 768 / 1280.
 *
 * Covers: AC-M07-22.1 / 22.2 (guest, role redirect, admin API 403), AC-M07-08.1 / 08.3 / 07.3 / 16.7
 * (gate and 404s, incl. malformed ids), AC-M07-20.x (who can open which level), AC-M07-24.1 / 24.5
 * (no horizontal scroll, text >= 12 px), CLAUDE.md section 7 (touch targets >= 44 px below lg) and
 * heading legibility on dark heroes.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import {
  actAs,
  expectNoHorizontalScroll,
  expectTabTitle,
  isDesktopShell,
  moduleTag,
  viewportWidth,
} from '../support'

const NOT_FOUND = 'Halaman Tidak Dijumpai | PRESTASIPLUS'
const MODULE = { tag: [moduleTag(7)] }
const LIST = '/admin/pksk/questions'
const tid = (page: Page, id: string) => page.getByTestId(id)

test.describe.configure({ timeout: 360_000 })
test.use({ mockInit: { latency: 0 } })

async function expectNotFound(page: Page, what: string): Promise<void> {
  await expect(page.locator('[data-page=not-found]'), what).toBeVisible()
  await expectTabTitle(page, NOT_FOUND)
}

const STUDENT_ROUTES = [
  '/pksk',
  '/pksk/level/T1',
  '/pksk/level/T4',
  '/pksk/level/T1/domains',
  '/pksk/level/T4/domains',
  '/pksk/level/T1/history',
  '/pksk/level/T4/history',
  '/pksk/level/T1/exam',
  '/pksk/level/T4/exam',
  '/pksk/level/T1/domain/PKSK_MATH',
  '/pksk/level/T4/domain/PKSK_ESSAY',
]
const ADMIN_ROUTES = [
  '/admin/pksk/questions',
  '/admin/pksk/questions/create',
  '/admin/pksk/questions/178460/edit',
  '/admin/pksk/access',
]

test.describe('QA-G5 M07 access guards', MODULE, () => {
  test('AC-22.1 a guest is sent to /login from all 15 M07 routes', async ({ page, gotoApp }) => {
    for (const path of [...STUDENT_ROUTES, ...ADMIN_ROUTES]) {
      await visit(page, gotoApp, path)
      await expect(page, path).toHaveURL(/\/login/)
    }
  })

  for (const who of [
    'pelajar@demo.test',
    'pelajar2@demo.test',
    'guru@demo.test',
    'ibubapa@demo.test',
    'adminsekolah@demo.test',
  ]) {
    test(`AC-22.2 ${who} never sees an admin PKSK screen`, async ({ page, gotoApp, mock }) => {
      await gotoApp('/login')
      for (const path of ADMIN_ROUTES) {
        if (path === ADMIN_ROUTES[0]) await actAs(page, mock, gotoApp, who, path)
        else await visit(page, gotoApp, path)
        const url = new URL(page.url())
        expect(url.pathname, `${who} on ${path} must be redirected away`).not.toMatch(/^\/admin\/pksk/)
        await expect(tid(page, 'pksk-questions-page'), `${who} ${path}`).toHaveCount(0)
        await expect(tid(page, 'pksk-access-page'), `${who} ${path}`).toHaveCount(0)
        await expect(tid(page, 'pksk-question-form'), `${who} ${path}`).toHaveCount(0)
      }
    })
  }

  test('AC-22.2 a student redirected from an admin PKSK screen sends no admin API request', async ({
    page,
    gotoApp,
    mock,
  }) => {
    // The API-level 403 for every /api/admin/pksk-* endpoint is asserted by the M07 mock tests
    // (src/modules/m07-pksk/__tests__/mock/admin.test.ts); the browser cannot call the in-process mock
    // directly, so here the guard is checked from the outside: no admin request leaves the page.
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, 'pelajar@demo.test', '/pksk')
    await expect(tid(page, 'pksk-hub')).toBeVisible()
    for (const path of ADMIN_ROUTES) {
      await visit(page, gotoApp, path)
      await expect(page, path).not.toHaveURL(/\/admin\/pksk/)
    }
    expect(await mock.requests('/api/admin/pksk*')).toHaveLength(0)
  })
})

test.describe('QA-G5 M07 level gate by account', MODULE, () => {
  const EXPECT: Array<[string, boolean, boolean]> = [
    // who, T1 open, T4 open
    ['pelajar@demo.test', true, true],
    ['pelajarmaju@demo.test', true, true],
    ['admin@demo.test', true, true],
    ['ibubapa@demo.test', true, true],
    ['pelajar2@demo.test', false, false],
    ['guru@demo.test', false, false],
    ['tidakaktif@demo.test', false, false],
  ]
  for (const [who, t1, t4] of EXPECT) {
    test(`AC-08.1 / 20.1 / 20.4 level access of ${who}: T1 ${String(t1)}, T4 ${String(t4)}`, async ({
      page,
      gotoApp,
      mock,
    }) => {
      await gotoApp('/login')
      await actAs(page, mock, gotoApp, who, '/pksk')
      for (const [lvl, open] of [
        ['T1', t1],
        ['T4', t4],
      ] as const) {
        await visit(page, gotoApp, `/pksk/level/${lvl}`)
        if (open) {
          await expect(page, `${who} ${lvl}`).toHaveURL(new RegExp(`/pksk/level/${lvl}$`))
          await expect(tid(page, 'pksk-dashboard'), `${who} ${lvl}`).toBeVisible()
        } else {
          await expect(page, `${who} ${lvl}`).not.toHaveURL(new RegExp(`/pksk/level/${lvl}`))
          await expect(tid(page, 'pksk-dashboard'), `${who} ${lvl}`).toHaveCount(0)
        }
      }
    })
  }

  test('AC-08.1 every level route of a no-access student is refused by the API (403) and redirected', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, 'pelajar2@demo.test', '/pksk')
    await expect(tid(page, 'pksk-hub')).toBeVisible()
    for (const [route, api] of [
      ['/pksk/level/T1', '/api/pksk/levels/T1/dashboard'],
      ['/pksk/level/T4', '/api/pksk/levels/T4/dashboard'],
      ['/pksk/level/T1/domains', '/api/pksk/levels/T1/domains'],
      ['/pksk/level/T1/history', '/api/pksk/levels/T1/exam-attempts'],
      ['/pksk/level/T1/domain/PKSK_MATH', '/api/pksk/levels/T1/domains/PKSK_MATH'],
      ['/pksk/level/T4/domain/PKSK_ESSAY', '/api/pksk/levels/T4/domains/PKSK_ESSAY'],
      ['/pksk/level/T1/exam', '/api/pksk/levels/T1/exam'],
      ['/pksk/level/T4/exam', '/api/pksk/levels/T4/exam'],
    ] as const) {
      await visit(page, gotoApp, route)
      await expect(page, route).toHaveURL(/\/pksk$/)
      await expect(page.getByRole('alert'), route).toHaveCount(0)
      expect((await mock.lastRequest('GET ' + api))?.status, `GET ${api}`).toBe(403)
    }
  })

  test('FR-19 the unknown-level 404 wins over the gate (no access user gets 404 for T9)', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, 'pelajar2@demo.test', '/pksk/level/T9')
    await expectNotFound(page, 'pelajar2 /pksk/level/T9')
    await gotoApp('/pksk/level/ALL/domains')
    await expectNotFound(page, 'pelajar2 /pksk/level/ALL/domains')
  })
})

test.describe('QA-G5 M07 unknown ids are the 404 page', MODULE, () => {
  test('AC-08.3 / 07.3 student: malformed level, code and sub-paths', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    for (const path of [
      '/pksk/level/t1', // case-sensitive (BR-M07-19)
      '/pksk/level/T9',
      '/pksk/level/ALL',
      '/pksk/level/T9/domains',
      '/pksk/level/T9/history',
      '/pksk/level/T9/exam',
      '/pksk/level/T1/domain/PKSK_XYZ',
      '/pksk/level/T1/domain/pksk_math', // codes are case-sensitive
      '/pksk/level/T1/domain/',
      '/pksk/level/T1/exam/extra',
      '/pksk/level/T1/domains/extra',
      '/pksk/level/T1/domain/PKSK_MATH/extra',
      '/pksk/foo',
    ]) {
      await visit(page, gotoApp, path)
      await expectNotFound(page, path)
      await expectNoHorizontalScroll(page)
    }
  })

  test('AC-16.7 / SRS section 2 admin: malformed or non-PKSK ids and unlinked paths', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    // An existing M04 (non-PKSK) question id, read from the M04 list.
    await gotoApp('/admin/questions')
    await expect(page.getByTestId('question-row').first()).toBeVisible()
    const m04Id = Number(await page.getByTestId('question-row').first().getAttribute('data-question-id'))
    expect(m04Id, 'an M04 question exists to use as a non-PKSK id').toBeGreaterThan(0)
    for (const path of [
      `/admin/pksk/questions/${String(m04Id)}/edit`, // SEC-M07-12: non-PKSK id
      '/admin/pksk/questions/99999999/edit',
      '/admin/pksk/questions/0/edit',
      '/admin/pksk/questions/abc/edit',
      '/admin/pksk/questions/-1/edit',
      '/admin/pksk/questions/1.5/edit',
      '/admin/pksk/questions/178460', // live 405 -> SPA 404
      '/admin/pksk',
      '/admin/pksk/packages',
      '/admin/pksk/domains',
      '/admin/pksk/access/1',
    ]) {
      await visit(page, gotoApp, path)
      await expectNotFound(page, path)
    }
  })

  test('SEC-M07-12 a non-PKSK question id is not editable as PKSK and the M04 question is untouched', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs('admin@demo.test')
    await gotoApp('/admin/questions')
    await expect(page.getByTestId('question-row').first()).toBeVisible()
    const id = Number(await page.getByTestId('question-row').first().getAttribute('data-question-id'))
    await gotoApp(`/admin/pksk/questions/${String(id)}/edit`)
    await expectNotFound(page, 'PKSK edit of an M04 id')
    await gotoApp(`/admin/questions/${String(id)}`)
    await expect(page.getByTestId('question-text')).toBeVisible()
    // A PKSK id in the M04 edit URL must not be treated as an M04 question to change either.
    await gotoApp(`${LIST}?search=`)
    await expect(tid(page, 'pksk-questions-table')).toBeVisible()
    await expect(page.getByTestId('stat-value').first()).toHaveText('763')
  })
})

// --- heading legibility on dark heroes ---------------------------------------------------------

/** WCAG relative luminance of a computed rgb()/rgba() colour string. */
function luminanceOf([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

test.describe('QA-G5 M07 heading legibility on dark heroes', MODULE, () => {
  const HEROES: Array<[string, string, string, string]> = [
    ['S1 hub banner', '/pksk', 'pksk-banner', 'pksk-hub'],
    ['S2 T1 readiness hero', '/pksk/level/T1', 'readiness', 'pksk-dashboard'],
    ['S2 T4 readiness hero', '/pksk/level/T4', 'readiness', 'pksk-dashboard'],
    ['S1 level cards', '/pksk', 'level-section', 'pksk-hub'],
  ]
  for (const [name, path, root, ready] of HEROES) {
    test(`AC-01.2 / 03.2 ${name}: every text in a gradient hero has contrast >= 3:1 with every stop`, async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp(path)
      await expect(tid(page, ready)).toBeVisible()
      const found = await tid(page, root).evaluate((rootEl) => {
        const parseRgb = (s: string): [number, number, number][] =>
          (s.match(/rgba?\(([^)]+)\)/g) ?? []).map((m) => {
            const n = m.replace(/rgba?\(|\)/g, '').split(/[ ,/]+/).map(Number)
            return [n[0] ?? 0, n[1] ?? 0, n[2] ?? 0]
          })
        const out: Array<{ text: string; color: [number, number, number]; stops: [number, number, number][] }> = []
        const walker = document.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT)
        for (let n = walker.nextNode(); n; n = walker.nextNode()) {
          const text = (n.textContent ?? '').trim()
          const el = n.parentElement
          if (!text || !el) continue
          const r = el.getBoundingClientRect()
          if (r.width === 0 || r.height === 0) continue
          let anc: HTMLElement | null = el
          let stops: [number, number, number][] = []
          while (anc && anc !== document.body) {
            const cs = getComputedStyle(anc)
            const bg = cs.backgroundImage
            // A solid, opaque background (e.g. the green "AKTIF" badge) is the text's own backdrop:
            // not a gradient hero, so it is out of this probe.
            if (!(bg && bg.includes('gradient')) && !/rgba\(.*, 0\)$|transparent/.test(cs.backgroundColor)) break
            if (bg && bg.includes('gradient')) {
              stops = parseRgb(bg)
              break
            }
            anc = anc.parentElement
          }
          if (stops.length === 0) continue
          const c = parseRgb(getComputedStyle(el).color)[0] ?? [0, 0, 0]
          out.push({ text: text.slice(0, 40), color: c, stops })
        }
        return out
      })
      // Hub level-section must have gradient tiles / buttons; the banner and hero must have text.
      expect(found.length, `${name}: gradient text nodes found`).toBeGreaterThan(0)
      const bad: string[] = []
      for (const t of found) {
        const lt = luminanceOf(t.color)
        for (const s of t.stops) {
          const ls = luminanceOf(s)
          const ratio = (Math.max(lt, ls) + 0.05) / (Math.min(lt, ls) + 0.05)
          if (ratio < 3) bad.push(`"${t.text}" rgb(${t.color.join(',')}) on rgb(${s.join(',')}) = ${ratio.toFixed(2)}`)
        }
      }
      expect(bad, `${name} low-contrast text`).toEqual([])
    })
  }
})

// --- responsive sweep --------------------------------------------------------------------------

interface Violation {
  kind: string
  detail: string
}

/** Text below 12 px and (below lg) touch targets below 44 px inside `main`. */
async function audit(page: Page): Promise<Violation[]> {
  const touch = !isDesktopShell(page)
  return page.locator('main').first().evaluate((main, checkTouch) => {
    const out: Array<{ kind: string; detail: string }> = []
    const visible = (el: Element) => {
      const r = (el as HTMLElement).getBoundingClientRect()
      const cs = getComputedStyle(el)
      return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none'
    }
    const walker = document.createTreeWalker(main, NodeFilter.SHOW_TEXT)
    let node: Node | null
    while ((node = walker.nextNode())) {
      const text = node.textContent?.trim()
      if (!text || /^[\p{Extended_Pictographic}\s️]+$/u.test(text)) continue
      const el = node.parentElement
      if (!el || !visible(el)) continue
      // Text inside a <select>/<option> is rendered by the browser at the control's size.
      if (el.tagName === 'OPTION') continue
      const size = Number.parseFloat(getComputedStyle(el).fontSize)
      if (size < 12) out.push({ kind: 'font', detail: `"${text.slice(0, 40)}" ${size}px` })
    }
    if (checkTouch) {
      const sel = 'a[href], button, select, input:not([type=hidden]), textarea, [role=button]'
      for (const el of Array.from(main.querySelectorAll(sel))) {
        if (!visible(el)) continue
        const cs = getComputedStyle(el)
        if (cs.position === 'absolute' && el.getBoundingClientRect().width < 2) continue
        if (el.tagName === 'A') {
          const p = el.parentElement
          if (p && ['P', 'LI', 'SPAN'].includes(p.tagName) && p.textContent!.trim() !== el.textContent!.trim()) {
            continue
          }
        }
        // A checkbox / radio wrapped by a <label> is operated through the label's box.
        let box = el.getBoundingClientRect()
        if (el.tagName === 'INPUT') {
          const label = el.closest('label')
          if (label) box = label.getBoundingClientRect()
        }
        if (box.width < 43.9 || box.height < 43.9) {
          const label = (el.getAttribute('data-testid') ?? el.textContent ?? '').trim().slice(0, 40)
          out.push({
            kind: 'touch',
            detail: `<${el.tagName.toLowerCase()}> ${label} ${Math.round(box.width)}x${Math.round(box.height)}`,
          })
        }
      }
    }
    return out
  }, touch)
}

interface SweepRoute {
  name: string
  path: string
  who: string
  ready: string
  /** Optional step after load (open a form, tick a row). */
  prep?: (page: Page) => Promise<void>
}

const SWEEP: SweepRoute[] = [
  { name: 'S1 hub', path: '/pksk', who: 'pelajar@demo.test', ready: 'pksk-hub' },
  { name: 'S1 hub (no access)', path: '/pksk', who: 'pelajar2@demo.test', ready: 'pksk-hub' },
  { name: 'S2 T1', path: '/pksk/level/T1', who: 'pelajar@demo.test', ready: 'mastery-section' },
  { name: 'S2 T4 (empty)', path: '/pksk/level/T4', who: 'pelajar@demo.test', ready: 'mastery-section' },
  { name: 'S3 T1', path: '/pksk/level/T1/domains', who: 'pelajar@demo.test', ready: 'section-B' },
  { name: 'S3 T4', path: '/pksk/level/T4/domains', who: 'pelajar@demo.test', ready: 'section-C' },
  { name: 'S4 T1 rows', path: '/pksk/level/T1/history', who: 'pelajar@demo.test', ready: 'history-table' },
  { name: 'S4 T4 empty', path: '/pksk/level/T4/history', who: 'pelajar@demo.test', ready: 'history-empty' },
  { name: 'S4a MATH', path: '/pksk/level/T1/domain/PKSK_MATH', who: 'pelajar@demo.test', ready: 'practice-submit' },
  { name: 'S4a ESSAY', path: '/pksk/level/T4/domain/PKSK_ESSAY', who: 'pelajar@demo.test', ready: 'practice-submit' },
  { name: 'S4b exam T1', path: '/pksk/level/T1/exam', who: 'pelajar@demo.test', ready: 'exam-submit' },
  { name: 'S5 list', path: '/admin/pksk/questions', who: 'admin@demo.test', ready: 'pksk-questions-table' },
  {
    name: 'S5 list with bulk bar',
    path: '/admin/pksk/questions',
    who: 'admin@demo.test',
    ready: 'pksk-questions-table',
    prep: async (page) => {
      await page.getByTestId('row-select').first().check()
      await expect(page.getByTestId('pksk-bulk-bar')).toBeVisible()
    },
  },
  { name: 'S5 last page', path: '/admin/pksk/questions?page=39', who: 'admin@demo.test', ready: 'pksk-questions-table' },
  { name: 'S5 empty', path: '/admin/pksk/questions?status=pending', who: 'admin@demo.test', ready: 'pksk-questions-empty' },
  { name: 'S6 create', path: '/admin/pksk/questions/create', who: 'admin@demo.test', ready: 'pksk-question-form' },
  {
    name: 'S6 create (B, 6 options)',
    path: '/admin/pksk/questions/create',
    who: 'admin@demo.test',
    ready: 'pksk-question-form',
    prep: async (page) => {
      await page.getByTestId('q-bahagian').selectOption('B')
      await page.getByTestId('option-add').click()
      await page.getByTestId('option-add').click()
      await expect(page.getByTestId('option-row')).toHaveCount(6)
    },
  },
  { name: 'S7 edit B', path: '/admin/pksk/questions/178460/edit', who: 'admin@demo.test', ready: 'pksk-question-form' },
  { name: 'S7 edit C', path: '/admin/pksk/questions/178349/edit', who: 'admin@demo.test', ready: 'pksk-question-form' },
  { name: 'S8 access', path: '/admin/pksk/access', who: 'admin@demo.test', ready: 'access-table' },
  {
    name: 'S8 access (grant form open)',
    path: '/admin/pksk/access',
    who: 'admin@demo.test',
    ready: 'access-table',
    prep: async (page) => {
      await page.getByTestId('grant-toggle').click()
      await expect(page.getByTestId('grant-form')).toBeVisible()
    },
  },
  { name: 'S8 empty', path: '/admin/pksk/access?search=zzzzqqq', who: 'admin@demo.test', ready: 'access-empty' },
]

test.describe('QA-G5 M07 responsive sweep', MODULE, () => {
  for (const r of SWEEP) {
    test(`AC-24.1 / 24.5 ${r.name} (${r.path}): no h-scroll, no text < 12 px, touch targets >= 44 px below lg`, async ({
      page,
      gotoApp,
      loginAs,
    }) => {
      await loginAs(r.who)
      await gotoApp(r.path)
      await expect(tid(page, r.ready).first()).toBeVisible({ timeout: 30_000 })
      if (r.prep) await r.prep(page)
      await expectNoHorizontalScroll(page)
      const violations = await audit(page)
      expect(
        violations,
        `${r.name} at ${String(viewportWidth(page))} px: ${violations.map((v) => `${v.kind}: ${v.detail}`).join(' | ')}`,
      ).toEqual([])
    })
  }

  test('the shell navigation reaches M07 on every width (user portal and admin)', async ({
    page,
    gotoApp,
    mock,
  }) => {
    await gotoApp('/login')
    await actAs(page, mock, gotoApp, 'pelajar@demo.test', '/pksk')
    await expect(tid(page, 'pksk-hub')).toBeVisible()
    if (isDesktopShell(page)) {
      await expect(tid(page, 'shell-user-sidebar').locator('[data-nav-id="pksk"]')).toBeVisible()
    } else {
      await tid(page, 'shell-user-hamburger').click()
      const drawer = tid(page, 'shell-user-drawer')
      await expect(drawer.locator('[data-nav-id="pksk"]')).toBeVisible()
    }
    await actAs(page, mock, gotoApp, 'admin@demo.test', '/admin/pksk/access')
    await expect(tid(page, 'access-table')).toBeVisible()
    if (isDesktopShell(page)) {
      const sb = tid(page, 'shell-admin-sidebar')
      await expect(sb.getByRole('link', { name: 'PKSK Soalan' })).toBeVisible()
      await expect(sb.getByRole('link', { name: 'PKSK Akses' })).toBeVisible()
    } else {
      // "Lagi" sheet of the bottom bar lists Premium > PKSK Soalan / PKSK Akses.
      await page.getByRole('button', { name: /Lagi/ }).first().click()
      await expect(page.getByRole('link', { name: 'PKSK Soalan' }).first()).toBeVisible()
      await expect(page.getByRole('link', { name: 'PKSK Akses' }).first()).toBeVisible()
    }
  })
})

/**
 * Navigates inside the running SPA (no reload, so no mock re-boot) when the app is up, otherwise
 * boots it with `gotoApp`. Keeps long route loops within the test time budget on a loaded machine.
 */
async function visit(page: Page, gotoApp: (p: string) => Promise<void>, path: string): Promise<void> {
  const up = await page.evaluate(
    () => Boolean((document.querySelector('#app') as (Element & { __vue_app__?: unknown }) | null)?.__vue_app__),
  )
  if (!up) {
    await gotoApp(path)
    return
  }
  await page.evaluate(async (p) => {
    const el = document.querySelector('#app') as unknown as {
      __vue_app__: { config: { globalProperties: { $router: { push(p: string): Promise<unknown> } } } }
    }
    await el.__vue_app__.config.globalProperties.$router.push(p)
  }, path)
}
