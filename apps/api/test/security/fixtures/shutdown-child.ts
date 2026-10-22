// Child process of shutdown.spec.ts: a minimal Nest app with a slow route, stopped with the production shutdown helper.
import 'reflect-metadata'

import { Controller, Get, Module } from '@nestjs/common'
import { NestFactory } from '@nestjs/core'

import { installGracefulShutdown } from '../../../src/common/health/graceful-shutdown'

const SLOW_MS = Number(process.env.SLOW_MS ?? 800)
const GRACE_MS = Number(process.env.GRACE_MS ?? 5000)

@Controller()
class SlowController {
  @Get('slow')
  async slow(): Promise<{ data: { done: true; waitedMs: number } }> {
    await new Promise((r) => setTimeout(r, SLOW_MS))
    return { data: { done: true, waitedMs: SLOW_MS } }
  }

  @Get('hang')
  async hang(): Promise<never> {
    return new Promise<never>(() => undefined)
  }
}

@Module({ controllers: [SlowController] })
class ChildModule {
  onModuleDestroy(): void {
    process.stdout.write('module-destroyed\n')
  }
}

async function main(): Promise<void> {
  const app = await NestFactory.create(ChildModule, { logger: false })
  installGracefulShutdown(app, { graceMs: GRACE_MS, log: (m) => process.stdout.write(`${m}\n`) })
  await app.listen(0, '127.0.0.1')
  const address = app.getHttpServer().address() as { port: number }
  process.stdout.write(`listening ${address.port}\n`)
}

void main()
