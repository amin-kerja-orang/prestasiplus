// @vitest-environment jsdom
/** Additions of the M-B migration: `DsIdentity`, `DsPanel` tones/`as`, `DsStatRow` active/compact links. */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { DsIdentity, DsPanel, DsStatRow } from '@/ds'

describe('DsIdentity', () => {
  it('prints avatar initials, name and the muted second line', () => {
    const w = mount(DsIdentity, {
      props: { name: 'Aini Contoh', sub: 'aini@contoh.test', initials: 'AC' },
    })
    expect(w.find('[data-ds="identity-name"]').text()).toBe('Aini Contoh')
    expect(w.find('[data-ds="identity-sub"]').text()).toBe('aini@contoh.test')
    expect(w.text()).toContain('AC')
  })

  it('leaves the avatar out without initials and lets the name slot mark up the name', () => {
    const w = mount(DsIdentity, {
      props: { name: 'Aini Contoh' },
      slots: { name: '<b data-testid="n">Aini</b>' },
    })
    expect(w.text()).not.toContain('AC')
    expect(w.find('[data-testid="n"]').exists()).toBe(true)
    expect(w.find('[data-ds="identity-sub"]').exists()).toBe(false)
  })
})

describe('DsPanel tones', () => {
  it('renders another root element and the inset / tint layers', () => {
    const form = mount(DsPanel, { props: { as: 'form', tone: 'inset' }, slots: { default: 'x' } })
    expect(form.element.tagName).toBe('FORM')
    expect(form.classes()).toContain('bg-elevated')
    expect(form.classes()).not.toContain('shadow-lift')
    const tint = mount(DsPanel, { props: { tone: 'tint' } })
    expect(tint.classes()).toContain('bg-primary/10')
    expect(mount(DsPanel, { props: { level: 'inset' } }).classes()).toContain('bg-elevated')
    expect(mount(DsPanel, { props: { level: 'tint' } }).classes()).toContain('bg-primary/10')
    expect(mount(DsPanel).classes()).toContain('shadow-ds-xs')
    const float = mount(DsPanel, { props: { tone: 'float' } })
    expect(float.classes()).toEqual(expect.arrayContaining(['absolute', 'z-20', 'max-h-64']))
  })
})

describe('DsStatRow link tiles', () => {
  it('frames the active tile and renders compact link tiles', () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: '/', component: { template: '<i />' } }],
    })
    const w = mount(DsStatRow, {
      props: {
        prefix: 'k',
        compact: true,
        items: [
          { key: 'a', label: 'A', value: 1, to: '/?role=a', active: true },
          { key: 'b', label: 'B', value: 2, to: '/?role=b' },
        ],
      },
      global: { plugins: [router] },
    })
    const active = w.findAll('[data-active="true"]')
    expect(active).toHaveLength(1)
    expect(active[0]?.attributes('data-testid')).toBe('k-a')
    expect(w.findAll('a[data-compact="true"]')).toHaveLength(2)
  })
})
