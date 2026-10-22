/**
 * AZ-14: `POST /api/questions/bulk-action` reports every requested id it did not apply in `failed`
 * ({ id, code, message, fields }) so the admin sees the exact BM reason per skipped question.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { bulkFailureOf } from '../../src/modules/questions/errors'
import { ApiError } from '../../src/common/errors/api-error'
import { bootQuestionsApp, loginAs, type Client, type QuestionsTestApp } from './helpers'
import { mcqBody, refsOf, tagOf, type Refs } from './http-helpers'

const UNKNOWN_ID = '999999999'
const NOT_FOUND = (id: string) => ({ id, code: 'NOT_FOUND', message: 'Soalan tidak dijumpai.', fields: {} })
const KEYS_MESSAGE = 'Jumlah markah tidak sepadan dengan skema.'

describe('AZ-14: bulk-action failed entries', () => {
  let t: QuestionsTestApp
  let admin: Client
  let refs: Refs
  let tag: Awaited<ReturnType<typeof tagOf>>

  beforeAll(async () => {
    t = await bootQuestionsApp()
    admin = await loginAs(t, 'admin')
    refs = await refsOf(t.db)
    tag = await tagOf(t.db, refs.mathId, refs.t4Id)
  })
  afterAll(async () => {
    await t.close()
  })

  const make = async (over: Record<string, unknown> = {}): Promise<string> => {
    const res = await admin.post('/api/questions', mcqBody(refs, over))
    expect(res.status, JSON.stringify(res.body)).toBe(201)
    return (res.body as { data: { id: string } }).data.id
  }
  const bulk = async (action: string, ids: string[]) => {
    const res = await admin.post('/api/questions/bulk-action', { action, ids })
    expect(res.status, JSON.stringify(res.body)).toBe(200)
    return res.body.data as { affected: number; failed: unknown[] }
  }

  it('an unknown id is NOT_FOUND with the BM copy', async () => {
    expect(await bulk('review', [UNKNOWN_ID])).toEqual({ affected: 0, failed: [NOT_FOUND(UNKNOWN_ID)] })
  })

  it('a refused transition is CONFLICT with the BM transition text', async () => {
    const id = await make()
    expect(await bulk('approved', [id])).toEqual({
      affected: 0,
      failed: [{ id, code: 'CONFLICT', message: 'Perubahan status daripada Draf kepada Lulus tidak dibenarkan.', fields: {} }],
    })
  })

  it('publishing an untagged approved question is VALIDATION_ERROR with the gate fields and the joined message', async () => {
    const id = await make({ status: 'approved' })
    const out = await bulk('published', [id])
    expect(out.affected).toBe(0)
    expect(out.failed).toHaveLength(1)
    const entry = out.failed[0] as { id: string; code: string; message: string; fields: Record<string, string> }
    expect(entry).toMatchObject({ id, code: 'VALIDATION_ERROR' })
    expect(entry.fields).toEqual({
      unitId: 'Sila pilih unit DSKP.',
      spIds: 'Sila pilih sekurang-kurangnya satu SP DSKP.',
    })
    expect(entry.message).toBe('Sila pilih unit DSKP. Sila pilih sekurang-kurangnya satu SP DSKP.')
  })

  it('publishing a tagged question whose point marks do not match the scheme fails the keys gate', async () => {
    const part = {
      label: '1', prompt: { ms: 'Kira' }, mode: 'working', marks: 3,
      key: { kind: 'points', marks: 2, points: [{ id: 'p', code: 'K', label: 'k', marks: 2 }] },
    }
    const id = await make({ questionType: 'essay', status: 'approved', tag, parts: [part], options: undefined, correctAnswer: undefined })
    const out = await bulk('published', [id])
    expect(out.failed).toEqual([
      { id, code: 'VALIDATION_ERROR', message: KEYS_MESSAGE, fields: { 'parts.1.key': KEYS_MESSAGE } },
    ])
  })

  it('delete of an unknown id is NOT_FOUND', async () => {
    const a = await make()
    expect(await bulk('delete', [a, UNKNOWN_ID])).toEqual({ affected: 1, failed: [NOT_FOUND(UNKNOWN_ID)] })
  })

  it('a duplicate id is reported once', async () => {
    expect(await bulk('review', [UNKNOWN_ID, UNKNOWN_ID])).toEqual({ affected: 0, failed: [NOT_FOUND(UNKNOWN_ID)] })
  })

  it('a mixed request keeps request order and leaves applied ids out of failed', async () => {
    const [a, b] = [await make(), await make()] as [string, string]
    await bulk('review', [b])
    await bulk('approved', [b])
    // a: draft -> approved is refused; b is approved already (approved -> approved refused too), so use review for a.
    const out = await bulk('review', [UNKNOWN_ID, a, b])
    expect(out.affected).toBe(1)
    expect((out.failed as Array<{ id: string; code: string }>).map((f) => [f.id, f.code])).toEqual([[UNKNOWN_ID, 'NOT_FOUND'], [b, 'CONFLICT']])
  })

  it('all-success returns an empty failed list', async () => {
    const [a, b] = [await make(), await make()] as [string, string]
    expect(await bulk('review', [a, b])).toEqual({ affected: 2, failed: [] })
  })

  describe('bulkFailureOf', () => {
    it('uses the error message for a VALIDATION_ERROR without fields, and ignores other errors', () => {
      expect(bulkFailureOf('1', ApiError.of('VALIDATION_ERROR', { message: 'Teks.' }))).toEqual({ id: '1', code: 'VALIDATION_ERROR', message: 'Teks.', fields: {} })
      expect(bulkFailureOf('1', ApiError.of('VALIDATION_ERROR', { fields: { a: 'X.', b: 'X.', c: 'Y.' } }))?.message).toBe('X. Y.')
      expect(bulkFailureOf('1', ApiError.of('FORBIDDEN'))).toBeNull()
      expect(bulkFailureOf('1', new Error('boom'))).toBeNull()
    })
  })
})
