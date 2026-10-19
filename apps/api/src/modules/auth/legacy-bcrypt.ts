/**
 * Verify-only bcrypt for LEGACY password hashes (`$2y$`, `$2b$`, `$2a$`) migrated from .cloud
 * (Laravel). New hashes are always argon2id (`PasswordService`); a legacy hash is rehashed on the
 * first successful login, so this code path shrinks to nothing over time.
 *
 * Why in-house: the API workspace has no bcrypt dependency and a card may not add one. This is the
 * standard EksBlowfish algorithm (Provos and Mazieres). The Blowfish initial state is the
 * fractional part of pi in hexadecimal, computed with BigInt (Machin's formula) instead of pasting
 * 4 KB of constants. The unit test checks a published crypt_blowfish vector and a hash produced by
 * PHP `password_hash` (Laravel's hasher).
 *
 * A cost-12 hash takes about a second of CPU, so verification NEVER runs on the main thread: it
 * goes to a small fixed pool of `worker_threads` with a bounded queue (`LegacyBcryptPool`). The
 * algorithm is one self-contained function (`bcryptCore`, no outer references) so that the pool can
 * ship its source to the workers; this works the same from source, from tests and from the single
 * bundled `dist/main.js`, where a separate worker file would not exist.
 * To swap in `bcryptjs` later, replace `bcryptCore` and the pool only.
 */
import { timingSafeEqual } from 'node:crypto'
import { availableParallelism } from 'node:os'
import { Worker } from 'node:worker_threads'

import { Inject, Injectable, Logger, Optional, type OnModuleDestroy } from '@nestjs/common'

const HASH_RE = /^\$2([abxy])\$(\d{2})\$([./A-Za-z0-9]{22})([./A-Za-z0-9]{31})$/

/** Costs outside this range are not verified (a cost above 13 would be a CPU-exhaustion vector). */
export const MIN_LEGACY_COST = 4
export const MAX_LEGACY_COST = 13

/**
 * EksBlowfish hash of `password` with a 22-character salt. SELF-CONTAINED ON PURPOSE: it must not
 * reference anything outside its own body (its source text is evaluated inside worker threads).
 */
export function bcryptCore(password: string, salt22: string, cost: number, prefix: string): string {
  const B64 = './ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'
  const g = globalThis as unknown as { __ppBlowfishInit?: { P: Uint32Array; S: Uint32Array } }

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

  function initState(): { P: Uint32Array; S: Uint32Array } {
    if (g.__ppBlowfishInit) return g.__ppBlowfishInit
    const words = 18 + 4 * 256
    const bits = BigInt(words * 32 + 64)
    const pi = 16n * arctanInv(5n, bits) - 4n * arctanInv(239n, bits)
    const top = (pi & ((1n << bits) - 1n)) >> 64n
    const all = new Uint32Array(words)
    for (let i = 0; i < words; i++) all[i] = Number((top >> BigInt((words - 1 - i) * 32)) & 0xffffffffn)
    g.__ppBlowfishInit = { P: all.slice(0, 18), S: all.slice(18) }
    return g.__ppBlowfishInit
  }

  const init = initState()
  const P = init.P.slice()
  const S = init.S.slice()

  function f(x: number): number {
    const h = ((S[x >>> 24]! + S[256 + ((x >>> 16) & 0xff)]!) ^ S[512 + ((x >>> 8) & 0xff)]!) >>> 0
    return (h + S[768 + (x & 0xff)]!) >>> 0
  }

  function encrypt(l: number, r: number): [number, number] {
    let L = l >>> 0
    let R = r >>> 0
    for (let i = 0; i < 16; i += 2) {
      L = (L ^ P[i]!) >>> 0
      R = (R ^ f(L)) >>> 0
      R = (R ^ P[i + 1]!) >>> 0
      L = (L ^ f(R)) >>> 0
    }
    return [(R ^ P[17]!) >>> 0, (L ^ P[16]!) >>> 0]
  }

  function expand(key: Uint8Array, salt?: Uint32Array): void {
    let pos = 0
    for (let i = 0; i < 18; i++) {
      let w = 0
      for (let b = 0; b < 4; b++) {
        w = ((w << 8) | key[pos]!) >>> 0
        pos = (pos + 1) % key.length
      }
      P[i] = (P[i]! ^ w) >>> 0
    }
    let l = 0
    let r = 0
    let j = 0
    function step(target: Uint32Array, idx: number): void {
      if (salt) {
        l = (l ^ salt[j]!) >>> 0
        r = (r ^ salt[j + 1]!) >>> 0
        j = (j + 2) % 4
      }
      const out = encrypt(l, r)
      l = out[0]
      r = out[1]
      target[idx] = l
      target[idx + 1] = r
    }
    for (let i = 0; i < 18; i += 2) step(P, i)
    for (let i = 0; i < 1024; i += 2) step(S, i)
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

  const raw = Buffer.from(password, 'utf8')
  const key = new Uint8Array(Math.min(raw.length + 1, 72))
  key.set(raw.subarray(0, key.length))
  // The NUL terminator is part of the key unless the password already fills 72 bytes.
  if (raw.length + 1 <= 72) key[raw.length] = 0

  const saltBytes = decode64(salt22, 16)
  const salt = new Uint32Array(4)
  for (let i = 0; i < 4; i++) {
    salt[i] =
      ((saltBytes[4 * i]! << 24) | (saltBytes[4 * i + 1]! << 16) | (saltBytes[4 * i + 2]! << 8) | saltBytes[4 * i + 3]!) >>> 0
  }

  expand(key, salt)
  const rounds = 2 ** cost
  for (let i = 0; i < rounds; i++) {
    expand(key)
    expand(saltBytes)
  }

  const magic = Buffer.from('OrpheanBeholderScryDoubt', 'ascii')
  const words = new Uint32Array(6)
  for (let i = 0; i < 6; i++) words[i] = magic.readUInt32BE(4 * i)
  for (let n = 0; n < 64; n++) {
    for (let i = 0; i < 6; i += 2) {
      const out = encrypt(words[i]!, words[i + 1]!)
      words[i] = out[0]
      words[i + 1] = out[1]
    }
  }
  const out = Buffer.alloc(24)
  for (let i = 0; i < 6; i++) out.writeUInt32BE(words[i]!, 4 * i)
  return `$${prefix}$${String(cost).padStart(2, '0')}$${salt22}${encode64(out.subarray(0, 23))}`
}

/** Synchronous hash on the CALLING thread. For tests and fixtures only; production verifies in the pool. */
export function bcryptHashWithSalt(password: string, salt22: string, cost: number, prefix = '2y'): string {
  return bcryptCore(password, salt22, cost, prefix)
}

export function isLegacyBcrypt(hash: string): boolean {
  return HASH_RE.test(hash)
}

/** Parsed legacy hash, or null when it is malformed or its cost is outside 4..13. */
export function parseLegacyBcrypt(hash: string): { prefix: string; cost: number; salt: string } | null {
  const m = HASH_RE.exec(hash)
  if (!m) return null
  const cost = Number(m[2])
  if (cost < MIN_LEGACY_COST || cost > MAX_LEGACY_COST) return null
  return { prefix: `2${m[1]}`, cost, salt: m[3] as string }
}

/** Raised when every worker is busy and the queue is full; the caller answers 429. */
export class LegacyBcryptBusyError extends Error {
  constructor() {
    super('legacy bcrypt queue is full')
  }
}

interface Job {
  args: [string, string, number, string]
  timer?: NodeJS.Timeout
  resolve(hash: string): void
  reject(err: Error): void
}

const WORKER_BOOT = `
const { parentPort } = require('node:worker_threads');
const core = ${bcryptCore.toString()};
parentPort.on('message', (m) => {
  try { parentPort.postMessage({ id: m.id, hash: core(...m.args) }); }
  catch (e) { parentPort.postMessage({ id: m.id, error: String(e && e.message || e) }); }
});
`

/** Optional DI token to size the pool (tests). */
export const LEGACY_POOL_OPTIONS = Symbol('LEGACY_POOL_OPTIONS')

export interface PoolOptions {
  size?: number
  maxQueue?: number
  /** A queued job that has not started after this many ms is refused (default 5000). */
  queueTimeoutMs?: number
}

/** Small fixed pool of worker threads running `bcryptCore` (lazy start, bounded queue). */
@Injectable()
export class LegacyBcryptPool implements OnModuleDestroy {
  private readonly logger = new Logger(LegacyBcryptPool.name)
  private readonly size: number
  private readonly maxQueue: number
  private readonly queueTimeoutMs: number
  private readonly idle: Worker[] = []
  private readonly busy = new Map<Worker, { id: number; job: Job }>()
  private readonly queue: Job[] = []
  private readonly live = new Set<Worker>()
  private nextId = 1
  private closed = false

  constructor(@Optional() @Inject(LEGACY_POOL_OPTIONS) options: PoolOptions = {}) {
    this.size = options.size ?? Math.max(1, Math.min(2, availableParallelism() - 1))
    this.maxQueue = options.maxQueue ?? 8
    this.queueTimeoutMs = options.queueTimeoutMs ?? 5000
  }

  /** The hash of `password` under a given salt and cost, computed off the main thread. */
  hash(password: string, salt22: string, cost: number, prefix: string): Promise<string> {
    if (this.closed) return Promise.reject(new Error('legacy bcrypt pool is closed'))
    return new Promise<string>((resolve, reject) => {
      const job: Job = { args: [password, salt22, cost, prefix], resolve, reject }
      const worker = this.takeWorker()
      if (worker) return this.dispatch(worker, job)
      if (this.queue.length >= this.maxQueue) return reject(new LegacyBcryptBusyError())
      job.timer = setTimeout(() => {
        const i = this.queue.indexOf(job)
        if (i >= 0) {
          this.queue.splice(i, 1)
          reject(new LegacyBcryptBusyError())
        }
      }, this.queueTimeoutMs)
      job.timer.unref()
      this.queue.push(job)
    })
  }

  /** Verifies against a stored legacy hash. False for a malformed hash or a cost outside 4..13. */
  async verify(password: string, stored: string): Promise<boolean> {
    const parsed = parseLegacyBcrypt(stored)
    if (!parsed) return false
    const candidate = await this.hash(password, parsed.salt, parsed.cost, parsed.prefix)
    const a = Buffer.from(candidate)
    const b = Buffer.from(stored)
    return a.length === b.length && timingSafeEqual(a, b)
  }

  async onModuleDestroy(): Promise<void> {
    this.closed = true
    for (const job of this.queue.splice(0)) {
      if (job.timer) clearTimeout(job.timer)
      job.reject(new Error('legacy bcrypt pool is closed'))
    }
    await Promise.all([...this.idle, ...this.busy.keys()].map((w) => w.terminate()))
  }

  private takeWorker(): Worker | undefined {
    const idle = this.idle.pop()
    if (idle) return idle
    if (this.live.size < this.size) {
      return this.spawn()
    }
    return undefined
  }

  private spawn(): Worker {
    const worker = new Worker(WORKER_BOOT, { eval: true })
    this.live.add(worker)
    worker.unref() // an idle pool never keeps the process alive
    worker.on('message', (msg: { id: number; hash?: string; error?: string }) => {
      const current = this.busy.get(worker)
      if (!current || current.id !== msg.id) return
      this.busy.delete(worker)
      if (msg.hash !== undefined) current.job.resolve(msg.hash)
      else current.job.reject(new Error(msg.error ?? 'legacy bcrypt failed'))
      this.release(worker)
    })
    worker.on('error', (err) => {
      this.logger.error(`legacy bcrypt worker failed: ${err.message}`)
      this.drop(worker, err)
    })
    worker.on('exit', () => this.drop(worker, new Error('legacy bcrypt worker exited')))
    return worker
  }

  private dispatch(worker: Worker, job: Job): void {
    if (job.timer) clearTimeout(job.timer)
    const id = this.nextId++
    this.busy.set(worker, { id, job })
    worker.ref()
    worker.postMessage({ id, args: job.args })
  }

  private release(worker: Worker): void {
    const next = this.queue.shift()
    if (next) return this.dispatch(worker, next)
    worker.unref()
    this.idle.push(worker)
  }

  /** A dead worker fails its job and frees its slot for a fresh one. */
  private drop(worker: Worker, err: Error): void {
    if (!this.live.delete(worker)) return
    const i = this.idle.indexOf(worker)
    if (i >= 0) this.idle.splice(i, 1)
    const current = this.busy.get(worker)
    if (current) {
      this.busy.delete(worker)
      current.job.reject(err)
    }
    const next = this.queue.shift()
    if (next && !this.closed) {
      const w = this.takeWorker()
      if (w) this.dispatch(w, next)
      else next.reject(err)
    }
  }
}
