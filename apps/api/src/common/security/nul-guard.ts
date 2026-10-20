import { type CanActivate, type ExecutionContext, Injectable } from '@nestjs/common'
import type { Request } from 'express'

import { ApiError } from '../errors/api-error'

/** Field message used by the per-module NUL checks (BE-24); the contract has no copy of its own. */
export const NUL_MESSAGE = 'Medan ini tidak sah.'
const MAX_DEPTH = 32
const MAX_NODES = 200_000

/**
 * Returns the dotted path of the first string (or object key) holding U+0000, or `undefined`. Depth and node count
 * are bounded, so a hostile shape costs a bounded amount of work; past a bound the value is not inspected further
 * (the JSON body limit already caps the size).
 */
export function findNul(value: unknown, path = '', budget = { nodes: 0 }, depth = 0): string | undefined {
  if (++budget.nodes > MAX_NODES || depth > MAX_DEPTH) return undefined
  if (typeof value === 'string') return value.includes('\u0000') ? path || '_' : undefined
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      const hit = findNul(value[i], path ? `${path}.${i}` : String(i), budget, depth + 1)
      if (hit !== undefined) return hit
    }
    return undefined
  }
  if (value !== null && typeof value === 'object') {
    for (const [k, v] of Object.entries(value)) {
      if (k.includes('\u0000')) return path || '_'
      const hit = findNul(v, path ? `${path}.${k}` : k, budget, depth + 1)
      if (hit !== undefined) return hit
    }
  }
  return undefined
}

/**
 * Global guard: a U+0000 in a query value, a path parameter or a parsed JSON body string is 422 VALIDATION_ERROR before
 * any pipe or Prisma call (Postgres raises on NUL in text, which would be a 500). Multipart bodies are binary by design
 * and are not inspected (multer parses them after the guards, so `req.body` is empty here anyway).
 */
@Injectable()
export class NulGuard implements CanActivate {
  canActivate(ctx: ExecutionContext): boolean {
    const req = ctx.switchToHttp().getRequest<Request>()
    const multipart = String(req.headers['content-type'] ?? '').toLowerCase().startsWith('multipart/')
    const parts: unknown[] = [req.query, req.params, multipart ? undefined : req.body]
    for (const part of parts) {
      const hit = findNul(part)
      if (hit !== undefined) throw ApiError.of('VALIDATION_ERROR', { fields: { [hit]: NUL_MESSAGE } })
    }
    return true
  }
}
