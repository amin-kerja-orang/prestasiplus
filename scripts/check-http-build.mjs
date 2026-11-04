// HTTP-build mock-path audit (S0-T09; FR-X2-0, register 6.2b row 17).
// Builds the app in http mode (`VITE_API_MODE=http`, like docker/frontend/Dockerfile + compose.http.yaml)
// and fails when any chunk the app can load holds a mock module (data). Output: one line per finding, exit 1 when
// any line exists, 0 otherwise.
//
// Roots are derived from the Vite manifest, NOT from parsed route files (the parser misses routes built by helpers,
// cross-module route lists and the shell layouts): the `index.html` entry plus every `isDynamicEntry` chunk that is
// not itself a mock module. The route table under `src/app/router` (decision D115; NOT `prototype-scope.ts`; core
// routes + each module of `src/app/modules.ts`, found by regex over `path:` and lazy `component: () => import('...')`)
// is used only to LABEL a root with its route path(s); a root without a known route is labelled with its manifest key.
// Per root the walk follows static `imports`; a chunk first reached by an earlier root (the entry goes first) is
// attributed to that root.
//
// Mock module rule (MOCK_MODULE_RE): a source path under `src/mock/**` or `src/modules/<module>/mock/**`, with
// either path separator. Not matched: `__tests__` paths, node_modules, and names that only contain "mock"
// (`mock-exam`, `mock-lib`, `mock-extractor`, `src/modules/x/mock-data/`...).
// Findings (any edge, static or dynamic, from a non-mock chunk to a chunk holding mock sources):
//   `<label> -> <chunk> -> <mock module>`                              a reached chunk holds mock sources
//   `<label> -> <importer chunk> =dyn=> <mock chunk> (<mock module>)`  dynamic import of a mock-holding chunk
// Allow-list of 1: the guarded `import('@/mock')` in `src/app/bootstrap.ts` (edge: the chunk whose source map lists
// bootstrap.ts -> manifest entry `src/mock/index.ts`). That edge is not followed, so chunks reachable ONLY through it
// are allowed. Limit: the edge is identified per chunk, so a second `import('@/mock')` inside the same chunk would be
// allowed too (the manifest cannot tell them apart).
//
// Usage: node scripts/check-http-build.mjs [--dist <dir>]   (--dist audits an existing build; it needs
// `<dir>/.vite/manifest.json` and source maps, i.e. `vite build --manifest --sourcemap`.) `--dist` without a value
// exits 2.
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, posix, relative, resolve, sep } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const PREFIX = 'check-http-build:'
const ENTRY_KEY = 'index.html'
/** The one allowed dynamic edge: the chunk holding src/app/bootstrap.ts -> this manifest entry (`import('@/mock')`). */
export const ALLOWED_DYNAMIC_TARGET = 'src/mock/index.ts'
const BOOTSTRAP_RE = /(?:^|\/)src\/app\/bootstrap\.ts$/

/** `src/mock/**` or `src/modules/<module>/mock/**`; never `__tests__` or node_modules paths. */
export const MOCK_MODULE_RE =
  /^(?!.*node_modules)(?:.*[\\/])?src[\\/](?:mock|modules[\\/][^\\/]+[\\/]mock)[\\/](?!(?:[^\\/]*[\\/])*__tests__[\\/])/

const toPosix = (p) => p.split(sep).join('/').replace(/\\/g, '/')
const FILE_EXT = ['', '.ts', '.vue', '.js', '.mjs', '/index.ts', '/index.vue', '/index.js']

/** Resolve an import specifier found in `fromFile` (repo-relative posix) to a repo-relative file, or null. */
function resolveImport(repoRoot, fromFile, spec) {
  let base
  if (spec.startsWith('@/')) base = posix.join('src', spec.slice(2))
  else if (spec.startsWith('.')) base = posix.join(posix.dirname(fromFile), spec)
  else return null
  for (const ext of FILE_EXT) {
    const cand = base + ext
    const abs = join(repoRoot, cand)
    if (existsSync(abs) && statSync(abs).isFile()) return cand
  }
  return null
}

/** Strip comments so commented-out routes are not read as routes. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1')
}

/** Specifiers of static `import ... from '...'` and `export ... from '...'` statements. */
function staticImportSpecs(src) {
  const out = []
  const re = /(?:^|\n)\s*(?:import|export)\s+(?:type\s+)?[^'"\n;]*?\bfrom\s*['"]([^'"]+)['"]/g
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(m[1])
  return out
}

/**
 * Matrix routes: `{ routes: [{ path, component, source }], warnings }`. `component` is the repo-relative key of
 * the lazy page, or null when it could not be resolved (a warning is added).
 */
export function collectRoutes(repoRoot) {
  const warnings = []
  const routes = []
  const seenFiles = new Set()

  /** Read one routes file; follow relative imports of sibling route fragments (same module, not pages/api). */
  function scan(file, followRoot) {
    if (seenFiles.has(file)) return
    seenFiles.add(file)
    const abs = join(repoRoot, file)
    if (!existsSync(abs)) {
      warnings.push(`routes file not found: ${file}`)
      return
    }
    const src = stripComments(readFileSync(abs, 'utf8'))
    const re = /\bpath\s*:\s*(['"`])([^'"`]*)\1|\bcomponent\s*:\s*\(\)\s*=>\s*import\(\s*(['"`])([^'"`]+)\3\s*\)/g
    let currentPath = null
    for (let m = re.exec(src); m; m = re.exec(src)) {
      if (m[2] !== undefined) {
        currentPath = m[2]
        continue
      }
      const target = resolveImport(repoRoot, file, m[4])
      if (!target) warnings.push(`route ${currentPath ?? '?'} in ${file}: component ${m[4]} cannot be resolved`)
      routes.push({ path: currentPath ?? '?', component: target, source: file })
    }
    for (const spec of staticImportSpecs(src)) {
      const dep = resolveImport(repoRoot, file, spec)
      // Only route fragments inside the same module/router folder (no pages, stores, api).
      if (dep && dep.startsWith(followRoot) && /\.ts$/.test(dep) && /(^|\/)(routes?|router)(\/|\.ts$)/.test(dep)) {
        scan(dep, followRoot)
      }
    }
  }

  // buildRoutes: core routes + registry modules.
  scan('src/app/router/core-routes.ts', 'src/app/router/')
  const modulesPath = join(repoRoot, 'src/app/modules.ts')
  const modulesSrc = existsSync(modulesPath) ? stripComments(readFileSync(modulesPath, 'utf8')) : ''
  const slugs = [...modulesSrc.matchAll(/from\s*['"]@\/modules\/([^'"/]+)['"]/g)].map((m) => m[1])
  if (slugs.length === 0) warnings.push('no module found in src/app/modules.ts')
  for (const slug of slugs) {
    const root = `src/modules/${slug}/`
    const file = ['routes.ts', 'routes/index.ts'].map((f) => root + f).find((f) => existsSync(join(repoRoot, f)))
    if (!file) warnings.push(`module ${slug}: no routes.ts`)
    else scan(file, root)
  }
  return { routes, warnings }
}

/** Mock modules among the `sources` of one source-map JSON (string or object); `chunkFile` is the chunk path inside the build dir. */
export function mockSourcesOf(mapJson, chunkFile = '') {
  const map = typeof mapJson === 'string' ? JSON.parse(mapJson) : mapJson
  const dir = posix.dirname(toPosix(chunkFile))
  const found = new Set()
  for (const s of map.sources ?? []) {
    let p = toPosix(String(s))
    if (p.startsWith('.')) p = posix.normalize(posix.join(dir, p))
    p = p.replace(/^(\.\.\/)+/, '')
    // An outDir outside the repo leaves an absolute-looking prefix; report from `src/` on.
    if (MOCK_MODULE_RE.test(p)) found.add(p.replace(/^.*?(?:^|\/)(src\/(?:mock|modules\/))/, '$1'))
  }
  return [...found].sort()
}

/**
 * Audit roots, derived from the manifest (not from parsed route files): the `index.html` entry plus every
 * `isDynamicEntry` chunk that is not itself a mock module (key not matching MOCK_MODULE_RE). Chunks that nothing
 * loads dynamically are reached through their importers. `routes` (from collectRoutes) only LABELS a root with its
 * route path(s) where the lazy component is known; otherwise the label is the manifest key.
 * Returns `[{ key, label, routed }]`, the entry first.
 */
export function findRoots(manifest, routes = []) {
  const pathsOf = new Map()
  for (const r of routes) {
    if (!r.component) continue
    pathsOf.set(r.component, [...(pathsOf.get(r.component) ?? []), r.path])
  }
  const roots = []
  if (manifest[ENTRY_KEY]) roots.push({ key: ENTRY_KEY, label: '(entry)', routed: false })
  for (const [key, entry] of Object.entries(manifest)) {
    if (key === ENTRY_KEY || !entry.isDynamicEntry || MOCK_MODULE_RE.test(key)) continue
    const paths = pathsOf.get(key)
    roots.push({ key, label: paths ? [...new Set(paths)].join(' | ') : key, routed: Boolean(paths) })
  }
  return roots
}

/** Normalised source paths of one source map (relative paths resolved against the chunk location). */
function allSourcesOf(mapJson, chunkFile) {
  const map = typeof mapJson === 'string' ? JSON.parse(mapJson) : mapJson
  const dir = posix.dirname(toPosix(chunkFile))
  return (map.sources ?? []).map((s) => {
    const p = toPosix(String(s))
    return p.startsWith('.') ? posix.normalize(posix.join(dir, p)) : p
  })
}

/**
 * Graph walk from every root (one shared visited set: a chunk is attributed to the first root that reaches it, the
 * entry first). Per root it follows static `imports` only; dynamic targets are roots of their own (or reached as
 * static dependencies of one). Findings, for every non-mock chunk reached:
 *  - a chunk that itself holds mock sources (reached by static import):  `<label> -> <chunk> -> <mock module>`
 *  - a dynamic edge to a chunk holding mock sources:  `<label> -> <importer chunk> =dyn=> <mock chunk> (<mock module>)`
 * Allow-list of 1 (ALLOWED_DYNAMIC_TARGET): the edge from the chunk whose source map lists `src/app/bootstrap.ts` to the
 * manifest entry `src/mock/index.ts` is skipped, so chunks reachable ONLY through it are allowed. Limit: the edge is
 * identified per chunk (the importing chunk shows bootstrap.ts in its source map and targets that manifest entry), so a
 * second `import('@/mock')` inside that same chunk would be allowed too; the manifest cannot tell them apart.
 * Returns `{ lines, roots }`.
 */
export function auditGraph(manifest, maps, routes = []) {
  const mocksOfFile = (file) => (maps[file] ? mockSourcesOf(maps[file], file) : [])
  const holdsMock = (key) => Boolean(manifest[key]) && mocksOfFile(manifest[key].file).length > 0
  const bootstrapFiles = new Set(
    Object.values(manifest)
      .map((e) => e.file)
      .filter((f) => maps[f] && allSourcesOf(maps[f], f).some((p) => BOOTSTRAP_RE.test(p))),
  )
  const roots = findRoots(manifest, routes)
  const lines = []
  const seen = new Set()
  for (const { key: start, label } of roots) {
    const stack = [start]
    while (stack.length > 0) {
      const key = stack.pop()
      const entry = manifest[key]
      if (!entry || seen.has(key)) continue
      seen.add(key)
      const own = mocksOfFile(entry.file)
      if (own.length > 0) {
        for (const m of own) lines.push(`${label} -> ${entry.file} -> ${m}`)
        continue // a mock chunk is reported once; its own dependencies are not walked
      }
      stack.push(...(entry.imports ?? []))
      for (const dep of entry.dynamicImports ?? []) {
        if (dep === ALLOWED_DYNAMIC_TARGET && bootstrapFiles.has(entry.file)) continue
        if (holdsMock(dep)) lines.push(`${label} -> ${entry.file} =dyn=> ${manifest[dep].file} (${mocksOfFile(manifest[dep].file)[0]})`)
      }
    }
  }
  return { lines: [...new Set(lines)], roots }
}

/** `maps`: `{ [chunkFile]: mapJson }`. Returns the finding lines of `auditGraph`. */
export function audit(manifest, maps, routes = []) {
  return auditGraph(manifest, maps, routes).lines
}

function readMaps(dist) {
  const maps = {}
  const walk = (d) => {
    for (const n of readdirSync(d)) {
      const p = join(d, n)
      if (statSync(p).isDirectory()) walk(p)
      else if (n.endsWith('.js.map')) maps[toPosix(relative(dist, p)).replace(/\.map$/, '')] = readFileSync(p, 'utf8')
    }
  }
  walk(dist)
  return maps
}

/** Runs `cmd`, collecting its output; `onChild` receives the child so a signal handler can kill it. */
function runCapture(cmd, args, options, onChild) {
  return new Promise((resolveRun) => {
    const child = spawn(cmd, args, { ...options, stdio: ['ignore', 'pipe', 'pipe'] })
    onChild(child)
    let out = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (out += d))
    child.on('error', (e) => resolveRun({ status: 1, out: `${out}${e.message}` }))
    child.on('close', (status, signal) => resolveRun({ status: status ?? (signal ? 1 : 0), signal, out }))
  })
}

async function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const args = process.argv.slice(2)
  const di = args.indexOf('--dist')
  if (di >= 0 && (!args[di + 1] || args[di + 1].startsWith('--'))) {
    console.error(`${PREFIX} --dist needs a directory (usage: node scripts/check-http-build.mjs [--dist <dir>])`)
    return 2
  }
  let dist = di >= 0 ? resolve(args[di + 1]) : null
  let tmp = null
  let buildChild = null
  const cleanup = () => {
    if (tmp) rmSync(tmp, { recursive: true, force: true })
  }
  const onSignal = (signal) => () => {
    buildChild?.kill('SIGTERM')
    cleanup()
    process.exit(signal === 'SIGINT' ? 130 : 143)
  }
  process.on('SIGINT', onSignal('SIGINT'))
  process.on('SIGTERM', onSignal('SIGTERM'))
  try {
    if (!dist) {
      tmp = mkdtempSync(join(tmpdir(), 'check-http-build-'))
      dist = tmp
      const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx'
      const env = {
        ...process.env,
        VITE_API_MODE: 'http',
        VITE_TEST_HOOKS: 'false',
        VITE_PROTOTYPE_SCOPE: 'on',
        VITE_MOCK_LATENCY_MS: '400',
        VITE_API_BASE_URL: '',
      }
      delete env.VITE_ARTIFACT
      const r = await runCapture(
        npx,
        ['vite', 'build', '--mode', 'http', '--manifest', '--sourcemap', '--outDir', tmp, '--emptyOutDir'],
        { cwd: repoRoot, env },
        (c) => (buildChild = c),
      )
      if (r.status !== 0) {
        console.error(r.out.split('\n').slice(-40).join('\n'))
        console.error(`${PREFIX} vite build failed (exit ${r.status})`)
        return 1
      }
    }
    const manifestPath = join(dist, '.vite', 'manifest.json')
    if (!existsSync(manifestPath)) {
      console.error(`${PREFIX} ${manifestPath} not found (build with --manifest --sourcemap)`)
      return 1
    }
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
    const maps = readMaps(dist)
    if (Object.keys(maps).length === 0) {
      console.error(`${PREFIX} no *.js.map found in ${dist}; build with --sourcemap`)
      return 1
    }
    const { routes, warnings } = collectRoutes(repoRoot)
    for (const w of warnings) console.error(`${PREFIX} WARN: ${w}`)
    const { lines, roots } = auditGraph(manifest, maps, routes)
    const labelled = roots.filter((r) => r.routed).length
    if (lines.length > 0) {
      console.log(lines.join('\n'))
      console.error(`${PREFIX} FAIL: ${lines.length} finding(s) in the http build (${roots.length} roots, ${labelled} labelled with a route)`)
      return 1
    }
    const chunks = new Set(Object.values(manifest).map((e) => e.file)).size
    console.log(`${PREFIX} OK (${roots.length} roots (${labelled} labelled with a route), ${chunks} chunks, 0 mock modules)`)
    return 0
  } finally {
    cleanup()
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().then(
    (code) => process.exit(code),
    (e) => {
      console.error(`${PREFIX} ${e.message}`)
      process.exit(1)
    },
  )
}
