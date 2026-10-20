import type { INestApplication } from '@nestjs/common'
import type { Server } from 'node:http'

export interface GracefulShutdownOptions {
  /** Hard limit; after it the process exits 1 even if requests are still open. */
  graceMs: number
  signals?: NodeJS.Signals[]
  exit?: (code: number) => void
  log?: (message: string) => void
}

/**
 * SIGTERM/SIGINT handling in the order that keeps in-flight requests safe:
 * 1. stop accepting connections and close idle keep-alive sockets (`server.close`), and WAIT until in-flight
 *    requests have finished (the pool is still open, so they can still query);
 * 2. only then `app.close()` (module destroy hooks: Prisma pool);
 * 3. exit 0. An unref'd timer exits 1 after `graceMs` if draining hangs.
 * Used instead of `app.enableShutdownHooks()`: Nest's own hook would destroy modules (and the pool) first.
 * Returns the shutdown function (also callable directly) and a disposer for the signal listeners.
 */
export function installGracefulShutdown(app: INestApplication, options: GracefulShutdownOptions) {
  const exit = options.exit ?? ((code: number) => process.exit(code))
  const log = options.log ?? (() => undefined)
  const signals = options.signals ?? ['SIGTERM', 'SIGINT']
  let running: Promise<void> | undefined

  const shutdown = (signal: string): Promise<void> => {
    if (running) return running
    log(`${signal} received: draining (max ${options.graceMs} ms)`)
    const hard = setTimeout(() => {
      log('graceful shutdown timed out; forcing exit 1')
      exit(1)
    }, options.graceMs)
    hard.unref()
    running = (async () => {
      try {
        const server = app.getHttpServer() as Server
        const drained = new Promise<void>((resolveDrain) => {
          server.close(() => resolveDrain()) // callback also fires (with an error) when it was not listening
        })
        // Keep-alive sockets that become idle once their response is written would hold close() open.
        const sweep = setInterval(() => server.closeIdleConnections(), 100)
        sweep.unref()
        server.closeIdleConnections()
        await drained
        clearInterval(sweep)
        await app.close()
        clearTimeout(hard)
        exit(0)
      } catch (err) {
        log(`graceful shutdown failed: ${err instanceof Error ? err.message : 'unknown'}`)
        clearTimeout(hard)
        exit(1)
      }
    })()
    return running
  }

  const handlers = signals.map((sig) => {
    const handler = () => void shutdown(sig)
    process.on(sig, handler)
    return [sig, handler] as const
  })
  return {
    shutdown,
    dispose() {
      for (const [sig, handler] of handlers) process.off(sig, handler)
    },
  }
}
