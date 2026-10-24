/**
 * DSKP catalogue generator (FB-026, DSKP-T01; docs/architecture/v2-dskp-integration.md §3.1,
 * ADR-0022).
 *
 * Reads the 13 structured DSKP extracts and writes the M03 catalogue data files:
 *
 *   docs/reference/dskp/<slug>.json (13 files)
 *     -> src/modules/m03-curriculum/dskp/data/<slug>.json   one tree per subject (`DskpSubjectData`)
 *     -> src/modules/m03-curriculum/dskp/data/index.json    the eager subject index (13 rows)
 *     -> src/modules/m03-curriculum/dskp/data/version.json  { version, sha256 }
 *
 * Rules:
 * - Output is built from a field whitelist (`FIELD_SPECS`). Every field of an extract is either
 *   used or on the reviewed "dropped" list; an unreviewed field fails the build. Panel and
 *   committee text, notes columns, hours, descriptions and the like are never copied (NFR-07).
 * - Codes and text are kept exactly as printed. No text is corrected here: defects are flagged
 *   (`FLAG_TABLE`) and reported, never fixed (a text correction belongs to the extract).
 * - SK is the parent node of an SP, never parsed from its code (Landskap prints SP 1.4.x under
 *   SK 1.3). Print order is kept; codes are never sorted.
 * - Deterministic: no timestamps, no random ids, fixed key order, minified JSON.
 * - `version` is a manual constant (`DSKP_VERSION`). Bump it when the content changes; `--check`
 *   fails when the files drift and the version did not move.
 *
 * Run (Node 22):
 *   node --experimental-strip-types scripts/fixtures/build-m03-dskp.ts            write the files
 *   node --experimental-strip-types scripts/fixtures/build-m03-dskp.ts --check    compare, exit 1 on drift
 */

import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { sortFlags } from '../../src/modules/m03-curriculum/dskp/flags.ts'
import { dskpKey, groupCode } from '../../src/modules/m03-curriculum/dskp/keys.ts'
import {
  DSKP_SUBJECTS,
  type DskpSubjectConfig,
} from '../../src/modules/m03-curriculum/dskp/subjects.ts'
import {
  DSKP_TINGKATAN,
  type DskpCounts,
  type DskpFlag,
  type DskpGroup,
  type DskpSk,
  type DskpSp,
  type DskpSubjectCode,
  type DskpSubjectData,
  type DskpSubjectInfo,
  type DskpTingkatan,
  type DskpUnit,
  type DskpVersionFile,
  type TpDescriptor,
  type TpTable,
  type TpValue,
} from '../../src/modules/m03-curriculum/dskp/types.ts'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
export const SOURCE_DIR = 'docs/reference/dskp'
export const OUTPUT_DIR = 'src/modules/m03-curriculum/dskp/data'

/** Manual constant: bump it whenever the generated content changes (design §3.1). */
export const DSKP_VERSION = 'dskp-2026.10.1'

// ---------------------------------------------------------------------------------------------
// Field whitelist
// ---------------------------------------------------------------------------------------------

export interface FieldSpec {
  /** Fields the generator reads. */
  used: readonly string[]
  /** Fields reviewed and deliberately not copied. */
  dropped: readonly string[]
}

/**
 * Every field that exists in the 13 extracts. A new field is neither used nor dropped until a
 * person reviews it, so the build fails on it. Nothing outside `used` is reachable by the code.
 */
export const FIELD_SPECS = {
  file: {
    used: ['subject', 'edition', 'subjectKind', 'generalPerformanceLevels', 'generalTP', 'units'],
    dropped: [
      'subjectCode',
      'levels',
      'sources',
      'source',
      'structureNote',
      'language',
      'themes',
      'textTypes',
      'grammarT4',
      'grammarT5',
      'manualCorrections',
    ],
  },
  generalLevels: { used: ['levels'], dropped: ['source'] },
  generalInterpretation: { used: ['interpretation', 'descriptors'], dropped: ['note'] },
  unit: {
    used: [
      'level',
      'code',
      'title',
      'bidang',
      'learningArea',
      'theme',
      'tema',
      'electivePackage',
      'standards',
      'tahapPenguasaan',
    ],
    dropped: [
      'titlePrinted',
      'tajuk',
      'focus',
      'objektif',
      'hoursMin',
      'moduleDescription',
      'bidangDescription',
      'tpScope',
      'tpScopeNote',
      'printedCode',
      'note',
    ],
  },
  standard: { used: ['sk', 'skTitle', 'sp', 'tahapPenguasaan'], dropped: ['skDescription'] },
  sp: { used: ['code', 'text', 'citizenship'], dropped: [] },
  tp: { used: ['tp', 'descriptor', 'label', 'appliesToSK'], dropped: ['note'] },
  generalLevelRow: { used: ['tp', 'descriptor'], dropped: [] },
} as const satisfies Record<string, FieldSpec>

// ---------------------------------------------------------------------------------------------
// Source shapes (after the whitelist)
// ---------------------------------------------------------------------------------------------

interface RawTp {
  tp: number | string | null
  descriptor: string
  label?: string
  appliesToSK?: string[]
}
interface RawSp {
  code: string
  text: string
  citizenship?: boolean
}
interface RawStandard {
  sk: string
  skTitle: string
  sp: RawSp[]
  tahapPenguasaan?: RawTp[]
}
interface RawUnit {
  level: string
  code: string
  title: string
  bidang?: string
  learningArea?: string
  theme?: string
  tema?: string
  electivePackage?: string
  standards: RawStandard[]
  tahapPenguasaan?: RawTp[]
}
interface RawFile {
  subject: string
  edition: string | Record<string, string>
  subjectKind?: string
  generalPerformanceLevels?: { levels: { tp: number; descriptor: string }[] }
  generalTP?: { interpretation?: string[]; descriptors?: string[] }
  units: RawUnit[]
}

function fail(message: string): never {
  throw new Error(`build-m03-dskp: ${message}`)
}

function check(condition: boolean, message: string): void {
  if (!condition) fail(message)
}

function pick<T>(obj: unknown, spec: FieldSpec, where: string): T {
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj))
    fail(`${where}: object expected`)
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(obj)) {
    if (spec.used.includes(key)) out[key] = value
    else if (!spec.dropped.includes(key)) {
      fail(`${where}: field "${key}" is neither whitelisted nor reviewed-and-dropped`)
    }
  }
  return out as T
}

// ---------------------------------------------------------------------------------------------
// Flag table (design §2.3): the one reviewed list of flagged nodes, each with its source
// ---------------------------------------------------------------------------------------------

export type FlagTarget =
  | { kind: 'subject' }
  | { kind: 'tingkatan'; tingkatan: DskpTingkatan }
  | {
      kind: 'u' | 'sk' | 'sp'
      tingkatan: DskpTingkatan
      /** Printed code. */
      code: string
    }

export interface FlagEntry {
  subject: DskpSubjectCode
  target: FlagTarget
  flag: DskpFlag
  /** Where the flag comes from. */
  source: string
}

const NOTES1 = 'docs/reference/dskp/_notes-batch1.md line 65'
const NOTES3_MORAL = 'docs/reference/dskp/_notes-batch3.md line 17'
const NOTES3_LNS = 'docs/reference/dskp/_notes-batch3.md line 32-35'
const README = 'docs/reference/dskp/README.md'

function node(
  subject: DskpSubjectCode,
  tingkatan: DskpTingkatan,
  kind: 'u' | 'sk' | 'sp',
  code: string,
  flag: DskpFlag,
  source: string,
): FlagEntry {
  return { subject, target: { kind, tingkatan, code }, flag, source }
}

export const FLAG_TABLE: readonly FlagEntry[] = [
  // perluSemakanEjaan: every Pendidikan Islam node (user decision 2026-10-24; AC-03.2).
  {
    subject: 'PI',
    target: { kind: 'subject' },
    flag: 'perluSemakanEjaan',
    source: `${README} (Jawi words in about 110 SP are image text, not verified); user decision 2026-10-24`,
  },
  // reconstructed: SP rebuilt from interleaved or stacked PDF columns.
  node('SN', 'T4', 'sp', '4.3.1', 'reconstructed', NOTES1),
  node('SN', 'T5', 'sp', '5.5.5', 'reconstructed', `${NOTES1}; sains.json manualCorrections`),
  node('SN', 'T5', 'sp', '5.5.6', 'reconstructed', `${NOTES1}; sains.json manualCorrections`),
  node('SN', 'T5', 'sp', '5.5.7', 'reconstructed', `${NOTES1}; sains.json manualCorrections`),
  node('PM', 'T5', 'sp', '7.1.6', 'reconstructed', NOTES3_MORAL),
  // inferred: the elective package (and so the learning area) is inferred from Table 8.
  node('MTM', 'T4', 'u', '9.0', 'inferred', `${README}; matematik-tambahan.json electivePackage`),
  node('MTM', 'T4', 'u', '10.0', 'inferred', `${README}; matematik-tambahan.json electivePackage`),
  node('MTM', 'T5', 'u', '7.0', 'inferred', `${README}; matematik-tambahan.json electivePackage`),
  node('MTM', 'T5', 'u', '8.0', 'inferred', `${README}; matematik-tambahan.json electivePackage`),
  // tpUnaligned: the PDF merges the TAHAP 1-6 cells, so the statements cannot be set against a level.
  node('LNS', 'T4', 'u', '1.0', 'tpUnaligned', NOTES3_LNS),
  node('LNS', 'T4', 'u', '3.0', 'tpUnaligned', NOTES3_LNS),
  node('LNS', 'T4', 'u', '4.0', 'tpUnaligned', NOTES3_LNS),
  node('LNS', 'T5', 'u', '7.0', 'tpUnaligned', `${NOTES3_LNS} (TP 1-4 printed as one row)`),
  // noStandard: a printed "No learning standard" slot (not selectable).
  node(
    'BI',
    'T4',
    'sp',
    '1.1.4',
    'noStandard',
    'bahasa-inggeris.json: text "No learning standard"',
  ),
  node(
    'BI',
    'T4',
    'sp',
    '2.3.2',
    'noStandard',
    'bahasa-inggeris.json: text "No learning standard"',
  ),
  node(
    'BI',
    'T5',
    'sp',
    '1.1.4',
    'noStandard',
    'bahasa-inggeris.json: text "No learning standard"',
  ),
  node(
    'BI',
    'T5',
    'sp',
    '1.1.5',
    'noStandard',
    'bahasa-inggeris.json: text "No learning standard"',
  ),
  node(
    'BI',
    'T5',
    'sp',
    '2.3.2',
    'noStandard',
    'bahasa-inggeris.json: text "No learning standard"',
  ),
  // draftEdition: the Form 4 cover is printed "DRAF 1/2018".
  {
    subject: 'BI',
    target: { kind: 'tingkatan', tingkatan: 'T4' },
    flag: 'draftEdition',
    source: 'bahasa-inggeris.json edition.T4 (cover "DRAF 1/2018"); _notes-batch2.md line 32',
  },
  // textDefect: found while inspecting the extracts (not named in G1).
  node(
    'SN',
    'T5',
    'sk',
    '4.2',
    'textDefect',
    'sains.json: SK 4.2 title is garbled ("Jg-1 OC-1x water mass(g) x water temperature(OCkJ)g-1")',
  ),
  node(
    'LNS',
    'T4',
    'sp',
    '1.4.4',
    'textDefect',
    'landskap-dan-nurseri.json structureNote: SP 1.4.4 is truncated in the PDF ("... kemalangan dan")',
  ),
  // codeQuirk (informational): printed numbering that does not follow the parent.
  node(
    'LNS',
    'T4',
    'sk',
    '1.3',
    'codeQuirk',
    'landskap-dan-nurseri.json structureNote: SK 1.3 has SP numbered 1.4.1-1.4.5',
  ),
  node(
    'LNS',
    'T5',
    'sk',
    '7.2',
    'codeQuirk',
    'landskap-dan-nurseri.json structureNote: SK 7.2 has SP numbered 7.3.1-7.3.9',
  ),
  node(
    'SN',
    'T5',
    'u',
    '6.0',
    'codeQuirk',
    'sains.json structureNote: Electrochemistry heading printed "7.0", SK/SP numbered 6.x',
  ),
]

/** Units and SK that the DSKP prints with no TP table at all (US-02, AC-02.3). */
const NO_TP: readonly string[] = [
  'BM:T4:u:4.0',
  'BM:T4:u:5.0',
  'BM:T5:u:4.0',
  'BM:T5:u:5.0',
  'BI:T4:u:5.0',
  'BI:T5:u:5.0',
]

// ---------------------------------------------------------------------------------------------
// Per-subject normalisation map (design §2.5)
// ---------------------------------------------------------------------------------------------

type GroupField = 'bidang' | 'learningArea' | 'theme'

/** Unit field that holds the grouping above the unit, where the DSKP prints a real one. */
const GROUP_FIELD: Readonly<Partial<Record<DskpSubjectCode, GroupField>>> = {
  MAT: 'bidang',
  MTM: 'learningArea',
  FIZ: 'theme',
  SN: 'theme',
  SEJ: 'theme',
  PM: 'bidang',
  PSV: 'bidang',
}

/** Pendidikan Moral prints the bidang as "5.0 INSAN BERMORAL": code and title. */
const GROUP_WITH_CODE: readonly DskpSubjectCode[] = ['PM']

// ---------------------------------------------------------------------------------------------
// Defect scan: finds garbled titles and truncated text, which must all be in the flag table
// ---------------------------------------------------------------------------------------------

const TRAILING_WORD =
  /\b(dan|atau|yang|serta|and|or|of|the|to|in|for|with|by|a|an|di|ke|dengan|bagi|untuk|pada|dalam|kepada|daripada|from|on|as|at|that|which)\s*$/i
const GARBLED_TITLE = /\b\w*\d\w*[A-Za-z]\w*\b/
const ARABIC = /\p{Script=Arabic}/u

/** Truncated text (ends on a joining word) in a Latin-script SP; garbled unit or SK title. */
export function textDefects(kind: 'u' | 'sk' | 'sp', text: string): string[] {
  const out: string[] = []
  const s = text.trim()
  if (kind === 'sp') {
    if (!ARABIC.test(s) && TRAILING_WORD.test(s)) out.push('truncated')
  } else if (!/^\d/.test(s) && GARBLED_TITLE.test(s)) {
    out.push('garbled')
  }
  return out
}

// ---------------------------------------------------------------------------------------------
// Transform
// ---------------------------------------------------------------------------------------------

export interface SubjectReport {
  code: DskpSubjectCode
  counts: Record<DskpTingkatan, DskpCounts>
  flagged: string[]
  noTp: string[]
}

export interface BuildReport {
  subjects: SubjectReport[]
  totals: { units: number; sk: number; sp: number; slots: number; t4: number; t5: number }
}

function toTpValue(tp: number, where: string): TpValue {
  check(Number.isInteger(tp) && tp >= 1 && tp <= 6, `${where}: TP ${String(tp)} is not 1-6`)
  return tp as TpValue
}

function rowOf(raw: RawTp, where: string): TpDescriptor {
  check(typeof raw.descriptor === 'string' && raw.descriptor !== '', `${where}: empty TP text`)
  let tp: TpValue | null = null
  let range: [number, number] | undefined
  if (typeof raw.tp === 'number') tp = toTpValue(raw.tp, where)
  else if (typeof raw.tp === 'string') {
    const m = /^(\d)-(\d)$/.exec(raw.tp)
    if (!m) fail(`${where}: TP "${raw.tp}" is not a number or a range`)
    range = [Number(m[1]), Number(m[2])]
  } else check(raw.tp === null, `${where}: TP value missing`)
  // Fixed key order: tp, range, label, text.
  const row: TpDescriptor = { tp, text: raw.descriptor }
  const ordered: Record<string, unknown> = { tp }
  if (range) ordered['range'] = range
  if (raw.label !== undefined) ordered['label'] = raw.label
  ordered['text'] = row.text
  return ordered as unknown as TpDescriptor
}

/** Splits rows into tables by `appliesToSK` (Katering Modul 1.0); one table everywhere else. */
function tablesOf(rows: RawTp[] | undefined, where: string): TpTable[] | undefined {
  if (!rows || rows.length === 0) return undefined
  const groups = new Map<string, { appliesTo: string[] | undefined; rows: TpDescriptor[] }>()
  for (const raw of rows) {
    const key = raw.appliesToSK ? raw.appliesToSK.join('|') : ''
    let g = groups.get(key)
    if (!g) {
      g = { appliesTo: raw.appliesToSK ? [...raw.appliesToSK] : undefined, rows: [] }
      groups.set(key, g)
    }
    g.rows.push(rowOf(raw, where))
  }
  if (groups.size > 1) {
    check(
      [...groups.values()].every((g) => g.appliesTo !== undefined),
      `${where}: a TP table without appliesToSK next to tables with it`,
    )
  }
  return [...groups.values()].map((g) => {
    const table: TpTable = g.appliesTo
      ? { appliesToSk: g.appliesTo, rows: g.rows }
      : { rows: g.rows }
    return table
  })
}

function isAligned(tables: readonly TpTable[]): boolean {
  return tables.every(
    (t) => t.rows.length === 6 && t.rows.every((r, i) => r.tp === i + 1 && !r.range),
  )
}

function generalTpOf(raw: RawFile, where: string): TpDescriptor[] | null {
  let texts: string[] | null = null
  if (raw.generalPerformanceLevels) {
    const lv = pick<{ levels: { tp: number; descriptor: string }[] }>(
      raw.generalPerformanceLevels,
      FIELD_SPECS.generalLevels,
      `${where} generalPerformanceLevels`,
    ).levels
    lv.forEach((r, i) => {
      const row = pick<{ tp: number; descriptor: string }>(
        r,
        FIELD_SPECS.generalLevelRow,
        `${where} generalPerformanceLevels[${String(i)}]`,
      )
      check(row.tp === i + 1, `${where}: general TP row ${String(i)} has TP ${String(row.tp)}`)
    })
    texts = lv.map((r) => r.descriptor)
  } else if (raw.generalTP) {
    const g = pick<{ interpretation?: string[]; descriptors?: string[] }>(
      raw.generalTP,
      FIELD_SPECS.generalInterpretation,
      `${where} generalTP`,
    )
    texts = g.interpretation ?? g.descriptors ?? null
  }
  if (!texts) return null
  check(texts.length === 6, `${where}: general TP has ${String(texts.length)} rows`)
  return texts.map((text, i) => {
    check(typeof text === 'string' && text !== '', `${where}: empty general TP ${String(i + 1)}`)
    return { tp: toTpValue(i + 1, where), text }
  })
}

function editionOf(raw: RawFile, where: string): Record<DskpTingkatan, string> {
  if (typeof raw.edition === 'string') return { T4: raw.edition, T5: raw.edition }
  const t4 = raw.edition['T4']
  const t5 = raw.edition['T5']
  check(typeof t4 === 'string' && typeof t5 === 'string', `${where}: edition per tingkatan missing`)
  return { T4: t4 as string, T5: t5 as string }
}

/** Flag lookup: key -> flags, plus subject-wide and tingkatan-wide flags. */
interface FlagIndex {
  node: Map<string, DskpFlag[]>
  subject: DskpFlag[]
  tingkatan: Partial<Record<DskpTingkatan, DskpFlag[]>>
  used: Set<string>
}

function flagIndexOf(code: DskpSubjectCode): FlagIndex {
  const idx: FlagIndex = { node: new Map(), subject: [], tingkatan: {}, used: new Set() }
  for (const e of FLAG_TABLE) {
    if (e.subject !== code) continue
    if (e.target.kind === 'subject') idx.subject.push(e.flag)
    else if (e.target.kind === 'tingkatan') {
      const list = idx.tingkatan[e.target.tingkatan] ?? []
      list.push(e.flag)
      idx.tingkatan[e.target.tingkatan] = list
    } else {
      const key = dskpKey(code, e.target.tingkatan, e.target.kind, e.target.code)
      const list = idx.node.get(key) ?? []
      list.push(e.flag)
      idx.node.set(key, list)
    }
  }
  return idx
}

function flagsOf(key: string, idx: FlagIndex): DskpFlag[] | undefined {
  const list = idx.node.get(key)
  if (!list) return undefined
  idx.used.add(key)
  return sortFlags(list)
}

export function buildSubject(
  cfg: DskpSubjectConfig,
  rawFile: unknown,
): { data: DskpSubjectData; info: DskpSubjectInfo; report: SubjectReport } {
  const where = cfg.slug
  const file = pick<RawFile>(rawFile, FIELD_SPECS.file, where)
  check(
    file.subject.startsWith(cfg.name),
    `${where}: subject "${file.subject}" is not "${cfg.name}"`,
  )
  check(
    (file.subjectKind !== undefined) === (cfg.kind === 'vocational'),
    `${where}: subjectKind does not match the configured kind`,
  )

  const idx = flagIndexOf(cfg.code)
  const groupField = GROUP_FIELD[cfg.code]
  const groups: DskpGroup[] = []
  const groupIndex = new Map<string, number>()
  const units: DskpUnit[] = []
  const seen = new Set<string>()
  const claim = (key: string): void => {
    check(!seen.has(key), `${where}: duplicate key ${key}`)
    seen.add(key)
  }
  const detected = {
    slots: new Set<string>(),
    defects: new Set<string>(),
    unaligned: new Set<string>(),
  }
  const noTp: string[] = []
  const counts = {} as Record<DskpTingkatan, DskpCounts>

  const sourceUnits = file.units.map((u, i) =>
    pick<RawUnit>(u, FIELD_SPECS.unit, `${where} unit ${String(i)}`),
  )
  check(
    sourceUnits.every((u) => u.level === 'T4' || u.level === 'T5'),
    `${where}: a unit is neither T4 nor T5`,
  )

  for (const tingkatan of DSKP_TINGKATAN) {
    const c: DskpCounts = { units: 0, sk: 0, sp: 0, slots: 0 }
    counts[tingkatan] = c
    for (const rawUnit of sourceUnits.filter((u) => u.level === tingkatan)) {
      const uWhere = `${where} ${tingkatan} unit ${rawUnit.code}`
      const unitKey = dskpKey(cfg.code, tingkatan, 'u', rawUnit.code)
      claim(unitKey)
      c.units++

      let group: number | undefined
      if (groupField) {
        const printed = rawUnit[groupField]
        check(typeof printed === 'string' && printed !== '', `${uWhere}: no ${groupField}`)
        const g: DskpGroup = { tingkatan, title: printed as string }
        let gcode: string | undefined
        if (GROUP_WITH_CODE.includes(cfg.code)) {
          const m = /^(\d+\.\d+) (.+)$/.exec(printed as string)
          check(m !== null, `${uWhere}: bidang "${String(printed)}" has no code`)
          gcode = (m as RegExpExecArray)[1] as string
          g.title = (m as RegExpExecArray)[2] as string
        }
        const gkey = `${tingkatan}|${gcode ?? ''}|${g.title}`
        let at = groupIndex.get(gkey)
        if (at === undefined) {
          claim(dskpKey(cfg.code, tingkatan, 'g', groupCode(g.title)))
          at = groups.length
          groupIndex.set(gkey, at)
          groups.push(
            gcode ? { tingkatan, code: gcode, title: g.title } : { tingkatan, title: g.title },
          )
        }
        group = at
      }

      // Fixed key order: tingkatan, code, title, group, pkg, flags, tp, sks.
      const unit: Record<string, unknown> = { tingkatan, code: rawUnit.code, title: rawUnit.title }
      if (group !== undefined) unit['group'] = group
      if (rawUnit.electivePackage !== undefined) unit['pkg'] = rawUnit.electivePackage
      const unitFlags = flagsOf(unitKey, idx)
      if (unitFlags) unit['flags'] = unitFlags
      if (textDefects('u', rawUnit.title).length > 0) detected.defects.add(unitKey)

      const unitTp = tablesOf(rawUnit.tahapPenguasaan, uWhere)
      if (cfg.tpLevel === 'unit') {
        if (unitTp) {
          unit['tp'] = unitTp
          if (!isAligned(unitTp)) detected.unaligned.add(unitKey)
        } else noTp.push(unitKey)
      } else check(!unitTp, `${uWhere}: unit-level TP in a subject with TP per SK`)

      const sks: DskpSk[] = []
      for (const rawStd of rawUnit.standards.map((s, i) =>
        pick<RawStandard>(s, FIELD_SPECS.standard, `${uWhere} standard ${String(i)}`),
      )) {
        const sWhere = `${uWhere} SK ${rawStd.sk}`
        const skKey = dskpKey(cfg.code, tingkatan, 'sk', rawStd.sk)
        claim(skKey)
        c.sk++
        const sk: Record<string, unknown> = { code: rawStd.sk, title: rawStd.skTitle }
        const skFlags = flagsOf(skKey, idx)
        if (skFlags) sk['flags'] = skFlags
        if (textDefects('sk', rawStd.skTitle).length > 0) detected.defects.add(skKey)
        const skTp = tablesOf(rawStd.tahapPenguasaan, sWhere)
        if (cfg.tpLevel === 'sk') {
          if (skTp) {
            sk['tp'] = skTp
            if (!isAligned(skTp)) detected.unaligned.add(skKey)
          } else noTp.push(skKey)
        } else check(!skTp, `${sWhere}: SK-level TP in a subject with TP per unit`)

        const sps: DskpSp[] = []
        for (const rawSp of rawStd.sp.map((p, i) =>
          pick<RawSp>(p, FIELD_SPECS.sp, `${sWhere} SP ${String(i)}`),
        )) {
          const spKey = dskpKey(cfg.code, tingkatan, 'sp', rawSp.code)
          claim(spKey)
          check(
            typeof rawSp.text === 'string' && rawSp.text.trim() !== '',
            `${sWhere} SP ${rawSp.code}: empty text`,
          )
          const sp: Record<string, unknown> = { code: rawSp.code, text: rawSp.text }
          if (rawSp.citizenship !== undefined) {
            check(rawSp.citizenship === true, `${sWhere} SP ${rawSp.code}: citizenship is not true`)
            sp['citizenship'] = true
          }
          check(
            (cfg.code === 'SEJ' && /^K/.test(rawSp.code)) === (rawSp.citizenship === true),
            `${sWhere} SP ${rawSp.code}: K prefix and citizenship disagree`,
          )
          const spFlags = flagsOf(spKey, idx)
          if (spFlags) sp['flags'] = spFlags
          if (/^no learning standard\.?$/i.test(rawSp.text.trim())) detected.slots.add(spKey)
          else if (textDefects('sp', rawSp.text).length > 0) detected.defects.add(spKey)
          if (spFlags?.includes('noStandard')) c.slots++
          else c.sp++
          sps.push(sp as unknown as DskpSp)
        }
        check(sps.length > 0, `${sWhere}: no SP`)
        sk['sps'] = sps
        sks.push(sk as unknown as DskpSk)
      }
      check(sks.length > 0, `${uWhere}: no SK`)
      unit['sks'] = sks
      units.push(unit as unknown as DskpUnit)
    }
  }
  check(
    units.length === sourceUnits.length,
    `${where}: ${String(sourceUnits.length - units.length)} unit(s) lost`,
  )

  // Cross-checks between the data and the flag table.
  for (const key of idx.node.keys())
    check(idx.used.has(key), `${where}: flag table node ${key} does not exist`)
  const withFlag = (flag: DskpFlag): Set<string> =>
    new Set([...idx.node].filter(([, list]) => list.includes(flag)).map(([key]) => key))
  const same = (a: Set<string>, b: Set<string>): boolean =>
    a.size === b.size && [...a].every((k) => b.has(k))
  check(
    same(detected.slots, withFlag('noStandard')),
    `${where}: "No learning standard" slots [${[...detected.slots].join(', ')}] differ from the noStandard flags`,
  )
  check(
    same(detected.defects, withFlag('textDefect')),
    `${where}: defect scan [${[...detected.defects].join(', ')}] differs from the textDefect flags [${[...withFlag('textDefect')].join(', ')}]`,
  )
  check(
    same(detected.unaligned, withFlag('tpUnaligned')),
    `${where}: unaligned TP tables [${[...detected.unaligned].join(', ')}] differ from the tpUnaligned flags`,
  )
  for (const key of noTp) {
    check(NO_TP.includes(key), `${where}: ${key} has no TP and is not a documented exception`)
  }
  for (const key of NO_TP) {
    if (key.startsWith(`${cfg.code}:`))
      check(noTp.includes(key), `${where}: ${key} unexpectedly has TP`)
  }

  const data: DskpSubjectData = {
    code: cfg.code,
    groups,
    units,
    generalTp: generalTpOf(file, where),
  }
  const info: DskpSubjectInfo = {
    code: cfg.code,
    slug: cfg.slug,
    name: cfg.name,
    language: cfg.language,
    kind: cfg.kind,
    ...(cfg.groupNoun ? { groupNoun: cfg.groupNoun } : {}),
    unitNoun: cfg.unitNoun,
    tpLevel: cfg.tpLevel,
    rtlFields: [...cfg.rtlFields],
    m03SubjectCode: cfg.m03SubjectCode,
    edition: editionOf(file, where),
    counts,
  }
  if (idx.subject.length > 0) info.flags = sortFlags(idx.subject)
  const tFlags = Object.fromEntries(
    DSKP_TINGKATAN.filter((t) => idx.tingkatan[t]).map((t) => [
      t,
      sortFlags(idx.tingkatan[t] ?? []),
    ]),
  ) as Partial<Record<DskpTingkatan, DskpFlag[]>>
  if (Object.keys(tFlags).length > 0) info.tingkatanFlags = tFlags

  return {
    data,
    info,
    report: {
      code: cfg.code,
      counts,
      flagged: [...idx.node].map(([key, list]) => `${key} ${list.join('+')}`),
      noTp,
    },
  }
}

export interface BuildResult {
  /** Relative path (from the repo root) -> file content. */
  files: Record<string, string>
  report: BuildReport
}

function json(value: unknown): string {
  return `${JSON.stringify(value)}\n`
}

/** The expected totals of `docs/reference/dskp/README.md` (design §2.1). */
const GOLDEN = { units: 171, sk: 528, sp: 2057, slots: 5, t4: 1130, t5: 927 }

export function buildDskp(readSource: (slug: string) => unknown): BuildResult {
  const files: Record<string, string> = {}
  const infos: DskpSubjectInfo[] = []
  const reports: SubjectReport[] = []
  for (const cfg of DSKP_SUBJECTS) {
    const { data, info, report } = buildSubject(cfg, readSource(cfg.slug))
    files[`${OUTPUT_DIR}/${cfg.slug}.json`] = json(data)
    infos.push(info)
    reports.push(report)
  }
  files[`${OUTPUT_DIR}/index.json`] = json(infos)

  const totals = { units: 0, sk: 0, sp: 0, slots: 0, t4: 0, t5: 0 }
  for (const r of reports) {
    for (const t of DSKP_TINGKATAN) {
      const c = r.counts[t]
      totals.units += c.units
      totals.sk += c.sk
      totals.sp += c.sp
      totals.slots += c.slots
      if (t === 'T4') totals.t4 += c.sp
      else totals.t5 += c.sp
    }
  }
  for (const [what, expected] of Object.entries(GOLDEN)) {
    const actual = totals[what as keyof typeof totals]
    check(actual === expected, `total ${what}: ${String(actual)}, expected ${String(expected)}`)
  }

  const hash = createHash('sha256')
  for (const path of Object.keys(files)) hash.update(`${path}\n${files[path]}\n`)
  const version: DskpVersionFile = { version: DSKP_VERSION, sha256: hash.digest('hex') }
  files[`${OUTPUT_DIR}/version.json`] = json(version)
  return { files, report: { subjects: reports, totals } }
}

// ---------------------------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------------------------

export function readSourceFromRepo(slug: string): unknown {
  return JSON.parse(readFileSync(resolve(ROOT, SOURCE_DIR, `${slug}.json`), 'utf8')) as unknown
}

function readCommitted(path: string): string | null {
  try {
    return readFileSync(resolve(ROOT, path), 'utf8')
  } catch {
    return null
  }
}

function printReport(report: BuildReport): void {
  for (const r of report.subjects) {
    const t4 = r.counts.T4
    const t5 = r.counts.T5
    console.log(
      `${r.code.padEnd(3)} units ${String(t4.units + t5.units).padStart(2)}  SK ${String(t4.sk + t5.sk).padStart(3)}  SP T4 ${String(t4.sp).padStart(3)} T5 ${String(t5.sp).padStart(3)}` +
        (t4.slots + t5.slots > 0 ? `  slots ${String(t4.slots + t5.slots)}` : ''),
    )
  }
  const t = report.totals
  console.log(
    `total: ${String(t.units)} units, ${String(t.sk)} SK, ${String(t.sp)} selectable SP (T4 ${String(t.t4)}, T5 ${String(t.t5)}) + ${String(t.slots)} slots`,
  )
  const flagged = report.subjects.flatMap((r) => r.flagged)
  console.log(`flagged nodes (${String(flagged.length)}):`)
  for (const f of flagged) console.log(`  ${f}`)
  const noTp = report.subjects.flatMap((r) => r.noTp)
  console.log(`nodes with no TP table (${String(noTp.length)}): ${noTp.join(', ')}`)
}

function main(): void {
  const checkOnly = process.argv.includes('--check')
  const { files, report } = buildDskp(readSourceFromRepo)
  printReport(report)

  if (checkOnly) {
    const drift = Object.entries(files).filter(([path, content]) => readCommitted(path) !== content)
    if (drift.length === 0) {
      console.log(`dskp:check ok: ${String(Object.keys(files).length)} files match`)
      return
    }
    console.error(
      `dskp:check FAILED: ${String(drift.length)} file(s) differ from the generator output:`,
    )
    for (const [path] of drift) console.error(`  ${path}`)
    const committed = readCommitted(`${OUTPUT_DIR}/version.json`)
    const committedVersion = committed ? (JSON.parse(committed) as DskpVersionFile).version : null
    if (committedVersion === DSKP_VERSION) {
      console.error(
        `the content changed but DSKP_VERSION is still "${DSKP_VERSION}": bump it in ${'scripts/fixtures/build-m03-dskp.ts'} and regenerate`,
      )
    } else {
      console.error(
        'regenerate: node --experimental-strip-types scripts/fixtures/build-m03-dskp.ts',
      )
    }
    process.exit(1)
  }

  mkdirSync(resolve(ROOT, OUTPUT_DIR), { recursive: true })
  const before = readCommitted(`${OUTPUT_DIR}/version.json`)
  for (const [path, content] of Object.entries(files))
    writeFileSync(resolve(ROOT, path), content, 'utf8')
  console.log(`wrote ${String(Object.keys(files).length)} files to ${OUTPUT_DIR}`)
  if (before) {
    const old = JSON.parse(before) as DskpVersionFile
    const next = JSON.parse(files[`${OUTPUT_DIR}/version.json`] as string) as DskpVersionFile
    if (old.sha256 !== next.sha256 && old.version === next.version) {
      console.warn(
        `warning: content changed but the version is still "${next.version}"; bump DSKP_VERSION`,
      )
    }
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main()
