/** M25-T1: the `m25-ties` fixture alone (SRS M25 v1.2 §6.7 F), on a fresh runtime. */

import { beforeAll, describe, expect, it } from 'vitest'

import { CLOCK_ANCHOR_ISO, clock as globalClock, createClock } from '@/lib/time'
import { bootMock } from '@/mock/index'
import m01 from '@/modules/m01-authentication/mock'
import m02 from '@/modules/m02-users-schools/mock'
import m03 from '@/modules/m03-curriculum/mock'
import m04 from '@/modules/m04-question-bank/mock'
import m05 from '@/modules/m05-practice/mock'

import m25, { heatmap } from '../mock'
import { m25Hooks } from '../mock/hooks'

beforeAll(async () => {
  await bootMock({
    mode: 'test',
    plugins: [m01, m02, m03, m04, m05, m25],
    clock: createClock({ at: CLOCK_ANCHOR_ISO }),
    latencyMs: 0,
    onWarn: null,
  })
  globalClock.setNow(CLOCK_ANCHOR_ISO)
}, 600_000)

describe('m25-ties', () => {
  it('orders equal accuracy by topic name', () => {
    expect(m25Hooks.loadFixture('m25-ties')).toBe(30)
    const topics = heatmap.forUser(3).flatMap((s) => s.topics)
    expect(topics.map((t) => [t.chapterId, t.name, t.attempts, t.percent])).toEqual([
      [14, 'Aspek Tatabahasa D3', 10, 50],
      [12, 'Kemahiran Membaca D3', 10, 50],
      [13, 'Kemahiran Menulis D3', 10, 50],
    ])
  })
})
