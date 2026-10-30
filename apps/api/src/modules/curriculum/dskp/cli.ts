/**
 * Command line of `npm run dskp:load -w @pp/api -- [flags]` (R1-B04). Runbook: docs/ops/dskp-loader.md.
 * Host only; the Nest app never imports this file. Exit codes: 0 done, 1 a subject failed (the others
 * were still processed; a failed subject wrote nothing), 2 usage or DATABASE_URL missing.
 */
import { realpathSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { createPrismaClient } from '../../../db/client'
import { DSKP_DATA_DIR, exitCodeOf, formatDskpReport, readDskpSources, runDskpLoad } from './dskp-load'

export const USAGE = `Usage: npm run dskp:load -w @pp/api -- [--dry-run] [--subject <code|file>]... [--data-dir <folder>] [--create-missing-subjects]

  --dry-run                    Print the report without writing anything. Always do this first.
  --subject <code|file>        Only this subject (code such as MATH, or file name such as matematik). Repeatable.
  --data-dir <folder>          Read the extracts from this folder instead of the packaged data.
  --create-missing-subjects    Add LNR and KNP (inactive) when they are missing from "subjects". Off by default.
  --help                       This text.

Needs DATABASE_URL. The subjects and education_levels rows must exist (migrations and the base curriculum).`

export interface CliArgs {
  dryRun: boolean
  subjects: string[]
  dataDir: string | null
  createMissingSubjects: boolean
  help: boolean
}

export class UsageError extends Error {}

export function parseArgs(argv: readonly string[]): CliArgs {
  const args: CliArgs = { dryRun: false, subjects: [], dataDir: null, createMissingSubjects: false, help: false }
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i] as string
    const value = (): string => {
      const v = argv[++i]
      if (v === undefined || v.startsWith('--')) throw new UsageError(`${a} needs a value.`)
      return v
    }
    if (a === '--dry-run') args.dryRun = true
    else if (a === '--create-missing-subjects') args.createMissingSubjects = true
    else if (a === '--help' || a === '-h') args.help = true
    else if (a === '--subject') args.subjects.push(...value().split(',').filter(Boolean))
    else if (a.startsWith('--subject=')) args.subjects.push(...a.slice(10).split(',').filter(Boolean))
    else if (a === '--data-dir') args.dataDir = value()
    else if (a.startsWith('--data-dir=')) args.dataDir = a.slice(11)
    else throw new UsageError(`Unknown argument "${a}".`)
  }
  return args
}

export async function main(argv: readonly string[], env: NodeJS.ProcessEnv = process.env): Promise<number> {
  let args: CliArgs
  try {
    args = parseArgs(argv)
  } catch (e) {
    if (!(e instanceof UsageError)) throw e
    process.stderr.write(`${e.message}\n${USAGE}\n`)
    return 2
  }
  if (args.help) {
    process.stdout.write(`${USAGE}\n`)
    return 0
  }
  const url = env.DATABASE_URL
  if (!url) {
    process.stderr.write('DATABASE_URL is not set.\n')
    return 2
  }
  const sources = readDskpSources(args.dataDir ?? DSKP_DATA_DIR)
  if (sources.length === 0) {
    process.stderr.write('No *.json extract found in the data folder.\n')
    return 2
  }
  const prisma = createPrismaClient(url)
  try {
    const dbName = (await prisma.$queryRaw<{ name: string }[]>`SELECT current_database() AS name`)[0]?.name ?? '?'
    process.stdout.write(`Database: ${dbName}\n`)
    const report = await runDskpLoad(prisma, sources, {
      dryRun: args.dryRun,
      only: args.subjects,
      createMissingSubjects: args.createMissingSubjects,
      now: new Date(),
    })
    process.stdout.write(`${formatDskpReport(report)}\n`)
    return exitCodeOf(report)
  } catch (e) {
    // Never print the connection string; the Prisma message can quote it.
    const code = typeof e === 'object' && e !== null && 'code' in e ? String((e as { code: unknown }).code) : 'unknown'
    process.stderr.write(`DSKP load failed before any subject was processed (${code}).\n`)
    return 1
  } finally {
    await prisma.$disconnect()
  }
}

/** True when this file is the process entry (real path compare, so a symlink or wrapper path still runs). */
function isEntry(): boolean {
  const entry = process.argv[1]
  if (!entry) return false
  try {
    return realpathSync(entry) === realpathSync(fileURLToPath(import.meta.url))
  } catch {
    return false
  }
}

// Run only as the entry script (the spec imports `main` without running it).
if (isEntry()) {
  process.exitCode = await main(process.argv.slice(2)).catch(() => {
    process.stderr.write('DSKP load crashed; see the report above for what was committed.\n')
    return 1
  })
}
