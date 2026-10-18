// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { DsPage, type DsPageLayout } from '@/ds'

describe('DsPage layout archetypes', () => {
  it.each([
    ['list', 'max-w-7xl'],
    ['form', 'max-w-3xl'],
    ['report', 'max-w-none'],
    ['dashboard', 'max-w-7xl'],
    ['detail', 'max-w-6xl'],
    ['learner', 'max-w-6xl'],
  ] as const)('%s sets the width %s', (layout, cls) => {
    const w = mount(DsPage, { props: { layout, title: 'T', showTitle: true } })
    expect(w.classes()).toContain(cls)
    expect(w.attributes('data-layout')).toBe(layout)
  })
  it('defaults to the detail layout with the section gap', () => {
    const w = mount(DsPage)
    expect(w.attributes('data-layout')).toBe('detail')
    expect(w.classes()).toEqual(expect.arrayContaining(['gap-5', 'md:gap-6']))
  })
  it('width and gap override the archetype', () => {
    const w = mount(DsPage, { props: { layout: 'form', width: 'full', gap: 'lg' } })
    expect(w.classes()).toEqual(expect.arrayContaining(['max-w-none', 'gap-6']))
    expect(w.classes()).not.toContain('max-w-3xl')
  })
  it('the form archetype stacks the header actions', () => {
    const w = mount(DsPage, {
      props: { layout: 'form', title: 'T', showTitle: true },
      slots: { actions: '<button>Simpan</button>' },
    })
    expect(w.get('[data-ds=page-header] > div').classes()).toContain('flex-col')
  })
  it('layout only takes the six archetypes', () => {
    expectTypeOf<DsPageLayout>().toEqualTypeOf<'list' | 'form' | 'report' | 'dashboard' | 'detail' | 'learner'>()
    // @ts-expect-error not an archetype
    const bad: DsPageLayout = 'wizard'
    expect(bad).toBe('wizard')
  })
})
