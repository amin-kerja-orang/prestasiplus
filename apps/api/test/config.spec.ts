import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { DEV_SESSION_SECRET, EnvSchema, loadEnv } from '../src/common/config/env.schema'

const DB_URL = 'postgresql://u:p@localhost:5432/x'
const VALID = { NODE_ENV: 'test', PORT: '3000', LOG_LEVEL: 'info', DATABASE_URL: DB_URL }

describe('env validation', () => {
  it('accepts a valid environment and applies defaults', () => {
    expect(
      loadEnv({ NODE_ENV: 'production', DATABASE_URL: DB_URL, SESSION_SECRET: 'x'.repeat(32) }),
    ).toEqual({
      NODE_ENV: 'production',
      PORT: 3000,
      LOG_LEVEL: 'info',
      DATABASE_URL: DB_URL,
      SESSION_SECRET: 'x'.repeat(32),
      TRUST_PROXY_HOPS: 0,
      SESSION_REMEMBER_DAYS: 30,
      SESSION_REMEMBER_DAYS_STAFF: 1,
      ALLOW_DEMO_SEED: false,
      LEGACY_BCRYPT_DUMMY_COST: 12,
      LOGIN_FAILURE_FLOOR_MS: 1500,
      LOGIN_IDENTIFIER_FAIL_LIMIT: 100,
    })
  })

  it('parses and bounds the proxy, remember and demo-seed keys', () => {
    expect(
      loadEnv({
        ...VALID,
        TRUST_PROXY_HOPS: '2',
        SESSION_REMEMBER_DAYS: '7',
        SESSION_REMEMBER_DAYS_STAFF: '0',
        ALLOW_DEMO_SEED: 'true',
      }),
    ).toMatchObject({
      TRUST_PROXY_HOPS: 2,
      SESSION_REMEMBER_DAYS: 7,
      SESSION_REMEMBER_DAYS_STAFF: 0,
      ALLOW_DEMO_SEED: true,
    })
    expect(() => loadEnv({ ...VALID, TRUST_PROXY_HOPS: '-1' })).toThrow(/TRUST_PROXY_HOPS/)
    expect(() => loadEnv({ ...VALID, SESSION_REMEMBER_DAYS: '0' })).toThrow(/SESSION_REMEMBER_DAYS/)
    expect(() => loadEnv({ ...VALID, SESSION_REMEMBER_DAYS_STAFF: '-1' })).toThrow(
      /SESSION_REMEMBER_DAYS_STAFF/,
    )
    expect(() => loadEnv({ ...VALID, ALLOW_DEMO_SEED: 'yes' })).toThrow(/ALLOW_DEMO_SEED/)
    expect(loadEnv({ ...VALID, ALLOW_DEMO_SEED: '1' }).ALLOW_DEMO_SEED).toBe(true)
    expect(loadEnv({ ...VALID, ALLOW_DEMO_SEED: '0' }).ALLOW_DEMO_SEED).toBe(false)
    expect(() => loadEnv({ ...VALID, LEGACY_BCRYPT_DUMMY_COST: '14' })).toThrow(/LEGACY_BCRYPT_DUMMY_COST/)
    expect(() => loadEnv({ ...VALID, LEGACY_BCRYPT_DUMMY_COST: '3' })).toThrow(/LEGACY_BCRYPT_DUMMY_COST/)
    expect(loadEnv({ ...VALID, LOGIN_FAILURE_FLOOR_MS: '0' }).LOGIN_FAILURE_FLOOR_MS).toBe(0)
  })

  it('requires a strong SESSION_SECRET in production and defaults it elsewhere', () => {
    const prod = { NODE_ENV: 'production', DATABASE_URL: DB_URL }
    expect(() => loadEnv(prod)).toThrow(/SESSION_SECRET/)
    expect(() => loadEnv({ ...prod, SESSION_SECRET: 'change-me' })).toThrow(/SESSION_SECRET/)
    expect(() => loadEnv({ ...prod, SESSION_SECRET: 'short' })).toThrow(/SESSION_SECRET/)
    expect(loadEnv({ ...VALID }).SESSION_SECRET).toBe(DEV_SESSION_SECRET)
    expect(loadEnv({ ...VALID, SESSION_SECRET: 'abc' }).SESSION_SECRET).toBe('abc')
  })

  const required = Object.entries(EnvSchema.shape)
    .filter(([, schema]) => !schema.safeParse(undefined).success)
    .map(([key]) => key)

  it('has at least one required key', () => {
    expect(required.length).toBeGreaterThan(0)
  })

  it.each(required)('names the key %s when it is missing', (key) => {
    const raw: Record<string, string> = { ...VALID }
    delete raw[key]
    expect(() => loadEnv(raw)).toThrow(new RegExp(key))
  })

  it('rejects a non-postgres DATABASE_URL without echoing it', () => {
    const attempt = () => loadEnv({ ...VALID, DATABASE_URL: 'mysql://u:SECRETPW@h/x' })
    expect(attempt).toThrow(/DATABASE_URL/)
    expect(attempt).not.toThrow(/SECRETPW/)
  })

  it('names an invalid value', () => {
    expect(() => loadEnv({ ...VALID, PORT: 'abc' })).toThrow(/PORT/)
  })

  it('declares exactly the keys of .env.api.example', () => {
    const file = fileURLToPath(new URL('../../../.env.api.example', import.meta.url))
    const keys = new Set<string>()
    for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
      // Active keys only; keys of later cards live in commented lane blocks as `# KEY=...`.
      const m = /^([A-Z][A-Z0-9_]*)=/.exec(line)
      if (m?.[1]) keys.add(m[1])
    }
    expect([...keys].sort()).toEqual(Object.keys(EnvSchema.shape).sort())
  })
})
