/** BE-48: the heatmap read is limited per user (own `heatmap.read` bucket, ceiling `THROTTLE_PRACTICE_READ_PER_MINUTE`). */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import type { CurriculumTestApp } from '../curriculum/helpers'
import { HEATMAP, bootHeatmapApp, loginAs } from './helpers'

describe('heatmap rate limit', () => {
  let t: CurriculumTestApp
  beforeAll(async () => {
    t = await bootHeatmapApp({ env: { THROTTLE_PRACTICE_READ_PER_MINUTE: '2' } })
  }, 300_000)
  afterAll(async () => {
    await t?.close()
    process.env.THROTTLE_PRACTICE_READ_PER_MINUTE = '100000'
  })

  it('the third read in a minute is 429 RATE_LIMITED; another user has their own counter', async () => {
    const a = await loginAs(t, 'pelajar@demo.test')
    expect((await a.get(HEATMAP)).status).toBe(200)
    expect((await a.get(HEATMAP)).status).toBe(200)
    const third = await a.get(HEATMAP)
    expect(third.status).toBe(429)
    expect(third.body.error.code).toBe('RATE_LIMITED')
    const b = await loginAs(t, 'admin@demo.test')
    expect((await b.get(HEATMAP)).status).toBe(200)
  })
})
