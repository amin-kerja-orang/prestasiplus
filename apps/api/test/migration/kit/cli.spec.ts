import { afterAll, beforeAll, describe, expect, it } from 'vitest'

import { EXIT, loadCommands, parseArgs, runCli } from '../../../src/migration/cli'
import {
  hashInput,
  registerMigrateCommand,
  Runner,
  unregisterMigrateCommand,
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

const capture = () => {
  const out: string[] = []
  const err: string[] = []
  return { out, err, deps: { out: (l: string) => out.push(l), err: (l: string) => err.push(l), pool: kit.pool } }
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

  it('exits 2 without DATABASE_URL when no pool is injected, and loadCommands tolerates a missing folder', async () => {
    const x = capture()
    expect(await runCli(['migrate:demo'], { env: {}, out: (l) => x.out.push(l), err: (l) => x.err.push(l) })).toBe(EXIT.usage)
    expect(x.err.join('\n')).toMatch(/DATABASE_URL is not set/)
    await expect(loadCommands()).resolves.toBeUndefined()
  })
})
