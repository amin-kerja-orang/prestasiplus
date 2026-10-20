import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../errors/api-error'

/** Field message used by the per-module NUL checks (BE-24); the contract has no copy of its own. */
export const NUL_MESSAGE = 'Medan ini tidak sah.'
const MAX_DEPTH = 32
const MAX_NODES = 200_000

/**
 * Collects the dotted path of every string (or object key) holding U+0000. Depth and node count are bounded, so a
 * hostile shape costs a bounded amount of work; past a bound the value is not inspected further (the JSON body limit
 * already caps the size).
 */
export function findAllNul(value: unknown, path = '', out: string[] = [], budget = { nodes: 0 }, depth = 0): string[] {
  if (++budget.nodes > MAX_NODES || depth > MAX_DEPTH) return out
  if (typeof value === 'string') {
    if (value.includes('\u0000')) out.push(path || '_')
  } else if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) findAllNul(value[i], path ? `${path}.${i}` : String(i), out, budget, depth + 1)
  } else if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k.includes('\u0000')) out.push(path || '_')
      else findAllNul(v, path ? `${path}.${k}` : k, out, budget, depth + 1)
    }
  }
  return out
}

/** Copy of a parsed query with U+0000 removed from every key and string value (depth bounded like `findAllNul`). */
export function stripNul(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return value
  if (typeof value === 'string') return value.replaceAll('\u0000', '')
  if (Array.isArray(value)) return value.map((v) => stripNul(v, depth + 1))
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k.replaceAll('\u0000', ''), stripNul(v, depth + 1)]))
  }
  return value
}

/**
 * Global guard. A U+0000 in a path parameter or a parsed JSON body string is 422 VALIDATION_ERROR before any pipe or
 * Prisma call (Postgres raises on NUL in text, which would be a 500); every offending field is reported, in the same
 * field-error shape and message as the per-module checks. A NUL in a query value is not refused (modules treat query
 * text such as search and filters as ignorable): the guard itself strips it from `req.query`, so no module has to and
 * NUL never reaches Postgres (still never a 500).
 * Multipart bodies are binary by design and are not inspected here (their text fields are checked by the owning module).
 */
@Injectable()
export class NulGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>()
    const multipart = String(req.headers['content-type'] ?? '').toLowerCase().startsWith('multipart/')
    const budget = { nodes: 0 }
    const hits = [...findAllNul(req.params, '', [], budget), ...(multipart ? [] : findAllNul(req.body, '', [], budget))]
    if (hits.length > 0) {
      throw ApiError.of('VALIDATION_ERROR', { fields: Object.fromEntries(hits.map((h) => [h, NUL_MESSAGE])) })
    }
    if (findAllNul(req.query).length > 0) {
      // Express 5 re-parses `req.query` on every read, so the cleaned copy is pinned on the request itself.
      Object.defineProperty(req, 'query', { value: stripNul(req.query), configurable: true, enumerable: true, writable: true })
    }
    return true
  }
}
