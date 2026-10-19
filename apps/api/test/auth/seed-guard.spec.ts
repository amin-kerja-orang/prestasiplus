import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { assertSeedAllowed } from '../../prisma/seed'

describe('seed production guard', () => {
  it('refuses in production unless ALLOW_DEMO_SEED=1', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production' })).toThrow(/ALLOW_DEMO_SEED/)
    expect(() => assertSeedAllowed({ NODE_ENV: 'production', ALLOW_DEMO_SEED: '0' })).toThrow()
    expect(() => assertSeedAllowed({ NODE_ENV: 'production', ALLOW_DEMO_SEED: '1' })).not.toThrow()
    expect(() => assertSeedAllowed({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true' })).not.toThrow()
    expect(() => assertSeedAllowed({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'false' })).toThrow()
    expect(() => assertSeedAllowed({ NODE_ENV: 'development' })).not.toThrow()
    expect(() => assertSeedAllowed({ NODE_ENV: 'test' })).not.toThrow()
  })

  it('the seed command in production without the flag only runs reference modules (never refuses silently, never touches demo data)', () => {
    const cwd = fileURLToPath(new URL('../..', import.meta.url))
    const res = spawnSync(process.execPath, ['--import', 'tsx', 'prisma/seed/index.ts'], {
      cwd,
      encoding: 'utf8',
      env: { ...process.env, NODE_ENV: 'production', ALLOW_DEMO_SEED: 'false', DATABASE_URL: 'postgresql://x:y@127.0.0.1:1/none' },
    })
    // The unreachable database stops the reference seed; the demo modules were never attempted.
    expect(res.status).not.toBe(0)
    expect(res.stdout).not.toMatch(/core-identity/)
  }, 60_000)
})
