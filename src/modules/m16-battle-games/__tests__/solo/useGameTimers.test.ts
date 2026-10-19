// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h } from 'vue'

import { useGameTimers } from '../../components/solo/useGameTimers'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function host() {
  let timers!: ReturnType<typeof useGameTimers>
  const wrapper = mount(
    defineComponent({
      setup() {
        timers = useGameTimers()
        return () => h('div')
      },
    }),
  )
  return { wrapper, timers }
}

describe('useGameTimers', () => {
  it('runs and clears timers while mounted', async () => {
    const { wrapper, timers } = host()
    const fn = vi.fn()
    timers.after(fn, 100)
    const id = timers.every(fn, 1000)
    await vi.advanceTimersByTimeAsync(1000)
    expect(fn).toHaveBeenCalledTimes(2)
    timers.clearEvery(id)
    expect(vi.getTimerCount()).toBe(0)
    wrapper.unmount()
  })

  it('clears every timer on unmount and schedules nothing after it', async () => {
    const { wrapper, timers } = host()
    const fn = vi.fn()
    timers.after(fn, 500)
    timers.every(fn, 100)
    wrapper.unmount()
    expect(timers.isDisposed()).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
    expect(timers.after(fn, 10)).toBeNull()
    expect(timers.every(fn, 10)).toBeNull()
    await vi.advanceTimersByTimeAsync(5000)
    expect(fn).not.toHaveBeenCalled()
  })
})
