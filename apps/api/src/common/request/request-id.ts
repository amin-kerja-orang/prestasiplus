import { randomUUID } from 'node:crypto'

import type { NextFunction, Request, Response } from 'express'

export const REQUEST_ID_HEADER = 'X-Request-Id'
const SAFE_ID = /^[A-Za-z0-9._-]{1,128}$/

/** Take `X-Request-Id` when it is a short safe token, else generate a UUID. */
export function resolveRequestId(header: string | string[] | undefined): string {
  const candidate = Array.isArray(header) ? header[0] : header
  return candidate && SAFE_ID.test(candidate) ? candidate : randomUUID()
}

type WithId = Request & { id?: unknown }

export function requestIdOf(req: Request): string | undefined {
  const id = (req as WithId).id
  return id === undefined || id === null ? undefined : String(id)
}

/** Express middleware: sets `req.id` and echoes the id in the response header. */
export function requestIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const id = resolveRequestId(req.headers['x-request-id'])
  ;(req as WithId).id = id
  res.setHeader(REQUEST_ID_HEADER, id)
  next()
}
