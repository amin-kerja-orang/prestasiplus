// Demo-bundle guard (overview §6.13, ADR-0011 amendment 1; F-08).
// Fails when a test-hook marker string is found in a build output, so the deployable demo `dist/`
// never ships `window.__mock`. Run against the e2e build (`dist-e2e/`) it must FAIL, which proves
// the markers are really emitted when the hooks are built in.
// It also enforces the size budget below (V2-T03, spike risk R7), but only for the default demo `dist`.
// Usage: node scripts/check-demo-bundle.mjs [dist-path]   (default `dist`)
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

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

/**
 * Size budget of the demo build (bytes), measured 2026-10-16 after V2-T03 (Nuxt UI, v2 tokens,
 * Phosphor icon bundle, v2 fonts CSS) plus 10 % headroom. Raise a value only with a reason in the PR.
 * Measured: entry js 243,693 raw / 67,866 gzip; entry css 458,684 / 66,372; all js 7,751,715 /
 * 2,186,106; all css 481,979 / 73,171.
 */
const BUDGET = {
  'entry js raw': { max: 268_100, get: (m) => m.entryJs.raw },
  'entry js gzip': { max: 74_700, get: (m) => m.entryJs.gzip },
  'entry css raw': { max: 504_600, get: (m) => m.entryCss.raw },
  'entry css gzip': { max: 73_100, get: (m) => m.entryCss.gzip },
  'all js raw': { max: 8_527_000, get: (m) => m.allJs.raw },
  'all js gzip': { max: 2_404_800, get: (m) => m.allJs.gzip },
  'all css raw': { max: 530_200, get: (m) => m.allCss.raw },
  'all css gzip': { max: 80_500, get: (m) => m.allCss.gzip },
}

/** @param {string[]} list */
function measure(list) {
  return list.reduce(
    (acc, f) => {
      const buf = readFileSync(f)
      return { raw: acc.raw + buf.length, gzip: acc.gzip + gzipSync(buf).length }
    },
    { raw: 0, gzip: 0 },
  )
}

/** @param {number} n */
const fmt = (n) => n.toLocaleString('en')

// Only the default demo `dist` is budgeted (an explicit path, e.g. the e2e build, is not).
if (process.argv[2] === undefined) {
  const all = files(DIST)
  /** @param {string} ext */
  const entry = (ext) =>
    all.filter((f) => new RegExp(`assets[\\\\/]index-[^\\\\/]*\\.${ext}$`).test(f))
  const m = {
    entryJs: measure(entry('js')),
    entryCss: measure(entry('css')),
    allJs: measure(all.filter((f) => f.endsWith('.js'))),
    allCss: measure(all.filter((f) => f.endsWith('.css'))),
  }
  const over = Object.entries(BUDGET).filter(([, b]) => b.get(m) > b.max)
  if (over.length > 0) {
    console.error(
      'check-demo-bundle: FAIL: size budget exceeded:\n' +
        over.map(([k, b]) => `${k}: ${fmt(b.get(m))} > ${fmt(b.max)}`).join('\n'),
    )
    process.exit(1)
  }
  console.log(
    'check-demo-bundle: size budget OK (' +
      Object.entries(BUDGET)
        .map(([k, b]) => `${k} ${fmt(b.get(m))}/${fmt(b.max)}`)
        .join('; ') +
      ')',
  )
}

console.log(
  `check-demo-bundle: OK (${String(MARKERS.length)} marker(s), ${String(scanned.length)} file(s) checked in ${DIST})`,
)
