import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto'

/** Opaque session token: 256 random bits, URL-safe (43 characters). Only its hash is stored. */
export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export const SESSION_TOKEN_SHAPE = /^[A-Za-z0-9_-]{43}$/

export function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

/** Keyed hash with a domain label, so one key serves several unrelated purposes safely. */
export function hmacHex(secret: string, label: string, value: string): string {
  return createHmac('sha256', secret).update(`${label}:${value}`).digest('hex')
}

/**
 * The CSRF token is derived from the session token and the server secret, so `GET /session` can
 * return it again without the raw value ever being stored (the row keeps only its SHA-256).
 */
export function deriveCsrf(secret: string, sessionToken: string): string {
  return createHmac('sha256', secret).update(`csrf:${sessionToken}`).digest('base64url')
}

export function safeEqualHex(a: string, b: string): boolean {
  const x = Buffer.from(a)
  const y = Buffer.from(b)
  return x.length === y.length && timingSafeEqual(x, y)
}
