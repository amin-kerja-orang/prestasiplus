/**
 * The mock router (overview §6.4): `METHOD /api/...` routes with `:param` segments.
 *
 * ```ts
 * route('GET', '/api/topics/:id', [requireAuth()], getTopic, { params: { id: int() } })
 * route('POST', '/api/auth/login', login)
 * ```
 *
 * - Params are strings unless a parser is given. `int()` accepts digits only (Laravel
 *   `whereNumber`) and yields a number; a value it rejects means **the route does not match**, so the
 *   request falls through to the next candidate or to `404 NOT_FOUND`.
 * - Precedence: at the first segment where two patterns differ, a static segment beats a param.
 *   Otherwise registration order wins. So `/api/articles/latest` wins over `/api/articles/:slug`
 *   whatever the order.
 * - Paths are compared without a trailing slash; params are URI-decoded.
 * - A method + pattern registered twice is a boot error.
 */

import type { HttpMethod } from '@/api/transport'

import type { Handler, Middleware, MockParams } from './types'

export const HTTP_METHODS: readonly HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

/** Parses one path segment; returns `undefined` when the segment does not fit (no match). */
export interface ParamParser<T extends string | number = string | number> {
  readonly kind: string
  parse(segment: string): T | undefined
}

/** Digits only (e.g. `12`, `007` → 7); a safe integer. */
export function int(): ParamParser<number> {
  return {
    kind: 'int',
    parse(segment) {
      if (!/^\d+$/.test(segment)) return undefined
      const n = Number(segment)
      return Number.isSafeInteger(n) ? n : undefined
    },
  }
}

/** Any non-empty segment, optionally restricted by `pattern` (tested against the whole segment). */
export function str(pattern?: RegExp): ParamParser<string> {
  const re = pattern ? new RegExp(`^(?:${pattern.source})$`, pattern.flags.replace('g', '')) : null
  return {
    kind: pattern ? `str(${pattern.source})` : 'str',
    parse: (segment) => (segment !== '' && (!re || re.test(segment)) ? segment : undefined),
  }
}

export interface RouteOptions {
  /** Parsers per param name; params without one are strings. */
  params?: Readonly<Record<string, ParamParser>>
}

type Segment =
  { kind: 'static'; value: string } | { kind: 'param'; name: string; parser: ParamParser }

export interface RouteDef<P extends MockParams = MockParams> {
  readonly method: HttpMethod
  readonly pattern: string
  readonly segments: readonly Segment[]
  readonly middleware: readonly Middleware[]
  readonly handler: Handler<P>
}

export function normalizePath(path: string): string {
  const clean = path.split(/[?#]/, 1)[0] ?? ''
  const withSlash = clean.startsWith('/') ? clean : `/${clean}`
  return withSlash.length > 1 ? withSlash.replace(/\/+$/, '') || '/' : withSlash
}

function splitSegments(path: string): string[] {
  return normalizePath(path).split('/').slice(1)
}

function compilePattern(pattern: string, options: RouteOptions): Segment[] {
  if (!pattern.startsWith('/api/') && pattern !== '/api') {
    throw new Error(`route: pattern must start with /api/, got '${pattern}'`)
  }
  const parsers = options.params ?? {}
  const seen = new Set<string>()
  const segments = splitSegments(pattern).map((part): Segment => {
    if (part.startsWith(':')) {
      const name = part.slice(1)
      if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(name)) {
        throw new Error(`route ${pattern}: invalid param name '${name}'`)
      }
      if (seen.has(name)) throw new Error(`route ${pattern}: duplicate param '${name}'`)
      seen.add(name)
      return { kind: 'param', name, parser: parsers[name] ?? str() }
    }
    if (part === '') throw new Error(`route ${pattern}: empty segment`)
    return { kind: 'static', value: part }
  })
  for (const name of Object.keys(parsers)) {
    if (!seen.has(name)) throw new Error(`route ${pattern}: parser for unknown param '${name}'`)
  }
  return segments
}

/**
 * Defines a route. Forms:
 * - `route(method, pattern, handler, options?)`
 * - `route(method, pattern, middleware[], handler, options?)`
 */
export function route<P extends MockParams = MockParams>(
  method: HttpMethod,
  pattern: string,
  handler: Handler<P>,
  options?: RouteOptions,
): RouteDef<P>
export function route<P extends MockParams = MockParams>(
  method: HttpMethod,
  pattern: string,
  middleware: readonly Middleware[],
  handler: Handler<P>,
  options?: RouteOptions,
): RouteDef<P>
export function route<P extends MockParams = MockParams>(
  method: HttpMethod,
  pattern: string,
  a: Handler<P> | readonly Middleware[],
  b?: Handler<P> | RouteOptions,
  c?: RouteOptions,
): RouteDef<P> {
  if (!HTTP_METHODS.includes(method)) throw new Error(`route: unsupported method '${method}'`)
  const middleware = Array.isArray(a) ? (a as readonly Middleware[]) : []
  const handler = (Array.isArray(a) ? b : a) as Handler<P> | undefined
  const options = ((Array.isArray(a) ? c : b) ?? {}) as RouteOptions
  if (typeof handler !== 'function') throw new Error(`route ${method} ${pattern}: missing handler`)
  for (const mw of middleware) {
    if (typeof mw !== 'function') throw new Error(`route ${method} ${pattern}: invalid middleware`)
  }
  const normalized = normalizePath(pattern)
  return Object.freeze({
    method,
    pattern: normalized,
    segments: compilePattern(normalized, options),
    middleware: [...middleware],
    handler,
  })
}

export interface RouteMatch {
  route: RouteDef
  params: Record<string, string | number>
}

export interface Router {
  readonly routes: readonly RouteDef[]
  /** The best route for `method` + `path`, or `null`. */
  match(method: HttpMethod, path: string): RouteMatch | null
}

/** Negative when `a` is more specific than `b` (static before param at the first difference). */
function compareSpecificity(a: RouteDef, b: RouteDef): number {
  const n = Math.min(a.segments.length, b.segments.length)
  for (let i = 0; i < n; i++) {
    const sa = a.segments[i] as Segment
    const sb = b.segments[i] as Segment
    if (sa.kind !== sb.kind) return sa.kind === 'static' ? -1 : 1
  }
  return 0
}

function decode(segment: string): string | undefined {
  try {
    return decodeURIComponent(segment)
  } catch {
    return undefined
  }
}

function matchRoute(route: RouteDef, parts: readonly string[]): RouteMatch | null {
  if (route.segments.length !== parts.length) return null
  const params: Record<string, string | number> = {}
  for (let i = 0; i < parts.length; i++) {
    const seg = route.segments[i] as Segment
    const raw = parts[i] as string
    if (seg.kind === 'static') {
      if (seg.value !== raw) return null
      continue
    }
    const decoded = decode(raw)
    if (decoded === undefined) return null
    const value = seg.parser.parse(decoded)
    if (value === undefined) return null
    params[seg.name] = value
  }
  return { route, params }
}

function signature(route: RouteDef): string {
  const shape = route.segments
    .map((s) => (s.kind === 'static' ? s.value : `:${s.parser.kind}`))
    .join('/')
  return `${route.method} /${shape}`
}

export function createRouter(routes: readonly RouteDef[]): Router {
  const seen = new Map<string, RouteDef>()
  for (const r of routes) {
    const key = signature(r)
    const prev = seen.get(key)
    if (prev) {
      throw new Error(
        `mock router: duplicate route ${r.method} ${r.pattern} (also ${prev.pattern})`,
      )
    }
    seen.set(key, r)
  }

  const byMethod = new Map<HttpMethod, RouteDef[]>()
  for (const method of HTTP_METHODS) {
    // Array.prototype.sort is stable: equal specificity keeps registration order.
    byMethod.set(method, routes.filter((r) => r.method === method).sort(compareSpecificity))
  }

  return {
    routes: [...routes],
    match(method, path) {
      const parts = splitSegments(path)
      for (const r of byMethod.get(method) ?? []) {
        const m = matchRoute(r, parts)
        if (m) return m
      }
      return null
    },
  }
}
