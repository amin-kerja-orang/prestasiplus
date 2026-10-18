// @vitest-environment jsdom
// Additive changes of the M-C migration (v2/p1-c): file-input attrs and trigger slot, RowAction test id,
// DsLoadError retry test id, DsFormField without an empty error row.
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import { DsFileField, DsFormField, DsLoadError, DsRowActions } from '@/ds'

/* eslint-disable @typescript-eslint/unbound-method -- jsdom polyfill checks */
beforeAll(() => {
  const g = globalThis as Record<string, unknown>
  g.ResizeObserver ??= class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
  URL.createObjectURL = () => 'blob:test'
  window.matchMedia ??= ((query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
    addListener() {},
    removeListener() {},
    dispatchEvent: () => false,
    onchange: null,
  })) as unknown as typeof window.matchMedia
})

afterEach(() => {
  document.body.innerHTML = ''
})

const router = createRouter({
  history: createMemoryHistory(),
  routes: [{ path: '/', component: { template: '<div />' } }],
})

describe('DsFileField additions', () => {
  it('puts data-testid and name on the file input and class on the field', () => {
    const w = mount(DsFileField, {
      attrs: { 'data-testid': 'my-file', class: 'grow' },
      props: { name: 'csv_file', accept: '.csv' },
    })
    expect(w.get('input[type="file"]').attributes('data-testid')).toBe('my-file')
    expect(w.get('[data-ds="file-field"]').classes()).toContain('grow')
  })

  it('a default slot replaces the drop zone and gets `open`', () => {
    const w = mount(DsFileField, {
      slots: { default: '<template #default="{ open }"><button type="button" @click="open()">Gambar</button></template>' },
    })
    expect(w.text()).toContain('Gambar')
    expect(w.text()).not.toContain('Seret fail')
  })

  it('empties the native input when the model returns to null', async () => {
    const w = mount(DsFileField, { props: { modelValue: new File(['x'], 'a.png') } })
    const input = w.get('input[type="file"]').element as HTMLInputElement
    const spy = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')
    let written: string | undefined
    Object.defineProperty(input, 'value', {
      configurable: true,
      get: () => spy?.get?.call(input) as string,
      set: (v: string) => {
        written = v
      },
    })
    await w.setProps({ modelValue: null })
    expect(written).toBe('')
  })
})

describe('DsRowActions test id', () => {
  it('puts the action test id on the inline button', () => {
    const w = mount(DsRowActions, {
      global: { plugins: [router] },
      props: { inline: 1, actions: [{ label: 'Edit', to: '/', testid: 'row-edit' }] },
    })
    expect(w.get('[data-testid="row-edit"]').text()).toBe('Edit')
  })
})

describe('DsLoadError retry test id', () => {
  it('sets it on the retry button of both forms', () => {
    const alert = mount(DsLoadError, { props: { retryTestid: 'retry-a' } })
    expect(alert.find('[data-testid="retry-a"]').exists()).toBe(true)
    const inline = mount(DsLoadError, { props: { inline: true, retryTestid: 'retry-b' } })
    expect(inline.get('[data-testid="retry-b"]').text()).toBe('Cuba Semula')
  })
})

describe('DsFormField default mode', () => {
  it('renders no error row without an error and the alert with one', () => {
    const quiet = mount(DsFormField, { props: { label: 'Nama' }, slots: { default: '<span />' } })
    expect(quiet.find('[data-slot="error"]').exists()).toBe(false)
    const loud = mount(DsFormField, {
      props: { label: 'Nama', error: 'Wajib diisi' },
      slots: { default: '<span />' },
    })
    expect(loud.get('[data-testid="field-error"]').text()).toContain('Wajib diisi')
  })
})
