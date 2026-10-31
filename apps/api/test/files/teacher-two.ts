import { SessionSchema } from '@pp/contract'
import { expect } from 'vitest'

import { ACCOUNTS, DEMO_PASSWORD, type Client, type QuestionsTestApp } from '../questions/helpers'

/** The second teacher also holds school_admin and starts in that role: log in, then switch to teacher. */
export async function teacherTwo(t: QuestionsTestApp): Promise<Client> {
  const agent = t.agent()
  const login = await agent.post('/api/auth/login').send({ identifier: ACCOUNTS.teacher2, password: DEMO_PASSWORD, remember: false })
  expect(login.status, JSON.stringify(login.body)).toBe(200)
  const first = SessionSchema.parse(login.body.data)
  const switched = await agent.post('/api/session/role').set('X-CSRF-Token', first.csrf).send({ role: 'teacher' })
  const session = SessionSchema.parse(switched.body.data)
  expect(session.active.role).toBe('teacher')
  const csrf = session.csrf
  return {
    csrf,
    userId: session.user.id,
    get: (url) => agent.get(url),
    post: (url, body) => agent.post(url).set('X-CSRF-Token', csrf).send(body as object),
    put: (url, body) => agent.put(url).set('X-CSRF-Token', csrf).send(body as object),
    patch: (url, body) => agent.patch(url).set('X-CSRF-Token', csrf).send(body as object),
    delete: (url) => agent.delete(url).set('X-CSRF-Token', csrf),
    noCsrf: {
      post: (url, body) => agent.post(url).send(body as object),
      put: (url, body) => agent.put(url).send(body as object),
      patch: (url, body) => agent.patch(url).send(body as object),
      delete: (url) => agent.delete(url),
    },
  }
}
