// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { sanitizeQuestionHtml as s } from '../lib/sanitize'

describe('sanitizeQuestionHtml: XSS', () => {
  it('drops script/style/svg/iframe with their content', () => {
    expect(s('a<script>alert(1)</script>b')).toBe('ab')
    expect(s('a<style>p{}</style>b')).toBe('ab')
    expect(s('a<svg onload="x()"><text>t</text></svg>b')).toBe('ab')
    expect(s('a<iframe src="x">t</iframe>b<form><input></form>')).toBe('ab')
  })
  it('unwraps img and a (no URLs survive), keeping text', () => {
    expect(s('<img src=x onerror="x()">hi')).toBe('hi')
    expect(s('<a href="javascript:alert(1)">click</a>')).toBe('click')
  })
  it('unwraps unknown tags and keeps text and allowed children', () => {
    expect(s('<section><span>one <b>two</b></span></section>')).toBe('one <b>two</b>')
  })
  it('strips on*, style and other attributes', () => {
    expect(s('<b onclick="x()" style="color:red" id="i" data-x="1">t</b>')).toBe('<b>t</b>')
  })
  it('cleans nested evil inside allowed tags', () => {
    expect(s('<table><tr><td onclick="x()"><script>x</script>ok<img src=x onerror=y></td></tr></table>')).toBe(
      '<table><tbody><tr><td>ok</td></tr></tbody></table>',
    )
  })
})

describe('sanitizeQuestionHtml: allow-list', () => {
  it('keeps allowed tags', () => {
    const html = '<p><b>b</b><i>i</i><u>u</u><s>s</s><code>c</code><br></p><ul><li>x</li></ul><ol><li>y</li></ol>'
    expect(s(html)).toBe(html)
  })
  it('keeps leading whitespace', () => {
    expect(s('  hi')).toBe('  hi')
  })
  it('colspan/rowspan bounds 1..12 on th/td only', () => {
    expect(s('<table><tbody><tr><td colspan="2" rowspan="12">a</td></tr></tbody></table>')).toContain(
      '<td colspan="2" rowspan="12">',
    )
    expect(s('<table><tbody><tr><td colspan="0" rowspan="13">a</td></tr></tbody></table>')).toContain('<td>a')
    expect(s('<table><tbody><tr><th colspan="-1">a</th><td colspan="x" rowspan="1.5">b</td></tr></tbody></table>')).not.toMatch(
      /span/,
    )
    expect(s('<p colspan="2">a</p>')).toBe('<p>a</p>')
  })
  it('class: only poem, two-col, box survive', () => {
    expect(s('<div class="evil poem">x</div>')).toBe('<div class="poem">x</div>')
    expect(s('<div class="evil">x</div>')).toBe('<div>x</div>')
    expect(s('<p class="box two-col">x</p>')).toBe('<p class="box two-col">x</p>')
  })
  it('div: any other attribute is stripped', () => {
    expect(s('<div id="a" style="x:y" data-x="1" onclick="z()" class="box">x</div>')).toBe('<div class="box">x</div>')
  })
  it('allows bare inner divs and the two-col carrier', () => {
    const html = '<div class="two-col"><div>a</div><div>b</div></div>'
    expect(s(html)).toBe(html)
  })
})

describe('sanitizeQuestionHtml: hardening (review #694)', () => {
  it('drops noscript, template and math with their content', () => {
    expect(s('a<noscript><p>n</p></noscript>b')).toBe('ab')
    expect(s('a<template><p>t</p></template>b')).toBe('ab')
    expect(s('a<math><mi>x</mi></math>b')).toBe('ab')
  })
  it('strips javascript: and any other non-allowed token inside class', () => {
    expect(s('<p class="javascript:alert(1)">x</p>')).toBe('<p>x</p>')
    expect(s('<div class="box javascript:x()">x</div>')).toBe('<div class="box">x</div>')
  })
})
