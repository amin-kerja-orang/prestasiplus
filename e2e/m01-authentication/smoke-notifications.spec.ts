/**
 * M01-T2 developer smoke (no E2E ids; QA writes E2E-M01-37/49 at G5): the notification mock feeds
 * the user-shell bell. Opened on a probe route because the S11 screen and the M01 routes belong to
 * later tasks.
 */

import { expect, test } from '../fixtures/test'
import { moduleTag, openProbeRoute, provisional, TAG } from '../support'

const PROBE = { path: '/__e2e/m01-bell', layout: 'user', access: 'auth' } as const

test.describe('M01 notifications mock', { tag: [TAG.smoke, moduleTag(1)] }, () => {
  test.use({ mockInit: { latency: 0 } })

  test(
    'bell badge shows the unread count per account (probe route)',
    provisional('probe route until M01-T5a/T8 build the bell integration and S11'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/')
      await openProbeRoute(page, PROBE)
      await expect(page.getByTestId('shell-user-bell-badge').first()).toHaveText('12')
    },
  )

  test(
    'ibubapa (empty inbox) sees the bell with no badge (probe route)',
    provisional('probe route until M01-T5a/T8 build the bell integration and S11'),
    async ({ page, loginAs, gotoApp }) => {
      await loginAs('ibubapa@demo.test')
      await gotoApp('/')
      await openProbeRoute(page, PROBE)
      await expect(page.getByTestId('shell-user-bell')).toBeVisible()
      await expect(page.getByTestId('shell-user-bell-badge')).toHaveCount(0)
    },
  )

  test(
    'pushNotification raises the count at the next 60 s refresh (probe route)',
    provisional('probe route until M01-T5a/T8 build the bell integration and S11'),
    async ({ page, loginAs, gotoApp, mock }) => {
      await loginAs('pelajar@demo.test')
      await gotoApp('/')
      await openProbeRoute(page, PROBE)
      const badge = page.getByTestId('shell-user-bell-badge').first()
      await expect(badge).toHaveText('12')

      await mock.hook(
        'pushNotification',
        2,
        { title: 'Ujian', body: 'Notifikasi ujian' },
        {
          push: false,
        },
      )
      await mock.advanceTime(60_000)
      await expect(badge).toHaveText('13')
    },
  )
})
