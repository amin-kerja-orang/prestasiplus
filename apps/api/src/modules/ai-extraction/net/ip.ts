import { isIP } from 'node:net'

/** Parses a dotted IPv4 string into 4 octets; null when it is not exactly that form. */
function v4Octets(ip: string): [number, number, number, number] | null {
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip)
  if (!m) return null
  const o = [Number(m[1]), Number(m[2]), Number(m[3]), Number(m[4])] as [number, number, number, number]
  return o.every((n) => n <= 255) ? o : null
}

function isPrivateV4(o: readonly [number, number, number, number]): boolean {
  const [a, b, c] = o
  if (a === 0) return true // "this" network, 0.0.0.0
  if (a === 10) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT, includes 100.100.100.200 (a cloud metadata address)
  if (a === 127) return true // loopback
  if (a === 169 && b === 254) return true // link-local, includes 169.254.169.254 (cloud metadata)
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 0 && (c === 0 || c === 2)) return true // IETF protocol assignments, TEST-NET-1
  if (a === 192 && b === 168) return true
  if (a === 198 && (b === 18 || b === 19)) return true // benchmarking
  if (a === 198 && b === 51 && c === 100) return true // TEST-NET-2
  if (a === 203 && b === 0 && c === 113) return true // TEST-NET-3
  if (a >= 224) return true // multicast, reserved, broadcast
  return false
}

/** Expands an IPv6 address to 8 hextets (numbers); null when it is not valid. Handles `::` and an embedded IPv4 tail. */
function v6Hextets(ip: string): number[] | null {
  let s = ip.toLowerCase()
  const zone = s.indexOf('%')
  if (zone !== -1) s = s.slice(0, zone)
  const tail = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(s)
  if (tail) {
    const o = v4Octets(tail[1] as string)
    if (!o) return null
    s = `${s.slice(0, s.length - (tail[1] as string).length)}${((o[0] << 8) | o[1]).toString(16)}:${((o[2] << 8) | o[3]).toString(16)}`
  }
  const halves = s.split('::')
  if (halves.length > 2) return null
  const parse = (part: string): number[] | null => {
    if (part === '') return []
    const out: number[] = []
    for (const h of part.split(':')) {
      if (!/^[0-9a-f]{1,4}$/.test(h)) return null
      out.push(parseInt(h, 16))
    }
    return out
  }
  const head = parse(halves[0] as string)
  if (!head) return null
  if (halves.length === 1) return head.length === 8 ? head : null
  const rest = parse(halves[1] as string)
  if (!rest) return null
  const fill = 8 - head.length - rest.length
  if (fill < 1) return null
  return [...head, ...Array<number>(fill).fill(0), ...rest]
}

function isPrivateV6(h: readonly number[]): boolean {
  const [h0, h1, h2, h3, h4, h5, h6, h7] = h as [number, number, number, number, number, number, number, number]
  if (h.every((x) => x === 0)) return true // ::
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0 && h6 === 0 && h7 === 1) return true // ::1
  if ((h0 & 0xffc0) === 0xfe80) return true // fe80::/10 link-local
  if ((h0 & 0xfe00) === 0xfc00) return true // fc00::/7 unique local (includes the fd00:ec2:: metadata address)
  if ((h0 & 0xff00) === 0xff00) return true // multicast
  if (h0 === 0x2001 && h1 === 0x0db8) return true // documentation
  if (h0 === 0x2001 && h1 === 0x0000) return true // Teredo
  if (h0 === 0x2002) return true // 6to4 (embeds an IPv4 address that may be private)
  if (h0 === 0x0100 && h1 === 0 && h2 === 0 && h3 === 0) return true // discard prefix
  // IPv4-mapped (::ffff:a.b.c.d), IPv4-compatible (::a.b.c.d) and NAT64 (64:ff9b::/96): judge the embedded IPv4 address.
  const embedded = (): [number, number, number, number] => [h6 >> 8, h6 & 255, h7 >> 8, h7 & 255]
  if (h0 === 0 && h1 === 0 && h2 === 0 && h3 === 0 && h4 === 0 && (h5 === 0xffff || h5 === 0)) return isPrivateV4(embedded())
  if (h0 === 0x0064 && h1 === 0xff9b && h2 === 0 && h3 === 0 && h4 === 0 && h5 === 0) return isPrivateV4(embedded())
  return false
}

/**
 * True when `ip` is a loopback, private, link-local, unique-local, CGNAT, multicast, reserved or cloud-metadata address,
 * or is not a valid IP literal at all (unparseable means untrusted). `ip` is a bare address, no brackets or port.
 */
export function isPrivateAddress(ip: string): boolean {
  const family = isIP(ip)
  if (family === 4) {
    const o = v4Octets(ip)
    return o === null ? true : isPrivateV4(o)
  }
  if (family === 6) {
    const h = v6Hextets(ip)
    return h === null ? true : isPrivateV6(h)
  }
  return true
}

/** Strips the brackets of an IPv6 URL host (`[::1]`). */
export const bareHost = (hostname: string): string => (hostname.startsWith('[') && hostname.endsWith(']') ? hostname.slice(1, -1) : hostname)
