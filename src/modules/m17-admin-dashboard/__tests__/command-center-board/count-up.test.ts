// @vitest-environment jsdom
/** `useCountUp` (FR-M17-21): "--" first, 800 ms ease-out, and an interrupted animation restarts from the value on screen. */
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, ref } from 'vue'

import { useCountUp } from '../../components/command-center-board/composables'

const target = ref<number | null>(null)
const Probe = defineComponent({
  setup() {
    const shown = useCountUp(target)
    return () => h('span', shown.value)
  },
})
const num = (text: string) => Number(text.replace(/,/g, ''))

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setInterval', 'clearInterval', 'Date'] })
  vi.setSystemTime(new Date('2026-09-25T15:40:00+08:00'))
  target.value = null
})
afterEach(() => vi.useRealTimers())

describe('useCountUp', () => {
  it('shows "--" until the first value, then counts up and ends exactly on it', async () => {
    const w = mount(Probe)
    expect(w.text()).toBe('--')
    target.value = 1000
    await vi.advanceTimersByTimeAsync(400)
    expect(num(w.text())).toBeGreaterThan(0)
    expect(num(w.text())).toBeLessThan(1000)
    await vi.advanceTimersByTimeAsync(600)
    expect(w.text()).toBe('1,000')
    w.unmount()
  })

  it('starts an interrupting animation from the displayed value, not from the previous target', async () => {
    const w = mount(Probe)
    target.value = 1000
    await vi.advanceTimersByTimeAsync(1000)
    target.value = 2000
    await vi.advanceTimersByTimeAsync(400)
    const mid = num(w.text())
    expect(mid).toBeGreaterThan(1000)
    expect(mid).toBeLessThan(2000)
    // interrupted downwards: the next animation starts at `mid`, never above it
    target.value = 1200
    await vi.advanceTimersByTimeAsync(40)
    expect(num(w.text())).toBeLessThanOrEqual(mid)
    await vi.advanceTimersByTimeAsync(1000)
    expect(w.text()).toBe('1,200')
    w.unmount()
  })
})
