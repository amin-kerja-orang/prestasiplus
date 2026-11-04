#!/usr/bin/env node
// R1 canonical map (card S0-T01 tooling). One function = one screen, one route, one menu entry, one table/model, one API.
//
// docs/plan/r1-canonical-map.json is the single source of truth. Its code-derived parts (routes, menus, models, apis)
// are regenerated from the current code; the hand-set parts (status, note, api_id, approved_by_card, concepts,
// register ...) are kept on every regeneration.
//
// Usage:
//   node scripts/r1-canonical-map.mjs --write   regenerate: add new code items, drop items that left the code, keep hand-set fields
//   node scripts/r1-canonical-map.mjs --check   fail (exit 1) when the code has a route/menu/model/API that is not in the map
//   node scripts/r1-canonical-map.mjs --self-test
//
// Extraction is regex based (no TypeScript run time needed); the extractors are exported so that
// scripts/r1-scope-guard.mjs applies the very same rules to a PR diff.
//
// Statuses: canonical | redirect-to:<path> | retire (routes, menus, apis)
//           canonical | legacy-retire | parallel-of:<model> (models)
import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, posix, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export const MAP_PATH = 'docs/plan/r1-canonical-map.json'
export const CODEOWNERS_PATH = '.github/CODEOWNERS'
export const API_CONTRACT_PATH = 'docs/prd/r1/60-api-contract.md'
const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ---------------------------------------------------------------------------------------------
// Small text utilities

const norm = (p) => p.replace(/\\/g, '/')

/** Replace comments by spaces (same length), leaving string / template literals intact. */
export function stripComments(src) {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const c = src[i]
    const d = src[i + 1]
    if (c === '/' && d === '/') {
      while (i < n && src[i] !== '\n') { out += ' '; i++ }
      continue
    }
    if (c === '/' && d === '*') {
      out += '  '; i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) { out += src[i] === '\n' ? '\n' : ' '; i++ }
      out += '  '; i += 2
      continue
    }
    if (c === "'" || c === '"' || c === '`') {
      const q = c
      out += c; i++
      while (i < n && src[i] !== q) {
        if (src[i] === '\\') { out += src[i] + (src[i + 1] ?? ''); i += 2; continue }
        out += src[i]; i++
      }
      out += q; i++
      continue
    }
    out += c; i++
  }
  return out
}

/** Index of the end quote of the string starting at i (src[i] is the quote). */
function stringEnd(src, i) {
  const q = src[i]
  let j = i + 1
  while (j < src.length && src[j] !== q) j += src[j] === '\\' ? 2 : 1
  return j
}

/** Start index of the object literal `{` that encloses position pos (-1 if none). Source must be comment-free. */
function enclosingObjectStart(src, pos) {
  let depth = 0
  for (let i = pos - 1; i >= 0; i--) {
    const c = src[i]
    if (c === '}') depth++
    else if (c === '{') {
      if (depth === 0) return i
      depth--
    }
  }
  return -1
}

/** Index of the `}` that closes the `{` at start. */
function objectEnd(src, start) {
  let depth = 0
  for (let i = start; i < src.length; i++) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') { i = stringEnd(src, i); continue }
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') { depth--; if (depth === 0) return i }
  }
  return src.length - 1
}

/** Top-level `key: value` pairs of the object literal src[start..end]. */
function topLevelProps(src, start, end) {
  const props = {}
  let depth = 0
  let piece = ''
  const flush = () => {
    const m = piece.match(/^\s*['"]?([A-Za-z_$][\w$-]*)['"]?\s*:\s*([\s\S]*?)\s*$/)
    if (m && !(m[1] in props)) props[m[1]] = m[2]
    piece = ''
  }
  for (let i = start + 1; i < end; i++) {
    const c = src[i]
    if (c === "'" || c === '"' || c === '`') {
      const e = stringEnd(src, i)
      piece += src.slice(i, e + 1); i = e
      continue
    }
    if (c === '{' || c === '(' || c === '[') depth++
    else if (c === '}' || c === ')' || c === ']') depth--
    if (c === ',' && depth === 0) { flush(); continue }
    piece += c
  }
  flush()
  return props
}

const unquote = (raw) => {
  if (raw == null) return null
  const m = raw.trim().match(/^(['"])((?:\\.|(?!\1).)*)\1$/s)
  return m ? m[2].replace(/\\(['"\\])/g, '$1') : null
}

// ---------------------------------------------------------------------------------------------
// Constants (path constants such as CURRICULUM_PATH, role sets such as SA_)

/** Collect `const NAME = '/literal'` and `const NAME = [ 'a', 'b' ]` into table (name -> Set of string values / arrays). */
export function collectConsts(text, table = new Map()) {
  for (const m of text.matchAll(/(?:^|\n)\s*(?:export\s+)?const\s+([A-Za-z_$][\w$]*)\s*(?::[^=\n]+)?=\s*(['"])(\/[^'"\n]*)\2/g)) {
    if (!table.has(m[1])) table.set(m[1], new Set())
    table.get(m[1]).add(m[3])
  }
  return table
}

function resolveTemplate(raw, consts) {
  // raw is the text between backticks
  return raw.replace(/\$\{\s*([A-Za-z_$][\w$]*)\s*\}/g, (all, id) => {
    const v = consts.get(id)
    return v && v.size === 1 ? [...v][0] : all
  })
}

/** String value of a path-like expression: literal, template with known consts, or a known const. null if unknown. */
function pathValue(raw, consts) {
  if (raw == null) return null
  const t = raw.trim()
  const lit = unquote(t)
  if (lit != null) return lit
  const tm = t.match(/^`([\s\S]*)`$/)
  if (tm) return resolveTemplate(tm[1], consts)
  const idm = t.match(/^([A-Za-z_$][\w$]*)$/)
  if (idm) {
    const v = consts.get(idm[1])
    if (v && v.size === 1) return [...v][0]
    return `\${${idm[1]}}`
  }
  return null
}

// ---------------------------------------------------------------------------------------------
// Sector ownership (CODEOWNERS, including the commented sector templates: the last matching line wins)

export function makeSectorResolver(codeownersText) {
  const rules = []
  for (const line of codeownersText.split(/\r?\n/)) {
    const m = line.match(/^#?\s*(\/\S+)\s+@(\S+)/)
    if (!m) continue
    const owner = m[2]
    const sector = /^OWNER-(S\d+)$/.test(owner) ? owner.slice(6) : 'S0'
    const rx = new RegExp('^' + m[1].replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^/]*').replace(/\/$/, '') + '(?:/.*)?$')
    rules.push({ rx, sector })
  }
  return (file) => {
    const p = '/' + norm(file).replace(/^\.?\//, '')
    let sector = 'S0'
    for (const r of rules) if (r.rx.test(p)) sector = r.sector
    return sector
  }
}

// ---------------------------------------------------------------------------------------------
// Extractors

export const isRouteFile = (p) => /^src\/(?:.*\/)?routes\/[^/]+\.ts$/.test(p) && !/\/(mock|__tests__)\//.test(p) && !/\.(test|spec)\.ts$/.test(p)
export const isCoreRouteFile = (p) => p === 'src/app/router/core-routes.ts'
export const isRouterSource = (p) => isRouteFile(p) || isCoreRouteFile(p)
export const isNavFile = (p) => /^src\/shells\/(?:.*\/)?nav\/[^/]+\.ts$/.test(p) && !/out-of-scope\.ts$/.test(p)
export const isPentadbiranMenu = (p) => p === 'src/shells/pentadbiran/menu.ts'
export const isMenuSource = (p) => isNavFile(p) || isPentadbiranMenu(p)
export const isSchemaFile = (p) => /^apps\/api\/prisma\/schema\/[^/]+\.prisma$/.test(p)
export const isControllerFile = (p) => /^apps\/api\/src\/.*\.controllers?\.ts$/.test(p)

/** FE routes of one route source file. Returns [{path,name,component,redirect,file}]. */
export function extractRoutes(file, text, consts = new Map()) {
  const src = stripComments(text)
  const local = collectConsts(src, new Map([...consts].map(([k, v]) => [k, new Set(v)])))
  const out = []
  const seen = new Set()
  for (const m of src.matchAll(/(?<![\w.$])path\s*:/g)) {
    const start = enclosingObjectStart(src, m.index)
    if (start < 0 || seen.has(start)) continue
    seen.add(start)
    const end = objectEnd(src, start)
    const props = topLevelProps(src, start, end)
    if (!('path' in props) || !('component' in props || 'redirect' in props || 'children' in props)) continue
    const path = pathValue(props.path, local)
    if (path == null) continue
    const name = props.name != null ? unquote(props.name) : null
    let component = null
    if (props.component) {
      const im = props.component.match(/import\(\s*(['"])([^'"]+)\1\s*\)/)
      if (im) {
        const spec = im[2]
        component = spec.startsWith('@/') ? 'src/' + spec.slice(2) : spec.startsWith('.') ? posix.normalize(posix.join(posix.dirname(norm(file)), spec)) : spec
      } else {
        const id = props.component.trim().match(/^([A-Za-z_$][\w$]*)$/)
        component = id ? `identifier:${id[1]}` : null
      }
    }
    let redirect = null
    if (props.redirect != null) {
      const r = pathValue(props.redirect, local)
      redirect = r && r.startsWith('/') ? r : '(dynamic)'
    }
    out.push({ path, name, component, redirect, file: norm(file), ...(path.includes('${') ? { template: true } : {}) })
  }
  return out
}

/** Role set constants of a nav file: `const S = ['student'] as const ...`. */
function roleConsts(src) {
  const table = new Map()
  for (const m of src.matchAll(/(?:^|\n)\s*const\s+([A-Za-z_$][\w$]*)\s*=\s*(\[[^\]]*\])\s*as\s+const/g)) {
    table.set(m[1], [...m[2].matchAll(/'([^']+)'/g)].map((x) => x[1]))
  }
  return table
}

function parseRoles(raw, table) {
  if (!raw) return null
  const t = raw.trim()
  if (t.startsWith('[')) return [...t.matchAll(/'([^']+)'/g)].map((x) => x[1])
  const id = t.match(/^([A-Za-z_$][\w$]*)/)
  return id && table.has(id[1]) ? table.get(id[1]) : null
}

/** Menu entries (items only) of one nav/menu source file. Returns [{source,id,label,route,roles,built?,group?,file}]. */
export function extractMenus(file, text) {
  const f = norm(file)
  const src = stripComments(text)
  const out = []

  if (isPentadbiranMenu(f)) {
    // rows: ['PM-01', 'Langsung', '/admin/command-center', K],  inside groups { key: '...', label: '...', items: items([ ... ]) }
    const groupKeys = [...src.matchAll(/\bkey\s*:\s*'([^']+)'/g)].map((m) => ({ at: m.index, key: m[1] }))
    const end = src.indexOf('export const FULL_ITEMS')
    const area = end > 0 ? src.slice(0, end) : src
    for (const m of area.matchAll(/\[\s*'([A-Z]{2}-\d+)'\s*,\s*'((?:\\'|[^'])*)'\s*(?:,\s*(?:'([^']*)'|undefined))?\s*(?:,\s*([A-Za-z'][^\]]*?))?\s*\]/g)) {
      const grp = [...groupKeys].reverse().find((g) => g.at < m.index)
      const to = m[3] ?? `/admin/p/${m[1].toLowerCase()}`
      out.push({ source: 'pentadbiran', id: m[1], label: m[2].replace(/\\'/g, "'"), route: to, roles: ['admin'], built: m[3] !== undefined, group: grp?.key ?? null, file: f })
    }
    return out
  }

  // object-literal items: { kind: 'item', id, label, to, roles }  (user-nav.ts and unknown nav files)
  const rc = roleConsts(src)
  const objs = []
  const seen = new Set()
  for (const m of src.matchAll(/\bkind\s*:\s*'(item|group)'/g)) {
    const start = enclosingObjectStart(src, m.index)
    if (start < 0 || seen.has(start)) continue
    seen.add(start)
    const end = objectEnd(src, start)
    objs.push({ start, end, kind: m[1], props: topLevelProps(src, start, end) })
  }
  const base = f.split('/').pop()
  const sourceName = base === 'user-nav.ts' ? 'user-nav' : base.replace(/\.ts$/, '')
  for (const o of objs) {
    if (o.kind !== 'item') continue
    const id = unquote(o.props.id)
    const label = unquote(o.props.label)
    const to = unquote(o.props.to)
    if (!id || label == null || !to) continue
    let roles = parseRoles(o.props.roles, rc)
    if (!roles) {
      const parent = objs.filter((p) => p !== o && p.start < o.start && p.end > o.end && p.props.roles).sort((a, b) => b.start - a.start)[0]
      roles = parent ? parseRoles(parent.props.roles, rc) : null
    }
    out.push({ source: sourceName, id, label, route: to, roles: roles && roles.length ? roles : ['*'], file: f })
  }

  // builder calls (admin-nav.ts): item('id', 'label', '/to', ...), kirk('id', 'label', '/sub', ...)
  if (/\bfunction item\(/.test(src) || /\bconst kirk\s*=/.test(src)) {
    const regions = [
      { name: 'admin-nav', from: src.indexOf('export const ADMIN_NAV'), to: src.indexOf('export const ADMIN_FOOTER_LINKS') },
      { name: 'admin-footer', from: src.indexOf('export const ADMIN_FOOTER_LINKS'), to: src.indexOf('export const ADMIN_BOTTOM_NAV') },
    ]
    const Q = String.raw`'((?:\\'|[^'])*)'`
    for (const r of regions) {
      if (r.from < 0) continue
      const area = src.slice(r.from, r.to > r.from ? r.to : undefined)
      for (const m of area.matchAll(new RegExp(String.raw`(?<![\w.$])item\(\s*${Q}\s*,\s*${Q}\s*,\s*${Q}`, 'g'))) {
        out.push({ source: r.name, id: m[1], label: m[2].replace(/\\'/g, "'"), route: m[3], roles: ['admin'], file: f })
      }
      for (const m of area.matchAll(new RegExp(String.raw`(?<![\w.$])kirk\(\s*${Q}\s*,\s*${Q}\s*,\s*${Q}`, 'g'))) {
        out.push({ source: r.name, id: m[1], label: m[2].replace(/\\'/g, "'"), route: `/admin/kirkpatrick${m[3]}`, roles: ['admin'], file: f })
      }
    }
  }
  return out
}

/** Prisma models of one schema file. Returns [{name,table,file}]. */
export function extractModels(file, text) {
  const out = []
  for (const m of text.matchAll(/^model\s+(\w+)\s*\{([\s\S]*?)^\}/gm)) {
    const map = m[2].match(/@@map\(\s*"([^"]+)"\s*\)/)
    out.push({ name: m[1], table: map ? map[1] : null, file: norm(file) })
  }
  return out
}

export const normApiPattern = (p) => p.replace(/\/+/g, '/').replace(/\/$/, '').replace(/:[A-Za-z_$][\w$]*(\([^)]*\))?/g, ':p').replace(/\{[^}]+\}/g, ':p').replace(/<[^>]+>/g, ':p') || '/'

/** Controller routes of one controller file. Returns [{method,path,pattern,file,line}]. */
export function extractApis(file, text) {
  const src = stripComments(text)
  const out = []
  const ctrls = [...src.matchAll(/@Controller\(\s*([^)]*)\)/g)].map((m) => {
    const arg = m[1].trim()
    const lit = arg.match(/^['"`]([^'"`]*)['"`]$/) ?? arg.match(/path\s*:\s*['"`]([^'"`]*)['"`]/)
    return { at: m.index, prefix: lit ? lit[1] : '' }
  })
  for (const m of src.matchAll(/@(Get|Post|Put|Patch|Delete|All)\(\s*(\[[^\]]*\]|'[^']*'|"[^"]*"|`[^`]*`)?\s*\)/g)) {
    const ctrl = [...ctrls].reverse().find((c) => c.at < m.index)
    if (!ctrl) continue
    const arg = m[2]
    const subs = !arg ? [''] : arg.startsWith('[') ? [...arg.matchAll(/['"`]([^'"`]*)['"`]/g)].map((x) => x[1]) : [arg.slice(1, -1)]
    const line = src.slice(0, m.index).split('\n').length
    for (const sub of subs) {
      const path = ('/api/' + ctrl.prefix + '/' + sub).replace(/\/+/g, '/').replace(/\/$/, '')
      out.push({ method: m[1].toUpperCase(), path, pattern: normApiPattern(path), file: norm(file), line })
    }
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Tree scanning (working tree or git ref) and keys

const SCAN_ROOTS = ['src', 'apps/api/prisma/schema', 'apps/api/src']

function walk(root, rel, out) {
  const abs = join(root, rel)
  if (!existsSync(abs)) return
  for (const name of readdirSync(abs)) {
    if (name === 'node_modules' || name === 'dist' || name.startsWith('.')) continue
    const r = rel ? `${rel}/${name}` : name
    const st = statSync(join(root, r))
    if (st.isDirectory()) walk(root, r, out)
    else out.push(r)
  }
}

export function workTreeFs(root = REPO_ROOT) {
  const files = []
  for (const r of SCAN_ROOTS) walk(root, r, files)
  return { files: files.sort(), read: (p) => readFileSync(join(root, p), 'utf8') }
}

export const routeKey = (r) => `${r.path}|${r.name ?? ''}`
export const menuKey = (m) => `${m.source}|${m.id}`
export const apiKey = (a) => `${a.method} ${a.pattern}`

/** Path constants of the whole tree: name -> Set(values). */
export function treeConsts(fs) {
  const table = new Map()
  for (const p of fs.files) if (/^src\/.*\.ts$/.test(p) && !/(__tests__|\.test\.|\.d\.ts|\/mock\/)/.test(p) && /\/lib\/|routes|\/constants/.test(p)) collectConsts(stripComments(fs.read(p)), table)
  return table
}

/** All code-derived items of a tree. */
export function scanTree(fs) {
  const consts = treeConsts(fs)
  const routes = []
  const menus = []
  const models = []
  const apis = []
  for (const p of fs.files) {
    if (isRouterSource(p)) routes.push(...extractRoutes(p, fs.read(p), consts))
    else if (isMenuSource(p)) menus.push(...extractMenus(p, fs.read(p)))
    else if (isSchemaFile(p)) models.push(...extractModels(p, fs.read(p)))
    else if (isControllerFile(p) && !/\.(spec|test)\.ts$/.test(p)) apis.push(...extractApis(p, fs.read(p)))
  }
  return { routes: dedupe(routes, routeKey), menus: dedupe(menus, menuKey), models, apis: dedupe(apis, apiKey) }
}

/** Give a repeated key a stable "#n" suffix (in file order). */
function dedupe(items, keyFn) {
  const count = new Map()
  return items.map((it) => {
    const k = keyFn(it)
    const n = (count.get(k) ?? 0) + 1
    count.set(k, n)
    return { ...it, key: n === 1 ? k : `${k} #${n}` }
  })
}

// ---------------------------------------------------------------------------------------------
// Similarity helpers (also used by the scope guard)

export function levenshtein(a, b) {
  const m = a.length, n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 0; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[m][n]
}

export const NOISE_TOKENS = new Set(['2', '3', 'v2', 'v3', 'new', 'baru', 'lama', 'legacy', 'old', 'copy', 'temp', 'tmp', 'alt'])

export function singular(w) {
  if (w.length > 4 && w.endsWith('ies')) return w.slice(0, -3) + 'y'
  if (w.length > 4 && /(ses|xes|ches|shes)$/.test(w)) return w.slice(0, -2)
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1)
  return w
}

/** Word tokens of an identifier / path segment: splits camelCase, `-`, `_`, `.`, and digits suffixes. */
export function tokens(s) {
  const out = []
  for (const part of s.replace(/([a-z])([A-Z])/g, '$1 $2').toLowerCase().split(/[^a-z0-9:]+/).filter(Boolean)) {
    const m = part.match(/^([a-z]{2,})(\d+)$/) // "questions2" -> "questions", "2"; "v2" stays one token
    if (m) out.push(m[1], m[2])
    else out.push(part)
  }
  return out
}

/** Canonical stem of a name: no noise tokens, singular words, joined. */
export function stemOf(s) {
  return tokens(s).filter((t) => !NOISE_TOKENS.has(t)).map(singular).join('')
}

/** Canonical stem of a route path: params become ':', each segment stemmed. */
export function pathStem(p) {
  return p.split('/').filter(Boolean).map((seg) => (seg.startsWith(':') || seg.startsWith('${') ? ':' : stemOf(seg.replace(/\(.*$/, '')))).filter((s) => s !== '').join('/')
}

export const normLabel = (s) => s.toLowerCase().replace(/\s+/g, ' ').trim()

// ---------------------------------------------------------------------------------------------
// Initial (seed) decisions. Used only for items that have no `status` yet; after the first --write the JSON is the truth.
// Sources: docs/prd/r1/30-admin-pusat.md section 3, docs/prd/r1/10-murid.md, docs/prd/r1/50-data-model-erd.md and the
// V3 duplicates register (keep / action decisions). All entries are decided (D113).

const PRD30 = 'docs/prd/r1/30-admin-pusat.md'
const REG = 'V3 duplicates register'

/** Route decisions: match by exact `path`, or by `rx` (tested on the path). */
export const SEED_ROUTE_DECISIONS = [
  { path: '/admin/spm/soalan', status: 'redirect-to:/admin/spm/databank', note: `KS-02 list; ${PRD30} 3.3 (the list redirects; /admin/spm/soalan/:qid/sunting stays as Quick Edit). Register M-01.` },
  { path: '/admin/spm/kertas', status: 'redirect-to:/admin/studio/sets', note: `KS-09 Pembina Kertas list; ${PRD30} 3.3 (/admin/spm/kertas/:id stays as Semak Kertas Simulasi). Register M-05.` },
  { path: '/admin/spm/kertas/baharu', status: 'redirect-to:/admin/studio/sets', note: `${REG} M-05 (D113): redirects to the Set Builder create action` },
  { rx: /^\/admin\/spm\/kertas\/:id/, status: 'canonical', note: `${REG} M-05 (D113): becomes "Semak Kertas" (review and publish); PaperEditorPage is retired after its functions move to the Set Builder` },
  { path: '/admin/spm/semakan', status: 'redirect-to:/admin/studio?status=review', note: `KS-15 second review queue; ${PRD30} 3.3 writes ?status=reviewed but the status value is "review" (register M-04, section 7 item 2). The item route /admin/spm/semakan/:key stays (D113).` },
  { path: '/admin/studio/imports', status: 'redirect-to:/admin/spm/soalan/ekstrak', note: `V2 path alias of Import & Semakan; ${PRD30} 3.2` },
  { path: '/admin/spm/kertas-subjektif', status: 'redirect-to:/admin/kertas-subjektif', note: `V2 path alias; ${PRD30} 3.2` },
  { rx: /^\/admin\/questions\/create$/, status: 'redirect-to:/admin/studio/questions/create', note: `${REG} M-06 (D113): old flat form redirects to Studio after the field comparison` },
  { rx: /^\/admin\/questions\/:id[^/]*\/edit$/, status: 'redirect-to:/admin/studio/questions/:id/sunting', note: `${REG} M-06 (D113): old flat form (see /admin/questions/create)` },
  { path: '/leaderboard', status: 'canonical', note: `${REG} R-01 (D113): the one Papan Pendahulu page (dashboard link)` },
  { path: '/gamification/leaderboard', status: 'redirect-to:/leaderboard', note: `${REG} R-01 (D113): duplicate page; redirects to /leaderboard` },
  { path: '/admin/questions/quality', status: 'canonical', note: `tab "Kualiti" of Senarai Soalan (/admin/questions); ${PRD30} 3.3 BS-04` },
  { path: '/admin/question-reports', status: 'canonical', note: `tab "Laporan" of Senarai Soalan (/admin/questions); ${PRD30} 3.3 BS-05` },
  { path: '/admin/question-submissions', status: 'canonical', note: `tab "Kiriman Guru" of Import & Semakan; ${PRD30} 3.3` },
  { path: '/admin/structured-questions', status: 'canonical', note: `read view of the SAME questions store, not a second table (register section 6); sub-item of Bank Lama` },
  { name: 'dev.preview-hub-admin', status: 'retire', note: 'D113 F-07, delete previewHubRoutes (S0-T05)' },
  { name: 'dev.preview-hub-user', status: 'retire', note: 'D113 F-07, delete previewHubRoutes (S0-T05)' },
  { path: '/prestasi', status: 'canonical', note: 'Today redirects every role to /prestasi/sekolah (defect); target is a role-dependent redirect: a pupil goes to /prestasi/{ownId} (docs/prd/r1/10-murid.md row 3)' },
  { path: '/guru/pelajar/cipta', status: 'canonical', note: 'Today redirects back silently (defect); must open the create form (docs/prd/r1/20-guru-admin-sekolah.md FR-GUR-41-3)' },
  { path: '/cikgu/hadiah', status: 'canonical', note: 'Second ENTRY POINT to the one reward catalogue of /gamification/rewards (FD-MUR-33; register R-02); no second catalogue state' },
  { path: '/pusat-tuisyen/panduan', status: 'canonical', note: 'V2 path of the same PanduanPage as /panduan (10-murid.md row A3; register R-05: two URLs on purpose)' },
  { rx: /^\/spm-mock(\/|$)/, status: 'redirect-to:/spm/bijak', note: `${REG} M-10 (D113): second mock-exam product; /spm-mock redirects to Bijak SPM; no new use` },
  { path: '/laporan-mingguan', status: 'canonical', note: `${REG} R-03: pupil / parent screen only; the teacher report is /guru/laporan-mingguan-kelas (S6-T01)` },
]

/** Menu decisions by source + id (PRD 30 sections 3.3 and 3.4, register). */
export const SEED_MENU_DECISIONS = {
  'pentadbiran|BS-01': { status: 'canonical', target_label: 'Senarai Soalan', note: 'MERGE (rename) into Bank Lama; removes the duplicate "Bank Soalan" (30 §3.3; register M-01)' },
  'pentadbiran|BS-02': { status: 'canonical', note: 'KEEP (retab): tabs Kelompok Item, Kertas Diimport, Kiriman Guru (30 §3.3; register M-02)' },
  'pentadbiran|BS-03': { status: 'canonical', note: 'KEEP (build P2) as Sumber Kertas (30 §3.3)' },
  'pentadbiran|BS-04': { status: 'redirect-to:/admin/questions', note: 'MERGE: tab "Kualiti" of Senarai Soalan, route /admin/questions/quality stays (30 §3.3; register M-07)' },
  'pentadbiran|BS-05': { status: 'redirect-to:/admin/questions', note: 'MERGE: tab "Laporan" of Senarai Soalan, route /admin/question-reports stays (30 §3.3; register M-07)' },
  'pentadbiran|BS-06': { status: 'canonical', target_label: 'PKSK Soalan', note: 'KEEP (move) to group Premium (30 §3.3)' },
  'pentadbiran|BS-07': { status: 'canonical', note: 'KEEP (move) to the top shortcuts (30 §3.3)' },
  'pentadbiran|BS-08': { status: 'canonical', note: 'KEEP: canonical question bank (30 §3.3)' },
  'pentadbiran|KS-01': { status: 'canonical', note: 'KEEP: SPM hub (30 §3.3)' },
  'pentadbiran|KS-02': { status: 'retire', note: 'HIDE: third "Bank Soalan"; list redirects to /admin/spm/databank (30 §3.3; register M-01: KPI strip and preview dialog need a new home first, U4)' },
  'pentadbiran|KS-03': { status: 'redirect-to:/admin/spm/latih-tubi', note: 'MERGE: hub lane card and group SPM item (30 §3.3; register M-08)' },
  'pentadbiran|KS-04': { status: 'redirect-to:/admin/spm/tracking-a', note: 'MERGE: hub lane card and group SPM item (30 §3.3; register M-08)' },
  'pentadbiran|KS-05': { status: 'redirect-to:/admin/spm/subjektif', note: 'MERGE: hub lane card and group SPM item (30 §3.3; register M-08)' },
  'pentadbiran|KS-06': { status: 'redirect-to:/admin/spm/simulasi', note: 'MERGE: hub lane card (30 §3.3; register M-08)' },
  'pentadbiran|KS-07': { status: 'canonical', note: 'KEEP (build) as Kertas Subjektif (30 §3.3)' },
  'pentadbiran|KS-08': { status: 'retire', note: 'HIDE: opened from Set Builder and Semak Kertas; direct URL works (30 §3.3, D107; register M-03)' },
  'pentadbiran|KS-09': { status: 'redirect-to:/admin/studio/sets', note: 'MERGE into Set Builder: same paper list twice (30 §3.3; register M-05)' },
  'pentadbiran|KS-10': { status: 'retire', note: 'REMOVE: AI, D73 (30 §3.3)' },
  'pentadbiran|KS-11': { status: 'retire', note: 'REMOVE: merged into Tracking A (30 §3.3)' },
  'pentadbiran|KS-12': { status: 'retire', note: 'REMOVE: merged into Tracking A (30 §3.3)' },
  'pentadbiran|KS-13': { status: 'retire', note: 'HIDE: becomes the button "Muat Naik Kertas" (30 §3.3; register M-03: button first, then remove the entry)' },
  'pentadbiran|KS-14': { status: 'redirect-to:/admin/spm/soalan/ekstrak', note: 'MERGE: tab "Kelompok Item" of Import & Semakan; same screen as BS-02 (30 §3.3; register M-02)' },
  'pentadbiran|KS-15': { status: 'redirect-to:/admin/studio?status=review', note: 'MERGE: two review queues disagree (30 §3.3; register M-04 corrects reviewed -> review)' },
  'pentadbiran|KS-16': { status: 'retire', note: 'HIDE: becomes a button in Import & Semakan; Studio "Cipta baharu" is the V2 path (30 §3.3; register M-03)' },
  'pentadbiran|KS-17': { status: 'canonical', note: 'KEEP: Set Builder (30 §3.3)' },
  'pentadbiran|KK-03': { status: 'retire', note: 'removed placeholder: screens inside Kurikulum (30 §3.4)' },
  'pentadbiran|PM-01': { status: 'canonical', target_label: 'Command Center', note: 'moves to the top shortcuts, label "Command Center" + LIVE (30 §3.4; conflict D77/D107, OQ-L1)' },
  'pentadbiran|PM-03': { status: 'canonical', target_label: 'Monitoring', note: 'route must become /admin/monitoring (30 §3.4; register M-09: admin sees a teacher route today)' },
  'pentadbiran|PS-01': { status: 'canonical', target_label: 'Senarai Pengguna', note: 'V2 label (30 §3.4)' },
  'user-nav|t-laporan-mingguan': { status: 'redirect-to:/guru/laporan-mingguan-kelas', note: 'register R-03: teacher sidebar opens a 403 page; re-point (S0-T06, S6-T01)' },
  'user-nav|guru-laporan-mingguan': { status: 'redirect-to:/guru/laporan-mingguan-kelas', note: 'register R-03: re-point (S0-T06, S6-T01)' },
  'user-nav|spm-mock-ai': { status: 'redirect-to:/spm/bijak', note: 'register M-10 (D113): SPM Mock Exam is listed twice and is a second mock product; /spm-mock redirects to Bijak SPM' },
  'user-nav|spm-mock': { status: 'redirect-to:/spm/bijak', note: 'register M-10 (D113): see user-nav|spm-mock-ai' },
  'user-nav|papan-pendahulu': { status: 'redirect-to:/leaderboard', note: 'register R-01 (D113): menu route must become /leaderboard' },
}

/** API decisions: match by `key` (METHOD pattern) or `rx` on the key. */
export const SEED_API_DECISIONS = [
  { key: 'GET /api/leaderboard', status: 'canonical', note: `${REG} P-02 (D113): the one leaderboard API (fixed for period and scope)` },
  { key: 'GET /api/gamification/leaderboard', status: 'retire', note: `${REG} P-02 (D113): remove once no client calls it; no new callers` },
  { rx: /^GET \/api\/hadiah-digital\/(items|redemptions)$/, status: 'canonical', note: `${REG} R-02 / P-02 (D113): always returns []; the page must read the shared catalogue (S7-T05); keep only as thin views or remove after the page moves` },
  { key: 'GET /api/weekly-report', status: 'canonical', note: `${REG} P-06: always 403 by design (pupil / parent); the teacher report is API-GUR-21 (to build); do not open this one to teachers` },
  { rx: /^[A-Z]+ \/api\/spm-mocks(\/|$)/, status: 'retire', note: `${REG} P-07 / M-10 (D113): older mock-exam engine; no new writes; Bijak (/api/bijak/attempts) is the single engine` },
]

/** Seed concepts: business concept -> its one canonical model, route, API and screen. Hand-maintained afterwards. */
export const SEED_CONCEPTS = [
  {
    concept: 'question',
    description: 'A single exam / practice question with versions, parts, options and DSKP tags (one store, many role views).',
    models: ['Question', 'QuestionVersion', 'QuestionPart', 'PartOption', 'AnswerKey'],
    route: '/admin/studio',
    screen: 'Bank Soalan (Studio) list; create / edit wizard at /admin/studio/questions/create and /admin/studio/questions/:id/sunting. Senarai Soalan (/admin/questions) and Soalan Berstruktur are views of the same store.',
    api_prefixes: ['/api/questions', '/api/guru/questions', '/api/structured-questions', '/api/question-imports', '/api/admin/servability'],
    api: 'API-Q (PRD 60 section 2.6)',
    keywords: ['question'],
    owner_sector: 'S1',
    note: 'Register M-01 / M-06 / section 6: three lists and three editors exist today; no fourth list, no second question table, no new endpoint family. Sub-entities of the question (version, part, option) are the only models allowed to contain the word "question".',
  },
  {
    concept: 'question editor',
    description: 'Create / edit one question.',
    models: ['Question', 'QuestionVersion'],
    route: '/admin/studio/questions/create',
    screen: 'Studio wizard (/admin/studio/questions/:id/sunting); Quick Edit /admin/spm/soalan/:qid/sunting for the SPM lane; the old flat form (/admin/questions/create, /:id/edit) redirects to Studio (register M-06, D113)',
    api_prefixes: ['/api/questions'],
    api: 'API-Q (PRD 60 section 2.6)',
    keywords: [],
    owner_sector: 'S2',
    note: 'Do not add DSKP or group logic to the old form.',
  },
  {
    concept: 'review queue',
    description: 'Questions and extracted items waiting for review.',
    models: ['QuestionStatusEvent', 'IntakeItem'],
    route: '/admin/studio',
    screen: 'Studio status filter "Menunggu Semakan" (?status=review) for questions; tab "Kelompok Item" of Import & Semakan for extract items. /admin/spm/semakan redirects to the Studio filter.',
    api_prefixes: ['/api/intake/items'],
    api: 'API-Q (PRD 60 section 2.6)',
    keywords: [],
    owner_sector: 'S2',
    note: 'Register M-04: two queues disagreed; no third queue. The review workspace /admin/spm/semakan/:key stays reachable (D113).',
  },
  {
    concept: 'stimulus group',
    description: 'A passage / figure shared by 1..n questions (rangsangan); questions.group_id + group_position.',
    models: ['StimulusGroup', 'Stimulus', 'StimulusGroupStimulus', 'StimulusGroupOption'],
    route: '/admin/studio/groups/:id',
    screen: 'Stimulus group screen (30 R1-ADM-Q-05)',
    api_prefixes: ['/api/stimulus-groups', '/api/stimuli'],
    api: 'API-Q (PRD 60 section 2.6)',
    keywords: ['stimulus', 'stimuli'],
    owner_sector: 'S1',
    note: 'R1 adds no group entity (50 F1). Question-level and part-level stimulus attach paths stay valid (DM-03). IntakeStimulus is the import stage copy only.',
  },
  {
    concept: 'question set',
    description: 'A teacher set of questions assigned to explicit own classes (question_sets; kind set | kertas, DM-43).',
    models: ['QuestionSet', 'QuestionSetItem'],
    route: '/guru/set-soalan',
    screen: 'Set Soalan (teacher) and Set Soalan Guru (pupil, /set-soalan-saya)',
    api_prefixes: ['/api/set-soalan-saya', '/api/guru/set-soalan', '/api/guru/question-papers'],
    api: 'API-GUR (PRD 60 section 2.3)',
    keywords: ['questionset'],
    owner_sector: 'S1',
    note: 'Not the admin paper (see paper). Teacher Kertas Peperiksaan is question_sets kind=kertas: no new table (register S-03).',
  },
  {
    concept: 'paper',
    description: 'The one admin paper (Bijak Simulasi; Kertas Subjektif is papers with surface=subjektif, DM-23) with sections and placements.',
    models: ['Paper', 'PaperSection', 'PaperPlacement', 'Blueprint'],
    route: '/admin/studio/sets',
    screen: 'Set Builder landing and builder (30 R1-ADM-Q-13/14); /admin/spm/kertas/:id is Semak Kertas Simulasi',
    api_prefixes: ['/api/admin/papers', '/api/admin/blueprints', '/api/admin/section-pools', '/api/bijak/papers', '/api/bijak/contracts'],
    api: 'API-BIJAK (PRD 60 section 2.8)',
    keywords: ['paper', 'blueprint'],
    owner_sector: 'S3',
    note: 'Register S-03: papers, question_sets, spm_tracking_sets, intake batches and source_papers are separate by purpose; do not create a new table for teacher papers or Kertas Subjektif.',
  },
  {
    concept: 'paper builder',
    description: 'Compose a paper from questions with a blueprint budget check.',
    models: ['Paper', 'PaperSection', 'PaperPlacement'],
    route: '/admin/studio/sets',
    screen: 'Set Builder (/admin/studio/sets, /admin/studio/sets/:paper/builder). Pembina Kertas (/admin/spm/kertas) list redirects here (register M-05).',
    api_prefixes: ['/api/admin/papers'],
    api: 'API-BIJAK (PRD 60 section 2.8)',
    keywords: [],
    owner_sector: 'S3',
    note: 'Do not delete PaperEditorPage before the Set Builder has the budget check, preview and publish. No third builder.',
  },
  {
    concept: 'Bijak paper',
    description: 'The pupil-facing Bijak SPM simulation paper and its attempt (exam_attempts).',
    models: ['ExamAttempt', 'AttemptAnswer', 'AttemptResult'],
    route: '/spm/bijak',
    screen: 'Bijak SPM (pupil); answers also reach practice_answers through the answer port (DM-44)',
    api_prefixes: ['/api/bijak'],
    api: 'API-BIJAK (PRD 60 section 2.8)',
    keywords: ['bijak'],
    owner_sector: 'S3',
    note: 'One owner: prestasiplus-30 / S3. Others do not build Bijak pieces.',
  },
  {
    concept: 'mock exam',
    description: 'A timed mock exam for the pupil.',
    models: ['ExamAttempt', 'Paper'],
    route: '/spm/bijak',
    screen: 'Bijak SPM is the R1 product. The older SPM Mock Exam (/spm-mock, /api/spm-mocks, spm_mock_exams) is retired: /spm-mock redirects to /spm/bijak (register M-10 / P-07, D113).',
    api_prefixes: ['/api/bijak/attempts', '/api/spm-mocks'],
    api: 'API-BIJAK (PRD 60 section 2.8)',
    keywords: ['mockexam'],
    owner_sector: 'S3',
    note: 'No third mock engine.',
  },
  {
    concept: 'curriculum chapter',
    description: 'Textbook Bab: chapters -> topics -> subtopics (the pupil-facing tree, V2 data).',
    models: ['Chapter', 'Topic', 'Subtopic'],
    route: '/admin/curriculum',
    screen: 'Kurikulum (admin) and Topik / Peta Belajar (pupil; they read this tree after DM-16)',
    api_prefixes: ['/api/admin/curriculum', '/api/topics', '/api/learning-map', '/api/guru/chapters', '/api/guru/topics'],
    api: 'API-DSKP (PRD 60 section 2.7)',
    keywords: ['chapter', 'subtopic'],
    owner_sector: 'S4',
    note: 'legacy_topics / legacy_subtopics are retired readers (DM-16). Register S-01: do not add a fifth structure.',
  },
  {
    concept: 'DSKP node',
    description: 'The DSKP tree (unit / SP / TP descriptors) used for question tags, heatmaps and blueprints.',
    models: ['CurriculumNode', 'CurriculumTpDescriptor'],
    route: '/admin/curriculum',
    screen: 'Kurikulum (DSKP tree) and the Heatmap screens',
    api_prefixes: ['/api/buku-nota/heatmap', '/api/admin-sekolah/dskp-heatmap', '/api/guru/dskp'],
    api: 'API-DSKP (PRD 60 section 2.7)',
    keywords: ['curriculumnode', 'dskpnode', 'dskp'],
    owner_sector: 'S4',
    note: 'dskp_bidang/sk/sp stay as the teacher picking list only (DM-15); nothing joins them to question tags.',
  },
  {
    concept: 'answer store',
    description: 'The single store of every pupil answer (practice_answers); one writer port AnswerLogPort (DM-44).',
    models: ['PracticeAnswer'],
    route: '/practice',
    screen: 'Latih Tubi and every answering activity; all reports read this store',
    api_prefixes: ['/api/practice'],
    api: 'API-PRAC (PRD 60 section 2.9)',
    keywords: ['answer'],
    owner_sector: 'S5',
    note: 'Register S-02: about nine tables hold answers today (attempt_answers, structured_attempts, battle_answers, game_session_items, spm_mock_exam_items, pksk_exam_attempts, audio_kbat_attempts, remedial_test_items). They are marked parallel-of:PracticeAnswer; no new answer table, no direct insert into practice_answers.',
  },
  {
    concept: 'leaderboard',
    description: 'Pupil ranking by syiling (Papan Pendahulu), scope kelas | sekolah, period all | week | month.',
    models: ['CoinLedger', 'Tier'],
    route: '/leaderboard',
    screen: 'Papan Pendahulu (Murid row 33) at /leaderboard; /gamification/leaderboard redirects here (register R-01, D113).',
    api_prefixes: ['/api/leaderboard', '/api/gamification/leaderboard', '/api/rankings', '/api/battle/standings'],
    api: 'GET /api/leaderboard (API-RPT-13; register P-02, D113)',
    keywords: ['leaderboard', 'standing'],
    owner_sector: 'S7',
    note: 'Ranking Pelajar (/ranking, M08) and Sekolah Bersaing are separate screens with their own source; do not add a third leaderboard page or endpoint.',
  },
  {
    concept: 'reward catalogue',
    description: 'Digital-gift / reward catalogue (Kedai Hadiah) with one stock and one wallet.',
    models: ['Reward', 'RewardRedemption'],
    route: '/gamification/rewards',
    screen: 'Kedai Hadiah (Murid row 31); /cikgu/hadiah is a second entry point to the same catalogue (FD-MUR-33). Admin: /admin/hadiah and Kawalan Reward.',
    api_prefixes: ['/api/admin/hadiah', '/api/admin/reward-control', '/api/hadiah-digital', '/api/hadiah/redemptions'],
    api: 'API-GAME-08',
    keywords: ['reward'],
    owner_sector: 'S7',
    note: 'Register S-05 (D113): syiling_rewards / reward_claims are legacy-retire; Kawalan Reward edits rewards.',
  },
  {
    concept: 'ticket',
    description: 'Support ticket (Tiket Bantuan) with a single admin reply (DM-32).',
    models: ['SupportTicket', 'SupportConfig'],
    route: '/admin/tiket',
    screen: 'Tiket Bantuan: admin /admin/tiket; Murid /pusat-tuisyen/tiket; Guru and Admin Sekolah share the same screens',
    api_prefixes: ['/api/tiket', '/api/admin/tiket', '/api/config/support'],
    api: 'API-SUP (PRD 60 section 2.12)',
    keywords: ['ticket'],
    owner_sector: 'S7',
    note: 'Lucky-draw tickets (DrawTicket) are a different concept and keep the name Draw*.',
  },
  {
    concept: 'headcount',
    description: 'Class tracking of TOV / OTR / AR / RS per subject (Headcount); one On Track rule (XS-6).',
    models: ['HeadcountConfig', 'HeadcountEntry', 'HeadcountEntryMark'],
    route: '/headcount',
    screen: 'Headcount (Guru, Admin Sekolah); AR source is practice_answers (DM-44)',
    api_prefixes: ['/api/headcounts', '/api/command-center/headcount'],
    api: 'API-RPT (PRD 60 section 2.10)',
    keywords: ['headcount'],
    owner_sector: 'S10',
    note: 'Register P-05: do not write a second "On Track" predicate.',
  },
  {
    concept: 'class',
    description: 'A school class (classroom) with enrolments; question sets link through question_set_classrooms.',
    models: ['Classroom', 'Enrolment'],
    route: '/guru/kelas',
    screen: 'Kelas Saya (Guru, /guru/kelas), Kelas Sekolah (Admin Sekolah, /admin-sekolah/kelas), Kelas Saya (Murid, /kelas-saya), Kelas Sekolah (Admin Pusat, /admin/classes, to build)',
    api_prefixes: ['/api/guru/classes', '/api/kelas-saya', '/api/admin-sekolah/kelas'],
    api: 'API-GUR / API-AS (PRD 60 sections 2.3, 2.4)',
    keywords: ['classroom'],
    owner_sector: 'S6',
    note: 'Four role views of ONE classrooms table; the join-by-code box is removed (D-A8, GUR-8).',
  },
]

/** Duplicates found in the code that the PRD did not mention, all decided in the V3 duplicates register (D113). Kept in the map under "findings". */
export const SEED_FINDINGS = [
  { id: 'F-01', area: 'menus', register: 'M-11', title: 'Two admin menus', detail: 'src/shells/nav/admin-nav.ts (ADMIN_NAV, F-18 AdminShell) and src/shells/pentadbiran/menu.ts both define the Admin Pusat menu; layouts.ts adminShellFor() already sends role admin to the Pentadbiran portal.', decision: 'D113: src/shells/pentadbiran/menu.ts is the only admin menu; all admin-nav.ts items and the admin-only user-nav.ts items have status retire.' },
  { id: 'F-02', area: 'menus', register: 'M-11', title: 'user-nav carries admin-only copies', detail: 'USER_NAV has admin-only entries (ids guru-*, admin-*, urus-hadiah, admin-tebusan, kelulusan-hadiah) that Admin Pusat does not render.', decision: 'D113: retire; remove in S0-T07.' },
  { id: 'F-03', area: 'api+routes', register: 'R-01 / P-02', title: 'Leaderboard in two pages and two APIs', detail: '/leaderboard and /gamification/leaderboard; GET /api/leaderboard and GET /api/gamification/leaderboard (plus /api/rankings and /api/battle/standings, which are separate screens).', decision: 'D113: /leaderboard + GET /api/leaderboard are canonical; the other two are redirect / retire.' },
  { id: 'F-04', area: 'models+api', register: 'S-05', title: 'Two reward catalogues', detail: 'rewards + reward_redemptions (shop) versus syiling_rewards + reward_claims (Kawalan Reward only).', decision: 'D113: rewards + reward_redemptions canonical; syiling_rewards and reward_claims legacy-retire.' },
  { id: 'F-05', area: 'models+api+routes', register: 'M-10 / P-07 / S-03', title: 'Second mock-exam product', detail: 'spm_mock_exams, spm_mock_exam_items, /spm-mock*, /api/spm-mocks next to Bijak papers; listed twice in the pupil menu.', decision: 'D113: /spm-mock redirects to /spm/bijak; tables legacy-retire; /api/spm-mocks retire.' },
  { id: 'F-06', area: 'models', register: 'S-02', title: 'Answer facts in about nine tables', detail: 'attempt_answers, structured_attempts, battle_answers, game_session_items, spm_mock_exam_items, pksk_exam_attempts, audio_kbat_attempts, remedial_test_items next to practice_answers.', decision: 'D113: practice_answers is the single store (modes structured, battle, pksk, audio_kbat added); the others are parallel-of:PracticeAnswer sidecars, no new answer table.' },
  { id: 'F-07', area: 'routes', register: 'not in register', title: 'Placeholder preview routes shadow real routes', detail: 'core-routes.ts registers /admin (dev.preview-hub-admin) and /dashboard (dev.preview-hub-user) although the real routes exist (D20 temporary placeholders).', decision: 'D113: retire; previewHubRoutes() and its call are deleted (S0-T05, FR-X2-0)' },
  { id: 'F-08', area: 'client', register: 'P-03', title: 'Two front-end HTTP clients for the same admin endpoints', detail: 'm28-bijak-spm/server/http-admin.ts versus m04-question-bank/api/questions.ts. Not detectable by the map.', decision: 'D113: the client in the owning module stays; the other becomes a re-export, then is deleted.' },
]

// ---------------------------------------------------------------------------------------------
// Model decisions

export const SEED_MODEL_DECISIONS = {
  LegacyTopic: { status: 'legacy-retire', note: 'DM-16: prototype topic catalogue; readers switch to chapters -> topics -> subtopics; dropped in a later release (50 F5, ENT-LegacyTopic; register S-01)', dm: 'DM-16' },
  LegacySubtopic: { status: 'legacy-retire', note: 'DM-16: as LegacyTopic', dm: 'DM-16' },
  DskpBidang: { status: 'parallel-of:CurriculumNode', note: 'DM-15 Keep: teacher picking list (OWN-11); question tags use curriculum_nodes only; nothing joins the two', dm: 'DM-15' },
  DskpSk: { status: 'parallel-of:CurriculumNode', note: 'DM-15 Keep: teacher picking list', dm: 'DM-15' },
  DskpSp: { status: 'parallel-of:CurriculumNode', note: 'DM-15 Keep: teacher picking list', dm: 'DM-15' },
  Topic: { status: 'canonical', note: 'pupil-facing Bab tree (chapters/topics/subtopics) is canonical for pupil screens (DM-16); curriculum_nodes is the DSKP tree' },
  AttemptAnswer: { status: 'parallel-of:PracticeAnswer', note: 'DM-44 / register S-02: Bijak sitting detail (rev-guarded parts); every answer also goes to practice_answers via AnswerLogPort; never a second source for reports', dm: 'DM-44' },
  StructuredAttempt: { status: 'parallel-of:PracticeAnswer', note: 'register S-02 (D113): mode structured', dm: 'DM-44' },
  BattleAnswer: { status: 'parallel-of:PracticeAnswer', note: 'register S-02 (D113): mode battle', dm: 'DM-44' },
  GameSessionItem: { status: 'parallel-of:PracticeAnswer', note: 'register S-02: question-based games write practice_answers with mode game (R1-MUR-21)', dm: 'DM-44' },
  PkskExamAttempt: { status: 'parallel-of:PracticeAnswer', note: 'register S-02 (D113): mode pksk', dm: 'DM-44' },
  AudioKbatAttempt: { status: 'parallel-of:PracticeAnswer', note: 'register S-02 (D113): mode audio_kbat', dm: 'DM-44' },
  RemedialTestItem: { status: 'parallel-of:PracticeAnswer', note: 'register S-02: remedial writes practice_answers with mode remedial', dm: 'DM-44' },
  SpmMockExamItem: { status: 'legacy-retire', note: 'register M-10 / S-03 (D113): spm_mock_exams is retired with its items; no new writes; Bijak is the single engine' },
  SpmMockExam: { status: 'legacy-retire', note: 'register M-10 / P-07 / S-03 (D113): second mock-exam product; no new writes; Bijak papers are the single engine' },
  SyilingReward: { status: 'legacy-retire', note: 'register S-05 (D113): second reward catalogue; Kawalan Reward switches to rewards; migrate and retire', dm: 'DM-48' },
  RewardClaim: { status: 'legacy-retire', note: 'register S-05 (D113): claims of syiling_rewards; rewards + reward_redemptions are canonical', dm: 'DM-48' },
}

// ---------------------------------------------------------------------------------------------
// API-ID lookup from docs/prd/r1/60-api-contract.md (catalogue rows only)

export function parseApiIds(md) {
  const map = new Map()
  const cut = md.indexOf('## Appendix A')
  const body = cut > 0 ? md.slice(0, cut) : md
  for (const line of body.split(/\r?\n/)) {
    const m = line.match(/^\|\s*(API-[A-Z][A-Z0-9]*-\d+)\s*\|([^|]*)\|/)
    if (!m) continue
    for (const t of m[2].matchAll(/\b(GET|POST|PUT|PATCH|DELETE)\s+(\/api\/[^\s`,;|)]+)/g)) {
      const key = `${t[1]} ${normApiPattern(t[2].replace(/\?.*$/, ''))}`
      if (!map.has(key)) map.set(key, m[1])
    }
  }
  return map
}

// ---------------------------------------------------------------------------------------------
// Build / merge

const HAND_FIELDS = ['status', 'note', 'api_id', 'approved_by_card', 'target_label', 'dm']

function keepHand(prev, next) {
  if (!prev) return next
  for (const f of HAND_FIELDS) if (prev[f] !== undefined) next[f] = prev[f]
  return next
}

function ordered(o, order) {
  const out = {}
  for (const k of order) if (o[k] !== undefined) out[k] = o[k]
  for (const k of Object.keys(o)) if (!(k in out)) out[k] = o[k]
  return out
}

/** Build the map from the code (and previous map, to keep hand-set fields). */
export function buildMap({ code, prev, sector, apiIds, today }) {
  const prevBy = (arr, k) => new Map((arr ?? []).map((x) => [x.key ?? x.name, x]))
  const pr = prevBy(prev?.routes), pm = prevBy(prev?.menus), pmod = prevBy(prev?.models), pa = prevBy(prev?.apis)

  const routes = code.routes.map((r) => {
    const base = { key: r.key, path: r.path, name: r.name, component: r.component, file: r.file, sector: sector(r.file) }
    if (r.template) base.template = true
    if (r.redirect) base.redirects_to = r.redirect
    const old = pr.get(r.key)
    const next = keepHand(old, base)
    if (!old) {
      const seed = SEED_ROUTE_DECISIONS.find((d) => (d.name ? d.name === r.name : d.path ? d.path === r.path : d.rx.test(r.path)))
      next.status = seed?.status ?? (r.redirect && r.redirect !== '(dynamic)' ? `redirect-to:${r.redirect}` : 'canonical')
      if (seed?.note) next.note = seed.note
      next.approved_by_card = null
    }
    return ordered(next, ['key', 'path', 'name', 'status', 'sector', 'component', 'file'])
  })
  const routeOwner = (to) => {
    const exact = routes.find((r) => r.path === to)
    if (exact) return exact.sector
    const p = to.replace(/\?.*$/, '')
    const hit = routes.find((r) => r.path.replace(/\/:[^/]+/g, '') === p)
    return hit ? hit.sector : null
  }
  const menus = code.menus.map((m) => {
    const base = { key: m.key, source: m.source, id: m.id, label: m.label, route: m.route, roles: m.roles, sector: routeOwner(m.route) ?? sector(m.file), file: m.file }
    if (m.built === false) base.built = false
    if (m.group) base.group = m.group
    const old = pm.get(m.key)
    const next = keepHand(old, base)
    if (!old) {
      const seed = SEED_MENU_DECISIONS[m.key]
      next.status = seed?.status ?? 'canonical'
      if (m.source === 'admin-nav' || m.source === 'admin-footer') {
        next.status = 'retire'
        next.note = 'register M-11 (D113): second admin menu (F-18 AdminShell); src/shells/pentadbiran/menu.ts is the only admin menu'
      } else if (m.source === 'user-nav' && m.roles.length === 1 && m.roles[0] === 'admin' && !seed) {
        next.status = 'retire'
        next.note = 'register M-11 (D113): admin-only entry in an old nav file; src/shells/pentadbiran/menu.ts is the only admin menu'
      }
      if (seed?.target_label) next.target_label = seed.target_label
      if (seed?.note) next.note = seed.note
      next.approved_by_card = null
    }
    return ordered(next, ['key', 'source', 'id', 'label', 'route', 'roles', 'status', 'sector', 'file'])
  })
  const models = code.models.map((m) => {
    const base = { name: m.name, table: m.table, file: m.file, sector: sector(m.file) }
    const old = pmod.get(m.name)
    const next = keepHand(old, base)
    if (!old) {
      const seed = SEED_MODEL_DECISIONS[m.name]
      next.status = seed?.status ?? 'canonical'
      if (seed?.note) next.note = seed.note
      if (seed?.dm) next.dm = seed.dm
      next.approved_by_card = null
    }
    return ordered(next, ['name', 'table', 'status', 'sector', 'file'])
  })
  const apis = code.apis.map((a) => {
    const base = { key: a.key, method: a.method, path: a.path, file: a.file, sector: sector(a.file) }
    const old = pa.get(a.key)
    const next = keepHand(old, base)
    if (!old) {
      const seed = SEED_API_DECISIONS.find((d) => (d.key ? d.key === a.key : d.rx.test(a.key)))
      next.status = seed?.status ?? 'canonical'
      if (seed?.note) next.note = seed.note
      next.approved_by_card = null
    }
    if (next.api_id === undefined || next.api_id === null) {
      const id = apiIds?.get(a.key.replace(/ #\d+$/, ''))
      next.api_id = id ?? null
    }
    return ordered(next, ['key', 'method', 'path', 'api_id', 'status', 'sector', 'file'])
  })

  const concepts = prev?.concepts?.length ? prev.concepts : SEED_CONCEPTS
  return {
    _meta: {
      purpose: 'One function = one screen, one route, one menu entry, one table/model, one API. Single source of truth against duplicate builds (docs/plan/R1-START-HERE.md "No duplicates (enforced by CI)").',
      generator: 'node scripts/r1-canonical-map.mjs --write (code-derived fields); statuses, notes, api_id, approved_by_card, concepts are hand-set and kept',
      check: 'node scripts/r1-canonical-map.mjs --check (CI: .github/workflows/r1-scope-guard.yml)',
      statuses: {
        routes_menus_apis: 'canonical | redirect-to:<path> | retire',
        models: 'canonical | legacy-retire | parallel-of:<model>',
      },
      approval: 'A NEW route/menu/model/API that the scope guard flags as a possible duplicate needs: a DM-/API- ID in the PR body AND "approved_by_card": "<this PR\'s card id>" on its entry here.',
      register: 'Decisions follow the V3 duplicates register (D113): all entries decided, none pending.',
      excluded: 'Not listed on purpose: bottom-nav / "Lagi" popover / tab bars (views of listed items), out-of-scope.ts (a filter), pembelajaran-nav.ts (derived from user-nav), mock server routes (src/mock/**), dev galleries are listed with their /__ paths.',
      sector_source: '.github/CODEOWNERS (including the commented sector templates; last match wins; S0 = platform default)',
      ...(today ? { generated_on: today } : {}),
    },
    findings: prev?.findings ?? SEED_FINDINGS,
    routes,
    menus,
    models,
    apis,
    concepts,
  }
}

function diffKeys(code, map) {
  const res = []
  const kinds = [
    ['route', code.routes.map((x) => x.key), (map.routes ?? []).map((x) => x.key)],
    ['menu', code.menus.map((x) => x.key), (map.menus ?? []).map((x) => x.key)],
    ['model', code.models.map((x) => x.name), (map.models ?? []).map((x) => x.name)],
    ['api', code.apis.map((x) => x.key), (map.apis ?? []).map((x) => x.key)],
  ]
  for (const [kind, codeKeys, mapKeys] of kinds) {
    const m = new Set(mapKeys), c = new Set(codeKeys)
    for (const k of codeKeys) if (!m.has(k)) res.push({ kind, key: k, problem: 'missing' })
    for (const k of mapKeys) if (!c.has(k)) res.push({ kind, key: k, problem: 'stale' })
  }
  return res
}

/** Concept sanity: every referenced model exists in the map. */
function conceptProblems(map) {
  const names = new Set((map.models ?? []).map((m) => m.name))
  const out = []
  for (const c of map.concepts ?? []) for (const m of c.models ?? []) if (!names.has(m)) out.push(`concept "${c.concept}": model ${m} is not in the map`)
  return out
}

// ---------------------------------------------------------------------------------------------
// CLI

function readMap(root) {
  const p = join(root, MAP_PATH)
  return existsSync(p) ? JSON.parse(readFileSync(p, 'utf8')) : null
}

function summary(map) {
  const cnt = (arr, f) => (arr ?? []).filter(f).length
  const st = (x) => x.status ?? 'canonical'
  return {
    routes: { total: map.routes.length, redirect: cnt(map.routes, (x) => st(x).startsWith('redirect-to:')), retire: cnt(map.routes, (x) => st(x) === 'retire') },
    menus: { total: map.menus.length, redirect: cnt(map.menus, (x) => st(x).startsWith('redirect-to:')), retire: cnt(map.menus, (x) => st(x) === 'retire') },
    models: { total: map.models.length, legacyRetire: cnt(map.models, (x) => st(x) === 'legacy-retire'), parallel: cnt(map.models, (x) => st(x).startsWith('parallel-of:')) },
    apis: { total: map.apis.length, withApiId: cnt(map.apis, (x) => !!x.api_id), redirect: cnt(map.apis, (x) => st(x).startsWith('redirect-to:')), retire: cnt(map.apis, (x) => st(x) === 'retire') },
    concepts: map.concepts.length,
  }
}

function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const root = REPO_ROOT
  const fs = workTreeFs(root)
  const code = scanTree(fs)
  const prev = readMap(root)
  if (argv.includes('--write')) {
    const co = existsSync(join(root, CODEOWNERS_PATH)) ? readFileSync(join(root, CODEOWNERS_PATH), 'utf8') : ''
    const apiMd = existsSync(join(root, API_CONTRACT_PATH)) ? readFileSync(join(root, API_CONTRACT_PATH), 'utf8') : ''
    const map = buildMap({ code, prev, sector: makeSectorResolver(co), apiIds: parseApiIds(apiMd) })
    writeFileSync(join(root, MAP_PATH), JSON.stringify(map, null, 2) + '\n')
    console.log(`Wrote ${MAP_PATH}`)
    console.log(JSON.stringify(summary(map), null, 2))
    return
  }
  if (argv.includes('--check')) {
    if (!prev) { console.error(`FAIL: ${MAP_PATH} is missing. Run: node scripts/r1-canonical-map.mjs --write\nGAGAL: fail peta tiada.`); process.exit(1) }
    const diffs = diffKeys(code, prev)
    const missing = diffs.filter((d) => d.problem === 'missing')
    const stale = diffs.filter((d) => d.problem === 'stale')
    for (const d of missing) console.error(`FAIL [${d.kind}] ${d.key}\n     BM: wujud dalam kod tetapi tiada dalam ${MAP_PATH}. Jangan bina salinan; jika ia benar-benar baharu jalankan: node scripts/r1-canonical-map.mjs --write\n     EN: exists in the code but not in ${MAP_PATH}. Do not build a copy; if it is really new run: node scripts/r1-canonical-map.mjs --write`)
    for (const d of stale) console.error(`WARN [${d.kind}] ${d.key}\n     BM: ada dalam peta tetapi tiada dalam kod (jalankan --write untuk membuangnya).\n     EN: in the map but no longer in the code (run --write to drop it).`)
    for (const p of conceptProblems(prev)) console.error(`WARN ${p}`)
    const s = summary(prev)
    console.log(`Canonical map: routes ${s.routes.total}, menus ${s.menus.total}, models ${s.models.total}, apis ${s.apis.total}, concepts ${s.concepts}`)
    if (missing.length) { console.error(`KEPUTUSAN / RESULT: GAGAL / FAIL (${missing.length} item tiada dalam peta / not in the map)`); process.exit(1) }
    console.log(`KEPUTUSAN / RESULT: LULUS / PASS (${stale.length} amaran/warn)`)
    return
  }
  console.error('Usage: node scripts/r1-canonical-map.mjs --write | --check | --self-test')
  process.exit(2)
}

// ---------------------------------------------------------------------------------------------
// Self-test of the extractors

function selfTest() {
  const results = []
  const eq = (name, got, want) => {
    const ok = JSON.stringify(got) === JSON.stringify(want)
    results.push({ name, ok, detail: ok ? '' : `got ${JSON.stringify(got)} want ${JSON.stringify(want)}` })
  }
  const consts = new Map([['A_PATH', new Set(['/admin/a'])]])
  const rs = extractRoutes('src/m/routes/x.ts', `const routes = [
    { path: '/x', name: 'm.x', component: () => import('../pages/X.vue'), meta: { path: 'ignored' } },
    { path: \`\${A_PATH}/:id\`, name: 'm.a', component: () => import('@/pages/A.vue') },
    { path: '/old', redirect: '/x' },
    // { path: '/commented', component: C },
  ]`, consts)
  eq('routes: count', rs.length, 3)
  eq('routes: literal + component', [rs[0].path, rs[0].name, rs[0].component], ['/x', 'm.x', 'src/m/pages/X.vue'])
  eq('routes: template const', [rs[1].path, rs[1].component], ['/admin/a/:id', 'src/pages/A.vue'])
  eq('routes: redirect', [rs[2].path, rs[2].redirect], ['/old', '/x'])
  const ms = extractMenus('src/shells/nav/user-nav.ts', `const S = ['student'] as const
    const T = ['teacher'] as const
    export const USER_NAV = [
      { kind: 'item', id: 'a', label: 'Alpha', to: '/a', fa: 'x', color: '', roles: S },
      { kind: 'group', id: 'g', label: 'G', roles: T, children: [
        { kind: 'item', id: 'c', label: 'Child', to: '/g/c', fa: 'x', color: '' },
      ] },
    ]`)
  eq('menus: roles + group inherit', ms.map((m) => [m.id, m.roles.join()]), [['a', 'student'], ['c', 'teacher']])
  const pm = extractMenus('src/shells/pentadbiran/menu.ts', `export const PENTADBIRAN_FULL_MENU = [ { key: 'g1', label: 'G', items: items([
      ['PM-01', 'Langsung', '/admin/command-center'],
      ['PM-04', 'Analitik'],
      ['PM-05', 'Ringkasan', '/admin/kirkpatrick', K],
    ]) } ]
    export const FULL_ITEMS = 1`)
  eq('pentadbiran rows', pm.map((m) => [m.id, m.route, m.built]), [['PM-01', '/admin/command-center', true], ['PM-04', '/admin/p/pm-04', false], ['PM-05', '/admin/kirkpatrick', true]])
  const md = extractModels('x.prisma', 'model A {\n  id Int @id\n  @@map("a_tbl")\n}\n\nmodel B {\n  id Int @id\n}\n')
  eq('models', md.map((m) => [m.name, m.table]), [['A', 'a_tbl'], ['B', null]])
  const ap = extractApis('apps/api/src/x/x.controller.ts', `@Controller('q')
    export class A {
      @Get() list() {}
      @Get(':id') one() {}
      @Post(['a', 'b']) two() {}
    }
    @Controller()
    export class B { @Delete('me/x') d() {} }`)
  eq('apis', ap.map((a) => `${a.method} ${a.path}`), ['GET /api/q', 'GET /api/q/:id', 'POST /api/q/a', 'POST /api/q/b', 'DELETE /api/me/x'])
  eq('stem: suffix/prefix', [stemOf('questions2'), stemOf('question-v2'), stemOf('new-question'), stemOf('Question')], ['question', 'question', 'question', 'question'])
  eq('pathStem', pathStem('/admin/questions-new/:id'), 'admin/question/:')
  eq('levenshtein', levenshtein('kitten', 'sitting'), 3)
  eq('sector resolver', makeSectorResolver('/src/ @aminfaudzi\n# /src/modules/m05-practice/ @OWNER-S5\n')('src/modules/m05-practice/routes/a.ts'), 'S5')
  let bad = 0
  for (const r of results) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      ' + r.detail}`) }
  console.log(`\nSelf-test: ${results.length - bad}/${results.length} passed`)
  process.exit(bad ? 1 : 0)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()

