/**
 * G5 acceptance of v2-dskp-integration, part 3: every one of the 13 catalogue subjects in the Tag
 * DSKP block (AC-01.1 to AC-01.9, AC-02.1 to AC-02.5, AC-03.1 to AC-03.5, AC-04.2, AC-04.3). The
 * expectations are read from the generated catalogue files, so a unit title, an SP count or a TP
 * descriptor shown in the block is compared with what the catalogue holds, not with a copy typed here.
 */
import { readFileSync } from 'node:fs'

import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, expectTouchTarget } from '../support'
import { ADMIN, optionTexts, shot, startManual, tid } from './dskp-g5-support'

test.skip(
  process.env.E2E_PROTOTYPE_SCOPE !== 'on',
  'needs the scope-on build: playwright.bijak.config.mjs',
)

interface TpRow {
  tp: number | null
  range?: [number, number]
  label?: string
  text: string
}
interface TpTable {
  appliesToSk?: string[]
  rows: TpRow[]
}
interface Sp {
  code: string
  text: string
  flags?: string[]
}
interface Sk {
  code: string
  title: string
  sps: Sp[]
  tp?: TpTable[]
}
interface Unit {
  tingkatan: 'T4' | 'T5'
  code: string
  title: string
  group?: number
  flags?: string[]
  sks: Sk[]
  tp?: TpTable[]
}
interface Subject {
  groups?: { tingkatan: string; code?: string; title: string }[]
  units: Unit[]
  generalTp?: TpRow[] | null
}
interface Info {
  code: string
  slug: string
  name: string
  unitNoun: string
  tpLevel: 'unit' | 'sk'
  rtlFields: string[]
}

const DATA = 'src/modules/m03-curriculum/dskp/data'
const INDEX = JSON.parse(readFileSync(`${DATA}/index.json`, 'utf8')) as Info[]
const load = (slug: string): Subject => JSON.parse(readFileSync(`${DATA}/${slug}.json`, 'utf8')) as Subject
const selectable = (u: Unit): Sp[] =>
  u.sks.flatMap((k) => k.sps).filter((s) => !(s.flags ?? []).includes('noStandard'))

test.describe('Catalogue in the Tag DSKP block, all 13 subjects (US-01, US-02, US-03)', () => {
  for (const info of INDEX) {
    test(`AC-01.1 AC-01.2 AC-01.4 AC-02.1 AC-02.2 AC-04.2 AC-04.3: ${info.name} (${info.code}) T4 and T5 units, SP lists and TP descriptor as printed`, async ({
      page,
      loginAs,
      gotoApp,
    }) => {
      const data = load(info.slug)
      await loginAs(ADMIN)
      const block = await startManual(page, gotoApp, info.code)
      await expect(block.getByTestId('tag-subject')).toHaveText(`Subjek: ${info.name}`)

      for (const t of ['T4', 'T5'] as const) {
        await tid(page, 'q-form').selectOption(t)
        const units = data.units.filter((u) => u.tingkatan === t)
        const opts = await optionTexts(tid(page, 'q-unit'))
        // Every unit of this subject and tingkatan, as "{kod} - {tajuk}", and no unit of the other form.
        expect(opts.length - 1, `${t} unit count`).toBe(units.length)
        for (const u of units) {
          // codeQuirk is informational (no badge); Bahasa Inggeris Tingkatan 4 is a draft edition (all nodes).
          const review =
            (u.flags ?? []).some((f) => f !== 'codeQuirk') || (info.code === 'BI' && t === 'T4')
          const flagged = review ? ' (perlu semakan)' : ''
          expect(opts, `${t} ${u.code}`).toContain(`${u.code} - ${u.title}${flagged}`)
        }
        // The unit noun of the subject in the hint (Tajuk, Topic, Learning Area, Kemahiran, Modul ...).
        const unit = units[0]!
        await tid(page, 'q-unit').selectOption(`${info.code}:${t}:u:${unit.code}`)
        await expect(block).toContainText(`Mengikut ${info.unitNoun} dalam DSKP`)
        const sps = selectable(unit)
        await expect(page.locator('[data-testid^="sp-option-"]')).toHaveCount(sps.length)
        await expect(tid(page, 'sp-count')).toContainText(`${sps.length} SP dalam unit ini`)
      }

      // T4 again: pick the first SP, derive SK, then read the TP descriptor at the printed level.
      await tid(page, 'q-form').selectOption('T4')
      const unit = data.units.find((u) => u.tingkatan === 'T4')!
      await tid(page, 'q-unit').selectOption(`${info.code}:T4:u:${unit.code}`)
      const sp = selectable(unit)[0]!
      await tid(page, `sp-option-${sp.code}`).click()
      const sk = unit.sks.find((k) => k.sps.some((s) => s.code === sp.code))!
      await expect(tid(page, 'q-sk').locator('[data-testid="sk-row"]')).toHaveCount(1)
      await expect(tid(page, 'q-sk')).toContainText(sk.code)
      await tid(page, 'q-tp').selectOption('3')
      const table = info.tpLevel === 'sk' ? sk.tp?.[0] : unit.tp?.find((x) => !x.appliesToSk?.length || x.appliesToSk.includes(sk.code))
      const row = table?.rows.find((r) => r.tp === 3 || (r.range && r.range[0] <= 3 && r.range[1] >= 3))
      const desc = tid(page, 'tp-descriptor')
      if (row) {
        await expect(desc).toContainText(row.text.slice(0, 60))
        await expect(desc).toContainText(info.tpLevel === 'sk' ? `Mengikut SK ${sk.code}` : `Mengikut ${info.unitNoun} ${unit.code}`)
      } else {
        // No unit table: the subject's general table, or no descriptor (BI 5.0).
        const general = data.generalTp?.find((r) => r.tp === 3)
        if (general) await expect(desc).toContainText('Mengikut jadual TP am subjek ini')
        else await expect(desc).toContainText('Tiada penerangan TP dalam DSKP untuk unit ini.')
      }
      // The descriptor is help text: TP stays what the reviewer chose.
      await expect(tid(page, 'q-tp')).toHaveValue('3')
      expect(await optionTexts(tid(page, 'q-tp'))).toHaveLength(7) // AC-02.5: TP 1 to 6 for every subject
      await expectNoHorizontalScroll(page)
      await expectTouchTarget(tid(page, 'q-unit'))
      await shot(block, `subject-${info.code}`)
    })
  }
})

test.describe('Subject specifics: flags, Jawi, fallbacks (AC-01.6 to AC-01.8, AC-02.3 to AC-02.4, AC-03.2 to AC-03.4)', () => {
  test('AC-03.2 AC-03.3 AC-03.4 AC-02.1: Pendidikan Islam is Jawi, right-to-left, flagged for spelling, selectable; SK numbering runs on', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    const pi = load('pendidikan-islam')
    await loginAs(ADMIN)
    const block = await startManual(page, gotoApp, 'PI')
    await tid(page, 'q-form').selectOption('T4')
    // Unit titles are Latin ("1 - Al-Quran"); the flag is not repeated on every unit option.
    const opts = await optionTexts(tid(page, 'q-unit'))
    expect(opts).toContain('1 - Al-Quran')
    expect(opts.join('|')).not.toContain('perlu semakan')
    await tid(page, 'q-unit').selectOption('PI:T4:u:1')
    const first = tid(page, 'sp-list').locator('li').first()
    await expect(first.locator('[data-testid="sp-text-rtl"]')).toHaveAttribute('dir', 'rtl')
    await expect(first.locator('[data-testid="sp-text-rtl"]')).toHaveAttribute('lang', 'ms-Arab')
    await expect(first).toContainText('perlu semakan ejaan')
    await expect(first.locator('span[dir="ltr"]').first()).toHaveText('1.26.1')
    await expect(tid(page, 'sp-legend')).toHaveText(
      'Ejaan Jawi bagi SP ini belum disahkan. SP masih boleh dipilih.',
    )
    // A flagged SP can be chosen (the flag never blocks use).
    await tid(page, 'sp-option-1.26.1').click()
    await expect(tid(page, 'sp-chip-1.26.1')).toBeVisible()
    const skRow = tid(page, 'q-sk').locator('[data-testid="sk-row"]').first()
    await expect(skRow).toContainText('1.26')
    await expect(skRow.locator('[dir="rtl"]').first()).toBeVisible()
    await expect(skRow).toContainText('perlu semakan ejaan')
    // TP descriptor at SK level in Jawi.
    await tid(page, 'q-tp').selectOption('2')
    await expect(tid(page, 'tp-descriptor').locator('[dir="rtl"]').first()).toBeVisible()
    await expect(tid(page, 'tp-descriptor')).toContainText('Mengikut SK 1.26')
    const tp2 = pi.units.find((u) => u.tingkatan === 'T4' && u.code === '1')!.sks[0]!.tp![0]!.rows[1]!.text
    await expect(tid(page, 'tp-descriptor')).toContainText(tp2.slice(0, 20))
    // The search box aligns Jawi typed into it.
    await expect(tid(page, 'sp-search')).toHaveAttribute('dir', 'auto')
    // Arabic text is found by substring (no tashkil needed).
    await tid(page, 'sp-search').fill('الأنعام')
    expect(await page.locator('[data-testid^="sp-option-"]').count()).toBeGreaterThan(0)
    await tid(page, 'sp-search').fill('')
    await expectNoHorizontalScroll(page)
    await shot(block, 'pi-jawi-light')
    // AC-03.4: SK numbering continues across forms; Tingkatan 5 starts at 1.33.
    await tid(page, 'q-form').selectOption('T5')
    await tid(page, 'q-unit').selectOption('PI:T5:u:1')
    await expect(page.locator('[data-testid^="sp-option-1.33."]').first()).toBeVisible()
    await page.locator('[data-testid^="sp-option-1.33."]').first().click()
    await expect(tid(page, 'q-sk')).toContainText('1.33')
  })

  test('AC-01.8 AC-01.9: a flagged unit and a reconstructed SP are marked "perlu semakan" but stay selectable', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    const block = await startManual(page, gotoApp, 'SN')
    await tid(page, 'q-form').selectOption('T4')
    // Sains T4 SP 4.3.1 is reconstructed (README): badge on the row, legend line, selectable.
    const sn = load('sains')
    const unit = sn.units.find((u) => u.tingkatan === 'T4' && u.sks.some((k) => k.sps.some((s) => s.code === '4.3.1')))!
    await tid(page, 'q-unit').selectOption(`SN:T4:u:${unit.code}`)
    const row = tid(page, 'sp-option-4.3.1').locator('xpath=ancestor::li')
    await expect(row).toContainText('perlu semakan')
    await expect(tid(page, 'sp-legend')).toHaveText(
      'Tanda "perlu semakan" bermaksud teks DSKP ini belum disahkan sepenuhnya. SP masih boleh dipilih.',
    )
    await tid(page, 'sp-option-4.3.1').click()
    await expect(tid(page, 'sp-chip-4.3.1')).toBeVisible()
    await shot(block, 'sn-flagged-sp')
    await expectNoHorizontalScroll(page)
  })

  test('AC-01.8 AC-02.1 AC-02.3 AC-02.4: Matematik Tambahan, Landskap, Bahasa Melayu and Bahasa Inggeris edge cases', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    // Matematik Tambahan: inferred package units are flagged "(perlu semakan)".
    await startManual(page, gotoApp, 'MTM')
    await tid(page, 'q-form').selectOption('T4')
    const mtm = await optionTexts(tid(page, 'q-unit'))
    expect(mtm.filter((o) => o.endsWith('(perlu semakan)'))).toHaveLength(2) // T4 9.0 and 10.0
    await tid(page, 'q-form').selectOption('T5')
    expect((await optionTexts(tid(page, 'q-unit'))).filter((o) => o.endsWith('(perlu semakan)'))).toHaveLength(2)

    // Landskap: unaligned TP rows: flagged units; T5 unit 7.0 prints "1-4" for one row.
    await gotoApp('/admin/spm/soalan/manual')
    await expect(tid(page, 'intake-subject')).toBeVisible()
    await tid(page, 'intake-subject').selectOption('LNS')
    await tid(page, 'intake-source').fill('Kertas sekolah sendiri')
    await tid(page, 'intake-copyright').selectOption('sendiri')
    await tid(page, 'manual-start').click()
    await expect(tid(page, 'tag-block')).toBeVisible()
    await tid(page, 'q-form').selectOption('T4')
    const lns4 = await optionTexts(tid(page, 'q-unit'))
    expect(lns4.filter((o) => o.endsWith('(perlu semakan)'))).toHaveLength(3) // 1.0, 3.0, 4.0
    await tid(page, 'q-form').selectOption('T5')
    await tid(page, 'q-unit').selectOption('LNS:T5:u:7.0')
    await page.locator('[data-testid^="sp-option-"]').first().click()
    await tid(page, 'q-tp').selectOption('3')
    await expect(tid(page, 'tp-descriptor')).toContainText('Berlaku untuk TP 1-4')

    // Bahasa Melayu 4.0 prints no TP: the general table is the fallback, TP stays required.
    await gotoApp('/admin/spm/soalan/manual')
    await expect(tid(page, 'intake-subject')).toBeVisible()
    await tid(page, 'intake-subject').selectOption('BM')
    await tid(page, 'intake-source').fill('Kertas sekolah sendiri')
    await tid(page, 'intake-copyright').selectOption('sendiri')
    await tid(page, 'manual-start').click()
    await expect(tid(page, 'tag-block')).toBeVisible()
    await tid(page, 'q-form').selectOption('T4')
    await tid(page, 'q-unit').selectOption('BM:T4:u:1.0')
    await page.locator('[data-testid^="sp-option-"]').first().click()
    await tid(page, 'q-tp').selectOption('1')
    await expect(tid(page, 'tp-descriptor')).toContainText('TP 1 - Sangat Terhad')
    await tid(page, 'q-unit').selectOption('BM:T4:u:4.0')
    await page.locator('[data-testid^="sp-option-"]').first().click()
    await expect(tid(page, 'tp-descriptor')).toContainText('Mengikut jadual TP am subjek ini')
    await expect(tid(page, 'q-tp')).toHaveValue('1')

    // Bahasa Inggeris: 5.0 has no TP table and no general table; "No learning standard" slots are hidden.
    await gotoApp('/admin/spm/soalan/manual')
    await expect(tid(page, 'intake-subject')).toBeVisible()
    await tid(page, 'intake-subject').selectOption('BI')
    await tid(page, 'intake-source').fill('Kertas sekolah sendiri')
    await tid(page, 'intake-copyright').selectOption('sendiri')
    await tid(page, 'manual-start').click()
    await expect(tid(page, 'tag-block')).toBeVisible()
    await tid(page, 'q-form').selectOption('T4')
    await tid(page, 'q-unit').selectOption('BI:T4:u:5.0')
    await page.locator('[data-testid^="sp-option-"]').first().click()
    await tid(page, 'q-tp').selectOption('4')
    await expect(tid(page, 'tp-descriptor')).toContainText('Tiada penerangan TP dalam DSKP untuk unit ini.')
    await tid(page, 'q-form').selectOption('T5')
    await tid(page, 'q-unit').selectOption('BI:T5:u:1.0')
    await expect(tid(page, 'sp-option-1.1.4')).toHaveCount(0)
    await expect(tid(page, 'sp-option-1.1.5')).toHaveCount(0)
    await expect(tid(page, 'sp-option-1.1.1')).toBeVisible()
    await expectNoHorizontalScroll(page)
  })

  test('AC-02.1 AC-02.2 AC-01.2: Katering picks its TP table by SK, Sejarah shows one descriptor per SK, Pendidikan Moral groups by Bidang', async ({
    page,
    loginAs,
    gotoApp,
  }) => {
    await loginAs(ADMIN)
    // Katering Modul 1.0: two tables (SK 1.1; SK 1.2 and 1.3).
    const kpj = load('katering-dan-penyajian').units.find((u) => u.tingkatan === 'T4' && u.code === '1.0')!
    expect(kpj.tp).toHaveLength(2)
    const textFor = (sk: string): string =>
      kpj.tp!.find((t) => t.appliesToSk?.includes(sk))!.rows.find((r) => r.tp === 3)!.text
    await startManual(page, gotoApp, 'KPJ')
    await tid(page, 'q-form').selectOption('T4')
    await tid(page, 'q-unit').selectOption('KPJ:T4:u:1.0')
    await tid(page, 'q-tp').selectOption('3')
    await tid(page, 'sp-option-1.1.1').click()
    await expect(tid(page, 'tp-descriptor')).toContainText(textFor('1.1').slice(0, 50))
    await tid(page, 'sp-remove-1.1.1').click()
    await tid(page, 'sp-option-1.2.1').click()
    await expect(tid(page, 'tp-descriptor')).toContainText(textFor('1.2').slice(0, 50))
    expect(textFor('1.1')).not.toEqual(textFor('1.2'))

    // Sejarah: TP descriptor per SK; SPs of two SK give two blocks.
    await gotoApp('/admin/spm/soalan/manual')
    await expect(tid(page, 'intake-subject')).toBeVisible()
    await tid(page, 'intake-subject').selectOption('SEJ')
    await tid(page, 'intake-source').fill('Kertas sekolah sendiri')
    await tid(page, 'intake-copyright').selectOption('sendiri')
    await tid(page, 'manual-start').click()
    await expect(tid(page, 'tag-block')).toBeVisible()
    await tid(page, 'q-form').selectOption('T4')
    const groups = await tid(page, 'q-unit')
      .locator('optgroup')
      .evaluateAll((gs) => gs.map((g) => g.getAttribute('label')))
    expect(groups).toHaveLength(1) // one Tema per tingkatan, as printed
    await tid(page, 'q-unit').selectOption('SEJ:T4:u:Tajuk 9')
    // An SK-level subject needs the SP before it can show a descriptor.
    await expect(tid(page, 'tp-descriptor')).toContainText('Pilih unit dan SP untuk melihat penerangan TP.')
    await tid(page, 'q-tp').selectOption('3')
    await expect(tid(page, 'tp-descriptor')).toContainText('Pilih unit dan SP untuk melihat penerangan TP.')
    await tid(page, 'sp-option-9.1.1').click()
    await tid(page, 'sp-option-9.2.1').click()
    await expect(tid(page, 'tp-descriptor')).toContainText('Mengikut SK 9.1')
    await expect(tid(page, 'tp-descriptor')).toContainText('Mengikut SK 9.2')
    await expect(tid(page, 'q-sk').locator('[data-testid="sk-row"]')).toHaveCount(2)
    // K-coded SP (citizenship) is selectable.
    await tid(page, 'sp-search').fill('K9.3.8')
    await tid(page, 'sp-option-K9.3.8').click()
    await expect(tid(page, 'sp-chip-K9.3.8')).toBeVisible()
    await expect(tid(page, 'q-sk').locator('[data-testid="sk-row"]')).toHaveCount(3)

    // Pendidikan Moral: unit = SK (5.1), grouped under "5.0 INSAN BERMORAL".
    await gotoApp('/admin/spm/soalan/manual')
    await expect(tid(page, 'intake-subject')).toBeVisible()
    await tid(page, 'intake-subject').selectOption('PM')
    await tid(page, 'intake-source').fill('Kertas sekolah sendiri')
    await tid(page, 'intake-copyright').selectOption('sendiri')
    await tid(page, 'manual-start').click()
    await expect(tid(page, 'tag-block')).toBeVisible()
    await tid(page, 'q-form').selectOption('T4')
    const pmGroups = await tid(page, 'q-unit')
      .locator('optgroup')
      .evaluateAll((gs) => gs.map((g) => g.getAttribute('label')))
    expect(pmGroups).toEqual(['5.0 INSAN BERMORAL', '6.0 JATI DIRI MORAL', '7.0 MORAL DAN KENEGARAAN'])
    expect(await optionTexts(tid(page, 'q-unit'))).toContain('5.1 - Norma Masyarakat')
    await expectNoHorizontalScroll(page)
  })
})
