import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { EnvSchema, loadEnv } from '../src/common/config/env.schema'

const VALID = { NODE_ENV: 'test', PORT: '3000', LOG_LEVEL: 'info' }

describe('env validation', () => {
  it('accepts a valid environment and applies defaults', () => {
    expect(loadEnv({ NODE_ENV: 'production' })).toEqual({
      NODE_ENV: 'production',
      PORT: 3000,
      LOG_LEVEL: 'info',
    })
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
