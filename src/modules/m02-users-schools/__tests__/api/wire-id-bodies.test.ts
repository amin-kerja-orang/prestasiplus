/**
 * SWX-2 hardening: the id fields of the JSON request bodies go through `wireId`, so a caller that holds
 * a number (a `Number()` slip, or a mock id) still sends the string the contract's `IdSchema` demands in
 * http mode (a number is 422). Mock mode keeps the value it was given. The transport is stubbed.
 */
import {
  BulkDeleteRequestSchema,
  CompBulkActionRequestSchema,
  SchoolPackageAssignRequestSchema,
  StudentImportRequestSchema,
  SubscriptionCreateRequestSchema,
} from '@pp/contract'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { installTransport } from '@/api'
import type { Transport, TransportRequest } from '@/api'

import { bulkCompAction } from '../../api/comp-students'
import { importStudents } from '../../api/imports'
import { createSubscription } from '../../api/subscriptions'
import { assignUserPackage, bulkDeleteAdminUsers } from '../../api/users'

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

const subscription = {
  schoolId: 7,
  packageTier: 'basic' as const,
  schoolPackageId: 2,
  studentQuota: 30,
}
const studentImport = {
  schoolId: 7,
  classLevel: 'T4' as const,
  importMode: 'paste' as const,
  pasteContent: 'Murid Contoh, murid@example.test, x',
}

describe('http mode: numeric ids go out as strings', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'http')
  })

  it('bulkDeleteAdminUsers', async () => {
    await bulkDeleteAdminUsers([3, 4])
    expect(body()).toEqual({ ids: ['3', '4'] })
    expect(BulkDeleteRequestSchema.safeParse(body()).success).toBe(true)
  })

  it('bulkCompAction', async () => {
    await bulkCompAction('activate', [5, '6'])
    expect(body()).toEqual({ action: 'activate', ids: ['5', '6'] })
    expect(CompBulkActionRequestSchema.safeParse(body()).success).toBe(true)
  })

  it('createSubscription', async () => {
    await createSubscription(subscription)
    expect(body()).toMatchObject({ schoolId: '7', schoolPackageId: '2', studentQuota: 30 })
    expect(SubscriptionCreateRequestSchema.safeParse(body()).success).toBe(true)
  })

  it('createSubscription keeps a null id (the server answers the required 422)', async () => {
    await createSubscription({ ...subscription, schoolId: null, schoolPackageId: null })
    expect(body()).toMatchObject({ schoolId: null, schoolPackageId: null })
  })

  it('assignUserPackage', async () => {
    await assignUserPackage(9, { formLevel: 't4', packageId: 1, studentQuota: 100 })
    expect(sent[sent.length - 1]!.url).toBe('/api/admin/users/9/packages')
    expect(body()).toEqual({ formLevel: 't4', packageId: '1', studentQuota: 100 })
    expect(SchoolPackageAssignRequestSchema.safeParse(body()).success).toBe(true)
  })

  it('importStudents (JSON body)', async () => {
    await importStudents(studentImport)
    expect(body()).toMatchObject({ schoolId: '7', classLevel: 'T4', importMode: 'paste' })
    expect(StudentImportRequestSchema.safeParse(body()).success).toBe(true)
  })

  it('importStudents keeps a null school id', async () => {
    await importStudents({ ...studentImport, schoolId: null })
    expect(body().schoolId).toBeNull()
  })
})

describe('mock mode: the value is kept', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_API_MODE', 'mock')
  })

  it('bulkDeleteAdminUsers', async () => {
    await bulkDeleteAdminUsers([3, 4])
    expect(body()).toEqual({ ids: [3, 4] })
  })

  it('bulkCompAction', async () => {
    await bulkCompAction('activate', [5, 6])
    expect(body()).toEqual({ action: 'activate', ids: [5, 6] })
  })

  it('createSubscription', async () => {
    await createSubscription(subscription)
    expect(body()).toMatchObject({ schoolId: 7, schoolPackageId: 2 })
  })

  it('assignUserPackage', async () => {
    await assignUserPackage(9, { formLevel: 't4', packageId: 1, studentQuota: 100 })
    expect(body()).toEqual({ formLevel: 't4', packageId: 1, studentQuota: 100 })
  })

  it('importStudents', async () => {
    await importStudents(studentImport)
    expect(body()).toMatchObject({ schoolId: 7 })
  })
})
