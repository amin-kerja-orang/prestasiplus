// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { DsGrid, DsGridItem, type DsCols } from '@/ds'

describe('DsGrid', () => {
  it('defaults to one column and a md gap', () => {
    expect(mount(DsGrid).classes()).toEqual(expect.arrayContaining(['grid', 'grid-cols-1', 'gap-4', 'items-stretch']))
  })
  it('responsive cols emit one class per breakpoint', () => {
    const w = mount(DsGrid, { props: { cols: { base: 1, md: 2, xl: 3 } } })
    expect(w.classes()).toEqual(expect.arrayContaining(['grid-cols-1', 'md:grid-cols-2', 'xl:grid-cols-3']))
  })
  it('minItem makes auto-fit tracks and overrides cols', () => {
    const w = mount(DsGrid, { props: { cols: 4, minItem: 'sm' } })
    expect(w.classes().join(' ')).toContain('auto-fit')
    expect(w.classes()).not.toContain('grid-cols-4')
    expect(mount(DsGrid, { props: { minItem: 'sm', fit: 'fill' } }).classes().join(' ')).toContain('auto-fill')
  })
  it('DsGridItem span and start', () => {
    const w = mount(DsGridItem, { props: { span: { base: 12, lg: 6 }, start: { lg: 7 } } })
    expect(w.classes()).toEqual(expect.arrayContaining(['min-w-0', 'col-span-12', 'lg:col-span-6', 'lg:col-start-7']))
    expect(w.attributes('data-ds-grid-item')).toBeDefined()
  })
  it('cols only take the declared counts', () => {
    expectTypeOf<DsCols>().toEqualTypeOf<1 | 2 | 3 | 4 | 5 | 6 | 12>()
    // @ts-expect-error 7 columns is not a step
    const bad: DsCols = 7
    expect(bad).toBe(7)
  })
})
