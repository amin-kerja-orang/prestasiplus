// @vitest-environment jsdom
import { createPinia, setActivePinia } from 'pinia'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { effectScope, nextTick, ref } from 'vue'

import * as overlay from '@/components/overlay'

import {
  alertNative,
  confirmNative,
  useClickOutside,
  useDebounce,
  useDebouncedRef,
  useFlash,
  useIntervalWhileVisible,
  usePageMeta,
  useSession,
} from '..'

function setVisibility(state: DocumentVisibilityState): void {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => state })
  document.dispatchEvent(new Event('visibilitychange'))
}

beforeEach(() => {
  setActivePinia(createPinia())
  localStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  document.body.innerHTML = ''
  setVisibility('visible')
})

describe('native dialog re-exports', () => {
  it('are the F-15 functions, not copies', () => {
    expect(confirmNative).toBe(overlay.confirmNative)
    expect(alertNative).toBe(overlay.alertNative)
  })

  it('call window.confirm / window.alert with the exact message', () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const alert = vi.spyOn(window, 'alert').mockImplementation(() => undefined)
    expect(confirmNative('Padam soalan ini?')).toBe(false)
    alertNative('Sila pilih tindakan terlebih dahulu')
    expect(confirm).toHaveBeenCalledWith('Padam soalan ini?')
    expect(alert).toHaveBeenCalledWith('Sila pilih tindakan terlebih dahulu')
  })
})

describe('useFlash', () => {
  it('set before navigation, consumed after, exposed as flash', () => {
    const { flash, success, consume } = useFlash()
    success('Berjaya')
    expect(flash.value).toBeNull()
    consume()
    expect(flash.value).toEqual({ type: 'success', message: 'Berjaya' })
    consume()
    expect(flash.value).toBeNull()
  })
})

describe('useSession', () => {
  it('exposes the session state as refs', () => {
    const { isLoggedIn, user, store } = useSession()
    expect(isLoggedIn.value).toBe(false)
    expect(user.value).toBeNull()
    expect(typeof store.logout).toBe('function')
  })
})

describe('usePageMeta', () => {
  it('sets the tab title (formatted) and a dynamic header; reset clears them', () => {
    const meta = usePageMeta()
    meta.setTitle('Latihan Sejarah | PRESTASIPLUS')
    meta.setHeader({ title: 'Sejarah', subtitle: 'Bab 1' })
    expect(document.title).toBe('Latihan Sejarah | PRESTASIPLUS')
    expect(meta.state.title).toBe('Latihan Sejarah | PRESTASIPLUS')
    expect(usePageMeta().state.header).toEqual({ title: 'Sejarah', subtitle: 'Bab 1' })
    meta.reset()
    expect(meta.state.title).toBeNull()
    expect(meta.state.header).toBeNull()
  })
})

describe('useDebounce', () => {
  it('runs the last call once after the delay; cancel and flush work', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const scope = effectScope()
    const debounced = scope.run(() => useDebounce(fn, 300))!

    debounced('a')
    debounced('b')
    expect(debounced.pending.value).toBe(true)
    vi.advanceTimersByTime(299)
    expect(fn).not.toHaveBeenCalled()
    vi.advanceTimersByTime(1)
    expect(fn).toHaveBeenCalledExactlyOnceWith('b')

    debounced('c')
    debounced.cancel()
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledOnce()

    debounced('d')
    debounced.flush()
    expect(fn).toHaveBeenLastCalledWith('d')

    debounced('e')
    scope.stop()
    vi.advanceTimersByTime(1000)
    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('useDebouncedRef follows the source after it settles', async () => {
    vi.useFakeTimers()
    const source = ref('a')
    const scope = effectScope()
    const debounced = scope.run(() => useDebouncedRef(source, 300))!
    source.value = 'ab'
    await nextTick()
    vi.advanceTimersByTime(200)
    expect(debounced.value).toBe('a')
    vi.advanceTimersByTime(100)
    expect(debounced.value).toBe('ab')
    scope.stop()
  })
})

describe('useClickOutside', () => {
  it('calls the handler for clicks outside the targets only', () => {
    const inside = document.createElement('div')
    const child = document.createElement('span')
    inside.append(child)
    const outside = document.createElement('p')
    document.body.append(inside, outside)
    const handler = vi.fn()
    const enabled = ref(true)
    const scope = effectScope()
    scope.run(() => useClickOutside(ref(inside), handler, { enabled }))

    child.click()
    expect(handler).not.toHaveBeenCalled()
    outside.click()
    expect(handler).toHaveBeenCalledOnce()

    enabled.value = false
    outside.click()
    expect(handler).toHaveBeenCalledOnce()

    enabled.value = true
    scope.stop()
    outside.click()
    expect(handler).toHaveBeenCalledOnce()
  })

  it('ignores clicks on nodes removed during the click', () => {
    const target = document.createElement('div')
    const removed = document.createElement('button')
    removed.addEventListener('click', () => removed.remove())
    document.body.append(target, removed)
    const handler = vi.fn()
    const stop = useClickOutside(target, handler)
    removed.click()
    expect(handler).not.toHaveBeenCalled()
    stop()
  })
})

describe('useIntervalWhileVisible', () => {
  it('ticks every interval while visible, pauses while hidden, stops on dispose', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const scope = effectScope()
    const poll = scope.run(() => useIntervalWhileVisible(fn, 60_000))!
    expect(poll.active.value).toBe(true)

    vi.advanceTimersByTime(120_000)
    expect(fn).toHaveBeenCalledTimes(2)

    setVisibility('hidden')
    expect(poll.active.value).toBe(false)
    vi.advanceTimersByTime(180_000)
    expect(fn).toHaveBeenCalledTimes(2)

    setVisibility('visible')
    vi.advanceTimersByTime(60_000)
    expect(fn).toHaveBeenCalledTimes(3)

    scope.stop()
    vi.advanceTimersByTime(120_000)
    expect(fn).toHaveBeenCalledTimes(3)
    setVisibility('visible')
    expect(poll.active.value).toBe(false)
  })

  it('immediate: true calls once at start', () => {
    vi.useFakeTimers()
    const fn = vi.fn()
    const poll = useIntervalWhileVisible(fn, 30_000, { immediate: true })
    expect(fn).toHaveBeenCalledOnce()
    poll.stop()
  })
})
