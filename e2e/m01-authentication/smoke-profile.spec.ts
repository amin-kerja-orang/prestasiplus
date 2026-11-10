/**
 * M01-T6 developer smoke (build-plan R.3.1; QA writes E2E-M01-26..31 at G5): S7 `/profile` and S8
 * `/profile/edit` at 375 / 768 / 1280 for the student (2), teacher (5) and school admin (8), plus
 * the admin (1) for the Darjah group. Post-submit copy (flash texts, server error lines) is
 * INFERRED / UNVERIFIED in the SRS §8, so the tests that assert it are `@provisional`.
 */

import { expect, test, DEMO_PASSWORD } from '../fixtures/test'
import {
  expectContrast,
  expectNoHorizontalScroll,
  expectTabTitle,
  expectTouchTarget,
  moduleTag,
  provisional,
  TAG,
} from '../support'

const STUDENT = 'pelajar@demo.test'

/** 1x1 transparent PNG. */
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
)

test.describe('M01 profile S7 / S8', { tag: [TAG.smoke, moduleTag(1)] }, () => {
  test.use({ mockInit: { latency: 0 } })
  // Save flows reload the app several times; the mock boot is slow when workers share the machine.
  test.slow()

  for (const [who, label] of [
    [STUDENT, 'student'],
    ['guru@demo.test', 'teacher'],
    ['adminsekolah@demo.test', 'school admin'],
  ] as const) {
    test(`E2E-M01-26 S7 hero for the ${label}: title, header, content, no h-scroll`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      await loginAs(who)
      await gotoApp('/profile')
      await expectTabTitle(page, 'Profil Saya | PRESTASIPLUS')
      // v2: the Pembelajaran shell owns the page title (its single h1).
      await expect(page.getByRole('heading', { level: 1, name: 'Profil Saya' })).toBeVisible()
      const hero = page.getByTestId('profile-hero')
      await expect(hero).toBeVisible()
      await expect(page.getByTestId('profile-email')).toHaveText(who)
      await expect(page.getByTestId('profile-member-since')).toHaveText(
        'Ahli sejak 6 Februari 2026',
      )
      await expect(page.getByTestId('profile-crown')).toBeAttached()
      // No picture: the UAvatar initials fallback (the `img alt` exists only once a picture is saved).
      const name = (await page.getByTestId('profile-name').innerText()).trim()
      const initials = name
        .split(' ')
        .map((w) => w.charAt(0))
        .join('')
        .slice(0, 2)
      await expect(page.getByTestId('profile-avatar')).toHaveText(initials, { ignoreCase: true })
      // v2: the pupil has no edit link (the bio form is on the page); staff have "Kemaskini Profil".
      if (label === 'student') {
        await expect(page.getByTestId('profile-edit-link')).toHaveCount(0)
        await expect(page.getByTestId('profile-public-card')).toBeVisible()
      } else {
        await expect(page.getByTestId('profile-edit-link')).toBeVisible()
      }
      if (label === 'school admin') await expect(page.getByTestId('profile-school-block')).toBeVisible()
      await expectNoHorizontalScroll(page)
    })
  }

  test('E2E-M01-26 S7 name has AA contrast against the card it sits on (DV-14)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(STUDENT)
    await gotoApp('/profile')
    const name = page.getByTestId('profile-name')
    await expect(name).toHaveText('Pelajar Demo')
    // v2 restyle (A1): a dark heading on a UCard, not white on a gradient; assert the real ratio.
    await expectContrast(name, 4.5)
  })

  test('E2E-M01-26 S7 "Kemaskini Profil" goes to /profile/edit (school admin; the pupil has no edit link)', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs('adminsekolah@demo.test')
    await gotoApp('/profile')
    const link = page.getByTestId('profile-edit-link')
    await expectTouchTarget(link)
    await link.click()
    await expect(page).toHaveURL('/profile/edit')
    await expectTabTitle(page, 'Kemaskini Profil | PRESTASIPLUS')
  })

  test('E2E-M01-28 S8 details: header, prefill, disabled email, static counter, actions row', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(STUDENT)
    await gotoApp('/profile/edit')
    await expectTabTitle(page, 'Kemaskini Profil | PRESTASIPLUS')
    await expect(page.getByRole('heading', { level: 1, name: 'Kemaskini Profil' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Maklumat Peribadi' })).toBeVisible()
    await expect(page.getByTestId('profile-name-input')).toHaveValue('Pelajar Demo')
    await expect(page.getByTestId('profile-name-input')).toHaveAttribute('required', '')
    const email = page.getByTestId('profile-email-input')
    await expect(email).toBeDisabled()
    await expect(email).toHaveValue(STUDENT)
    await expect(page.getByText('Email tidak boleh diubah')).toBeVisible()
    await expect(page.getByTestId('profile-phone-input')).toHaveAttribute(
      'placeholder',
      '012-3456789',
    )
    const bio = page.getByTestId('profile-bio-input')
    await expect(bio).toHaveAttribute('maxlength', '1000')
    await expect(bio).toHaveAttribute('placeholder', 'Tulis sesuatu tentang diri anda...')
    const counter = page.getByTestId('profile-bio-counter')
    await expect(counter).toHaveText('0/1000') // FR-MUR-A1-11: {n}/1000
    await bio.fill('abc')
    await expect(counter).toHaveText('3/1000')

    // SRS §10: the actions row is inline (Kembali left, Simpan Profil right) and inside the viewport.
    const back = page.getByTestId('profile-back')
    const save = page.getByTestId('profile-save')
    await save.scrollIntoViewIfNeeded()
    await expectTouchTarget(back)
    await expectTouchTarget(save)
    const [backBox, saveBox] = [await back.boundingBox(), await save.boundingBox()]
    const width = page.viewportSize()!.width
    expect(backBox!.x).toBeGreaterThanOrEqual(0)
    expect(saveBox!.x + saveBox!.width).toBeLessThanOrEqual(width)
    expect(Math.abs(backBox!.y - saveBox!.y)).toBeLessThan(8)
    expect(backBox!.x).toBeLessThan(saveBox!.x)
    await expectNoHorizontalScroll(page)

    await back.click()
    await expect(page).toHaveURL('/profile')
  })

  test('E2E-M01-28 S8 an empty name is blocked by native validation (no request)', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(STUDENT)
    await gotoApp('/profile/edit')
    const name = page.getByTestId('profile-name-input')
    await name.fill('')
    await page.getByTestId('profile-save').click()
    await expect(name).toHaveJSProperty('validity.valueMissing', true)
    expect(await mock.requests('PUT /api/me')).toHaveLength(0)
  })

  test(
    'E2E-M01-28 S8 save persists the values and shows the success flash',
    provisional('success flash copy "Profil berjaya dikemaskini." is a placeholder (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(STUDENT)
      await gotoApp('/profile/edit')
      await page.getByTestId('profile-name-input').fill('Pelajar Demo Ubah')
      await page.getByTestId('profile-phone-input').fill('0187654321')
      await page.getByTestId('profile-bio-input').fill('Motto saya')
      await page.getByTestId('profile-save').click()
      await expect(page.getByTestId('cmp-flash')).toContainText('Profil berjaya dikemaskini.')
      await expect(page.getByTestId('profile-bio-counter')).toHaveText('10/1000')

      await gotoApp('/profile/edit')
      await expect(page.getByTestId('profile-name-input')).toHaveValue('Pelajar Demo Ubah')
      await expect(page.getByTestId('profile-phone-input')).toHaveValue('0187654321')
      await expect(page.getByTestId('profile-bio-input')).toHaveValue('Motto saya')
      await gotoApp('/profile')
      await expect(page.getByTestId('profile-name')).toHaveText('Pelajar Demo Ubah')
    },
  )

  // E2E-M01-29 (Tahap grid) and E2E-M01-30 (school picker): removed with the v2 edit page (S5-T05); /profile/edit has no Tahap or school card now.

  test('E2E-M01-27 S8 picture: accept list, hint, preview without a request', async ({
    page,
    loginAs,
    gotoApp,
    mock,
  }) => {
    await loginAs(STUDENT)
    await gotoApp('/profile/edit')
    await expect(page.getByRole('heading', { name: 'Gambar Profil' })).toBeVisible()
    await expect(page.getByText('JPG, PNG atau WEBP. Maks 2MB.')).toBeVisible()
    const input = page.getByTestId('picture-input')
    await expect(input).toHaveAttribute('accept', 'image/jpeg,image/png,image/webp')
    await expect(page.getByTestId('picture-save')).toBeHidden()
    // Measure the avatar upload trigger BEFORE a file is chosen (UFileUpload button variant,
    // replacing the old choose button and the hover overlay). The assertion is at the end so a
    // too-small target does not hide the steps below.
    // depends on #386: it puts a size=lg UButton "Pilih Gambar" in the UFileUpload default slot;
    // until it lands the trigger measures 36px and this test fails honestly (not skipped).
    // (today it is the only button of the form: an icon-only 36px upload button)
    const trigger = page.getByTestId('picture-form').getByRole('button').first()
    await expect(trigger).toBeVisible()
    const triggerBox = await trigger.boundingBox()

    await input.setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG })
    await expect(page.getByTestId('picture-save')).toBeVisible()
    await expect(page.getByTestId('picture-preview')).toHaveAttribute(
      'src',
      /^data:image\/png;base64,/,
    )
    expect(await mock.requests('POST /api/me/picture')).toHaveLength(0)
    await expectNoHorizontalScroll(page)
    // depends on #386 (see above): the pre-pick trigger must be a 44px target
    expect(triggerBox, 'avatar trigger has a box').not.toBeNull()
    expect(triggerBox!.width, 'avatar trigger width').toBeGreaterThanOrEqual(43.9)
    expect(triggerBox!.height, 'avatar trigger height').toBeGreaterThanOrEqual(43.9)
  })

  test(
    'E2E-M01-27 S8 picture: "Simpan" saves the new avatar everywhere',
    provisional('success flash copy is a placeholder (SRS §8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(STUDENT)
      await gotoApp('/profile/edit')
      await page
        .getByTestId('picture-input')
        .setInputFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG })
      await page.getByTestId('picture-save').click()
      await expect(page.getByTestId('cmp-flash')).toContainText(
        'Gambar profil berjaya dikemaskini.',
      )
      await expect(page.getByTestId('picture-save')).toBeHidden()
      await expect(page.getByTestId('picture-preview')).toHaveAttribute(
        'src',
        /^data:image\/png;base64,/,
      )
      await gotoApp('/profile')
      await expect(page.getByTestId('profile-avatar')).toHaveAttribute(
        'src',
        /^data:image\/png;base64,/,
      )
    },
  )

  test(
    'E2E-M01-27 S8 picture: a GIF is rejected with the red alert',
    provisional('server error copy is UNVERIFIED (SRS §5/§8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(STUDENT)
      await gotoApp('/profile/edit')
      await page
        .getByTestId('picture-input')
        .setInputFiles({ name: 'a.gif', mimeType: 'image/gif', buffer: Buffer.from('GIF89a') })
      await page.getByTestId('picture-save').click()
      const alert = page.getByTestId('cmp-flash')
      await expect(alert).toHaveAttribute('data-variant', 'error')
      await expect(alert).toContainText('must be a file of type: jpeg, png, webp')
    },
  )

  test('E2E-M01-31 S8 password card: labels, hint, no toggles, no required', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(STUDENT)
    await gotoApp('/profile/edit')
    const form = page.getByTestId('password-form')
    await expect(form.getByRole('heading', { name: 'Tukar Kata Laluan' })).toBeVisible()
    await expect(form.getByLabel('Kata Laluan Semasa')).toHaveAttribute(
      'autocomplete',
      'current-password',
    )
    await expect(form.getByLabel('Kata Laluan Baharu', { exact: true })).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    await expect(form.getByLabel('Sahkan Kata Laluan Baharu')).toHaveAttribute(
      'autocomplete',
      'new-password',
    )
    await expect(form.getByText('Sekurang-kurangnya 8 aksara')).toBeVisible()
    await expect(form.locator('input[required]')).toHaveCount(0)
    await expect(form.locator('button')).toHaveCount(1)
    await expectTouchTarget(page.getByTestId('password-submit'))
    await expectNoHorizontalScroll(page)
  })

  test(
    'E2E-M01-31 S8 password: wrong current shows the error; a valid change clears the fields and keeps the session',
    provisional('success/error copy is a placeholder (SRS §5/§8)'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs(STUDENT)
      await gotoApp('/profile/edit')
      const current = page.getByTestId('password-current')
      const next = page.getByTestId('password-new')
      const confirm = page.getByTestId('password-confirm')
      await current.fill('SalahSalah1')
      await next.fill('BaruBaru123')
      await confirm.fill('BaruBaru123')
      await page.getByTestId('password-submit').click()
      const flash = page.getByTestId('cmp-flash')
      await expect(flash).toHaveAttribute('data-variant', 'error')
      await expect(flash).toContainText('The password is incorrect.')

      await current.fill(DEMO_PASSWORD)
      await next.fill('BaruBaru123')
      await confirm.fill('BaruBaru123')
      await page.getByTestId('password-submit').click()
      await expect(flash).toHaveAttribute('data-variant', 'success')
      await expect(flash).toContainText('Kata laluan berjaya dikemaskini.')
      await expect(current).toHaveValue('')
      await expect(next).toHaveValue('')
      await expect(confirm).toHaveValue('')
      // The session is kept.
      await gotoApp('/profile')
      await expect(page.getByTestId('profile-name')).toHaveText('Pelajar Demo')

      // The new password works at the next login.
      await gotoApp('/login')
      await page.getByTestId('login-email').fill(STUDENT)
      await page.getByTestId('login-password').fill('BaruBaru123')
      await page.getByTestId('login-submit').click()
      await expect(page).toHaveURL(/\/dashboard$/)
    },
  )
})
