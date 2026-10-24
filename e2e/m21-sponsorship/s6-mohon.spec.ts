/**
 * M21 S6 `/mohon-keluarga-angkat` at 375 / 768 / 1280 (M21-T2; SRS M21 v1.2 §12: the S6 parts of
 * E2E-M21-04, 07, 08, 10, 46 to 51, 66 and 67). Accounts: pelajar (id 2), pelajar2 (id 3, a student),
 * ibubapa (parent), guru (teacher). Tests that assert the PROPOSED effects (#15 outcome, messages) or
 * the INFERRED roles are `@provisional`.
 *
 * Not covered here (S5 is built by M21-T4): the S5 halves of E2E-M21-49 ("Menunggu 3" unchanged) and
 * E2E-M21-50 (S5 "Menunggu 4", row #4 "student" / "OKU", and the "parent" row). The request count and
 * the 201 / 422 status of #15 stand in for them until then.
 */

import type { Locator, Page } from '@playwright/test'

import { expect as baseExpect, test } from '../fixtures/test'
import type { MockHandle } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
  viewportWidth,
} from '../support'

/** The shell re-renders once the session loads; give the first assertions room on a loaded machine. */
const expect = baseExpect.configure({ timeout: 10_000 })

const PATH = '/mohon-keluarga-angkat'
const POST = '/api/mohon-keluarga-angkat'
const PELAJAR = 'pelajar@demo.test'
const PELAJAR2 = 'pelajar2@demo.test'
const IBUBAPA = 'ibubapa@demo.test'
const GURU = 'guru@demo.test'
const MODULE = { tag: [moduleTag(21)] }

const SUCCESS =
  'Permohonan anda telah dihantar. Admin akan menyemak permohonan dalam 1-3 hari bekerja.'
const NOT_FOUND = 'Emel pelajar tidak dijumpai dalam PrestasiPlus.'

const EXAMPLES = [
  '• Keluarga berpendapatan rendah (B40). Bapa bekerja sebagai buruh am, ibu suri rumah. Tidak mampu membayar yuran tuisyen tambahan untuk persediaan SPM.',
  '• Pelajar yatim piatu yang tinggal bersama nenek. Nenek sudah tua dan tiada pendapatan tetap. Pelajar ini berpotensi tetapi tiada akses kepada bahan pembelajaran digital.',
  '• Anak asnaf yang menerima bantuan zakat. Keluarga mempunyai 6 orang anak dan pendapatan tidak mencukupi untuk perbelanjaan pendidikan tambahan.',
  '• Pelajar OKU (masalah penglihatan) yang memerlukan akses digital kerana sukar membaca buku teks biasa. Platform digital lebih mesra OKU dengan saiz teks boleh dilaraskan.',
  '• Pelajar cemerlang dari keluarga miskin. Mendapat 5A dalam PT3 tetapi ibu bapa tidak mampu hantar ke tuisyen. Dengan PrestasiPlus, pelajar ini boleh belajar sendiri dari rumah.',
]

test.use({ mockInit: { latency: 0 } })

const email = (page: Page) => page.locator('#student_email')
const category = (page: Page) => page.locator('#student_category')
const income = (page: Page) => page.locator('#family_income_range')
const reason = (page: Page) => page.locator('#reason')
const submit = (page: Page) => page.getByTestId('mohon-submit')
const notice = (page: Page) => page.getByTestId('mohon-notice')

async function posts(mock: MockHandle) {
  return (await mock.requests(POST)).filter((r) => r.method === 'POST')
}

/** Native `:invalid` state of a control (the browser check that stops the submit). */
const isInvalid = (loc: Locator): Promise<boolean> =>
  loc.evaluate((el) => !(el as HTMLInputElement).validity.valid)

async function fill(
  page: Page,
  v: { email: string; category: string; income?: string; reason: string },
): Promise<void> {
  await email(page).fill(v.email)
  await category(page).selectOption(v.category)
  if (v.income !== undefined) await income(page).selectOption({ label: v.income })
  await reason(page).fill(v.reason)
}

test.describe('M21 S6 Mohon Keluarga Angkat', MODULE, () => {
  test('E2E-M21-04 S6 renders in the user shell without the tournament banner @m21', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(PATH)
    await expect(page.getByTestId('mohon-hero')).toBeVisible()
    await expect(page.getByTestId('shell-user-header')).toBeVisible()
    for (const hidden of ['LIVE:', 'MAIN', 'DAFTAR']) {
      await expect(
        page.getByTestId('shell-user-main').getByText(hidden, { exact: true }),
      ).toHaveCount(0)
    }
  })

  test('E2E-M21-07 S6 header "Mohon Keluarga Angkat" (not "Dashboard") and the tab @m21', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(PATH)
    await expect(page.getByTestId('shell-user-title').first()).toHaveText('Mohon Keluarga Angkat')
    await expect(page.getByTestId('shell-user-title').first()).not.toHaveText('Papan Pemuka')
    await expect(page.getByTestId('shell-user-subtitle').first()).toHaveText(
      'Selamat datang kembali',
    )
    await expectTabTitle(page, 'Mohon Keluarga Angkat')
  })

  test('E2E-M21-08 a guest on S6 is sent to /login @m21', async ({ page, gotoApp }) => {
    await gotoApp(PATH)
    await expect(page).toHaveURL(/\/login$/)
  })

  for (const [role, who] of [
    ['pelajar', PELAJAR],
    ['ibubapa', IBUBAPA],
    ['guru', GURU],
  ] as const) {
    test(
      `E2E-M21-10 ${role} opens S6 and it renders @m21`,
      provisional('parent / teacher access to S6 is INFERRED (OQ-M21-07)'),
      async ({ page, gotoApp, loginAs }) => {
        await loginAs(who)
        await gotoApp(PATH)
        await expect(page).toHaveURL(/\/mohon-keluarga-angkat$/)
        await expect(page.getByTestId('mohon-hero').locator('h1')).toHaveText(
          'Mohon Keluarga Angkat',
        )
        await expect(email(page)).toBeVisible()
      },
    )
  }

  test('E2E-M21-46 S6 hero, fields, placeholders, hint, "sini" link and both selects @m21', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(PATH)
    await expect(page.getByTestId('mohon-hero').locator('h1')).toHaveText('Mohon Keluarga Angkat')
    await expect(page.getByTestId('mohon-hero')).toContainText(
      'Isi borang ini untuk memohon tajaan akses PrestasiPlus secara percuma.',
    )
    await expect(page.locator('label[for="student_email"]')).toHaveText('Emel Pelajar')
    await expect(email(page)).toHaveAttribute('type', 'email')
    await expect(email(page)).toHaveAttribute('placeholder', 'pelajar@email.com')
    await expect(page.locator('#student_email_hint')).toHaveText(
      'Emel pelajar yang berdaftar dalam PrestasiPlus. Jika pelajar belum daftar, minta mereka daftar terlebih dahulu di sini.',
    )
    await expect(page.locator('#student_email_hint a')).toHaveText('sini')
    await expect(page.locator('#student_email_hint a')).toHaveAttribute('href', '/register')
    await expect(page.locator('label[for="student_category"]')).toHaveText('Kategori Pelajar')
    await expect(category(page).locator('option')).toHaveText([
      'Pilih kategori',
      'B40 — Pendapatan rendah',
      'Asnaf — Layak bantuan zakat',
      'Yatim — Tiada ibu/bapa',
      'OKU — Orang kurang upaya',
      'Lain-lain',
    ])
    await expect(page.locator('label[for="family_income_range"]')).toHaveText(
      'Anggaran Pendapatan Keluarga',
    )
    await expect(income(page).locator('option')).toHaveText([
      'Pilih (pilihan)',
      'Bawah RM1,000',
      'RM1,000 - RM2,500',
      'RM2,500 - RM4,000',
      'Atas RM4,000',
    ])
    await expect(page.locator('label[for="reason"]')).toHaveText('Sebab Permohonan')
    await expect(reason(page)).toHaveAttribute('rows', '4')
    await expect(reason(page)).toHaveAttribute(
      'placeholder',
      'Terangkan kenapa pelajar ini memerlukan tajaan...',
    )
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M21-47 an example click fills the textarea with the "• " text, no request @m21', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(PATH)
    const items = page.getByTestId('mohon-example')
    await expect(items).toHaveCount(5)
    await expect(page.getByTestId('mohon-examples')).toContainText('Contoh sebab permohonan:')
    await expect(page.getByTestId('mohon-examples')).toContainText(
      'Klik mana-mana contoh untuk guna sebagai templat. Sila ubahsuai mengikut situasi sebenar.',
    )
    await items.nth(1).click()
    await expect(reason(page)).toHaveValue(EXAMPLES[1]!)
    await items.nth(3).click()
    await expect(reason(page)).toHaveValue(EXAMPLES[3]!)
    expect(await posts(mock)).toHaveLength(0)
  })

  test('E2E-M21-47 the five examples are exact and keyboard reachable @m21', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(PATH)
    const items = page.getByTestId('mohon-example')
    for (let i = 0; i < EXAMPLES.length; i++) {
      await expect(items.nth(i)).toHaveText(EXAMPLES[i]!)
    }
    await items.nth(4).focus()
    await page.keyboard.press('Enter')
    await expect(reason(page)).toHaveValue(EXAMPLES[4]!)
  })

  test('E2E-M21-48 S6 note, button and info-box copy @m21', async ({ page, gotoApp, loginAs }) => {
    await loginAs(PELAJAR)
    await gotoApp(PATH)
    await expect(submit(page)).toHaveText('Hantar Permohonan')
    const info = page.getByTestId('mohon-info')
    await expect(info).toContainText('Apa yang berlaku selepas mohon?')
    await expect(info.locator('ol li')).toHaveText([
      'Admin semak dan luluskan permohonan (1-3 hari bekerja)',
      'Pelajar masuk ke kumpulan — sponsor/keluarga angkat boleh pilih',
      'Bila sponsor pilih, pelajar dapat akses PERCUMA PrestasiPlus selama 1 sesi persekolahan',
      'Keluarga angkat boleh pantau prestasi pelajar dari papan pemuka mereka',
    ])
    await expect(info).toContainText('Siapa boleh mohon?')
    await expect(info.locator('ul li')).toHaveText([
      'Pelajar sendiri — mohon untuk diri sendiri',
      'Ibu bapa — mohon untuk anak',
      'Guru / Kaunselor — mohon untuk pelajar yang dikenal pasti memerlukan',
    ])
  })

  test('E2E-M21-49 empty fields or e-mail "abc": the browser check stops the submit @m21', async ({
    page,
    gotoApp,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(PATH)
    await submit(page).click()
    expect(await isInvalid(email(page))).toBe(true)
    expect(await isInvalid(category(page))).toBe(true)
    expect(await isInvalid(reason(page))).toBe(true)
    expect(await isInvalid(income(page))).toBe(false)
    await email(page).fill('abc')
    await category(page).selectOption('B40')
    await reason(page).fill('Sebab ujian')
    await submit(page).click()
    expect(await isInvalid(email(page))).toBe(true)
    expect(await posts(mock)).toHaveLength(0)
    await expect(notice(page)).toBeHidden()
  })

  test(
    'E2E-M21-50 pelajar submits for pelajar@demo.test: success notice and an empty form @m21',
    provisional(
      'the #15 effects and the success notice are PROPOSED (OQ-M21-03); the S5 row is M21-T4',
    ),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(PELAJAR)
      await gotoApp(PATH)
      await fill(page, {
        email: PELAJAR,
        category: 'OKU',
        income: 'Bawah RM1,000',
        reason: 'Sebab ujian OKU',
      })
      await submit(page).click()
      await expect(notice(page)).toHaveText(SUCCESS)
      await expect(email(page)).toHaveValue('')
      await expect(category(page)).toHaveValue('')
      await expect(income(page)).toHaveValue('')
      await expect(reason(page)).toHaveValue('')
      const sent = await posts(mock)
      expect(sent).toHaveLength(1)
      expect(sent[0]!.status).toBe(201)
      expect(sent[0]!.body).toEqual({
        studentEmail: PELAJAR,
        studentCategory: 'OKU',
        familyIncomeRange: '< RM1,000',
        reason: 'Sebab ujian OKU',
      })
    },
  )

  test(
    'E2E-M21-50 ibubapa submits for pelajar2@demo.test with B40 and no income @m21',
    provisional(
      'parent access and the #15 effects are INFERRED / PROPOSED; the S5 "parent" row is M21-T4',
    ),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(IBUBAPA)
      await gotoApp(PATH)
      await fill(page, { email: PELAJAR2, category: 'B40', reason: 'Sebab ujian B40' })
      await submit(page).click()
      await expect(notice(page)).toHaveText(SUCCESS)
      const sent = await posts(mock)
      expect(sent).toHaveLength(1)
      expect(sent[0]!.status).toBe(201)
      expect((sent[0]!.body as { familyIncomeRange: unknown }).familyIncomeRange).toBeNull()
    },
  )

  test(
    'E2E-M21-51 an unknown e-mail and a teacher e-mail show the PROPOSED message, nothing created @m21',
    provisional('the 422 message and the student-only rule are PROPOSED (BR-M21-13, OQ-M21-03)'),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(PELAJAR)
      await gotoApp(PATH)
      for (const bad of ['tiada.pelajar@demo.test', GURU]) {
        await fill(page, { email: bad, category: 'Yatim', reason: 'Sebab ujian' })
        await submit(page).click()
        await expect(notice(page)).toHaveText(NOT_FOUND)
        await expect(email(page)).toHaveValue(bad)
        await expect(reason(page)).toHaveValue('Sebab ujian')
      }
      const sent = await posts(mock)
      expect(sent).toHaveLength(2)
      expect(sent.every((r) => r.status === 422)).toBe(true)
    },
  )

  test(
    'E2E-M21-51 a following successful submit clears the 422 notice @m21',
    provisional('the notices are PROPOSED (OQ-M21-03)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(PELAJAR)
      await gotoApp(PATH)
      await fill(page, { email: 'tiada.pelajar@demo.test', category: 'Yatim', reason: 'x' })
      await submit(page).click()
      await expect(notice(page)).toHaveText(NOT_FOUND)
      await email(page).fill(PELAJAR2)
      await submit(page).click()
      await expect(notice(page)).toHaveText(SUCCESS)
    },
  )

  test(
    'E2E-M21-66 S6 has no horizontal scroll, no text below 12 px, touch targets >= 44 px @m21',
    provisional('the S6 touch-target and font-size rules are D9 fixes (DV-M21-05, 07)'),
    async ({ page, gotoApp, loginAs }) => {
      await loginAs(PELAJAR)
      await gotoApp(PATH)
      await expect(page.getByTestId('mohon-info')).toBeVisible()
      await expectNoHorizontalScroll(page)
      await fill(page, { email: 'tiada.pelajar@demo.test', category: 'B40', reason: 'x' })
      await submit(page).click()
      await expect(notice(page)).toHaveText(NOT_FOUND)
      await expectNoHorizontalScroll(page)
      const small = await page.getByTestId('mohon-page').evaluate((root) => {
        const out: string[] = []
        const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
        let n: Node | null
        while ((n = walker.nextNode())) {
          const el = n.parentElement
          if (el === null || (n.nodeValue ?? '').trim() === '') continue
          if (parseFloat(getComputedStyle(el).fontSize) < 12)
            out.push(el.tagName + ':' + n.nodeValue)
        }
        return out
      })
      expect(small).toEqual([])
      await expectTouchTarget(submit(page))
      await expectTouchTarget(page.getByTestId('mohon-example').first())
    },
  )

  test('E2E-M21-67 S6 is one centred column (max ~670 px) at each width @m21', async ({
    page,
    gotoApp,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await gotoApp(PATH)
    const root = page.getByTestId('mohon-page')
    await expect(root).toBeVisible()
    const box = (await root.boundingBox())!
    expect(box.width).toBeLessThanOrEqual(670.5)
    if (viewportWidth(page) >= 768) {
      const left = box.x
      const right = viewportWidth(page) - (box.x + box.width)
      // centred inside the content area (the sidebar shifts the area on desktop)
      expect(left).toBeGreaterThan(0)
      expect(right).toBeGreaterThan(0)
    }
    const h1 = await page
      .getByTestId('mohon-hero')
      .locator('h1')
      .evaluate((el) => getComputedStyle(el).fontSize)
    expect(h1).toBe('24px')
    const fields = await page
      .locator('[data-testid="mohon-form"] > div')
      .evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().left)))
    expect(new Set(fields).size).toBe(1)
    await expectNoHorizontalScroll(page)
  })
})
