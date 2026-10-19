// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { DsStateView } from '@/ds'

const stubs = {
  UAlert: { props: ['title'], template: '<div role="alert">{{ title }}</div>' },
  UEmpty: { props: ['title'], template: '<div data-empty>{{ title }}<slot name="actions" /></div>' },
  USkeleton: { template: '<i data-skel />' },
  UButton: { template: '<button><slot /></button>' },
}

describe('DsStateView', () => {
  it('ready renders the default slot only', () => {
    const w = mount(DsStateView, { props: { status: 'ready' }, slots: { default: '<p>data</p>' }, global: { stubs } })
    expect(w.text()).toBe('data')
  })
  it('loading shows the skeleton with rows and a busy status', () => {
    const w = mount(DsStateView, {
      props: { status: 'loading', skeleton: 'cards', rows: 3 },
      slots: { default: 'x' },
      global: { stubs },
    })
    expect(w.attributes('aria-busy')).toBe('true')
    expect(w.findAll('.h-32')).toHaveLength(3)
    expect(w.text()).not.toContain('x')
  })
  it('loading with a skeleton slot overrides the built-in shape', () => {
    const w = mount(DsStateView, { props: { status: 'loading' }, slots: { skeleton: '<b>mine</b>' }, global: { stubs } })
    expect(w.text()).toBe('mine')
    expect(w.find('.h-14').exists()).toBe(false)
  })
  it('error prints the message', () => {
    const w = mount(DsStateView, { props: { status: 'error', error: 'Gagal' }, global: { stubs } })
    expect(w.attributes('data-state')).toBe('error')
    expect(w.text()).toContain('Gagal')
  })
  it('empty uses the glossary copy with item and filtered', () => {
    const w = mount(DsStateView, { props: { status: 'empty', item: 'soalan' }, global: { stubs } })
    expect(w.text()).toContain('Belum ada soalan')
    const f = mount(DsStateView, { props: { status: 'empty', item: 'soalan', filtered: true }, global: { stubs } })
    expect(f.text()).toContain('Tiada soalan dijumpai')
  })
  it('status only takes the four literals', () => {
    expectTypeOf<InstanceType<typeof DsStateView>['$props']['status']>().toEqualTypeOf<
      'loading' | 'error' | 'empty' | 'ready'
    >()
    // @ts-expect-error not a status
    const bad: InstanceType<typeof DsStateView>['$props']['status'] = 'idle'
    expect(bad).toBe('idle')
  })
})
