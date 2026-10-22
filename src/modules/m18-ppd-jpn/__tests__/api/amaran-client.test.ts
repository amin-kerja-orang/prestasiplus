/**
 * M18 report client (`api/amaran.ts`): request path, query and unwrapped body of #22 and #24 through the shared
 * `api` client (the same code runs on the mock and on the http transport; only the installed transport differs),
 * and the error mapping (403 role, 404, 422).
 */

import { afterEach, describe, expect, it, vi } from 'vitest'

import { installTransport } from '@/api'
import type { Transport, TransportRequest, TransportResponse } from '@/api/transport'

import {
  fetchAmaranEffectiveness,
  fetchAmaranSummary,
  type AmaranEffectivenessResponse,
  type AmaranSummaryResponse,
} from '../../api/amaran'

const summary: AmaranSummaryResponse = {
  scope: 'school',
  title: 'SMK Contoh A',
  subtitle: 'Daerah Contoh, Negeri Contoh',
  pupilsLine: '59 pelajar',
  generatedAt: 1_792_548_300_000,
  tally: { green: 12, yellow: 18, red: 29, total: 59, pct: { green: 20, yellow: 31, red: 49 } },
  kombo: { active: 14, pupils: 59, avg: 6.4, max: 13, today: 0 },
  weakness: [],
}

const effectiveness: AmaranEffectivenessResponse = {
  school: { id: '8880', name: 'SMK Contoh A' },
  report: {
    cards: {
      total: 0,
      berkesan: 0,
      evaluated: 0,
      rate: 0,
      needsAction: 0,
      sederhana: 0,
      tidakBerkesan: 0,
      notEvaluated: 0,
    },
    doughnut: [0, 0, 0, 0],
    trend: { labels: ['Mei 2026', 'Jun 2026', 'Jul 2026', 'Ogo 2026', 'Sep 2026', 'Okt 2026'], data: [0, 0, 0, 0, 0, 0] },
    byType: [],
    byTeacher: [],
    followUps: [],
    bySchool: [],
  },
}

function recorder(body: unknown, status = 200) {
  const requests: TransportRequest[] = []
  const request = vi.fn((req: TransportRequest): Promise<TransportResponse> => {
    requests.push(req)
    return Promise.resolve({ status, headers: {}, body })
  })
  const transport: Transport = { request }
  installTransport(transport)
  return requests
}

afterEach(() => {
  installTransport({
    request: () => Promise.reject(new Error('no transport installed by this test')),
  })
})

describe('fetchAmaranSummary (#22)', () => {
  it('GETs /api/amaran/summary with no query and unwraps the envelope', async () => {
    const requests = recorder({ data: summary })
    const d = await fetchAmaranSummary()
    expect(d.title).toBe('SMK Contoh A')
    expect(d.generatedAt).toBe(1_792_548_300_000)
    expect(requests).toHaveLength(1)
    expect(requests[0]?.method).toBe('GET')
    expect(requests[0]?.url).toBe('/api/amaran/summary')
    expect(requests[0]?.query ?? {}).toEqual({})
  })

  it('sends only the params it is given (Admin Pusat variant), never an empty one', async () => {
    const requests = recorder({ data: summary })
    await fetchAmaranSummary({ scope: 'district', district: 'Daerah Contoh', state: 'Negeri Contoh' })
    expect(requests[0]?.query).toEqual({ scope: 'district', district: 'Daerah Contoh', state: 'Negeri Contoh' })
  })

  it('rejects with the server error (403, 404, 422)', async () => {
    recorder({ error: { code: 'FORBIDDEN', message: 'This action is unauthorized.' } }, 403)
    await expect(fetchAmaranSummary()).rejects.toMatchObject({ status: 403, code: 'FORBIDDEN' })
    recorder({ error: { code: 'NOT_FOUND', message: 'Not Found.' } }, 404)
    await expect(fetchAmaranSummary()).rejects.toMatchObject({ status: 404 })
    recorder({ error: { code: 'VALIDATION_FAILED', message: 'The scope must be school, district or state.' } }, 422)
    await expect(fetchAmaranSummary({ scope: 'x' })).rejects.toMatchObject({ status: 422 })
  })
})

describe('fetchAmaranEffectiveness (#24)', () => {
  it('GETs /api/amaran/effectiveness with no query and unwraps the envelope', async () => {
    const requests = recorder({ data: effectiveness })
    const d = await fetchAmaranEffectiveness()
    expect(d.school.name).toBe('SMK Contoh A')
    expect(d.report.doughnut).toEqual([0, 0, 0, 0])
    expect(requests[0]?.method).toBe('GET')
    expect(requests[0]?.url).toBe('/api/amaran/effectiveness')
    expect(requests[0]?.query ?? {}).toEqual({})
  })

  it('rejects with the server error (403)', async () => {
    recorder({ error: { code: 'FORBIDDEN', message: 'This action is unauthorized.' } }, 403)
    await expect(fetchAmaranEffectiveness()).rejects.toMatchObject({ status: 403 })
  })
})
