/**
 * Verify-only bcrypt for LEGACY password hashes (`$2y$`, `$2b$`, `$2a$`) migrated from .cloud
 * (Laravel). New hashes are always argon2id (`PasswordService`); a legacy hash is rehashed on the
 * first successful login, so this code path shrinks to nothing over time.
 *
 * Why in-house: the API workspace has no bcrypt dependency and a card may not add one. This is the
 * standard EksBlowfish algorithm (Provos and Mazieres). The Blowfish initial state is the
 * fractional part of pi in hexadecimal; it is computed once, lazily, with BigInt arithmetic
 * (Machin's formula) instead of pasting 4 KB of constants. The unit test checks the published
 * crypt_blowfish vectors and hashes produced by PHP `password_hash` (Laravel's hasher).
 * To swap in `bcryptjs` later, replace `verifyLegacyBcrypt` only.
 */
import { timingSafeEqual } from 'node:crypto'

const B64 = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
const MAGIC = 'OrpheanBeholderScryDoubt'
const HASH_RE = /^\$2([abxy])\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/

let initP: Uint32Array | undefined
let initS: Uint32Array | undefined

/** atan(1/x) * 2^bits as a BigInt (Taylor series, fixed point). */
function arctanInv(x: bigint, bits: bigint): bigint {
  const one = 1n << bits
  const x2 = x * x
  let term = one / x
  let sum = term
  let n = 1n
  let sign = -1n
  while (term > 0n) {
    term /= x2
    n += 2n
    sum += (sign * term) / n
    sign = -sign
  }
  return sum
}

/** The 18 P words followed by the 4 x 256 S-box words: 1042 words of pi's fractional hex digits. */
function blowfishInit(): { P: Uint32Array; S: Uint32Array } {
  if (initP && initS) return { P: initP, S: initS }
  const words = 18 + 4 * 256
  const bits = BigInt(words * 32 + 64) // guard bits
  const pi = 16n * arctanInv(5n, bits) - 4n * arctanInv(239n, bits)
  const frac = pi & ((1n << bits) - 1n)
  const top = frac >> 64n // drop the guard bits
  const all = new Uint32Array(words)
  for (let i = 0; i < words; i++) {
    all[i] = Number((top >> BigInt((words - 1 - i) * 32)) & 0xffffffffn)
  }
  initP = all.slice(0, 18)
  initS = all.slice(18)
  return { P: initP, S: initS }
}

class Blowfish {
  readonly P: Uint32Array
  readonly S: Uint32Array

  constructor() {
    const init = blowfishInit()
    this.P = init.P.slice()
    this.S = init.S.slice()
  }

  private f(x: number): number {
    const S = this.S
    const h = ((S[x >>> 24]! + S[256 + ((x >>> 16) & 0xff)]!) ^ S[512 + ((x >>> 8) & 0xff)]!) >>> 0
    return (h + S[768 + (x & 0xff)]!) >>> 0
  }

  /** Encrypts one 64-bit block (two words) and returns the result. */
  encrypt(l: number, r: number): [number, number] {
    const P = this.P
    let L = l >>> 0
    let R = r >>> 0
    for (let i = 0; i < 16; i += 2) {
      L = (L ^ P[i]!) >>> 0
      R = (R ^ this.f(L)) >>> 0
      R = (R ^ P[i + 1]!) >>> 0
      L = (L ^ this.f(R)) >>> 0
    }
    return [(R ^ P[17]!) >>> 0, (L ^ P[16]!) >>> 0]
  }

  /** `salt` has 4 words, or is undefined for the plain (unsalted) expansion. */
  expand(key: Uint8Array, salt?: Uint32Array): void {
    let pos = 0
    const nextWord = (): number => {
      let w = 0
      for (let i = 0; i < 4; i++) {
        w = ((w << 8) | key[pos]!) >>> 0
        pos = (pos + 1) % key.length
      }
      return w
    }
    for (let i = 0; i < 18; i++) this.P[i] = (this.P[i]! ^ nextWord()) >>> 0

    let l = 0
    let r = 0
    let j = 0
    const step = (target: Uint32Array, idx: number): void => {
      if (salt) {
        l = (l ^ salt[j]!) >>> 0
        r = (r ^ salt[j + 1]!) >>> 0
        j = (j + 2) % 4
      }
      ;[l, r] = this.encrypt(l, r)
      target[idx] = l
      target[idx + 1] = r
    }
    for (let i = 0; i < 18; i += 2) step(this.P, i)
    for (let i = 0; i < 1024; i += 2) step(this.S, i)
  }
}

function decode64(text: string, length: number): Uint8Array {
  const out: number[] = []
  const val = (c: string): number => B64.indexOf(c)
  for (let i = 0; i + 1 < text.length && out.length < length; i += 4) {
    const c1 = val(text[i]!)
    const c2 = val(text[i + 1]!)
    out.push(((c1 << 2) | ((c2 & 0x30) >> 4)) & 0xff)
    if (out.length >= length || i + 2 >= text.length) break
    const c3 = val(text[i + 2]!)
    out.push((((c2 & 0x0f) << 4) | ((c3 & 0x3c) >> 2)) & 0xff)
    if (out.length >= length || i + 3 >= text.length) break
    const c4 = val(text[i + 3]!)
    out.push((((c3 & 0x03) << 6) | c4) & 0xff)
  }
  return Uint8Array.from(out.slice(0, length))
}

function encode64(data: Uint8Array): string {
  let out = ''
  for (let i = 0; i < data.length; i += 3) {
    const c1 = data[i]!
    out += B64[c1 >> 2]
    let c = (c1 & 0x03) << 4
    if (i + 1 >= data.length) {
      out += B64[c]
      break
    }
    const c2 = data[i + 1]!
    c |= c2 >> 4
    out += B64[c]
    c = (c2 & 0x0f) << 2
    if (i + 2 >= data.length) {
      out += B64[c]
      break
    }
    const c3 = data[i + 2]!
    c |= c3 >> 6
    out += B64[c]
    out += B64[c3 & 0x3f]
  }
  return out
}

/** Hashes with a given salt string (22 chars) and cost. Exposed for tests; production only verifies. */
export function bcryptHashWithSalt(password: string, salt22: string, cost: number, prefix = '2y'): string {
  const raw = Buffer.from(password, 'utf8')
  const key = new Uint8Array(Math.min(raw.length + 1, 72))
  key.set(raw.subarray(0, key.length))
  // The NUL terminator is part of the key unless the password already fills 72 bytes.
  if (raw.length + 1 <= 72) key[raw.length] = 0

  const saltBytes = decode64(salt22, 16)
  const salt = new Uint32Array(4)
  for (let i = 0; i < 4; i++) {
    salt[i] = ((saltBytes[4 * i]! << 24) | (saltBytes[4 * i + 1]! << 16) | (saltBytes[4 * i + 2]! << 8) | saltBytes[4 * i + 3]!) >>> 0
  }

  const bf = new Blowfish()
  bf.expand(key, salt)
  const rounds = 2 ** cost
  const saltKey = new Uint8Array(saltBytes)
  for (let i = 0; i < rounds; i++) {
    bf.expand(key)
    bf.expand(saltKey)
  }

  const magic = Buffer.from(MAGIC, 'ascii')
  const words = new Uint32Array(6)
  for (let i = 0; i < 6; i++) words[i] = magic.readUInt32BE(4 * i)
  for (let n = 0; n < 64; n++) {
    for (let i = 0; i < 6; i += 2) {
      const [l, r] = bf.encrypt(words[i]!, words[i + 1]!)
      words[i] = l
      words[i + 1] = r
    }
  }
  const out = Buffer.alloc(24)
  for (let i = 0; i < 6; i++) out.writeUInt32BE(words[i]!, 4 * i)

  return `$${prefix}$${String(cost).padStart(2, '0')}$${salt22}${encode64(out.subarray(0, 23))}`
}

export function isLegacyBcrypt(hash: string): boolean {
  return HASH_RE.test(hash)
}

/** Verifies `password` against a legacy bcrypt hash (constant-time compare). False for any malformed hash. */
export function verifyLegacyBcrypt(password: string, hash: string): boolean {
  const m = HASH_RE.exec(hash)
  if (!m) return false
  const cost = Number(m[2])
  if (cost < 4 || cost > 16) return false
  const candidate = bcryptHashWithSalt(password, m[3]!, cost, `2${m[1]}`)
  const a = Buffer.from(candidate)
  const b = Buffer.from(hash)
  return a.length === b.length && timingSafeEqual(a, b)
}
