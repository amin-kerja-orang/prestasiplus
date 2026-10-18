// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'

import { DsSurface, type DsSurfaceLevel } from '@/ds'

describe('DsSurface', () => {
  it('defaults to a raised, padded, clipped card', () => {
    const w = mount(DsSurface, { slots: { default: 'x' } })
    expect(w.classes()).toEqual(
      expect.arrayContaining(['bg-default', 'rounded-card', 'shadow-ds-xs', 'p-4', 'overflow-clip']),
    )
  })
  it('levels and tones pick the background layer', () => {
    expect(mount(DsSurface, { props: { level: 'soft' } }).classes()).toContain('bg-soft')
    expect(mount(DsSurface, { props: { tone: 'error' } }).classes()).toContain('bg-error/10')
    expect(mount(DsSurface, { props: { tone: 'success', emphasis: 'strong' } }).classes()).toContain('bg-success')
  })
  it('radius="auto" steps down one level per enclosing surface', () => {
    const Nest = defineComponent({
      render: () =>
        h(DsSurface, { 'data-testid': 'a' }, () =>
          h(DsSurface, { 'data-testid': 'b' }, () => h(DsSurface, { 'data-testid': 'c' })),
        ),
    })
    const w = mount(Nest)
    expect(w.get('[data-testid=a]').classes()).toContain('rounded-card')
    expect(w.get('[data-testid=b]').classes()).toContain('rounded-chip')
    expect(w.get('[data-testid=c]').classes()).toContain('rounded-xs')
  })
  it('an explicit radius is not stepped down', () => {
    const Nest = defineComponent({
      render: () => h(DsSurface, null, () => h(DsSurface, { radius: 'card', 'data-testid': 'in' })),
    })
    expect(mount(Nest).get('[data-testid=in]').classes()).toContain('rounded-card')
  })
  it('state props set ARIA and data-state', () => {
    const d = mount(DsSurface, { props: { disabled: true } })
    expect(d.attributes('aria-disabled')).toBe('true')
    expect(d.classes()).toContain('pointer-events-none')
    expect(mount(DsSurface, { props: { loading: true } }).attributes('aria-busy')).toBe('true')
    expect(mount(DsSurface, { props: { invalid: true } }).attributes('aria-invalid')).toBe('true')
    const s = mount(DsSurface, { props: { selected: true, type: 'button', interactive: true } })
    expect(s.element.tagName).toBe('BUTTON')
    expect(s.attributes('aria-pressed')).toBe('true')
  })
  it('loading shows the skeleton slot instead of the content', () => {
    const w = mount(DsSurface, { props: { loading: true }, slots: { default: 'isi', skeleton: 'rangka' } })
    expect(w.text()).toBe('rangka')
  })
  it('`to` renders a router link', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<i />' } }],
    })
    await router.push('/')
    const w = mount(DsSurface, { props: { to: '/', interactive: true }, global: { plugins: [router] } })
    expect(w.element.tagName).toBe('A')
  })
  it('level only takes the declared layers', () => {
    expectTypeOf<DsSurfaceLevel>().toEqualTypeOf<'raised' | 'elevated' | 'soft' | 'accented' | 'inverted'>()
    // @ts-expect-error not a layer
    const bad: DsSurfaceLevel = 'glass'
    expect(bad).toBe('glass')
  })
})
