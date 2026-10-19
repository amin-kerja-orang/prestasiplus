// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'

import { sanitizeHtml } from '../../lib/artikel/sanitize-html'

describe('sanitizeHtml (SEC-M09-01)', () => {
  it('keeps the live body markup', () => {
    const html = '<h2>Apa Itu?</h2><p>Teks <strong>tebal</strong></p><ol><li>Satu</li></ol>'
    expect(sanitizeHtml(html)).toBe(html)
  })

  it('drops script, iframe, object, svg and style with their content', () => {
    const out = sanitizeHtml(
      '<p>a</p><script>alert(1)</script><iframe src="https://x"></iframe><object data="x"></object><svg onload="x()"><circle/></svg><style>p{}</style><p>b</p>',
    )
    expect(out).toBe('<p>a</p><p>b</p>')
  })

  it('removes event handlers and unknown attributes', () => {
    const out = sanitizeHtml(
      '<p onclick="x()" style="color:red" class="c">t</p><img src="https://a/b.png" onerror="x()">',
    )
    expect(out).toContain('<p>t</p>')
    expect(out).not.toContain('onerror')
    expect(out).not.toContain('onclick')
  })

  it('rejects javascript: and data: URLs, also when obfuscated', () => {
    const out = sanitizeHtml(
      '<a href="javascript:alert(1)">a</a><a href="  JaVa\tScript:alert(1)">b</a><a href="data:text/html,x">c</a><img src="data:image/png;base64,AAA">',
    )
    expect(out).not.toMatch(/javascript/i)
    expect(out).not.toContain('data:')
    expect(out).toBe('<a>a</a><a>b</a><a>c</a><img loading="lazy">')
  })

  it('adds rel to links and keeps https hrefs', () => {
    const out = sanitizeHtml('<a href="https://example.com" target="_blank">x</a>')
    expect(out).toContain('href="https://example.com"')
    expect(out).toContain('rel="noopener noreferrer"')
  })

  it('unwraps unknown elements but keeps their text', () => {
    expect(sanitizeHtml('<custom-tag>hi <b>there</b></custom-tag>')).toBe('hi <b>there</b>')
  })

  it('escapes text entities that look like markup', () => {
    expect(sanitizeHtml('<p>&lt;script&gt;x&lt;/script&gt;</p>')).toBe(
      '<p>&lt;script&gt;x&lt;/script&gt;</p>',
    )
  })
})
