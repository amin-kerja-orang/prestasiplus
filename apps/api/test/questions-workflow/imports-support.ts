import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { SessionSchema } from '@pp/contract'
import type request from 'supertest'
import type TestAgent from 'supertest/lib/agent'
import { expect } from 'vitest'

import { ACCOUNTS, DEMO_PASSWORD, type AccountKey, type WorkflowTestApp } from './helpers'

/** A signed-in supertest agent that can send multipart bodies. */
export interface UploadClient {
  userId: string
  csrf: string
  get(url: string): request.Test
  /** Multipart POST with a `csvFile` part (and text fields); `csrf: false` leaves the header out. */
  upload(url: string, file: { name: string; body: Buffer | string; type?: string } | null, fields?: Record<string, string>, csrf?: boolean): request.Test
}

export async function uploadClient(t: WorkflowTestApp, account: AccountKey): Promise<UploadClient> {
  const agent: TestAgent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier: ACCOUNTS[account], password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  return {
    userId: session.user.id,
    csrf: session.csrf,
    get: (url) => agent.get(url),
    upload(url, file, fields = {}, csrf = true) {
      let r = agent.post(url)
      if (csrf) r = r.set('X-CSRF-Token', session.csrf)
      for (const [k, v] of Object.entries(fields)) r = r.field(k, v)
      if (file) r = r.attach('csvFile', Buffer.isBuffer(file.body) ? file.body : Buffer.from(file.body), { filename: file.name, contentType: file.type ?? 'text/csv' })
      return r
    },
  }
}

/** A fixture file with `{S}` / `{L}` replaced by real subject / level ids. */
export function fixture(name: string, ids: { subject: string; level: string }): string {
  return readFileSync(join(__dirname, 'fixtures', name), 'utf8').replaceAll('{S}', ids.subject).replaceAll('{L}', ids.level)
}

/** A subject and a level that exist in the seeded curriculum. */
export async function curriculumIds(t: WorkflowTestApp): Promise<{ subject: string; level: string }> {
  const [s] = await t.db.query<{ id: string }>('select id::text from subjects order by id limit 1')
  const [l] = await t.db.query<{ id: string }>("select id::text from education_levels where stage <> 'primary' and is_active order by sort_order, id limit 1")
  return { subject: s!.id, level: l!.id }
}
