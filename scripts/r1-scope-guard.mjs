#!/usr/bin/env node
// R1 scope guard (card S0-T04 wires it into CI).
// Purpose: stop rebuilding V3 instead of fixing it. A PR must name one plan card (S<n>-T<nn>, or S<n>-T<nn>a / b for a split card, D113); the diff is checked
// against that card's Type and "Starts from (existing)" paths in docs/plan/r1-development-plan.md.
//
// Usage:
//   node scripts/r1-scope-guard.mjs [--base <ref>] [--head <ref>] [--body-file <path> | env PR_BODY] [--plan <path>]
//                                   [--labels a,b,c | --labels-file <path> | env PR_LABELS]
//   node scripts/r1-scope-guard.mjs --self-test
// A PR whose changed files are all under docs/ needs no card: it prints `docs-only PR: no card` and exits 0.
// Exit 1 on any FAIL, 0 otherwise (WARN does not fail).
//
// Cross-sector small PRs (R1-START-HERE decision 7, plan 6.4; F-08):
//   * A file that belongs to another sector than the card's own sector (table SECTOR_RULES below, from plan sections 2 and 3)
//     fails with OTHER_SECTOR_PATH, unless the PR body has a line `Cross-sector: S<n> (reason)` naming that sector
//     (several sectors: `Cross-sector: S3, S5`; text in parentheses is ignored; `none` = no sectors).
//   * Every sector named on that line needs the PR label `needs:S<n>`; a missing label fails with MISSING_NEEDS_LABEL.
//   * Labels are read like the PR body: `--labels a,b` or `--labels-file <path>` (one label per line or comma separated, or
//     a JSON array), else env PR_LABELS (same formats). CI sets PR_LABELS to
//     ${{ join(github.event.pull_request.labels.*.name, ',') }} (the workflow also needs the `labeled`/`unlabeled` event types).
//     No label input = no labels, so a Cross-sector PR then fails until the labels are passed.
//   * Cards of sector S9 (Verification, owns no product code) are exempt from the sector-path rule.
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
import {
  MAP_PATH, apiKey, collectConsts, extractApis, extractMenus, extractModels, extractRoutes, isControllerFile, isMenuSource, isRouterSource,
  isSchemaFile, levenshtein, menuKey, normLabel, pathStem, routeKey, stemOf,
} from './r1-canonical-map.mjs'

const DEFAULT_BASE = 'origin/feature/v3-bijak-r1'
const DEFAULT_PLAN = 'docs/plan/r1-development-plan.md'
const NEW_SURFACE_TYPES = new Set(['Fix', 'Complete', 'Keep', 'Verify'])
const NO_PRODUCT_TYPES = new Set(['Keep', 'Verify', 'Ops'])
const CARD_ID = 'S\\d+-T\\d+[a-z]?' // a split card (D113) has ONE lowercase letter after the number
const CARD_RE = new RegExp(`^\\*\\*(${CARD_ID})\\s+([^*]+)\\*\\*(.*)$`)
const CARD_IN_BODY_RE = new RegExp(`\\b${CARD_ID}\\b`)
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

// ---------- sector ownership (plan section 2 "Owned" lines and section 3 migration ranges) ----------
// First matching rule wins, so exceptions come before the general rule. A path that matches no rule belongs to no sector
// (never an error). Shorthand: BE = apps/api/src/modules/, SCH = apps/api/prisma/schema/, SEED = apps/api/prisma/seed/,
// CT = packages/contract/src/.
const BE = 'apps/api/src/modules/', SCH = 'apps/api/prisma/schema/', SEED = 'apps/api/prisma/seed/', CT = 'packages/contract/src/'
const M28 = 'src/modules/m28-bijak-spm/'
const MIGRATION_RANGES = [[111, 119, 0], [120, 139, 1], [140, 159, 4], [160, 179, 3], [180, 189, 5], [190, 199, 10], [200, 219, 6], [220, 239, 7], [240, 244, 2], [250, 259, 0]]
const SECTOR_RULES = [
  // exceptions first
  [/^src\/lib\/lower-form\.ts$/, 5],
  [/^src\/modules\/m01-authentication\/(pages\/(Profile|Tetapan)|routes\/(profile|tetapan)\.ts)/, 5],
  [/^docs\/ops\/dskp-loader\.md$/, 4],
  [new RegExp(`^${M28}components/(PartInput|PartNode|QuestionBlock|RichText|MathField|MathKeyboard|StimulusStack|StimulusView|StimulusChip|NavigatorPanel|AttemptShell)\\.vue$`), 8],
  [new RegExp(`^${M28}components/(SelfMarkControl|ResultGroup|PartResultCard|PastSittingsLink|GenerateShortageAlert|KeywordSuggestion|KuizItem|ReportQuestionButton)\\.vue$`), 3],
  [new RegExp(`^${M28}admin/intake/`), 2],
  [new RegExp(`^${M28}__tests__/(intake|figure-links|semakan)`), 2],
  [new RegExp(`^${M28}(admin/(builder|kontrak|papers|kandungan)/|pages/|lib/|domain/|server/|data/|routes\\.ts$)`), 3],
  [/^src\/modules\/m03-curriculum\/pages\/(TopicsPage|LearningMapPage|TopicDetailPage)\.vue$/, 5],
  [/^src\/modules\/m03-curriculum\/pages\/(Chapter|Topic.*Create|Topic.*Edit|Level|Subject|CurriculumBrowserPage)/, 4],
  [/^src\/modules\/m10-teacher-class\/pages\/(KelasSayaPelajarPage|KelasListPage)\.vue$/, 5],
  [new RegExp(`^${BE}classes/question-sets/`), 1],
  [new RegExp(`^${BE}classes/kelas-saya\\.controller\\.ts$`), 5],
  [new RegExp(`^${BE}reports/performance/`), 10],
  [new RegExp(`^${BE}reports/(analytics|kirkpatrick)/`), 6],
  [/^e2e\/bijak\/(intake-|admin-publish-)/, 2],
  [/^e2e\/m04/, 2],
  [/^e2e\/bijak\//, 3],
  // S0
  [/^(\.github\/|scripts\/|compose[^/]*\.ya?ml$|Dockerfile|docs\/ops\/|docs\/plan\/|e2e\/(global|fixtures|r1)\/|package(-lock)?\.json$)/, 0],
  [/^src\/(app|shells|api|lib)\//, 0],
  [/^src\/modules\/(m01-authentication|m13-|m25-)/, 0],
  [new RegExp(`^${BE}(auth|jobs|ocr|common)/`), 0],
  [new RegExp(`^${SCH}(base|identity|etl|feature-flags)\\.prisma$`), 0],
  [new RegExp(`^${SEED}(index\\.ts|guard\\.ts|e2e[^/]*|core/)`), 0],
  [new RegExp(`^${CT}(common|auth|access|session)(/|\\.ts$)|^${CT}(index|openapi)\\.ts$|^packages/contract/openapi\\.json$`), 0],
  // S1
  [new RegExp(`^${BE}(questions|intake|ai-extraction|files)/`), 1],
  [new RegExp(`^${SCH}(questions|questions-workflow|intake|ai|files)\\.prisma$`), 1],
  [new RegExp(`^${SEED}questions/`), 1],
  [new RegExp(`^${CT}(questions|question-workflow|servability|intake|ai|files)(/|\\.ts$)`), 1],
  [/^apps\/api\/test\/intake-workflow\//, 1],
  // S2
  [/^src\/modules\/m04-question-bank\//, 2],
  // S3
  [/^src\/modules\/m06-spm\/|^packages\/exam-core\//, 3],
  [new RegExp(`^${BE}(spm|bijak|exam)/`), 3],
  [new RegExp(`^${SCH}(exam|spm|bijak-attempts)\\.prisma$`), 3],
  [new RegExp(`^${SEED}(exam[^/]*\\.ts|spm[^/]*\\.ts|bijak-standards/)`), 3],
  [new RegExp(`^${CT}bijak(/|\\.ts$)`), 3],
  // S4
  [new RegExp(`^${BE}curriculum/`), 4],
  [new RegExp(`^${SCH}curriculum\\.prisma$`), 4],
  [new RegExp(`^${SEED}(curriculum\\.ts|curriculum-data/|spm-subject-configs\\.ts)`), 4],
  [new RegExp(`^${CT}curriculum(/|\\.ts$)`), 4],
  [/^apps\/api\/scripts\/uat-ops\/|^docs\/reference\/dskp\//, 4],
  // S5
  [/^src\/modules\/(m05-practice|m09-content)\//, 5],
  [new RegExp(`^${BE}(practice|content|account)/`), 5],
  [new RegExp(`^${SCH}(practice|content)\\.prisma$`), 5],
  [new RegExp(`^${SEED}(practice|content)\\.ts$`), 5],
  [new RegExp(`^${CT}(practice|content|account)(/|\\.ts$)`), 5],
  // S6
  [/^src\/modules\/(m10-teacher-class|m11-teacher-analytics|m12-kirkpatrick|m27-school-admin|m17-admin-dashboard|m02-users-schools|m18-ppd-jpn)\//, 6],
  [new RegExp(`^${BE}(school-admin|command-center|classes|users|schools|parents)/`), 6],
  [new RegExp(`^${SCH}(classes|schools)\\.prisma$`), 6],
  [new RegExp(`^${CT}(classes|school-admin|schools|admin)(/|\\.ts$)|^${CT}reports/kirkpatrick`), 6],
  // S7
  [/^src\/modules\/m(14|15|16|20|21|22)-/, 7],
  [new RegExp(`^${BE}(gamification|games|battle|shop|marketplace|wallet|sponsorship|subscriptions|support|notifications)/`), 7],
  [new RegExp(`^${SCH}(gamification|games|battle|marketplace|wallet|sponsorship)\\.prisma$`), 7],
  [new RegExp(`^${SEED}(games|battle|gamification[^/]*|marketplace|wallet)\\.ts$`), 7],
  [new RegExp(`^${CT}(gamification|games|battle|marketplace|notifications)(/|\\.ts$)`), 7],
  // S8
  [/^src\/(components\/question-display|ds|theme|styles)\//, 8],
  // S10
  [/^src\/modules\/m08-/, 10],
]

export function sectorOf(path) {
  const mig = path.match(/^apps\/api\/prisma\/migrations\/(\d{4})_/)
  if (mig) {
    const n = Number(mig[1])
    const r = MIGRATION_RANGES.find(([a, b]) => n >= a && n <= b)
    return r ? r[2] : null
  }
  for (const [rx, sec] of SECTOR_RULES) if (rx.test(path)) return sec
  return null
}

/** Sectors named on `Cross-sector:` lines of the PR body (text in parentheses is a reason and is ignored; `none` = nothing). */
export function parseCrossSectors(body) {
  const out = new Set()
  for (const m of (body ?? '').matchAll(/^[\s>*-]*`?\s*Cross-sector:[ \t]*(.*)$/gim)) {
    let v = m[1].replace(/`/g, '').trim()
    if (/^none\b/i.test(v)) continue
    while (/\([^()]*\)/.test(v)) v = v.replace(/\([^()]*\)/g, '')
    for (const x of v.matchAll(/\bS(\d+)\b/g)) out.add(Number(x[1]))
  }
  return out
}

/** PR labels from a JSON array, or comma / newline separated text. */
export function parseLabels(text) {
  const t = (text ?? '').trim()
  if (!t) return []
  if (t.startsWith('[')) { try { return JSON.parse(t).map((x) => String(x.name ?? x).trim()).filter(Boolean) } catch { /* fall through */ } }
  return t.split(/[,\n]/).map((x) => x.trim()).filter(Boolean)
}

// ---------- analysis ----------
export function analyze({ cwd, base, head, body, planText, labels = [] }) {
  const fails = []
  const warns = []
  const out = { card: null, type: null, fails, warns }

  // Docs-only PR (every changed file under docs/): no card needed, nothing else is checked. An empty diff is not docs-only.
  const changed = git(cwd, ['diff', '--name-only', '--no-renames', `${base}...${head}`]).split('\n').filter(Boolean).map(norm)
  if (changed.length && changed.every((f) => f.startsWith('docs/'))) {
    out.docsOnly = true
    return out
  }

  const idMatch = (body ?? '').match(CARD_IN_BODY_RE)
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

  // Rule: cross-sector PR (F-08): other sectors' files need `Cross-sector: S<n>` and the label needs:S<n>
  const ownSector = Number(cardId.match(/^S(\d+)-/)[1])
  const declared = parseCrossSectors(body)
  for (const n of [...declared].sort((a, b) => a - b)) {
    if (!labels.includes(`needs:S${n}`)) fails.push({ rule: 'MISSING_NEEDS_LABEL', file: `Cross-sector: S${n}`, msg_bm: `PR menyatakan "Cross-sector: S${n}" tetapi tiada label needs:S${n}.`, msg_en: `The PR says "Cross-sector: S${n}" but does not carry the label needs:S${n}.` })
  }
  if (ownSector !== 9) {
    const seen = new Set()
    for (const e of entries) {
      for (const p of new Set([e.path, ...(e.st === 'R' || e.st === 'C' ? [e.oldPath] : [])])) {
        const sec = sectorOf(p)
        if (sec === null || sec === ownSector || declared.has(sec) || seen.has(`${p}`)) continue
        seen.add(p)
        fails.push({ rule: 'OTHER_SECTOR_PATH', file: `${p} (S${sec})`, msg_bm: `Fail milik sektor S${sec}, kad ${cardId} ialah S${ownSector}. Guna PR kecil dengan baris "Cross-sector: S${sec} (sebab)" dan label needs:S${sec}.`, msg_en: `This file belongs to sector S${sec}; card ${cardId} is S${ownSector}. Make it a small PR with the line "Cross-sector: S${sec} (reason)" and the label needs:S${sec}.` })
      }
    }
  }

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

  // Rules: no duplicates (canonical map, docs/plan/r1-canonical-map.json)
  try { checkNoDuplicates({ cwd, head, mergeBase, range, entries, body, hasId, cardId, cards, fails, warns }) }
  catch (e) { warns.push({ rule: 'DUP_CHECK_ERROR', file: null, msg_bm: `Semakan salinan gagal dijalankan: ${e.message}`, msg_en: `The duplicate check could not run: ${e.message}` }) }
  return out
}

// ---------- no-duplicates rules ----------
const gitShowOrNull = (cwd, ref, path) => {
  try { return git(cwd, ['show', `${ref}:${path}`], { stdio: ['ignore', 'pipe', 'ignore'] }) } catch { return null }
}
const rolesMeet = (a, b) => a.includes('*') || b.includes('*') || a.some((r) => b.includes(r))
const segPrefix = (path, prefix) => path === prefix || path.startsWith(prefix + '/')

/** Similarity of two model names: same stem, or a small edit distance (3-5 letters: 1, 6+ letters: 2). */
export function similarModels(a, b) {
  if (a === b) return false
  if (stemOf(a) === stemOf(b)) return true
  const x = a.toLowerCase(), y = b.toLowerCase()
  const lim = Math.min(2, Math.floor(Math.min(x.length, y.length) / 3))
  return lim > 0 && levenshtein(x, y) <= lim
}

function checkNoDuplicates({ cwd, head, mergeBase, range, entries, body, hasId, cardId, cards, fails, warns }) {
  const baseText = gitShowOrNull(cwd, mergeBase, MAP_PATH)
  if (!baseText) return // no map in the base yet: nothing to compare with
  const baseMap = JSON.parse(baseText)
  const headText = gitShowOrNull(cwd, head, MAP_PATH)
  const headMap = headText ? JSON.parse(headText) : null
  const mapChanged = entries.some((e) => e.path === MAP_PATH)
  const removed = new Set(entries.filter((e) => e.st === 'D' || e.st === 'R').map((e) => e.oldPath))
  const live = (arr) => (arr ?? []).filter((x) => !removed.has(x.file))
  const changed = entries.filter((e) => e.st !== 'D')

  // approval: ID in the PR body + the map entry carries approved_by_card = this PR's card
  const approved = (list, match) => {
    if (!hasId) return { ok: false, why_bm: 'badan PR tidak menyebut ID DM-/API-', why_en: 'the PR body names no DM-/API- ID' }
    if (!mapChanged || !headMap) return { ok: false, why_bm: `${MAP_PATH} tidak dikemas kini dalam PR ini`, why_en: `${MAP_PATH} was not updated in this PR` }
    const ent = (headMap[list] ?? []).find(match)
    if (!ent) return { ok: false, why_bm: 'item belum ada dalam peta (jalankan node scripts/r1-canonical-map.mjs --write)', why_en: 'the item is not in the map yet (run node scripts/r1-canonical-map.mjs --write)' }
    if (ent.approved_by_card !== cardId || !cards.has(cardId)) return { ok: false, why_bm: `peta mesti ada "approved_by_card": "${cardId}" pada item ini`, why_en: `the map entry needs "approved_by_card": "${cardId}"` }
    return { ok: true }
  }
  const fail = (rule, file, bm, en, ap) => {
    if (ap.ok) return
    fails.push({ rule, file, msg_bm: `${bm} Kelulusan: ${ap.why_bm}. Jangan bina salinan ketiga; guna yang sedia ada dalam peta.`, msg_en: `${en} Approval missing: ${ap.why_en}. Do not build another copy; use the existing one in the map.` })
  }

  // path constants for route templates
  const consts = new Map()
  try {
    const g = git(cwd, ['grep', '-h', '-E', "const +[A-Za-z_]+ *(:[^=]+)?= *['\"]/", head, '--', 'src'], { stdio: ['ignore', 'pipe', 'ignore'] })
    collectConsts('\n' + g, consts)
  } catch { /* none */ }

  const fresh = (items, keyOf, baseKeys, baseItemsOfFile) => items.filter((it) => !baseKeys.has(keyOf(it)) && !baseItemsOfFile.has(keyOf(it)))
  const keysOf = (arr, f) => new Set((arr ?? []).map(f))
  const oldKeys = (e, extract, keyOf) => {
    if (e.st === 'A') return new Set()
    const t = gitShowOrNull(cwd, mergeBase, e.oldPath)
    return t ? new Set(extract(e.oldPath, t).map(keyOf)) : new Set()
  }

  // --- routes ---
  const baseRoutes = live(baseMap.routes)
  const baseRouteKeys = keysOf(baseMap.routes, (r) => r.key.replace(/ #\d+$/, ''))
  for (const e of changed.filter((x) => isRouterSource(x.path))) {
    const text = gitShowOrNull(cwd, head, e.path)
    if (text == null) continue
    const items = extractRoutes(e.path, text, consts)
    const already = oldKeys(e, (p, t) => extractRoutes(p, t, consts), routeKey)
    for (const r of items) {
      const k = routeKey(r)
      if (already.has(k)) continue
      let why = null
      const same = baseRoutes.find((x) => x.key.replace(/ #\d+$/, '') === k && x.file !== r.file)
      if (baseRouteKeys.has(k) && !same) continue // an existing route in an unchanged place
      if (same) why = [`sama dengan laluan sedia ada ${same.path} (${same.file})`, `same path and name as the existing route ${same.path} (${same.file})`]
      for (const x of baseRoutes) {
        if (why) break
        if (x.key.replace(/ #\d+$/, '') === k) continue
        if (x.path !== r.path && pathStem(x.path) === pathStem(r.path) && pathStem(r.path) !== '') why = [`laluan ${r.path} hanya berbeza imbuhan/jamak daripada ${x.path}`, `path ${r.path} differs only by suffix/prefix/plural from the existing ${x.path}`]
        else if (r.name && x.name && r.name !== x.name && r.name.split('.').map(stemOf).join('.') === x.name.split('.').map(stemOf).join('.')) why = [`nama laluan ${r.name} hanya berbeza imbuhan/jamak daripada ${x.name}`, `route name ${r.name} differs only by suffix/prefix/plural from the existing ${x.name}`]
        else if (r.component && !r.component.startsWith('identifier:') && x.component === r.component && x.path !== r.path) why = [`komponen ${r.component} sudah digunakan oleh laluan ${x.path}`, `component ${r.component} is already used by the route ${x.path}`]
      }
      if (why) fail('DUP_ROUTE', `${e.path} (${r.path})`, `Laluan FE baharu menyerupai yang sedia ada: ${why[0]}.`, `New FE route resembles an existing one: ${why[1]}.`, approved('routes', (x) => x.key === r.key || x.key.replace(/ #\d+$/, '') === k))
    }
  }

  // --- menus ---
  const baseMenus = live(baseMap.menus)
  const baseMenuKeys = keysOf(baseMap.menus, (m) => m.key)
  for (const e of changed.filter((x) => isMenuSource(x.path))) {
    const text = gitShowOrNull(cwd, head, e.path)
    if (text == null) continue
    const already = oldKeys(e, extractMenus, menuKey)
    for (const m of extractMenus(e.path, text)) {
      const k = menuKey(m)
      if (already.has(k) || baseMenuKeys.has(k)) continue
      const x = baseMenus.find((b) => b.key !== k && normLabel(b.label) === normLabel(m.label) && rolesMeet(b.roles ?? ['*'], m.roles))
      if (x) fail('DUP_MENU', `${e.path} (${m.label})`, `Entri menu baharu "${m.label}" sama label dengan entri sedia ada ${x.key} untuk peranan yang sama.`, `New menu entry "${m.label}" has the same label as the existing ${x.key} for the same role.`, approved('menus', (b) => b.key === k))
    }
  }

  // --- models ---
  const baseModels = live(baseMap.models)
  const baseModelNames = keysOf(baseMap.models, (m) => m.name)
  for (const e of changed.filter((x) => isSchemaFile(x.path))) {
    const text = gitShowOrNull(cwd, head, e.path)
    if (text == null) continue
    const already = oldKeys(e, extractModels, (m) => m.name)
    for (const m of extractModels(e.path, text)) {
      if (already.has(m.name) || baseModelNames.has(m.name)) continue
      const sim = baseModels.find((b) => similarModels(m.name, b.name))
      if (sim) fail('DUP_MODEL', `${e.path} (model ${m.name})`, `Model Prisma baharu ${m.name} menyerupai model sedia ada ${sim.name}.`, `New Prisma model ${m.name} resembles the existing model ${sim.name}.`, approved('models', (b) => b.name === m.name))
      const lower = m.name.toLowerCase()
      const concept = (baseMap.concepts ?? []).find((c) => (c.keywords ?? []).some((kw) => lower.includes(kw)))
      if (concept) fail('CONCEPT_MODEL', `${e.path} (model ${m.name})`, `Model baharu ${m.name} untuk konsep "${concept.concept}" yang sudah ada model kanonik (${(concept.models ?? []).join(', ')}).`, `New model ${m.name} for the concept "${concept.concept}", which already has canonical model(s) ${(concept.models ?? []).join(', ')}.`, approved('models', (b) => b.name === m.name))
    }
  }

  // --- apis ---
  const baseApis = live(baseMap.apis)
  const baseApiKeys = keysOf(baseMap.apis, (a) => a.key.replace(/ #\d+$/, ''))
  for (const e of changed.filter((x) => isControllerFile(x.path) && !/\.(spec|test)\.ts$/.test(x.path))) {
    const text = gitShowOrNull(cwd, head, e.path)
    if (text == null) continue
    const already = oldKeys(e, extractApis, apiKey)
    for (const a of extractApis(e.path, text)) {
      const k = apiKey(a)
      if (already.has(k)) continue
      const same = baseApis.find((b) => b.key.replace(/ #\d+$/, '') === k && b.file !== a.file)
      const isNew = !baseApiKeys.has(k)
      if (!same && !isNew) continue
      const ap = approved('apis', (b) => b.key.replace(/ #\d+$/, '') === k && b.file === a.file)
      if (same) fail('DUP_API', `${e.path} (${a.method} ${a.path})`, `Endpoint ${a.method} ${a.path} menduplikasi corak method+laluan sedia ada dalam ${same.file}.`, `Endpoint ${a.method} ${a.path} duplicates the method+path pattern that already exists in ${same.file}.`, ap)
      const concept = isNew && (baseMap.concepts ?? []).find((c) => (c.api_prefixes ?? []).some((p) => segPrefix(a.path, p)))
      if (concept) fail('CONCEPT_API', `${e.path} (${a.method} ${a.path})`, `Endpoint baharu untuk konsep "${concept.concept}" yang API kanoniknya sudah ada (${concept.api}).`, `New endpoint for the concept "${concept.concept}", whose canonical API already exists (${concept.api}).`, ap)
    }
  }

  // --- new references to retired things ---
  const retiredModels = (baseMap.models ?? []).filter((m) => m.status === 'legacy-retire')
  const staticRetiredPaths = (baseMap.routes ?? []).filter((r) => r.status === 'retire' && !r.path.includes(':') && !r.path.includes('${') && !(baseMap.routes ?? []).some((o) => o.path === r.path && o.status !== 'retire')).map((r) => ({ kind: 'routes', label: r.path, key: r.key, rx: new RegExp('[\'"`]' + r.path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?:[\'"`?#])', 'g') }))
  const retiredApis = (baseMap.apis ?? []).filter((a) => a.status === 'retire' && !a.path.includes(':')).map((a) => ({ kind: 'apis', label: `${a.method} ${a.path}`, key: a.key, rx: new RegExp('[\'"`]' + a.path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?:[\'"`?#/])', 'g') }))
  const pats = [
    ...retiredModels.map((m) => {
      const camel = m.name[0].toLowerCase() + m.name.slice(1)
      const alts = [m.name, camel, ...(m.table ? [m.table] : [])].map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
      return { kind: 'models', label: m.name, key: m.name, rx: new RegExp(`\\b(?:${alts.join('|')})\\b`, 'g') }
    }),
    ...staticRetiredPaths, ...retiredApis,
  ]
  const isRedir = (o) => /^redirect-to:/.test(o.status ?? '')
  const redirPats = (baseMap.routes ?? []).filter((r) => isRedir(r) && !r.path.includes(':') && !r.path.includes('${') && !(baseMap.routes ?? []).some((o) => o.path === r.path && !isRedir(o)))
    .map((r) => ({ label: r.path, target: r.status.slice(12), rx: new RegExp('[\'"`]' + r.path.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '(?:[\'"`?#])', 'g') }))
  if (pats.length || redirPats.length) {
    const diff = git(cwd, ['diff', '-U0', '--find-renames', range])
    const files = diff.split(/^diff --git /m).slice(1)
    for (const chunk of files) {
      const f = (chunk.match(/^\+\+\+ b\/(.+)$/m) ?? chunk.match(/^--- a\/(.+)$/m) ?? [])[1]
      if (!f || /^docs\//.test(f) || f === MAP_PATH || /\.md$/.test(f) || /(^|\/)__tests__\//.test(f) || /\.(spec|test)\.ts$/.test(f) || /^apps\/api\/prisma\/(migrations|schema)\//.test(f) || /^scripts\//.test(f) || /^\.github\//.test(f)) continue
      const added = chunk.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).join('\n')
      const gone = chunk.split('\n').filter((l) => l.startsWith('-') && !l.startsWith('---')).join('\n')
      for (const p of redirPats) {
        const n = (added.match(p.rx) ?? []).length, o = (gone.match(p.rx) ?? []).length
        if (n > o) warns.push({ rule: 'REDIRECT_REF', file: `${f} (${p.label})`, msg_bm: `Pautan baharu ke laluan yang dialihkan ${p.label}: guna laluan kanonik ${p.target}.`, msg_en: `New link to the redirected route ${p.label}: use the canonical route ${p.target}.` })
      }
      for (const p of pats) {
        const n = (added.match(p.rx) ?? []).length, o = (gone.match(p.rx) ?? []).length
        if (n > o) fail('RETIRED_REF', `${f} (${p.label})`, `Rujukan baharu kepada ${p.kind === 'models' ? 'model' : p.kind === 'routes' ? 'laluan' : 'endpoint'} yang telah disara (retire): ${p.label}. Jangan guna semula.`, `New reference to a retired ${p.kind === 'models' ? 'model' : p.kind === 'routes' ? 'route' : 'endpoint'}: ${p.label}. Do not use it again.`, approved(p.kind, (b) => (p.kind === 'models' ? b.name === p.key : b.key === p.key)))
      }
    }
  }
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

**S9-T07 Build card (map rules)** · P0 · S · Type: Build · deps: none
- Starts from (existing): \`src/\`, \`apps/api/\`, \`docs/\`.

**S1-T09a Split card A** · P1 · M · Type: Fix · deps: none
- Starts from (existing): \`apps/api/src/mod/\`.

**S1-T09b Split card B** · P1 · M · Type: Fix · deps: S1-T09a
- Starts from (existing): \`apps/api/src/mod/\`.

**S1-T01 Sector one card** · P0 · S · Type: Fix · deps: none
- Starts from (existing): \`apps/api/\`, \`scripts/\`.
`

const FIXTURE_MAP = {
  routes: [
    { key: '/admin/foo|m.foo', path: '/admin/foo', name: 'm.foo', component: 'src/mod/pages/Foo.vue', file: 'src/mod/routes/foo.ts', status: 'canonical' },
    { key: '/old-page|m.old', path: '/old-page', name: 'm.old', component: 'src/mod/pages/Old.vue', file: 'src/mod/routes/foo.ts', status: 'retire' },
    { key: '/moved|', path: '/moved', name: null, file: 'src/mod/routes/foo.ts', status: 'redirect-to:/admin/foo' },
  ],
  menus: [{ key: 'user-nav|dash-guru', source: 'user-nav', id: 'dash-guru', label: 'Dashboard Guru', route: '/guru', roles: ['teacher'], file: 'src/shells/nav/user-nav.ts', status: 'canonical' }],
  models: [
    { name: 'Existing', file: 'apps/api/prisma/schema/core.prisma', status: 'canonical' },
    { name: 'LegacyThing', file: 'apps/api/prisma/schema/legacy.prisma', status: 'legacy-retire' },
  ],
  apis: [{ key: 'GET /api/items/:p', method: 'GET', path: '/api/items/:id', file: 'apps/api/src/mod/items.controller.ts', status: 'canonical' }],
  concepts: [{ concept: 'question', models: ['Question'], keywords: ['question'], api_prefixes: ['/api/questions'], api: 'API-Q' }],
}

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
    write(cwd, 'src/mod/routes/foo.ts', "export default [\n  { path: '/admin/foo', name: 'm.foo', component: () => import('../pages/Foo.vue') },\n  { path: '/old-page', name: 'm.old', component: () => import('../pages/Old.vue') },\n]\n")
    write(cwd, 'src/shells/nav/user-nav.ts', "const T = ['teacher'] as const\nconst S = ['student'] as const\nexport const USER_NAV = [\n  { kind: 'item', id: 'dash-guru', label: 'Dashboard Guru', to: '/guru', fa: 'x', color: '', roles: T },\n]\n")
    write(cwd, 'apps/api/src/mod/items.controller.ts', "@Controller('items')\nexport class I {\n  @Get(':id') one() {}\n}\n")
    write(cwd, 'apps/api/prisma/schema/legacy.prisma', 'model LegacyThing {\n  id Int @id\n}\n')
    write(cwd, 'src/mod/use.ts', 'export const a = prisma.legacyThing.count()\n')
    write(cwd, MAP_PATH, JSON.stringify(FIXTURE_MAP, null, 2))
    sh(cwd, 'add', '-A'); sh(cwd, 'commit', '-q', '-m', 'base')
    sh(cwd, 'checkout', '-q', '-b', 'work')
    mutate(cwd)
    sh(cwd, 'add', '-A'); sh(cwd, 'commit', '-q', '--allow-empty', '-m', 'work')
    return cwd
  }

  function run(name, body, mutate, expect, labels = []) {
    let ok = false, detail = ''
    try {
      const cwd = makeRepo(name, mutate)
      const res = analyze({ cwd, base: 'main', head: 'work', body, labels, planText: FIXTURE_PLAN })
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

  // ---- split-card IDs (letter suffix, D113) ----
  run('split card S1-T09a is found in the plan', 'S1-T09a', (c) => write(c, 'apps/api/src/mod/x.service.ts', lines(5) + 'more\n'), { exact: true })
  run('split card S1-T09b is found in the plan', 'S1-T09b DM-12', (c) => write(c, 'apps/api/src/mod/x.service.ts', lines(5) + 'more\n'), { exact: true })
  run('unsplit ID S1-T09 is not a plan card now', 'S1-T09', touchA, { fail: ['UNKNOWN_CARD'], exact: true })
  run('letter suffix is read from the body (S1-T09a, not S1-T09)', 'Closes S1-T09a.', (c) => write(c, 'apps/api/src/mod/x.service.ts', lines(5) + 'more\n'), { exact: true })
  run('uppercase suffix is not a card letter -> no card', 'S1-T09A', touchA, { fail: ['NO_CARD'], exact: true })

  // ---- cross-sector PRs (F-08) ----
  const s0file = (c) => write(c, 'scripts/lint.mjs', lines(20) + 'x\n')
  const s3file = (c) => write(c, 'apps/api/src/modules/exam/a.ts', 'export {}\n')
  const mig = (c, n) => write(c, `apps/api/prisma/migrations/${n}_x/migration.sql`, 'select 1;\n')
  run('sector: own-sector file only -> ok', 'S1-T01', (c) => write(c, 'apps/api/src/modules/questions/a.ts', 'export {}\n'), { exact: true })
  run('sector: other sector file without Cross-sector -> fail', 'S1-T01', (c) => { write(c, 'apps/api/src/modules/questions/a.ts', 'export {}\n'); s0file(c) }, { fail: ['OTHER_SECTOR_PATH'], exact: true })
  run('sector: Cross-sector line + label -> ok', 'S1-T01\nCross-sector: S0 (one-line script)', s0file, { exact: true }, ['needs:S0'])
  run('sector: Cross-sector line, label missing -> fail', 'S1-T01\nCross-sector: S0 (one-line script)', s0file, { fail: ['MISSING_NEEDS_LABEL'], exact: true }, ['sector:S1'])
  run('sector: Cross-sector names S0 but file is S3 -> fail', 'S1-T01\nCross-sector: S0', s3file, { fail: ['OTHER_SECTOR_PATH'], exact: true }, ['needs:S0'])
  run('sector: two sectors, both labels -> ok', 'S1-T01\nCross-sector: S3, S0', (c) => { s0file(c); s3file(c) }, { exact: true }, ['needs:S3', 'needs:S0'])
  run('sector: two sectors, one label missing -> fail', 'S1-T01\nCross-sector: S3, S0', (c) => { s0file(c); s3file(c) }, { fail: ['MISSING_NEEDS_LABEL'], exact: true }, ['needs:S3'])
  run('sector: reason text in parentheses is not a sector', 'S1-T01\nCross-sector: S0 (S3 asked for it)', s0file, { exact: true }, ['needs:S0'])
  run('sector: Cross-sector none -> own files only', 'S1-T01\nCross-sector: none', (c) => write(c, 'apps/api/src/modules/questions/a.ts', 'export {}\n'), { exact: true })
  run('sector: migration in own range -> ok', 'S1-T01 DM-12', (c) => mig(c, '0125'), { exact: true })
  run('sector: migration in another range -> fail', 'S1-T01 DM-12', (c) => mig(c, '0165'), { fail: ['OTHER_SECTOR_PATH'], exact: true })
  run('sector: migration in another range, Cross-sector S3 + label -> ok', 'S1-T01 DM-12\nCross-sector: S3 (needs:schema)', (c) => mig(c, '0165'), { exact: true }, ['needs:S3'])
  run('sector: S9 card is exempt from the path rule', 'S9-T06', (c) => { s0file(c); s3file(c) }, { warn: ['BUILD_OUTSIDE_DIRS'], exact: true })
  run('sector: split card checks its own sector (S1-T09a touches S3)', 'S1-T09a', s3file, { fail: ['OTHER_SECTOR_PATH'], warn: ['NO_STARTS_FROM_TOUCHED'], exact: true })

  // ---- no-duplicates rules (canonical map) ----
  const readMap = (c) => JSON.parse(readFileSync(join(c, MAP_PATH), 'utf8'))
  const editMap = (c, f) => { const m = readMap(c); f(m); write(c, MAP_PATH, JSON.stringify(m, null, 2)) }
  const routeFile = (path, name, comp) => `export default [\n  { path: '${path}', name: '${name}', component: () => import('../pages/${comp}.vue') },\n]\n`
  const ctrl = (prefix, verb, arg) => `@Controller('${prefix}')\nexport class C {\n  @${verb}(${arg}) h() {}\n}\n`
  const N = 'S9-T07'
  const asRoute = (path, name, comp, file) => ({ key: `${path}|${name}`, path, name, component: `src/mod/pages/${comp}.vue`, file, status: 'canonical', approved_by_card: N })

  run('dup route: suffix 2', N, (c) => write(c, 'src/mod/routes/foo2.ts', routeFile('/admin/foo2', 'm.foo2', 'Foo2')), { fail: ['DUP_ROUTE'], exact: true })
  run('dup route: plural', N, (c) => write(c, 'src/mod/routes/foos.ts', routeFile('/admin/foos', 'm.foos', 'Foos')), { fail: ['DUP_ROUTE'], exact: true })
  run('dup route: prefix new-', N, (c) => write(c, 'src/mod/routes/nf.ts', routeFile('/admin/new-foo', 'm.nf', 'Nf')), { fail: ['DUP_ROUTE'], exact: true })
  run('dup route: same component', N, (c) => write(c, 'src/mod/routes/other.ts', routeFile('/admin/other', 'm.other', 'Foo')), { fail: ['DUP_ROUTE'], exact: true })
  run('dup route: unrelated route -> ok', N, (c) => write(c, 'src/mod/routes/bar.ts', routeFile('/admin/bar', 'm.bar', 'Bar')), { exact: true })
  run('dup route: approved (DM id + map approved_by_card) -> ok', `${N} DM-60`, (c) => { write(c, 'src/mod/routes/foo2.ts', routeFile('/admin/foo2', 'm.foo2', 'Foo2')); editMap(c, (m) => m.routes.push(asRoute('/admin/foo2', 'm.foo2', 'Foo2', 'src/mod/routes/foo2.ts'))) }, { exact: true })
  run('dup route: ID but map not updated -> fail', `${N} DM-60`, (c) => write(c, 'src/mod/routes/foo2.ts', routeFile('/admin/foo2', 'm.foo2', 'Foo2')), { fail: ['DUP_ROUTE'], exact: true })
  run('dup route: map approved but no ID in body -> fail', N, (c) => { write(c, 'src/mod/routes/foo2.ts', routeFile('/admin/foo2', 'm.foo2', 'Foo2')); editMap(c, (m) => m.routes.push(asRoute('/admin/foo2', 'm.foo2', 'Foo2', 'src/mod/routes/foo2.ts'))) }, { fail: ['DUP_ROUTE'], exact: true })
  run('dup route: approved_by_card names another card -> fail', `${N} DM-60`, (c) => { write(c, 'src/mod/routes/foo2.ts', routeFile('/admin/foo2', 'm.foo2', 'Foo2')); editMap(c, (m) => m.routes.push({ ...asRoute('/admin/foo2', 'm.foo2', 'Foo2', 'src/mod/routes/foo2.ts'), approved_by_card: 'S9-T01' })) }, { fail: ['DUP_ROUTE'], exact: true })

  const navFile = (extra) => `const T = ['teacher'] as const\nconst S = ['student'] as const\nexport const USER_NAV = [\n  { kind: 'item', id: 'dash-guru', label: 'Dashboard Guru', to: '/guru', fa: 'x', color: '', roles: T },\n${extra}]\n`
  run('dup menu: same label, case and spacing, same role', N, (c) => write(c, 'src/shells/nav/user-nav.ts', navFile("  { kind: 'item', id: 'dash-2', label: 'dashboard   GURU', to: '/guru/x', fa: 'x', color: '', roles: T },\n")), { fail: ['DUP_MENU'], exact: true })
  run('dup menu: same label for another role -> ok', N, (c) => write(c, 'src/shells/nav/user-nav.ts', navFile("  { kind: 'item', id: 'dash-s', label: 'Dashboard Guru', to: '/guru/x', fa: 'x', color: '', roles: S },\n")), { exact: true })
  run('dup menu: different label -> ok', N, (c) => write(c, 'src/shells/nav/user-nav.ts', navFile("  { kind: 'item', id: 'new', label: 'Lain', to: '/lain', fa: 'x', color: '', roles: T },\n")), { exact: true })
  run('dup menu: approved -> ok', `${N} API-GUR-01`, (c) => { write(c, 'src/shells/nav/user-nav.ts', navFile("  { kind: 'item', id: 'dash-2', label: 'Dashboard Guru', to: '/guru/x', fa: 'x', color: '', roles: T },\n")); editMap(c, (m) => m.menus.push({ key: 'user-nav|dash-2', label: 'Dashboard Guru', roles: ['teacher'], route: '/guru/x', status: 'canonical', approved_by_card: N })) }, { exact: true })

  const model = (name) => `model Existing {\n  id Int @id\n}\n\nmodel ${name} {\n  id Int @id\n}\n`
  run('dup model: same stem (Existing2)', N, (c) => write(c, 'apps/api/prisma/schema/core.prisma', model('Existing2')), { fail: ['DUP_MODEL'], exact: true })
  run('dup model: plural (Existings)', N, (c) => write(c, 'apps/api/prisma/schema/core.prisma', model('Existings')), { fail: ['DUP_MODEL'], exact: true })
  run('dup model: edit distance <= 2 (Exixtinq)', N, (c) => write(c, 'apps/api/prisma/schema/core.prisma', model('Exixtinq')), { fail: ['DUP_MODEL'], exact: true })
  run('concept model: QuestionDraft', N, (c) => write(c, 'apps/api/prisma/schema/core.prisma', model('QuestionDraft')), { fail: ['CONCEPT_MODEL'], exact: true })
  run('model: unrelated name -> ok', N, (c) => write(c, 'apps/api/prisma/schema/core.prisma', model('Brand')), { exact: true })
  run('concept model: approved -> ok', `${N} DM-61`, (c) => { write(c, 'apps/api/prisma/schema/core.prisma', model('QuestionDraft')); editMap(c, (m) => m.models.push({ name: 'QuestionDraft', file: 'apps/api/prisma/schema/core.prisma', status: 'canonical', approved_by_card: N })) }, { exact: true })

  run('dup api: same method+path pattern, other controller', N, (c) => write(c, 'apps/api/src/mod/other.controller.ts', ctrl('items', 'Get', "':itemId'")), { fail: ['DUP_API'], exact: true })
  run('concept api: new endpoint under /api/questions', N, (c) => write(c, 'apps/api/src/mod/q2.controller.ts', ctrl('questions', 'Get', "'extra'")), { fail: ['CONCEPT_API'], exact: true })
  run('api: unrelated endpoint -> ok', N, (c) => write(c, 'apps/api/src/mod/w.controller.ts', ctrl('widgets', 'Get', '')), { exact: true })
  run('concept api: approved -> ok', `${N} API-Q-99`, (c) => { write(c, 'apps/api/src/mod/q2.controller.ts', ctrl('questions', 'Get', "'extra'")); editMap(c, (m) => m.apis.push({ key: 'GET /api/questions/extra', method: 'GET', path: '/api/questions/extra', file: 'apps/api/src/mod/q2.controller.ts', status: 'canonical', approved_by_card: N })) }, { exact: true })
  run('concept api: ID in body but map not updated -> fail', `${N} API-Q-99`, (c) => write(c, 'apps/api/src/mod/q2.controller.ts', ctrl('questions', 'Get', "'extra'")), { fail: ['CONCEPT_API'], exact: true })

  run('retired model: new reference', N, (c) => write(c, 'src/mod/use.ts', 'export const a = prisma.legacyThing.count()\nexport const b = prisma.legacyThing.findMany()\n'), { fail: ['RETIRED_REF'], exact: true })
  run('retired route: new literal', N, (c) => write(c, 'src/mod/link.ts', "export const to = '/old-page'\n"), { fail: ['RETIRED_REF'], exact: true })
  run('retired: existing reference kept (line edited) -> ok', N, (c) => write(c, 'src/mod/use.ts', 'export const a = prisma.legacyThing.count({ where: { id: 1 } })\n'), { exact: true })
  run('retired: reference removed -> ok', N, (c) => write(c, 'src/mod/use.ts', 'export const a = 1\n'), { exact: true })
  run('retired: only docs mention it -> ok', N, (c) => write(c, 'docs/notes.md', 'LegacyThing and /old-page are retired\n'), { exact: true })
  run('retired: similar longer route is another route -> ok', N, (c) => write(c, 'src/mod/link.ts', "export const to = '/old-page-two'\n"), { exact: true })
  run('retired: approved -> ok', `${N} DM-62`, (c) => { write(c, 'src/mod/link.ts', "export const to = '/old-page'\n"); editMap(c, (m) => { m.routes.find((r) => r.path === '/old-page').approved_by_card = N }) }, { exact: true })
  run('redirect route: new link -> warn (use canonical)', N, (c) => write(c, 'src/mod/link.ts', "export const to = '/moved'\n"), { warn: ['REDIRECT_REF'], exact: true })
  run('redirect route: link to canonical -> ok', N, (c) => write(c, 'src/mod/link.ts', "export const to = '/admin/foo'\n"), { exact: true })

  // pure helpers
  const eq = (name, got, want) => results.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), detail: `got ${JSON.stringify(got)} want ${JSON.stringify(want)}` })
  eq('parseCrossSectors: list', [...parseCrossSectors('x\nCross-sector: S3, S5 (why S7)\n')], [3, 5])
  eq('parseCrossSectors: template placeholder = none', [...parseCrossSectors('Cross-sector: none | `Cross-sector: S<n> (reason)`')], [])
  const docsOnly = (c) => write(c, 'docs/plan/x.md', 'x\n')
  run('docs-only PR without a card passes', 'no card here', docsOnly, { exact: true })
  run('docs plus a src file without a card still fails NO_CARD', 'no card here', (c) => { docsOnly(c); touchA(c) }, { fail: ['NO_CARD'], exact: true })
  eq('parseLabels: comma, newline and JSON', [parseLabels('a, needs:S3'), parseLabels('a\nb'), parseLabels('[{"name":"x"},"y"]')], [['a', 'needs:S3'], ['a', 'b'], ['x', 'y']])
  eq('sectorOf: examples', [sectorOf('src/modules/m05-practice/a.ts'), sectorOf('src/modules/m28-bijak-spm/components/RichText.vue'), sectorOf('src/modules/m28-bijak-spm/pages/X.vue'), sectorOf('README.md'), sectorOf('apps/api/prisma/migrations/0181_s5_x/migration.sql')], [5, 8, 3, null, 5])

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
  const labelsArg = arg('--labels', null), labelsFile = arg('--labels-file', null)
  const labels = parseLabels(labelsArg ?? (labelsFile ? readFileSync(labelsFile, 'utf8') : process.env.PR_LABELS ?? ''))
  const planPath = resolve(process.cwd(), arg('--plan', DEFAULT_PLAN))
  if (!existsSync(planPath)) { console.error(`Pelan tidak dijumpai / plan not found: ${planPath}`); process.exit(2) }
  let res
  try { res = analyze({ cwd: process.cwd(), base, head, body, labels, planText: readFileSync(planPath, 'utf8') }) }
  catch (e) { console.error(`Ralat git / git error (base=${base} head=${head}): ${e.stderr || e.message}`); process.exit(2) }
  console.log(res.docsOnly ? 'docs-only PR: no card' : report(res))
  process.exit(res.fails.length ? 1 : 0)
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
