// @vitest-environment jsdom
import { CircleAlert, CircleCheck } from '@lucide/vue'
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import AlertBox from '../AlertBox.vue'
import { ALERT_BOX_CLASSES } from '../classes'
import FlashOutlet from '../FlashOutlet.vue'

const svgInner = (c: typeof CircleAlert) => mount(c).get('svg').element.innerHTML

describe('AlertBox', () => {
  it('error variant: live red box classes, circle-alert icon, the message', () => {
    const w = mount(AlertBox, { props: { messages: 'Emel atau kata laluan tidak sah.' } })
    const box = w.get('div')
    expect(box.classes()).toEqual(
      expect.arrayContaining([
        'bg-red-50',
        'border-2',
        'border-red-200',
        'text-red-700',
        'rounded-2xl',
      ]),
    )
    expect(box.attributes('data-variant')).toBe('error')
    expect(w.get('svg').element.innerHTML).toBe(svgInner(CircleAlert))
    expect(w.findAll('p').map((p) => p.text())).toEqual(['Emel atau kata laluan tidak sah.'])
  })

  it('success variant: green box classes and circle-check icon', () => {
    const w = mount(AlertBox, { props: { variant: 'success', messages: 'Berjaya.' } })
    expect(w.get('div').classes()).toEqual(
      expect.arrayContaining(['bg-green-50', 'border-green-200', 'text-green-700']),
    )
    expect(w.get('svg').element.innerHTML).toBe(svgInner(CircleCheck))
  })

  it('renders one line per message and drops empty lines', () => {
    const w = mount(AlertBox, { props: { messages: ['Satu.', '', 'Dua.'] } })
    expect(w.findAll('p').map((p) => p.text())).toEqual(['Satu.', 'Dua.'])
  })

  it('renders nothing without messages or slot content', () => {
    expect(mount(AlertBox).html()).toBe('<!--v-if-->')
    expect(
      mount(AlertBox, { props: { messages: [] } })
        .find('div')
        .exists(),
    ).toBe(false)
    expect(
      mount(AlertBox, { props: { messages: '' } })
        .find('div')
        .exists(),
    ).toBe(false)
  })

  it('slot content replaces the lines', () => {
    const w = mount(AlertBox, { slots: { default: '<strong>Ralat</strong>' } })
    expect(w.get('strong').text()).toBe('Ralat')
  })

  it('boxClass replaces the default classes; attributes fall through', () => {
    const w = mount(AlertBox, {
      props: { messages: 'x', boxClass: 'p-3 bg-red-50 rounded-xl' },
      attrs: { class: 'mb-6', 'data-testid': 'm01-login-error' },
    })
    const box = w.get('div')
    expect(box.classes()).toEqual(['p-3', 'bg-red-50', 'rounded-xl', 'mb-6'])
    expect(box.attributes('data-testid')).toBe('m01-login-error')
  })

  it('adds no ARIA (D10)', () => {
    const html = mount(AlertBox, { props: { messages: 'x' } }).get('div').element.outerHTML
    expect(html).not.toMatch(/role=|aria-live/)
  })

  it('default class strings are complete literals (Tailwind can detect them)', () => {
    expect(ALERT_BOX_CLASSES.error).toContain(
      'bg-red-50 border-2 border-red-200 text-red-700 rounded-2xl',
    )
  })
})

describe('FlashOutlet', () => {
  it('renders nothing without a flash', () => {
    expect(mount(FlashOutlet).find('[data-testid="cmp-flash"]').exists()).toBe(false)
    expect(
      mount(FlashOutlet, { props: { flash: null } })
        .find('div')
        .exists(),
    ).toBe(false)
  })

  it('renders the flash as an alert box of its type', () => {
    const w = mount(FlashOutlet, {
      props: { flash: { type: 'success', message: 'Profil berjaya dikemaskini.' } },
      attrs: { class: 'mb-6' },
    })
    const box = w.get('[data-testid="cmp-flash"]')
    expect(box.attributes('data-variant')).toBe('success')
    expect(box.classes()).toEqual(expect.arrayContaining(['bg-green-50', 'mb-6']))
    expect(box.text()).toBe('Profil berjaya dikemaskini.')
  })

  it('lists every line of an error flash', async () => {
    const w = mount(FlashOutlet, { props: { flash: { type: 'error', message: ['A.', 'B.'] } } })
    expect(w.get('[data-testid="cmp-flash"]').attributes('data-variant')).toBe('error')
    expect(w.findAll('p').map((p) => p.text())).toEqual(['A.', 'B.'])
    await w.setProps({ flash: null })
    expect(w.find('[data-testid="cmp-flash"]').exists()).toBe(false)
  })
})
