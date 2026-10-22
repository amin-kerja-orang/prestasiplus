import { connect } from 'node:net'

import { type MalwareScanner, ScannerUnavailableError, type ScanResult } from './malware-scanner'

const CHUNK = 64 * 1024
const MAX_REPLY = 4096

/** The signature comes from the network: drop control characters and cap the length before it is logged or returned. */
export function cleanSignature(raw: string): string {
  return raw.replace(/[\u0000-\u001f\u007f-\u009f]/g, '').slice(0, 200) || 'unknown'
}

export interface ClamdOptions {
  host: string
  port: number
  /** Socket idle timeout and total deadline of one scan. */
  timeoutMs: number
}

/** clamd INSTREAM client over plain TCP (`node:net`, no dependency). Bytes are never logged. */
export class ClamdScanner implements MalwareScanner {
  constructor(private readonly options: ClamdOptions) {}

  scan(bytes: Buffer): Promise<ScanResult> {
    const { host, port, timeoutMs } = this.options
    return new Promise<ScanResult>((resolve, reject) => {
      const socket = connect({ host, port })
      const chunks: Buffer[] = []
      let received = 0
      let done = false
      const finish = (fn: () => void): void => {
        if (done) return
        done = true
        clearTimeout(deadline)
        socket.destroy()
        fn()
      }
      const fail = (reason: string): void => finish(() => reject(new ScannerUnavailableError(reason)))
      const deadline = setTimeout(() => fail('timeout'), timeoutMs)
      socket.setTimeout(timeoutMs, () => fail('timeout'))
      socket.on('error', (err: NodeJS.ErrnoException) => fail(err.code ?? 'socket error'))
      socket.on('close', () => fail('connection closed'))
      socket.on('connect', () => {
        socket.write('zINSTREAM\0')
        for (let at = 0; at < bytes.length; at += CHUNK) {
          const part = bytes.subarray(at, at + CHUNK)
          const head = Buffer.alloc(4)
          head.writeUInt32BE(part.length)
          socket.write(head)
          socket.write(part)
        }
        socket.write(Buffer.alloc(4))
      })
      socket.on('data', (data: Buffer) => {
        chunks.push(data)
        received += data.length
        const all = Buffer.concat(chunks)
        const end = all.indexOf(0)
        if (end === -1) {
          if (received > MAX_REPLY) fail('oversized reply')
          return
        }
        const reply = all.subarray(0, end).toString('utf8').trim()
        const found = /^stream: (.+) FOUND$/.exec(reply)
        if (reply === 'stream: OK') finish(() => resolve({ verdict: 'clean' }))
        else if (found?.[1]) finish(() => resolve({ verdict: 'infected', signature: cleanSignature(found[1] as string) }))
        else fail(reply.endsWith('ERROR') ? 'scanner error' : 'unexpected reply')
      })
    })
  }
}
