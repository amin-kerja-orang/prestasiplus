/**
 * Entry of `npm run bijak:k1-drafts -w @pp/api -- <flags>` (slug `bijak-k1-papers`, LEAD decision D-6 = B2). Host only: run it from a
 * shell on the server inside the migrate image (`docker compose ... run --rm --no-deps migrate npm run bijak:k1-drafts -w @pp/api -- ...`),
 * like `admin:bootstrap`. The Nest app never imports it, so no HTTP route reaches it. It reads `DATABASE_URL` from the environment.
 *
 * Exit codes: 0 done (or a clean dry-run), 1 a write failed, 2 usage, missing DATABASE_URL or no Admin Pusat user, 3 something is
 * blocked and needs a decision (a stock that is too short is only reported; a blueprint that does not fit, a missing paper code or
 * an overlap with an earlier draft is blocked).
 */
import { parseArgs, USAGE, UsageError } from './args'
import { ActorError, connectGateway } from './gateway'
import { runK1Drafts } from './run'

const write = (line: string): void => {
  process.stdout.write(`${line}\n`)
}

async function main(): Promise<number> {
  let opts
  try {
    opts = parseArgs(process.argv.slice(2))
  } catch (e) {
    if (e instanceof UsageError) {
      process.stderr.write(`${e.message}\n\n${USAGE}\n`)
      return 2
    }
    throw e
  }
  if (opts === 'help') {
    write(USAGE)
    return 0
  }
  const url = process.env.DATABASE_URL
  if (!url) {
    process.stderr.write('DATABASE_URL is not set.\n')
    return 2
  }
  const { gateway, close } = await connectGateway(url, opts.actorId)
  try {
    const summary = await runK1Drafts(gateway, opts, write)
    return summary.exit
  } catch (e) {
    if (e instanceof ActorError) {
      process.stderr.write(`${e.message}\n`)
      return 2
    }
    process.stderr.write(`bijak-k1-drafts failed: ${e instanceof Error ? e.name : 'unknown error'}\n`)
    return 1
  } finally {
    await close()
  }
}

process.exitCode = await main()
