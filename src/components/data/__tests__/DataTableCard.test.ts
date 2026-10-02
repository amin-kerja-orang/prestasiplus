// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { TABLE_CLASSES } from '../classes'
import DataTableCard from '../DataTableCard.vue'

const TABLE = '<table><thead><tr><th>Nama</th></tr></thead><tbody><tr><td>x</td></tr></tbody></table>'

describe('DataTableCard', () => {
  it('scrolls inside the card: the card clips, a wrapper has overflow-x-auto, min-w-0 stops flex blow-out', () => {
    const w = mount(DataTableCard, { slots: { default: TABLE } })
    expect(w.classes()).toEqual(expect.arrayContaining(['rounded-2xl', 'bg-white', 'overflow-hidden', 'min-w-0', 'max-w-full']))
    const scroller = w.get('.overflow-x-auto')
    expect(scroller.find('table').exists()).toBe(true)
    expect(w.element.classList.contains('overflow-x-auto')).toBe(false)
  })

  it('minWidth forces the table to its natural width so it scrolls in the card (1900px at 375)', () => {
    const w = mount(DataTableCard, { props: { minWidth: 1900 }, slots: { default: TABLE } })
    const inner = w.get('.overflow-x-auto > div')
    expect(inner.attributes('style')).toContain('min-width: 1900px')
  })

  it('without minWidth the table takes its own width', () => {
    const w = mount(DataTableCard, { slots: { default: TABLE } })
    expect(w.get('.overflow-x-auto > div').attributes('style')).toBeUndefined()
  })

  it('renders header and footer slots outside the scroller (pager never scrolls sideways)', () => {
    const w = mount(DataTableCard, {
      slots: { default: TABLE, header: '<h2 id="h">Senarai</h2>', footer: '<nav id="f"></nav>' },
    })
    expect(w.get('#h').element.closest('.overflow-x-auto')).toBeNull()
    expect(w.get('#f').element.closest('.overflow-x-auto')).toBeNull()
  })

  it('has no sticky column classes (design-system §7.4)', () => {
    const all = Object.values(TABLE_CLASSES).join(' ')
    expect(all).not.toMatch(/sticky/)
  })

  it('keeps table text at 12px or more (header text-xs, cell text-sm)', () => {
    expect(TABLE_CLASSES.th).toContain('text-xs')
    expect(TABLE_CLASSES.th).toContain('font-bold')
    expect(TABLE_CLASSES.th).toContain('uppercase')
    expect(TABLE_CLASSES.td).toContain('text-sm')
    expect(Object.values(TABLE_CLASSES).join(' ')).not.toMatch(/text-\[(?:[0-9]|1[01])px\]/)
  })
})
