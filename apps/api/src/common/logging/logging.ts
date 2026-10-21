import { stdSerializers } from 'pino'

import type { Env } from '../config/env.schema'

/** Paths whose values must never reach a log line. */
export const REDACT_PATHS = [
  'req.headers.cookie',
  'req.headers.authorization',
  'req.headers["x-csrf-token"]',
  // Shared secret of the edge proxy; the client-ip middleware already deletes it, this is belt and braces.
  'req.headers["x-pp-edge-secret"]',
  // The SPA invite URL (and so the parent invite token) can arrive as the Referer.
  'req.headers.referer',
  'req.params.token',
  'res.headers["set-cookie"]',
  'req.body.password',
  '*.password',
  'password',
  'cookie',
  'authorization',
]

type WithId = { id?: unknown }

/**
 * Bearer secrets that travel in a URL path: a parent invite token (any case, with or without a trailing
 * path or query). Every logged form of the URL goes through `redactUrl`.
 */
const PATH_SECRET = /(parent-invites\/)[0-9a-f]{64}/gi
export const redactUrl = (url: string): string => url.replace(PATH_SECRET, '$1[redacted]')

type SerializedReq = { url?: unknown; originalUrl?: unknown; [key: string]: unknown }

/** pino's standard `req` serializer with the URL rewritten (`url`, `originalUrl`) and without `params`. */
export function serializeReq(req: object): SerializedReq {
  const out = stdSerializers.req(req as Parameters<typeof stdSerializers.req>[0]) as unknown as SerializedReq
  if (typeof out.url === 'string') out.url = redactUrl(out.url)
  if (typeof out.originalUrl === 'string') out.originalUrl = redactUrl(out.originalUrl)
  // Route params repeat the URL path (Express 5 puts the path segments in `params.splat`): drop them.
  delete out.params
  return out
}

/** Health probes (Docker healthcheck, load balancer) are not access-logged. */
export function isHealthRequest(req: object): boolean {
  const path = ((req as { url?: string }).url ?? '').split('?')[0]
  return path === '/api/health' || path === '/health'
}

/** pino-http options (JSON to stdout; the container filesystem is read-only, so no log files). */
export function pinoHttpOptions(env: Pick<Env, 'LOG_LEVEL'>) {
  return {
    level: env.LOG_LEVEL,
    redact: { paths: REDACT_PATHS, censor: '[Redacted]' },
    serializers: { req: serializeReq },
    // `req.id` is set by the request-id middleware before pino-http runs.
    genReqId: (req: WithId) => String(req.id),
    autoLogging: { ignore: isHealthRequest },
    customProps: (req: WithId) => ({ requestId: String(req.id) }),
  }
}
