// @vitest-environment jsdom
import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'

import RichText from '../RichText.vue'
import { citeSegments, renderMarkup, renderMath, renderRich } from '../lib/rich-text'

const TOKEN = 'abcdefghijklmnopqrstuv' // 22 chars

describe('renderMarkup', () => {
  it('matches renderRich for plain text and $latex$', () => {
    for (const t of ['hello', 'a & b < c "q" \'s\'', 'x $x^2$ y', 'odd $ sign', 'multi\nline', ' lead']) {
      expect(renderMarkup(t)).toBe(renderRich(t))
    }
  })
  it('keeps renderRich and citeSegments unchanged', () => {
    expect(renderRich('a<b')).toBe('a&lt;b')
    expect(citeSegments('lihat Bahan 1', [{ id: 's1', label: 'Bahan 1' }]).map((x) => x.kind)).toEqual(['text', 'cite'])
  })
  it('$$ is block KaTeX, $ is inline', () => {
    expect(renderMarkup('$$x^2$$')).toBe(renderMath('x^2', true))
    expect(renderMarkup('$$x^2$$')).toContain('katex-display')
    expect(renderMarkup('$x$')).not.toContain('katex-display')
    expect(renderMarkup('a $$x$$ b $y$')).toBe(`a ${renderMath('x', true)} b ${renderMath('y')}`)
  })
  it('odd $$ stays literal', () => {
    expect(renderMarkup('a $$ b')).toBe('a $$ b')
  })
  it('{{img}} good token becomes img; bad token stays literal', () => {
    expect(renderMarkup(`{{img:${TOKEN}}}`)).toBe(`<img src="/api/files/${TOKEN}" alt="">`)
    expect(renderMarkup('{{img:../x}}')).toBe('{{img:../x}}')
    expect(renderMarkup('{{img:"onerror=x}}')).not.toContain('<img')
  })
  it('{{gap:N}} in a paragraph and a td', () => {
    expect(renderMarkup('<p>a {{gap:2}} b</p>')).toBe('<p>a <span class="qd-gap" data-gap="2"></span> b</p>')
    expect(renderMarkup('<table><tbody><tr><td>{{gap:1}}</td></tr></tbody></table>')).toContain(
      '<td><span class="qd-gap" data-gap="1"></span></td>',
    )
    expect(renderMarkup('{{gap:0}}')).toBe('{{gap:0}}')
    expect(renderMarkup('{{gap:99}}')).toBe('<span class="qd-gap" data-gap="99"></span>')
    expect(renderMarkup('{{gap:100}}')).toBe('{{gap:100}}')
    expect(renderMarkup('{{gap:1000}}')).toBe('{{gap:1000}}')
    expect(renderMarkup('{{gap:007}}')).toBe('{{gap:007}}')
  })
  it('renders each S2-T10 carrier exactly', () => {
    const cases = [
      '<div class="poem">line 1<br>line 2</div>',
      '<div class="two-col"><div>a</div><div>b</div></div>',
      '<div class="box">note</div>',
      '<u>u</u> <s>s</s>',
    ]
    for (const c of cases) expect(renderMarkup(c)).toBe(c)
  })
  it('never expands a marker inside an attribute', () => {
    const out = renderMarkup(`<td colspan="2" class="{{gap:1}}">x</td><p class="poem" title="{{img:${TOKEN}}}">$a$</p>`)
    expect(out).not.toContain('qd-gap')
    expect(out).not.toContain('<img')
  })
  it('sanitises before expanding', () => {
    expect(renderMarkup('<script>alert(1)</script>$x$')).toBe(renderMath('x'))
    expect(renderMarkup('<b>&lt;i&gt;</b>')).toBe('<b>&lt;i&gt;</b>')
  })
})

describe('RichText markup prop', () => {
  it('is off by default (HTML shown escaped) and opt-in renders it', () => {
    expect(mount(RichText, { props: { text: '<u>x</u>' } }).html()).toContain('&lt;u&gt;')
    expect(mount(RichText, { props: { text: '<u>x</u>', markup: true } }).html()).toContain('<u>x</u>')
  })
})

describe('renderMath limits', () => {
  it('caps KaTeX sizes (maxSize), so a huge \\rule cannot widen the layout', () => {
    const html = renderMath('\\rule{9999em}{1em}', true)
    // The TeX source stays in the MathML annotation; the drawn width is capped at 20em.
    expect(html).toContain('border-right-width:20em')
    expect(html).not.toMatch(/width[:=]"?9999em/)
  })
})
