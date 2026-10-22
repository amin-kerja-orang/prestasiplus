import https from 'node:https'
import { isIP } from 'node:net'

import type { AiFetch } from '../ai.types'
import { bareHost, isPrivateAddress } from './ip'

/** A provider answer larger than this is cut off (an extraction reply is a few hundred KB at most). */
export const MAX_RESPONSE_BYTES = 8 * 1024 * 1024

type LookupCallback = (err: NodeJS.ErrnoException | null, address: string | { address: string; family: number }[], family?: number) => void

/**
 * Default transport. A fetch-shaped function over `node:https` that connects ONLY to the addresses the SSRF check
 * validated (`pinnedAddresses`), while keeping the original host name for TLS (SNI and certificate check) and the Host
 * header. Resolving once and connecting to that answer closes the gap between "check" and "use" that DNS rebinding
 * exploits. It never follows a redirect: a 3xx answer is returned as is, and the caller treats it as an error.
 */
export function createPinnedFetch(): AiFetch {
  return (rawUrl, init) =>
    new Promise<Response>((resolve, reject) => {
      const url = new URL(rawUrl)
      const addresses = [...(init.pinnedAddresses ?? [])]
      // A transport without validated addresses must refuse, not resolve by itself.
      if (url.protocol !== 'https:' || addresses.length === 0 || addresses.some((a) => isPrivateAddress(a))) {
        reject(new Error('The transport refused an unvalidated address.'))
        return
      }
      const host = bareHost(url.hostname)
      const lookup = (_hostname: string, options: { all?: boolean }, cb: LookupCallback): void => {
        const list = addresses.map((address) => ({ address, family: isIP(address) }))
        if (options.all) cb(null, list)
        else cb(null, list[0]?.address ?? '', list[0]?.family ?? 4)
      }
      const req = https.request(
        {
          host,
          port: 443,
          method: init.method,
          path: `${url.pathname}${url.search}`,
          headers: { ...init.headers, 'content-length': String(Buffer.byteLength(init.body)) },
          servername: isIP(host) === 0 ? host : undefined,
          lookup: lookup as never,
          signal: init.signal,
          agent: false,
        },
        (res) => {
          const chunks: Buffer[] = []
          let size = 0
          res.on('data', (c: Buffer) => {
            size += c.length
            if (size > MAX_RESPONSE_BYTES) {
              res.destroy(new Error('The provider answer is too large.'))
              return
            }
            chunks.push(c)
          })
          res.on('error', reject)
          res.on('end', () => {
            const headers = new Headers()
            for (const [k, v] of Object.entries(res.headers)) if (typeof v === 'string') headers.set(k, v)
            const status = res.statusCode ?? 502
            const body = status === 204 || status === 205 || status === 304 ? null : Buffer.concat(chunks)
            resolve(new Response(body, { status, headers }))
          })
        },
      )
      req.on('error', reject)
      req.end(init.body)
    })
}
