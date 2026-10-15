// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { defineComponent, h, nextTick } from 'vue'

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
  it('defaults: learner dark, staff follows the system', () => {
    expect(defaultPreference('learner')).toBe('dark')
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
  let api: ThemeMode

  function mountPortal(personality: Personality) {
    return mount(
      defineComponent({
        setup() {
          api = useThemeMode(personality)
          return () => h('div')
        },
      }),
    )
  }

  beforeEach(() => {
    localStorage.clear()
    resetThemeModeForTests()
  })
  afterEach(() => {
    document.documentElement.className = ''
    document.documentElement.removeAttribute('data-personality')
  })

  it('learner is dark by default and marks <html>; unmount restores legacy state', async () => {
    const wrapper = mountPortal('learner')
    await nextTick()
    const root = document.documentElement
    expect(root.classList.contains('dark')).toBe(true)
    expect(root.dataset.personality).toBe('learner')
    wrapper.unmount()
    expect(root.classList.contains('dark')).toBe(false)
    expect(root.dataset.personality).toBeUndefined()
  })

  it('staff with no stored choice and a light OS stays light', async () => {
    mountPortal('staff')
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(api.preference.value).toBe('system')
  })

  it('toggle stores the choice under pp.theme and flips .dark', async () => {
    mountPortal('learner')
    await nextTick()
    api.toggle()
    await nextTick()
    expect(localStorage.getItem(THEME_STORAGE_KEY)).toBe('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
    api.setPreference('dark')
    await nextTick()
    expect(document.documentElement.classList.contains('dark')).toBe(true)
  })

  it('never touches the legacy colour-mode key', () => {
    mountPortal('staff')
    api.toggle()
    expect(localStorage.getItem('vueuse-color-scheme')).toBeNull()
  })
})
