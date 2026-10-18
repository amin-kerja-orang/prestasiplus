// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { DsSplit } from '@/ds'

describe('DsSplit', () => {
  it('is an 8/4 split that stacks below xl', () => {
    const w = mount(DsSplit, { slots: { default: 'main', aside: 'side' } })
    expect(w.classes()).toEqual(expect.arrayContaining(['grid-cols-1', 'xl:grid-cols-12']))
    expect(w.get('[data-ds=split-main]').classes()).toContain('xl:col-span-8')
    expect(w.get('aside').classes()).toContain('xl:col-span-4')
  })
  it('ratio, stackBelow, aside first and sticky', () => {
    const w = mount(DsSplit, {
      props: { ratio: '3-1', stackBelow: 'lg', asideFirstWhenStacked: true, stickyAside: true },
      slots: { default: 'main', aside: 'side' },
    })
    expect(w.get('[data-ds=split-main]').classes()).toContain('lg:col-span-9')
    expect(w.get('aside').classes()).toEqual(expect.arrayContaining(['lg:col-span-3', 'order-first', 'lg:sticky']))
  })
  it('renders no aside without the slot', () => {
    expect(mount(DsSplit, { slots: { default: 'main' } }).find('aside').exists()).toBe(false)
  })
  it('ratio only takes the declared literals', () => {
    expectTypeOf<InstanceType<typeof DsSplit>['$props']['ratio']>().toEqualTypeOf<
      '1-1' | '2-1' | '3-1' | '1-2' | '8-4' | undefined
    >()
    // @ts-expect-error 5-7 is not a ratio
    const bad: InstanceType<typeof DsSplit>['$props']['ratio'] = '5-7'
    expect(bad).toBe('5-7')
  })
})
