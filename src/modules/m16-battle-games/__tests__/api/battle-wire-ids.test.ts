import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { createHttpTransport, installTransport } from '@/api'

import {
  acceptChallenger,
  joinQueue,
  pollChallenger,
  pollMatch,
  rejectChallenger,
  sendInvite,
  startBattle,
} from '../../api/battle'

/**
 * DEMO-FIX-1 D-03: the queue id is an opaque string (`BattleStartResponseSchema` `queue_id: IdSchema`),
 * and the start / invite bodies take string ids (`BattleStartRequestSchema`, `BattleInviteRequestSchema`).
 */

let sent: { method: string; url: string; body: unknown }[] = []
let answer: unknown = {}

beforeEach(() => {
  sent = []
  answer = {}
  installTransport(
    createHttpTransport({
      fetch: (input, init) => {
        sent.push({
          method: init?.method ?? 'GET',
          url: input as string,
          body: init?.body === undefined ? undefined : JSON.parse(init.body as string),
        })
        return Promise.resolve(
          new Response(JSON.stringify(answer), {
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

describe('battle wire ids', () => {
  it('http mode: quick-match sends subject_id as a string and resolves the string queue_id', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    answer = { queue_id: '1' }
    const res = await startBattle('quick-match', {
      question_type: 'biasa',
      open_to_all: true,
      subject_id: 3,
    })
    expect(sent[0]).toEqual({
      method: 'POST',
      url: '/api/battle/quick-match',
      body: { question_type: 'biasa', open_to_all: true, subject_id: '3' },
    })
    expect(res.body).toEqual({ queue_id: '1' })
  })

  it('http mode: pksk_domain_id and receiver_id are strings', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await startBattle('school-battle', {
      question_type: 'pksk',
      open_to_all: false,
      pksk_domain_id: 2,
      pksk_target_level: 'T4',
    })
    expect(sent[0]?.body).toEqual({
      question_type: 'pksk',
      open_to_all: false,
      pksk_domain_id: '2',
      pksk_target_level: 'T4',
    })
    await sendInvite({ question_type: 'spm', open_to_all: false, subject_id: 9, receiver_id: 77 })
    expect(sent[1]?.body).toEqual({
      question_type: 'spm',
      open_to_all: false,
      subject_id: '9',
      receiver_id: '77',
    })
  })

  it('the string queue id is used in the poll, accept, reject, join and poll-challenger paths', async () => {
    vi.stubEnv('VITE_API_MODE', 'http')
    await pollMatch('1')
    await acceptChallenger('1')
    await rejectChallenger('1')
    await joinQueue('1')
    await pollChallenger('1')
    expect(sent.map((r) => `${r.method} ${r.url}`)).toEqual([
      'GET /api/battle/poll-match/1',
      'POST /api/battle/accept-challenger/1',
      'POST /api/battle/reject-challenger/1',
      'POST /api/battle/join-queue/1',
      'GET /api/battle/poll-challenger/1',
    ])
  })

  it('mock mode: the start body keeps its numbers', async () => {
    vi.stubEnv('VITE_API_MODE', 'mock')
    await startBattle('quick-match', { question_type: 'biasa', open_to_all: false, subject_id: 3 })
    expect(sent[0]?.body).toEqual({ question_type: 'biasa', open_to_all: false, subject_id: 3 })
  })
})
