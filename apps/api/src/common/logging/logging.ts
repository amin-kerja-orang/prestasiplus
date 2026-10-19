import type { Env } from '../config/env.schema'

/** Paths whose values must never reach a log line. */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  'res.headers["set-cookie"]',
  'req.body.password',
  '*.password',
  'password',
  'cookie',
  'authorization',
]

type WithId = { id?: unknown }

/** pino-http options (JSON to stdout; the container filesystem is read-only, so no log files). */
export function pinoHttpOptions(env: Pick<Env, 'LOG_LEVEL'>) {
  return {
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
    // `req.id` is set by the request-id middleware before pino-http runs.
    genReqId: (req: WithId) => String(req.id),
    customProps: (req: WithId) => ({ requestId: String(req.id) }),
  }
}
