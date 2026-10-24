import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport } from '@/api'

import { createPkskQuestion, grantPkskAccess, updatePkskQuestion } from '../../api/admin'

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
          new Response(JSON.stringify({ data: {}, status: 'ok' }), {
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

const domainOf = (i: number): unknown => (sent[i]?.body as { pkskDomainId: unknown }).pkskDomainId

const update = () =>
  updatePkskQuestion(9, {
    pkskDomainId: 2,
    pkskTargetLevel: 'T4',
    status: 'approved',
    questionText: 'Soalan',
  })

/** SWY-04: `pkskDomainId` is an `idInput` string on the wire (a number is 422). */
describe('PKSK question body wire ids (SWY-04)', () => {
  it('http mode sends pkskDomainId as a string on create and update', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await createPkskQuestion({
      bahagian: 'C',
      pkskDomainId: 2,
      pkskTargetLevel: 'T4',
      questionText: 'Soalan',
      difficultyLevel: 1,
    })
    await update()
    expect(domainOf(0)).toBe('2')
    expect(domainOf(1)).toBe('2')
  })

  it('mock mode keeps the number', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await update()
    expect(domainOf(0)).toBe(2)
  })
})

/** SWY-05: `userId` and `packageId` are `idInput` strings on the wire (a number is 422). */
describe('PKSK access grant wire ids (SWY-05)', () => {
  it('http mode sends userId and packageId as strings', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await grantPkskAccess({ userId: 5, packageId: 1, expiresAt: null })
    expect(sent[0]?.body).toEqual({ userId: '5', packageId: '1', expiresAt: null })
  })

  it('mock mode keeps the numbers', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await grantPkskAccess({ userId: 5, packageId: 1, expiresAt: null })
    expect(sent[0]?.body).toEqual({ userId: 5, packageId: 1, expiresAt: null })
  })
})
