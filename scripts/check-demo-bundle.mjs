// Demo-bundle guard (overview §6.13, ADR-0011 amendment 1; F-08).
// Fails when a test-hook marker string is found in a build output, so the deployable demo `dist/`
// never ships `window.__mock`. Run against the e2e build (`dist-e2e/`) it must FAIL, which proves
// the markers are really emitted when the hooks are built in.
// Usage: node scripts/check-demo-bundle.mjs [dist-path]   (default `dist`)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const DIST = process.argv[2] ?? 'dist'

/**
 * - The dedicated sentinel `TEST_HOOKS_SENTINEL` of `src/mock/testing/hooks.ts` (keep in step; a
 *   unit test in `src/mock/testing/__tests__` checks it). Not `__mock` / `__MOCK_INIT__`: those
 *   names may legitimately appear in the mock core of the demo build.
 * - `__charts`: the dev/e2e chart registry of F-17 (`src/components/chart/registry.ts`).
 * - `__e2e/report-modal`: the M04 S14 modal harness route (`routes/reports.ts`), registered only with the test hooks.
 * @type {string[]}
 */
const MARKERS = ['pp-test-hooks-sentinel-5c1f0e7a', '__charts', '__e2e/report-modal']

if (!existsSync(join(DIST, 'index.html'))) {
  console.error(`check-demo-bundle: ${DIST}/index.html not found. Run the demo build first.`)
  process.exit(1)
}

/** @param {string} dir @returns {string[]} */
function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? files(path) : [path]
  })
}

const scanned = files(DIST).filter((f) => /\.(js|mjs|cjs|html|css|map)$/.test(f))
const hits = scanned.flatMap((f) => {
  const text = readFileSync(f, 'utf8')
  return MARKERS.filter((m) => text.includes(m)).map((m) => `${f}: ${m}`)
})

if (hits.length > 0) {
  console.error(`check-demo-bundle: FAIL: test-hook marker found in ${DIST}:\n` + hits.join('\n'))
  process.exit(1)
}
console.log(
  `check-demo-bundle: OK (${String(MARKERS.length)} marker(s), ${String(scanned.length)} file(s) checked in ${DIST})`,
)
