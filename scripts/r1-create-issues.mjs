#!/usr/bin/env node
// Creates the R1 labels, sprint milestones and ONE GitHub issue per plan card (docs/plan/r1-development-plan.md).
// Default is a dry run (prints what would be created). Needs the `gh` CLI, logged in, only with --apply.
//
// Usage:
//   node scripts/r1-create-issues.mjs                      dry run: summary + 2 sample bodies
//   node scripts/r1-create-issues.mjs --card S1-T02        dry run for one card, full body
//   node scripts/r1-create-issues.mjs --apply              create labels, milestones, issues (idempotent)
//   node scripts/r1-create-issues.mjs --apply --only S1    only cards of one sector (S1) or one card (S1-T02)
// Options: --plan <path>  --repo <owner/name>  --base-branch <branch>  --sleep <ms> (default 1500)
//
// Idempotent: a card is skipped when an issue (open or closed) whose title starts with "<card id> " exists.
// Plan format relied on (same as r1-scope-guard.mjs): card line `**S<n>-T<nn> <title>** · P? · size · Type: … · deps: …`,
// a card ends at the next card line or the next markdown heading. Sprint tables: the "- *Cards:*" line under each
// "**Sprint N" heading (bare `T05` continues the previous sector); "Sprint 7+" line uses full ids after "Sprint N".
import { execFileSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const argv = process.argv.slice(2)
const flag = (n) => argv.includes(n)
const arg = (n, d) => { const i = argv.indexOf(n); return i >= 0 && argv[i + 1] ? argv[i + 1] : d }
const APPLY = flag('--apply')
const REPO = arg('--repo', 'amin-kerja-orang/prestasiplus')
const BASE_BRANCH = arg('--base-branch', 'feature/v3-bijak-r1')
const PLAN = resolve(process.cwd(), arg('--plan', 'docs/plan/r1-development-plan.md'))
const SLEEP_MS = Number(arg('--sleep', '1500'))
const ONLY = arg('--only', null)
const ONE = arg('--card', null)

const CARD_RE = /^\*\*(S\d+-T\d+)\s+([^*]+)\*\*(.*)$/
const TYPES = ['fix', 'complete', 'build', 'keep', 'verify', 'ops']
const STATUSES = ['ready', 'in-progress', 'in-review', 'blocked', 'done']

// ---------- plan parsing ----------
const ghSlug = (h) => h.trim().toLowerCase().replace(/[^\p{L}\p{N}\s-]/gu, '').replace(/\s/g, '-')

export function parseCards(text) {
  const cards = []
  let cur = null
  let heading = ''
  for (const line of text.split(/\r?\n/)) {
    const m = line.match(CARD_RE)
    if (m) {
      const rest = m[3]
      cur = {
        id: m[1], title: m[2].trim(), lines: [line], sector: m[1].split('-')[0], anchor: ghSlug(heading),
        prio: (rest.match(/·\s*(P[012])\b/) ?? [])[1] ?? null,
        size: (rest.match(/·\s*([SML])\s*·/) ?? [])[1] ?? null,
        type: ((rest.match(/Type:\s*(Fix|Complete|Build|Keep|Verify|Ops)\b/) ?? [])[1] ?? '').toLowerCase() || null,
        delivery: /Delivery B\b/.test(rest) ? 'B' : 'A',
      }
      cards.push(cur)
      continue
    }
    const h = line.match(/^(#{1,6})\s+(.*)$/)
    if (h) { cur = null; heading = h[2]; continue }
    if (cur) cur.lines.push(line)
  }
  for (const c of cards) {
    while (c.lines.length && c.lines[c.lines.length - 1].trim() === '') c.lines.pop()
    c.text = c.lines.join('\n')
  }
  return cards
}

// card id -> first sprint number that lists it
export function parseSprints(text) {
  const lines = text.split(/\r?\n/)
  const sprintOf = new Map()
  const maxSprint = { n: 0 }
  const put = (id, n) => { if (!sprintOf.has(id)) sprintOf.set(id, n); maxSprint.n = Math.max(maxSprint.n, n) }
  let sprint = null
  for (const line of lines) {
    const sh = line.match(/^\*\*Sprint (\d+)(\+)?/)
    if (sh) {
      sprint = Number(sh[1]); maxSprint.n = Math.max(maxSprint.n, sprint)
      if (sh[2]) { // "Sprint 7+ ..." line: full ids with "Sprint N" markers inside the same line
        let n = sprint
        for (const seg of line.split(/(?=Sprint \d+)/)) {
          const sm = seg.match(/^Sprint (\d+)/); if (sm) n = Number(sm[1])
          for (const id of seg.matchAll(/\bS\d+-T\d+\b/g)) put(id[0], n)
        }
      }
      continue
    }
    if (/^#{1,6}\s/.test(line)) { if (!/^#{1,6}\s+Sprint table/.test(line) && !/^####\s/.test(line)) sprint = null; continue }
    const cm = line.match(/^- \*Cards:\*(.*)$/)
    if (cm && sprint !== null) {
      let sec = null
      for (const tok of cm[1].matchAll(/\b(S\d+)-T(\d+)\b|(?<![\w-])T(\d+)\b/g)) {
        if (tok[1]) { sec = tok[1]; put(`${sec}-T${tok[2]}`, sprint) } else if (sec) put(`${sec}-T${tok[3]}`, sprint)
      }
    }
  }
  return { sprintOf, maxSprint: maxSprint.n }
}

// ---------- body ----------
const DOC = (p) => `https://github.com/${REPO}/blob/${BASE_BRANCH}/${p}`
export function buildBody(c) {
  return [
    `Plan card **${c.id}** (sector ${c.sector}, Delivery ${c.delivery}). Source of truth: [\`docs/plan/r1-development-plan.md\`](${DOC('docs/plan/r1-development-plan.md')}#${c.anchor}).`,
    '',
    `- PRD entry: [\`docs/prd/r1/00-index.md\`](${DOC('docs/prd/r1/00-index.md')})`,
    `- Card section on \`${BASE_BRANCH}\`: ${DOC('docs/plan/r1-development-plan.md')}#${c.anchor}`,
    `- Onboarding and rules: [\`docs/plan/R1-START-HERE.md\`](${DOC('docs/plan/R1-START-HERE.md')})`,
    '',
    '## Card (verbatim from the plan)',
    '',
    c.text.split('\n').map((l) => (l === '' ? '>' : `> ${l}`)).join('\n'),
    '',
    '## Gap check (required before you start coding)',
    'Rule: analyse, find the gap, close it, never rebuild. Post this as a comment BEFORE the first commit.',
    '',
    '- [ ] I opened every file under "Starts from (existing)" and read the current V3 code',
    '- [ ] For every FR/AC of the card I recorded works / broken / missing with file:line (table: `FR/AC | works/broken/missing | file:line | planned change`)',
    '- [ ] The planned change is inside the existing files; a new file only if the card names it',
    '- [ ] No parallel page, service, store, route or table; every schema change has a DM ID and every endpoint an API ID',
    '',
    '## Definition of Done',
    '- [ ] Gap check posted before the first commit',
    '- [ ] Only the gaps closed, in the existing files (scope-guard green)',
    '- [ ] typecheck, lint and tests green (be:verify for backend), real output in the PR',
    '- [ ] Card ACs proven on UAT in a visible (headed) browser at 375, 768 and 1280, no horizontal scroll',
    '- [ ] Every AC-CHAIN-n through this card proven the same way',
    '- [ ] No placeholder string and no mock path in the http build',
    '- [ ] Evidence kept in local `.evidence/<card>/` only; no real names, e-mails or credentials in the issue or PR',
    '- [ ] CODEOWNERS review done; Delivery Lead verified and moved the card to Done',
    '',
    '## How to claim',
    'Comment `/claim` and set yourself as assignee. Move the label to `status:in-progress` only after posting the Gap check. One claimant per card. Open the PR with exactly one card ID (`' + c.id + '`) in its description.',
  ].join('\n')
}

// ---------- gh helpers ----------
const gh = (args, input) => execFileSync('gh', args, { encoding: 'utf8', input, maxBuffer: 64 * 1024 * 1024, stdio: ['pipe', 'pipe', 'pipe'] })
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const COLORS = { r1: '0e8a16', sector: '1d76db', type: 'fbca04', prio: 'd93f0b', status: '5319e7', 'r1-delivery': 'c5def5' }
function wantedLabels() {
  const l = [['r1', 'Release 1 plan card']]
  for (let i = 0; i <= 10; i++) l.push([`sector:S${i}`, `Sector S${i}`])
  for (const t of TYPES) l.push([`type:${t}`, `Card type ${t}`])
  for (const p of ['P0', 'P1', 'P2']) l.push([`prio:${p}`, `Priority ${p}`])
  for (const s of STATUSES) l.push([`status:${s}`, `Card status ${s}`])
  for (const d of ['A', 'B']) l.push([`r1-delivery:${d}`, `Delivery ${d}`])
  return l
}
const colorOf = (n) => COLORS[n.split(':')[0]] ?? 'ededed'

function labelsFor(c) {
  return ['r1', `sector:${c.sector}`, c.type && `type:${c.type}`, c.prio && `prio:${c.prio}`, 'status:ready', `r1-delivery:${c.delivery}`].filter(Boolean)
}
const msTitle = (n) => `R1 Sprint ${n}`

// ---------- main ----------
async function main() {
  const text = readFileSync(PLAN, 'utf8')
  let cards = parseCards(text)
  const { sprintOf, maxSprint } = parseSprints(text)
  const total = cards.length
  const fallbackSprint = (c) => (c.sector === 'S9' ? 1 : c.delivery === 'B' ? Math.max(7, 0) : maxSprint >= 6 ? 6 : maxSprint)
  const sprintFor = (c) => sprintOf.get(c.id) ?? fallbackSprint(c)
  const unlisted = cards.filter((c) => !sprintOf.has(c.id)).map((c) => c.id)

  if (ONE) cards = cards.filter((c) => c.id === ONE)
  else if (ONLY) cards = cards.filter((c) => c.id === ONLY || c.sector === ONLY)

  const maxMs = Math.max(maxSprint, ...cards.map(sprintFor))
  const labels = wantedLabels()
  const milestones = Array.from({ length: maxMs + 1 }, (_, n) => msTitle(n))

  console.log(`Plan: ${PLAN}`)
  console.log(`Repo: ${REPO}   base branch: ${BASE_BRANCH}   mode: ${APPLY ? 'APPLY' : 'DRY RUN'}`)
  console.log(`Cards parsed: ${total}${cards.length !== total ? ` (selected ${cards.length})` : ''}`)
  console.log(`Cards not in any sprint list (fallback sprint used): ${unlisted.length}${unlisted.length ? ' -> ' + unlisted.join(', ') : ''}`)

  const existingTitles = new Set()
  let existingLabels = new Set()
  let existingMs = new Map()
  if (APPLY) {
    gh(['auth', 'status'])
    for (const i of JSON.parse(gh(['issue', 'list', '--repo', REPO, '--state', 'all', '--limit', '2000', '--json', 'title']))) existingTitles.add(i.title)
    existingLabels = new Set(JSON.parse(gh(['label', 'list', '--repo', REPO, '--limit', '500', '--json', 'name'])).map((x) => x.name))
    for (const m of JSON.parse(gh(['api', `repos/${REPO}/milestones?state=all&per_page=100`]))) existingMs.set(m.title, m.number)
  }
  const hasIssue = (c) => [...existingTitles].some((t) => t.startsWith(`${c.id} `))

  const newLabels = labels.filter(([n]) => !existingLabels.has(n))
  const newMs = milestones.filter((t) => !existingMs.has(t))
  console.log(`Labels to create: ${APPLY ? newLabels.length : labels.length} of ${labels.length}`)
  console.log(`  ${(APPLY ? newLabels : labels).map(([n]) => n).join(', ')}`)
  console.log(`Milestones to create: ${APPLY ? newMs.length : milestones.length}: ${(APPLY ? newMs : milestones).join(', ')}`)

  const toCreate = cards.filter((c) => !hasIssue(c))
  const bySprint = {}
  for (const c of toCreate) bySprint[sprintFor(c)] = (bySprint[sprintFor(c)] ?? 0) + 1
  console.log(`Issues to create: ${toCreate.length}; skipped (already exist): ${cards.length - toCreate.length}`)
  console.log(`  per milestone: ${Object.entries(bySprint).map(([n, k]) => `${msTitle(n)}=${k}`).join(', ')}`)
  const cnt = (f) => { const o = {}; for (const c of toCreate) o[f(c)] = (o[f(c)] ?? 0) + 1; return Object.entries(o).sort().map(([k, v]) => `${k}=${v}`).join(' ') }
  console.log(`  by sector: ${cnt((c) => c.sector)}`)
  console.log(`  by priority: ${cnt((c) => c.prio ?? '?')}   by type: ${cnt((c) => c.type ?? '?')}   by delivery: ${cnt((c) => c.delivery)}`)
  const bad = cards.filter((c) => !c.prio || !c.type)
  if (bad.length) console.log(`  WARNING cards missing priority or type: ${bad.map((c) => c.id).join(', ')}`)

  if (!APPLY) {
    const samples = ONE ? cards : [cards.find((c) => c.id === 'S1-T02') ?? cards[1], cards.find((c) => c.id === 'S3-T04') ?? cards[cards.length - 1]].filter(Boolean)
    for (const c of samples) {
      const b = buildBody(c)
      console.log(`\n----- SAMPLE ${c.id} "${c.id} ${c.title}"  labels=[${labelsFor(c).join(', ')}]  milestone="${msTitle(sprintFor(c))}" -----`)
      console.log(ONE ? b : b.length > 1800 ? b.slice(0, 1800) + `\n... [truncated, ${b.length} chars]` : b)
    }
    console.log('\nDry run only. Re-run with --apply to create (needs `gh auth login` with repo scope).')
    return
  }

  for (const [n, d] of newLabels) { gh(['label', 'create', n, '--repo', REPO, '--color', colorOf(n), '--description', d]); console.log(`label + ${n}`) }
  for (const t of newMs) {
    const r = JSON.parse(gh(['api', '-X', 'POST', `repos/${REPO}/milestones`, '-f', `title=${t}`]))
    existingMs.set(t, r.number); console.log(`milestone + ${t}`)
  }
  const tmp = mkdtempSync(join(tmpdir(), 'r1-issues-'))
  let created = 0, failed = 0
  try {
    for (const c of toCreate) {
      const file = join(tmp, `${c.id}.md`)
      writeFileSync(file, buildBody(c))
      const args = ['issue', 'create', '--repo', REPO, '--title', `${c.id} ${c.title}`, '--body-file', file, '--milestone', msTitle(sprintFor(c))]
      for (const l of labelsFor(c)) args.push('--label', l)
      try { console.log(`issue + ${c.id}  ${gh(args).trim()}`); created++ } catch (e) { failed++; console.error(`FAILED ${c.id}: ${String(e.stderr ?? e.message).trim()}`) }
      await sleep(SLEEP_MS)
    }
  } finally { rmSync(tmp, { recursive: true, force: true }) }
  console.log(`\nSummary: created ${created}, failed ${failed}, skipped ${cards.length - toCreate.length}, labels ${newLabels.length}, milestones ${newMs.length}`)
  if (failed) process.exit(1)
}

main().catch((e) => { console.error(String(e.stderr ?? e.message ?? e)); process.exit(2) })
