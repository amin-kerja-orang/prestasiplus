import { isIPv4, isIPv6 } from 'node:net'

import type { Request } from 'express'

import { addressInCidrs } from './cidr'
import type { BlockList } from 'node:net'

/** Headers a reverse proxy / CDN adds; their presence means the request did not come straight from the internal network. */
export function hasForwardingHeaders(headers: Request['headers']): boolean {
  return Object.keys(headers).some((h) => h === 'x-real-ip' || h === 'forwarded' || h.startsWith('x-forwarded-'))
}

/** Loopback or private (RFC 1918, ULA fc00::/7, link-local) address. IPv4-mapped IPv6 is unwrapped first. */
export function isPrivateAddress(raw: string | undefined): boolean {
  if (!raw) return false
  const addr = raw.toLowerCase().replace(/^::ffff:/, '')
  if (isIPv4(addr)) {
    const [a, b] = addr.split('.').map(Number) as [number, number]
    return a === 127 || a === 10 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
  }
  if (isIPv6(addr)) {
    if (addr === '::1') return true
    const first = Number.parseInt(addr.split(':')[0] || '0', 16)
    return (first & 0xfe00) === 0xfc00 || (first & 0xffc0) === 0xfe80
  }
  return false
}

/** Who counts as the internal network: `private` (loopback/RFC1918/ULA), an explicit CIDR list, or `off` (admin session only). */
export type InternalPolicy = 'private' | 'off' | { cidrs: BlockList }

/** True only for a DIRECT internal peer: the socket address (never `req.ip` / X-Forwarded-For) matches the policy and no proxy header is present. */
export function isInternalRequest(req: Pick<Request, 'socket' | 'headers'>, policy: InternalPolicy = 'private'): boolean {
  if (policy === 'off' || hasForwardingHeaders(req.headers)) return false
  const peer = req.socket.remoteAddress
  return policy === 'private' ? isPrivateAddress(peer) : addressInCidrs(policy.cidrs, peer)
}
