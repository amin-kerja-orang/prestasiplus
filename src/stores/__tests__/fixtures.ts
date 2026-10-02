import type { Transport, TransportRequest, TransportResponse } from '@/api'

import type { ClientSession, UserMe } from '../session-types'

export const STUDENT: UserMe = {
  id: 3,
  name: 'Pelajar Demo',
  email: 'pelajar@demo.test',
  phone: null,
  role: 'student',
  grade: 11,
  schoolId: 900001,
  bio: null,
  avatarUrl: null,
  createdAt: '2026-01-05T09:00:00+08:00',
  updatedAt: '2026-01-05T09:00:00+08:00',
  lastLoginAt: null,
  school: null,
  landingPath: '/dashboard',
}

export function session(overrides: Partial<ClientSession> = {}): ClientSession {
  return {
    token: 'pp_token_1',
    remember: false,
    expiresAt: '2026-09-25T17:40:00+08:00',
    user: STUDENT,
    ...overrides,
  }
}

type Responder = (
  req: TransportRequest,
) => Partial<TransportResponse> | Promise<Partial<TransportResponse>>

/** A transport that records requests and answers with `respond`. */
export function fakeTransport(respond: Responder): Transport & { requests: TransportRequest[] } {
  const requests: TransportRequest[] = []
  return {
    requests,
    async request(req) {
      requests.push(req)
      const res = await respond(req)
      return { status: 200, headers: {}, body: null, ...res }
    },
  }
}
