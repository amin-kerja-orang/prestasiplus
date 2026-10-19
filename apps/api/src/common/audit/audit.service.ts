import { createHmac } from 'node:crypto'

import { Inject, Injectable } from '@nestjs/common'

import { PrismaService } from '../../db/prisma.service'

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
  /** Small structured facts. Secret-looking keys and IC-shaped values are redacted before writing. */
  details?: Record<string, unknown>
  /** Raw client address; only its keyed hash is stored. */
  ip?: string | null
  /** Rows written under Mod Pelajar are test data. */
  isTest?: boolean
}

const SECRET_KEY = /pass(word)?|secret|token|cookie|csrf|authorization|\bic\b|ic_?(no|number|hash)|nric|mykad/i
const IC_VALUE = /^\d{6}-?\d{2}-?\d{4}$/
const DECIMAL = /^\d+$/
const MAX_DEPTH = 4
export const REDACTED = '[redacted]'

/** Remove anything that looks like a credential or an IC number from a details object. */
export function sanitizeDetails(value: unknown, depth = 0): unknown {
  if (depth > MAX_DEPTH) return REDACTED
  if (Array.isArray(value)) return value.map((v) => sanitizeDetails(v, depth + 1))
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value)) {
      out[k] = SECRET_KEY.test(k) ? REDACTED : sanitizeDetails(v, depth + 1)
    }
    return out
  }
  if (typeof value === 'string' && IC_VALUE.test(value)) return REDACTED
  return value
}

/** Keyed hash of a client address (no raw IP is stored). The key is `SESSION_SECRET` when set. */
export function hashIp(ip: string): string {
  const key = process.env.SESSION_SECRET || 'pp-dev-ip-hash-key'
  return createHmac('sha256', key).update(ip).digest('hex')
}

function toBigInt(value: string | null | undefined, field: string): bigint | null {
  if (value === null || value === undefined) return null
  if (!DECIMAL.test(value)) throw new Error(`audit: ${field} must be a decimal string`)
  return BigInt(value)
}

/** Append-only writer of `audit_events` (no update or delete path exists, G-17). */
@Injectable()
export class AuditService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  async record(event: AuditEventInput): Promise<void> {
    const detail: Record<string, unknown> = {
      ...((sanitizeDetails(event.details ?? {}) as Record<string, unknown>) ?? {}),
    }
    if (event.sessionRowId) detail.sessionRowId = event.sessionRowId
    await this.prisma.client.auditEvent.create({
      data: {
        action: event.action,
        actorUserId: toBigInt(event.actorUserId, 'actorUserId'),
        actorRole: event.actorRole ?? null,
        scopeLevel: event.scopeLevel ?? null,
        scopeSchoolId: toBigInt(event.schoolId, 'schoolId'),
        targetType: event.targetType ?? null,
        targetId: event.targetId ?? null,
        requestId: event.requestId ?? null,
        detail: Object.keys(detail).length > 0 ? (detail as object) : undefined,
        ipHash: event.ip ? hashIp(event.ip) : null,
        isTest: event.isTest ?? false,
      },
    })
  }
}
