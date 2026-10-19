import type { CookieOptions, Request, Response } from 'express'

import type { AuthConfig } from './auth.config'
import { SESSION_TOKEN_SHAPE } from './tokens'

/** Reads one cookie from the raw header (no cookie-parser dependency). */
export function readCookie(req: Request, name: string): string | undefined {
  const header = req.headers.cookie
  if (!header) return undefined
  for (const part of header.split(';')) {
    const eq = part.indexOf('=')
    if (eq < 0) continue
    if (part.slice(0, eq).trim() !== name) continue
    try {
      return decodeURIComponent(part.slice(eq + 1).trim())
    } catch {
      return undefined
    }
  }
  return undefined
}

/** The session token from the request cookie, or undefined when absent or malformed. */
export function sessionTokenOf(req: Request, config: AuthConfig): string | undefined {
  const value = readCookie(req, config.cookieName)
  return value && SESSION_TOKEN_SHAPE.test(value) ? value : undefined
}

function baseOptions(config: AuthConfig): CookieOptions {
  return {
    httpOnly: true,
    secure: config.cookieSecure,
    sameSite: 'lax',
    path: '/',
    ...(config.cookieDomain ? { domain: config.cookieDomain } : {}),
  }
}

/** Sets the session cookie; it lives until `expiresAt` (re-sent when a sliding session moves). */
export function setSessionCookie(
  res: Response,
  config: AuthConfig,
  token: string,
  expiresAt: Date,
  now: Date,
): void {
  res.cookie(config.cookieName, token, {
    ...baseOptions(config),
    maxAge: Math.max(0, expiresAt.getTime() - now.getTime()),
  })
}

export function clearSessionCookie(res: Response, config: AuthConfig): void {
  res.clearCookie(config.cookieName, baseOptions(config))
}
