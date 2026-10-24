import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport } from '@/api'

import { bulkQuestionAction } from '../../api/questions'

let sent: { method: string; url: string; body: unknown }[] = []

beforeEach(() => {
  sent = []
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        sent.push({
          method: init?.method ?? 'GET',
          url: input as string,
          body: init?.body === undefined ? undefined : JSON.parse(init.body as string),
        })
        return Promise.resolve(
          new Response(JSON.stringify({ data: { affected: 1 }, status: 'ok' }), {
            status: 200,
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

/** SWY-07: the bulk body is `ids: string[]` on the wire (`questions/schema.ts`; a number is 422). */
describe('bulkQuestionAction wire ids (SWY-07)', () => {
  it('http mode sends the ids as strings', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await bulkQuestionAction('approve', [12])
    expect(sent[0]?.url).toBe('/api/questions/bulk-action')
    expect((sent[0]?.body as { ids: unknown }).ids).toEqual(['12'])
  })

  it('mock mode keeps the numbers', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await bulkQuestionAction('approve', [12])
    expect((sent[0]?.body as { ids: unknown }).ids).toEqual([12])
  })
})
