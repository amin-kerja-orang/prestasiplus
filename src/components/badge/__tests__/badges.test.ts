// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AppBadge from '../AppBadge.vue'
import { countLabel } from '../count-label'
import CountBadge from '../CountBadge.vue'

const LIVE =
  'ml-auto text-[8px] bg-red-500 text-white px-1.5 py-0.5 rounded-full font-bold animate-pulse'
const BELL =
  'absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1'

describe('AppBadge', () => {
  it('renders a span with exactly the passed class string and the literal label', () => {
    const w = mount(AppBadge, { props: { badgeClass: LIVE, label: 'LIVE' } })
    expect(w.element.tagName).toBe('SPAN')
    expect(w.attributes('class')).toBe(LIVE)
    expect(w.text()).toBe('LIVE')
  })

  it('takes slot content, another tag and fallthrough attributes', () => {
    const w = mount(AppBadge, {
      props: { badgeClass: 'rounded-full', as: 'div' },
      slots: { default: 'Menunggu' },
      attrs: { 'data-testid': 'b' },
    })
    expect(w.element.tagName).toBe('DIV')
    expect(w.text()).toBe('Menunggu')
    expect(w.attributes('data-testid')).toBe('b')
  })
})

describe('countLabel', () => {
  it('caps above the cap', () => {
    expect(countLabel(166, 99)).toBe('99+')
    expect(countLabel(100, 99)).toBe('99+')
    expect(countLabel(99, 99)).toBe('99')
    expect(countLabel(12, 99)).toBe('12')
  })

  it('groups thousands without a cap', () => {
    expect(countLabel(6144)).toBe('6,144')
    expect(countLabel(2)).toBe('2')
  })

  it('treats negative and non-finite input as 0', () => {
    expect(countLabel(-3)).toBe('0')
    expect(countLabel(Number.NaN)).toBe('0')
  })
})

describe('CountBadge', () => {
  it('bell: "99+" above 99, with the passed classes', () => {
    const w = mount(CountBadge, { props: { count: 166, cap: 99, badgeClass: BELL } })
    expect(w.text()).toBe('99+')
    expect(w.attributes('class')).toBe(BELL)
  })

  it('is hidden at 0 by default and shown when hideZero is false', () => {
    expect(
      mount(CountBadge, { props: { count: 0, badgeClass: BELL } })
        .find('span')
        .exists(),
    ).toBe(false)
    const w = mount(CountBadge, { props: { count: 0, badgeClass: BELL, hideZero: false } })
    expect(w.text()).toBe('0')
  })

  it('updates when the count changes', async () => {
    const w = mount(CountBadge, { props: { count: 12, cap: 99, badgeClass: BELL } })
    expect(w.text()).toBe('12')
    await w.setProps({ count: 0 })
    expect(w.find('span').exists()).toBe(false)
  })
})
