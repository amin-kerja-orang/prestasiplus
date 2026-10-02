/**
 * Path patterns used by the test controls (`setLatency`, `failNext`, `lastRequest`; overview §6.13).
 *
 * A pattern is a `RegExp` (tested against the path) or a string:
 * - an optional method prefix: `'POST /api/auth/login'`;
 * - `:name` matches one path segment: `'/api/topics/:id'`;
 * - `*` matches any run of characters, slashes included: `'/api/admin/*'`;
 * - everything else is literal; the whole path must match; a trailing slash is ignored.
 */

import type { HttpMethod } from '@/api/transport'

import { HTTP_METHODS, normalizePath } from './router'

export type PathPattern = string | RegExp

export interface PathMatcher {
  readonly source: string
  test(method: HttpMethod, path: string): boolean
}

function escapeRegExp(text: string): string {
  return text.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
}

export function compilePathPattern(pattern: PathPattern): PathMatcher {
  if (pattern instanceof RegExp) {
    const re = new RegExp(pattern.source, pattern.flags.replace(/[gy]/g, ''))
    return { source: String(pattern), test: (_method, path) => re.test(path) }
  }

  let text = pattern.trim()
  let method: HttpMethod | null = null
  const space = text.indexOf(' ')
  if (space > 0) {
    const head = text.slice(0, space).toUpperCase() as HttpMethod
    if (!HTTP_METHODS.includes(head))
      throw new Error(`path pattern: unknown method in '${pattern}'`)
    method = head
    text = text.slice(space + 1).trim()
  }
  if (text === '') throw new Error('path pattern: empty pattern')

  const body = normalizePath(text)
    .split(/(\*|:[A-Za-z_][A-Za-z0-9_]*)/)
    .map((part) => {
      if (part === '*') return '.*'
      if (part.startsWith(':')) return '[^/]+'
      return escapeRegExp(part)
    })
    .join('')
  const re = new RegExp(`^${body}$`)

  return {
    source: pattern,
    test: (m, path) => (method === null || method === m) && re.test(normalizePath(path)),
  }
}
