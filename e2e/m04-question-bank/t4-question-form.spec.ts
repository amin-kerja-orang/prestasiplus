/**
 * M04-T4 developer smoke for S2 `/admin/questions/create` and S4 `/admin/questions/:id/edit` (build-plan
 * M04-T4; QA writes E2E-M04-* at G5): an MCQ with an image and a DSKP tag, a true/false question, the
 * server-side validation messages under their field, editing anchor 564159 (clearing its DSKP tag, kept
 * after a reload) and the Arabic / Jawi key panel, as the admin demo account at 375 / 768 / 1280. The
 * flash texts and the §5 server messages are UNVERIFIED COPY, so those assertions are `@provisional`.
 */

import type { Page } from '@playwright/test'

import { waitForApp } from '../fixtures/mock-handle'
import { expect, test } from '../fixtures/test'
import {
  expectNoHorizontalScroll,
  expectTabTitle,
  moduleTag,
  provisional,
  SM_MIN_WIDTH,
  TAG,
  viewportWidth,
} from '../support'

const ADMIN = 'admin@demo.test'
const CREATE = '/admin/questions/create'

const byId = (page: Page, id: string) => page.getByTestId(id)

/** A full page load after a write: the mock boot replays the saved changes, so it gets a longer budget. */
async function reopen(page: Page, path: string): Promise<void> {
  await page.goto(path)
  await waitForApp(page, 60_000)
}

/** A 1x1 transparent PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

async function fillBasics(page: Page, text: string): Promise<void> {
  await byId(page, 'q-subject').selectOption({ label: 'Sains' })
  await byId(page, 'q-level').selectOption({ label: 'Tingkatan 5' })
  await page.locator('[id="q-difficulty"] [role="radio"][value="3"]').check()
  await byId(page, 'q-text').fill(text)
}

test.describe('M04 S2 create question', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp(CREATE)
  })

  test('title, fields, copy and no horizontal scroll', async ({ page }) => {
    await expectTabTitle(page, 'Tambah Soalan Baru')
    await expect(page.getByRole('heading', { name: '✨ Tambah Soalan Baru' })).toBeVisible()
    await expect(page.getByText('Isi maklumat di bawah untuk menambah soalan baharu')).toBeVisible()
    await expect(byId(page, 'q-subject').locator('option')).toHaveCount(32)
    await expect(byId(page, 'q-level').locator('option')).toHaveCount(12)
    await expect(byId(page, 'q-type')).toHaveValue('mcq')
    await expect(byId(page, 'q-text')).toHaveAttribute('rows', '4')
    await expect(page.getByText('Minimum 10 aksara')).toBeVisible()
    await expect(byId(page, 'q-image')).toContainText('Klik untuk muat naik gambar')
    await expect(byId(page, 'q-image')).toContainText('JPG, PNG, WebP — Maks 2MB')
    await expect(page.locator('[id="q-correct-0"] [role="radio"]')).toBeChecked()
    await expect(byId(page, 'q-points')).toHaveValue('1')
    await expect(byId(page, 'form-submit')).toHaveText('Simpan Soalan')
    await expect(byId(page, 'dskp-sk')).toBeDisabled()
    await expect(byId(page, 'dskp-sp')).toBeDisabled()
    await expectNoHorizontalScroll(page)
  })

  test(
    'an MCQ with an image and a DSKP tag is saved and the list opens with the flash',
    provisional('The flash text is UNVERIFIED COPY (SRS §8.2)'),
    async ({ page }) => {
      await fillBasics(page, 'Apakah maksud satelit buatan dalam sains?')

      await expect
        .poll(() => byId(page, 'dskp-bidang').locator('option').count())
        .toBeGreaterThan(1)
      // The textbook Bidang of Sains T5 has SKs and SPs in the DSKP seed.
      const textbook = byId(page, 'dskp-bidang').locator('option', { hasText: 'T5-SUB4-TEXTBOOK' })
      await byId(page, 'dskp-bidang').selectOption((await textbook.getAttribute('value')) ?? '')
      await expect(byId(page, 'dskp-sk')).toBeEnabled()
      await expect.poll(() => byId(page, 'dskp-sk').locator('option').count()).toBeGreaterThan(1)
      // SK "T5SN.B9" (anchor 564159's own SK) has SPs; "BAB9" has none.
      const sk = byId(page, 'dskp-sk').locator('option', { hasText: /^\s*T5SN\.B9 - / })
      await byId(page, 'dskp-sk').selectOption((await sk.first().getAttribute('value')) ?? '')
      await expect(byId(page, 'dskp-sp')).toBeEnabled()
      await expect.poll(() => byId(page, 'dskp-sp').locator('option').count()).toBeGreaterThan(1)
      await byId(page, 'dskp-sp').selectOption({ index: 1 })
      await expect(byId(page, 'dskp-tagged')).toHaveText('DSKP ditag')

      await byId(page, 'q-image-input').setInputFiles({
        name: 'rajah.png',
        mimeType: 'image/png',
        buffer: PNG,
      })
      await expect(byId(page, 'q-image-preview')).toBeVisible()
      await expect(byId(page, 'q-image-remove')).toBeVisible()

      const options = ['Objek buatan manusia', 'Objek semula jadi', 'Bintang', 'Batuan angkasa']
      for (const [i, text] of options.entries())
        await byId(page, `q-option-${String(i)}`).fill(text)
      await page.locator('[id="q-correct-1"] [role="radio"]').check()
      await expectNoHorizontalScroll(page)

      await byId(page, 'form-submit').click()
      await expect(page).toHaveURL(/\/admin\/questions$/)
      await expect(byId(page, 'cmp-flash')).toContainText('Soalan berjaya ditambah.')
    },
  )

  test('removing the chosen image restores the prompt', async ({ page }) => {
    await byId(page, 'q-image-input').setInputFiles({
      name: 'rajah.png',
      mimeType: 'image/png',
      buffer: PNG,
    })
    await expect(byId(page, 'q-image-preview')).toBeVisible()
    await byId(page, 'q-image-remove').click()
    await expect(byId(page, 'q-image-preview')).toHaveCount(0)
    await expect(byId(page, 'q-image')).toContainText('Klik untuk muat naik gambar')
  })

  test('the type switches the answer card and hidden cards keep their values', async ({ page }) => {
    await expect(byId(page, 'mcq-card')).toBeVisible()
    await byId(page, 'q-option-0').fill('Pilihan tersimpan')
    await byId(page, 'q-type').selectOption('true_false')
    await expect(byId(page, 'mcq-card')).toBeHidden()
    await expect(byId(page, 'tf-card')).toBeVisible()
    await expect(byId(page, 'tf-card')).toContainText('Jawapan Betul / Salah')
    await byId(page, 'q-type').selectOption('short_answer')
    await expect(byId(page, 'short-card')).toContainText('Jawapan Pendek')
    await byId(page, 'q-type').selectOption('fill_blank')
    await expect(byId(page, 'short-card')).toContainText('Jawapan Isi Tempat Kosong')
    await byId(page, 'q-type').selectOption('essay')
    await expect(byId(page, 'essay-card')).toContainText('Jawapan Contoh (Esei)')
    await byId(page, 'q-type').selectOption('mcq')
    await expect(byId(page, 'q-option-0')).toHaveValue('Pilihan tersimpan')
    await expectNoHorizontalScroll(page)
  })

  test(
    'a true/false question is saved without a type-specific required field',
    provisional('The flash text is UNVERIFIED COPY (SRS §8.2)'),
    async ({ page }) => {
      await byId(page, 'q-type').selectOption('true_false')
      await fillBasics(page, 'Bumi mengelilingi Matahari dalam masa setahun.')
      await page.locator('[id="q-tf"] [role="radio"][value="true"]').check()
      await byId(page, 'form-submit').click()
      await expect(page).toHaveURL(/\/admin\/questions$/)
      await expect(byId(page, 'cmp-flash')).toContainText('Soalan berjaya ditambah.')
    },
  )

  test('native required stops an empty submit before any request', async ({ page }) => {
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/admin\/questions\/create$/)
    await expect(byId(page, 'q-subject')).toHaveJSProperty('validity.valueMissing', true)
    await expect(page.getByTestId('question-form-alert')).toHaveCount(0)
  })

  test(
    'server messages show under their field and the input is kept',
    provisional('The §5 server messages are UNVERIFIED COPY'),
    async ({ page }) => {
      await byId(page, 'q-type').selectOption('short_answer')
      await fillBasics(page, 'Pendek')
      await byId(page, 'form-submit').click()
      await expect(page).toHaveURL(/\/admin\/questions\/create$/)
      const text = byId(page, 'q-text').locator('xpath=ancestor::div[1]/..')
      await expect(text).toContainText('Teks soalan mesti sekurang-kurangnya 10 aksara.')
      await expect(byId(page, 'short-card')).toContainText('Sila masukkan jawapan betul.')
      await expect(byId(page, 'q-text')).toHaveValue('Pendek')
      await expect(byId(page, 'q-subject').locator('option:checked')).toHaveText('Sains')
      await expectNoHorizontalScroll(page)
    },
  )

  test(
    'an image of the wrong type is refused under the image',
    provisional('The §5 server messages are UNVERIFIED COPY'),
    async ({ page }) => {
      await fillBasics(page, 'Soalan dengan gambar yang tidak sah.')
      await byId(page, 'q-image-input').setInputFiles({
        name: 'nota.pdf',
        mimeType: 'application/pdf',
        buffer: Buffer.from('%PDF-1.4'),
      })
      for (const [i, text] of ['A', 'B', 'C', 'D'].entries())
        await byId(page, `q-option-${String(i)}`).fill(text)
      await byId(page, 'form-submit').click()
      await expect(byId(page, 'q-image')).toBeVisible()
      await expect(page.getByText('Gambar mesti jenis JPG, PNG atau WebP')).toBeVisible()
    },
  )
})

test.describe('M04 S2 Arabic / Jawi keyboard', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp(CREATE)
  })

  test('opens, inserts at the caret, switches to Jawi and closes with Esc', async ({ page }) => {
    const text = byId(page, 'q-text')
    await expect(text).not.toHaveAttribute('dir', 'rtl')
    await byId(page, 'vkb-toggle').click()
    await expect(byId(page, 'vkb-panel')).toBeVisible()
    await expect(byId(page, 'vkb-caption')).toHaveText('Papan Kekunci Arab')
    await expect(text).toHaveAttribute('dir', 'rtl')
    await expect(text).toHaveCSS('font-family', /Scheherazade New/)

    await text.fill('ab')
    await text.evaluate((el: HTMLTextAreaElement) => el.setSelectionRange(1, 1))
    await byId(page, 'vkb-key').first().click()
    await expect(text).toHaveValue('aضb')
    await byId(page, 'vkb-backspace').click()
    await expect(text).toHaveValue('ab')
    await byId(page, 'vkb-newline').click()
    await expect(text).toHaveValue('a\nb')
    await expect(byId(page, 'vkb-harakat')).toHaveCount(9)

    await byId(page, 'vkb-mode-jawi').click()
    await expect(byId(page, 'vkb-caption')).toHaveText('Papan Kekunci Jawi')
    await expect(byId(page, 'vkb-panel')).toContainText('ڤ')
    await expectNoHorizontalScroll(page)

    const box = await byId(page, 'vkb-panel').boundingBox()
    expect(box).not.toBeNull()
    expect(box!.x).toBeGreaterThanOrEqual(0)
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewportWidth(page) + 1)
    if (viewportWidth(page) < SM_MIN_WIDTH) await expect(byId(page, 'vkb-backdrop')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(byId(page, 'vkb-panel')).toHaveCount(0)
    await expect(text).toHaveAttribute('dir', 'rtl')
  })

  test('the close button and the toggle close the panel', async ({ page }) => {
    await byId(page, 'vkb-toggle').click()
    await expect(byId(page, 'vkb-panel')).toBeVisible()
    await byId(page, 'vkb-close').click()
    await expect(byId(page, 'vkb-panel')).toHaveCount(0)
    await byId(page, 'vkb-toggle').click()
    await expect(byId(page, 'vkb-panel')).toBeVisible()
    if (viewportWidth(page) < SM_MIN_WIDTH) {
      await byId(page, 'vkb-backdrop').click({ position: { x: 10, y: 10 } })
    } else {
      await byId(page, 'vkb-toggle').click()
    }
    await expect(byId(page, 'vkb-panel')).toHaveCount(0)
  })
})

test.describe('M04 S4 edit question', { tag: [TAG.smoke, moduleTag(4)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test.beforeEach(async ({ loginAs, gotoApp }) => {
    await loginAs(ADMIN)
    await gotoApp('/admin/questions/564159/edit')
  })

  test('is pre-filled, has no type select or keyboard, and shows the saved DSKP chain', async ({
    page,
  }) => {
    await expectTabTitle(page, 'Edit Soalan')
    await expect(page.getByRole('heading', { name: '✏️ Edit Soalan' })).toBeVisible()
    await expect(page.getByText('Kemaskini maklumat soalan #564159')).toBeVisible()
    await expect(byId(page, 'q-text')).toHaveValue(/Apakah maksud satelit buatan/)
    await expect(byId(page, 'q-type')).toHaveCount(0)
    await expect(byId(page, 'vkb-toggle')).toHaveCount(0)
    await expect(byId(page, 'form-submit')).toHaveText('Kemaskini Soalan')
    await expect(page.locator('[id="q-correct-0"] [role="radio"]')).toBeChecked()
    await expect(byId(page, 'q-option-0')).toHaveValue(/Objek buatan manusia/)
    await expect(page.locator('[id="q-difficulty"] [role="radio"][value="3"]')).toBeChecked()
    await expect(byId(page, 'dskp-tagged')).toBeVisible()
    await expect(byId(page, 'dskp-sp').locator('option:checked')).not.toHaveText('-- Pilih SP --')
    await expect(byId(page, 'dskp-remove')).toBeVisible()
    await expect(byId(page, 'form-cancel')).toHaveAttribute('href', '/admin/questions/564159')
    await expectNoHorizontalScroll(page)
  })

  test(
    'clearing the DSKP tag is saved and still gone after a reload',
    provisional('The flash text is UNVERIFIED COPY (SRS §8.2)'),
    async ({ page }) => {
      test.setTimeout(150_000)
      await expect(byId(page, 'dskp-tagged')).toBeVisible()
      await byId(page, 'dskp-remove').click()
      await expect(byId(page, 'dskp-tagged')).toHaveCount(0)
      await expect(byId(page, 'dskp-bidang')).toHaveValue('')
      await expect(byId(page, 'dskp-sk')).toBeDisabled()
      await expect(byId(page, 'dskp-remove')).toHaveCount(0)

      await byId(page, 'form-submit').click()
      await expect(page).toHaveURL(/\/admin\/questions\/564159$/)
      await expect(byId(page, 'cmp-flash')).toContainText('Soalan berjaya dikemaskini.')
      await expect(page.getByText('Belum ditag')).toBeVisible()

      await reopen(page, '/admin/questions/564159')
      await expect(page.getByText('Belum ditag')).toBeVisible()
      await reopen(page, '/admin/questions/564159/edit')
      await expect(byId(page, 'q-text')).toHaveValue(/Apakah maksud satelit buatan/)
      await expect(byId(page, 'dskp-tagged')).toHaveCount(0)
      await expect(byId(page, 'dskp-remove')).toHaveCount(0)
    },
  )

  test('saving without touching the DSKP keeps the tag (DV-M04-15)', async ({ page }) => {
    test.setTimeout(150_000)
    await expect(byId(page, 'dskp-tagged')).toBeVisible()
    await byId(page, 'q-points').fill('2')
    await byId(page, 'form-submit').click()
    await expect(page).toHaveURL(/\/admin\/questions\/564159$/)
    await reopen(page, '/admin/questions/564159/edit')
    await expect(byId(page, 'q-points')).toHaveValue('2')
    await expect(byId(page, 'dskp-tagged')).toBeVisible()
  })

  test('an unknown id is the standard 404 page', async ({ page, gotoApp }) => {
    await gotoApp('/admin/questions/99999999/edit')
    await expect(page.getByTestId('question-edit-page')).toHaveCount(0)
    await expect(
      page.getByRole('heading', { level: 1, name: 'Halaman Tidak Dijumpai', exact: true }),
    ).toBeVisible()
  })
})
