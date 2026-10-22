import { createServer, type Server, type Socket } from 'node:net'

import { afterEach, describe, expect, it } from 'vitest'

import { ClamdScanner } from '../../src/modules/files/clamd.scanner'
import { ScannerUnavailableError } from '../../src/modules/files/malware-scanner'

let server: Server | undefined
const sockets: Socket[] = []
afterEach(async () => {
  for (const s of sockets.splice(0)) s.destroy()
  if (server) await new Promise((r) => server?.close(r))
  server = undefined
})

/** Fake clamd: collects what the client sends, answers with `reply` (a string + \0) once the zero chunk arrived; null = never answers. */
async function fake(reply: string | null): Promise<{ port: number; received: () => Buffer }> {
  let received = Buffer.alloc(0)
  server = createServer((socket) => {
    sockets.push(socket)
    socket.on('error', () => undefined)
    socket.on('data', (d) => {
      received = Buffer.concat([received, d])
      if (reply !== null && received.subarray(-4).equals(Buffer.alloc(4)) && received.length >= 14) socket.end(`${reply}\0`)
    })
  })
  await new Promise<void>((r) => server?.listen(0, '127.0.0.1', r))
  return { port: (server.address() as { port: number }).port, received: () => received }
}

const scanner = (port: number, timeoutMs = 2000) => new ClamdScanner({ host: '127.0.0.1', port, timeoutMs })

describe('ClamdScanner', () => {
  it('stream: OK is clean', async () => {
    const f = await fake('stream: OK')
    expect(await scanner(f.port).scan(Buffer.from('hello'))).toEqual({ verdict: 'clean' })
  })

  it('stream: <sig> FOUND is infected and the signature is parsed', async () => {
    const f = await fake('stream: Win.Test.EICAR_HDB-1 FOUND')
    expect(await scanner(f.port).scan(Buffer.from('x'))).toEqual({ verdict: 'infected', signature: 'Win.Test.EICAR_HDB-1' })
  })

  it('a size-limit ERROR reply is ScannerUnavailableError', async () => {
    const f = await fake('INSTREAM size limit exceeded. ERROR')
    await expect(scanner(f.port).scan(Buffer.from('x'))).rejects.toBeInstanceOf(ScannerUnavailableError)
  })

  it('a refused connection is ScannerUnavailableError', async () => {
    const f = await fake('stream: OK')
    await afterClose()
    await expect(scanner(f.port).scan(Buffer.from('x'))).rejects.toBeInstanceOf(ScannerUnavailableError)
  })

  it('a server that never answers times out as ScannerUnavailableError', async () => {
    const f = await fake(null)
    await expect(scanner(f.port, 300).scan(Buffer.from('x'))).rejects.toMatchObject({ name: 'ScannerUnavailableError', reason: 'timeout' })
  })

  it('frames INSTREAM correctly: command, 4-byte big-endian length prefixes per chunk, zero terminator', async () => {
    const f = await fake('stream: OK')
    const bytes = Buffer.alloc(64 * 1024 + 10, 7)
    await scanner(f.port).scan(bytes)
    const got = f.received()
    const cmd = Buffer.from('zINSTREAM\0')
    expect(got.subarray(0, cmd.length).equals(cmd)).toBe(true)
    let at = cmd.length
    const sizes: number[] = []
    const data: Buffer[] = []
    for (;;) {
      const n = got.readUInt32BE(at)
      at += 4
      if (n === 0) break
      sizes.push(n)
      data.push(got.subarray(at, at + n))
      at += n
    }
    expect(sizes).toEqual([64 * 1024, 10])
    expect(at).toBe(got.length)
    expect(Buffer.concat(data).equals(bytes)).toBe(true)
  })
})

async function afterClose(): Promise<void> {
  for (const s of sockets.splice(0)) s.destroy()
  await new Promise((r) => server?.close(r))
  server = undefined
}
