// @vitest-environment jsdom
/**
 * DSKP-T07: `DskpSpPicker`, the searchable SP list of the Tag DSKP block (UX spec 3.4 and 3.9).
 * Reads the real catalogue through `dskp-source` (M03 owns it).
 */
import { flushPromises, mount } from '@vue/test-utils'
import { beforeAll, describe, expect, it } from 'vitest'

import DskpSpPicker from '../admin/intake/components/DskpSpPicker.vue'
import { dskpSource } from '../lib/dskp-source'
import type { DskpSubjectView } from '../lib/dskp-source'
import { MAT_T4_SP, MAT_T4_SP2, MAT_T4_UNIT } from './tag-fixtures'

let mat: DskpSubjectView
let pi: DskpSubjectView
let sn: DskpSubjectView
beforeAll(async () => {
  mat = await dskpSource().load('MAT')
  pi = await dskpSource().load('PI')
  sn = await dskpSource().load('SN')
})

const mountPicker = (props: Record<string, unknown> = {}) =>
  mount(DskpSpPicker, {
    props: { view: mat, unitId: MAT_T4_UNIT, modelValue: [], ...props },
    attachTo: document.body,
  })
const rows = (w: ReturnType<typeof mountPicker>) =>
  w.findAll('[data-testid^="sp-option-"]').map((n) => n.attributes('data-testid')!.replace('sp-option-', ''))

describe('DskpSpPicker', () => {
  it('lists the selectable SP of the chosen unit in print order, with the count line', () => {
    const w = mountPicker()
    expect(rows(w)).toEqual(['1.1.1', '1.1.2', '1.1.3', '1.1.4', '1.1.5', '1.1.6', '1.1.7', '1.1.8'])
    expect(w.get('[data-testid="sp-count"]').text()).toBe('0 SP dipilih · 8 SP dalam unit ini')
    expect(w.get('[data-testid="sp-count"]').attributes('aria-live')).toBe('polite')
    expect(w.get('[role="group"]').attributes('aria-labelledby')).toBeTruthy()
    expect(w.text()).toContain('SP (Standard Pembelajaran)')
  })

  it('searches by code', async () => {
    const w = mountPicker()
    await w.get('[data-testid="sp-search"]').setValue('1.1.6')
    expect(rows(w)).toEqual(['1.1.6'])
    expect(w.get('[data-testid="sp-count"]').text()).toBe('1 SP sepadan · 0 SP dipilih')
  })

  it('searches by text, ignoring case', async () => {
    const w = mountPicker()
    await w.get('[data-testid="sp-search"]').setValue('PEMFAKTORAN')
    expect(rows(w)).toContain('1.1.6')
    expect(rows(w).length).toBeLessThan(8)
  })

  it('the search never changes the selection; a chosen SP hidden by the search stays in the chips', async () => {
    const w = mountPicker({ modelValue: [MAT_T4_SP2] })
    await w.get('[data-testid="sp-search"]').setValue('1.1.6')
    expect(rows(w)).toEqual(['1.1.6'])
    expect(w.emitted('toggle')).toBeUndefined()
    expect(w.find('[data-testid="sp-chip-1.1.5"]').exists()).toBe(true)
  })

  it('shows "no match" with a clear button that empties the box and refocuses it', async () => {
    const w = mountPicker()
    await w.get('[data-testid="sp-search"]').setValue('zzzz')
    expect(w.get('[data-testid="sp-no-match"]').text()).toContain('Tiada SP sepadan dengan "zzzz".')
    await w.get('[data-testid="sp-clear-search"]').trigger('click')
    expect((w.get('[data-testid="sp-search"]').element as HTMLInputElement).value).toBe('')
    expect(document.activeElement).toBe(w.get('[data-testid="sp-search"]').element)
    expect(rows(w)).toHaveLength(8)
  })

  it('ticking a row emits toggle with the catalogue id; the box has the SP code as label', async () => {
    const w = mountPicker()
    await w.get('[data-testid="sp-option-1.1.6"]').trigger('click')
    expect(w.emitted('toggle')![0]).toEqual([MAT_T4_SP, true])
  })

  it('shows chips for the selection and a remove button named "Buang SP {kod}"', async () => {
    const w = mountPicker({ modelValue: [MAT_T4_SP2, MAT_T4_SP] })
    expect(w.findAll('[data-testid^="sp-chip-"]').map((n) => n.attributes('data-testid'))).toEqual([
      'sp-chip-1.1.5',
      'sp-chip-1.1.6',
    ])
    const remove = w.get('[aria-label="Buang SP 1.1.5"]')
    await remove.trigger('click')
    expect(w.emitted('toggle')![0]).toEqual([MAT_T4_SP2, false])
  })

  it('hides the remove buttons when the picker is disabled', () => {
    const w = mountPicker({ modelValue: [MAT_T4_SP], disabled: true })
    expect(w.find('[data-testid^="sp-remove-"]').exists()).toBe(false)
    expect(w.find('[data-testid="sp-chip-1.1.6"]').exists()).toBe(true)
  })

  it('swallows Enter in the search box so it never submits a surrounding form', () => {
    let submitted = 0
    const form = document.createElement('form')
    form.addEventListener('submit', (e) => {
      e.preventDefault()
      submitted += 1
    })
    document.body.append(form)
    const w = mount(DskpSpPicker, {
      props: { view: mat, unitId: MAT_T4_UNIT, modelValue: [] },
      attachTo: form,
    })
    const ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    w.get('[data-testid="sp-search"]').element.dispatchEvent(ev)
    expect(ev.defaultPrevented).toBe(true)
    expect(submitted).toBe(0)
  })

  it('with no unit it is disabled and says so', () => {
    const w = mountPicker({ unitId: null })
    expect(w.get('[data-testid="sp-need-unit"]').text()).toBe('Pilih unit dahulu untuk melihat SP.')
    expect((w.get('[data-testid="sp-search"]').element as HTMLInputElement).disabled).toBe(true)
    expect(rows(w)).toEqual([])
  })

  it('outside DSKP (T1-T3) it is disabled and silent', () => {
    const w = mountPicker({ unitId: null, outside: true })
    expect(w.find('[data-testid="sp-need-unit"]').exists()).toBe(false)
    expect(w.find('[data-testid="sp-list-box"]').exists()).toBe(false)
    expect((w.get('[data-testid="sp-search"]').element as HTMLInputElement).disabled).toBe(true)
  })

  it('keeps the count live region mounted so its first announcement is reliable', async () => {
    const w = mountPicker({ unitId: null })
    const region = w.get('[data-testid="sp-count"]')
    expect(region.attributes('aria-live')).toBe('polite')
    expect(region.text()).toBe('')
    await w.setProps({ unitId: MAT_T4_UNIT })
    expect(w.get('[data-testid="sp-count"]').element).toBe(region.element)
    expect(region.text()).toBe('0 SP dipilih · 8 SP dalam unit ini')
  })

  it('while the catalogue loads it shows a busy skeleton and no search box', () => {
    const w = mountPicker({ view: undefined, loading: true })
    expect(w.get('[role="group"]').attributes('aria-busy')).toBe('true')
    expect(w.find('[data-testid="sp-search"]').exists()).toBe(false)
    expect(w.text()).toContain('Memuatkan...')
  })

  it('shows the required star and an inline error', () => {
    const w = mountPicker({ required: true, error: 'Standard Pembelajaran (SP) belum dipilih.' })
    expect(w.text()).toContain('*')
    expect(w.text()).toContain('wajib')
    expect(w.get('[data-testid="field-error"]').attributes('role')).toBe('alert')
  })

  it('a flagged SP carries "perlu semakan" and a legend', async () => {
    const unit = sn.units('T4').find((u) => sn.sps(u.id).some((s) => s.code === '4.3.1'))!
    const w = mountPicker({ view: sn, unitId: unit.id })
    await w.get('[data-testid="sp-search"]').setValue('4.3.1')
    expect(w.get('[data-testid="sp-option-4.3.1"]').element.closest('li')!.textContent).toContain('perlu semakan')
    expect(w.get('[data-testid="sp-legend"]').text()).toContain('"perlu semakan"')
  })

  it('Pendidikan Islam rows are right-to-left Jawi with the spelling flag; codes stay left-to-right', async () => {
    const unit = pi.units('T4')[0]!
    const w = mountPicker({ view: pi, unitId: unit.id, rtl: true })
    await flushPromises()
    const rtl = w.findAll('[data-testid="sp-text-rtl"]')
    expect(rtl.length).toBeGreaterThan(0)
    expect(rtl[0]!.attributes('dir')).toBe('rtl')
    expect(rtl[0]!.attributes('lang')).toBe('ms-Arab')
    expect(w.get('[data-testid="sp-option-1.26.1"]').element.closest('li')!.textContent).toContain(
      'perlu semakan ejaan',
    )
    const code = w.get('[data-testid="sp-list"] [dir="ltr"]')
    expect(code.text()).toMatch(/^\d/)
    expect(w.get('[data-testid="sp-legend"]').text()).toBe(
      'Ejaan Jawi bagi SP ini belum disahkan. SP masih boleh dipilih.',
    )
  })
})
