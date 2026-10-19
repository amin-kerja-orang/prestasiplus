import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../../openapi'
import { RateLimitedBodySchema } from '../../subscriptions/validation'
import { PARENT_INVITE_COMPONENT_SCHEMAS } from '../paths'
import {
  PARENT_INVITE_MESSAGES,
  PARENT_INVITE_TTL_DAYS,
  ParentInviteAcceptRequestSchema,
  ParentInviteAcceptResultSchema,
  ParentInviteGeneratedSchema,
  ParentInvitePreviewSchema,
  ParentInviteStatusSchema,
  ParentLinkSchema,
} from '../schema'

const T = '2026-10-16T09:30:00+08:00'
const token = 'a'.repeat(64)
const parent = { linkId: '11', id: '8', name: 'Ibu Ujian', emailMasked: 'i***@example.test', relationship: null, linkedAt: T }

type Doc = {
  paths: Record<string, Record<string, { responses: Record<string, { headers?: Record<string, unknown> }> }>>
  components: { schemas: Record<string, unknown> }
}

describe('BE-25 parent invite contract', () => {
  it('parses the payloads', () => {
    expect(ParentInviteStatusSchema.safeParse({ hasToken: true, createdAt: T, expiresAt: '2026-10-23T09:30:00+08:00', parents: [parent] }).success).toBe(true)
    expect(ParentInviteStatusSchema.safeParse({ hasToken: false, createdAt: null, expiresAt: null, parents: [] }).success).toBe(true)
    expect(ParentInviteGeneratedSchema.safeParse({ token, createdAt: T, expiresAt: T, status: PARENT_INVITE_MESSAGES.regenerated }).success).toBe(true)
    expect(ParentInvitePreviewSchema.safeParse({ valid: true, student: { firstName: 'Murid', schoolName: null }, viewer: 'guest' }).success).toBe(true)
    expect(
      ParentInviteAcceptResultSchema.safeParse({
        linked: true,
        created: false,
        linkId: '11',
        student: { id: '5', name: 'Murid Ujian', schoolName: 'SK Contoh' },
        parent: { name: 'Ibu Ujian' },
        relationship: 'Ibu',
        acceptedAt: T,
      }).success,
    ).toBe(true)
    expect(
      ParentLinkSchema.safeParse({
        linkId: '11',
        parent: { id: '8', name: 'Ibu Ujian', emailMasked: 'i***@example.test' },
        student: { id: '5', name: 'Murid Ujian', schoolName: null },
        relationship: null,
        linkedAt: T,
      }).success,
    ).toBe(true)
    expect(ParentInviteAcceptRequestSchema.safeParse({}).success).toBe(true)
    expect(PARENT_INVITE_TTL_DAYS).toBe(7)
  })

  it('rejects invalid payloads and never shows a clear parent e-mail or the full child name on the preview', () => {
    expect(ParentInviteGeneratedSchema.safeParse({ token, createdAt: T, expiresAt: T, status: 'lain' }).success).toBe(false)
    const status = { hasToken: true, createdAt: T, expiresAt: T, parents: [] }
    // GET /me/parent-invite never carries a token
    expect(ParentInviteStatusSchema.safeParse({ ...status, token }).success).toBe(false)
    expect(ParentInviteStatusSchema.safeParse({ ...status, parents: [{ ...parent, emailMasked: 'ibu@example.test' }] }).success).toBe(false)
    expect(ParentInviteGeneratedSchema.safeParse({ token: 'xyz', createdAt: T, expiresAt: T, status: PARENT_INVITE_MESSAGES.regenerated }).success).toBe(false)
    expect(ParentInvitePreviewSchema.safeParse({ valid: false, student: { firstName: 'a', schoolName: null }, viewer: 'guest' }).success).toBe(false)
    expect(ParentInvitePreviewSchema.safeParse({ valid: true, student: { firstName: 'a', schoolName: null }, viewer: 'admin' }).success).toBe(false)
    const preview = ParentInvitePreviewSchema.parse({ valid: true, student: { firstName: 'Murid', schoolName: null, name: 'Murid Penuh', initials: 'MP' }, viewer: 'guest' })
    expect(Object.keys(preview.student).sort()).toEqual(['firstName', 'schoolName'])
    expect(ParentInviteAcceptRequestSchema.safeParse({ relationship: '' }).success).toBe(false)
    expect(ParentInviteStatusSchema.safeParse({ ...status, createdAt: '2026-10-16T01:30:00Z' }).success).toBe(false)
  })

  it('models the 429 body', () => {
    expect(RateLimitedBodySchema.safeParse({ error: { code: 'RATE_LIMITED', message: 'Terlalu banyak percubaan.', retryAfter: 30 } }).success).toBe(true)
    expect(RateLimitedBodySchema.safeParse({ error: { code: 'RATE_LIMITED', message: 'x' } }).success).toBe(false)
  })

  it('registers the paths, 429 and no-store in the OpenAPI document', () => {
    const doc = buildOpenApiDocument() as unknown as Doc
    const ops: [string, string][] = [
      ['/me/parent-invite', 'get'],
      ['/parent-invites/{token}', 'get'],
      ['/parent-invites/{token}/accept', 'post'],
      ['/me/parent-links', 'get'],
      ['/me/parent-links/{linkId}', 'delete'],
      ['/admin/parent-links', 'get'],
      ['/admin/parent-links/{linkId}', 'delete'],
    ]
    expect(doc.paths['/me/parent-invite/generate']).toBeUndefined()
    expect(doc.paths['/me/parent-invite']?.post).toBeDefined()
    for (const [path, method] of ops) expect(doc.paths[path]?.[method], `${method} ${path}`).toBeDefined()
    for (const [path, method] of [
      ['/me/parent-invite', 'post'],
      ['/parent-invites/{token}', 'get'],
      ['/parent-invites/{token}/accept', 'post'],
      ['/me/parent-links/{linkId}', 'delete'],
      ['/admin/parent-links/{linkId}', 'delete'],
    ] as const) {
      const r = doc.paths[path]![method]!.responses['429']
      expect(r, `429 ${path}`).toBeDefined()
      expect(Object.keys(r!.headers ?? {}), `Retry-After ${path}`).toContain('Retry-After')
    }
    for (const [path, method] of [
      ['/me/parent-invite', 'get'],
      ['/me/parent-invite', 'post'],
      ['/parent-invites/{token}', 'get'],
    ] as const) expect(Object.keys(doc.paths[path]![method]!.responses['200']!.headers ?? {})).toContain('Cache-Control')
    for (const name of Object.keys(PARENT_INVITE_COMPONENT_SCHEMAS)) expect(doc.components.schemas[name], name).toBeDefined()
  })
})
