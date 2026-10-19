// @vitest-environment jsdom
import { config, enableAutoUnmount, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defineComponent, nextTick } from 'vue'

import { TOAST_DEFAULT_CLASS, TOAST_TRANSITIONS } from '../classes'
import ToastMessage from '../ToastMessage.vue'

// Render <Transition> children directly (no stub element, no animation frames in jsdom).
config.global.stubs = {
  transition: defineComponent({
    setup:
      (_, { slots }) =>
      () =>
        slots.default?.(),
  }),
}
enableAutoUnmount(afterEach)

const toast = () => document.body.querySelector('[data-testid="cmp-toast"]')

describe('ToastMessage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('is teleported to body and shows the message', () => {
    const w = mount(ToastMessage, {
      props: { show: true, message: 'Disalin!' },
      attachTo: document.body,
    })
    const el = toast()
    expect(el?.textContent?.trim()).toBe('Disalin!')
    expect(el?.parentElement).toBe(document.body)
    expect(el?.className).toBe(TOAST_DEFAULT_CLASS)
    expect(el?.classList.contains('w-max')).toBe(true)
    expect(el?.outerHTML).not.toMatch(/role=|aria-live/)
    w.unmount()
  })

  it('hides itself after the duration (default 2 s) via update:show and hide', async () => {
    const w = mount(ToastMessage, {
      props: {
        show: true,
        message: 'Disalin!',
        'onUpdate:show': (v: boolean) => w.setProps({ show: v }),
      },
      attachTo: document.body,
    })
    vi.advanceTimersByTime(1999)
    expect(w.emitted('update:show')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(w.emitted('update:show')).toEqual([[false]])
    expect(w.emitted('hide')).toHaveLength(1)
    await nextTick()
    expect(toast()).toBeNull()
    w.unmount()
  })

  it('uses a custom duration (M10 4 s)', () => {
    const w = mount(ToastMessage, { props: { show: true, message: 'x', duration: 4000 } })
    vi.advanceTimersByTime(3999)
    expect(w.emitted('hide')).toBeUndefined()
    vi.advanceTimersByTime(1)
    expect(w.emitted('hide')).toHaveLength(1)
    w.unmount()
  })

  it('does not start a timer while hidden; showing starts it', async () => {
    const w = mount(ToastMessage, { props: { show: false, message: 'x' } })
    vi.advanceTimersByTime(5000)
    expect(w.emitted('hide')).toBeUndefined()
    expect(toast()).toBeNull()
    await w.setProps({ show: true })
    vi.advanceTimersByTime(2000)
    expect(w.emitted('hide')).toHaveLength(1)
    w.unmount()
  })

  it('restarts the timer when the message changes while shown (no queue)', async () => {
    const w = mount(ToastMessage, { props: { show: true, message: 'Satu' } })
    vi.advanceTimersByTime(1500)
    await w.setProps({ message: 'Dua' })
    vi.advanceTimersByTime(1500)
    expect(w.emitted('hide')).toBeUndefined()
    vi.advanceTimersByTime(500)
    expect(w.emitted('hide')).toHaveLength(1)
    w.unmount()
  })

  it('clears the timer when hidden early or unmounted', async () => {
    const w = mount(ToastMessage, { props: { show: true, message: 'x' } })
    await w.setProps({ show: false })
    vi.advanceTimersByTime(3000)
    expect(w.emitted('hide')).toBeUndefined()
    await w.setProps({ show: true })
    w.unmount()
    vi.advanceTimersByTime(3000)
    expect(w.emitted('hide')).toBeUndefined()
  })

  it('renders in place when teleport is disabled, with a custom class and slot', () => {
    const w = mount(ToastMessage, {
      props: { show: true, teleportDisabled: true, toastClass: 'absolute top-0 text-xs' },
      slots: { default: '<b>Disalin!</b>' },
    })
    const el = w.get('[data-testid="cmp-toast"]')
    expect(el.classes()).toEqual(['absolute', 'top-0', 'text-xs'])
    expect(el.get('b').text()).toBe('Disalin!')
    w.unmount()
  })

  it('has the two live transitions', () => {
    expect(TOAST_TRANSITIONS.fade.enterFromClass).toBe('opacity-0')
    expect(TOAST_TRANSITIONS.slide).toMatchObject({
      enterActiveClass: 'transition ease-out duration-300',
      enterFromClass: 'translate-y-4 opacity-0',
      leaveActiveClass: 'transition ease-in duration-200',
      leaveToClass: 'translate-y-4 opacity-0',
    })
  })
})
