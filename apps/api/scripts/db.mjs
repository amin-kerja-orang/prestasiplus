// `npm run be:db:migrate|reset|seed`. Loads ../../.env.api when present (real environment wins),
// then runs Prisma or the seed runner. `reset` refuses to run when NODE_ENV=production.
import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

const [command, ...rest] = process.argv.slice(2)

const envFile = new URL('../../../.env.api', import.meta.url)
if (existsSync(envFile)) {
  for (const [k, v] of Object.entries(parseEnv(readFileSync(envFile, 'utf8')))) {
    if (process.env[k] === undefined) process.env[k] = v
  }
}

const fail = (message) => {
  console.error(message)
  process.exit(1)
}

if (command === 'reset' && process.env.NODE_ENV === 'production') {
  fail('be:db:reset is disabled when NODE_ENV=production. The database was not touched.')
}
if (!process.env.DATABASE_URL) fail('DATABASE_URL is not set (see .env.api.example).')

const commands = {
  migrate: ['prisma', 'migrate', 'deploy'],
  reset: ['prisma', 'migrate', 'reset', '--force'],
  seed: ['tsx', 'prisma/seed/index.ts'],
}
const argv = commands[command]
if (!argv) fail(`Unknown command "${command}" (use migrate, reset or seed).`)

const result = spawnSync(argv[0], [...argv.slice(1), ...rest], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
})
process.exit(result.status ?? 1)
