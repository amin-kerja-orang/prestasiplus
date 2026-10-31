// Route walker for the Portal Pentadbiran (T1 of docs/design/v2-admin-page-templates.md section 4).
// Finds every routed page of the portal (`/admin/**` and `/guru/monitoring/**`) by reading the module
// route fragments as text, then follows relative / same-repo imports to collect the component files
// a portal route reaches. Text-based on purpose: it needs no Vite alias resolution and runs in a unit test.
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, posix } from 'node:path'
import { fileURLToPath } from 'node:url'

export const ROOT = fileURLToPath(new URL('../../', import.meta.url))

/** All files below `dir` (repo-relative, forward slashes). */
export function walk(dir, out = []) {
  for (const e of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
    const p = `${dir}/${e.name}`
    if (e.isDirectory()) walk(p, out)
    else out.push(p)
  }
  return out
}

export const isTestPath = (p) => /(^|\/)__tests__\//.test(p) || /\.(test|spec)\.[cm]?[jt]s$/.test(p)

/** Portal route paths: the admin panel and the shared monitoring twin. Not `/admin-sekolah`. */
export const isPortalPath = (p) => /^\/admin(\/|$)/.test(p) || /^\/guru\/monitoring(\/|$)/.test(p)

const PATH_RE = /\bpath:\s*(?:'([^']*)'|"([^"]*)"|`([^`]*)`|([A-Za-z_][\w.]*))/g
/** A route fragment that mounts portal screens (admin layout, the shared mounts or a portal path). */
const PORTAL_FILE_RE =
  /layout:\s*'admin'|adminMeta|ADMIN_MOUNT|STAFF_MOUNTS|['"`]\/admin(?:\/|['"`])|\/guru\/monitoring/
const IMPORT_RE =/import\(\s*['"]([^'"]+)['"]\s*\)/g

/** Route fragment files of every module: `routes.ts`, `routes/*.ts`, `routes/**` (no tests, no mock). */
export function routeFiles() {
  return walk('src/modules').filter(
    (p) =>
      /\.ts$/.test(p) &&
      !isTestPath(p) &&
      !/\/mock\//.test(p) &&
      /^src\/modules\/[^/]+\/(routes\.ts|routes\/.+\.ts)$/.test(p),
  )
}

/** Resolves an import specifier of `fromFile` to an existing repo-relative file, or null. */
export function resolveImport(spec, fromFile) {
  let base
  if (spec.startsWith('@/')) base = `src/${spec.slice(2)}`
  else if (spec.startsWith('.')) base = posix.normalize(posix.join(posix.dirname(fromFile), spec))
  else return null
  const candidates = [base, `${base}.vue`, `${base}.ts`, `${base}/index.ts`, `${base}/index.vue`]
  for (const c of candidates) {
    const abs = join(ROOT, c)
    if (existsSync(abs) && statSync(abs).isFile()) return c
  }
  return null
}

/**
 * Portal routes found in the route fragments.
 * @returns {{ path: string, routeFile: string, page: string | null }[]}
 */
export function portalRoutes() {
  const out = []
  for (const file of routeFiles()) {
    const text = readFileSync(join(ROOT, file), 'utf8')
    const portalFile = PORTAL_FILE_RE.test(text)
    const marks = [...text.matchAll(PATH_RE)]
    marks.forEach((m, i) => {
      const literal = m[1] ?? m[2] ?? m[3]
      const isIdent = literal === undefined || literal.includes('${')
      if (!isIdent && !isPortalPath(literal)) return
      if (isIdent && !portalFile) return
      const end = marks[i + 1]?.index ?? text.length
      const slice = text.slice(m.index, end)
      const imp = [...slice.matchAll(IMPORT_RE)].map((x) => resolveImport(x[1], file))
      // shared pages outside src/modules (for example PrototypeUnavailablePage) are not portal files
      const page = imp.find((f) => f && f.endsWith('.vue') && f.startsWith('src/modules/')) ?? null
      out.push({ path: literal ?? `<${m[4]}>`, routeFile: file, page })
    })
  }
  return out
}

/** True for a file the lint scope has to cover: a Vue SFC or a TS file of a UI folder. */
export const isUiFile = (p) =>
  p.endsWith('.vue') ||
  (p.endsWith('.ts') && /(^|\/)(components|pages|admin|pentadbiran)\//.test(p) && !/\.d\.ts$/.test(p))

/** Static / dynamic imports of one file, resolved. */
export function importsOf(file) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const out = new Set()
  for (const m of text.matchAll(/(?:from|import)\s*\(?\s*['"]([^'"]+)['"]/g)) {
    const r = resolveImport(m[1], file)
    if (r) out.add(r)
  }
  return [...out]
}

/** UI files reachable from the given pages (the pages included), tests and `src/ds` excluded. */
export function reachableUiFiles(pages) {
  const seen = new Set()
  const stack = [...pages]
  while (stack.length) {
    const f = stack.pop()
    if (seen.has(f) || isTestPath(f)) continue
    if (/^src\/(ds|theme|dev|components|app|pages)\//.test(f) || /\/mock\//.test(f) || /\/index\.ts$/.test(f)) continue
    if (!f.endsWith('.vue') && !isUiFile(f)) continue
    seen.add(f)
    for (const i of importsOf(f)) stack.push(i)
  }
  return [...seen].sort()
}

/** Extracts `/admin...` and `/guru/...` path literals from a nav / menu source file. */
export function navPaths(file) {
  const text = readFileSync(join(ROOT, file), 'utf8')
  const out = new Set()
  for (const m of text.matchAll(/['"`](\/(?:admin|guru)[^'"`\s$]*)['"`]/g)) out.add(m[1])
  return [...out].sort()
}

/** Route pattern (`/admin/users/:id/edit`, param regexes ignored) to a RegExp. */
export function routePattern(path) {
  const segs = path
    .split('/')
    .map((seg) => (seg.startsWith(':') ? '[^/]+' : seg.replace(/[^A-Za-z0-9_-]/g, (c) => '[' + c + ']')))
  return new RegExp('^' + segs.join('/') + '/?$')
}
