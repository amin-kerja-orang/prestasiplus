// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, expectTypeOf, it } from 'vitest'

import { DsSection } from '@/ds'

describe('DsSection', () => {
  it('prints an h2 and wires aria-labelledby to it', () => {
    const w = mount(DsSection, {
      props: { title: 'Ringkasan', description: 'Terkini' },
      slots: { default: '<p>isi</p>' },
    })
    const h = w.get('h2')
    expect(h.text()).toBe('Ringkasan')
    expect(w.attributes('aria-labelledby')).toBe(h.attributes('id'))
    expect(w.text()).toContain('Terkini')
  })
  it('level 3, custom heading id, actions and footer slots', () => {
    const w = mount(DsSection, {
      props: { title: 'T', level: 3, headingId: 'sec-x' },
      slots: { actions: '<button>Tambah</button>', footer: '<small>kaki</small>' },
    })
    expect(w.get('h3').attributes('id')).toBe('sec-x')
    expect(w.text()).toContain('Tambah')
    expect(w.text()).toContain('kaki')
  })
  it('level only takes 2 or 3', () => {
    expectTypeOf<InstanceType<typeof DsSection>['$props']['level']>().toEqualTypeOf<2 | 3 | undefined>()
    // @ts-expect-error h1 belongs to the page header
    const bad: InstanceType<typeof DsSection>['$props']['level'] = 1
    expect(bad).toBe(1)
  })
})
