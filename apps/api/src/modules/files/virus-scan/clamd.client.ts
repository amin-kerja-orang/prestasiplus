import { connect, type Socket } from 'node:net'

/**
 * Minimal clamd client over TCP (backlog #78). Two commands only, both in the null-terminated `z` form:
 * `zINSTREAM` (scan the bytes we send, no shared filesystem needed) and `zPING`.
 * INSTREAM framing: `zINSTREAM\0`, then chunks of [4-byte big-endian length][bytes], then a zero length chunk.
 * Replies: `stream: OK\0`, `stream: <Signature> FOUND\0`, or `<message> ERROR\0` (for example "INSTREAM size limit exceeded.").
 */
export interface ClamdTarget {
  host: string
  port: number
  /** Whole-exchange deadline (connect + send + reply). */
  timeoutMs: number
}

export type ClamdVerdict = { clean: true } | { clean: false; signature: string }

/** The scanner did not give a trustworthy answer (unreachable, timed out, protocol or size error). Callers fail closed. */
export class ScannerUnavailableError extends Error {
  constructor(
    readonly reason: 'unreachable' | 'timeout' | 'protocol' | 'error',
    detail: string,
  ) {
    super(`virus scanner ${reason}: ${detail}`)
    this.name = 'ScannerUnavailableError'
  }
}

/** Bytes per INSTREAM chunk. clamd's StreamMaxLength is checked on the total, not per chunk. */
export const CHUNK_BYTES = 64 * 1024

const REPLY_LIMIT = 4096
const UNREACHABLE_CODES = new Set(['ECONNREFUSED', 'ENOTFOUND', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN'])

/** Runs `write` once connected and resolves with the reply text (without the trailing NUL or newline). */
function exchange(target: ClamdTarget, write: (socket: Socket) => Promise<void>): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    let settled = false
    const chunks: Buffer[] = []
    const socket = connect({ host: target.host, port: target.port })
    const reply = (): string => Buffer.concat(chunks).toString('utf8').replace(/[\0\n]+$/, '')
    const finish = (err: ScannerUnavailableError | null, text?: string): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.destroy()
      if (err) reject(err)
      else resolve(text ?? '')
    }
    const timer = setTimeout(() => finish(new ScannerUnavailableError('timeout', `no reply within ${target.timeoutMs} ms`)), target.timeoutMs)
    const noReply = (): ScannerUnavailableError => new ScannerUnavailableError('protocol', 'connection closed without a reply')
    socket.on('error', (e: NodeJS.ErrnoException) => {
      // clamd may answer (for example a size-limit ERROR) and close while we still write: the reply wins over EPIPE/ECONNRESET.
      if (chunks.length > 0) return finish(null, reply())
      finish(new ScannerUnavailableError(UNREACHABLE_CODES.has(e.code ?? '') ? 'unreachable' : 'error', e.code ?? e.message))
    })
    socket.on('data', (d: Buffer) => {
      chunks.push(d)
      if (Buffer.concat(chunks).length > REPLY_LIMIT) return finish(new ScannerUnavailableError('protocol', 'reply too long'))
      if (d.includes(0) || d.includes(10)) finish(null, reply())
    })
    socket.on('end', () => (chunks.length > 0 ? finish(null, reply()) : finish(noReply())))
    socket.on('close', () => (chunks.length > 0 ? finish(null, reply()) : finish(noReply())))
    socket.once('connect', () => {
      write(socket).catch((e: unknown) => {
        const code = (e as NodeJS.ErrnoException | null)?.code
        // A write that fails after clamd already replied is not an error: the reply (if any) is used.
        if (chunks.length > 0) finish(null, reply())
        else finish(new ScannerUnavailableError('error', code ?? (e instanceof Error ? e.message : 'write failed')))
      })
    })
  })
}

function writeAll(socket: Socket, data: Buffer | string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    if (socket.destroyed) return reject(Object.assign(new Error('socket closed'), { code: 'EPIPE' }))
    let done = false
    const ok = (): void => {
      if (!done) {
        done = true
        resolve()
      }
    }
    const flushed = socket.write(data, (err) => {
      if (err && !done) {
        done = true
        reject(err)
      }
    })
    if (flushed) ok()
    else socket.once('drain', ok)
  })
}

/** INSTREAM scan of `data`. Throws ScannerUnavailableError for anything that is not a clear OK or FOUND. */
export async function clamdScan(target: ClamdTarget, data: Buffer): Promise<ClamdVerdict> {
  const text = await exchange(target, async (socket) => {
    await writeAll(socket, 'zINSTREAM\0')
    for (let off = 0; off < data.length; off += CHUNK_BYTES) {
      const part = data.subarray(off, Math.min(off + CHUNK_BYTES, data.length))
      const head = Buffer.alloc(4)
      head.writeUInt32BE(part.length, 0)
      await writeAll(socket, Buffer.concat([head, part]))
    }
    await writeAll(socket, Buffer.alloc(4)) // zero length chunk: end of stream
  })
  return parseScanReply(text)
}

/** `stream: OK`, `stream: Name FOUND`, anything else is unusable. */
export function parseScanReply(text: string): ClamdVerdict {
  const t = text.trim()
  if (/^stream:\s*OK$/i.test(t)) return { clean: true }
  const found = /^stream:\s*(.+?)\s+FOUND$/i.exec(t)
  if (found) return { clean: false, signature: (found[1] as string).slice(0, 120) }
  if (/ERROR$/i.test(t)) throw new ScannerUnavailableError('error', t.slice(0, 120))
  throw new ScannerUnavailableError('protocol', 'unexpected reply')
}

/** True when clamd answers PONG. Never throws. */
export async function clamdPing(target: ClamdTarget): Promise<boolean> {
  try {
    return (await exchange(target, (s) => writeAll(s, 'zPING\0'))).trim() === 'PONG'
  } catch {
    return false
  }
}
