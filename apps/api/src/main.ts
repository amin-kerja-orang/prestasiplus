import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { ConfigService } from '@nestjs/config'
import { Logger } from 'nestjs-pino'

import { AppModule } from './app.module'
import type { Env } from './common/config/env.schema'
import { installGracefulShutdown } from './common/health/graceful-shutdown'
import { applyServerTimeouts, resolveServerTimeouts } from './common/health/server-timeouts'
import { configureApp } from './configure-app'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true })
  app.disable('x-powered-by')
  configureApp(app)
  const config = app.get(ConfigService<Env, true>)
  const timeouts = resolveServerTimeouts({
    REQUEST_TIMEOUT_MS: config.get('REQUEST_TIMEOUT_MS', { infer: true }),
    HEADERS_TIMEOUT_MS: config.get('HEADERS_TIMEOUT_MS', { infer: true }),
    KEEP_ALIVE_TIMEOUT_MS: config.get('KEEP_ALIVE_TIMEOUT_MS', { infer: true }),
    SHUTDOWN_GRACE_MS: config.get('SHUTDOWN_GRACE_MS', { infer: true }),
  })
  const logger = app.get(Logger)
  // Not app.enableShutdownHooks(): Nest would close the modules (and the DB pool) before in-flight requests finish.
  installGracefulShutdown(app, { graceMs: timeouts.shutdownGraceMs, log: (m) => logger.log(m) })
  const port = config.get('PORT', { infer: true })
  await app.listen(port, '0.0.0.0')
  applyServerTimeouts(app.getHttpServer(), timeouts)
  logger.log(`API listening on port ${port}`)
}

bootstrap().catch((err: unknown) => {
  // Config errors name the offending key; never print secrets (only keys and messages).
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
