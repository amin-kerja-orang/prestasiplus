// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  BOOT_ERROR_TITLE,
  BOOT_RELOAD_LABEL,
  BOOT_SLOW_MESSAGE,
  showBootError,
  watchSlowBoot,
} from '../boot-error'

beforeEach(() => {
  document.body.innerHTML =
    '<div id="app"><div id="pp-splash"><b>PRESTASIPLUS</b><span>Memuatkan…</span></div></div>'
  vi.spyOn(console, 'error').mockImplementation(() => undefined)
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('boot error UI', () => {
  it('shows a visible alert with a reload button, once', () => {
    showBootError(new Error('boom'))
    showBootError()
    const panels = document.querySelectorAll('#pp-boot-error')
    expect(panels).toHaveLength(1)
    expect(panels[0]?.getAttribute('role')).toBe('alert')
    expect(panels[0]?.textContent).toContain(BOOT_ERROR_TITLE)
    expect(panels[0]?.querySelector('button')?.textContent).toBe(BOOT_RELOAD_LABEL)
  })

  it('swaps the splash text for the slow notice after the delay', () => {
    vi.useFakeTimers()
    watchSlowBoot(1000)
    expect(document.querySelector('#pp-splash button')).toBeNull()
    vi.advanceTimersByTime(1000)
    expect(document.querySelector('#pp-splash span')?.textContent).toBe(BOOT_SLOW_MESSAGE)
    expect(document.querySelector('#pp-splash button')?.textContent).toBe(BOOT_RELOAD_LABEL)
  })

  it('does nothing once the splash is gone (the app mounted)', () => {
    vi.useFakeTimers()
    watchSlowBoot(1000)
    document.getElementById('pp-splash')?.remove()
    vi.advanceTimersByTime(1000)
    expect(document.getElementById('pp-boot-error')).toBeNull()
    expect(document.body.textContent).not.toContain(BOOT_SLOW_MESSAGE)
  })
})
