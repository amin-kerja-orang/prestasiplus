// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, effectScope, h, ref } from 'vue'

import { useSearchPicker, type SearchPicker } from '../useSearchPicker'

interface School {
  id: number
  name: string
}

const SCHOOLS: School[] = [
  { id: 900001, name: 'SMK DEMO' },
  { id: 900002, name: 'SK Demo' },
]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
  document.body.innerHTML = ''
})

describe('useSearchPicker', () => {
  it('debounces the search by 300 ms and searches the last term only', async () => {
    const search = vi.fn((term: string) =>
      Promise.resolve(SCHOOLS.filter((s) => s.name.includes(term))),
    )
    const scope = effectScope()
    const picker = scope.run(() => useSearchPicker({ search, minChars: 2 }))!

    picker.setTerm('SM')
    await vi.advanceTimersByTimeAsync(200)
    picker.setTerm('SMK')
    await vi.advanceTimersByTimeAsync(299)
    expect(search).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    expect(search).toHaveBeenCalledOnce()
    expect(search.mock.calls[0]?.[0]).toBe('SMK')
    await vi.waitFor(() => expect(picker.results.value).toEqual([SCHOOLS[0]]))
    expect(picker.open.value).toBe(true)
    scope.stop()
  })

  it('honours a custom debounce', async () => {
    const search = vi.fn(() => Promise.resolve(SCHOOLS))
    const scope = effectScope()
    const picker = scope.run(() => useSearchPicker({ search, minChars: 1, debounceMs: 500 }))!
    picker.setTerm('S')
    await vi.advanceTimersByTimeAsync(300)
    expect(search).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(200)
    expect(search).toHaveBeenCalledOnce()
    scope.stop()
  })

  it('does not search below min chars and clears results and pending searches', async () => {
    const search = vi.fn(() => Promise.resolve(SCHOOLS))
    const scope = effectScope()
    const picker = scope.run(() => useSearchPicker({ search, minChars: 3 }))!

    picker.setTerm('SM')
    await vi.advanceTimersByTimeAsync(1000)
    expect(search).not.toHaveBeenCalled()

    picker.setTerm('SMK')
    await vi.advanceTimersByTimeAsync(300)
    await vi.waitFor(() => expect(picker.results.value).toHaveLength(2))

    picker.setTerm('SMKX')
    picker.setTerm('S')
    await vi.advanceTimersByTimeAsync(1000)
    expect(search).toHaveBeenCalledOnce()
    expect(picker.results.value).toEqual([])
    expect(picker.term.value).toBe('S')
    scope.stop()
  })

  it('shows "searching" while in flight and drops a stale response', async () => {
    const resolvers: ((value: School[]) => void)[] = []
    const signals: AbortSignal[] = []
    const search = vi.fn((_term: string, signal: AbortSignal) => {
      signals.push(signal)
      return new Promise<School[]>((resolve) => resolvers.push(resolve))
    })
    const scope = effectScope()
    const picker = scope.run(() => useSearchPicker({ search, minChars: 1 }))!

    picker.setTerm('S')
    await vi.advanceTimersByTimeAsync(300)
    expect(picker.searching.value).toBe(true)

    picker.setTerm('SK')
    await vi.advanceTimersByTimeAsync(300)
    expect(signals[0]?.aborted).toBe(true)

    resolvers[1]?.([SCHOOLS[1]!])
    await vi.waitFor(() => expect(picker.searching.value).toBe(false))
    resolvers[0]?.(SCHOOLS)
    await Promise.resolve()
    expect(picker.results.value).toEqual([SCHOOLS[1]])
    scope.stop()
  })

  it('opens on focus, and select() stores the item and closes', () => {
    const onSelect = vi.fn()
    const scope = effectScope()
    const picker = scope.run(() =>
      useSearchPicker({ search: () => Promise.resolve(SCHOOLS), minChars: 1, onSelect }),
    )!
    picker.onFocus()
    expect(picker.open.value).toBe(true)
    picker.select(SCHOOLS[0]!)
    expect(picker.selected.value).toEqual(SCHOOLS[0])
    expect(picker.open.value).toBe(false)
    expect(onSelect).toHaveBeenCalledWith(SCHOOLS[0])
    scope.stop()
  })

  it('closes on a click outside the root, not on a click inside', async () => {
    let picker!: SearchPicker<School>
    const Host = defineComponent({
      setup() {
        const root = ref<HTMLElement | null>(null)
        picker = useSearchPicker({ search: () => Promise.resolve(SCHOOLS), minChars: 1, root })
        return () =>
          h('div', [
            h('div', { ref: root, 'data-testid': 'root' }, [
              h('input', { 'data-testid': 'input' }),
            ]),
            h('p', { 'data-testid': 'outside' }, 'luar'),
          ])
      },
    })
    const wrapper = mount(Host, { attachTo: document.body })

    picker.onFocus()
    await wrapper.get('[data-testid="input"]').trigger('click')
    expect(picker.open.value).toBe(true)

    await wrapper.get('[data-testid="outside"]').trigger('click')
    expect(picker.open.value).toBe(false)
    wrapper.unmount()
  })
})
