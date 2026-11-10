import { createServer, type Server, type Socket } from 'node:net'

/** The EICAR antivirus test string, generated from char codes so no scanner-triggering file or literal sits in the repository. */
const EICAR_CODES = [
  88, 53, 79, 33, 80, 37, 64, 65, 80, 91, 52, 80, 90, 88, 53, 52, 40, 80, 94, 41, 55, 67, 67, 41, 55, 125, 36, 69, 73, 67, 65, 82, 45, 83, 84, 65, 78, 68, 65, 82, 68, 45, 65, 78,
  84, 73, 86, 73, 82, 85, 83, 45, 84, 69, 83, 84, 45, 70, 73, 76, 69, 33, 36, 72, 43, 72, 42,
]
export const eicar = (): Buffer => Buffer.from(String.fromCharCode(...EICAR_CODES), 'latin1')

export type FakeClamdMode = 'scan' | 'hang' | 'error-reply' | 'garbage' | 'drop'

/**
 * A clamd stand-in speaking the real wire protocol (zINSTREAM framing, zPING). `scan` mode answers FOUND when the streamed
 * bytes contain the EICAR string, OK otherwise. Other modes simulate a timeout (`hang`), a clamd ERROR reply, junk, or a dropped connection.
 */
export class FakeClamd {
  mode: FakeClamdMode = 'scan'
  /** Number of INSTREAM scans received and the byte totals streamed. */
  scans = 0
  readonly streamed: number[] = []
  private readonly server: Server
  private readonly sockets = new Set<Socket>()
  port = 0

  constructor() {
    this.server = createServer((s) => this.onConnection(s))
  }

  async start(): Promise<number> {
    await new Promise<void>((resolve) => this.server.listen(0, '127.0.0.1', resolve))
    this.port = (this.server.address() as { port: number }).port
    return this.port
  }

  async stop(): Promise<void> {
    for (const s of this.sockets) s.destroy()
    await new Promise<void>((resolve) => this.server.close(() => resolve()))
  }

  private onConnection(s: Socket): void {
    this.sockets.add(s)
    s.on('close', () => this.sockets.delete(s))
    s.on('error', () => undefined)
    let buf = Buffer.alloc(0)
    s.on('data', (d: Buffer) => {
      buf = Buffer.concat([buf, d])
      if (this.mode === 'hang') return
      if (this.mode === 'drop') return void s.destroy()
      if (buf.toString('latin1').startsWith('zPING\0')) return void s.end('PONG\0')
      const head = 'zINSTREAM\0'
      if (buf.length < head.length || buf.toString('latin1', 0, head.length) !== head) return
      // Walk the chunks; a zero length chunk ends the stream.
      let off = head.length
      const parts: Buffer[] = []
      for (;;) {
        if (buf.length < off + 4) return
        const len = buf.readUInt32BE(off)
        if (len === 0) break
        if (buf.length < off + 4 + len) return
        parts.push(buf.subarray(off + 4, off + 4 + len))
        off += 4 + len
      }
      this.scans += 1
      const data = Buffer.concat(parts)
      this.streamed.push(data.length)
      buf = Buffer.alloc(0)
      if (this.mode === 'error-reply') return void s.end('INSTREAM size limit exceeded. ERROR\0')
      if (this.mode === 'garbage') return void s.end('what is this\0')
      s.end(data.includes(eicar()) ? 'stream: Eicar-Test-Signature FOUND\0' : 'stream: OK\0')
    })
  }
}
