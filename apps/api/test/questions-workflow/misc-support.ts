import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { SessionSchema } from '@pp/contract'
import { expect } from 'vitest'
import type TestAgent from 'supertest/lib/agent'

import { ACCOUNTS, DEMO_PASSWORD, type WorkflowTestApp } from './helpers'

/** A fresh temp folder for `FILE_STORAGE_DIR` (uploads of the diagram audit tests). */
export const tempStorageDir = (): string => mkdtempSync(join(tmpdir(), 'pp-be10-'))

export interface RawClient {
  agent: TestAgent
  csrf: string
  userId: string
}

/** Signs in and keeps the raw agent, for multipart calls (`.attach`) that the shared `Client` cannot make. */
export async function loginRaw(t: WorkflowTestApp, key: keyof typeof ACCOUNTS = 'admin'): Promise<RawClient> {
  const agent = t.agent()
  const res = await agent.post('/api/auth/login').send({ identifier: ACCOUNTS[key], password: DEMO_PASSWORD, remember: false })
  expect(res.status, JSON.stringify(res.body)).toBe(200)
  const session = SessionSchema.parse(res.body.data)
  return { agent, csrf: session.csrf, userId: session.user.id }
}
