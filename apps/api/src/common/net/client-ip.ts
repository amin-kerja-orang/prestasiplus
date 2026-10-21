import { timingSafeEqual } from 'node:crypto'
import { isIP } from 'node:net'

import { Logger } from '@nestjs/common'
import type { NextFunction, Request, Response } from 'express'

/**
 * The ONE place the client address (used by every throttle, the audit log and the request log) is derived.
 *
 * Without `CLIENT_IP_HEADER` nothing is touched: the address is Express's `req.ip`, which follows
 * `TRUST_PROXY_HOPS` (X-Forwarded-For hops; the socket address when 0).
 *
 * With `CLIENT_IP_HEADER` set (edge worker in front, e.g. Cloudflare Pages), the address is read from that header, but only
 * when the same request proves it came through the edge: `X-PP-Edge-Secret` must equal `EDGE_PROXY_SECRET`. A request with a
 * missing or wrong secret, or a malformed header value, FAILS SAFE to the socket peer (`req.socket.remoteAddress`) and NOT to
 * `req.ip`: with TRUST_PROXY_HOPS > 0 `req.ip` may come from a client-supplied X-Forwarded-For, so a caller that bypasses the
 * edge and hits the origin directly could pick its own throttle bucket.
 *
 * Every existing call site reads `req.ip`, so the result is published as an own property on the request (shadowing Express's
 * prototype getter). That keeps the ~30 call sites, the login throttle and the global limiter unchanged.
 */
export const CLIENT_IP_HEADERS = ['x-pp-client-ip', 'cf-connecting-ip', 'x-real-ip', 'true-client-ip'] as const
export type ClientIpHeader = (typeof CLIENT_IP_HEADERS)[number]
export const EDGE_SECRET_HEADER = 'x-pp-edge-secret'
export const MIN_EDGE_SECRET_LENGTH = 32
const MAX_IP_LENGTH = 45

/** Constant-time string compare; different lengths are a mismatch (timingSafeEqual needs equal lengths). */
let warnedSecretMismatch = false
/** Test hook: allow the one-time warning to fire again. */
export function resetEdgeSecretWarning(): void {
  warnedSecretMismatch = false
}

function secretMatches(given: unknown, expected: string): boolean {
  if (typeof given !== 'string') return false
  const a = Buffer.from(given)
  const b = Buffer.from(expected)
  return a.length === b.length && timingSafeEqual(a, b)
}

/** A single valid IP address, or undefined. Rejects arrays, comma lists, empty and over-long values; unwraps `::ffff:` IPv4-mapped. */
export function parseSingleIp(raw: unknown): string | undefined {
  if (typeof raw !== 'string') return undefined
  const v = raw.trim()
  // `%` would be an IPv6 zone id (fe80::1%eth0): the same host could take many buckets.
  if (v === '' || v.length > MAX_IP_LENGTH || v.includes(',') || v.includes('%')) return undefined
  if (isIP(v) === 0) return undefined
  // IPv6 is case-insensitive: lowercase so one host cannot occupy several buckets via case variants.
  const lower = v.toLowerCase()
  const mapped = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(lower)
  return mapped?.[1] && isIP(mapped[1]) === 4 ? mapped[1] : lower
}

export interface ClientIpConfig {
  header?: string | undefined
  secret?: string | undefined
}

/** Derives the client address for a request in the "header configured" mode (pure; does not touch the request). */
export function deriveClientIp(req: Pick<Request, 'headers' | 'socket'>, config: { header: string; secret: string }): string {
  const peer = req.socket.remoteAddress ?? 'unknown'
  if (!secretMatches(req.headers[EDGE_SECRET_HEADER], config.secret)) return peer
  return parseSingleIp(req.headers[config.header.toLowerCase()]) ?? peer
}

/** Express middleware; a no-op (the request is not touched) when `header` or `secret` is unset. */
export function clientIpMiddleware(config: ClientIpConfig): (req: Request, res: Response, next: NextFunction) => void {
  const { header, secret } = config
  if (!header || !secret) return (_req, _res, next) => next()
  return (req, _res, next) => {
    if (!warnedSecretMismatch && req.headers[header.toLowerCase()] !== undefined && !secretMatches(req.headers[EDGE_SECRET_HEADER], secret)) {
      warnedSecretMismatch = true // once per process; never log header values or the secret
      new Logger('ClientIp').warn(
        'A request carried the client-ip header but the edge secret is missing or does not match, so every such request falls back to the socket peer address (one shared throttle bucket). Check EDGE_PROXY_SECRET on both the edge worker and the API.',
      )
    }
    const value = deriveClientIp(req, { header, secret })
    // Never log or forward the shared secret.
    delete req.headers[EDGE_SECRET_HEADER]
    Object.defineProperty(req, 'ip', { value, configurable: true, enumerable: true, writable: false })
    next()
  }
}
