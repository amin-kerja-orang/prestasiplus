import { describe, expect, it } from 'vitest'

import { buildOpenApiDocument } from '../../openapi'
import { FILE_PURPOSE_RULES, FILE_PURPOSES, FileRefSchema, UploadFileQuerySchema } from '../schema'

describe('files contract', () => {
  it('parses a FileRef and rejects an unknown mime or purpose', () => {
    const ref = { id: 'Zk3Qx9vB2mLw7TnRa1YpUg', url: '/api/files/Zk3Qx9vB2mLw7TnRa1YpUg', mime: 'image/png', size: 10, purpose: 'avatar' }
    expect(FileRefSchema.parse(ref)).toEqual(ref)
    expect(FileRefSchema.safeParse({ ...ref, mime: 'image/svg+xml' }).success).toBe(false)
    expect(FileRefSchema.safeParse({ ...ref, purpose: 'intake_page' }).success).toBe(false)
    expect(UploadFileQuerySchema.safeParse({ purpose: 'nope' }).success).toBe(false)
  })

  it('copies the mock limits', () => {
    expect(FILE_PURPOSE_RULES.avatar.maxBytes).toBe(2048 * 1024)
    expect(FILE_PURPOSE_RULES.avatar.mimes).toEqual(['image/jpeg', 'image/png', 'image/webp'])
    expect(FILE_PURPOSE_RULES.bijak_photo.mimes).toEqual(['image/jpeg', 'image/png'])
    expect(FILE_PURPOSE_RULES.bijak_photo.maxBytes).toBe(5 * 1024 * 1024)
    expect(Object.keys(FILE_PURPOSE_RULES)).toEqual([...FILE_PURPOSES])
  })

  it('is registered in the OpenAPI document', () => {
    const doc = buildOpenApiDocument() as { paths: Record<string, unknown>; components: { schemas: Record<string, unknown> } }
    expect(Object.keys(doc.paths)).toEqual(expect.arrayContaining(['/files', '/files/{id}']))
    expect(doc.components.schemas).toHaveProperty('FileRef')
  })
})
