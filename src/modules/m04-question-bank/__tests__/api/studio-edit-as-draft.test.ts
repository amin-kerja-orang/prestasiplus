import { describe, expect, it, vi } from 'vitest'

import { installTransport } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api'

import { editAsDraft, EditAsDraftRefused } from '../../api/studio'

const JSON_HEADERS = { 'content-type': 'application/json' }

const approved = {
  id: '700', status: 'approved', subjectId: '3', educationLevelId: '7', difficultyLevel: 3, questionText: 'Soalan yang sudah diterbitkan kepada murid.',
  questionImage: null, curriculumChapterId: null, stimulusGroup: null, tag: { unitId: '40', spIds: ['41'], tp: 2 },
  parts: [{ label: 'a', prompt: { ms: 'Pilih.' }, mode: 'short_text', marks: 1, difficultyTp: 2, kbat: 'bukan', key: { kind: 'accepted', values: ['abc'] } }],
}

/** A transport that answers the question read with `approved` and the POST with `post`. */
function install(post: TransportResponse | ((req: TransportRequest) => TransportResponse), q: unknown = approved): TransportRequest[] {
  const seen: TransportRequest[] = []
  const transport: Transport = {
    request: vi.fn((req: TransportRequest) => {
      seen.push(req)
      if (req.method === 'GET') return Promise.resolve({ status: 200, headers: JSON_HEADERS, body: { data: q } })
      return Promise.resolve(typeof post === 'function' ? post(req) : post)
    }),
  }
  installTransport(transport)
  return seen
}

const posts = (seen: TransportRequest[]): TransportRequest[] => seen.filter((r) => r.method === 'POST')

describe('editAsDraft (REQ-A-038)', () => {
  it('201: POSTs /edit-as-draft (no PUT) and resolves to the new draft version', async () => {
    const seen = install({ status: 201, headers: JSON_HEADERS, body: { data: { id: '700', versionNo: 3 }, status: 'Draf baharu #700 dicipta.' } })
    await expect(editAsDraft('700')).resolves.toEqual({ id: '700', versionNo: 3, existing: false })
    expect(posts(seen)).toHaveLength(1)
    expect(posts(seen)[0]?.url).toContain('/api/questions/700/edit-as-draft')
    expect(seen.some((r) => r.method === 'PUT')).toBe(false)
  })

  it('409 with details {id, versionNo}: resolves to the existing draft, not an error', async () => {
    install({
      status: 409,
      headers: JSON_HEADERS,
      body: { error: { code: 'CONFLICT', message: 'Soalan ini sudah mempunyai draf atau semakan yang belum diterbitkan. Sunting draf itu.', details: { id: '700', versionNo: 2 } } },
    })
    await expect(editAsDraft('700')).resolves.toEqual({ id: '700', versionNo: 2, existing: true })
  })

  it('409 without details (not live): the error is rethrown', async () => {
    install({ status: 409, headers: JSON_HEADERS, body: { error: { code: 'CONFLICT', message: 'Hanya soalan yang diterbitkan boleh disunting sebagai draf.' } } })
    await expect(editAsDraft('700')).rejects.toMatchObject({ status: 409, message: 'Hanya soalan yang diterbitkan boleh disunting sebagai draf.' })
  })

  it('refuses a question the editor cannot hold before any POST', async () => {
    const seen = install(
      { status: 201, headers: JSON_HEADERS, body: { data: { id: '700', versionNo: 2 }, status: '' } },
      { ...approved, parts: [{ label: 'a', prompt: { ms: 'Terangkan.' }, mode: 'essay', marks: 10, key: { kind: 'rubric' } }] },
    )
    await expect(editAsDraft('700')).rejects.toBeInstanceOf(EditAsDraftRefused)
    expect(posts(seen)).toHaveLength(0)
  })
})
