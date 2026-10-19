import 'reflect-metadata'

import { Controller, Get, Post, Body, Query, type Type } from '@nestjs/common'
import type { INestApplication } from '@nestjs/common'
import { Test } from '@nestjs/testing'
import { LoginRequestSchema } from '@pp/contract'
import { Writable } from 'node:stream'
import { z } from 'zod'

import { type AppModuleOptions, defineAppModule } from '../../src/app.module'
import { ZodValidationPipe } from '../../src/common/validation/zod-validation.pipe'
import { configureApp } from '../../src/configure-app'

/** Test-only controller (never registered in production). */
@Controller('_test')
export class TestController {
  @Post('login')
  login(@Body(new ZodValidationPipe(LoginRequestSchema)) body: z.infer<typeof LoginRequestSchema>) {
    return { data: { identifier: body.identifier } }
  }

  @Get('query')
  query(@Query(new ZodValidationPipe(z.object({ n: z.coerce.number().int() }))) q: { n: number }) {
    return { data: q }
  }

  @Get('boom')
  boom(): never {
    throw new Error('secret internal failure at /srv/app/db.ts')
  }
}

/** Collects JSON log lines written by pino. */
export class LogCapture extends Writable {
  readonly lines: string[] = []
  override _write(chunk: Buffer | string, _enc: BufferEncoding, cb: (err?: Error | null) => void) {
    this.lines.push(...chunk.toString().split('\n').filter(Boolean))
    cb()
  }
}

export async function createTestApp(
  opts: AppModuleOptions & { modules?: Type<unknown>[]; controllers?: Type<unknown>[] } = {},
): Promise<INestApplication> {
  const { modules = [], controllers = [TestController], ...rest } = opts
  const moduleRef = await Test.createTestingModule({
    imports: [defineAppModule(modules, rest)],
    controllers,
  }).compile()
  const app = moduleRef.createNestApplication({ bufferLogs: false })
  configureApp(app)
  await app.init()
  return app
}
