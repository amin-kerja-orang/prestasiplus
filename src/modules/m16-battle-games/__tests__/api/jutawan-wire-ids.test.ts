import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport } from '@/api'

import { startJutawan } from '../../api/games'

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
          new Response(JSON.stringify({}), {
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

/** SWY-01: `GamesJutawanStartRequestSchema.subject` is an `IdSchema` string (a number is 422). */
describe('startJutawan wire ids (SWY-01)', () => {
  it('http mode sends subject as a string', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await startJutawan({ subject: 3, darjah: 4 })
    expect(sent[0]?.url).toBe('/api/games/jutawan/start')
    expect(sent[0]?.body).toEqual({ subject: '3', darjah: 4 })
  })

  it('mock mode keeps the number', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await startJutawan({ subject: 3, darjah: 4 })
    expect(sent[0]?.body).toEqual({ subject: 3, darjah: 4 })
  })
})
