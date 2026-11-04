// HTTP-build mock-path audit (S0-T09; FR-X2-0, register 6.2b row 17).
// Builds the app in http mode (`VITE_API_MODE=http`, like docker/frontend/Dockerfile + compose.http.yaml)
// and fails when the chunk closure of a matrix route contains a mock module (data). Output: one line per
// `route -> chunk -> mock module`; exit 1 when any line exists, 0 otherwise.
//
// "Matrix route" = the route table under `src/app/router` (decision D115; NOT `prototype-scope.ts`):
// `buildRoutes` (router/index.ts) = core routes + every module of `src/app/modules.ts` (its routes file and
// the route fragments it imports) with a lazy `component: () => import('...')`. Static components (not lazy) live
// in the entry chunk, which is audited on its own as `(entry)`.
//
// Mock module rule (MOCK_MODULE_RE): a source path under `src/mock/**` or `src/modules/<module>/mock/**`, with
// either path separator. Not matched: `__tests__` paths, node_modules, and names that only contain "mock"
// (`mock-exam`, `mock-lib`, `mock-extractor`, `src/modules/x/mock-data/`...).
// Chunk closure of a route = its manifest chunk + the static `imports` closure + the entry chunk (index.html)
// closure, which loads for every route. Entry-closure hits are reported once for `(entry)`, not once per route.
//
// Dynamic imports count too: any chunk holding mock sources that is reachable (static + dynamic imports, from the
// entry or a route chunk) is a finding, printed `<route or (entry)> -> <importer chunk> =dyn=> <mock chunk> (<mock module>)`.
// Allow-list of 1: the guarded `import('@/mock')` in `src/app/bootstrap.ts` (edge: the chunk containing bootstrap.ts ->
// manifest entry `src/mock/index.ts`). That edge is not followed, so chunks reachable ONLY through it are allowed.
//
// Usage: node scripts/check-http-build.mjs [--dist <dir>]   (--dist audits an existing build; it needs
// `<dir>/.vite/manifest.json` and source maps, i.e. `vite build --manifest --sourcemap`.)
import { spawnSync } from 'node:child_process'
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

/** Static `imports` closure of `srcKey` (the key itself included) plus the entry chunk closure. */
export function routeChunkClosure(manifest, srcKey) {
  const out = new Set()
  const walk = (key) => {
    if (!key || out.has(key) || !manifest[key]) return
    out.add(key)
    for (const dep of manifest[key].imports ?? []) walk(dep)
  }
  walk(srcKey)
  walk(ENTRY_KEY)
  return out
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
 * `maps`: `{ [chunkFile]: mapJson }`. Returns lines `route -> chunk -> mock module`, plus `(entry)` lines for the
 * entry chunk closure (reported once).
 */
export function audit(manifest, maps, routes) {
  const cache = new Map()
  const mocksOfFile = (file) => {
    if (!cache.has(file)) cache.set(file, maps[file] ? mockSourcesOf(maps[file], file) : [])
    return cache.get(file)
  }
  const fileOf = (key) => manifest[key]?.file
  const lines = []
  const entryKeys = manifest[ENTRY_KEY] ? routeChunkClosure(manifest, ENTRY_KEY) : new Set()
  for (const key of entryKeys) {
    for (const mock of mocksOfFile(fileOf(key))) lines.push(`(entry) -> ${fileOf(key)} -> ${mock}`)
  }
  for (const r of routes) {
    if (!r.component || !manifest[r.component]) continue
    for (const key of routeChunkClosure(manifest, r.component)) {
      if (entryKeys.has(key)) continue
      for (const mock of mocksOfFile(fileOf(key))) lines.push(`${r.path} -> ${fileOf(key)} -> ${mock}`)
    }
  }
  return [...new Set([...lines, ...dynamicMockFindings(manifest, maps, routes)])]
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
 * Dynamic-import findings: walks static + dynamic imports from the entry and from every route chunk (one shared
 * visited set, so a chunk is attributed to the first root that reaches it; the entry goes first) and reports every
 * dynamic edge from a non-mock chunk to a chunk that holds mock sources, as
 * `<route or (entry)> -> <importer chunk> =dyn=> <mock chunk> (<mock module>)`.
 * Allow-list of 1 (ALLOWED_DYNAMIC_TARGET): the edge `chunk containing src/app/bootstrap.ts` -> manifest entry
 * `src/mock/index.ts` is not followed, so its descendants count only when something else also reaches them.
 */
export function dynamicMockFindings(manifest, maps, routes) {
  const mocksOfFile = (file) => (maps[file] ? mockSourcesOf(maps[file], file) : [])
  const isMock = (key) => Boolean(manifest[key]) && mocksOfFile(manifest[key].file).length > 0
  const bootstrapFiles = new Set(
    Object.values(manifest)
      .map((e) => e.file)
      .filter((f) => maps[f] && allSourcesOf(maps[f], f).some((p) => BOOTSTRAP_RE.test(p))),
  )
  const lines = []
  const seen = new Set()
  const walk = (label, start) => {
    const stack = [start]
    while (stack.length > 0) {
      const key = stack.pop()
      if (!manifest[key] || seen.has(key)) continue
      seen.add(key)
      if (isMock(key)) continue // reported through its importer; static edges are the route audit's
      const entry = manifest[key]
      stack.push(...(entry.imports ?? []))
      for (const dep of entry.dynamicImports ?? []) {
        if (dep === ALLOWED_DYNAMIC_TARGET && bootstrapFiles.has(entry.file)) continue
        if (isMock(dep)) {
          lines.push(`${label} -> ${entry.file} =dyn=> ${manifest[dep].file} (${mocksOfFile(manifest[dep].file)[0]})`)
        }
        stack.push(dep)
      }
    }
  }
  if (manifest[ENTRY_KEY]) walk('(entry)', ENTRY_KEY)
  for (const r of routes) if (r.component) walk(r.path, r.component)
  return [...new Set(lines)]
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

function main() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
  const args = process.argv.slice(2)
  const di = args.indexOf('--dist')
  let dist = di >= 0 ? resolve(args[di + 1] ?? '') : null
  let tmp = null
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
      const r = spawnSync(
        npx,
        ['vite', 'build', '--mode', 'http', '--manifest', '--sourcemap', '--outDir', tmp, '--emptyOutDir'],
        { cwd: repoRoot, env, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024 },
      )
      if (r.status !== 0) {
        console.error(`${r.stdout ?? ''}${r.stderr ?? ''}`.split('\n').slice(-40).join('\n'))
        console.error(`${PREFIX} vite build failed (exit ${r.status ?? r.signal})`)
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
    for (const r of routes) {
      if (r.component && !manifest[r.component]) {
        console.error(`${PREFIX} WARN: route ${r.path}: ${r.component} is not a manifest entry (not audited as its own chunk)`)
      }
    }
    const lines = audit(manifest, maps, routes)
    if (lines.length > 0) {
      console.log(lines.join('\n'))
      console.error(`${PREFIX} FAIL: ${lines.length} route -> chunk -> mock module line(s) in the http build`)
      return 1
    }
    const chunks = new Set(Object.values(manifest).map((e) => e.file)).size
    console.log(`${PREFIX} OK (${routes.length} routes, ${chunks} chunks, 0 mock modules)`)
    return 0
  } finally {
    if (tmp) rmSync(tmp, { recursive: true, force: true })
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exit(main())
  } catch (e) {
    console.error(`${PREFIX} ${e.message}`)
    process.exit(1)
  }
}
