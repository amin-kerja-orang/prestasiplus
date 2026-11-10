// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import ClozeGaps from '../ClozeGaps.vue'

describe('ClozeGaps', () => {
  it('puts an input at each gap in place, labelled "Ruang kosong N"', () => {
    const w = mount(ClozeGaps, { props: { text: 'Ali {{gap:1}} ke {{gap:2}} pasar.' } })
    const ins = w.findAll('input')
    expect(ins.map((i) => i.attributes('aria-label'))).toEqual(['Ruang kosong 1', 'Ruang kosong 2'])
    expect(w.element.innerHTML.indexOf('Ali')).toBeLessThan(w.element.innerHTML.indexOf('<input'))
    expect(w.find('.qd-gap').exists()).toBe(false)
  })

  it.each([375, 768, 1280])('inputs are >= 44px (min-h-11) at %ipx', (width) => {
    window.innerWidth = width
    const w = mount(ClozeGaps, { props: { text: '{{gap:1}} dan {{gap:2}}' } })
    for (const i of w.findAll('input')) expect(i.classes()).toContain('min-h-11')
  })

  it('mounts inputs inside table cells', () => {
    const w = mount(ClozeGaps, {
      props: { text: '<table><tbody><tr><td>Nama</td><td>{{gap:3}}</td></tr></tbody></table>' },
    })
    expect(w.find('td input[aria-label="Ruang kosong 3"]').exists()).toBe(true)
  })

  it('v-model is a Record by gap number and keeps the other gaps', async () => {
    const w = mount(ClozeGaps, { props: { text: '{{gap:1}} {{gap:2}}', modelValue: { 1: 'satu' } } })
    expect((w.find('[data-testid=gap-input-1]').element as HTMLInputElement).value).toBe('satu')
    await w.find('[data-testid=gap-input-2]').setValue('dua')
    expect(w.emitted('update:modelValue')![0]).toEqual([{ 1: 'satu', 2: 'dua' }])
  })

  it('the example gap is filled and read-only and emits nothing', async () => {
    const w = mount(ClozeGaps, {
      props: { text: '{{gap:1}} {{gap:2}}', exampleGap: { n: 1, answer: 'contoh' } },
    })
    const ex = w.find('[data-testid=gap-example-1]')
    expect((ex.element as HTMLInputElement).value).toBe('contoh')
    expect(ex.attributes('readonly')).toBeDefined()
    await ex.setValue('lain')
    expect(w.emitted('update:modelValue')).toBeUndefined()
    expect(w.find('[data-testid=gap-input-2]').attributes('readonly')).toBeUndefined()
  })

  it('typed text with HTML stays a value and is never interpreted', () => {
    const evil = '<img src=x onerror=alert(1)><b>x</b>'
    const w = mount(ClozeGaps, { props: { text: '{{gap:1}}', modelValue: { 1: evil } } })
    expect((w.find('input').element as HTMLInputElement).value).toBe(evil)
    expect(w.find('img').exists()).toBe(false)
    expect(w.find('b').exists()).toBe(false)
  })

  it('markup in the question text is sanitised', () => {
    const w = mount(ClozeGaps, { props: { text: '<script>alert(1)</script><b>tebal</b> {{gap:1}}' } })
    expect(w.find('script').exists()).toBe(false)
    expect(w.find('b').text()).toBe('tebal')
  })

  it('gap numbers above MAX_GAP are not inputs', () => {
    const w = mount(ClozeGaps, { props: { text: '{{gap:100}}' } })
    expect(w.find('input').exists()).toBe(false)
  })

  it('word cap shows the hint but keeps the text', () => {
    const ok = mount(ClozeGaps, { props: { text: '{{gap:1}}', maxWords: 1, modelValue: { 1: 'satu' } } })
    expect(ok.find('[data-testid=gap-max-hint]').exists()).toBe(false)
    const over = mount(ClozeGaps, {
      props: { text: '{{gap:1}}', maxWords: 1, modelValue: { 1: 'satu dua' } },
    })
    expect(over.find('[data-testid=gap-max-hint]').text()).toBe('Maksimum 1 patah perkataan.')
    expect((over.find('input').element as HTMLInputElement).value).toBe('satu dua')
  })
})
