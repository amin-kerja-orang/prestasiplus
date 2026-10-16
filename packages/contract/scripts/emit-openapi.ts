// `npm run contract:emit` writes packages/contract/openapi.json.
// `npm run contract:check` regenerates in memory and exits 1 if it differs from the committed file
// (the CI diff step; V2-T01 wires it into CI later).
import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { serializeOpenApi } from '../src/openapi'

const OUT = fileURLToPath(new URL('../openapi.json', import.meta.url))
const next = serializeOpenApi()

if (process.argv.includes('--check')) {
  let current = ''
  try {
    current = readFileSync(OUT, 'utf8')
  } catch {
    // a missing file counts as a difference
  }
  if (current.replace(/\r\n/g, '\n') !== next) {
    console.error(
      'contract:check failed: packages/contract/openapi.json is out of date. Run `npm run contract:emit` and commit.',
    )
    process.exit(1)
  }
  console.log('contract:check ok: openapi.json is up to date')
} else {
  writeFileSync(OUT, next)
  console.log(`contract:emit wrote ${OUT}`)
}
