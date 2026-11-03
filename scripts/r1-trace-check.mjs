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
// Writes docs/plan/r1-traceability.md: every PRD module -> its task cards, with FR/AC counts, plus the ID-chain sections.
// Usage: node scripts/r1-trace-check.mjs [--quiet]
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
const cardRe = /^\*\*(S\d+-T\d+)\s+([^*]+)\*\*(.*)$/gm
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
const problems = { urs: [], ursRange: [], ref: [], own: [], cardLine: [], cardRef: [] }

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
  const cited = v.cardsCell.match(/\bS\d+-T\d+\b/g) ?? []
  for (const cid of cited) if (!cardIds.has(cid)) problems.cardRef.push(`${id} → ${cid} (card does not exist)`)
  const o = owners.get(id)
  if (o?.length === 1 && cited.length && !cited.includes(o[0])) problems.cardRef.push(`${id}: owner ${o[0]} is not in the Cards column of ${id.startsWith('DM-') ? '50' : '60'} (${cited.join(', ')})`)
}
const chainFail = Object.values(problems).reduce((n, a) => n + a.length, 0)
const ownedDm = ownRows.filter((r) => r.id.startsWith('DM-')), ownedApi = ownRows.filter((r) => r.id.startsWith('API-'))
const okOwned = (rows) => rows.filter((r) => r.owners.length === 1).length

// ---------- report ----------
let md = `# R1 traceability: PRD ↔ development plan\n\nGenerated by \`node scripts/r1-trace-check.mjs\` — do not edit by hand. Re-run after any change to \`docs/prd/r1/*.md\` or \`${PLAN}\`; CI fails when a PRD module has no task card, a card references an unknown PRD ID, a URS/FR/DM/API id does not resolve, or a DM or Exists-Fix/Missing-Build API has no single owning card.\n\n`
md += `**Summary:** ${prd.size} PRD modules/screens with requirements · ${cards.length} task cards · ${prd.size - uncovered.length} modules covered · **${uncovered.length} uncovered** · **${dangling.length} dangling card references**.\n\n`
md += `**ID chain:** ${ursDefined.size} URS defined (${ursCited.size} distinct ids cited, **${problems.urs.length} unknown**) · ${ursTokens} FR/AC references in URS "Satisfied by" (**${problems.ursRange.length} unresolved**) · ${dmDefined.size} DM and ${apiDefined.size} API ids defined (**${problems.ref.length} unknown DM/API citations**) · ${okOwned(ownedDm)}/${ownedDm.length} DM and ${okOwned(ownedApi)}/${ownedApi.length} Exists-Fix/Missing-Build API owned by exactly one card (**${problems.own.length} ownership defects**) · **${problems.cardLine.length} cards without a valid Data/API line** · **${problems.cardRef.length} card-column mismatches**.\n\n`
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
writeFileSync(join(root, OUT), md)

if (!process.argv.includes('--quiet')) {
  console.log(`PRD modules: ${prd.size} | cards: ${cards.length} | uncovered: ${uncovered.length} | dangling: ${dangling.length}`)
  console.log(`URS: ${ursDefined.size} | unknown URS: ${problems.urs.length} | unresolved URS FR/AC: ${problems.ursRange.length} | unknown DM/API: ${problems.ref.length} | DM owned: ${okOwned(ownedDm)}/${ownedDm.length} | API owned: ${okOwned(ownedApi)}/${ownedApi.length} | ownership defects: ${problems.own.length} | cards without Data/API: ${problems.cardLine.length} | card-column mismatches: ${problems.cardRef.length}`)
  if (uncovered.length) console.log('UNCOVERED:', uncovered.join(' '))
  if (dangling.length) console.log('DANGLING:', dangling.map((d) => `${d.card}->${d.key}`).join(' '))
  for (const [name, list] of Object.entries(problems)) if (list.length) console.log(`${name.toUpperCase()} (${list.length}):\n  ${list.slice(0, 60).join('\n  ')}${list.length > 60 ? `\n  … ${list.length - 60} more (see ${OUT})` : ''}`)
  console.log(`report: ${OUT}`)
}
process.exit(uncovered.length || dangling.length || chainFail ? 1 : 0)
