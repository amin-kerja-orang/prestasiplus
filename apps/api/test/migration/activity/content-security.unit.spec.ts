/**
 * BE-29 Part B child safety, pure transforms (no database): legacy HTML is sanitised with the API's own sanitiser, and a
 * migrated video must pass the API's `isAllowedHost` (https on a YouTube or Vimeo host). Staged values are synthetic.
 */
import { describe, expect, it } from 'vitest'

import { SanitizeHtmlSanitizer } from '../../../src/modules/content/shared/sanitize-html.sanitizer'
import { transformArticle, transformNote, transformVideo } from '../../../src/migration/transform/content'
import { isAllowedHost } from '../../../src/modules/content/videos/videos.service'

const api = new SanitizeHtmlSanitizer([])

const article = (body: string) => ({
  id: '1', title: 'Artikel', slug: 'artikel', category: 'umum', grade_level: 'semua', is_published: '1', views: '0',
  author_id: '1', body, created_at: '2026-03-01T00:00:00Z',
})
const note = (body: string) => ({
  id: '1', title: 'Nota', note_type: 'formula', subject: 'matematik', grade: 'Tingkatan 4', is_published: '1', views: '0',
  body, created_at: '2026-03-01T00:00:00Z',
})
const video = (url: string, extra: Record<string, string> = {}) => ({
  id: '1', title: 'Video', url, category: 'tutorial', created_at: '2026-03-01T00:00:00Z', ...extra,
})

const articleContent = (html: string): string => {
  const o = transformArticle(article(html), { authorId: '9' })
  if (!o.ok) throw new Error(`rejected ${o.reject.reason}`)
  return o.value.content
}
const noteContent = (html: string): string => {
  const o = transformNote(note(html), { ownerId: '9' })
  if (!o.ok) throw new Error(`rejected ${o.reject.reason}`)
  return o.value.content
}

const HOSTILE = [
  '<p>a</p><script>alert(1)</script>',
  '<img src=x onerror=alert(1)>',
  '<a href="javascript:alert(1)">x</a>',
  '<a href="&#106;avascript:alert(1)">x</a>',
  '<p onclick="alert(1)" style="x:y">t</p><iframe src="https://x.invalid"></iframe>',
]

describe.each([
  ['article content', articleContent],
  ['note body', noteContent],
])('%s is sanitised', (_name, run) => {
  it('removes <script> with its content', () => {
    const out = run('<p>a</p><script>alert(1)</script>')
    expect(out).toBe('<p>a</p>')
  })

  it('removes an onerror handler (and an image that is not a stored file)', () => {
    const out = run('<p>a</p><img src=x onerror=alert(1)>')
    expect(out).not.toMatch(/onerror|alert/i)
    expect(out).toBe('<p>a</p>')
  })

  it('removes a javascript: href but keeps the text', () => {
    const out = run('<a href="javascript:alert(1)">klik</a> <a href="&#106;avascript:alert(1)">dua</a>')
    expect(out).not.toMatch(/javascript|alert|href/i)
    expect(out).toContain('klik')
    expect(out).toContain('dua')
  })

  it('keeps allowed formatting and https links', () => {
    const out = run('<h2>Tajuk</h2><p>Satu <strong>tebal</strong> <em>condong</em></p><ul><li>a</li></ul><a href="https://contoh.invalid/x">pautan</a>')
    expect(out).toBe('<h2>Tajuk</h2><p>Satu <strong>tebal</strong> <em>condong</em></p><ul><li>a</li></ul><a href="https://contoh.invalid/x" rel="noopener noreferrer">pautan</a>')
  })

  it('equals what the API would store for the same input, and is idempotent', () => {
    for (const html of HOSTILE) {
      expect(run(html)).toBe(api.sanitize(html))
      expect(api.sanitize(run(html))).toBe(run(html))
    }
  })

  it('is deterministic', () => {
    expect(run(HOSTILE.join(''))).toBe(run(HOSTILE.join('')))
  })
})

describe('the sanitiser can be the run-configured one', () => {
  it('uses the one passed in', () => {
    const o = transformArticle(article('<p>x</p>'), { authorId: '9', sanitizer: { sanitize: () => 'FIXED' } })
    expect(o.ok && o.value.content).toBe('FIXED')
  })

  it('a blank content is still INVALID_VALUE content', () => {
    const o = transformArticle(article('  '), { authorId: '9' })
    expect(o.ok).toBe(false)
  })
})

describe('videos: only the API allow-list reaches v2', () => {
  it.each([
    'https://www.youtube.com/watch?v=abcdefghijk',
    'https://youtu.be/abcdefghijk',
    'https://vimeo.com/123456',
  ])('accepts %s', (url) => {
    expect(isAllowedHost(url)).toBe(true)
    const o = transformVideo(video(url), { ownerId: '9' })
    expect(o.ok && o.value.visibility).toBe('global')
  })

  it.each([
    ['an http YouTube address', 'http://www.youtube.com/watch?v=abcdefghijk'],
    ['a host that is not on the list', 'https://contoh.invalid/video/1'],
    ['a look-alike host', 'https://www.youtube.com.contoh.invalid/watch?v=abcdefghijk'],
    ['another video site', 'https://www.dailymotion.com/video/x1'],
    ['credentials in the address', 'https://user:pw@www.youtube.com/watch?v=abcdefghijk'],
    ['a YouTube host without a video id', 'https://www.youtube.com/'],
  ])('rejects %s as UNSUPPORTED url', (_name, url) => {
    expect(isAllowedHost(url)).toBe(false)
    const o = transformVideo(video(url), { ownerId: '9' })
    expect(o.ok).toBe(false)
    if (!o.ok) expect([o.reject.reason, o.reject.column]).toEqual(['UNSUPPORTED', 'url'])
  })

  it('a non-http address stays INVALID_VALUE url', () => {
    const o = transformVideo(video('ftp://contoh.invalid/c'), { ownerId: '9' })
    if (o.ok) throw new Error('expected a reject')
    expect([o.reject.reason, o.reject.column]).toEqual(['INVALID_VALUE', 'url'])
  })
})
