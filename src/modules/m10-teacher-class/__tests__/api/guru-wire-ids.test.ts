import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport } from '@/api'

import { createGuruClass } from '../../api/guru'

/**
 * DEMO-FIX-1 D-01: `POST /api/guru/classes` sends `subjectId` / `schoolId` as string ids on the wire
 * (`ClassCreateRequestSchema`); a number was 422 "Sila pilih subjek.". Mock mode keeps the value.
 */

let sent: { url: string; body: unknown }[] = []

beforeEach(() => {
  sent = []
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        sent.push({
          url: input as string,
          body: JSON.parse((init?.body as string | undefined) ?? 'null'),
        })
        return Promise.resolve(
          new Response(JSON.stringify({ data: { id: '9' } }), {
            status: 201,
            headers: { 'content-type': 'application/json' },
          }),
        )
      },
    }),
  )
})
afterEach(() => {
  vi.unstubAllEnvs()
})

describe('createGuruClass wire ids', () => {
  it('http mode: subjectId and schoolId go out as strings', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await createGuruClass({
      schoolId: 12,
      name: '5 Bestari',
      subjectId: 3,
      educationLevel: 'tingkatan-5',
      description: null,
    })
    expect(sent).toHaveLength(1)
    expect(sent[0]?.url).toBe('/api/guru/classes')
    expect(sent[0]?.body).toEqual({
      schoolId: '12',
      name: '5 Bestari',
      subjectId: '3',
      educationLevel: 'tingkatan-5',
      description: null,
    })
  })

  it('http mode: a select value string is sent as is; no schoolId key when absent', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await createGuruClass({ name: 'K', subjectId: '3', educationLevel: 'tahun-1' })
    expect(sent[0]?.body).toEqual({ name: 'K', subjectId: '3', educationLevel: 'tahun-1' })
    expect(typeof (sent[0]?.body as { subjectId: unknown }).subjectId).toBe('string')
  })

  it('http mode: a null schoolId stays null', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await createGuruClass({ schoolId: null, name: 'K', subjectId: 3, educationLevel: 'tahun-1' })
    expect(sent[0]?.body).toMatchObject({ schoolId: null, subjectId: '3' })
  })

  it('mock mode: the values are unchanged', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await createGuruClass({ schoolId: 12, name: 'K', subjectId: 3, educationLevel: 'tahun-1' })
    expect(sent[0]?.body).toEqual({
      schoolId: 12,
      name: 'K',
      subjectId: 3,
      educationLevel: 'tahun-1',
    })
  })
})
