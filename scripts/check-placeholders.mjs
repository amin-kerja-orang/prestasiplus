#!/usr/bin/env node
// Placeholder-string check (card S0-T04; PRD docs/prd/r1/40-cross-cutting.md AC-X2-3). Node built-ins only.
//
// Fails (mode `fail`) or reports (mode `report`) when module code contains a banned string:
//   * scans src/modules/** and src/shells/** (.vue .ts .tsx .js .mjs .json .html), excluding tests and fixtures
//     (__tests__/, *.spec.*, *.test.*, __fixtures__/, fixtures/, e2e/), case-insensitive;
//   * the banned strings are NOT written here: they are read from the sentence of AC-X2-3 that starts
//     "contains, compared without regard to letter case, any banned string:" (every double-quoted string up to the
//     next full stop outside quotes);
//   * a finding is allowed by scripts/placeholder-allowlist.json when the line holds an entry string that itself
//     contains the banned string AND the file path matches one of the entry's `screens` globs (`**`, `*`);
//   * second clause: a route file (routes.ts or routes/) under src/modules/** that references PrototypeUnavailablePage
//     is a finding, except under src/modules/m18-ppd-jpn/** (officers page, register row 18, allow-list item 3).
//
// Sync check (runs on EVERY run, exits 1 in any mode when broken): the allow-list JSON mirrors table X2-3-A.
//   Rule for the `string` value (ONE rule): the table's string cell is split into its backtick spans, in order.
//   A cell with one span gives a JSON string; a cell with several spans (P-03, P-07, and D-01/D-03 whose second line is
//   also in backticks) gives a JSON array of those spans. Prose outside backticks is ignored. `{id}` / `{n}` in a
//   string is a wildcard when matching a line. Ids, strings, condition and prd are compared both ways.
//
// Usage:
//   node scripts/check-placeholders.mjs            (PLACEHOLDER_CHECK_MODE=report|fail, default report)
//   node scripts/check-placeholders.mjs --self-test
// Exit: 0 report mode / clean; 1 in fail mode with findings, or a broken sync check, or a failed self-test; 2 bad mode.
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const ROOT = fileURLToPath(new URL('../', import.meta.url))
const DOC = 'docs/prd/r1/40-cross-cutting.md'
const ALLOWLIST = 'scripts/placeholder-allowlist.json'
const SCAN_DIRS = ['src/modules', 'src/shells']
const EXTS = new Set(['.vue', '.ts', '.tsx', '.js', '.mjs', '.json', '.html'])
const SENTENCE = 'contains, compared without regard to letter case, any banned string:'
const MODES = ['report', 'fail']
const DEFAULT_MODE = 'report'

// ---------- banned strings (read from the PRD sentence) ----------
export function loadBannedStrings(rawDoc) {
  const docText = rawDoc.replace(/\*\*/g, '') // the PRD bolds "banned string"
  const at = docText.indexOf(SENTENCE)
  if (at < 0) throw new Error(`sentence not found in ${DOC}: "${SENTENCE}"`)
  const out = []
  let inQuote = false
  let cur = ''
  for (const ch of docText.slice(at + SENTENCE.length)) {
    if (ch === '"') {
      if (inQuote) out.push(cur)
      cur = ''
      inQuote = !inQuote
    } else if (inQuote) cur += ch
    else if (ch === '.' || ch === '\n') break // the sentence ends at the first full stop outside quotes
  }
  return out
}

// ---------- table X2-3-A ----------
export function parseTable(docText) {
  const rows = []
  for (const line of docText.split(/\r?\n/)) {
    const m = /^\|\s*([PD]-\d\d)\s*\|/.exec(line)
    if (!m) continue
    const c = line.split('|').map((s) => s.trim())
    const spans = [...c[2].matchAll(/`([^`]+)`/g)].map((x) => x[1])
    rows.push({ id: m[1], string: spans.length === 1 ? spans[0] : spans, condition: c[4], prd: c[5] })
  }
  return rows
}

const asList = (s) => (Array.isArray(s) ? s : [s])

export function syncCheck(docText, allow) {
  const problems = []
  const table = new Map(parseTable(docText).map((r) => [r.id, r]))
  const json = new Map((allow.entries ?? []).map((e) => [e.id, e]))
  if (table.size === 0) problems.push(`no P-nn / D-nn rows found in table X2-3-A of ${DOC}`)
  for (const [id, r] of table) {
    const e = json.get(id)
    if (!e) {
      problems.push(`${id}: in table X2-3-A, missing in ${ALLOWLIST}`)
      continue
    }
    if (JSON.stringify(asList(e.string)) !== JSON.stringify(asList(r.string)))
      problems.push(`${id}: string differs (table ${JSON.stringify(r.string)} vs json ${JSON.stringify(e.string)})`)
    if (e.condition !== r.condition) problems.push(`${id}: condition differs from the table`)
    if (e.prd !== r.prd) problems.push(`${id}: prd differs from the table`)
    if (!Array.isArray(e.screens) || e.screens.length === 0) problems.push(`${id}: screens is empty`)
  }
  for (const id of json.keys()) if (!table.has(id)) problems.push(`${id}: in ${ALLOWLIST}, missing in table X2-3-A`)
  return problems
}

// ---------- glob ----------
export function globToRegExp(glob) {
  let re = ''
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i]
    if (ch === '*') {
      if (glob[i + 1] === '*') {
        i++
        if (glob[i + 1] === '/') {
          i++
          re += '(?:.*/)?'
        } else re += '.*'
      } else re += '[^/]*'
    } else re += ch.replace(/[.+?^${}()|[\]\\]/g, '\\$&')
  }
  return new RegExp(`^${re}$`)
}
const globMatch = (glob, path) => globToRegExp(glob).test(path)

// `{id}` / `{n}` in an allow-list string is a wildcard; everything else is literal (case-insensitive).
function stringRegExp(s) {
  const parts = s.split(/\{[^}]*\}/).map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  return new RegExp(parts.join('.*'), 'i')
}

// ---------- scanning ----------
const EXCLUDED_SEG = new Set(['__tests__', '__fixtures__', 'fixtures', 'e2e'])
export function isExcluded(rel) {
  const parts = rel.split('/')
  if (parts.slice(0, -1).some((p) => EXCLUDED_SEG.has(p))) return true
  return /\.(spec|test)\./.test(parts[parts.length - 1])
}

function* walk(abs, rel) {
  let items
  try {
    items = readdirSync(abs, { withFileTypes: true })
  } catch {
    return
  }
  for (const it of items) {
    if (it.name === 'node_modules') continue
    const r = `${rel}/${it.name}`
    if (it.isDirectory()) yield* walk(join(abs, it.name), r)
    else if (EXTS.has(it.name.slice(it.name.lastIndexOf('.')))) yield r
  }
}

const isRouteFile = (rel) => /(^|\/)routes(\.[a-z]+$|\/)/.test(rel)

/** Scan `root`. `banned` and `allow` (parsed allow-list JSON) are inputs; returns { banned, findings }. */
export function scan({ root, banned, allow }) {
  const entries = (allow.entries ?? []).map((e) => ({
    globs: e.screens ?? [],
    strings: asList(e.string).map((s) => ({ lower: s.toLowerCase(), re: stringRegExp(s) })),
  }))
  const bannedLower = banned.map((b) => b.toLowerCase())
  const findings = []
  for (const dir of SCAN_DIRS) {
    for (const rel of walk(join(root, dir), dir)) {
      if (isExcluded(rel)) continue
      const lines = readFileSync(join(root, rel), 'utf8').split(/\r?\n/)
      const applicable = entries.filter((e) => e.globs.some((g) => globMatch(g, rel)))
      const routeCheck = rel.startsWith('src/modules/') && isRouteFile(rel) && !rel.startsWith('src/modules/m18-ppd-jpn/')
      lines.forEach((line, i) => {
        const low = line.toLowerCase()
        banned.forEach((b, bi) => {
          if (!low.includes(bannedLower[bi])) return
          const allowed = applicable.some((e) => e.strings.some((s) => s.lower.includes(bannedLower[bi]) && s.re.test(line)))
          if (!allowed) findings.push({ file: rel, line: i + 1, text: b, context: line.trim() })
        })
        if (routeCheck && line.includes('PrototypeUnavailablePage'))
          findings.push({ file: rel, line: i + 1, text: 'PrototypeUnavailablePage', context: line.trim() })
      })
    }
  }
  return { banned, findings }
}

const fmt = (f) => `${f.file}:${f.line}: "${f.text}" in: ${f.context.length > 160 ? `${f.context.slice(0, 157)}...` : f.context}`
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))

function loadAll(root) {
  const docText = readFileSync(join(root, DOC), 'utf8')
  const allow = readJson(join(root, ALLOWLIST))
  return { docText, allow, banned: loadBannedStrings(docText) }
}

// ---------- normal run ----------
function main() {
  const mode = process.env.PLACEHOLDER_CHECK_MODE || DEFAULT_MODE
  if (!MODES.includes(mode)) {
    console.error(`check-placeholders: unknown PLACEHOLDER_CHECK_MODE "${mode}" (use ${MODES.join(' or ')})`)
    return 2
  }
  const { docText, allow, banned } = loadAll(ROOT)
  const sync = syncCheck(docText, allow)
  if (sync.length) {
    console.error(`check-placeholders: allow-list is out of sync with table X2-3-A of ${DOC}:`)
    for (const p of sync) console.error(`  - ${p}`)
    return 1
  }
  if (banned.length === 0) {
    console.error(`check-placeholders: no banned strings parsed from ${DOC}`)
    return 1
  }
  return evaluate(mode, ROOT, banned, allow)
}

/** Scan `scanRoot`, print findings and return the exit code of `mode`. */
function evaluate(mode, scanRoot, banned, allow, quiet = false) {
  const { findings } = scan({ root: scanRoot, banned, allow })
  if (!quiet) {
    for (const f of findings) console.log(fmt(f))
    console.log(`check-placeholders: mode ${mode}, ${banned.length} banned strings, ${findings.length} finding(s)`)
  }
  return mode === 'fail' && findings.length ? 1 : 0
}

// ---------- self-test ----------
function selfTest() {
  let failed = 0
  const check = (name, ok, detail = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : detail ? `  (${detail})` : ''}`)
    if (!ok) failed++
  }
  const { docText, allow, banned } = loadAll(ROOT)

  // banned list: parsed from the sentence, and the scanner uses exactly that list
  const independent = [...(/any banned string:([^;]*);/.exec(docText.replace(/\*\*/g, ''))?.[1] ?? '').matchAll(/"([^"]+)"/g)].map((m) => m[1])
  check('banned list is non-empty', banned.length > 0)
  check('banned list has no duplicates', new Set(banned.map((b) => b.toLowerCase())).size === banned.length)
  check('banned list equals the strings quoted in the AC-X2-3 sentence', JSON.stringify(banned) === JSON.stringify(independent), `${JSON.stringify(banned)} vs ${JSON.stringify(independent)}`)

  // sync checks
  check('sync: allow-list matches table X2-3-A (real docs)', syncCheck(docText, allow).length === 0, syncCheck(docText, allow).join('; '))
  const clone = () => JSON.parse(JSON.stringify(allow))
  const missing = clone()
  missing.entries = missing.entries.filter((e) => e.id !== 'D-05')
  check('sync: id missing in JSON fails', syncCheck(docText, missing).some((p) => p.startsWith('D-05') && p.includes('missing in')))
  const changed = clone()
  changed.entries.find((e) => e.id === 'D-02').string = 'Belum tersedia!'
  check('sync: changed string fails', syncCheck(docText, changed).some((p) => p.startsWith('D-02') && p.includes('string differs')))
  const extra = clone()
  extra.entries.push({ id: 'D-99', string: 'x', screens: ['src/x/**'], condition: 'c', prd: 'p' })
  check('sync: extra JSON id fails', syncCheck(docText, extra).some((p) => p.startsWith('D-99')))
  const tamperedDoc = docText.replace(/^\| D-13 \|/m, '| D-98 |')
  const dp = syncCheck(tamperedDoc, allow)
  check('sync: id missing in table fails (both ways)', dp.some((p) => p.startsWith('D-13') && p.includes('missing in table')) && dp.some((p) => p.startsWith('D-98')))

  // fixtures
  const tmp = mkdtempSync(join(tmpdir(), 'check-placeholders-'))
  const put = (rel, text) => {
    mkdirSync(dirname(join(tmp, rel)), { recursive: true })
    writeFileSync(join(tmp, rel), text)
  }
  try {
    const m04 = 'src/modules/m04-question-bank'
    put(`${m04}/pages/StudioGroupPage.vue`, '<template><button>Pratonton kumpulan</button></template>\n')
    put('src/modules/m05-practice/pages/X.vue', '<template><h1>Pratonton</h1></template>\n')
    put('src/modules/m05-practice/__tests__/x.spec.ts', "expect('Pratonton').toBe('akan datang')\n")
    put('src/modules/m05-practice/a.test.ts', "'coming soon'\n")
    put('src/modules/m11-teacher-analytics/routes/a.ts', "import PrototypeUnavailablePage from '@/pages/PrototypeUnavailablePage.vue'\n")
    put('src/modules/m18-ppd-jpn/routes.ts', "import PrototypeUnavailablePage from '@/pages/PrototypeUnavailablePage.vue'\n")
    const res = scan({ root: tmp, banned, allow })
    const at = (file) => res.findings.filter((f) => f.file === file)
    check('scanner uses exactly the parsed banned list', JSON.stringify(res.banned) === JSON.stringify(independent))
    check('Pratonton kumpulan in m04 (P-02 screen) is allowed', at(`${m04}/pages/StudioGroupPage.vue`).length === 0)
    check('Pratonton as a page title in m05-practice is a finding', at('src/modules/m05-practice/pages/X.vue').length === 1)
    check('banned strings in test files are ignored', at('src/modules/m05-practice/__tests__/x.spec.ts').length === 0 && at('src/modules/m05-practice/a.test.ts').length === 0)
    check('PrototypeUnavailablePage in an m11 route file is a finding', at('src/modules/m11-teacher-analytics/routes/a.ts').length === 1)
    check('PrototypeUnavailablePage in m18-ppd-jpn routes is allowed', at('src/modules/m18-ppd-jpn/routes.ts').length === 0)
    check('total findings in the fixture tree is 2', res.findings.length === 2, String(res.findings.length))

    check('fail mode exits 1 on the fixture tree', evaluate('fail', tmp, banned, allow, true) === 1)
    check('report mode exits 0 on the fixture tree', evaluate('report', tmp, banned, allow, true) === 0)
  } finally {
    rmSync(tmp, { recursive: true, force: true })
  }

  // glob matcher
  check('glob: ** crosses folders, * does not', globMatch('a/**', 'a/b/c.vue') && globMatch('a/*.vue', 'a/c.vue') && !globMatch('a/*.vue', 'a/b/c.vue'))

  // mode handling and real exit codes (child processes)
  const child = (env) => spawnSync(process.execPath, [fileURLToPath(import.meta.url)], { cwd: ROOT, env: { ...process.env, ...env }, encoding: 'utf8' })
  check('unknown mode exits 2', child({ PLACEHOLDER_CHECK_MODE: 'bogus' }).status === 2)
  check('report mode exits 0', child({ PLACEHOLDER_CHECK_MODE: 'report' }).status === 0)

  console.log(failed ? `check-placeholders self-test: ${failed} FAILED` : 'check-placeholders self-test: all PASS')
  return failed ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  try {
    process.exit(process.argv.includes('--self-test') ? selfTest() : main())
  } catch (e) {
    console.error(`check-placeholders: ${e.message}`)
    process.exit(1)
  }
}
