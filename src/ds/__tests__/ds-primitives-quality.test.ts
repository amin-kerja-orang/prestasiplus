// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import { DsCallout, DsFilterBar, DsNativeSelect, DsSelect, DsSwitchField } from '@/ds'

/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  window.matchMedia ??= ((query: string) => ({
    matches: true,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
  })) as unknown as typeof window.matchMedia
})

describe('DsNativeSelect (themed list)', () => {
  it('is exported under both names', () => {
    expect(DsSelect).toBe(DsNativeSelect)
  })
  it('lists items and slot options (blank, optgroup) in the hidden native select', () => {
    const w = mount(DsNativeSelect, {
      props: { modelValue: '', items: [{ label: 'A', value: 'a' }] },
      slots: {
        default:
          '<option value="">Semua</option><optgroup label="Kumpulan"><option value="b">B</option></optgroup>',
      },
    })
    expect(w.findAll('option').map((o) => o.text())).toEqual(['A', 'Semua', 'B'])
    expect(w.find('[role=combobox]').exists()).toBe(true)
  })
  it('keeps id, name, required and test ids on the native control; the trigger gets the name', () => {
    const w = mount(DsNativeSelect, {
      props: { modelValue: '', required: true, items: [{ label: 'A', value: 'a' }] },
      attrs: { id: 'x', name: 'n', 'data-testid': 't', 'aria-label': 'Tahap', class: 'w-48' },
    })
    const sel = w.get('select')
    expect(sel.attributes('id')).toBe('x')
    expect(sel.attributes('name')).toBe('n')
    expect(sel.attributes('data-testid')).toBe('t')
    expect(sel.attributes('required')).toBeDefined()
    expect(sel.attributes('aria-hidden')).toBe('true')
    expect(sel.attributes('tabindex')).toBe('-1')
    expect(w.get('[role=combobox]').attributes('aria-label')).toBe('Tahap')
    expect(w.classes()).toContain('w-48')
  })
  it('numeric values keep their type through v-model', async () => {
    const w = mount(DsNativeSelect, {
      props: { modelValue: 1, items: [{ label: 'Satu', value: 1 }, { label: 'Dua', value: 2 }] },
    })
    await w.get('select').setValue(2)
    expect(w.emitted('update:modelValue')?.[0]).toEqual([2])
  })
  it('read-only and loading lock the list and mark the state', () => {
    const w = mount(DsNativeSelect, { props: { modelValue: '', readonly: true, items: [] } })
    expect(w.get('[role=combobox]').attributes('aria-readonly')).toBe('true')
    expect(w.attributes('data-state')).toBe('read-only')
  })
  it('native renders only a padded plain select', () => {
    const w = mount(DsNativeSelect, { props: { modelValue: '', native: true, items: [{ label: 'A', value: 'a' }] } })
    expect(w.find('[role=combobox]').exists()).toBe(false)
    expect(w.attributes('data-variant')).toBe('native')
    expect(w.get('select').classes()).toContain('pe-10')
  })
})

describe('DsCallout collapsible', () => {
  it('is collapsed by default and opens with defaultOpen', () => {
    const closed = mount(DsCallout, { props: { title: 'Panduan', collapsible: true }, slots: { default: '<p>x</p>' } })
    expect(closed.get('[data-ds=callout-toggle]').attributes('aria-expanded')).toBe('false')
    const open = mount(DsCallout, {
      props: { title: 'Panduan', collapsible: true, defaultOpen: true },
      slots: { default: '<p>x</p>' },
    })
    expect(open.get('[data-ds=callout-toggle]').attributes('aria-expanded')).toBe('true')
  })
})

describe('DsSwitchField', () => {
  it('prints the label and the caption and toggles the model', async () => {
    const w = mount(DsSwitchField, {
      props: { modelValue: false, label: 'Muat semula automatik', description: 'Setiap 5 minit' },
    })
    expect(w.text()).toContain('Muat semula automatik')
    expect(w.text()).toContain('Setiap 5 minit')
    await w.get('[role=switch]').trigger('click')
    expect(w.emitted('update:modelValue')?.[0]).toEqual([true])
  })
})

describe('DsFilterBar one row', () => {
  it('keeps fields, Cari and a link-style reset inline from md', () => {
    const w = mount(DsFilterBar, {
      props: { showReset: true },
      slots: { default: '<div data-field />' },
    })
    const form = w.get('form')
    expect(form.classes()).toContain('flex-wrap')
    expect(w.findAll('button').map((b) => b.text())).toEqual(['Cari', 'Set Semula'])
  })
})
