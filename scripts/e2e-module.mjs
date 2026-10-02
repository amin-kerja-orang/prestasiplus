// Run the E2E suite of one module (overview §13). Cross-platform replacement for
// `playwright test e2e/$MODULE`, because `$MODULE` does not expand in npm scripts on Windows.
//
// Usage:
//   npm run test:e2e:module -- m01-authentication [extra playwright args]
//   MODULE=m01-authentication npm run test:e2e:module
import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'

const require = createRequire(import.meta.url)

const [argModule, ...rest] = process.argv.slice(2)
const fromArg = argModule && !argModule.startsWith('-') ? argModule : undefined
const slug = fromArg ?? process.env.MODULE
const extra = fromArg ? rest : process.argv.slice(2)

if (!slug) {
  console.error(
    'e2e-module: no module given. Use `npm run test:e2e:module -- <slug>` or set MODULE=<slug>.',
  )
  process.exit(1)
}
if (!/^m\d{2}-[a-z0-9-]+$/.test(slug)) {
  console.error(`e2e-module: "${slug}" is not a module slug (expected e.g. m01-authentication).`)
  process.exit(1)
}
if (!existsSync(`e2e/${slug}`)) {
  console.error(`e2e-module: e2e/${slug}/ does not exist.`)
  process.exit(1)
}

const cli = require.resolve('@playwright/test/cli')
const result = spawnSync(process.execPath, [cli, 'test', `e2e/${slug}`, ...extra], {
  stdio: 'inherit',
})
process.exit(result.status ?? 1)
