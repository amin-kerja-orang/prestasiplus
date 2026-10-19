// @vitest-environment jsdom
import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, h, nextTick, ref, type Ref } from 'vue'

import {
  defaultPreference,
  readStoredPreference,
  resetThemeModeForTests,
  resolveScheme,
  THEME_STORAGE_KEY,
  useThemeMode,
  type Personality,
  type ThemeMode,
} from '../color-mode'

describe('pure helpers', () => {
  it('defaults: every portal follows the system', () => {
    expect(defaultPreference('learner')).toBe('system')
    expect(defaultPreference('staff')).toBe('system')
  })

  it('resolves system against the OS scheme', () => {
    expect(resolveScheme('system', true)).toBe('dark')
    expect(resolveScheme('system', false)).toBe('light')
    expect(resolveScheme('light', true)).toBe('light')
    expect(resolveScheme('dark', false)).toBe('dark')
  })

  it('ignores junk in storage', () => {
    expect(readStoredPreference({ getItem: () => 'purple' })).toBeNull()
    expect(readStoredPreference({ getItem: () => 'dark' })).toBe('dark')
    expect(
      readStoredPreference({
        getItem: () => {
          throw new Error('blocked')
        },
      }),
    ).toBeNull()
  })
})

describe('useThemeMode', () => {
  const wrappers: VueWrapper[] = []
  const root = document.documentElement

  function mountPortal(personality: Personality | Ref<Personality>): ThemeMode {
    let api!: ThemeMode
    wrappers.push(
      mount(
        defineComponent({
          setup() {
            api = useThemeMode(personality)
            return () => h('div')
          },
        }),
      ),
    )
    return api
  }

  /** Installs a controllable `prefers-color-scheme` mock; returns a function that flips it. */
  function mockSystemScheme(initialDark: boolean): (dark: boolean) => void {
    let listener: ((event: { matches: boolean }) => void) | null = null
    vi.stubGlobal(
      'matchMedia',
      vi.fn(() => ({
        matches: initialDark,
        addEventListener: (_: string, fn: (event: { matches: boolean }) => void) => {
          listener = fn
        },
      })),
    )
    return (dark) => listener?.({ matches: dark })
  }

  beforeEach(() => {
    localStorage.clear()
    resetThemeModeForTests()
  })
  afterEach(() => {
    while (wrappers.length > 0) wrappers.pop()?.unmount()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
    root.className = ''
    root.removeAttribute('data-personality')
  })

  it('learner follows the OS by default and marks <html>; unmount restores legacy state', async () => {
    mockSystemScheme(true)
    mountPortal('learner')
    await nextTick()
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.dataset.personality).toBe('learner')
    wrappers.pop()?.unmount()
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.dataset.personality).toBeUndefined()
    expect(root.style.colorScheme).toBe('')
  })

  it('staff with no stored choice and a light OS stays light', async () => {
    const api = mountPortal('staff')
    await nextTick()
    expect(root.classList.contains('dark')).toBe(false)
    expect(api.preference.value).toBe('system')
  })

  it('system follows the OS, including a change event', async () => {
    const flip = mockSystemScheme(true)
    mountPortal('staff')
    await nextTick()
    expect(root.classList.contains('dark')).toBe(true)
    flip(false)
    await nextTick()
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.style.colorScheme).toBe('light')
  })

  it('toggle stores the choice under pp.theme and flips .dark', async () => {
    mockSystemScheme(true)
    const api = mountPortal('learner')
    await nextTick()
    api.toggle()
    await nextTick()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(root.classList.contains('dark')).toBe(false)
    api.setPreference('dark')
    await nextTick()
    expect(root.classList.contains('dark')).toBe(true)
  })

  it('a blocked setItem still applies the choice for this page view', async () => {
    const api = mountPortal('learner')
    await nextTick()
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(() => {
      api.setPreference('light')
    }).not.toThrow()
    await nextTick()
    expect(root.classList.contains('dark')).toBe(false)
    expect(api.preference.value).toBe('light')
  })

  it('follows a personality ref (staff to learner swap)', async () => {
    const personality = ref<Personality>('staff')
    mountPortal(personality)
    await nextTick()
    expect(root.dataset.personality).toBe('staff')
    expect(root.classList.contains('dark')).toBe(false)
    personality.value = 'learner'
    await nextTick()
    expect(root.dataset.personality).toBe('learner')
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('overlapping layouts: unmounting the older one keeps the newer personality', async () => {
    mockSystemScheme(true)
    mountPortal('staff')
    mountPortal('learner')
    await nextTick()
    expect(root.dataset.personality).toBe('learner')
    wrappers.shift()?.unmount()
    await nextTick()
    expect(root.dataset.personality).toBe('learner')
    expect(root.classList.contains('dark')).toBe(true)
    wrappers.pop()?.unmount()
    expect(root.dataset.personality).toBeUndefined()
  })

  it('picks up a change made in another tab (storage event)', async () => {
    mountPortal('learner')
    await nextTick()
    localStorage.setItem(THEME_STORAGE_KEY, 'light')
    window.dispatchEvent(new StorageEvent('storage', { key: THEME_STORAGE_KEY }))
    await nextTick()
    expect(root.classList.contains('dark')).toBe(false)
  })

  it('writes only pp.theme, never the Nuxt UI colour-mode key', async () => {
    const api = mountPortal('staff')
    await nextTick()
    api.toggle()
    expect(Object.keys(localStorage)).toEqual([THEME_STORAGE_KEY])
  })
})
