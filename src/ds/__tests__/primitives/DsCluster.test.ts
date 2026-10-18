// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { DsCluster, DsSpacer, type DsBreakpoint } from '@/ds'

describe('DsCluster', () => {
  it('wraps, centres and gaps by default', () => {
    const w = mount(DsCluster)
    expect(w.classes()).toEqual(expect.arrayContaining(['flex', 'flex-wrap', 'items-center', 'gap-x-3', 'gap-y-3']))
  })
  it('rowGap, justify and nowrap', () => {
    const w = mount(DsCluster, { props: { gap: 'lg', rowGap: 'xs', justify: 'between', wrap: false } })
    expect(w.classes()).toEqual(expect.arrayContaining(['gap-x-6', 'gap-y-2', 'justify-between', 'flex-nowrap']))
  })
  it('stackBelow columns under the breakpoint, reverseBelow flips the order', () => {
    const w = mount(DsCluster, { props: { stackBelow: 'md', reverseBelow: true } })
    expect(w.classes()).toEqual(expect.arrayContaining(['flex-col-reverse', 'md:flex-row', 'md:items-center']))
    expect(w.classes()).not.toContain('flex-wrap')
  })
  it('DsSpacer is a growing, hidden span', () => {
    const s = mount(DsSpacer)
    expect(s.classes()).toContain('grow')
    expect(s.attributes('aria-hidden')).toBe('true')
  })
  it('stackBelow takes breakpoints only', () => {
    expectTypeOf<InstanceType<typeof DsCluster>['$props']['stackBelow']>().toEqualTypeOf<DsBreakpoint | undefined>()
    // @ts-expect-error 2xl is not a breakpoint
    const bad: DsBreakpoint = '2xl'
    expect(bad).toBe('2xl')
  })
})
