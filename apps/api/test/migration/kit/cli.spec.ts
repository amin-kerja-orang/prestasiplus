import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { EXIT, loadCommands, parseArgs, runCli } from '../../../src/migration/cli'
import {
  hashInput,
  registerMigrateCommand,
  Runner,
  unregisterMigrateCommand,
  upsertByLegacy,
  type CliContext,
  type CommandArgs,
} from '../../../src/migration/kit'
import { createKitDb, DEMO_DDL, demoRows, demoStep, type KitDb } from './helpers'

let kit: KitDb
beforeAll(async () => {
  kit = await createKitDb()
  await kit.db.query(DEMO_DDL)
  // A demo command, registered the way BE-27..30 commands will do it (tests only).
  registerMigrateCommand({
    name: 'migrate:demo',
    summary: 'demo entity (tests only)',
    async run(args: CommandArgs, ctx: CliContext) {
      const report = await new Runner({ pool: ctx.pool }).run({
        mode: args.mode,
        steps: [demoStep(demoRows(6))],
        inputHash: hashInput(['cli-demo']),
      })
      ctx.out(`run ${report.runId} ${report.mode} ${report.status}`)
      return report.status === 'succeeded' ? 0 : 1
    },
  })
})
afterAll(async () => {
  unregisterMigrateCommand('migrate:demo')
  await kit.close()
})

const ALLOW = { PP_ALLOW_MIGRATE_APPLY: '1' }
const capture = (env: Record<string, string | undefined> = ALLOW) => {
  const out: string[] = []
  const err: string[] = []
  return { out, err, deps: { env, out: (l: string) => out.push(l), err: (l: string) => err.push(l), pool: kit.pool } }
}

describe('migration CLI', () => {
  it('parses --dry-run (default), --apply, flags and positionals; both modes together is a usage error', () => {
    expect(parseArgs(['migrate:x']).args.mode).toBe('dry-run')
    expect(parseArgs(['migrate:x', '--dry-run']).args.mode).toBe('dry-run')
    const p = parseArgs(['migrate:x', 'extra', '--apply', '--since', '2026-01-01', '--entity=users', '--verbose'])
    expect(p.command).toBe('migrate:x')
    expect(p.args.mode).toBe('apply')
    expect(p.args.flags.get('since')).toBe('2026-01-01')
    expect(p.args.flags.get('entity')).toBe('users')
    expect(p.args.flags.get('verbose')).toBe(true)
    expect(p.args.positional).toEqual(['extra'])
    expect(() => parseArgs(['migrate:x', '--apply', '--dry-run'])).toThrow(/not both/)
  })

  it('lists registered commands, and reports unknown commands with exit code 2', async () => {
    const a = capture()
    expect(await runCli(['migrate:list'], a.deps)).toBe(EXIT.ok)
    expect(a.out.join('\n')).toMatch(/migrate:demo/)
    const b = capture()
    expect(await runCli(['migrate:nope'], b.deps)).toBe(EXIT.usage)
    expect(b.err.join('\n')).toMatch(/Unknown command "migrate:nope"/)
    const c = capture()
    expect(await runCli(['migrate:demo', '--apply', '--dry-run'], c.deps)).toBe(EXIT.usage)
  })

  it('AC3: a command defaults to dry-run; --apply without a passing dry-run exits non-zero with a clear message', async () => {
    await kit.db.query('delete from etl_runs')
    const refused = capture()
    const code = await runCli(['migrate:demo', '--apply'], refused.deps)
    expect(code).toBe(EXIT.applyRefused)
    expect(code).not.toBe(0)
    expect(refused.err.join('\n')).toMatch(/Refusing --apply: no passing dry-run found for input hash [0-9a-f]{64}/)
    expect(Number((await kit.db.query<{ n: string }>('select count(*) n from demo_items'))[0]?.n)).toBe(0)

    const dry = capture()
    expect(await runCli(['migrate:demo'], dry.deps)).toBe(EXIT.ok)
    expect(dry.out.join('\n')).toMatch(/dry-run succeeded/)
    expect(Number((await kit.db.query<{ n: string }>('select count(*) n from demo_items'))[0]?.n)).toBe(0)

    const apply = capture()
    expect(await runCli(['migrate:demo', '--apply'], apply.deps)).toBe(EXIT.ok)
    expect(Number((await kit.db.query<{ n: string }>('select count(*) n from demo_items'))[0]?.n)).toBe(6)
  })

  it('M3: --apply needs PP_ALLOW_MIGRATE_APPLY=1; dry-run needs nothing', async () => {
    await kit.db.query('delete from etl_runs')
    const noVar = capture({})
    expect(await runCli(['migrate:demo', '--apply'], noVar.deps)).toBe(EXIT.usage)
    expect(noVar.err.join('\n')).toMatch(/set PP_ALLOW_MIGRATE_APPLY=1/)
    const wrong = capture({ PP_ALLOW_MIGRATE_APPLY: 'true' })
    expect(await runCli(['migrate:demo', '--apply'], wrong.deps)).toBe(EXIT.usage)
    const dry = capture({})
    expect(await runCli(['migrate:demo'], dry.deps)).toBe(EXIT.ok)
    expect(await runCli(['migrate:demo'], capture({ NODE_ENV: 'production' }).deps)).toBe(EXIT.ok)
  })

  it('M3: in production --apply needs PP_MIGRATE_TARGET_DB equal to current_database(); host and db are printed, no credentials', async () => {
    const dbName = (await kit.db.query<{ db: string }>('select current_database() db'))[0]?.db ?? ''
    const url = 'postgres://some_user:S3cretPw@db.internal.example:5432/' + dbName
    for (const nodeEnv of ['production', 'PRODUCTION', 'prod', ' Prod ']) {
      const none = capture({ ...ALLOW, NODE_ENV: nodeEnv, DATABASE_URL: url })
      expect(await runCli(['migrate:demo', '--apply'], none.deps), nodeEnv).toBe(EXIT.usage)
      expect(none.err.join('\n')).toMatch(/PP_MIGRATE_TARGET_DB must equal the connected database name/)
      const wrong = capture({ ...ALLOW, NODE_ENV: nodeEnv, PP_MIGRATE_TARGET_DB: 'other_db', DATABASE_URL: url })
      expect(await runCli(['migrate:demo', '--apply'], wrong.deps), nodeEnv).toBe(EXIT.usage)
      const shown = [...none.out, ...none.err, ...wrong.out, ...wrong.err].join('\n')
      expect(shown).toContain('db.internal.example')
      expect(shown).not.toMatch(/S3cretPw|some_user/)
    }
    // matching target: the guard passes and the command is reached (no passing dry-run yet, so exit 3)
    await kit.db.query('delete from etl_runs')
    const ok = capture({ ...ALLOW, NODE_ENV: 'production', PP_MIGRATE_TARGET_DB: dbName, DATABASE_URL: url })
    expect(await runCli(['migrate:demo', '--apply'], ok.deps)).toBe(EXIT.applyRefused)
    expect(ok.out.join('\n')).toContain(`database "${dbName}" on db.internal.example`)
    expect(ok.out.join('\n')).not.toMatch(/S3cretPw|some_user/)
  })

  it('a bad value never reaches CLI stderr, from the kit upsert or from a raw loader query', async () => {
    const secret = 'IC-900101-14-5555'
    registerMigrateCommand({
      name: 'migrate:badkit',
      summary: 'bad value through the kit (tests only)',
      async run(args: CommandArgs, ctx: CliContext) {
        const report = await new Runner({ pool: ctx.pool }).run({
          mode: args.mode,
          inputHash: hashInput(['badkit']),
          steps: [
            {
              entity: 'demo_items',
              source: 'cloud',
              extract: () => [{ id: 1 }],
              keyOf: (r: { id: number }) => String(r.id),
              async load(_rows: { id: number }[], bctx) {
                return upsertByLegacy(bctx.db, {
                  table: 'demo_items',
                  source: 'cloud',
                  columns: ['code', 'born_at'],
                  rows: [{ legacyId: '1', values: { code: 'X', born_at: secret } }],
                })
              },
            },
          ],
        })
        return report.status === 'succeeded' ? 0 : 1
      },
    })
    registerMigrateCommand({
      name: 'migrate:badraw',
      summary: 'bad value in a raw query (tests only)',
      async run(_args: CommandArgs, ctx: CliContext) {
        await ctx.pool.query('select $1::date', [secret])
        return 0
      },
    })
    try {
      for (const name of ['migrate:badkit', 'migrate:badraw']) {
        const c = capture()
        expect(await runCli([name], c.deps), name).toBe(EXIT.failed)
        const text = c.err.join('\n')
        expect(text, name).toMatch(/Database error SQLSTATE [0-9A-Z]{5}/)
        expect(text, name).not.toContain(secret)
        expect(text, name).not.toMatch(/invalid input syntax/i)
      }
    } finally {
      unregisterMigrateCommand('migrate:badkit')
      unregisterMigrateCommand('migrate:badraw')
    }
  })

  it('exits 2 without DATABASE_URL when no pool is injected, and loadCommands tolerates a missing folder', async () => {
    const x = capture()
    expect(await runCli(['migrate:demo'], { env: {}, out: (l) => x.out.push(l), err: (l) => x.err.push(l) })).toBe(EXIT.usage)
    expect(x.err.join('\n')).toMatch(/DATABASE_URL is not set/)
    await expect(loadCommands()).resolves.toBeUndefined()
  })
})
