import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import {
  ACCESS_MODES,
  ErrorBodySchema,
  IdSchema,
  ListMetaSchema,
  ROLE_CODES,
  RoleCodeSchema,
  TimestampInputSchema,
  TimestampSchema,
  DateOnlySchema,
  envelopeOf,
  listEnvelopeOf,
  PageQuerySchema,
} from '../index'
import { buildOpenApiDocument, serializeOpenApi } from '../openapi'
import { z } from 'zod'

describe('ids', () => {
  it('accepts opaque strings and rejects numbers and empty strings', () => {
    expect(IdSchema.safeParse('1042').success).toBe(true)
    expect(IdSchema.safeParse(1042).success).toBe(false)
    expect(IdSchema.safeParse('').success).toBe(false)
  })
})

describe('timestamps', () => {
  it('requires the +08:00 offset on responses', () => {
    expect(TimestampSchema.safeParse('2026-10-16T09:30:00+08:00').success).toBe(true)
    expect(TimestampSchema.safeParse('2026-10-16T09:30:00.123+08:00').success).toBe(true)
    expect(TimestampSchema.safeParse('2026-10-16T01:30:00Z').success).toBe(false)
    expect(TimestampSchema.safeParse('2026-10-16T09:30:00').success).toBe(false)
    expect(TimestampSchema.safeParse('2026-10-16T09:30:00+07:00').success).toBe(false)
  })
  it('accepts any offset on requests', () => {
    expect(TimestampInputSchema.safeParse('2026-10-16T01:30:00Z').success).toBe(true)
    expect(TimestampInputSchema.safeParse('not a date').success).toBe(false)
  })
  it('validates date-only values', () => {
    expect(DateOnlySchema.safeParse('2026-10-16').success).toBe(true)
    expect(DateOnlySchema.safeParse('16/10/2026').success).toBe(false)
  })
})

describe('error body', () => {
  it('accepts the SRS 7.3 shape and the additions', () => {
    const body = {
      error: {
        code: 'RATE_LIMITED',
        message: 'Terlalu banyak percubaan.',
        retryAfter: 30,
        requestId: 'r-1',
      },
    }
    expect(ErrorBodySchema.parse(body)).toEqual(body)
    expect(
      ErrorBodySchema.safeParse({
        error: { code: 'VALIDATION_ERROR', message: 'x', fields: { email: 'wajib' } },
      }).success,
    ).toBe(true)
  })
  it('rejects a missing message or a bare error', () => {
    expect(ErrorBodySchema.safeParse({ error: { code: 'X' } }).success).toBe(false)
    expect(ErrorBodySchema.safeParse({ code: 'X', message: 'y' }).success).toBe(false)
  })
})

describe('list meta and envelopes', () => {
  const meta = { page: 1, pageSize: 20, totalItems: 0, totalPages: 1, from: null, to: null }
  it('accepts an empty page and module aggregates', () => {
    expect(ListMetaSchema.safeParse(meta).success).toBe(true)
    expect(ListMetaSchema.parse({ ...meta, averageScore: 71 })).toMatchObject({ averageScore: 71 })
  })
  it('rejects page 0 and negative totals', () => {
    expect(ListMetaSchema.safeParse({ ...meta, page: 0 }).success).toBe(false)
    expect(ListMetaSchema.safeParse({ ...meta, totalItems: -1 }).success).toBe(false)
  })
  it('builds typed envelopes', () => {
    expect(envelopeOf(IdSchema).safeParse({ data: 'a' }).success).toBe(true)
    expect(envelopeOf(IdSchema).safeParse({ data: 1 }).success).toBe(false)
    expect(listEnvelopeOf(z.string()).safeParse({ data: ['a'], meta }).success).toBe(true)
    expect(listEnvelopeOf(z.string()).safeParse({ data: ['a'] }).success).toBe(false)
  })
  it('coerces and bounds page queries', () => {
    expect(PageQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 })
    expect(PageQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({ page: 3, pageSize: 50 })
    expect(PageQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false)
  })
})

describe('enums', () => {
  it('lists the seven roles of the architecture doc', () => {
    expect([...ROLE_CODES].sort()).toEqual(
      ['admin', 'parent', 'ppd_officer', 'school_admin', 'sponsor', 'student', 'teacher'].sort(),
    )
    expect(RoleCodeSchema.safeParse('jpn_officer').success).toBe(false)
    expect(ACCESS_MODES).toEqual(['F', 'R', 'S', 'D'])
  })
})

describe('role codes vs the app session store', () => {
  it('matches the Role union in src/stores/session-types.ts (minus legacy jpn_officer)', () => {
    const src = readFileSync(
      fileURLToPath(new URL('../../../../src/stores/session-types.ts', import.meta.url)),
      'utf8',
    )
    const union = /export type Role =([\s\S]*?)\r?\n\r?\n/.exec(src)?.[1] ?? ''
    const appRoles = [...union.matchAll(/'([a-z_]+)'/g)].map((m) => m[1])
    expect(appRoles.length).toBeGreaterThan(0)
    // jpn_officer is removed by V2-T09 (D31a: one PPD/JPN role); everything else must match.
    expect([...ROLE_CODES].sort()).toEqual(appRoles.filter((r) => r !== 'jpn_officer').sort())
  })
})

describe('OpenAPI emit', () => {
  it('is OpenAPI 3.1 with the shared components', () => {
    const doc = buildOpenApiDocument() as {
      openapi: string
      components: { schemas: Record<string, unknown> }
    }
    expect(doc.openapi).toBe('3.1.0')
    for (const name of ['Id', 'Timestamp', 'ErrorBody', 'ListMeta', 'RoleCode'])
      expect(doc.components.schemas).toHaveProperty(name)
  })
  it('is deterministic', () => {
    expect(serializeOpenApi()).toBe(serializeOpenApi())
  })
  it('matches the committed openapi.json (run `npm run contract:emit` after schema changes)', () => {
    const committed = readFileSync(
      fileURLToPath(new URL('../../openapi.json', import.meta.url)),
      'utf8',
    ).replace(/\r\n/g, '\n')
    expect(committed).toBe(serializeOpenApi())
  })
})
