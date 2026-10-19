import type { INestApplication } from '@nestjs/common'
import { Logger } from 'nestjs-pino'

import { requestIdMiddleware } from './common/request/request-id'

/** Cross-cutting setup shared by `main.ts` and the tests: prefix, request id, logger. */
export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api')
  app.use(requestIdMiddleware) // before pino-http, so `req.id` is set when it logs
  app.useLogger(app.get(Logger))
}
