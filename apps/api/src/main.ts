import 'reflect-metadata'

import { NestFactory } from '@nestjs/core'
import type { NestExpressApplication } from '@nestjs/platform-express'
import { ConfigService } from '@nestjs/config'
import { Logger } from 'nestjs-pino'

import { AppModule } from './app.module'
import type { Env } from './common/config/env.schema'
import { configureApp } from './configure-app'

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { bufferLogs: true })
  app.disable('x-powered-by')
  configureApp(app)
  app.enableShutdownHooks()
  const port = app.get(ConfigService<Env, true>).get('PORT', { infer: true })
  await app.listen(port, '0.0.0.0')
  app.get(Logger).log(`API listening on port ${port}`)
}

bootstrap().catch((err: unknown) => {
  // Config errors name the offending key; never print secrets (only keys and messages).
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
