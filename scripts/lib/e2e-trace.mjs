// Pure parts of the E2E traceability check (`scripts/check-e2e-trace.mjs`, overview §12.2,
// ADR-0011). No file system or process access here, so the unit tests can feed fixtures.

/** An id cell: the id, then an optional suffix such as `` `@provisional` `` (M17). */
export const ID_CELL_RE = /^(E2E-M(\d{2})-(\d+))\b(.*)$/
/** Ids anywhere in a test title. */
export const TITLE_ID_RE = /E2E-M(\d{2})-(\d+)/g
/** The header cell of a provisional column ("Provisional", "Prov."). */
const PROV_HEADER_RE = /^prov(?:\.|isional)?$/i
const SEPARATOR_RE = /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)*\|?\s*$/

/** @typedef {'full' | 'partial' | 'none'} Provisional */
/**
 * @typedef {{ id: string, module: string, file: string, line: number, approved: boolean,
 *   provisional: Provisional }} SrsId
 */
/** @typedef {{ ids: SrsId[], errors: string[], warnings: string[], approved: boolean }} SrsParse */

/**
 * `true` when the header table's Status cell **starts** with "Approved" (optionally bold), so
 * "Not approved", "Draft — … for G1" or "Approved?" wording later in the cell never counts.
 * @param {string} text
 */
export function isApprovedStatus(text) {
  const line = text.split(/\r?\n/).find((l) => /^\|\s*Status\s*\|/.test(l))
  if (!line) return false
  const cell = splitRow(line)[1] ?? ''
  return /^[*_\s]*Approved\b/i.test(cell)
}

/**
 * Splits a Markdown table row into trimmed cells (escaped `\|` stays inside a cell).
 * @param {string} line
 * @returns {string[]}
 */
export function splitRow(line) {
  let s = line.trim()
  if (s.startsWith('|')) s = s.slice(1)
  if (s.endsWith('|') && !s.endsWith('\\|')) s = s.slice(0, -1)
  return s.split(/(?<!\\)\|/).map((c) => c.trim())
}

/**
 * Cell `col` of a row, counting columns after the scenario from the end when the row has a
 * different cell count than its header (an unescaped `|` inside the scenario text).
 * @param {string[]} cells @param {number} col @param {number} headerLength @param {number} scenarioCol
 */
function cellAt(cells, col, headerLength, scenarioCol) {
  if (cells.length === headerLength || col <= scenarioCol) return cells[col] ?? ''
  return cells[cells.length - (headerLength - col)] ?? ''
}

/**
 * Parses the "## 12." section of one SRS.
 *
 * - Tables: a header row is the row right before a `|---|` separator. A header cell "Provisional" or
 *   "Prov." marks the provisional column; "Scenario…" marks the scenario column (default: the 2nd).
 * - A data row whose **first** cell contains `E2E-M` must match {@link ID_CELL_RE}, otherwise it is
 *   an error (S2). Ids of another module in the first cell are cross-references (warning S3).
 * - Provisional level of a row, in this order:
 *   1. an id-cell suffix mentioning provisional (`E2E-M17-05 \`@provisional\``) → `full`;
 *   2. with a provisional column: a cell starting "yes" → `full`; an empty cell or "no…" → `none`;
 *      anything else → `none` with a warning (S4);
 *   3. without the column: a scenario starting with a provisional marker (`**Provisional …**`,
 *      `(provisional …)`) → `full`; "provisional" elsewhere in the row → `partial`; else `none`.
 *
 * @param {string} text  the SRS file content
 * @param {{ file: string, module: string }} meta  `module` is the two-digit module number
 * @returns {SrsParse}
 */
export function parseSrs(text, { file, module }) {
  /** @type {SrsParse} */
  const out = { ids: [], errors: [], warnings: [], approved: isApprovedStatus(text) }
  const lines = text.split(/\r?\n/)
  const start = lines.findIndex((l) => /^## 12\.\s/.test(l))
  if (start < 0) {
    out.warnings.push(`${file}: no "## 12." section`)
    return out
  }
  let end = lines.findIndex((l, i) => i > start && /^## /.test(l))
  if (end < 0) end = lines.length

  /** @type {{ length: number, provCol: number, scenarioCol: number } | null} */
  let table = null
  const seen = new Set()

  for (let i = start + 1; i < end; i++) {
    const line = lines[i]
    if (!line.trimStart().startsWith('|')) {
      table = null
      continue
    }
    if (SEPARATOR_RE.test(line.trim())) continue
    const next = lines[i + 1] ?? ''
    if (SEPARATOR_RE.test(next.trim())) {
      const header = splitRow(line)
      const scenarioCol = header.findIndex((c) => /^scenario/i.test(c))
      table = {
        length: header.length,
        provCol: header.findIndex((c) => PROV_HEADER_RE.test(c)),
        scenarioCol: scenarioCol >= 0 ? scenarioCol : 1,
      }
      continue
    }

    const cells = splitRow(line)
    const first = cells[0] ?? ''
    if (!first.includes('E2E-M')) continue
    const where = `${file}:${i + 1}`
    const match = ID_CELL_RE.exec(first)
    if (!match) {
      out.errors.push(`S2 ${where}: id cell "${first}" does not parse (expected "E2E-Mxx-nn …")`)
      continue
    }
    const [, id, idModule, , suffix] = match
    if (idModule !== module) {
      out.warnings.push(
        `S3 ${where}: ${id} in the id column of M${module}'s SRS is not defined here`,
      )
      continue
    }
    if (seen.has(id)) {
      out.errors.push(`S1 ${where}: ${id} is defined twice in ${file}`)
      continue
    }
    seen.add(id)

    /** @type {Provisional} */
    let provisional = 'none'
    if (/provisional/i.test(suffix)) {
      provisional = 'full'
    } else if (table && table.provCol >= 0) {
      const cell = cellAt(cells, table.provCol, table.length, table.scenarioCol)
      if (/^yes\b/i.test(cell)) provisional = 'full'
      else if (cell !== '' && !/^no\b/i.test(cell)) {
        out.warnings.push(`S4 ${where}: ${id} has an unrecognised provisional cell "${cell}"`)
      }
    } else {
      const scenario = table
        ? cellAt(cells, table.scenarioCol, table.length, table.scenarioCol)
        : (cells[1] ?? '')
      if (/^[*_\s]*\(?\s*provisional\b/i.test(scenario)) provisional = 'full'
      else if (/provisional/i.test(line)) provisional = 'partial'
    }
    out.ids.push({ id, module, file, line: i + 1, approved: out.approved, provisional })
  }
  return out
}

/**
 * @typedef {{ key: string, title: string, file: string, line: number, tags: Set<string>,
 *   provisionalReason: string | null }} TestEntry
 */

/**
 * The traceability rules (see `scripts/check-e2e-trace.mjs`).
 * @param {{ srs: Map<string, SrsId>, tests: TestEntry[], all?: boolean, e2eDir?: string }} input
 */
export function checkTrace({ srs, tests, all = false, e2eDir = 'e2e' }) {
  /** @type {string[]} */
  const errors = []
  /** @type {string[]} */
  const warnings = []
  const where = (/** @type {TestEntry} */ t) => `${e2eDir}/${t.file}:${t.line} "${t.title}"`

  /** @type {Map<string, TestEntry[]>} */
  const byId = new Map()
  for (const test of tests) {
    const ids = [...new Set([...test.title.matchAll(TITLE_ID_RE)].map((m) => m[0]))]
    const tagged = test.tags.has('provisional')
    if (tagged && !test.provisionalReason) {
      errors.push(`P1 ${where(test)} is @provisional without a reason; use provisional(reason)`)
    }
    const rows = []
    for (const id of ids) {
      byId.set(id, [...(byId.get(id) ?? []), test])
      const row = srs.get(id)
      if (!row) {
        errors.push(`T1 ${where(test)} traces ${id}, which no SRS §12 defines`)
        continue
      }
      rows.push(row)
      if (!row.approved) warnings.push(`W2 ${id} (${where(test)}) is defined by a non-approved SRS`)
      if (!test.tags.has(`m${row.module}`)) {
        errors.push(`T4 ${where(test)} traces ${id} but has no @m${row.module} tag`)
      }
      if (row.provisional === 'full' && !tagged) {
        errors.push(
          `P2 ${where(test)}: ${id} is provisional in ${row.file}:${row.line}; tag it @provisional`,
        )
      }
      if (row.provisional === 'partial' && !tagged) {
        warnings.push(
          `W1 ${where(test)}: ${id} is partly provisional (${row.file}:${row.line}); tag it @provisional or keep the provisional steps out of it`,
        )
      }
    }
    if (tagged && rows.length > 0 && rows.every((r) => r.provisional === 'none')) {
      errors.push(
        `P3 ${where(test)} is @provisional, but ${rows.map((r) => r.id).join(', ')} ${rows.length > 1 ? 'are' : 'is'} not provisional in the SRS`,
      )
    }
  }

  for (const [id, list] of byId) {
    if (list.length > 1) {
      errors.push(
        `T2 ${id} is traced by ${list.length} tests:\n    ${list.map(where).join('\n    ')}`,
      )
    }
  }

  // A module has started its traced E2E once one of its ids is traced (developer smoke specs in
  // e2e/<slug>/ carry no ids before G5). `all` (G5) checks every approved module.
  const started = new Set()
  for (const id of byId.keys()) {
    const row = srs.get(id)
    if (row) started.add(row.module)
  }
  let missing = 0
  let notStarted = 0
  for (const row of srs.values()) {
    if (!row.approved || byId.has(row.id)) continue
    if (all || started.has(row.module)) {
      missing++
      errors.push(`T3 ${row.id} (${row.file}:${row.line}) has no test`)
    } else {
      notStarted++
    }
  }

  const traced = [...byId.keys()].filter((id) => srs.has(id)).length
  return { errors, warnings, started, traced, missing, notStarted }
}
