// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import { createMemoryHistory, createRouter } from 'vue-router'

import {
  DsFileField,
  DsFormBar,
  DsFormField,
  DsFormSection,
  DsNativeSelect,
  DsPanel,
  DsRtlScope,
} from '@/ds'

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

describe('DsFormField', () => {
  it('native mode wires id, describedby and invalid to the slotted control', () => {
    const w = mount(DsFormField, {
      props: { label: 'Nama', native: true, required: true, hint: 'Nama penuh', error: 'Wajib diisi' },
      slots: {
        default:
          '<template #default="{ id, describedby, invalid }"><input :id="id" :aria-describedby="describedby" :aria-invalid="invalid" required /></template>',
      },
    })
    const input = w.get('input')
    const label = w.get('label')
    expect(label.attributes('for')).toBe(input.attributes('id'))
    expect(input.attributes('aria-invalid')).toBe('true')
    expect(input.attributes('aria-describedby')).toContain(`${input.attributes('id')}-error`)
    expect(input.attributes('required')).toBeDefined()
    expect(w.text()).toContain('wajib')
    const err = w.get('[data-testid="field-error"]')
    expect(err.attributes('role')).toBe('alert')
    expect(err.text()).toBe('Wajib diisi')
  })
  it('native mode without error is valid and has no alert', () => {
    const w = mount(DsFormField, {
      props: { label: 'Nama', native: true },
      slots: { default: '<template #default="{ invalid }"><i :data-invalid="invalid" /></template>' },
    })
    expect(w.find('[data-testid="field-error"]').exists()).toBe(false)
    expect(w.get('i').attributes('data-invalid')).toBe('false')
  })
  it('default mode wraps UFormField and prints the server error', () => {
    const w = mount(DsFormField, {
      props: { label: 'E-mel', name: 'email', hint: 'Guna e-mel sekolah', error: 'E-mel sudah wujud' },
      slots: { default: '<input />' },
    })
    expect(w.text()).toContain('E-mel')
    expect(w.text()).toContain('Guna e-mel sekolah')
    expect(w.get('[data-testid="field-error"]').text()).toBe('E-mel sudah wujud')
  })
})

describe('DsNativeSelect', () => {
  it('is a 44px radius-sm select with a blank Pilih option', async () => {
    const w = mount(DsNativeSelect, {
      props: {
        modelValue: '',
        placeholder: true,
        required: true,
        items: [
          { label: 'Satu', value: 'a' },
          { label: 'Dua', value: 'b' },
        ],
      },
    })
    const sel = w.get('select')
    expect(sel.classes()).toEqual(expect.arrayContaining(['min-h-11', 'rounded-chip']))
    expect(sel.attributes('required')).toBeDefined()
    const opts = w.findAll('option')
    expect(opts.map((o) => o.text())).toEqual(['Pilih', 'Satu', 'Dua'])
    expect(opts[0]!.attributes('value')).toBe('')
    await sel.setValue('b')
    expect(w.emitted('update:modelValue')?.[0]).toEqual(['b'])
  })
  it('invalid sets aria-invalid; slot options and custom placeholder work', () => {
    const w = mount(DsNativeSelect, {
      props: { modelValue: '', placeholder: 'Semua', invalid: true },
      slots: { default: '<option value="x">X</option>' },
    })
    expect(w.get('select').attributes('aria-invalid')).toBe('true')
    expect(w.findAll('option').map((o) => o.text())).toEqual(['Semua', 'X'])
  })
})

describe('DsFormBar', () => {
  it('defaults to Simpan and Batal, cancel emits without cancelTo', async () => {
    const w = mount(DsFormBar, { global: { plugins: [router] } })
    expect(w.get('[data-testid="form-submit"]').text()).toBe('Simpan')
    expect(w.get('[data-testid="form-submit"]').attributes('type')).toBe('submit')
    expect(w.get('[data-testid="form-cancel"]').text()).toBe('Batal')
    await w.get('[data-testid="form-cancel"]').trigger('click')
    expect(w.emitted('cancel')).toHaveLength(1)
    expect(w.attributes('data-tone')).toBe('bar')
  })
  it('saving disables the submit; showCancel=false hides Batal; sticky=false drops sticky', () => {
    const w = mount(DsFormBar, {
      props: { saving: true, showCancel: false, sticky: false, submitLabel: 'Kemaskini' },
      global: { plugins: [router] },
    })
    expect(w.find('[data-testid="form-cancel"]').exists()).toBe(false)
    expect(w.get('[data-testid="form-submit"]').attributes('disabled')).toBeDefined()
    expect(w.get('[data-testid="form-submit"]').text()).toContain('Kemaskini')
    expect(w.classes()).not.toContain('sticky')
  })
})

describe('DsFormSection', () => {
  it('prints an h2, two columns from sm, and a danger chip', () => {
    const w = mount(DsFormSection, {
      props: { title: 'Zon Bahaya', tone: 'danger', icon: 'i-ph-warning', columns: 2 },
      slots: { default: '<div>medan</div>', actions: '<button>Aksi</button>' },
    })
    expect(w.get('h2').text()).toBe('Zon Bahaya')
    expect(w.html()).toContain('sm:grid-cols-2')
    expect(w.html()).toContain('bg-error/12')
    expect(w.text()).toContain('Aksi')
  })
})

describe('DsPanel header', () => {
  it('prints title, description and actions', () => {
    const w = mount(DsPanel, {
      props: { title: 'Ringkasan', description: 'Terkini' },
      slots: { default: '<p>isi</p>', actions: '<button>Muat Turun</button>' },
    })
    expect(w.get('h2').text()).toBe('Ringkasan')
    expect(w.text()).toContain('Terkini')
    expect(w.text()).toContain('Muat Turun')
  })
  it('without a title there is no header and the old padding stays', () => {
    const w = mount(DsPanel, { slots: { default: '<p>isi</p>' } })
    expect(w.find('header').exists()).toBe(false)
    expect(w.classes()).toContain('p-3')
  })
})

describe('DsRtlScope', () => {
  it('is rtl with the Jawi face by default and neutral with rtl=false', () => {
    const on = mount(DsRtlScope, { slots: { default: 'نص' } })
    expect(on.attributes('dir')).toBe('rtl')
    expect(on.classes()).toContain('font-jawi')
    const off = mount(DsRtlScope, { props: { rtl: false }, slots: { default: 'teks' } })
    expect(off.attributes('dir')).toBeUndefined()
    expect(off.classes()).not.toContain('font-jawi')
  })
})

describe('DsFileField', () => {
  it('renders the drop zone with the BM default label', () => {
    const w = mount(DsFileField, { props: { accept: 'image/*', maxSizeMb: 2 } })
    expect(w.text()).toContain('Seret fail')
    expect(w.find('input[type="file"]').attributes('accept')).toBe('image/*')
  })
  it('rejects files over the size limit and keeps the model clean', async () => {
    const w = mount(DsFileField, { props: { maxSizeMb: 1 } })
    const big = new File([new Uint8Array(2 * 1024 * 1024)], 'besar.png', { type: 'image/png' })
    const small = new File([new Uint8Array(10)], 'kecil.png', { type: 'image/png' })
    const upload = w.findComponent({ name: 'FileUpload' })
    upload.vm.$emit('update:modelValue', big)
    await w.vm.$nextTick()
    expect(w.emitted('reject')?.[0]?.[0]).toEqual([big])
    expect(w.get('[data-testid="field-error"]').text()).toContain('1 MB')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    upload.vm.$emit('update:modelValue', small)
    await w.vm.$nextTick()
    expect(w.emitted('update:modelValue')?.at(-1)).toEqual([small])
    expect(w.find('[data-testid="field-error"]').exists()).toBe(false)
  })
})
