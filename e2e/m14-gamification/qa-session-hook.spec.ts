/**
 * QA additions (G5, Session 5): E2E-M14-28 via the `gamificationSession` test hook (deferred in student-a).
 * pelajar2 (userId 3) at 26/09 09:00: random 6/10 in 5 min, then a second session of 5 correct.
 */
import { expect, test } from '../fixtures/test'
import { expectNoHorizontalScroll, moduleTag, provisional } from '../support'

test.use({ mockInit: { latency: 0 } })

test.describe('M14 QA E2E-M14-28', { tag: [moduleTag(14)] }, () => {
  test(
    'E2E-M14-28 gamificationSession pays challenges and Langkah Pertama; second session pays Kilat only',
    provisional('FN-M14-4.2.2 / 4.3.1 payouts are INFERRED / PROPOSED', [moduleTag(14)]),
    async ({ page, gotoApp, loginAs, mock }) => {
      await loginAs(3)
      await gotoApp('/gamification/history')
      await mock.setNow('2026-09-26T09:00:00+08:00')
      const r1 = await mock.hook<Record<string, unknown>>('gamificationSession', 3, {
        mode: 'random',
        correct: 6,
        total: 10,
        timeSpentSec: 300,
      })
      expect(r1).toBeTruthy()

      await gotoApp('/gamification/challenges')
      expect(new Date(await mock.now()).toISOString().slice(0, 10)).toBe('2026-09-26')
      await expect(page.getByTestId('s13-counter-value')).toHaveText('2/10')

      await gotoApp('/gamification/history')
      await expect(page.getByTestId('s17-row').first()).toBeVisible()
      const descs = await page.getByTestId('s17-row-desc').allTextContents()
      const amounts = await page.getByTestId('s17-row-amount').allTextContents()
      const pair = (d: string) => amounts[descs.indexOf(d)]
      expect(pair('Latih Tubi: 6 betul — 60%')).toBe('+6')
      expect(pair('Cabaran selesai: Mula Hari Ini')).toBe('+10')
      expect(pair('Cabaran selesai: Jawab 5 Betul')).toBe('+12')
      expect(pair('Pencapaian: Langkah Pertama')).toBe('+5')
      await expect(page.getByTestId('s17-balance')).toHaveText('Baki semasa: 33 syiling')

      await mock.hook('gamificationSession', 3, {
        mode: 'random',
        correct: 5,
        total: 5,
        timeSpentSec: 120,
      })
      await gotoApp('/gamification/history')
      await expect(page.getByTestId('s17-row').first()).toBeVisible()
      const d2 = await page.getByTestId('s17-row-desc').allTextContents()
      const a2 = await page.getByTestId('s17-row-amount').allTextContents()
      expect(d2.filter((d) => d === 'Cabaran selesai: Mula Hari Ini')).toHaveLength(1)
      expect(d2.filter((d) => d === 'Pencapaian: Langkah Pertama')).toHaveLength(1)
      const kilat = d2.findIndex((d) => d.includes('Kilat Matematik'))
      expect(kilat).toBeGreaterThanOrEqual(0)
      expect(a2[kilat]).toBe('+30')
      await expectNoHorizontalScroll(page)
    },
  )
})
