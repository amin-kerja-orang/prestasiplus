/**
 * Contract: every id in a PKSK admin request body is a decimal string (`idInput` in
 * packages/contract/src/pksk/admin.ts: PkskAdminQuestionCreateSchema, PkskAdminQuestionUpdateSchema,
 * PkskAdminBulkRequestSchema, PkskAdminAccessGrantSchema); a number is 422. The adapter sends strings in
 * http mode even when a caller holds a number. The transport is stubbed.
 */
import {
  PkskAdminAccessGrantSchema,
  PkskAdminBulkRequestSchema,
  PkskAdminQuestionCreateSchema,
  PkskAdminQuestionUpdateSchema,
} from '@pp/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installTransport } from '@/api'
import type { Transport, TransportRequest } from '@/api'

import {
  bulkPkskQuestions,
  createPkskQuestion,
  grantPkskAccess,
  updatePkskQuestion,
} from '../../api/admin'

const sent: TransportRequest[] = []

beforeEach(() => {
  sent.length = 0
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      if (req.method === 'GET' && req.url === '/api/session') {
        return Promise.resolve({ status: 200, headers: {}, body: { data: { csrf: 'c' } } })
      }
      sent.push(req)
      return Promise.resolve({ status: 200, headers: {}, body: { data: {}, status: 'ok' } })
    }),
  }
  installTransport(transport)
})
afterEach(() => {
  vi.unstubAllEnvs()
})

const body = (): Record<string, unknown> => sent[sent.length - 1]!.body as Record<string, unknown>

const create = {
  bahagian: 'B' as const,
  pkskTargetLevel: 'T1' as const,
  questionText: '2 + 2?',
  difficultyLevel: 3,
  options: [
    { text: '3', isCorrect: false },
    { text: '4', isCorrect: true },
  ],
}

describe('http mode: PKSK admin body ids are strings', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'http')
  })

  it('createPkskQuestion sends pkskDomainId as a string (numeric input)', async () => {
    await createPkskQuestion({ ...create, pkskDomainId: 2 })
    expect(body().pkskDomainId).toBe('2')
    expect(PkskAdminQuestionCreateSchema.safeParse(body()).success).toBe(true)
  })

  it('createPkskQuestion keeps a string pkskDomainId (large id, no precision loss)', async () => {
    await createPkskQuestion({ ...create, pkskDomainId: '9007199254740993' })
    expect(body().pkskDomainId).toBe('9007199254740993')
  })

  it('updatePkskQuestion sends pkskDomainId as a string', async () => {
    await updatePkskQuestion(55, {
      pkskDomainId: 2,
      pkskTargetLevel: 'T4',
      status: 'approved',
      questionText: 'Teks',
    })
    expect(body().pkskDomainId).toBe('2')
    expect(PkskAdminQuestionUpdateSchema.safeParse(body()).success).toBe(true)
  })

  it('bulkPkskQuestions sends ids as string[] (F3 bulk)', async () => {
    await bulkPkskQuestions('approve', [1, 3])
    expect(body()).toEqual({ action: 'approve', ids: ['1', '3'] })
    expect(PkskAdminBulkRequestSchema.safeParse(body()).success).toBe(true)
  })

  it('grantPkskAccess sends userId and packageId as strings', async () => {
    await grantPkskAccess({ userId: 3, packageId: 2, expiresAt: null })
    expect(body()).toMatchObject({ userId: '3', packageId: '2' })
    expect(PkskAdminAccessGrantSchema.safeParse(body()).success).toBe(true)
  })
})

describe('mock mode: the value is kept as given', () => {
  it('grantPkskAccess', async () => {
    await grantPkskAccess({ userId: 3, packageId: 2, expiresAt: null })
    expect(body()).toMatchObject({ userId: 3, packageId: 2 })
  })
})
