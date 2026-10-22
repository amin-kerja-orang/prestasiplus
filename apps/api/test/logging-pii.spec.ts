import { Writable } from 'node:stream'

import { pino } from 'pino'
import { pinoHttp } from 'pino-http'
import { describe, expect, it } from 'vitest'

import { REDACT_PATHS, pinoHttpOptions, redactUrl } from '../src/common/logging/logging'

function capture(): { lines: string[]; stream: Writable } {
  const lines: string[] = []
  const stream = new Writable({
    write(chunk: Buffer, _enc, cb) {
      lines.push(chunk.toString())
      cb()
    },
  })
  return { lines, stream }
}

describe('log PII hygiene (BE-33)', () => {
  it('keeps query keys but never query values', () => {
    expect(redactUrl('/api/x?search=Ali%20Bin&page=2')).toBe('/api/x?search=[redacted]&page=[redacted]')
    expect(redactUrl('/api/x')).toBe('/api/x')
    expect(redactUrl('/api/x?')).toBe('/api/x')
  })

  it('an access-log line has no query value but keeps id, method, status and timing', async () => {
    const { lines, stream } = capture()
    const { createServer } = await import('node:http')
    const opts = pinoHttpOptions({ LOG_LEVEL: 'info' })
    const logger = pinoHttp({ ...opts, logger: pino({ level: 'info', redact: opts.redact }, stream) })
    const server = createServer((req, res) => {
      ;(req as unknown as { id: string }).id = 'req-1'
      logger(req, res)
      res.statusCode = 200
      res.end('ok')
    })
    await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
    const port = (server.address() as { port: number }).port
    await fetch(`http://127.0.0.1:${port}/api/x?search=Ali%20Bin&page=2`)
    await new Promise((r) => setTimeout(r, 50))
    await new Promise((r) => server.close(r))
    const line = lines.join('')
    expect(line).not.toContain('Ali')
    expect(line).not.toContain('page=2')
    expect(line).toContain('/api/x?search=[redacted]&page=[redacted]')
    expect(line).toContain('"method":"GET"')
    expect(line).toContain('"statusCode":200')
    expect(line).toContain('responseTime')
    expect(line).toContain('req-1')
  })

  it('censors credential-like keys in bodies and objects', () => {
    const { lines, stream } = capture()
    const log = pino({ redact: { paths: REDACT_PATHS, censor: '[Redacted]' } }, stream)
    log.info({
      req: { body: { newPassword: 'n1', newPasswordConfirmation: 'n2', credential: 'c1', name: 'keep' } },
      other: { currentPassword: 'p1', secret: 's1' },
      credential: 'c2',
    })
    const out = lines.join('')
    for (const v of ['n1', 'n2', 'c1', 'c2', 'p1', 's1']) expect(out).not.toContain(`"${v}"`)
    expect(out).toContain('keep')
    expect(out).toContain('[Redacted]')
  })
})
