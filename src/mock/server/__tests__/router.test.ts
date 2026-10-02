import { describe, expect, it } from 'vitest'

import { compilePathPattern } from '../path-pattern'
import { ok } from '../respond'
import { createRouter, int, normalizePath, route, str } from '../router'

const h = () => ok(null)

describe('route()', () => {
  it('accepts both forms and freezes the definition', () => {
    const guard = () => undefined
    const a = route('GET', '/api/a', h)
    const b = route('POST', '/api/b/', [guard], h, {})
    expect(a.middleware).toEqual([])
    expect(b.middleware).toEqual([guard])
    expect(b.pattern).toBe('/api/b')
    expect(Object.isFrozen(a)).toBe(true)
  })

  it('rejects bad definitions', () => {
    expect(() => route('GET', '/users', h)).toThrow(/must start with \/api/)
    expect(() => route('GET', '/api/x/:id/:id', h)).toThrow(/duplicate param/)
    expect(() => route('GET', '/api/x/:id', h, { params: { nope: int() } })).toThrow(
      /unknown param/,
    )
    expect(() => route('TRACE' as 'GET', '/api/x', h)).toThrow(/unsupported method/)
  })
})

describe('createRouter().match', () => {
  it('matches method + path and parses params (int and string)', () => {
    const r1 = route('GET', '/api/topics/:id', h, { params: { id: int() } })
    const r2 = route('GET', '/api/users/:slug/posts/:postId', h, { params: { postId: int() } })
    const r3 = route('POST', '/api/topics/:id', h, { params: { id: int() } })
    const router = createRouter([r1, r2, r3])

    expect(router.match('GET', '/api/topics/12')).toEqual({ route: r1, params: { id: 12 } })
    expect(router.match('GET', '/api/topics/007')?.params).toEqual({ id: 7 })
    expect(router.match('POST', '/api/topics/5')?.route).toBe(r3)
    expect(router.match('GET', '/api/users/ali%20baba/posts/3')?.params).toEqual({
      slug: 'ali baba',
      postId: 3,
    })
  })

  it('int() rejects non-digits, so the route does not match (→ 404)', () => {
    const router = createRouter([route('GET', '/api/topics/:id', h, { params: { id: int() } })])
    for (const bad of ['abc', '-1', '1.5', '1e3', '99999999999999999999']) {
      expect(router.match('GET', `/api/topics/${bad}`)).toBeNull()
    }
  })

  it('ignores trailing slashes and needs the full path and the method', () => {
    const r = route('GET', '/api/me', h)
    const router = createRouter([r])
    expect(router.match('GET', '/api/me/')?.route).toBe(r)
    expect(router.match('GET', '/api/me/extra')).toBeNull()
    expect(router.match('GET', '/api')).toBeNull()
    expect(router.match('DELETE', '/api/me')).toBeNull()
  })

  it('static segments beat params regardless of registration order', () => {
    const param = route('GET', '/api/articles/:slug', h)
    const latest = route('GET', '/api/articles/latest', h)
    const router = createRouter([param, latest])
    expect(router.match('GET', '/api/articles/latest')?.route).toBe(latest)
    expect(router.match('GET', '/api/articles/hello')?.route).toBe(param)
  })

  it('falls through to the next candidate when a parser rejects', () => {
    const byId = route('GET', '/api/videos/:id', h, { params: { id: int() } })
    const bySlug = route('GET', '/api/videos/:slug', h, { params: { slug: str(/[a-z-]+/) } })
    const router = createRouter([byId, bySlug])
    expect(router.match('GET', '/api/videos/42')?.route).toBe(byId)
    expect(router.match('GET', '/api/videos/my-video')?.params).toEqual({ slug: 'my-video' })
    expect(router.match('GET', '/api/videos/Bad_1')).toBeNull()
  })

  it('rejects a duplicate method + pattern', () => {
    expect(() =>
      createRouter([route('GET', '/api/a/:x', h), route('GET', '/api/a/:y', h)]),
    ).toThrow(/duplicate route/)
    expect(() =>
      createRouter([route('GET', '/api/a', h), route('POST', '/api/a', h)]),
    ).not.toThrow()
  })

  it('does not match malformed percent-encoding', () => {
    const router = createRouter([route('GET', '/api/q/:term', h)])
    expect(router.match('GET', '/api/q/%E0%A4%A')).toBeNull()
  })
})

describe('normalizePath', () => {
  it('strips query, hash and trailing slashes', () => {
    expect(normalizePath('/api/x/?a=1')).toBe('/api/x')
    expect(normalizePath('api/x#h')).toBe('/api/x')
    expect(normalizePath('/')).toBe('/')
  })
})

describe('compilePathPattern', () => {
  it('supports literals, :params, * and a method prefix', () => {
    expect(compilePathPattern('/api/me').test('GET', '/api/me/')).toBe(true)
    expect(compilePathPattern('/api/me').test('GET', '/api/me/x')).toBe(false)
    expect(compilePathPattern('/api/topics/:id').test('GET', '/api/topics/3')).toBe(true)
    expect(compilePathPattern('/api/topics/:id').test('GET', '/api/topics/3/x')).toBe(false)
    expect(compilePathPattern('/api/admin/*').test('PUT', '/api/admin/users/1')).toBe(true)
    const post = compilePathPattern('post /api/auth/login')
    expect(post.test('POST', '/api/auth/login')).toBe(true)
    expect(post.test('GET', '/api/auth/login')).toBe(false)
    expect(compilePathPattern(/walkthrough/g).test('GET', '/api/spm/walkthrough/1')).toBe(true)
    expect(compilePathPattern('/api/a.b').test('GET', '/api/aXb')).toBe(false)
  })

  it('rejects unknown methods and empty patterns', () => {
    expect(() => compilePathPattern('FETCH /api/x')).toThrow(/unknown method/)
    expect(() => compilePathPattern('  ')).toThrow(/empty/)
  })
})
