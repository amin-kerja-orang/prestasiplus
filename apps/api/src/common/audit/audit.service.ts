import { createHmac } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'

import type { Env } from '../config/env.schema'
import type { TxClient } from '../../db/client'
import { PrismaService } from '../../db/prisma.service'
import { ApiError } from '../errors/api-error'

export interface AuditEventInput {
  /** See `AUDIT_ACTIONS`; any later card adds its own dotted action names. */
  action: string
  /** Decimal-string user id, or null (for example a failed login for an unknown identifier). */
  actorUserId: string | null
  actorRole?: string | null
  /** Internal id of the `sessions` row. There is no column for it, so it is stored in `detail`. */
  sessionRowId?: string | null
  targetType?: string | null
  /** Decimal string or uuid. */
  targetId?: string | null
  /** Decimal-string school id; stored as `scope_school_id`. */
  schoolId?: string | null
  /** Level of the scope the actor acted under (`scope_level`). */
  scopeLevel?: string | null
  requestId?: string | null
  /** Small structured facts. Secret-looking keys and IC numbers are redacted before writing. */
  details?: Record<string, unknown>
  /** Raw client address; only its keyed hash is stored. */
  ip?: string | null
  /** Rows written under Mod Pelajar are test data. */
  isTest?: boolean
  /** Join the caller's transaction (the audit row commits or rolls back with the change it records). */
  tx?: TxClient
}

export const REDACTED = '[redacted]'

// Key names are split on camelCase and non-alphanumerics, then matched as whole words, so
// `sessionCookie`, `csrf_token`, `icNumber` and `kata_laluan` match while `passed`, `bypass`,
// `topic_no` and `logic_hash` do not.
const SECRET_WORDS =
  /(^|_)(pass|password|passwd|pwd|secret|tokens?|cookies?|csrf|authorization|otp|jwt|sid|api_?key|kata_laluan|ic|icnumber|nric|kp|mykad|my_kad)(_|$)/
// IC (MyKad) number inside free text: 6 + 2 + 4 digits, optional "-" or " " separators.
// Decision: a bare 12-digit string that is the WHOLE value is treated as a numeric id (not redacted
// unless its key is secret-looking); a 12-digit run embedded in longer text, or any separated form,
// is redacted. Numeric (non-string) 12-digit values are redacted: ids travel as strings.
const IC_IN_TEXT = /(?<![\w-])\d{6}[- ]?\d{2}[- ]?\d{4}(?![\w-])/g // not inside a uuid or a longer token
const BARE_ID = /^\d{12}$/
const MAX_DEPTH = 4
const DECIMAL = /^\d+$/

function isSecretKey(key: string): boolean {
  const words = key
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1_$2')
    .replace(/([a-z0-9])([A-Z])/g, '$1_$2')
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)
    .join('_')
  return SECRET_WORDS.test(words)
}

function redactText(text: string): string {
  if (BARE_ID.test(text)) return text
  return text.replace(IC_IN_TEXT, REDACTED)
}

/** Remove anything that looks like a credential or an IC number; bigint becomes a string, Date an ISO string. */
export function sanitizeDetails(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return REDACTED
  if (typeof value === 'bigint') return value.toString()
  if (value instanceof Date) return value.toISOString()
  if (Array.isArray(value)) return value.map((v) => sanitizeDetails(v, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = isSecretKey(k) ? REDACTED : sanitizeDetails(v, depth + 1)
    }
    return out
  }
  if (typeof value === 'string') return redactText(value)
  if (typeof value === 'number' && /^\d{12}$/.test(String(value))) return REDACTED
  return value
}

/** Keyed hash of a client address (no raw IP is stored). Uses a key derived from the session secret. */
export function hashIp(ip: string, secret: string): string {
  const key = createHmac('sha256', secret).update('audit-ip').digest()
  return createHmac('sha256', key).update(ip).digest('hex')
}

function badInput(field: string): ApiError {
  // A malformed id here is a programming error of the caller; the message names the field only.
  return ApiError.of('SERVER_ERROR', { message: `Audit input invalid: ${field}` })
}

function toBigInt(value: string | null | undefined, field: string): bigint | null {
  if (value === null || value === undefined) return null
  if (!DECIMAL.test(value)) throw badInput(field)
  return BigInt(value)
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** `targetId` is a pure id field: a decimal id or a uuid, validated and never redacted. */
function toTargetId(value: string | null | undefined): string | null {
  if (value == null) return null
  if (!DECIMAL.test(value) && !UUID.test(value)) throw badInput('targetId')
  return value
}

const text = (v: string | null | undefined): string | null => (v == null ? null : redactText(v))

/** Append-only writer of `audit_events` (no update or delete path exists, G-17). */
@Injectable()
export class AuditService {
  constructor(
    @Inject(PrismaService) private readonly prisma: PrismaService,
    @Inject(ConfigService) private readonly config: ConfigService<Env, true>,
  ) {}

  /**
   * Writes one row. Pass `tx` to join the caller's transaction.
   * It throws when the write fails. Callers on the login-failure path (`auth.login.failed`) must
   * catch and log that error: an audit failure must never change the authentication response
   * (status, code, message or timing class).
   */
  async record(event: AuditEventInput): Promise<void> {
    const detail: Record<string, unknown> = {
      ...((sanitizeDetails(event.details ?? {}) as Record<string, unknown>) ?? {}),
    }
    if (event.sessionRowId) detail.sessionRowId = event.sessionRowId
    const secret = this.config.get('SESSION_SECRET', { infer: true }) as string
    const db = event.tx ?? this.prisma.client
    await db.auditEvent.create({
      data: {
        action: event.action,
        actorUserId: toBigInt(event.actorUserId, 'actorUserId'),
        actorRole: text(event.actorRole),
        scopeLevel: event.scopeLevel ?? null,
        scopeSchoolId: toBigInt(event.schoolId, 'schoolId'),
        targetType: event.targetType ?? null,
        targetId: toTargetId(event.targetId),
        requestId: text(event.requestId),
        detail: Object.keys(detail).length > 0 ? (detail as object) : undefined,
        ipHash: event.ip ? hashIp(event.ip, secret) : null,
        isTest: event.isTest ?? false,
      },
    })
  }
}
