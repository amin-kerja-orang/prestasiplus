#!/usr/bin/env node
// R1 traceability check: PRD (docs/prd/r1/*.md) <-> development plan (docs/plan/r1-development-plan.md).
// Fails (exit 1) when
//   (a) a PRD module/screen that has requirements is not referenced by any task card, or
//   (b) a task card references a PRD module/ID that does not exist, or
//   (c) a URS id cited anywhere does not exist in 02-urs, or
//   (d) an FR/AC (or range) cited in a 02-urs "Satisfied by" cell does not resolve to the SRS, or
//   (e) a DM or API id cited in the plan, the SRS or 50/60 does not exist in 50/60, or
//   (f) a DM or an Exists-Fix / Missing-Build API is not owned by exactly one card
//       (the "- Data/API:" line of a plan card is the owner declaration), or a card has no such line, or
//   (g) a card named in the Cards column of 50/60 does not exist, or the owning card is not one of them.
//   (h) every AC-CHAIN-n defined in 40 (AC-CHAIN-1..N, N = the highest defined, at least 9, must all exist and S9-T06 must name AC-CHAIN-1..N) is owned by card S9-T06, or
//   (i) a card has no "- Starts from (existing):" line with at least one backticked path (scripts/r1-scope-guard.mjs needs it), or
//   (j) (F-09) a card is in no sprint list of plan 5A (unless declared recurring there), or a sprint list / `deps:` names a card
//       that does not exist, or a card's dependency starts in a LATER sprint than the card's first sprint (parenthetical notes in
//       `deps:` are not dependencies; recurring cards have no sprint and are exempt), or
//   (k) (F-22) a card's Type is weaker than the strongest Action (Keep|Fix|Complete|Build) of the PRD modules it cites
//       (strength Keep = Verify < Fix < Complete < Build; Type Ops is exempt).
// Card IDs are S<n>-T<nn> with an optional ONE lowercase letter for a split card (S1-T09a, D113).
// Writes docs/plan/r1-traceability.md: every PRD module -> its task cards, with FR/AC counts, plus the ID-chain sections.
// Usage: node scripts/r1-trace-check.mjs [--quiet]
//        node scripts/r1-trace-check.mjs --self-test   (rules (j) and (k) and the card-ID regex on small fixtures; touches no file)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const PRD_FILES = ['10-murid.md', '20-guru-admin-sekolah.md', '30-admin-pusat.md', '40-cross-cutting.md']
const PLAN = 'docs/plan/r1-development-plan.md'
const OUT = 'docs/plan/r1-traceability.md'

const num = (s) => String(Number(s))
// module row part of a key: 'QP', 'A1', '44', '44a' (rows with a letter suffix such as 2b, 8b, 44a)
const nk = (s) => (/^\d/.test(s) ? String(parseInt(s, 10)) + s.replace(/^\d+/, '') : s)

// Normalise any PRD/plan reference to a module key, e.g. MUR-3, MUR-A1, MUR-QP, GUR-43, AS-11,
// ADM-Q16, ADM-QE7, ADM-U1, ADM-C1, ADM-N5, ADM-M4, ADM-P2-1, ADM-G7, X2, NFR-1.
function keyOf(id) {
  let m
  if ((m = id.match(/^(?:FR|AC)-(MUR|GUR|AS)-(QP|A\d|\d+[a-z]?)(?=-|\b)/))) return `${m[1]}-${nk(m[2])}`
  if ((m = id.match(/^R1-(MUR|GUR|AS)-(QP|A\d|\d+[a-z]?)\b/))) return `${m[1]}-${nk(m[2])}`
  if ((m = id.match(/^(?:FR|AC)-ADM-P2-(\d+)/))) return `ADM-P2-${num(m[1])}`
  if ((m = id.match(/^R1-ADM-P2-(\d+)/))) return `ADM-P2-${num(m[1])}`
  if ((m = id.match(/^(?:FR|AC)-ADM-(QE|Q|U|C|N|M|G)-?(\d+)/))) return `ADM-${m[1]}${num(m[2])}`
  if ((m = id.match(/^R1-ADM-(QE|Q|U|C|N|M|G)-(\d+)/))) return `ADM-${m[1]}${num(m[2])}`
  if ((m = id.match(/^(?:FR|AC)-X(\d+)/))) return `X${m[1]}`
  if ((m = id.match(/^NFR-(\d+)/))) return `NFR-${m[1]}`
  return null
}


// ---------- card IDs, sprints, deps, Type vs Action (rules j and k; pure functions, covered by --self-test) ----------
const CARD_ID = 'S\\d+-T\\d+[a-z]?' // optional ONE lowercase letter: split card (D113)
const CARD_HEAD_RE = () => new RegExp(`^\\*\\*(${CARD_ID})\\s+([^*]+)\\*\\*(.*)$`, 'gm')
const CARD_ANY_RE = () => new RegExp(`\\b${CARD_ID}\\b`, 'g')
const pad = (n) => String(n).padStart(2, '0')
const stripParens = (t) => { let p; do { p = t; t = t.replace(/\([^()]*\)/g, '') } while (t !== p); return t }

/** Card IDs named by the `deps:` field of a card (first line). Text after " · ", parenthetical notes and non-IDs are ignored; `S4-T02..T05` is a range. */
function depsOf(body) {
  const m = body.split('\n')[0].match(/\bdeps:\s*(.*)$/)
  if (!m) return null
  const t = stripParens(m[1].split(/\s·\s/)[0])
  const out = []
  for (const x of t.matchAll(/\bS(\d+)-T(\d+)([a-z]?)(?:\s*\.\.\s*(?:S\d+-)?T?(\d+))?/g)) {
    if (x[4] && !x[3]) { for (let i = Number(x[2]); i <= Number(x[4]) && i - Number(x[2]) < 100; i++) out.push(`S${x[1]}-T${pad(i)}`) }
    else out.push(`S${x[1]}-T${x[2]}${x[3]}`)
  }
  return out
}

/** Sprint lists of plan 5A: card -> sorted sprint numbers; recurring = cards declared recurring (no sprint list). */
function parseSprints(planText) {
  const a = planText.indexOf('### 5A.')
  const b = planText.indexOf('### 5B.')
  const sec = a >= 0 ? planText.slice(a, b > a ? b : undefined) : ''
  const sprintsOf = new Map()
  const add = (id, n) => { if (!sprintsOf.has(id)) sprintsOf.set(id, new Set()); sprintsOf.get(id).add(n) }
  const walk = (text, startSprint) => {
    let sprint = startSprint, sector = null
    for (const t of stripParens(text).matchAll(/\bSprint (\d+)|\bS(\d+)-T(\d+)([a-z]?)\b|\bT(\d{2})([a-z]?)\b/g)) {
      if (t[1] !== undefined) { sprint = Number(t[1]); sector = null; continue }
      if (sprint === null) continue
      if (t[2] !== undefined) { sector = t[2]; add(`S${t[2]}-T${t[3]}${t[4]}`, sprint) }
      else if (sector !== null) add(`S${sector}-T${t[5]}${t[6]}`, sprint)
    }
  }
  let cur = null
  for (const line of sec.split('\n')) {
    const h = line.match(/^\*\*Sprint (\d+)\b/)
    if (h && /^\*\*Sprint \d+\+/.test(line)) { cur = null; walk(line.replace(/^\*\*Sprint \d+\+[^*]*\*\*/, ''), null); continue }
    if (h) { cur = Number(h[1]); continue }
    const c = line.match(/^- \*Cards:\*(.*)$/)
    if (c && cur !== null) walk(c[1], cur)
  }
  const recurring = new Set()
  const rm = sec.match(/((?:`?S\d+-T\d+[a-z]?`?[,\s]*(?:and\s+)?)+)\s*(?:is|are) recurring/)
  if (rm) for (const id of rm[1].match(CARD_ANY_RE()) ?? []) recurring.add(id)
  return { sprintsOf: new Map([...sprintsOf].map(([k, v]) => [k, [...v].sort((x, y) => x - y)])), recurring }
}

/** Rule (j) / F-09. cards: [{ id, body }]. Returns a list of problem strings. */
function checkSprintDeps(cards, { sprintsOf, recurring }) {
  const out = []
  const ids = new Set(cards.map((c) => c.id))
  const first = (id) => sprintsOf.get(id)?.[0]
  for (const [id, sp] of sprintsOf) if (!ids.has(id)) out.push(`sprint ${sp[0]} lists ${id}, which is not a card in the plan`)
  for (const c of cards) {
    const mine = first(c.id)
    if (mine === undefined && !recurring.has(c.id)) out.push(`${c.id}: not in any sprint list of plan 5A and not declared recurring`)
    for (const d of depsOf(c.body) ?? []) {
      if (d === c.id) continue
      if (!ids.has(d)) { out.push(`${c.id}: deps names ${d}, which is not a card in the plan`); continue }
      if (recurring.has(d) || recurring.has(c.id) || mine === undefined) continue
      const theirs = first(d)
      if (theirs !== undefined && theirs > mine) out.push(`${c.id} (first sprint ${mine}) depends on ${d} (first sprint ${theirs}, later)`)
    }
  }
  return out
}

const ACTION_RANK = { Keep: 0, Verify: 0, Fix: 1, Complete: 2, Build: 3 }
const typeOf = (body) => ((body.split('\n')[0].match(/\bType:\s*(Keep|Verify|Fix|Complete|Build|Ops)\b/) ?? body.match(/\bType:\s*(Keep|Verify|Fix|Complete|Build|Ops)\b/) ?? [])[1]) ?? null

/** Action of every PRD module: heading `### R1-<role>-<module>` followed by `- **Action**: X` or `- **Action: X**`. key -> Keep|Fix|Complete|Build. */
function parsePrdActions(text) {
  const out = new Map()
  for (const part of text.split(/^(?=#{2,5} R1-)/m)) {
    const h = part.match(/^#{2,5} (R1-[A-Za-z0-9]+(?:-[A-Za-z0-9]+)*)/)
    if (!h) continue
    const k = keyOf(h[1])
    const a = part.match(/\*\*Action(?:\*\*:|:\*\*|:)\s*(Keep|Fix|Complete|Build)\b/)
    if (k && a && !out.has(k)) out.set(k, a[1])
  }
  return out
}

/** Rule (k) / F-22. cards: [{ id, body, refs:Set }]; actions: key -> Action. */
function checkTypeAction(cards, actions) {
  const out = []
  for (const c of cards) {
    const type = typeOf(c.body)
    if (!type) { out.push(`${c.id}: no "Type:" on the card`); continue }
    if (type === 'Ops') continue
    const strong = [...c.refs].filter((k) => actions.has(k)).map((k) => [k, actions.get(k)]).filter(([, a]) => ACTION_RANK[a] > ACTION_RANK[type])
    if (!strong.length) continue
    const top = Math.max(...strong.map(([, a]) => ACTION_RANK[a]))
    out.push(`${c.id}: Type ${type} is weaker than the Action of ${strong.filter(([, a]) => ACTION_RANK[a] === top).map(([k, a]) => `${k} (${a})`).join(', ')}`)
  }
  return out
}

if (process.argv.includes('--self-test')) {
  const rs = []
  const eq = (name, got, want) => rs.push({ name, ok: JSON.stringify(got) === JSON.stringify(want), detail: `got ${JSON.stringify(got)}\n      want ${JSON.stringify(want)}` })
  const re = CARD_HEAD_RE()
  eq('card regex: letter suffix and plain IDs', [...'**S1-T09a Split A** · P1\n**S1-T10 Plain** · P0\n**S1-T11B Upper** · P0'.matchAll(re)].map((m) => m[1]), ['S1-T09a', 'S1-T10'])
  eq('card ID in text: word-bounded, optional letter', 'see S1-T09a, S1-T09b and S1-T09, not S1-T09ab or S1-T09A'.match(CARD_ANY_RE()), ['S1-T09a', 'S1-T09b', 'S1-T09'])
  eq('deps: parentheses stripped', depsOf('**S0-T08 x** · deps: none (S0-T07 consumes it)'), [])
  eq('deps: list, text after the dot, parenthetical', depsOf('**S5-T01 x** · Type: Fix · deps: S4-T03, S8-T02 (stimulus) · Delivery A (S7-T01)'), ['S4-T03', 'S8-T02'])
  eq('deps: range S4-T02..T05 and split IDs', depsOf('**S9-T09 x** · deps: S4-T02..T05, S1-T09a'), ['S4-T02', 'S4-T03', 'S4-T04', 'S4-T05', 'S1-T09a'])
  eq('deps: words are not dependencies', depsOf('**S9-T03 x** · deps: sprint merged'), [])
  const plan = [
    '### 5A. Sprint plan', 'The cards `S9-T01`, `S9-T02` and `S9-T05` are recurring Delivery Lead cards that run in every sprint.',
    '**Sprint 0 (1 week) — Foundation.**', '- *Cards:* S0-T01, T02 · S1-T01 (start) · S9-T03.',
    '**Sprint 1 — x.**', '- *Cards:* S1-T01 (finish), T09a (note, 1, 2) · S2-T01, T02(P2).',
    '**Sprint 2 — y.**', '- *Cards:* S3-T01 · S9 verification of Sprint 1.',
    '**Sprint 7+ (Delivery B)** — goals: Sprint 7 S7-T07 (Cabutan), S7-T08; Sprint 8 S7-T10 (x), S6-T13; Sprint 9 hardening.',
    '### 5B. Capacity', '- *Cards:* S9-T99',
  ].join('\n')
  const sp = parseSprints(plan)
  eq('sprints: sector prefix carries to bare T, parentheses dropped, first sprint kept', [sp.sprintsOf.get('S0-T02'), sp.sprintsOf.get('S1-T01'), sp.sprintsOf.get('S1-T09a'), sp.sprintsOf.get('S2-T02')], [[0], [0, 1], [1], [1]])
  eq('sprints: Sprint 7+ paragraph', [sp.sprintsOf.get('S7-T07'), sp.sprintsOf.get('S7-T08'), sp.sprintsOf.get('S7-T10'), sp.sprintsOf.get('S6-T13')], [[7], [7], [8], [8]])
  eq('sprints: recurring declared; 5B is not read', [[...sp.recurring], sp.sprintsOf.has('S9-T99')], [['S9-T01', 'S9-T02', 'S9-T05'], false])
  const card = (id, deps, type = 'Fix') => ({ id, body: `**${id} t** · P0 · S · Type: ${type} · deps: ${deps}\n- Data/API: none` })
  const all = ['S0-T01', 'S0-T02', 'S1-T01', 'S1-T09a', 'S2-T01', 'S2-T02', 'S3-T01', 'S9-T03', 'S7-T07', 'S7-T08', 'S7-T10', 'S6-T13']
  const base = all.map((id) => card(id, 'none'))
  const cardsOk = [...base, card('S9-T01', 'none'), card('S9-T02', 'S3-T01'), card('S9-T05', 'none')]
  eq('F-09: all in order -> no problem', checkSprintDeps(cardsOk, sp), [])
  const bad = (id, deps) => [...cardsOk.filter((c) => c.id !== id), card(id, deps)]
  eq('F-09: dependency in a later sprint fails', checkSprintDeps(bad('S1-T09a', 'S3-T01'), sp), ['S1-T09a (first sprint 1) depends on S3-T01 (first sprint 2, later)'])
  eq('F-09: dependency in the same or an earlier sprint is fine', checkSprintDeps(bad('S2-T01', 'S1-T09a, S2-T02, S0-T01'), sp), [])
  eq('F-09: parenthetical note is not a dependency', checkSprintDeps(bad('S1-T09a', 'none (S3-T01 consumes it)'), sp), [])
  eq('F-09: recurring card as dependency is exempt', checkSprintDeps(bad('S0-T01', 'S9-T01'), sp), [])
  eq('F-09: dependency on an unknown card fails', checkSprintDeps(bad('S1-T09a', 'S1-T09'), sp), ['S1-T09a: deps names S1-T09, which is not a card in the plan'])
  eq('F-09: card in no sprint list fails (not recurring)', checkSprintDeps([...cardsOk, card('S4-T01', 'none')], sp), ['S4-T01: not in any sprint list of plan 5A and not declared recurring'])
  eq('F-09: sprint list naming an unknown card fails', checkSprintDeps(cardsOk.filter((c) => c.id !== 'S2-T02'), sp), ['sprint 1 lists S2-T02, which is not a card in the plan'])
  const prd = ['### R1-MUR-3 Headcount', '- **Action**: Complete', 'x', '### R1-GUR-2b Misi (child)', '- **Action: Build**', '#### R1-ADM-QE-01 Rule | P0', '- **Action: Fix** | gap', '### R1-MUR-7 Video', '- **Action**: Keep'].join('\n')
  const ac = parsePrdActions(prd)
  eq('Action parser: both notations, letter suffix, QE ids', [...ac], [['MUR-3', 'Complete'], ['GUR-2b', 'Build'], ['ADM-QE1', 'Fix'], ['MUR-7', 'Keep']])
  const tc = (id, type, ...refs) => ({ id, body: `**${id} t** · P0 · S · Type: ${type} · deps: none`, refs: new Set(refs) })
  eq('F-22: Type below the Action fails', checkTypeAction([tc('S5-T01', 'Fix', 'MUR-3'), tc('S5-T02', 'Verify', 'MUR-7', 'ADM-QE1')], ac), ['S5-T01: Type Fix is weaker than the Action of MUR-3 (Complete)', 'S5-T02: Type Verify is weaker than the Action of ADM-QE1 (Fix)'])
  eq('F-22: Type equal or stronger is fine; Keep and Verify are equal', checkTypeAction([tc('S5-T01', 'Complete', 'MUR-3', 'MUR-7'), tc('S5-T02', 'Build', 'GUR-2b', 'MUR-3'), tc('S5-T03', 'Verify', 'MUR-7'), tc('S5-T04', 'Keep', 'MUR-7')], ac), [])
  eq('F-22: strongest Action decides', checkTypeAction([tc('S5-T01', 'Complete', 'MUR-3', 'GUR-2b')], ac), ['S5-T01: Type Complete is weaker than the Action of GUR-2b (Build)'])
  eq('F-22: Ops is exempt; unknown modules are ignored', checkTypeAction([tc('S0-T01', 'Ops', 'GUR-2b'), tc('S0-T02', 'Fix', 'NFR-4', 'MUR-99')], ac), [])
  eq('F-22: a card without Type fails', checkTypeAction([{ id: 'S5-T09', body: '**S5-T09 t** · P0', refs: new Set() }], ac), ['S5-T09: no "Type:" on the card'])
  let bad2 = 0
  for (const r of rs) { if (!r.ok) bad2++; console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.name}${r.ok ? '' : '\n      ' + r.detail}`) }
  console.log(`\nSelf-test: ${rs.length - bad2}/${rs.length} passed`)
  process.exit(bad2 ? 1 : 0)
}

// ---------- PRD ----------
const prd = new Map() // key -> { file, fr:Set, ac:Set }
const ID_RE = /\b(?:FR|AC)-(?:(?:MUR|GUR|AS)-(?:QP|A\d|\d+[a-z]?)-\d+[a-z]?|ADM-(?:P2-\d+|QE\d+|Q\d+|U\d+|C\d+|N\d+|M\d+|G\d+)\.\d+|X\d+-\d+[a-z]?)\b/g
for (const f of PRD_FILES) {
  const text = readFileSync(join(root, 'docs/prd/r1', f), 'utf8')
  for (const id of text.match(ID_RE) ?? []) {
    const k = keyOf(id)
    if (!k) continue
    if (!prd.has(k)) prd.set(k, { file: f, fr: new Set(), ac: new Set() })
    prd.get(k)[id.startsWith('FR') ? 'fr' : 'ac'].add(id)
  }
  for (const id of text.match(/\bNFR-\d+\b/g) ?? []) if (!prd.has(id)) prd.set(id, { file: f, fr: new Set([id]), ac: new Set() })
}

// ---------- PLAN ----------
const plan = readFileSync(join(root, PLAN), 'utf8')
const cards = [] // { id, title, pri, body }
const cardRe = CARD_HEAD_RE()
const starts = [...plan.matchAll(cardRe)]
starts.forEach((m, i) => {
  const end = i + 1 < starts.length ? starts[i + 1].index : plan.indexOf('\n## ', m.index + 1)
  const body = plan.slice(m.index, end > 0 ? end : undefined)
  const pri = (m[3].match(/\bP[012]\b/) || [''])[0]
  cards.push({ id: m[1], title: m[2].trim(), pri, body })
})

// The "- Data/API:" and "- Also uses:" lines carry DM/API ids (e.g. API-Q-13) that must not be read as PRD screen refs.
const DATA_LINES = /^- (?:Data\/API|Also uses):.*$/gm

// Expand references inside a card body, including ranges like "Q-13 to Q-15", "U-01..U-04", "QE1..QE6", "Q03..Q09".
function refsOf(body) {
  const keys = new Set()
  const add = (k) => k && keys.add(k)
  for (const id of body.match(/\b(?:FR|AC)-[A-Z0-9]+[A-Za-z0-9.*-]*/g) ?? []) add(keyOf(id.replace(/\*$/, '0').replace(/\.$/, '')))
  for (const id of body.match(/\bR1-(?:MUR|GUR|AS|ADM)-[A-Za-z0-9-]+/g) ?? []) add(keyOf(id))
  for (const id of body.match(/\bNFR-\d+\b/g) ?? []) add(id)
  // short admin screen refs: Q-16, Q16, QE-07, QE7, U-01, C-05, N-01, M-04, P2-01, G7 (not U-OP-*)
  const short = /\b(QE|Q|U|C|N|M|G)-?(\d{1,2})(?:\s*(?:\.\.|–|-|to)\s*(?:\1-?)?(\d{1,2}))?\b/g
  for (const m of body.matchAll(short)) {
    if (m[1] === 'U' && /U-OP/.test(body.slice(m.index, m.index + 4))) continue
    const a = Number(m[2]), b = m[3] ? Number(m[3]) : a
    if (b < a || b - a > 30) continue
    for (let i = a; i <= b; i++) add(`ADM-${m[1]}${i}`)
  }
  for (const m of body.matchAll(/\bP2-(\d{1,2})(?:\s*(?:\.\.|–|to)\s*(?:P2-)?(\d{1,2}))?/g)) {
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a
    for (let i = a; i <= b; i++) add(`ADM-P2-${i}`)
  }
  // pupil/teacher/school-admin module wildcards like AC-MUR-46..53-* handled above per id; ranges "AC-AS-46..53-*"
  for (const m of body.matchAll(/\b(?:AC|FR)-(MUR|GUR|AS)-(\d+)\.\.(\d+)/g)) for (let i = Number(m[2]); i <= Number(m[3]); i++) add(`${m[1]}-${i}`)
  for (const m of body.matchAll(/\b(?:AC|FR)-(MUR|GUR|AS)-((?:A?\d+\/)+A?\d+)/g)) for (const r of m[2].split('/')) add(`${m[1]}-${/^\d+$/.test(r) ? num(r) : r}`)
  return keys
}

const covered = new Map() // key -> [card ids]
const dangling = [] // { card, key }
for (const c of cards) {
  c.refs = refsOf(c.body.replace(DATA_LINES, ''))
  for (const k of c.refs) {
    if (prd.has(k)) { if (!covered.has(k)) covered.set(k, []); covered.get(k).push(c.id) }
    else if (!/^ADM-G\d+$/.test(k)) dangling.push({ card: c.id, key: k })
  }
}

const uncovered = [...prd.keys()].filter((k) => !covered.has(k)).sort()
const sortKey = (k) => k.replace(/\d+/g, (d) => d.padStart(3, '0'))

// ---------- ID chain: URS -> FR/AC -> DM/API -> card ----------
const readDoc = (p) => readFileSync(join(root, p), 'utf8')
const PRD_DIR = 'docs/prd/r1'
const prdAll = readdirSync(join(root, PRD_DIR)).filter((f) => /^\d\d-.*\.md$/.test(f)).sort()
const docText = new Map(prdAll.map((f) => [`${PRD_DIR}/${f}`, readDoc(`${PRD_DIR}/${f}`)]))
docText.set(PLAN, plan)
const pad2 = (n) => String(n).padStart(2, '0')
const problems = { urs: [], ursRange: [], ref: [], own: [], cardLine: [], cardRef: [], chain: [], startsFrom: [], sprintDeps: [], typeAction: [] }

// (c) URS ids defined in 02-urs; every cited id must exist
const urs = readDoc(`${PRD_DIR}/02-urs.md`)
const ursDefined = new Set([...urs.matchAll(/^\| (URS-[A-Z]+-\d+) \|/gm)].map((m) => m[1]))
const ursRe = /\bURS-(MUR|GUR|AS|ADM|ALL)-(\d+)(?:\s*(?:\.\.|–|\bto\b)\s*(?:URS-\1-)?(\d+))?/g
const ursCited = new Map() // id -> Set(files)
for (const [file, text] of docText) {
  for (const m of text.matchAll(ursRe)) {
    const a = Number(m[2]), b = m[3] ? Number(m[3]) : a
    for (let i = a; i <= b && i - a < 100; i++) {
      const id = `URS-${m[1]}-${pad2(i)}`
      if (!ursCited.has(id)) ursCited.set(id, new Set())
      ursCited.get(id).add(file.split('/').pop())
    }
  }
}
for (const [id, files] of ursCited) if (!ursDefined.has(id)) problems.urs.push(`${id} (cited in ${[...files].join(', ')})`)

// (d) FR/AC ids defined in the SRS; every id and range cited in 02-urs "Satisfied by" must resolve
const srsDefined = new Set()
const SRS_ID = /\b(?:FR|AC)-[A-Z][A-Za-z0-9]*(?:-[A-Za-z0-9]+)*(?:\.\d+[a-z]?)?/g
for (const f of PRD_FILES) for (const id of readDoc(`${PRD_DIR}/${f}`).match(SRS_ID) ?? []) srsDefined.add(id.replace(/[-.]+$/, ''))
const srsList = [...srsDefined]
const tokenRe = /\b(?:FR|AC)-[A-Za-z0-9][A-Za-z0-9.\-*]*(?:\.\.(?:(?:FR|AC)-)?[A-Za-z0-9][A-Za-z0-9.\-*]*)?/g
let ursTokens = 0
for (const row of urs.split('\n').filter((l) => /^\| URS-/.test(l))) {
  const rid = row.match(/^\| (URS-[A-Z]+-\d+)/)[1]
  const cells = row.split(/\s+\|\s+/)
  const sat = cells[cells.length - 1]
  for (let tok of sat.match(tokenRe) ?? []) {
    tok = tok.replace(/[.,;)]+$/, '')
    ursTokens++
    const bad = (why) => problems.ursRange.push(`${rid}: ${tok} ${why}`)
    if (tok.includes('*')) { const p = tok.slice(0, tok.indexOf('*')); if (!srsList.some((x) => x.startsWith(p))) bad('(no FR/AC with that prefix)'); continue }
    if (!tok.includes('..')) { if (!srsDefined.has(tok)) bad('(not defined in the SRS)'); continue }
    const [left, rightRaw] = tok.split('..')
    const right = rightRaw.replace(/^(?:FR|AC)-/, '')
    const lm = left.match(/^(.*?)(\d+)([a-z]?)$/)
    if (!lm) { bad('(cannot parse range)'); continue }
    if (/^[a-z]$/.test(right) && lm[3]) {
      for (let c = lm[3].charCodeAt(0); c <= right.charCodeAt(0); c++) { const id = `${lm[1]}${lm[2]}${String.fromCharCode(c)}`; if (!srsDefined.has(id)) bad(`(${id} missing)`) }
    } else {
      const rm = right.match(/(\d+)$/)
      if (!rm || lm[3]) { bad('(cannot parse range end)'); continue }
      const miss = []
      for (let i = Number(lm[2]); i <= Number(rm[1]); i++) {
        if (!srsDefined.has(`${lm[1]}${i}`) && !srsDefined.has(`${lm[1]}${String(i).padStart(lm[2].length, '0')}`)) miss.push(`${lm[1]}${i}`)
      }
      if (miss.length) bad(`(missing ${miss.join(', ')})`)
    }
  }
}

// (e) DM ids (50 section 4) and API ids (60 section 2)
const erd = docText.get(`${PRD_DIR}/50-data-model-erd.md`)
const dmDefined = new Map() // id -> { action, cardsCell }
for (const m of erd.matchAll(/^\| (DM-\d+) \| (Keep|Fix|Complete|Build) \|(.*)$/gm)) dmDefined.set(m[1], { action: m[2], cardsCell: m[3].split(/\s+\|\s+/)[3] ?? '' })
const apiDoc = docText.get(`${PRD_DIR}/60-api-contract.md`)
const apiDefined = new Map() // id -> { status, cardsCell }
for (const m of apiDoc.matchAll(/^\| (API-[A-Z]+-\d+) \|.*\|\s*$/gm)) {
  const cells = m[0].replace(/^\|\s*/, '').replace(/\s*\|\s*$/, '').split(/\s+\|\s+/)
  if (cells.length !== 8) continue // the cross-reference table of 60 section 2.15 has 2 columns
  const st = cells[5].match(/^(Exists-OK|Exists-Fix|Missing-Build)/)
  apiDefined.set(m[1], { status: st ? st[1] : '?', cardsCell: cells[7] })
}
const isDefined = (id) => (id.startsWith('DM-') ? dmDefined.has(id) : apiDefined.has(id))
const needsOwner = (id) => (id.startsWith('DM-') ? dmDefined.has(id) : ['Exists-Fix', 'Missing-Build'].includes(apiDefined.get(id)?.status))

function expandRefs(text) {
  const out = []
  for (const m of text.matchAll(/\bDM-(\d+)(?:\s*(?:\.\.|–|\bto\b)\s*(?:DM-)?(\d+))?/g)) {
    const a = Number(m[1]), b = m[2] ? Number(m[2]) : a
    for (let i = a; i <= b && i - a < 100; i++) out.push(`DM-${pad2(i)}`)
  }
  for (const m of text.matchAll(/\bAPI-([A-Z]+)-(\d+)(?:\s*(?:\.\.|–|\bto\b)\s*(?:API-)?(?:\1-)?(\d+))?/g)) {
    const a = Number(m[2]), b = m[3] ? Number(m[3]) : a
    for (let i = a; i <= b && i - a < 100; i++) out.push(`API-${m[1]}-${pad2(i)}`)
  }
  return out
}
const refFiles = new Map() // id -> Set(file)
for (const [file, text] of docText) {
  for (const id of expandRefs(text)) {
    if (isDefined(id)) continue
    if (!refFiles.has(id)) refFiles.set(id, new Set())
    refFiles.get(id).add(file.split('/').pop())
  }
}
for (const [id, files] of refFiles) problems.ref.push(`${id} (cited in ${[...files].join(', ')})`)

// (f) Data/API ownership by card
const owners = new Map() // id -> [card ids]
for (const c of cards) {
  const lm = c.body.match(/^- Data\/API:\s*(.*)$/m)
  if (!lm) { problems.cardLine.push(`${c.id}: no "- Data/API:" line`); continue }
  c.dataApi = lm[1].trim()
  if (/^none\b/i.test(c.dataApi)) continue
  const ids = new Set(c.dataApi.match(/\b(?:DM-\d+|API-[A-Z]+-\d+)\b/g) ?? [])
  if (!ids.size) problems.cardLine.push(`${c.id}: "Data/API" names no DM or API id and is not "none"`)
  for (const id of ids) {
    if (!isDefined(id)) continue // reported by (e)
    if (!owners.has(id)) owners.set(id, [])
    owners.get(id).push(c.id)
  }
}
const ownRows = [] // { id, status, owners }
for (const id of [...dmDefined.keys(), ...apiDefined.keys()]) {
  if (!needsOwner(id)) continue
  const o = owners.get(id) ?? []
  ownRows.push({ id, status: id.startsWith('DM-') ? dmDefined.get(id).action : apiDefined.get(id).status, owners: o })
  if (o.length === 0) problems.own.push(`${id}: no owning card`)
  if (o.length > 1) problems.own.push(`${id}: owned by ${o.length} cards (${o.join(', ')})`)
}

// (g) cards named in the Cards column of 50/60 must exist, and the owner must be one of them
const cardIds = new Set(cards.map((c) => c.id))
for (const [id, v] of [...dmDefined, ...apiDefined]) {
  const cited = v.cardsCell.match(CARD_ANY_RE()) ?? []
  for (const cid of cited) if (!cardIds.has(cid)) problems.cardRef.push(`${id} → ${cid} (card does not exist)`)
  const o = owners.get(id)
  if (o?.length === 1 && cited.length && !cited.includes(o[0])) problems.cardRef.push(`${id}: owner ${o[0]} is not in the Cards column of ${id.startsWith('DM-') ? '50' : '60'} (${cited.join(', ')})`)
}
// (h) AC-CHAIN-n of 40 section X9 must all be owned by S9-T06
const chainDefined = new Set([...readDoc(PRD_DIR + '/40-cross-cutting.md').matchAll(/^\*\*(AC-CHAIN-\d+)\b/gm)].map((m) => m[1]))
const chainCard = cards.find((c) => c.id === 'S9-T06')
if (!chainCard) problems.chain.push('card S9-T06 does not exist')
const chainMax = Math.max(0, ...[...chainDefined].map((x) => Number(x.split('-')[2])))
for (let i = 1; i <= Math.max(9, chainMax); i++) if (!chainDefined.has('AC-CHAIN-' + i)) problems.chain.push('AC-CHAIN-' + i + ' is not defined in 40-cross-cutting.md')
const chainRange = 'AC-CHAIN-1..' + Math.max(9, chainMax)
const chainRangeRe = new RegExp(chainRange.replace(/\./g, '\\.'))
if (chainCard) {
  const names = (id) => new RegExp('\\b' + id + '\\b').test(chainCard.body) || chainRangeRe.test(chainCard.body)
  for (const id of chainDefined) if (!names(id)) problems.chain.push(id + ' is not owned by S9-T06')
  if (!chainRangeRe.test(chainCard.body)) problems.chain.push('S9-T06 does not name ' + chainRange)
}
// (i) every card has a Starts-from line with backticked paths
for (const c of cards) {
  const m = c.body.match(/^- Starts from \(existing\):(.*)$/m)
  if (!m) { problems.startsFrom.push(c.id + ': no "- Starts from (existing):" line'); continue }
  if (!/`[^`]+`/.test(m[1])) problems.startsFrom.push(c.id + ': "Starts from" has no backticked path')
}
// (j) F-09: every card is in a sprint (or recurring) and no dependency starts in a later sprint
const sprintInfo = parseSprints(plan)
problems.sprintDeps.push(...checkSprintDeps(cards, sprintInfo))
// (k) F-22: card Type must be at least as strong as the strongest Action of the PRD modules it cites
const prdActions = new Map()
for (const f of PRD_FILES) for (const [k, a] of parsePrdActions(docText.get(`${PRD_DIR}/${f}`))) if (!prdActions.has(k)) prdActions.set(k, a)
problems.typeAction.push(...checkTypeAction(cards, prdActions))
const chainFail = Object.values(problems).reduce((n, a) => n + a.length, 0)
const ownedDm = ownRows.filter((r) => r.id.startsWith('DM-')), ownedApi = ownRows.filter((r) => r.id.startsWith('API-'))
const okOwned = (rows) => rows.filter((r) => r.owners.length === 1).length

// ---------- report ----------
let md = `# R1 traceability: PRD ↔ development plan\n\nGenerated by \`node scripts/r1-trace-check.mjs\` — do not edit by hand. Re-run after any change to \`docs/prd/r1/*.md\` or \`${PLAN}\`; CI fails when a PRD module has no task card, a card references an unknown PRD ID, a URS/FR/DM/API id does not resolve, or a DM or Exists-Fix/Missing-Build API has no single owning card.\n\n`
md += `**Summary:** ${prd.size} PRD modules/screens with requirements · ${cards.length} task cards · ${prd.size - uncovered.length} modules covered · **${uncovered.length} uncovered** · **${dangling.length} dangling card references**.\n\n`
md += `**ID chain:** ${ursDefined.size} URS defined (${ursCited.size} distinct ids cited, **${problems.urs.length} unknown**) · ${ursTokens} FR/AC references in URS "Satisfied by" (**${problems.ursRange.length} unresolved**) · ${dmDefined.size} DM and ${apiDefined.size} API ids defined (**${problems.ref.length} unknown DM/API citations**) · ${okOwned(ownedDm)}/${ownedDm.length} DM and ${okOwned(ownedApi)}/${ownedApi.length} Exists-Fix/Missing-Build API owned by exactly one card (**${problems.own.length} ownership defects**) · **${problems.cardLine.length} cards without a valid Data/API line** · **${problems.cardRef.length} card-column mismatches** · **${problems.chain.length} AC-CHAIN ownership defects** (${chainDefined.size} AC-CHAIN defined in 40, all owned by S9-T06 when 0 defects) · **${problems.startsFrom.length} cards without a "Starts from" line** (${cards.length - problems.startsFrom.length}/${cards.length} have one) · **${problems.sprintDeps.length} sprint/dependency defects** · **${problems.typeAction.length} Type-below-Action defects**.\n\n`
md += `| PRD module | File | FR | AC | Task cards |\n|---|---|--:|--:|---|\n`
for (const k of [...prd.keys()].sort((a, b) => sortKey(a).localeCompare(sortKey(b)))) {
  const v = prd.get(k)
  md += `| ${k} | ${v.file} | ${v.fr.size} | ${v.ac.size} | ${(covered.get(k) || ['**NONE**']).join(', ')} |\n`
}
md += `\n## Task cards → PRD modules\n\n| Card | Pri | Title | PRD modules |\n|---|---|---|---|\n`
for (const c of cards) md += `| ${c.id} | ${c.pri} | ${c.title.replace(/\|/g, '/')} | ${[...c.refs].filter((k) => prd.has(k)).sort().join(', ') || '— (plan/ops only)'} |\n`
md += `\n## Data/API ownership (each DM and each Exists-Fix / Missing-Build API has exactly one owning card)\n\n`
md += `The owner is the card whose \`- Data/API:\` line lists the id. Cards that only read or verify an id name it in \`- Also uses:\` (not an ownership claim).\n\n`
md += `### Cards → owned DM and API\n\n| Card | Data/API |\n|---|---|\n`
for (const c of cards) md += `| ${c.id} | ${(c.dataApi ?? '**MISSING**').replace(/\|/g, '/')} |\n`
md += `\n### DM → owning card\n\n| DM | Action (50) | Owner |\n|---|---|---|\n`
for (const r of ownedDm) md += `| ${r.id} | ${r.status} | ${r.owners.join(', ') || '**NONE**'} |\n`
md += `\n### Exists-Fix / Missing-Build API → owning card\n\n| API | Status (60) | Owner |\n|---|---|---|\n`
for (const r of ownedApi) md += `| ${r.id} | ${r.status} | ${r.owners.join(', ') || '**NONE**'} |\n`
const section = (title, list) => (list.length ? `\n## ${title}\n\n${list.map((d) => `- ${d}`).join('\n')}\n` : '')
if (dangling.length) md += `\n## Dangling references (card cites an ID that is not in the PRD)\n\n${dangling.map((d) => `- ${d.card} → ${d.key}`).join('\n')}\n`
if (uncovered.length) md += `\n## Uncovered PRD modules (no task card)\n\n${uncovered.map((k) => `- ${k} (${prd.get(k).file}, ${prd.get(k).fr.size} FR / ${prd.get(k).ac.size} AC)`).join('\n')}\n`
md += section('Unknown URS ids (cited but not in 02-urs)', problems.urs)
md += section('URS FR/AC references that do not resolve to the SRS', problems.ursRange)
md += section('Unknown DM/API ids (cited but not in 50/60)', problems.ref)
md += section('DM / API ownership defects', problems.own)
md += section('Cards without a valid "- Data/API:" line', problems.cardLine)
md += section('Card references in 50/60 that do not match the plan', problems.cardRef)
md += section('AC-CHAIN ownership (40 section X9 to S9-T06)', problems.chain)
md += section('Cards without a "Starts from (existing)" line', problems.startsFrom)
md += section('Sprint order: card in no sprint, unknown card, or dependency in a later sprint (plan 5A; F-09)', problems.sprintDeps)
md += section('Card Type weaker than the Action of a cited PRD module (F-22)', problems.typeAction)
writeFileSync(join(root, OUT), md)

if (!process.argv.includes('--quiet')) {
  console.log(`PRD modules: ${prd.size} | cards: ${cards.length} | uncovered: ${uncovered.length} | dangling: ${dangling.length}`)
  console.log(`URS: ${ursDefined.size} | unknown URS: ${problems.urs.length} | unresolved URS FR/AC: ${problems.ursRange.length} | unknown DM/API: ${problems.ref.length} | DM owned: ${okOwned(ownedDm)}/${ownedDm.length} | API owned: ${okOwned(ownedApi)}/${ownedApi.length} | ownership defects: ${problems.own.length} | cards without Data/API: ${problems.cardLine.length} | card-column mismatches: ${problems.cardRef.length}`)
  console.log(`AC-CHAIN defined in 40: ${chainDefined.size} | AC-CHAIN defects (not owned by S9-T06): ${problems.chain.length} | cards with Starts from: ${cards.length - problems.startsFrom.length}/${cards.length} | Starts-from defects: ${problems.startsFrom.length}`)
  if (uncovered.length) console.log('UNCOVERED:', uncovered.join(' '))
  if (dangling.length) console.log('DANGLING:', dangling.map((d) => `${d.card}->${d.key}`).join(' '))
  for (const [name, list] of Object.entries(problems)) if (list.length) console.log(`${name.toUpperCase()} (${list.length}):\n  ${list.slice(0, 60).join('\n  ')}${list.length > 60 ? `\n  … ${list.length - 60} more (see ${OUT})` : ''}`)
  console.log(`report: ${OUT}`)
}
process.exit(uncovered.length || dangling.length || chainFail ? 1 : 0)
