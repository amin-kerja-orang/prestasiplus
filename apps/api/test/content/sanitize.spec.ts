import { beforeEach, describe, expect, it } from 'vitest'

import { SEED_ARTICLES } from '../../prisma/seed/content'
import { AllowListHtmlSanitizer, originsOf, SanitizeHtmlSanitizer, type HtmlSanitizer } from '../../src/modules/content/shared'
import { firstHref, problemsOf } from './sanitize-oracle'

// The tests talk to the interface only; they run against the production adapter and against the documented fallback.
let s: HtmlSanitizer = new SanitizeHtmlSanitizer()
/** The adapter prints void elements as `<br />`; the fallback as `<br>`. Both are the same markup. */
const clean = (html: string): string => s.sanitize(html).replaceAll(' />', '>')

/** Nothing executable may remain in any output: a real parser sees only allow-listed elements, attributes and URLs. */
function expectInert(out: string): void {
  expect(problemsOf(out), out).toEqual([])
  expect(out).not.toMatch(/<\s*script/i)
  expect(out).not.toMatch(/<\s*(iframe|object|embed|svg|math|style|link|meta)/i)
  expect(out).not.toMatch(/<[^>]*\son[a-z]+\s*=/i)
  expect(out).not.toMatch(/<[^>]*\sstyle\s*=/i)
  expect(out).not.toMatch(/<[^>]*(href|src)\s*=\s*"\s*(javascript|data|vbscript):/i)
}

const IMPLEMENTATIONS: Array<[string, () => HtmlSanitizer]> = [
  ['sanitize-html adapter', () => new SanitizeHtmlSanitizer(['https://app.example'])],
  ['allow-list fallback', () => new AllowListHtmlSanitizer()],
]

describe.each(IMPLEMENTATIONS)('HtmlSanitizer: %s', (_name, make) => {
  const adapter = _name.startsWith('sanitize-html')
  beforeEach(() => {
    s = make()
  })

  it.runIf(adapter)('LOW-1: an image is kept only as a stored file (/api/files/<22-character token>), relative or on a configured origin', () => {
    const token = 'AbCdEfGhIjKlMnOpQrStUv'
    expect(clean(`<img src="/api/files/${token}" alt="a">`)).toBe(`<img src="/api/files/${token}" alt="a">`)
    for (const src of [
      'https://tracker.test/pixel.gif',
      'http://app.example.evil.test/api/files/' + token,
      'https://app.example/other/path',
      `https://app.example/api/files/${token}?x=1`,
      '/api/me',
      '/api/files/short',
      `/api/files/${token}/extra`,
      `//app.example/api/files/${token}`,
      'data:image/png;base64,AAAA',
      `file.png`,
    ]) {
      expect(clean(`<p>a</p><img src="${src}">`), src).toBe('<p>a</p>')
    }
    expect(clean(`<img src="https://app.example/api/files/${token}">`)).toBe(`<img src="https://app.example/api/files/${token}">`)
  })

  it('keeps the allowed markup', () => {
    const html =
      '<h2>T</h2><p>a <strong>b</strong> <em>c</em><br></p><ul><li>x</li></ul><ol><li>y</li></ol><blockquote>q</blockquote>' +
      '<a href="https://example.com/a?b=1&amp;c=2">l</a><a href="mailto:a@b.test">m</a><img src="/api/files/BBBBBBBBBBBBBBBBBBBBBB" alt="x">' +
      '<table><thead><tr><th colspan="2">h</th></tr></thead><tbody><tr><td>1</td><td>2</td></tr></tbody></table>'
    const expected = html
      .replace('<a href="https://example.com/a?b=1&amp;c=2">', '<a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer">')
      .replace('<a href="mailto:a@b.test">', '<a href="mailto:a@b.test" rel="noopener noreferrer">')
    expect(clean(html)).toBe(expected)
    expect(clean('<p>Kandungan <b>HTML</b></p>')).toBe('<p>Kandungan <b>HTML</b></p>')
  })

  it('removes <script> with its content, any case', () => {
    expect(clean('<p>a</p><script>alert(1)</script><p>b</p>')).toBe('<p>a</p><p>b</p>')
    expect(clean('<SCRIPT>alert(1)</SCRIPT>x')).toBe('x')
    expect(clean('<ScRiPt src=//evil.test/x.js></sCrIpT >x')).toBe('x')
    expect(clean('<script>alert(1)')).toBe('')
    expect(clean('<scr<script>ipt>alert(1)</scr</script>ipt>')).not.toMatch(/<script/i)
  })

  it('removes on* attributes and style', () => {
    expect(clean('<img src="/api/files/AAAAAAAAAAAAAAAAAAAAAA" onerror="alert(1)">')).toBe('<img src="/api/files/AAAAAAAAAAAAAAAAAAAAAA">')
    expect(clean('<img src=x onerror=alert(1)>')).toBe('')
    expect(clean('<p onclick="x()" STYLE="position:fixed" ONMOUSEOVER=y>t</p>')).toBe('<p>t</p>')
    expect(clean('<a href="https://e.test" onfocus="x" autofocus>t</a>')).toBe('<a href="https://e.test" rel="noopener noreferrer">t</a>')
    expect(clean('<img/src="/api/files/AAAAAAAAAAAAAAAAAAAAAA"/onerror=alert(1)>')).toBe('<img src="/api/files/AAAAAAAAAAAAAAAAAAAAAA">')
  })

  it('drops javascript:, data: and vbscript: URLs, with whitespace, control characters and encodings', () => {
    const hrefs = [
      'javascript:alert(1)',
      'JaVaScRiPt:alert(1)',
      '  javascript:alert(1)',
      'java\tscript:alert(1)',
      'java\nscript:alert(1)',
      'java script:alert(1)',
      '&#106;avascript:alert(1)',
      '&#x6A;avascript:alert(1)',
      'javascript&colon;alert(1)',
      'javascript&#58;alert(1)',
      'jav&#x09;ascript:alert(1)',
      '&#0000106avascript:alert(1)',
      '\u0001javascript:alert(1)',
      'data:text/html;base64,PHNjcmlwdD5hbGVydCgxKTwvc2NyaXB0Pg==',
      'vbscript:msgbox(1)',
      '//evil.test/x',
      '/\\evil.test/x',
    ]
    for (const h of hrefs) {
      const out = clean(`<a href="${h}">x</a>`)
      expect(out, h).toBe('<a>x</a>')
      expectInert(out)
      expect(clean(`<img src="${h}">`), h).toBe('')
    }
    expect(clean('<a href=javascript:alert(1)>x</a>')).toBe('<a>x</a>')
    expect(clean("<a href='javascript:alert(1)'>x</a>")).toBe('<a>x</a>')
    expect(clean('<img src="data:image/svg+xml;base64,AAAA">')).toBe('')
  })

  it('keeps https, mailto and root-relative URLs', () => {
    expect(clean('<img src="/api/files/AbCdEfGhIjKlMnOpQrStUv">')).toBe('<img src="/api/files/AbCdEfGhIjKlMnOpQrStUv">')
    expect(clean('<a href="#top">x</a>')).toBe('<a href="#top" rel="noopener noreferrer">x</a>')
  })

  it('drops iframe, object, embed, svg, math, style, link and meta; form controls become text', () => {
    for (const html of [
      '<iframe src="https://e.test"></iframe>a',
      '<iframe src="javascript:alert(1)">fallback</iframe>a',
      '<object data="x.swf"><param name=a></object>a',
      '<embed src="x.swf">a',
      '<svg onload=alert(1)><circle/></svg>a',
      '<math><mi xlink:href="javascript:alert(1)">x</mi></math>a',
      '<style>body{display:none}</style>a',
      '<link rel=stylesheet href=//e.test/x.css>a',
      '<meta http-equiv="refresh" content="0;url=javascript:alert(1)">a',
      '<form action="//e.test"><input name=x><button>go</button></form>a',
    ]) {
      const out = clean(html)
      expectInert(out)
      expect(out.endsWith('a'), html).toBe(true)
      expect(out, html).not.toMatch(/<(form|input|button|param|circle)/i)
    }
    expect(clean('<iframe src="https://e.test"></iframe>a')).toBe('a')
  })

  it('escapes unknown tags as text instead of passing them on', () => {
    // The fallback prints an unknown tag as text; the adapter discards the tag and keeps its text. Both are inert.
    expect(clean('<blink>x</blink>')).toBe(adapter ? 'x' : '&lt;blink&gt;x&lt;/blink&gt;')
    expect(clean('<image src=x onerror=alert(1)>')).toBe(adapter ? '' : '&lt;image src=x onerror=alert(1)&gt;')
    expect(clean('1 < 2 and 3 > 2')).toBe('1 &lt; 2 and 3 &gt; 2')
  })

  it('handles comments, declarations and nested or broken tricks', () => {
    expect(clean('a<!-- <script>alert(1)</script> -->b')).toBe('ab')
    expect(clean('a<!--[if IE]><script>alert(1)</script><![endif]-->b')).toBe('ab')
    expect(clean('<!DOCTYPE html><?xml version="1"?>x')).toBe('x')
    expect(clean('<<script>script>alert(1)<</script>/script>')).not.toMatch(/<script/i)
    expect(clean('<p <script>alert(1)</script>>t</p>')).not.toMatch(/<script/i)
    expect(clean('<a href="x" href="javascript:alert(1)">t</a>')).not.toMatch(/javascript/i)
    expect(clean('<a href="https://e.test" href="javascript:alert(1)">t</a>')).toBe('<a href="https://e.test" rel="noopener noreferrer">t</a>')
    expectInert(clean('<img src="/api/files/AAAAAAAAAAAAAAAAAAAAAA" onerror="alert(1)'))
    expect(clean('<p>a\u0000<scr\u0000ipt>alert(1)</script></p>')).toBe('<p>a</p>')
    expectInert(clean('<a href="x" title="&quot;><script>alert(1)</script>">t</a>'))
    expectInert(clean('<div><div><div><img src=x onerror=alert(1)></div></div></div>'))
    expectInert(clean('<p title="x"onmouseover="alert(1)">t</p>'))
  })

  it('escapes attribute values it keeps', () => {
    expect(clean('<img src="/api/files/AAAAAAAAAAAAAAAAAAAAAA" alt=\'"><script>alert(1)</script>\'>')).toBe(
      '<img src="/api/files/AAAAAAAAAAAAAAAAAAAAAA" alt="&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;">',
    )
  })

  it('balances tags and caps nesting', () => {
    expect(clean('<p><strong>a</p>b</em>c')).toBe('<p><strong>a</strong></p>bc')
    expect(clean('<table><tr><td>x')).toBe('<table><tr><td>x</td></tr></table>')
    const deep = clean('<div>'.repeat(500) + 'x')
    // The fallback caps the depth at 64, the adapter at 100 (nestingLimit); both always balance it.
    if (!adapter) expect((deep.match(/<div>/g) ?? []).length).toBeLessThanOrEqual(64)
    const t0 = performance.now()
    const huge = clean('<div>'.repeat(40_000) + 'x')
    expect(performance.now() - t0).toBeLessThan(10_000)
    expect((huge.match(/<\/div>/g) ?? []).length).toBe((huge.match(/<div>/g) ?? []).length)
    if (adapter) {
      const d150 = clean('<div>'.repeat(150) + 'x' + '</div>'.repeat(150))
      expect((d150.match(/<div>/g) ?? []).length).toBeLessThanOrEqual(100)
      expect((d150.match(/<\/div>/g) ?? []).length).toBe((d150.match(/<div>/g) ?? []).length)
      expect((huge.match(/<div>/g) ?? []).length).toBeLessThanOrEqual(100)
    }
    expect((deep.match(/<\/div>/g) ?? []).length).toBe((deep.match(/<div>/g) ?? []).length)
  })

  it('keeps entities in text and is idempotent', () => {
    // The fallback keeps entity references as written; the adapter prints the character (same text).
    expect(clean('<p>Tom &amp; Jerry &copy; 2026 &#169; a & b</p>')).toBe(adapter ? '<p>Tom &amp; Jerry © 2026 © a &amp; b</p>' : '<p>Tom &amp; Jerry &copy; 2026 &#169; a &amp; b</p>')
    const samples = [
      '<p>a <b onclick=x>b</b> <a href="javascript:x">c</a></p><script>x</script>',
      '<<script>script>alert(1)',
      '<img src="/a.png" alt="a &amp; b"> 1 < 2',
      '<table><tr><td>x<p>y</td></tr>',
      '&lt;script&gt;',
      '<a href="https://e.test/?a=1&b=2">x</a>',
    ]
    for (const x of samples) expect(clean(clean(x)), x).toBe(clean(x))
  })

  it('keeps a query string with entity-like names intact (round trip through a parser)', () => {
    const url = 'https://x.com/?a=1&num=3&tab=2&plus=1&amp=4&lt=5'
    for (const html of [`<a href="${url}">x</a>`, `<a href="${url.replace(/&/g, '&amp;')}">x</a>`]) {
      const out = clean(html)
      expect(firstHref(out), out).toBe(url)
    }
    expect(clean('<a href="https://x.com/?a=1&num=3&tab=2&plus=1">x</a>')).toContain('&amp;num=3&amp;tab=2&amp;plus=1')
    expect(clean('<a href="javascript&colon;alert(1)">x</a>')).toBe('<a>x</a>')
    expect(clean('<a href="javascript&#58alert(1)">x</a>')).toBe('<a>x</a>')
  })

  it('the seed bodies are a fixed point of the sanitiser', () => {
    for (const a of SEED_ARTICLES) expect(clean(a.content), a.slug).toBe(a.content)
  })

  it('long runs of unterminated tags do not cost quadratic time', () => {
    const cases = [
      '<a '.repeat(60_000) + '>',
      '<a x="'.repeat(30_000) + '>',
      '<img '.repeat(40_000) + '>',
      '<a '.repeat(100_000),
      '<p'.repeat(60_000) + '>',
      '<!--'.repeat(50_000),
      '<script>'.repeat(30_000),
    ]
    for (const html of cases) {
      const t0 = performance.now()
      const out = clean(html)
      const ms = performance.now() - t0
      expect(ms, `${html.slice(0, 12)} took ${String(Math.round(ms))} ms`).toBeLessThan(2_000)
      expectInert(out)
    }
  })

  it('stays inert on random mutations of attack strings (fuzz)', () => {
    const parts = ['<', '>', '"', "'", '=', '/', ' ', 'script', 'SCRIPT', 'img', 'a', 'href', 'src', 'onerror', 'javascript:', 'alert(1)', '&#106;', '&colon;', '\t', 'iframe', 'svg', '<!--', '-->', 'style', 'p', 'data:', 'title=', 'alt=', '&num', '&amp', '&lt', '&#x6A', '&Tab', '<a ', '<img ', 'x="', '<a href=', '<img src=', '<p ', '&quot']
    let seed = 12345
    const rnd = (): number => {
      seed = (seed * 1664525 + 1013904223) % 4294967296
      return seed / 4294967296
    }
    for (let k = 0; k < 2000; k++) {
      let x = ''
      for (let j = 0; j < 14; j++) x += parts[Math.floor(rnd() * parts.length)] as string
      const out = clean(x)
      expectInert(out)
      expect(clean(out), x).toBe(out)
    }
  })
})

describe('originsOf (PUBLIC_ORIGINS)', () => {
  it('keeps only http and https origins, normalises a path away, and drops the rest', () => {
    expect(originsOf(undefined)).toEqual([])
    expect(originsOf('')).toEqual([])
    expect(originsOf(' , ')).toEqual([])
    expect(originsOf('https://app.x.com/')).toEqual(['https://app.x.com'])
    expect(originsOf('https://app.x.com/some/path?q=1, http://localhost:5173')).toEqual(['https://app.x.com', 'http://localhost:5173'])
    expect(originsOf('ftp://z')).toEqual([])
    expect(originsOf('javascript:x')).toEqual([])
    expect(originsOf('data:text/html,x')).toEqual([])
    expect(originsOf('not a url at all')).toEqual([])
    expect(originsOf('ftp://z,https://ok.example,javascript:x,%%%')).toEqual(['https://ok.example'])
  })
})
