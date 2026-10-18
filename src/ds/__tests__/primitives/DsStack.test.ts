// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { DsStack, type DsSpace } from '@/ds'

describe('DsStack', () => {
  it('is a min-w-0 column with the md gap by default', () => {
    const w = mount(DsStack, { slots: { default: '<i />' } })
    expect(w.classes()).toEqual(expect.arrayContaining(['flex', 'flex-col', 'min-w-0', 'gap-4']))
  })
  it('gap, align, padding, fill and list elements', () => {
    const w = mount(DsStack, { props: { as: 'ul', gap: 'xl', align: 'start', padding: 'lg', fill: true } })
    expect(w.element.tagName).toBe('UL')
    expect(w.classes()).toEqual(
      expect.arrayContaining(['gap-8', 'items-start', 'p-5', 'flex-1', 'min-h-0', 'list-none']),
    )
  })
  it('the section gap is the page gap', () => {
    expect(mount(DsStack, { props: { gap: 'section' } }).classes()).toContain('md:gap-6')
  })
  it('only takes DsSpace values', () => {
    expectTypeOf<InstanceType<typeof DsStack>['$props']['gap']>().toEqualTypeOf<DsSpace | undefined>()
    // @ts-expect-error not a space step
    const bad: DsSpace = 'huge'
    expect(bad).toBe('huge')
  })
})
