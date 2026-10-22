import { spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

import { describe, expect, it, vi } from 'vitest'

import { assertSeedAllowed, runSeeds, type SeedModule } from '../../prisma/seed'

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

  it('fails closed: anything that is not explicitly development or test counts as production', () => {
    const gated: Array<string | undefined> = [undefined, '', 'Production', 'PRODUCTION', 'prod', 'staging', 'garbage', ' development', 'dev']
    for (const NODE_ENV of gated) {
      expect(() => assertSeedAllowed({ NODE_ENV }), `NODE_ENV=${String(NODE_ENV)}`).toThrow(/Refusing to seed demo data/)
      expect(() => assertSeedAllowed({ NODE_ENV, ALLOW_DEMO_SEED: 'false' }), `NODE_ENV=${String(NODE_ENV)}`).toThrow()
      // The explicit operator flag still opens the gate (the documented demo path).
      expect(() => assertSeedAllowed({ NODE_ENV, ALLOW_DEMO_SEED: 'true' })).not.toThrow()
      expect(() => assertSeedAllowed({ NODE_ENV, ALLOW_DEMO_SEED: '1' })).not.toThrow()
    }
    expect(() => assertSeedAllowed({})).toThrow(/ALLOW_DEMO_SEED/)
  })

  it('allows development and test, compared case-insensitively', () => {
    for (const NODE_ENV of ['development', 'test', 'Development', 'TEST']) {
      expect(() => assertSeedAllowed({ NODE_ENV }), `NODE_ENV=${NODE_ENV}`).not.toThrow()
    }
  })

  it('the documented demo path (NODE_ENV=production ALLOW_DEMO_SEED=true BIJAK_POC_QUESTIONS=true) is allowed', () => {
    expect(() => assertSeedAllowed({ NODE_ENV: 'production', ALLOW_DEMO_SEED: 'true', BIJAK_POC_QUESTIONS: 'true' })).not.toThrow()
  })

  it('runSeeds with NODE_ENV unset runs reference modules only (the demo modules are skipped, not loaded)', async () => {
    const ran: string[] = []
    const mods: SeedModule[] = [
      { name: 'ref-a', kind: 'reference', run: async () => void ran.push('ref-a') },
      { name: 'demo-b', run: async () => void ran.push('demo-b') },
    ]
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    try {
      expect(await runSeeds(mods, { env: {} })).toEqual(['ref-a'])
      expect(await runSeeds(mods, { env: { NODE_ENV: 'prod' } })).toEqual(['ref-a'])
      expect(ran).toEqual(['ref-a', 'ref-a'])
      expect(warn).toHaveBeenCalledWith(expect.stringMatching(/demo modules skipped.*demo-b/))
      expect(await runSeeds(mods, { env: { NODE_ENV: 'development' } })).toEqual(['ref-a', 'demo-b'])
    } finally {
      warn.mockRestore()
    }
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
