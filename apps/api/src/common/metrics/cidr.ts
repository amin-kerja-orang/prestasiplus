import { BlockList, isIPv4, isIPv6 } from 'node:net'

/** Strips the IPv4-mapped IPv6 prefix so `::ffff:10.0.0.5` is matched as IPv4. */
export function unmapAddress(raw: string): string {
  return raw.toLowerCase().replace(/^::ffff:/, '')
}

/**
 * Parses a comma list of IPv4/IPv6 CIDRs (`10.0.0.0/8, fd00::/8`). Throws a plain Error naming the bad entry
 * on any invalid item. A bare address is not accepted (write /32 or /128 explicitly).
 */
export function parseCidrList(raw: string): BlockList {
  const list = new BlockList()
  const items = raw.split(',').map((s) => s.trim()).filter(Boolean)
  if (items.length === 0) throw new Error('at least one CIDR is required')
  for (const item of items) {
    const [addr, bits, ...rest] = item.split('/')
    const prefix = bits !== undefined && /^\d{1,3}$/.test(bits) ? Number(bits) : NaN
    if (rest.length > 0 || addr === undefined) throw new Error(`invalid CIDR "${item}"`)
    if (isIPv4(addr) && prefix >= 0 && prefix <= 32) list.addSubnet(addr, prefix, 'ipv4')
    else if (isIPv6(addr) && prefix >= 0 && prefix <= 128) list.addSubnet(addr, prefix, 'ipv6')
    else throw new Error(`invalid CIDR "${item}"`)
  }
  return list
}

export function addressInCidrs(list: BlockList, raw: string | undefined): boolean {
  if (!raw) return false
  const addr = unmapAddress(raw)
  if (isIPv4(addr)) return list.check(addr, 'ipv4')
  if (isIPv6(addr)) return list.check(addr, 'ipv6')
  return false
}
