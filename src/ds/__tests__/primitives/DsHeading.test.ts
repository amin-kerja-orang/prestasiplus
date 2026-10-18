// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, expectTypeOf, it, vi } from 'vitest'

import { DsHeading } from '@/ds'
import { __resetH1Count } from '@/ds/DsHeading.vue'

afterEach(() => {
  __resetH1Count()
  vi.restoreAllMocks()
})

describe('DsHeading', () => {
  it('renders the semantic level with the level default look', () => {
    const w = mount(DsHeading, { props: { level: 2 }, slots: { default: 'Tajuk' } })
    expect(w.element.tagName).toBe('H2')
    expect(w.classes()).toEqual(expect.arrayContaining(['text-heading', 'text-highlighted', 'text-balance']))
    expect(mount(DsHeading, { props: { level: 5 } }).classes()).toContain('text-label')
  })
  it('variant overrides the look, focusable is programmatically focusable', () => {
    const w = mount(DsHeading, { props: { level: 3, variant: 'overline', focusable: true } })
    expect(w.classes()).toContain('text-overline')
    expect(w.attributes('tabindex')).toBe('-1')
  })
  it('warns in dev on a second mounted h1', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const a = mount(DsHeading, { props: { level: 1 } })
    expect(warn).not.toHaveBeenCalled()
    mount(DsHeading, { props: { level: 1 } })
    expect(warn).toHaveBeenCalledTimes(1)
    a.unmount()
  })
  it('only takes levels 1 to 6', () => {
    expectTypeOf<InstanceType<typeof DsHeading>['$props']['level']>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6>()
    // @ts-expect-error level 7 does not exist
    const bad: InstanceType<typeof DsHeading>['$props']['level'] = 7
    expect(bad).toBe(7)
  })
})
