import { spawnSync } from 'node:child_process'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'

import { applyForceDemo, FORCE_DEMO_FLAG, runSeeds, seedModules } from '../../prisma/seed'
import { pocProfileSeed } from '../../prisma/seed/poc'
import { createTestDatabase, type TestDatabase } from '../support/db'

const API_DIR = fileURLToPath(new URL('../../', import.meta.url))
const SEED_DIR = join(API_DIR, 'prisma/seed')
const TSX = join(API_DIR, '../../node_modules/.bin/tsx')

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f)
    return statSync(p).isDirectory() ? files(p) : [p]
  })
}

describe('AC5 no real personal data in the seed', () => {
  const sources = files(SEED_DIR).filter((f) => /\.(ts|json)$/.test(f))
  const ALLOWED = new Set(['example.test', 'demo.test'])

  it('scans a non-trivial set of files', () => {
    expect(sources.length).toBeGreaterThan(20)
  })

  it('uses only the reserved e-mail domains example.test and demo.test', () => {
    const bad: string[] = []
    for (const f of sources) {
      const text = readFileSync(f, 'utf8')
      for (const m of text.matchAll(/[A-Za-z0-9._%+-]+@([A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)+)/g)) {
        if (!ALLOWED.has((m[1] as string).toLowerCase())) bad.push(`${f.slice(SEED_DIR.length)}: ${m[0]}`)
      }
    }
    expect(bad).toEqual([])
  })

  it('has no IC number or Malaysian mobile number', () => {
    const bad: string[] = []
    for (const f of sources) {
      const text = readFileSync(f, 'utf8')
      if (/\b\d{6}-\d{2}-\d{4}\b/.test(text)) bad.push(`${f.slice(SEED_DIR.length)}: IC-like`)
      for (const m of text.matchAll(/(?<![\d.])(?:\+?60|0)1\d[- ]?\d{7,8}(?!\d)/g)) {
        // The support config's placeholder 60100000000 is all zeros after the prefix: not a real number.
        if (!/^(?:\+?60|0)10+$/.test(m[0].replace(/[- ]/g, ''))) bad.push(`${f.slice(SEED_DIR.length)}: phone-like`)
      }
    }
    expect(bad).toEqual([])
  })

  it('never uses Math.random, Date.now or new Date() (ADR-0006)', () => {
    const code = (f: string): string => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
    const bad = sources.filter((f) => f.endsWith('.ts') && /Math\.random\(|Date\.now\(|new Date\(\)/.test(code(f)))
    expect(bad.map((f) => f.slice(SEED_DIR.length))).toEqual([])
  })
})

describe('AC7 production gating', () => {
  let db: TestDatabase
  beforeAll(async () => {
    db = await createTestDatabase()
  })
  afterAll(async () => {
    await db.drop()
  })

  const count = async (sql: string): Promise<number> => Number((await db.query<{ n: string }>(sql))[0]?.n)

  it('applyForceDemo sets the opt-in only when the flag is passed', () => {
    const env: Record<string, string | undefined> = { NODE_ENV: 'production' }
    expect(applyForceDemo(['--profile=poc'], env)).toBe(false)
    expect(env.ALLOW_DEMO_SEED).toBeUndefined()
    expect(applyForceDemo(['--profile=poc', FORCE_DEMO_FLAG], env)).toBe(true)
    expect(env.ALLOW_DEMO_SEED).toBe('true')
  })

  it('applyForceDemo rejects --force-demo=<value> instead of ignoring it', () => {
    const env: Record<string, string | undefined> = { NODE_ENV: 'production' }
    expect(() => applyForceDemo(['--force-demo=false'], env)).toThrow(/takes no value/)
    expect(env.ALLOW_DEMO_SEED).toBeUndefined()
  })

  it('the poc profile module refuses to run in production without the opt-in, and the runner skips it', async () => {
    const before = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    const allow = process.env.ALLOW_DEMO_SEED
    delete process.env.ALLOW_DEMO_SEED
    try {
      await expect(pocProfileSeed.run({ profile: 'poc', prisma: db.prisma } as never)).rejects.toThrow(/Refusing to seed demo data/)
    } finally {
      process.env.NODE_ENV = before
      if (allow !== undefined) process.env.ALLOW_DEMO_SEED = allow
    }
    const ran = await runSeeds(seedModules, { prisma: db.prisma, profile: 'poc', env: { NODE_ENV: 'production' } })
    expect(ran).toEqual(['core-school-packages', 'spm-subject-configs'])
    expect(ran).not.toContain('poc-profile')
    expect(await count(`select count(*)::text n from users`)).toBe(0)
  }, 60_000)

  describe('the seed command (tsx prisma/seed/index.ts)', () => {
    let fresh: TestDatabase
    beforeEach(async () => {
      fresh = await createTestDatabase()
    })
    afterEach(async () => {
      await fresh.drop()
    })
    const run = (cli: string[], extra: Record<string, string> = {}) =>
      spawnSync(TSX, ['prisma/seed/index.ts', ...cli], {
        cwd: API_DIR,
        encoding: 'utf8',
        timeout: 120_000,
        env: { ...process.env, NODE_ENV: 'production', DATABASE_URL: fresh.url, ALLOW_DEMO_SEED: '', BIJAK_POC_QUESTIONS: '', ...extra },
      })

    it('production without --force-demo loads the reference modules only', async () => {
      const r = run(['--profile=poc'])
      expect(r.status, r.stderr).toBe(0)
      expect(r.stdout).toContain('core-school-packages')
      expect(r.stdout).not.toContain('poc-profile')
      expect(Number((await fresh.query<{ n: string }>(`select count(*)::text n from users`))[0]?.n)).toBe(0)
    }, 150_000)

    it('production with --force-demo loads the poc profile', async () => {
      const r = run(['--profile=poc', FORCE_DEMO_FLAG])
      expect(r.status, r.stderr).toBe(0)
      expect(r.stdout).toContain('poc-profile')
      expect(Number((await fresh.query<{ n: string }>(`select count(*)::text n from users where email like '%@demo.test'`))[0]?.n)).toBeGreaterThan(0)
    }, 150_000)

    it('the existing ALLOW_DEMO_SEED=true mechanism still works without the flag', async () => {
      const r = run(['--profile=poc'], { ALLOW_DEMO_SEED: 'true', BIJAK_POC_QUESTIONS: 'true' })
      expect(r.status, r.stderr).toBe(0)
      expect(r.stdout).toContain('poc-profile')
      expect(Number((await fresh.query<{ n: string }>(`select count(*)::text n from users where email like '%@demo.test'`))[0]?.n)).toBeGreaterThan(0)
    }, 150_000)
  })
})
