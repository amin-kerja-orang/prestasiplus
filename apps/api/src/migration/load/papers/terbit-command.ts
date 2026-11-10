/**
 * The `migrate:terbit` command: the Terbit pass of the V2 papers (design 10.5 and 10.5a) as its own command, run AFTER `migrate:papers --apply`.
 *
 * It boots the Nest application context (`terbit-nest.ts`), which needs the decorator metadata the API build emits (vite + SWC). Under tsx (esbuild,
 * no `emitDecoratorMetadata`) the providers cannot resolve their dependencies, so this command is NOT run with tsx: it is the second bundle of the
 * API build, `dist/migrate-terbit.js` (`vite.build.terbit.config.ts`, entry `terbit-cli.ts`), run with node from the api / migrate image:
 *
 *   node dist/migrate-terbit.js -- [--dry-run | --apply] [--out-dir=<.migration-out path>]
 *
 * Dry-run (the default) only counts the candidates (V2-published papers still draft) and the ones held at load; nothing is published.
 * `--apply` (with `PP_ALLOW_MIGRATE_APPLY=1`) publishes through `BuilderService.publish` with the audited override and writes `papers-terbit-<run>.csv`.
 * Idempotent: only papers that are still `draft` are candidates, so a second run publishes nothing new. Environment: DATABASE_URL and the API's own
 * env (SESSION_SECRET, FILE_STORAGE_DIR, ...). Counts and ids only in the output.
 */
import { randomBytes } from 'node:crypto'
import { writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

import { registerMigrateCommand, withSourceLock, type CliContext, type CommandArgs, type MigrateCommand } from '../../kit'
import { ApplyGuardError } from '../../kit/apply-guard'
import { prepareOutputDir, ProfileOutputError } from '../../profile'
import { findMigrationActor, openTerbitPublisher } from './terbit-nest'
import { runTerbitPass, terbitCandidates, terbitCsv } from './terbit-pass'

const KNOWN_FLAGS: ReadonlySet<string> = new Set(['out-dir'])

export function parseTerbitArgs(args: CommandArgs, prepare: (dir: string) => string = prepareOutputDir): { outDir: string } {
  for (const name of args.flags.keys()) if (!KNOWN_FLAGS.has(name)) throw new ApplyGuardError(`unknown flag --${name}.`)
  if (args.positional.length > 0) throw new ApplyGuardError('unexpected argument: this command takes flags only (--name=value).')
  const raw = args.flags.get('out-dir')
  if (raw === true) throw new ApplyGuardError('--out-dir needs a value.')
  try {
    return { outDir: prepare(raw === undefined ? resolve('.migration-out') : resolve(raw)) }
  } catch (e) {
    if (e instanceof ProfileOutputError) throw new ApplyGuardError(`--out-dir: ${e.message}`)
    throw e
  }
}

export const migrateTerbit: MigrateCommand = {
  name: 'migrate:terbit',
  summary: 'publishes the V2-published papers through the real publish gate with the audited legacy override (after migrate:papers --apply; run with node from the built bundle; dry-run by default)',
  async run(args: CommandArgs, ctx: CliContext): Promise<number> {
    const { outDir } = parseTerbitArgs(args)
    const stamp = `${new Date().toISOString().replace(/\D/g, '').slice(0, 14)}-${randomBytes(3).toString('hex')}`
    return withSourceLock(ctx.pool, 'cloud', async () => {
      if (args.mode !== 'apply') {
        const c = await terbitCandidates(ctx.pool, 'cloud')
        const held = c.filter((x) => x.holds.length > 0).length
        ctx.out(`migrate:terbit dry-run: ${c.length} candidate(s), ${held} held at load, ${c.length - held} would go to the gate (nothing published)`)
        return 0
      }
      const actor = await findMigrationActor(ctx.pool)
      if (actor === null) {
        ctx.err('migrate:terbit: no Admin Pusat user exists to act as the Terbit actor; nothing was published.')
        return 1
      }
      const opened = await openTerbitPublisher(actor)
      try {
        const t = await runTerbitPass(ctx.pool, 'cloud', opened.publish)
        for (const [k, v] of Object.entries({ considered: t.considered, published: t.published, legacy: t.legacy, failed: t.failed, held: t.held })) ctx.out(`terbit ${k}: ${v}`)
        const csv = join(outDir, `papers-terbit-${stamp}.csv`)
        writeFileSync(csv, terbitCsv(t), { encoding: 'utf8', mode: 0o600, flag: 'wx' })
        ctx.out(`terbit report: ${csv}`)
        return 0
      } finally {
        await opened.close()
      }
    })
  },
}

registerMigrateCommand(migrateTerbit)
