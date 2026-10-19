// @vitest-environment jsdom
/** The Arabic / Jawi keyboard through the M04 public entry (for M10 S22/S24, D12). */
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import {
  ARAB_ROWS,
  ArabicKeyboardPanel,
  HARAKAT,
  JAWI_ROWS,
  backspaceAtCaret,
  insertAtCaret,
  keyboardRows,
} from '../..'

describe('keyboard helpers (public entry)', () => {
  it('exports the rows and harakat', () => {
    expect(keyboardRows('arab')).toBe(ARAB_ROWS)
    expect(keyboardRows('jawi')).toBe(JAWI_ROWS)
    expect(HARAKAT).toHaveLength(9)
    expect(JAWI_ROWS[0]).toContain('ڤ')
  })

  it('caret helpers insert and delete at the caret', () => {
    const a = insertAtCaret('ab', 1, 1, 'X')
    expect(a.value).toBe('aXb')
    expect(backspaceAtCaret(a.value, 2, 2).value).toBe('ab')
  })
})

describe('ArabicKeyboardPanel (public entry)', () => {
  it('shows the Jawi caption, emits insert for a key and close on the close button', () => {
    const wrapper = mount(ArabicKeyboardPanel, {
      props: { mode: 'jawi', anchor: null },
      attachTo: document.body,
    })
    // The panel is teleported to <body>.
    const caption = document.body.querySelector('[data-testid="vkb-caption"]')
    expect(caption?.textContent).toContain('Jawi')
    const buttons = [...document.body.querySelectorAll('button')]
    const key = buttons.find((b) => b.textContent.trim() === 'ڤ')
    expect(key).toBeDefined()
    key?.click()
    expect(wrapper.emitted('insert')?.[0]).toEqual(['ڤ'])
    const close = document.body.querySelector<HTMLButtonElement>('[data-testid="vkb-close"]')
    close?.click()
    expect(wrapper.emitted('close')).toBeTruthy()
    wrapper.unmount()
  })
})
