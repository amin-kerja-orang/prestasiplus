// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import { hasQuestionHtml } from '../lib/rich-text'
import StimulusFigure from '../StimulusFigure.vue'
import StimulusView from '../StimulusView.vue'
import type { StimulusData } from '../types'

const TABLE =
  '<table><tbody><tr><td rowspan="1" colspan="1">Fasal 30 </td></tr><tr><td rowspan="1" colspan="1">Peraturan urus niaga </td></tr></tbody></table>'

const figure = (kind: StimulusData['kind'], text: string) =>
  mount(StimulusFigure, { props: { stimulus: { id: 's1', kind, text } } })

describe('V2 HTML stimulus body (StimulusFigure)', () => {
  it.each(['passage', 'table', 'image'] as const)('%s: a table body renders a real <table>, not text', (kind) => {
    const w = figure(kind, TABLE)
    const cells = w.findAll('table td')
    expect(cells.map((c) => c.text())).toEqual(['Fasal 30', 'Peraturan urus niaga'])
    expect(w.text()).not.toContain('<table>')
    expect(w.find('td').attributes('colspan')).toBe('1')
    expect(w.find('td').attributes('rowspan')).toBe('1')
  })

  it('strips script, event attributes and javascript: URLs', () => {
    const w = figure(
      'passage',
      '<table><tr><td onclick="x()">a<script>window.__pwn=1</script><img src=x onerror="y()"><a href="javascript:z()">link</a></td></tr></table>',
    )
    const html = w.html()
    expect(html).not.toMatch(/<script/i)
    expect(html).not.toMatch(/onerror|onclick/i)
    expect(html).not.toMatch(/javascript:/i)
    expect(html).not.toMatch(/<img|<a /i)
    expect(w.find('td').text()).toContain('a')
  })

  it('plain text still renders as paragraphs', () => {
    const w = figure('passage', 'A.\n\nB < C.')
    expect(w.find('[data-testid=stimulus-html]').exists()).toBe(false)
    expect(w.findAll('p').map((p) => p.text())).toEqual(['A.', 'B < C.'])
  })

  it('plain text under a picture stays escaped text', () => {
    const w = mount(StimulusFigure, {
      props: { stimulus: { id: 's1', kind: 'image', src: '/x.png', text: 'Keterangan a < b' } },
    })
    expect(w.text()).toContain('Keterangan a < b')
  })

  it('a wide table scrolls inside its own container', () => {
    const w = figure('image', TABLE)
    expect(w.find('[data-testid=stimulus-html-scroll] table').exists()).toBe(true)
  })
})

describe('V2 HTML stimulus body (StimulusView)', () => {
  const stimulus = (text: string) => ({ id: 's1', kind: 'passage', label: 'Bahan 1', alt: 'x', text }) as never

  it('renders a real table and strips script', () => {
    const w = mount(StimulusView, {
      props: { stimulus: stimulus(`${TABLE}<script>1</script>`) },
      global: { stubs: { UTable: true } },
    })
    expect(w.findAll('table td')).toHaveLength(2)
    expect(w.html()).not.toMatch(/<script/i)
  })

  it('plain text renders as before', () => {
    const w = mount(StimulusView, {
      props: { stimulus: stimulus('Petikan biasa') },
      global: { stubs: { UTable: true } },
    })
    expect(w.text()).toContain('Petikan biasa')
    expect(w.find('[data-testid=stimulus-html]').exists()).toBe(false)
  })
})

describe('hasQuestionHtml', () => {
  it('detects known tags only', () => {
    expect(hasQuestionHtml(TABLE)).toBe(true)
    expect(hasQuestionHtml('a < b and c > d')).toBe(false)
    expect(hasQuestionHtml('$x<y$')).toBe(false)
  })
})
