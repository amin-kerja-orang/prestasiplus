import { createServer } from 'node:net'

import { ConfigService } from '@nestjs/config'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { CHUNK_BYTES, clamdPing, clamdScan, parseScanReply, ScannerUnavailableError } from '../../src/modules/files/virus-scan/clamd.client'
import { VirusScanConfig } from '../../src/modules/files/virus-scan/virus-scan.config'
import { SCANNER_HEALTH_TTL_MS, VirusScanService } from '../../src/modules/files/virus-scan/virus-scan.service'
import { eicar, FakeClamd } from '../support/fake-clamd'

const cfg = (env: Record<string, unknown>): VirusScanConfig => new VirusScanConfig(new ConfigService(env))

describe('clamd client (INSTREAM over TCP, fake clamd)', () => {
  const clamd = new FakeClamd()
  beforeAll(async () => {
    await clamd.start()
  })
  afterAll(async () => {
    await clamd.stop()
  })
  beforeEach(() => {
    clamd.mode = 'scan'
    clamd.scans = 0
    clamd.streamed.length = 0
  })
  const target = (timeoutMs = 3000) => ({ host: '127.0.0.1', port: clamd.port, timeoutMs })

  it('a clean file is reported clean and every byte is streamed (multi-chunk)', async () => {
    const data = Buffer.alloc(CHUNK_BYTES * 2 + 123, 7)
    await expect(clamdScan(target(), data)).resolves.toEqual({ clean: true })
    expect(clamd.streamed).toEqual([data.length])
  })

  it('an empty file is clean', async () => {
    await expect(clamdScan(target(), Buffer.alloc(0))).resolves.toEqual({ clean: true })
  })

  it('EICAR is reported infected with the signature name', async () => {
    const data = Buffer.concat([Buffer.from('%PDF-1.4\n'), eicar()])
    await expect(clamdScan(target(), data)).resolves.toEqual({ clean: false, signature: 'Eicar-Test-Signature' })
  })

  it('a scanner that never answers times out (fail closed signal)', async () => {
    clamd.mode = 'hang'
    const started = Date.now()
    await expect(clamdScan(target(300), Buffer.from('abc'))).rejects.toMatchObject({ name: 'ScannerUnavailableError', reason: 'timeout' })
    expect(Date.now() - started).toBeLessThan(2500)
  })

  it('a refused connection is unreachable', async () => {
    const closed = createServer()
    await new Promise<void>((r) => closed.listen(0, '127.0.0.1', r))
    const port = (closed.address() as { port: number }).port
    await new Promise<void>((r) => closed.close(() => r()))
    await expect(clamdScan({ host: '127.0.0.1', port, timeoutMs: 2000 }, Buffer.from('abc'))).rejects.toMatchObject({ reason: 'unreachable' })
  })

  it('an ERROR reply (for example the size limit), a junk reply and a dropped connection are all failures, never "clean"', async () => {
    clamd.mode = 'error-reply'
    await expect(clamdScan(target(), Buffer.from('abc'))).rejects.toBeInstanceOf(ScannerUnavailableError)
    clamd.mode = 'garbage'
    await expect(clamdScan(target(), Buffer.from('abc'))).rejects.toMatchObject({ reason: 'protocol' })
    clamd.mode = 'drop'
    await expect(clamdScan(target(), Buffer.from('abc'))).rejects.toBeInstanceOf(ScannerUnavailableError)
  })

  it('PING answers true for PONG and false when down or silent', async () => {
    await expect(clamdPing(target())).resolves.toBe(true)
    clamd.mode = 'hang'
    await expect(clamdPing(target(200))).resolves.toBe(false)
  })

  it('parseScanReply: OK, FOUND, ERROR and unknown', () => {
    expect(parseScanReply('stream: OK')).toEqual({ clean: true })
    expect(parseScanReply('stream: Win.Test.EICAR_HDB-1 FOUND')).toEqual({ clean: false, signature: 'Win.Test.EICAR_HDB-1' })
    expect(() => parseScanReply('Some problem ERROR')).toThrow(ScannerUnavailableError)
    expect(() => parseScanReply('')).toThrow(ScannerUnavailableError)
  })
})

describe('VirusScanConfig and VirusScanService', () => {
  it('defaults: no host, port 3310, 30 s; required only with the teacher flag or a host', () => {
    const c = cfg({})
    expect(c).toMatchObject({ host: null, port: 3310, timeoutMs: 30_000, required: false })
    expect(cfg({ INTAKE_TEACHER_ENABLED: 'true' }).required).toBe(true)
    expect(cfg({ CLAMAV_HOST: 'clamav' })).toMatchObject({ host: 'clamav', required: true })
    expect(cfg({ CLAMAV_HOST: '  ' }).host).toBeNull()
    expect(cfg({ CLAMAV_PORT: '99999', CLAMAV_TIMEOUT_MS: '5' })).toMatchObject({ port: 3310, timeoutMs: 30_000 })
    expect(cfg({ CLAMAV_PORT: '4310', CLAMAV_TIMEOUT_MS: '5000' })).toMatchObject({ port: 4310, timeoutMs: 5000 })
  })

  it('scan without a host fails closed; health is disabled', async () => {
    const s = new VirusScanService(cfg({ INTAKE_TEACHER_ENABLED: 'true' }))
    await expect(s.scan(Buffer.from('x'))).rejects.toBeInstanceOf(ScannerUnavailableError)
    await expect(s.health()).resolves.toBe('disabled')
  })

  it('health is ok / down from a PING and is cached', async () => {
    const clamd = new FakeClamd()
    await clamd.start()
    try {
      const s = new VirusScanService(cfg({ CLAMAV_HOST: '127.0.0.1', CLAMAV_PORT: String(clamd.port), CLAMAV_TIMEOUT_MS: '1000' }))
      let t = 1_000_000
      s.now = () => t
      await expect(s.health()).resolves.toBe('ok')
      clamd.mode = 'hang'
      await expect(s.health()).resolves.toBe('ok') // cached
      t += SCANNER_HEALTH_TTL_MS + 1
      await expect(s.health()).resolves.toBe('down')
      await expect(s.scan(eicar())).rejects.toBeInstanceOf(ScannerUnavailableError)
    } finally {
      await clamd.stop()
    }
  })
})
