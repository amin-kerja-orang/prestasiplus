#!/usr/bin/env node
// R1 scope guard (card S0-T04 wires it into CI).
// Purpose: stop rebuilding V3 instead of fixing it. A PR must name one plan card (S<n>-T<nn>); the diff is checked
// against that card's Type and "Starts from (existing)" paths in docs/plan/r1-development-plan.md.
//
// Usage:
//   node scripts/r1-scope-guard.mjs [--base <ref>] [--head <ref>] [--body-file <path> | env PR_BODY] [--plan <path>]
//   node scripts/r1-scope-guard.mjs --self-test
// Exit 1 on any FAIL, 0 otherwise (WARN does not fail).
//
// Plan format relied on (keep stable):
//   card line   : **S<n>-T<nn> <title>** ... Type: Fix|Complete|Build|Keep|Verify|Ops ...   (Type on the card line)
//   path line   : - Starts from (existing): `path`, `path` ...   (paths in backticks, repo-relative)
//   ids line    : - Data/API: DM-xx, API-AREA-nn   (only informative here; the PR body is what is checked)
//   a card ends at the next card line or the next markdown heading (line starting with #).
import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const DEFAULT_BASE = 'origin/feature/v3-bijak-r1'
const DEFAULT_PLAN = 'docs/plan/r1-development-plan.md'
const NEW_SURFACE_TYPES = new Set(['Fix', 'Complete', 'Keep', 'Verify'])
const NO_PRODUCT_TYPES = new Set(['Keep', 'Verify', 'Ops'])
const CARD_RE = /^\*\*(S\d+-T\d+)\s+([^*]+)\*\*(.*)$/
const ID_IN_BODY_RE = /\b(?:DM-\d+|API-[A-Z][A-Z0-9]*-\d+)\b/
const SHRINK_RATIO = 0.6
const SHRINK_MIN_OLD_LINES = 10 // ignore tiny files, where 60% is a couple of lines

// ---------- git helpers ----------
const git = (cwd, args, opts = {}) =>
  execFileSync('git', args, { cwd, encoding: 'utf8', maxBuffer: 256 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'], ...opts })

const norm = (p) => p.replace(/\\/g, '/')

// ---------- plan parsing ----------
export function parsePlan(text) {
  const lines = text.split(/\r?\n/)
  const cards = new Map()
  let cur = null
  for (const line of lines) {
    const m = line.match(CARD_RE)
    if (m) {
      const type = (m[3].match(/Type:\s*(Fix|Complete|Build|Keep|Verify|Ops)\b/) ?? [])[1] ?? null
      cur = { id: m[1], title: m[2].trim(), type, lines: [line], starts: [] }
      cards.set(cur.id, cur)
      continue
    }
    if (/^#{1,6}\s/.test(line)) { cur = null; continue }
    if (!cur) continue
    cur.lines.push(line)
    if (!cur.type) {
      const t = line.match(/\bType:\s*(Fix|Complete|Build|Keep|Verify|Ops)\b/)
      if (t) cur.type = t[1]
    }
    const s = line.match(/Starts from \(existing\):(.*)$/)
    if (s) for (const b of s[1].matchAll(/`([^`]+)`/g)) cur.starts.push(norm(b[1]).replace(/^\.\//, ''))
  }
  for (const c of cards.values()) c.text = c.lines.join('\n')
  return cards
}

// directory prefix of a backticked path: strip globs, keep a directory (file -> its dirname)
function dirPrefix(p) {
  let q = p.replace(/\*.*$/, '')
  if (!q.includes('/')) return null
  if (!q.endsWith('/')) {
    const last = q.slice(q.lastIndexOf('/') + 1)
    q = /\.[A-Za-z0-9]+$/.test(last) ? q.slice(0, q.lastIndexOf('/') + 1) : q + '/'
  }
  return q
}

function buildDirs(card) {
  const dirs = new Set()
  const cands = [...card.starts]
  for (const m of card.text.matchAll(/`([^`\s]+\/[^`\s]*)`/g)) cands.push(norm(m[1]))
  for (const c of cands) {
    const d = dirPrefix(c)
    if (d) dirs.add(d)
  }
  return [...dirs]
}

// ---------- path rules ----------
const isTest = (p) => /(^|\/)__tests__\//.test(p) || /\.(spec|test)\.ts$/.test(p)
const isProduct = (p) => /^(src|apps|packages)\//.test(p)
const isPage = (p) => /^src\/(?:.*\/)?pages\/.*\.vue$/.test(p)
const isRouteFile = (p) => /^src\/(?:.*\/)?routes\/[^/]+\.ts$/.test(p)
const isController = (p) => /^apps\/api\/.*\.controller\.ts$/.test(p)
const isSchema = (p) => /^apps\/api\/prisma\/schema\/[^/]+\.prisma$/.test(p)
const migrationDir = (p) => (p.match(/^(apps\/api\/prisma\/migrations\/[^/]+)\/./) ?? [])[1] ?? null

// ---------- analysis ----------
export function analyze({ cwd, base, head, body, planText }) {
  const fails = []
  const warns = []
  const out = { card: null, type: null, fails, warns }

  const idMatch = (body ?? '').match(/\bS\d+-T\d+\b/)
  if (!idMatch) {
    fails.push({ rule: 'NO_CARD', file: null, msg_bm: 'PR mesti menyebut ID kad (cth. S1-T02).', msg_en: 'PR must name a card ID (e.g. S1-T02).' })
    return out
  }
  const cardId = idMatch[0]
  out.card = cardId
  const cards = parsePlan(planText)
  const card = cards.get(cardId)
  if (!card) {
    fails.push({ rule: 'UNKNOWN_CARD', file: null, msg_bm: `Kad ${cardId} tiada dalam pelan.`, msg_en: `Card ${cardId} is not in the plan.` })
    return out
  }
  out.type = card.type
  if (!card.type) {
    fails.push({ rule: 'NO_TYPE', file: null, msg_bm: `Kad ${cardId} tiada "Type:" dalam pelan.`, msg_en: `Card ${cardId} has no "Type:" in the plan.` })
    return out
  }
  const type = card.type
  const hasId = ID_IN_BODY_RE.test(body)

  const range = `${base}...${head}`
  const entries = git(cwd, ['diff', '--name-status', '--find-renames', range]).split('\n').filter(Boolean).map((l) => {
    const f = l.split('\t')
    const st = f[0][0]
    return { st, path: norm(f[f.length - 1]), oldPath: st === 'R' || st === 'C' ? norm(f[1]) : norm(f[1]) }
  })
  const numstat = new Map()
  for (const l of git(cwd, ['diff', '--numstat', '--find-renames', range]).split('\n').filter(Boolean)) {
    const [a, d, ...rest] = l.split('\t')
    let p = rest.join('\t')
    const br = p.match(/^(.*)\{(.*) => (.*)\}(.*)$/) // a/{b => c}/d
    if (br) p = (br[1] + br[3] + br[4]).replace(/\/\//g, '/')
    else if (p.includes(' => ')) p = p.split(' => ')[1]
    numstat.set(norm(p), { added: a === '-' ? 0 : +a, deleted: d === '-' ? 0 : +d })
  }
  const mergeBase = git(cwd, ['merge-base', base, head]).trim()

  // Rule: new surface without a DM/API ID (Fix/Complete/Keep/Verify)
  if (NEW_SURFACE_TYPES.has(type) && !hasId) {
    const add = (rule, file, bm, en) => fails.push({ rule, file, msg_bm: bm, msg_en: en })
    const seenMig = new Set()
    for (const e of entries) {
      if (e.st !== 'A' && e.st !== 'R' && e.st !== 'C') continue
      if (isPage(e.path)) add('NEW_PAGE', e.path, 'Halaman Vue baharu tanpa ID DM/API dalam badan PR.', 'New Vue page without a DM/API ID in the PR body.')
      if (isRouteFile(e.path)) add('NEW_ROUTE_FILE', e.path, 'Fail route baharu tanpa ID DM/API dalam badan PR.', 'New route file without a DM/API ID in the PR body.')
      if (isController(e.path)) add('NEW_CONTROLLER', e.path, 'Controller NestJS baharu tanpa ID DM/API dalam badan PR.', 'New NestJS controller without a DM/API ID in the PR body.')
      const md = migrationDir(e.path)
      if (md && e.st === 'A' && !seenMig.has(md)) {
        seenMig.add(md)
        add('NEW_MIGRATION', md, 'Folder migrasi baharu tanpa ID DM/API dalam badan PR.', 'New migration folder without a DM/API ID in the PR body.')
      }
    }
    for (const e of entries) {
      if (!isSchema(e.path)) continue
      const diff = git(cwd, ['diff', '-U0', '--find-renames', range, '--', e.path])
      for (const m of diff.matchAll(/^\+model\s+(\w+)\s*\{/gm)) {
        // a model merely moved between files would show as removed elsewhere; treat as new only if not in base anywhere
        let existedInBase = false
        try { existedInBase = new RegExp(`^model\\s+${m[1]}\\s*\\{`, 'm').test(git(cwd, ['grep', '-h', '-E', `^model +${m[1]} *\\{`, mergeBase, '--', 'apps/api/prisma/schema'])) } catch { /* not found */ }
        if (!existedInBase) fails.push({ rule: 'NEW_MODEL', file: `${e.path} (model ${m[1]})`, msg_bm: 'Model Prisma baharu tanpa ID DM/API dalam badan PR.', msg_en: 'New Prisma model without a DM/API ID in the PR body.' })
      }
    }
  }

  // Rule: Keep/Verify/Ops must not change product code
  if (NO_PRODUCT_TYPES.has(type)) {
    for (const e of entries) {
      const paths = [e.path, ...(e.st === 'R' ? [e.oldPath] : [])]
      if (!paths.some(isProduct)) continue
      if (type === 'Verify' && isTest(e.path)) continue
      fails.push({ rule: 'PRODUCT_CODE_CHANGED', file: e.path, msg_bm: `Kad ${type} tidak boleh mengubah kod produk (src/, apps/, packages/).`, msg_en: `A ${type} card must not change product code (src/, apps/, packages/).` })
    }
  }

  // Rule: Fix/Complete must touch a "Starts from" path
  if ((type === 'Fix' || type === 'Complete') && card.starts.length) {
    const touched = entries.some((e) => card.starts.some((s) => e.path.startsWith(s) || (e.oldPath && e.oldPath.startsWith(s))))
    if (!touched) warns.push({ rule: 'NO_STARTS_FROM_TOUCHED', file: card.starts.join(', '), msg_bm: 'Tiada fail "Starts from" kad disentuh; mungkin membina di tempat lain.', msg_en: 'None of the card\'s "Starts from" paths is touched; this may be built elsewhere.' })
  }

  // Rule: big shrink of an existing file
  for (const e of entries) {
    if (e.st !== 'M' && e.st !== 'R') continue
    const ns = numstat.get(e.path)
    if (!ns || !ns.deleted) continue
    let old = 0
    try { old = git(cwd, ['show', `${mergeBase}:${e.oldPath}`], { stdio: ['ignore', 'pipe', 'ignore'] }).split('\n').length - 1 } catch { continue }
    if (old >= SHRINK_MIN_OLD_LINES && ns.deleted > SHRINK_RATIO * old) {
      warns.push({ rule: 'BIG_SHRINK', file: e.path, msg_bm: `Fail kehilangan ${ns.deleted} daripada ${old} baris (>60%); semak sama ada ditulis semula.`, msg_en: `File loses ${ns.deleted} of ${old} lines (>60%); check whether it was rewritten.` })
    }
  }

  // Rule: Build adds files outside named dirs
  if (type === 'Build') {
    const dirs = buildDirs(card)
    for (const e of entries) {
      if (e.st !== 'A') continue
      if (!dirs.some((d) => e.path.startsWith(d))) warns.push({ rule: 'BUILD_OUTSIDE_DIRS', file: e.path, msg_bm: 'Fail baharu di luar direktori yang dinamakan dalam kad.', msg_en: 'New file outside the directories named in the card.' })
    }
  }
  return out
}

export function report(res) {
  const L = []
  L.push('=== R1 scope guard / Pengawal skop R1 ===')
  L.push(`Kad / Card : ${res.card ?? '(tiada / none)'}${res.type ? `  |  Jenis / Type: ${res.type}` : ''}`)
  for (const f of res.fails) L.push(`FAIL [${f.rule}]${f.file ? ' ' + f.file : ''}\n     BM: ${f.msg_bm}\n     EN: ${f.msg_en}`)
  for (const w of res.warns) L.push(`WARN [${w.rule}]${w.file ? ' ' + w.file : ''}\n     BM: ${w.msg_bm}\n     EN: ${w.msg_en}`)
  L.push(res.fails.length
    ? `KEPUTUSAN / RESULT: GAGAL / FAIL (${res.fails.length} fail, ${res.warns.length} amaran/warn). Analisis kod sedia ada dan tutup jurang dalam fail sedia ada; jangan bina semula. / Analyse the existing code and close gaps in existing files; do not rebuild.`
    : `KEPUTUSAN / RESULT: LULUS / PASS (${res.warns.length} amaran/warn)`)
  return L.join('\n')
}

// ---------- self-test ----------
const FIXTURE_PLAN = `# Plan
## Cards
**S9-T01 Fix card** · P0 · S · Type: Fix · deps: none
- Starts from (existing): \`src/mod/a.ts\`, \`apps/api/src/mod/\`.
- Data/API: DM-01

**S9-T02 Complete card** · P0 · S · Type: Complete · deps: none
- Starts from (existing): \`src/mod/a.ts\`.

**S9-T03 Keep card** · P0 · S · Type: Keep · deps: none
- Starts from (existing): \`src/mod/a.ts\`.

**S9-T04 Verify card** · P0 · S · Type: Verify · deps: none
- Starts from (existing): \`src/mod/a.ts\`.

**S9-T05 Ops card** · P0 · S · Type: Ops · deps: none
- Starts from (existing): \`compose.yaml\`.

**S9-T06 Build card** · P0 · S · Type: Build · deps: none
- Starts from (existing): \`scripts/lint.mjs\`.
- Files: \`scripts/new-check.mjs\`, \`docs/ops/\`.
`

function selfTest() {
  const results = []
  const tmp = mkdtempSync(join(tmpdir(), 'r1-scope-guard-'))
  const sh = (cwd, ...a) => git(cwd, a)
  const write = (cwd, rel, content) => { const p = join(cwd, rel); mkdirSync(dirname(p), { recursive: true }); writeFileSync(p, content) }
  const lines = (n, tag = 'x') => Array.from({ length: n }, (_, i) => `${tag}${i}`).join('\n') + '\n'

  function makeRepo(name, mutate) {
    const cwd = join(tmp, 'r' + results.length)
    mkdirSync(cwd)
    sh(cwd, 'init', '-q', '-b', 'main')
    sh(cwd, 'config', 'user.email', 't@t.t'); sh(cwd, 'config', 'user.name', 't'); sh(cwd, 'config', 'commit.gpgsign', 'false')
    write(cwd, 'src/mod/a.ts', lines(30))
    write(cwd, 'src/mod/big.ts', lines(100))
    write(cwd, 'src/mod/pages/Old.vue', '<template/>\n')
    write(cwd, 'apps/api/src/mod/x.service.ts', lines(5))
    write(cwd, 'apps/api/prisma/schema/core.prisma', 'model Existing {\n  id Int @id\n}\n')
    write(cwd, 'apps/api/prisma/migrations/0001_init/migration.sql', 'select 1;\n')
    write(cwd, 'scripts/lint.mjs', lines(20))
    write(cwd, 'compose.yaml', 'a: 1\n')
    sh(cwd, 'add', '-A'); sh(cwd, 'commit', '-q', '-m', 'base')
    sh(cwd, 'checkout', '-q', '-b', 'work')
    mutate(cwd)
    sh(cwd, 'add', '-A'); sh(cwd, 'commit', '-q', '--allow-empty', '-m', 'work')
    return cwd
  }

  function run(name, body, mutate, expect) {
    let ok = false, detail = ''
    try {
      const cwd = makeRepo(name, mutate)
      const res = analyze({ cwd, base: 'main', head: 'work', body, planText: FIXTURE_PLAN })
      const fr = new Set(res.fails.map((f) => f.rule)), wr = new Set(res.warns.map((w) => w.rule))
      const missing = [...(expect.fail ?? [])].filter((r) => !fr.has(r)).concat([...(expect.warn ?? [])].filter((r) => !wr.has(r)))
      const extra = expect.exact ? [...fr].filter((r) => !(expect.fail ?? []).includes(r)).concat([...wr].filter((r) => !(expect.warn ?? []).includes(r))) : []
      ok = !missing.length && !extra.length
      if (!ok) detail = `missing=[${missing}] unexpected=[${extra}] got fail=[${[...fr]}] warn=[${[...wr]}]`
    } catch (e) { detail = String(e.stack ?? e) }
    results.push({ name, ok, detail })
  }

  const touchA = (c) => write(c, 'src/mod/a.ts', lines(30) + 'extra\n')
  run('no card id in body', 'tiada kad', touchA, { fail: ['NO_CARD'], exact: true })
  run('unknown card id', 'S9-T99', touchA, { fail: ['UNKNOWN_CARD'], exact: true })
  run('clean Fix PR passes', 'S9-T01', touchA, { exact: true })
  run('Fix adds Vue page, no ID', 'S9-T01', (c) => { touchA(c); write(c, 'src/mod/pages/New.vue', '<template/>\n') }, { fail: ['NEW_PAGE'], exact: true })
  run('Fix adds Vue page, with DM id -> ok', 'S9-T01 DM-12', (c) => { touchA(c); write(c, 'src/mod/pages/New.vue', '<template/>\n') }, { exact: true })
  run('Complete adds route file, no ID', 'S9-T02', (c) => { touchA(c); write(c, 'src/mod/routes/new.ts', 'export {}\n') }, { fail: ['NEW_ROUTE_FILE'], exact: true })
  run('Fix adds controller, API id -> ok', 'S9-T01 API-AUTH-17', (c) => { touchA(c); write(c, 'apps/api/src/mod/new.controller.ts', 'export {}\n') }, { exact: true })
  run('Fix adds controller, no ID', 'S9-T01', (c) => { touchA(c); write(c, 'apps/api/src/mod/new.controller.ts', 'export {}\n') }, { fail: ['NEW_CONTROLLER'], exact: true })
  run('Fix adds Prisma model, no ID', 'S9-T01', (c) => { touchA(c); write(c, 'apps/api/prisma/schema/core.prisma', 'model Existing {\n  id Int @id\n}\n\nmodel Brand {\n  id Int @id\n}\n') }, { fail: ['NEW_MODEL'], exact: true })
  run('Fix edits existing model only -> ok', 'S9-T01', (c) => { touchA(c); write(c, 'apps/api/prisma/schema/core.prisma', 'model Existing {\n  id Int @id\n  name String\n}\n') }, { exact: true })
  run('Fix adds migration folder, no ID', 'S9-T01', (c) => { touchA(c); write(c, 'apps/api/prisma/migrations/0002_new/migration.sql', 'select 2;\n') }, { fail: ['NEW_MIGRATION'], exact: true })
  run('Keep card changes product code', 'S9-T03', touchA, { fail: ['PRODUCT_CODE_CHANGED'], exact: true })
  run('Ops card changes product code', 'S9-T05', (c) => { write(c, 'compose.yaml', 'a: 2\n'); touchA(c) }, { fail: ['PRODUCT_CODE_CHANGED'], exact: true })
  run('Ops card changes only compose -> ok', 'S9-T05', (c) => write(c, 'compose.yaml', 'a: 2\n'), { exact: true })
  run('Verify card: tests allowed', 'S9-T04', (c) => { write(c, 'src/mod/__tests__/a.test.ts', 'export {}\n'); write(c, 'apps/api/src/mod/x.spec.ts', 'export {}\n') }, { exact: true })
  run('Verify card: product code fails', 'S9-T04', (c) => { write(c, 'src/mod/__tests__/a.test.ts', 'export {}\n'); touchA(c) }, { fail: ['PRODUCT_CODE_CHANGED'], exact: true })
  run('Fix touches no Starts-from path -> warn', 'S9-T01', (c) => write(c, 'src/other/z.ts', 'export {}\n'), { warn: ['NO_STARTS_FROM_TOUCHED'], exact: true })
  run('Starts-from directory prefix counts', 'S9-T01', (c) => write(c, 'apps/api/src/mod/x.service.ts', lines(5) + 'more\n'), { exact: true })
  run('big shrink (>60%) -> warn', 'S9-T01', (c) => { touchA(c); write(c, 'src/mod/big.ts', lines(20)) }, { warn: ['BIG_SHRINK'], exact: true })
  run('moderate shrink (<60%) -> ok', 'S9-T01', (c) => { touchA(c); write(c, 'src/mod/big.ts', lines(60)) }, { exact: true })
  run('Build adds file in named dir -> ok', 'S9-T06', (c) => { write(c, 'scripts/new-check.mjs', 'x\n'); write(c, 'docs/ops/n.md', 'x\n') }, { exact: true })
  run('Build adds file outside dirs -> warn', 'S9-T06', (c) => { write(c, 'scripts/new-check.mjs', 'x\n'); write(c, 'src/mod/stray.ts', 'x\n') }, { warn: ['BUILD_OUTSIDE_DIRS'], exact: true })

  rmSync(tmp, { recursive: true, force: true })
  let bad = 0
  for (const r of results) { if (!r.ok) bad++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      ' + r.detail}`) }
  console.log(`\nSelf-test: ${results.length - bad}/${results.length} passed`)
  process.exit(bad ? 1 : 0)
}

// ---------- main ----------
function main() {
  const argv = process.argv.slice(2)
  if (argv.includes('--self-test')) return selfTest()
  const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
  const base = arg('--base', DEFAULT_BASE)
  const head = arg('--head', 'HEAD')
  const bodyFile = arg('--body-file', null)
  const body = bodyFile ? readFileSync(bodyFile, 'utf8') : process.env.PR_BODY ?? ''
  const planPath = resolve(process.cwd(), arg('--plan', DEFAULT_PLAN))
  if (!existsSync(planPath)) { console.error(`Pelan tidak dijumpai / plan not found: ${planPath}`); process.exit(2) }
  let res
  try { res = analyze({ cwd: process.cwd(), base, head, body, planText: readFileSync(planPath, 'utf8') }) }
  catch (e) { console.error(`Ralat git / git error (base=${base} head=${head}): ${e.stderr || e.message}`); process.exit(2) }
  console.log(report(res))
  process.exit(res.fails.length ? 1 : 0)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
