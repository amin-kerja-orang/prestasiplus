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
  it('orders equal accuracy by Bab number, not by accuracy or name', () => {
    expect(m25Hooks.loadFixture('m25-ties')).toBe(30)
    const [subject] = heatmap.forUser(3)
    expect(subject?.name).toBe('Matematik')
    const tried = subject?.chapters.filter((c) => c.state !== 'belum-cuba') ?? []
    expect(tried.map((t) => [t.id, t.number, t.attempts, t.accuracy, t.state])).toEqual([
      ['91', 1, 10, 50, 'amber'],
      ['92', 2, 10, 50, 'amber'],
      ['220', 3, 10, 50, 'amber'],
    ])
    const numbers = subject?.chapters.map((c) => c.number) ?? []
    expect(numbers).toEqual([...numbers].sort((a, b) => (a ?? Infinity) - (b ?? Infinity)))
  })
})
