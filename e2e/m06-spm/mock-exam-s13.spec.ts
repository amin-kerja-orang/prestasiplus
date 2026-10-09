/**
 * M06-T4 E2E: S13 `/pusat-ai/spm` "SPM Walkthrough — Cikgu Alesa" (SRS M06 v1.4 §12: E2E-M06-35, -36,
 * -37, -42 and the S13 part of -40). The AI is simulated (D4): canned text behind the walkthrough
 * latency hook; the busy and error states are driven by `setWalkthroughLatency` / `failNext`. Every
 * test runs on the mobile 375, tablet 768 and desktop 1280 projects.
 */

import type { Page } from '@playwright/test'

import { expect, test } from './fixtures'
import { open } from './mock-exam-nav'
import {
  acceptNextDialog,
  expectNoHorizontalScroll,
  expectTabTitle,
  moduleTag,
  SM_MIN_WIDTH,
  viewportWidth,
} from '../support'

const PELAJAR = 'pelajar@demo.test'
const ADMIN = 'admin@demo.test'
const tid = (page: Page, id: string) => page.getByTestId(id)
const SOLVE = 'POST /api/spm-walkthrough/solve'
const BUSY = 'AI sedang fikir... (mungkin 15-30s)'

test.use({ mockInit: { latency: 0 } })

test.describe('M06 S13 SPM walkthrough', { tag: [moduleTag(6)] }, () => {
  test('E2E-M06-35 texts, 15 subjects, required, year maxlength 8, image label, Duta block', async ({
    page,
    loginAs,
  }) => {
    await loginAs(ADMIN)
    await open(page, '/pusat-ai/spm')
    await expectTabTitle(page, 'SPM Walkthrough — Cikgu Alesa')
    await expect(tid(page, 'shell-admin-title')).toHaveText('SPM Walkthrough — Cikgu Alesa')
    await expect(page.getByText('📝 SPM Walkthrough', { exact: true })).toBeVisible()
    await expect(
      page.getByText(
        'Snap soalan SPM, AI walk-through step-by-step dengan mark scheme + sebutan buku teks. Faham bukan hafal.',
      ),
    ).toBeVisible()
    await expect(tid(page, 'walk-subject').locator('option')).toHaveText([
      'Pilih',
      'Bahasa Melayu',
      'English',
      'Matematik',
      'Matematik Tambahan',
      'Fizik',
      'Kimia',
      'Biologi',
      'Sains',
      'Sejarah',
      'Pendidikan Islam',
      'Pendidikan Moral',
      'Geografi',
      'Ekonomi',
      'Perdagangan',
      'Prinsip Akaun',
    ])
    await expect(tid(page, 'walk-subject')).toHaveAttribute('required', '')
    await expect(tid(page, 'walk-year')).toHaveAttribute('maxlength', '8')
    await expect(tid(page, 'walk-year')).toHaveAttribute('placeholder', 'Cth: 2023')
    await tid(page, 'walk-year').pressSequentially('2023-2024')
    await expect(tid(page, 'walk-year')).toHaveValue('2023-202')
    await expect(tid(page, 'walk-question')).toHaveAttribute(
      'placeholder',
      'Salin soalan SPM di sini, atau upload gambar di bawah...',
    )
    await expect(tid(page, 'walk-question')).not.toHaveAttribute('required', '')
    await expect(page.getByText('Soalan (taip atau snap)')).toBeVisible()
    await expect(tid(page, 'walk-image-label')).toHaveText(
      '📷 Klik atau drag gambar soalan SPM (auto-extract via AI Vision)',
    )
    await expect(tid(page, 'walk-image')).toHaveAttribute('accept', 'image/*')
    await expect(tid(page, 'walk-submit')).toHaveText('Bagi Walkthrough')
    await tid(page, 'walk-image').setInputFiles({
      name: 'soalan.png',
      mimeType: 'image/png',
      buffer: Buffer.from('x'),
    })
    await expect(tid(page, 'walk-image-label')).toHaveText('📎 soalan.png')
    await expect(tid(page, 'walk-image-label')).toHaveCSS('text-transform', 'uppercase')
    await expect(page.getByTestId('walk-result')).toHaveCount(0)
    await expect(tid(page, 'duta-title')).toHaveText('🎓 Cikgu Maestro SPM')
    await expect(tid(page, 'duta-text')).toHaveText(
      'Setelah baca walkthrough, tonton video penjelasan dari Duta SPM.',
    )
    await expect(page.getByTestId('duta-card')).toHaveCount(1)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-36 busy label, canned text in a pre (literal HTML), in view, button restored, second submit hides the card', async ({
    page,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/pusat-ai/spm')
    await mock.hook('setWalkthroughLatency', 800)
    await tid(page, 'walk-subject').selectOption('Matematik')
    await tid(page, 'walk-question').fill('Cari <b>x</b> bagi 2x = 6')
    await tid(page, 'walk-submit').click()
    await expect(tid(page, 'walk-submit')).toHaveText(BUSY)
    await expect(tid(page, 'walk-submit')).toBeDisabled()
    await expect(tid(page, 'walk-result')).toBeVisible()
    await expect(tid(page, 'walk-result').getByRole('heading')).toHaveText(
      '✨ Walkthrough Cikgu Alesa',
    )
    const body = tid(page, 'walk-body')
    await expect(body).toContainText('Soalan: Cari <b>x</b> bagi 2x = 6')
    await expect(body).toContainText('Langkah 1: Kenal pasti apa yang diberi dan apa yang diminta.')
    await expect(body).toContainText('Skema: 1 markah untuk kaedah, 1 markah untuk jawapan betul.')
    expect(await body.evaluate((el) => el.tagName)).toBe('PRE')
    expect(await body.evaluate((el) => getComputedStyle(el).whiteSpace)).toMatch(/^pre/)
    expect(await body.locator('b').count()).toBe(0)
    expect((await body.textContent())!.split('\n').length).toBeGreaterThan(4)
    await expect(tid(page, 'walk-result')).toBeInViewport()
    await expect(tid(page, 'walk-submit')).toHaveText('Bagi Walkthrough')
    await expect(tid(page, 'walk-submit')).toBeEnabled()

    // A second submit hides the card until the new answer arrives.
    await tid(page, 'walk-subject').selectOption('Sejarah')
    await tid(page, 'walk-submit').click()
    await expect(tid(page, 'walk-submit')).toHaveText(BUSY)
    await expect(page.getByTestId('walk-result')).toHaveCount(0)
    await expect(tid(page, 'walk-result')).toBeVisible()
    await expect(tid(page, 'walk-body')).toContainText('Langkah 1: Kenal pasti kata tugas soalan')
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-37 failNext: error text, "Ralat", network "Ralat: "; button restored each time', async ({
    page,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/pusat-ai/spm')
    await tid(page, 'walk-subject').selectOption('Fizik')
    await tid(page, 'walk-question').fill('Apakah daya?')

    await mock.failNext(SOLVE, { status: 200, body: { ok: false, error: 'X' } })
    let dialog = acceptNextDialog(page, { type: 'alert', message: 'X' })
    await tid(page, 'walk-submit').click()
    await dialog
    await expect(tid(page, 'walk-submit')).toHaveText('Bagi Walkthrough')
    await expect(tid(page, 'walk-submit')).toBeEnabled()

    await mock.failNext(SOLVE, { status: 200, body: { ok: false } })
    dialog = acceptNextDialog(page, { type: 'alert', message: 'Ralat' })
    await tid(page, 'walk-submit').click()
    await dialog
    await expect(tid(page, 'walk-submit')).toHaveText('Bagi Walkthrough')

    await mock.failNext(SOLVE, 'network')
    const net = await (async () => {
      const d = acceptNextDialog(page, { type: 'alert' })
      await tid(page, 'walk-submit').click()
      return d
    })()
    expect(net.message().startsWith('Ralat: ')).toBe(true)
    await expect(tid(page, 'walk-submit')).toHaveText('Bagi Walkthrough')
    await expect(tid(page, 'walk-submit')).toBeEnabled()
    await expect(page.getByTestId('walk-result')).toHaveCount(0)
    await expectNoHorizontalScroll(page)
  })

  test('E2E-M06-37 (simulated input errors) no question and no image gives the mock error alert', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/pusat-ai/spm')
    await tid(page, 'walk-subject').selectOption('Kimia')
    const dialog = acceptNextDialog(page, {
      type: 'alert',
      message: 'Sila masukkan soalan atau muat naik gambar soalan.',
    })
    await tid(page, 'walk-submit').click()
    await dialog
    await expect(tid(page, 'walk-submit')).toHaveText('Bagi Walkthrough')
  })

  test('E2E-M06-42 empty Subjek is blocked by the native required check: no request, no dialog, label unchanged', async ({
    page,
    loginAs,
    mock,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/pusat-ai/spm')
    let dialogs = 0
    page.on('dialog', (d) => {
      dialogs += 1
      void d.dismiss()
    })
    await tid(page, 'walk-question').fill('Soalan tanpa subjek')
    await tid(page, 'walk-submit').click()
    expect(await page.locator('#spmForm').evaluate((f: HTMLFormElement) => f.checkValidity())).toBe(
      false,
    )
    expect(
      await tid(page, 'walk-subject').evaluate((el: HTMLSelectElement) => el.validity.valueMissing),
    ).toBe(true)
    await expect(tid(page, 'walk-submit')).toHaveText('Bagi Walkthrough')
    expect(await mock.requests(SOLVE)).toHaveLength(0)
    expect(dialogs).toBe(0)
  })

  test('E2E-M06-40 (S13) Subjek / Tahun stacked below 640 px with the year field full width', async ({
    page,
    loginAs,
  }) => {
    await loginAs(PELAJAR)
    await open(page, '/pusat-ai/spm')
    const subject = (await tid(page, 'walk-subject').boundingBox())!
    const year = (await tid(page, 'walk-year').boundingBox())!
    const form = (await tid(page, 'walk-form').boundingBox())!
    if (viewportWidth(page) < SM_MIN_WIDTH) {
      expect(year.y).toBeGreaterThan(subject.y + subject.height - 1)
      expect(year.width).toBeGreaterThan(form.width - 64)
      // The placeholder "Cth: 2023" is not clipped.
      const clipped = await tid(page, 'walk-year').evaluate((el: HTMLInputElement) => {
        const probe = document.createElement('span')
        const cs = getComputedStyle(el)
        probe.style.cssText = `position:absolute;visibility:hidden;white-space:nowrap;font:${cs.font}`
        probe.textContent = el.placeholder
        document.body.append(probe)
        const w = probe.getBoundingClientRect().width
        probe.remove()
        return w > el.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight)
      })
      expect(clipped).toBe(false)
    } else {
      expect(year.y).toBeLessThan(subject.y + subject.height)
      expect(year.x).toBeGreaterThan(subject.x)
    }
    const main = (await tid(page, 'walk-page').locator('> div').boundingBox())!
    expect(main.width).toBeLessThanOrEqual(880 + 1)
    await expectNoHorizontalScroll(page)
  })
})
