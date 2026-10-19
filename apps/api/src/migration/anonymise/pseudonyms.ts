/**
 * Deterministic pseudonyms (BE-35). Every fake value is derived from `HMAC-SHA-256(key, kind || value)`:
 *
 *   - the same input and key always give the same fake, in every table, so relations, duplicates and
 *     uniqueness survive (a duplicate e-mail stays a duplicate, two distinct ones stay distinct);
 *   - without the key the fake cannot be linked back to the input, and a different key gives different
 *     fakes (nothing is derived from the value by an unkeyed hash, so no dictionary attack works);
 *   - the fakes are obviously fictitious and can never be a real contact detail:
 *       e-mail    anon-<token>@example.test                 (reserved domain, RFC 2606)
 *       phone     00 + 9 digits                              (a domestic Malaysian number never starts 00)
 *       IC        YY00DD-00-NNNN                             (month 00 and place code 00 do not exist;
 *                                                             the NRIC has no check digit, so the shape
 *                                                             itself is made invalid)
 *       name      Nama Anon <TOKEN>, organisation: Organisasi Anon <TOKEN>
 *       username  anon_<token>
 *       code      8 upper-case letters and digits
 *       opaque    20 lower-case letters and digits (google_id, visitor ids, battle tokens)
 *       ip        a documentation address (RFC 5737 / RFC 3849)
 *
 * Collisions are detected (a different input that maps to an already used fake aborts the run, counts only).
 */
import { createHmac } from 'node:crypto'

import { AnonymiseError } from './errors'

export const PSEUDONYM_KINDS = ['name', 'org', 'email', 'phone', 'ic', 'username', 'code', 'opaque', 'ip'] as const
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

/** What counts as "the same person's value": case and spacing do not matter; phone and IC compare as digits. */
export function normaliseForKind(kind: PseudonymKind, value: string): string {
  if (kind === 'phone' || kind === 'ic') return value.replace(/\D/g, '')
  return collapse(value)
}

export class Pseudonymiser {
  private readonly seen = new Map<string, string>()
  /** Distinct inputs mapped, per kind (counts only, for the log). */
  readonly counts: Record<PseudonymKind, number> = { name: 0, org: 0, email: 0, phone: 0, ic: 0, username: 0, code: 0, opaque: 0, ip: 0 }

  constructor(private readonly key: Uint8Array) {
    if (key.length < 16) throw new RangeError('The pseudonymisation key is too short.')
  }

  private digest(kind: PseudonymKind, normalised: string): Buffer {
    return createHmac('sha256', this.key).update('pp-anon/1\0').update(kind).update('\0').update(normalised).digest()
  }

  /** The fake for `value`, or `value` itself when it is null/undefined/empty (null ratios stay as they are). */
  apply(kind: PseudonymKind, value: unknown): unknown {
    if (value === null || value === undefined) return value ?? null
    const text = typeof value === 'string' ? value : String(value)
    if (text.trim() === '') return text
    const normalised = normaliseForKind(kind, text) || collapse(text)
    return this.fake(kind, this.digest(kind, normalised), text)
  }

  private fake(kind: PseudonymKind, d: Buffer, original: string): string {
    let out: string
    switch (kind) {
      case 'name':
        out = `Nama Anon ${base32(d, 10).toUpperCase()}`
        break
      case 'org':
        out = `Organisasi Anon ${base32(d, 10).toUpperCase()}`
        break
      case 'email':
        out = `anon-${base32(d, 12)}@${EMAIL_DOMAIN}`
        break
      case 'username':
        out = `anon_${base32(d, 10)}`
        break
      case 'phone':
        out = `00${digits(d, 0, 9)}`
        break
      case 'ic': {
        const dashed = original.includes('-')
        const yy = digits(d, 0, 2)
        const dd = digits(d, 2, 2)
        const nnnn = digits(d, 4, 4)
        out = dashed ? `${yy}00${dd}-00-${nnnn}` : `${yy}00${dd}00${nnnn}`
        break
      }
      case 'code':
        out = base32(d, 8).toUpperCase()
        break
      case 'opaque':
        out = base32(d, 20)
        break
      case 'ip': {
        const b = [...d.subarray(0, 3)]
        out = original.includes(':')
          ? `2001:db8::${(((b[0] as number) << 8) | (b[1] as number)).toString(16)}`
          : [`192.0.2.${(b[1] as number) % 254 + 1}`, `198.51.100.${(b[1] as number) % 254 + 1}`, `203.0.113.${(b[1] as number) % 254 + 1}`][(b[0] as number) % 3]!
        break
      }
    }
    if (kind !== 'ip') this.remember(kind, out, d)
    return out
  }

  private remember(kind: PseudonymKind, out: string, d: Buffer): void {
    const id = `${kind}:${out}`
    const owner = this.seen.get(id)
    const tag = d.subarray(0, 12).toString('hex')
    if (owner === undefined) {
      this.seen.set(id, tag)
      this.counts[kind]++
    } else if (owner !== tag) {
      // Never name the values. 50+ bits of HMAC make this practically impossible; fail instead of merging two people.
      throw new AnonymiseError(`Pseudonym collision for kind "${kind}" (two different inputs map to the same fake). Nothing was written that can be used.`)
    }
  }
}
