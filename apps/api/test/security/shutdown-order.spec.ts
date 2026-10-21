import { createServer } from 'node:http'

import type { INestApplication } from '@nestjs/common'
import { afterEach, describe, expect, it } from 'vitest'

import { installGracefulShutdown, shutdownState } from '../../src/common/health/graceful-shutdown'
import { ReadyService } from '../../src/common/health/ready.service'

/** BE-33 G4 minors 3 and 8: job poller stops before the HTTP drain; readiness 503 while draining; a second signal exits 1. */
function fakeApp(events: string[]) {
  const server = createServer()
  const close = server.close.bind(server)
  server.close = ((cb?: (err?: Error) => void) => {
    events.push('server.close')
    return close(cb)
  }) as typeof server.close
  return {
    getHttpServer: () => server,
    close: () => {
      events.push('app.close')
      return Promise.resolve()
    },
  } as unknown as INestApplication
}

describe('graceful shutdown order (unit)', () => {
  afterEach(() => {
    shutdownState.draining = false
  })

  it('runs beforeDrain (job poller stop) before server.close, waits for it, then app.close and exit 0', async () => {
    const events: string[] = []
    const codes: number[] = []
    let release!: () => void
    const jobsDone = new Promise<void>((r) => (release = r))
    const s = installGracefulShutdown(fakeApp(events), {
      graceMs: 10_000,
      signals: [],
      exit: (c) => codes.push(c),
      beforeDrain: async () => {
        events.push('jobs.stop')
        await jobsDone
        events.push('jobs.drained')
      },
    })
    const done = s.shutdown('SIGTERM')
    expect(shutdownState.draining).toBe(true)
    await new Promise((r) => setTimeout(r, 50))
    expect(events).toEqual(['jobs.stop', 'server.close']) // app.close waits for the running job
    release()
    await done
    expect(events).toEqual(['jobs.stop', 'server.close', 'jobs.drained', 'app.close'])
    expect(codes).toEqual([0])
  })

  it('a failing beforeDrain is logged and the shutdown still exits 0', async () => {
    const logs: string[] = []
    const codes: number[] = []
    const s = installGracefulShutdown(fakeApp([]), {
      graceMs: 10_000,
      signals: [],
      exit: (c) => codes.push(c),
      log: (m) => logs.push(m),
      beforeDrain: () => {
        throw new TypeError('no worker')
      },
    })
    await s.shutdown('SIGTERM')
    expect(codes).toEqual([0])
    expect(logs.join('\n')).toContain('before-drain step failed: TypeError')
  })

  it('a second signal while draining forces exit 1', async () => {
    const codes: number[] = []
    let release!: () => void
    const hold = new Promise<void>((r) => (release = r))
    const s = installGracefulShutdown(fakeApp([]), { graceMs: 10_000, signals: ['SIGUSR2'], exit: (c) => codes.push(c), beforeDrain: () => hold })
    try {
      process.emit('SIGUSR2')
      await new Promise((r) => setTimeout(r, 20))
      expect(codes).toEqual([])
      process.emit('SIGUSR2')
      expect(codes).toEqual([1])
    } finally {
      release()
      s.dispose()
    }
  })

  it('GET /api/ready reports not ready while draining, without touching the database', async () => {
    const ready = new ReadyService({} as never) // any DB access would throw
    shutdownState.draining = true
    await expect(ready.check()).resolves.toEqual({ ok: false, reason: 'shutting down' })
  })
})
