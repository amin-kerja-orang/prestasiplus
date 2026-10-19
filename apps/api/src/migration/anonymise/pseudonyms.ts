/**
 * Deterministic pseudonyms (BE-35). Every fake value is derived from `HMAC-SHA-256(key, kind || value)`:
 *
 *   - the same input and key always give the same fake, in every table, so relations, duplicates and
 *     uniqueness survive (a duplicate e-mail stays a duplicate, two distinct ones stay distinct);
 *   - without the key the fake cannot be linked back to the input, and a different key gives different
 *     fakes (nothing is derived from the value by an unkeyed hash, so no dictionary attack works);
 *   - the fakes are obviously fictitious and can never be a real contact detail:
 *       e-mail    anon-<token>@example.test                 (reserved domain, RFC 2606)
 *       phone     00 + 13 digits                             (a domestic Malaysian number never starts 00)
 *       IC        YY00DD-00-NNNN                             (month 00 and place code 00 do not exist;
 *                                                             the NRIC has no check digit, so the shape
 *                                                             itself is made invalid)
 *       name      Nama Anon <TOKEN>, organisation: Organisasi Anon <TOKEN>
 *       username  anon_<token>
 *       code      8 upper-case letters and digits
 *       opaque    20 lower-case letters and digits (google_id, visitor ids, battle tokens)
 *       ip        a documentation address (RFC 5737 / RFC 3849)
 *       path      files/<20 letters and digits>.<extension of the original> (uploads)
 *
 * Collisions: the phone has about 43 bits and the IC only about 26.6 free bits (8 digits), so with tens of
 * thousands of values a collision is likely for the IC. A different input that lands on a used fake is
 * therefore RE-HASHED with a counter suffix (HMAC of the same value + attempt number) until the fake is free.
 * The choice is remembered per input, so the same input always gets the same fake within a run, and a run
 * over the same source in the same order gives the same dump. The run aborts only if 50 attempts in a row
 * collide, which a working HMAC cannot produce (counts only in the message, never a value).
 */
import { createHmac } from 'node:crypto'

import { AnonymiseError } from './errors'

export const PSEUDONYM_KINDS = ['name', 'org', 'email', 'phone', 'ic', 'username', 'code', 'opaque', 'ip', 'path'] as const
export type PseudonymKind = (typeof PSEUDONYM_KINDS)[number]

export const EMAIL_DOMAIN = 'example.test'

const B32 = 'abcdefghijklmnopqrstuvwxyz234567'

function base32(bytes: Uint8Array, length: number): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const b of bytes) {
    value = (value << 8) | b
    bits += 8
    while (bits >= 5 && out.length < length) {
      out += B32[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
    if (out.length >= length) break
  }
  return out
}

/** `count` decimal digits from the digest (uses 16 bytes at `offset`). */
function digits(digest: Uint8Array, offset: number, count: number): string {
  let n = 0n
  for (let i = 0; i < 12; i++) n = (n << 8n) | BigInt(digest[(offset + i) % digest.length] as number)
  return n.toString().padStart(30, '0').slice(-count)
}

const collapse = (s: string): string => s.normalize('NFKC').trim().replace(/\s+/g, ' ').toLowerCase()

/**
 * What counts as "the same person's value": case and spacing do not matter; phone and IC compare as digits,
 * and a phone written with the country code (+60 / 60) equals the same number written with a leading 0.
 */
export function normaliseForKind(kind: PseudonymKind, value: string): string {
  if (kind === 'phone') {
    const d = value.replace(/\D/g, '')
    return d.startsWith('60') && d.length >= 10 ? `0${d.slice(2)}` : d
  }
  if (kind === 'ic') return value.replace(/\D/g, '')
  return collapse(value)
}

const MAX_ATTEMPTS = 50

export class Pseudonymiser {
  /** fake id -> tag of the input that owns it */
  private readonly seen = new Map<string, string>()
  /** input (kind, format, tag) -> its fake, so the re-hash choice is stable */
  private readonly byInput = new Map<string, string>()
  /** Distinct inputs mapped, per kind (counts only, for the log). */
  readonly counts: Record<PseudonymKind, number> = { name: 0, org: 0, email: 0, phone: 0, ic: 0, username: 0, code: 0, opaque: 0, ip: 0, path: 0 }
  /** How many inputs needed a re-hash because their first fake was taken (counts only). */
  rehashed = 0

  constructor(private readonly key: Uint8Array) {
    if (key.length < 16) throw new RangeError('The pseudonymisation key is too short.')
  }

  private digest(kind: PseudonymKind, normalised: string, attempt = 0): Buffer {
    const h = createHmac('sha256', this.key).update('pp-anon/1\0').update(kind).update('\0').update(normalised)
    if (attempt > 0) h.update(`\0#${attempt}`)
    return h.digest()
  }

  /** The fake for `value`, or `value` itself when it is null/undefined/empty (null ratios stay as they are). */
  apply(kind: PseudonymKind, value: unknown): unknown {
    if (value === null || value === undefined) return value ?? null
    const text = typeof value === 'string' ? value : String(value)
    if (text.trim() === '') return text
    const normalised = normaliseForKind(kind, text) || collapse(text)
    const first = this.digest(kind, normalised)
    const tag = first.subarray(0, 12).toString('hex')
    // The IC keeps the dash style of the source; a path keeps its extension.
    const style = kind === 'ic' ? (text.includes('-') ? 'd' : 'p') : kind === 'path' ? extensionOf(text) : kind === 'ip' ? (text.includes(':') ? '6' : '4') : ''
    const cacheKey = `${kind}|${style}|${tag}`
    const cached = this.byInput.get(cacheKey)
    if (cached !== undefined) return cached
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const d = attempt === 0 ? first : this.digest(kind, normalised, attempt)
      const out = this.fake(kind, d, text)
      if (kind === 'ip') {
        this.byInput.set(cacheKey, out)
        return out
      }
      const id = `${kind}:${kind === 'ic' ? out.replace(/\D/g, '') : out}`
      const owner = this.seen.get(id)
      if (owner === undefined || owner === tag) {
        if (owner === undefined) {
          this.seen.set(id, tag)
          this.counts[kind]++
        }
        if (attempt > 0) this.rehashed++
        this.byInput.set(cacheKey, out)
        return out
      }
    }
    throw new AnonymiseError(`Pseudonym collision for kind "${kind}": ${MAX_ATTEMPTS} re-hash attempts in a row were taken. Nothing usable was written.`)
  }

  private fake(kind: PseudonymKind, d: Buffer, original: string): string {
    switch (kind) {
      case 'name':
        return `Nama Anon ${base32(d, 10).toUpperCase()}`
      case 'org':
        return `Organisasi Anon ${base32(d, 10).toUpperCase()}`
      case 'email':
        return `anon-${base32(d, 12)}@${EMAIL_DOMAIN}`
      case 'username':
        return `anon_${base32(d, 10)}`
      case 'phone':
        return `00${digits(d, 0, 13)}`
      case 'ic': {
        const n = digits(d, 0, 8)
        const [yy, dd, nnnn] = [n.slice(0, 2), n.slice(2, 4), n.slice(4)]
        return original.includes('-') ? `${yy}00${dd}-00-${nnnn}` : `${yy}00${dd}00${nnnn}`
      }
      case 'code':
        return base32(d, 8).toUpperCase()
      case 'opaque':
        return base32(d, 20)
      case 'path':
        return `files/${base32(d, 20)}${extensionOf(original)}`
      case 'ip': {
        const b = [...d.subarray(0, 3)]
        return original.includes(':')
          ? `2001:db8::${(((b[0] as number) << 8) | (b[1] as number)).toString(16)}`
          : [`192.0.2.${((b[1] as number) % 254) + 1}`, `198.51.100.${((b[1] as number) % 254) + 1}`, `203.0.113.${((b[1] as number) % 254) + 1}`][(b[0] as number) % 3]!
      }
    }
  }
}

/** `.pdf` for `a/b/Name.PDF?x=1`, or `` when there is no short alphanumeric extension. */
function extensionOf(path: string): string {
  const m = /\.([A-Za-z0-9]{1,5})(?:[?#].*)?$/.exec(path.trim())
  return m ? `.${(m[1] as string).toLowerCase()}` : ''
}
