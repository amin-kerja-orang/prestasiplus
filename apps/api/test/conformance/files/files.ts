import type { Scenario } from '@pp/contract-tests'

import { makePng } from '../../files/fixtures'
import { dataOf, errorOf, expectError } from '../helpers'

const png = () => new Uint8Array(makePng())

/**
 * Files (BE-04) smoke scenarios (BE-31 AC6): upload, read, delete, plus 401 and 403 and the
 * opaque-id rule. The file id is an opaque 22-character token, never a database key (recorded
 * deviation: BE-04 "opaque file ids").
 */
export const filesScenarios: Scenario[] = [
  {
    id: 'files-api/avatar: upload, read, delete',
    domain: 'files',
    targets: ['api'],
    async run(ctx) {
      const student = await ctx.as('student')
      const up = await student.request('POST', '/files?purpose=avatar', {
        file: { field: 'file', filename: 'gambar.png', contentType: 'image/png', content: png() },
      })
      ctx.expectStatus(up, 201)
      const ref = dataOf(up)
      const id = String(ref.id)
      ctx.check(/^[A-Za-z0-9_-]{22}$/.test(id), `file id ${id} is not an opaque 22-character token`)
      ctx.check(ref.url === `/api/files/${id}`, 'FileRef.url does not point at the file')

      const read = await student.request('GET', `/files/${id}`)
      ctx.expectStatus(read, 200)
      ctx.check(read.headers['content-type'] === 'image/png', `served as ${String(read.headers['content-type'])}`)
      ctx.check(read.headers['x-content-type-options'] === 'nosniff', 'missing X-Content-Type-Options: nosniff')

      ctx.expectStatus(await student.request('DELETE', `/files/${id}`), 204)
      expectError(ctx, await student.request('GET', `/files/${id}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'files-api/another user cannot see the file (404, not 403)',
    domain: 'files',
    targets: ['api'],
    async run(ctx) {
      const student = await ctx.as('student')
      const up = await student.request('POST', '/files?purpose=avatar', {
        file: { field: 'file', filename: 'gambar.png', contentType: 'image/png', content: png() },
      })
      ctx.expectStatus(up, 201)
      const id = String(dataOf(up).id)
      const teacher = await ctx.as('teacher')
      expectError(ctx, await teacher.request('GET', `/files/${id}`), 404, 'NOT_FOUND')
      expectError(ctx, await teacher.request('DELETE', `/files/${id}`), 404, 'NOT_FOUND')
    },
  },
  {
    id: 'files-api/anonymous is 401 on upload, read and delete',
    domain: 'files',
    targets: ['api'],
    async run(ctx) {
      const anon = ctx.anonymous()
      const up = await anon.request('POST', '/files?purpose=avatar', {
        file: { field: 'file', filename: 'gambar.png', contentType: 'image/png', content: png() },
      })
      expectError(ctx, up, 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('GET', '/files/AAAAAAAAAAAAAAAAAAAAAA'), 401, 'UNAUTHORIZED')
      expectError(ctx, await anon.request('DELETE', '/files/AAAAAAAAAAAAAAAAAAAAAA'), 401, 'UNAUTHORIZED')
    },
  },
  {
    id: 'files-api/upload rules: purpose, type, missing file, CSRF, role',
    domain: 'files',
    targets: ['api'],
    async run(ctx) {
      const student = await ctx.as('student')
      const file = { field: 'file', filename: 'gambar.png', contentType: 'image/png', content: png() }
      // Not an image: the bytes decide, not the declared type.
      const text = await student.request('POST', '/files?purpose=avatar', {
        file: { ...file, filename: 'nota.png', content: new TextEncoder().encode('bukan gambar') },
      })
      ctx.expectStatus(text, 422)
      ctx.check(errorOf(text).code === 'VALIDATION_ERROR', 'a non-image upload is not VALIDATION_ERROR')
      ctx.expectStatus(await student.request('POST', '/files?purpose=tidak-wujud', { file }), 422)
      const noCsrf = await ctx.as('student', { csrf: false })
      expectError(ctx, await noCsrf.request('POST', '/files?purpose=avatar', { file }), 403, 'CSRF_INVALID')
      // A purpose the role may not use.
      expectError(ctx, await student.request('POST', '/files?purpose=question_image', { file }), 403, 'FORBIDDEN')
    },
  },
]
