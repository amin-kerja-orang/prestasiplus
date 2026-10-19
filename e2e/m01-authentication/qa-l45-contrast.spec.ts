/**
 * L45 G5 QA additions: readable headings on the gradient headers of S1 (hero) and S2 (valid and
 * invalid card). D9 "unreadable text"; SRS FR-L45-05 (white hero text), FR-L45-19 (OBSERVED live:
 * white H1 on the slate header, terima-invalid-token-desktop.png). Large text needs >= 3:1 against
 * every stop of the gradient.
 */

import type { Page } from '@playwright/test'

import { expect, test } from '../fixtures/test'
import { actAs, moduleTag } from '../support'

function luminance([r = 0, g = 0, b = 0]: number[]): number {
  const c = [r, g, b].map((v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * c[0]! + 0.7152 * c[1]! + 0.0722 * c[2]!
}
function contrast(a: number[], b: number[]): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi! + 0.05) / (lo! + 0.05)
}
const nums = (s: string): number[] => (s.match(/[\d.]+/g) ?? []).slice(0, 3).map(Number)

/** Colour of an element and the rgb stops of the nearest gradient behind it. */
async function headingColours(page: Page, selector: string) {
  return page.locator(selector).evaluate((el) => {
    let p: HTMLElement | null = el as HTMLElement
    let bg = ''
    while (p) {
      const b = getComputedStyle(p).backgroundImage
      if (b && b !== 'none') {
        bg = b
        break
      }
      p = p.parentElement
    }
    return { color: getComputedStyle(el).color, bg }
  })
}

async function expectReadable(page: Page, selector: string): Promise<void> {
  const { color, bg } = await headingColours(page, selector)
  const stops = bg.match(/rgb\([^)]*\)/g) ?? []
  expect(stops.length, `no gradient found behind ${selector}`).toBeGreaterThanOrEqual(2)
  for (const stop of stops) {
    expect(
      contrast(nums(color), nums(stop)),
      `${selector} colour ${color} on ${stop}`,
    ).toBeGreaterThanOrEqual(3)
  }
}

test.describe('L45 QA: gradient heading contrast', { tag: [moduleTag(1)] }, () => {
  test.use({ mockInit: { latency: 0 } })
  test.slow()

  test('S1 hero H1 is white and readable', async ({ page, loginAs, gotoApp }) => {
    await loginAs('pelajar2@demo.test')
    await gotoApp('/jemput-ibu-bapa')
    await expect(page.getByTestId('jemput-hero')).toBeVisible()
    await expectReadable(page, '[data-testid=jemput-hero] h1')
    expect(await page.locator('[data-testid=jemput-hero] h1').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(255, 255, 255)')
  })

  test('S2 invalid page H1 is white (OBSERVED live) and readable', async ({ page, gotoApp }) => {
    await gotoApp('/ibu-bapa/terima/0000')
    await expect(page.getByTestId('invite-invalid')).toBeVisible()
    await expectReadable(page, '[data-testid=invite-invalid] h1')
    expect(await page.locator('[data-testid=invite-invalid] h1').evaluate((e) => getComputedStyle(e).color)).toBe('rgb(255, 255, 255)')
  })

  test('S2 valid card H1 is readable (guest state)', async ({ page, gotoApp, mock }) => {
    await gotoApp('/login')
    await mock.hook('setParentInviteToken', 3, 'a3'.repeat(32))
    await actAs(page, mock, gotoApp, null, `/ibu-bapa/terima/${'a3'.repeat(32)}`)
    await expect(page.getByTestId('invite-heading')).toBeVisible()
    await expectReadable(page, '[data-testid=invite-heading]')
  })
})
