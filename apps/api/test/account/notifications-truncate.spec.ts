import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { NotificationsService } from '../../src/modules/notifications'
import { NOTIFICATION_LIMITS } from '../../src/modules/notifications/notifications.constants'
import { userIdOf } from '../auth/helpers'
import { type AccountTestApp, bootAccountApp } from './account-helpers'

describe('NotificationsService.push truncates by whole code points', () => {
  let t: AccountTestApp

  beforeAll(async () => {
    t = await bootAccountApp({ realNotices: true })
  })
  afterAll(async () => {
    await t.close()
  })

  const LONE = /[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/

  it.each([
    ['body', NOTIFICATION_LIMITS.body],
    ['title', NOTIFICATION_LIMITS.title],
  ] as const)('a %s full of surrogate pairs is cut without splitting one', async (field, max) => {
    const userId = await userIdOf(t.db, 'pelajar@demo.test')
    const service = t.app.get(NotificationsService, { strict: false })
    const emoji = '😀'.repeat(max) // 2 * max UTF-16 units: always over the limit
    for (const pad of ['', 'x']) {
      const input = { type: 'ujian', title: field === 'title' ? pad + emoji : 'Tajuk', body: field === 'body' ? pad + emoji : 'Isi' }
      const item = await service.push(userId, input)
      const value = item[field]
      expect(value.length).toBeLessThanOrEqual(max)
      expect(value.endsWith('…')).toBe(true)
      expect(LONE.test(value)).toBe(false)
    }
  })
})
