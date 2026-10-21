import { isIP } from 'node:net'

import type { AiResolver } from '../ai.types'
import { bareHost, isPrivateAddress } from './ip'

/** Why a provider URL was refused. A code and a fixed message only: the URL itself is configuration but is never echoed. */
export class UnsafeUrlError extends Error {
  constructor(readonly reason: 'scheme' | 'credentials' | 'host_not_allowed' | 'port' | 'private_address' | 'unresolvable' | 'invalid') {
    super(`Provider URL refused (${reason}).`)
    this.name = 'UnsafeUrlError'
  }
}

export interface SafeUrlPolicy {
  /** Lower-case host names or `*.suffix` patterns. Required: an empty list refuses every host. */
  allowlist: readonly string[]
  resolver: AiResolver
}

export interface CheckedUrl {
  url: URL
  /** Every address the host resolved to; all passed the private-range check. */
  addresses: string[]
}

const NAMED_INTERNAL = /(^|\.)(localhost|local|localdomain|internal|intranet|lan|home|corp|private)$/i

function hostAllowed(host: string, allowlist: readonly string[]): boolean {
  return allowlist.some((entry) => (entry.startsWith('*.') ? host.endsWith(entry.slice(1)) && host.length > entry.length - 1 : host === entry))
}

/** Static checks that need no network: https, no credentials, port 443, allow-listed host, not a private IP literal. */
export function checkUrlShape(raw: string, allowlist: readonly string[]): URL {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new UnsafeUrlError('invalid')
  }
  if (url.protocol !== 'https:') throw new UnsafeUrlError('scheme')
  if (url.username !== '' || url.password !== '') throw new UnsafeUrlError('credentials')
  if (url.port !== '' && url.port !== '443') throw new UnsafeUrlError('port')
  const host = bareHost(url.hostname).toLowerCase().replace(/\.$/, '')
  if (!hostAllowed(host, allowlist)) throw new UnsafeUrlError('host_not_allowed')
  if (isIP(host) !== 0) {
    if (isPrivateAddress(host)) throw new UnsafeUrlError('private_address')
  } else if (NAMED_INTERNAL.test(host)) {
    throw new UnsafeUrlError('private_address')
  }
  return url
}

/**
 * Full SSRF check of a provider URL (AC8): the shape checks, then DNS resolution of the host. EVERY resolved address
 * (A and AAAA) must be public; one private answer refuses the host (DNS rebinding to 127.0.0.1 or 169.254.169.254).
 * The returned addresses are what the transport connects to, so the check and the connection cannot disagree.
 */
export async function checkProviderUrl(raw: string, policy: SafeUrlPolicy): Promise<CheckedUrl> {
  const url = checkUrlShape(raw, policy.allowlist)
  const host = bareHost(url.hostname).toLowerCase().replace(/\.$/, '')
  if (isIP(host) !== 0) return { url, addresses: [host] }
  let addresses: string[]
  try {
    addresses = await policy.resolver(host)
  } catch {
    throw new UnsafeUrlError('unresolvable')
  }
  if (addresses.length === 0) throw new UnsafeUrlError('unresolvable')
  if (addresses.some((a) => isPrivateAddress(a))) throw new UnsafeUrlError('private_address')
  return { url, addresses }
}
