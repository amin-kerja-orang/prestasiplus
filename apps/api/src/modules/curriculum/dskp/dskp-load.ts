/**
 * DSKP loader (R1-B04): writes the parsed DSKP extracts into `curriculum_nodes` and
 * `curriculum_tp_descriptors`. One code path for the dev seed (`prisma/seed/curriculum.ts`) and the
 * ops script (`npm run dskp:load`, see `docs/ops/dskp-loader.md`).
 *
 * Rules (plan 13.8a):
 * - Insert-only and idempotent: nodes are matched by (subject, level, edition, kind, code) and only the
 *   missing ones are inserted; an existing node is never updated or deleted (an admin edit survives,
 *   a new edition adds nodes beside the old ones). A second run inserts 0. `updated` is therefore always
 *   0; a node whose printed text differs from the packaged file is counted as `drift` and left alone.
 * - One transaction per subject: a subject loads fully or not at all; a failing subject never stops the others.
 * - Tingkatan 1 to 5 only: a unit of any other level (Darjah) is ignored and listed. A TP row without a
 *   number is skipped, counted and listed. Printed text is kept as is.
 * - The source files live in `./data/` (a copy of `docs/reference/dskp`, so the API image contains them;
 *   a test fails when the copy drifts). A new file in the same format (for example T1 to T3) is picked up
 *   without a code change: its subject is found by the extract's `subject` name.
 */
import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import type { PrismaClient } from '../../../db/client'
import { DSKP_REASONS_MS, parseDskpExtract, type DskpExtract, type DskpRejected } from './dskp-loader'

export const DSKP_DATA_DIR = new URL('./data/', import.meta.url)
/** Rows per `createMany` (the pg driver allows 65,535 bind parameters per statement). */
const BATCH = 1000

/** The 13 packaged extracts and the subject code each belongs to. */
export const DSKP_FILES: readonly { file: string; subject: string }[] = [
  { file: 'bahasa-melayu.json', subject: 'BM' },
  { file: 'bahasa-inggeris.json', subject: 'BI' },
  { file: 'matematik.json', subject: 'MATH' },
  { file: 'matematik-tambahan.json', subject: 'ADDMATH' },
  { file: 'fizik.json', subject: 'PHY' },
  { file: 'sains.json', subject: 'SCI' },
  { file: 'sejarah.json', subject: 'SEJ' },
  { file: 'pendidikan-islam.json', subject: 'PI' },
  { file: 'tasawwur-islam.json', subject: 'TI' },
  { file: 'pendidikan-moral.json', subject: 'PM' },
  { file: 'pendidikan-seni-visual.json', subject: 'PSV' },
  { file: 'landskap-dan-nurseri.json', subject: 'LNR' },
  { file: 'katering-dan-penyajian.json', subject: 'KNP' },
]

/**
 * Two practical (MPV) subjects have no row in the observed subject list; the dev seed adds them as
 * inactive subjects with no level link so that the node tree has a subject to hang on (BE-08).
 */
export const DSKP_ONLY_SUBJECTS = [
  { code: 'LNR', name: 'Landskap dan Nurseri', nameEn: 'Landscape and Nursery', icon: null, color: '#16A34A', isCore: false, order: 32, isActive: false },
  { code: 'KNP', name: 'Katering dan Penyajian', nameEn: 'Catering and Serving', icon: null, color: '#F97316', isCore: false, order: 33, isActive: false },
] as const

/** Known limits of the extracts (README and audit 2026-10-16), printed with the subject so nobody tags on exact wording. */
export const DSKP_KNOWN_LIMITS: Readonly<Record<string, string>> = {
  'matematik.json': 'maths symbols printed as images are missing from some SP text; tagging must not rely on exact wording',
  'matematik-tambahan.json': 'formulas printed as images are missing from some SP text; four units carry an elective package whose learning area is inferred from Table 8',
  'fizik.json': 'formulas printed as images are missing from some SP text; tagging must not rely on exact wording',
  'sains.json': 'Tingkatan 4 SP 4.3.1 is a reconstruction (marked in the extract)',
  'pendidikan-islam.json': 'image-only Jawi words in about 110 SPs are not independently verified',
  'bahasa-melayu.json': 'units 4.0 and 5.0 have no TP rows (kept as nodes without TP)',
  'landskap-dan-nurseri.json': 'some TP rows are not aligned to their node (marked in the extract); a printed range such as 1-4 is not stored',
}

export interface DskpSource {
  file: string
  /** sha256 of the file content with line endings normalised to LF. */
  sha256: string
  /** From `DSKP_FILES`, else null (the subject is then found by the extract's name). */
  subjectCode: string | null
  extract: DskpExtract | null
  /** Why the file could not be read or parsed; the subject it belongs to is then not written. */
  error: string | null
}

export const hashText = (text: string): string => createHash('sha256').update(text.replace(/\r\n/g, '\n')).digest('hex')

/** Reads and parses every `*.json` in a folder (default: the packaged data). Never throws on a bad file. */
export function readDskpSources(dir: URL | string = DSKP_DATA_DIR): DskpSource[] {
  const base = typeof dir === 'string' ? dir : fileURLToPath(dir)
  const files = readdirSync(base).filter((f) => f.endsWith('.json')).sort()
  return files.map((file): DskpSource => {
    const subjectCode = DSKP_FILES.find((f) => f.file === file)?.subject ?? null
    let text: string
    try {
      text = readFileSync(`${base.replace(/[\\/]$/, '')}/${file}`, 'utf8')
    } catch (e) {
      return { file, sha256: '', subjectCode, extract: null, error: `cannot read file: ${(e as Error).message}` }
    }
    const sha256 = hashText(text)
    try {
      return { file, sha256, subjectCode, extract: parseDskpExtract(JSON.parse(text)), error: null }
    } catch (e) {
      return { file, sha256, subjectCode, extract: null, error: `not a valid DSKP extract: ${(e as Error).message.split('\n')[0]}` }
    }
  })
}

type Db = Pick<PrismaClient, 'curriculumNode' | 'curriculumTpDescriptor'>

export interface NodeCounts {
  inserted: number
  /** Always 0: existing nodes are never updated (insert-only). */
  updated: number
  unchanged: number
  /** Existing nodes whose printed title differs from the packaged file; left as they are. */
  drift: number
}
export interface TpCounts {
  inserted: number
  unchanged: number
}
export interface LevelReport {
  /** `T4`, `T5`, ... or `general` for the subject's general performance levels. */
  level: string
  nodes: NodeCounts
  tps: TpCounts
}

const chunks = <T>(rows: T[], size = BATCH): T[][] => {
  const out: T[][] = []
  for (let i = 0; i < rows.length; i += size) out.push(rows.slice(i, i + size))
  return out
}

const KINDS = ['grouping', 'unit', 'sk', 'sp'] as const

/**
 * Writes (or, with `dryRun`, only counts) one extract for one subject. Call it inside a transaction.
 * `levels` maps a level code to its id; a level used by the extract but missing from it throws.
 */
export async function applyDskpExtract(
  db: Db,
  args: { subjectId: bigint; extract: DskpExtract; levels: ReadonlyMap<string, bigint>; now: Date; dryRun: boolean },
): Promise<LevelReport[]> {
  const { subjectId, extract, levels, now, dryRun } = args
  const reports = new Map<string, LevelReport>()
  const rep = (level: string): LevelReport => {
    let r = reports.get(level)
    if (!r) {
      r = { level, nodes: { inserted: 0, updated: 0, unchanged: 0, drift: 0 }, tps: { inserted: 0, unchanged: 0 } }
      reports.set(level, r)
    }
    return r
  }
  const editions = new Map<string, string>() // level -> edition
  for (const n of extract.nodes) editions.set(n.level, n.edition)
  for (const level of editions.keys()) {
    if (!levels.has(level)) throw new Error(`education level "${level}" is not in education_levels (load the base curriculum first)`)
  }
  const levelCode = new Map([...levels.entries()].map(([code, id]) => [id, code]))

  const ids = new Map<string, bigint>() // draft key -> id
  const titles = new Map<string, { title: string; titlePrinted: string | null }>()
  const refresh = async (kind?: (typeof KINDS)[number]) => {
    const rows = await db.curriculumNode.findMany({
      where: kind ? { subjectId, kind } : { subjectId },
      select: { id: true, educationLevelId: true, edition: true, kind: true, code: true, title: true, titlePrinted: true },
    })
    for (const r of rows) {
      const lc = levelCode.get(r.educationLevelId)
      if (lc === undefined || editions.get(lc) !== r.edition) continue
      const key = `${lc}|${r.kind}|${r.code}`
      ids.set(key, r.id)
      titles.set(key, { title: r.title, titlePrinted: r.titlePrinted })
    }
  }
  await refresh()
  const existingBefore = new Set(ids.keys())

  for (const n of extract.nodes) {
    if (!existingBefore.has(n.key)) continue
    const r = rep(n.level)
    r.nodes.unchanged += 1
    const had = titles.get(n.key)
    if (had && (had.title !== n.title || had.titlePrinted !== n.titlePrinted)) r.nodes.drift += 1
  }

  for (const kind of KINDS) {
    const fresh = extract.nodes.filter((n) => n.kind === kind && !existingBefore.has(n.key))
    if (fresh.length === 0) continue
    if (dryRun) {
      for (const n of fresh) rep(n.level).nodes.inserted += 1
      continue
    }
    for (const batch of chunks(fresh)) {
      const res = await db.curriculumNode.createMany({
        data: batch.map((n) => ({
          subjectId,
          educationLevelId: levels.get(n.level) as bigint,
          kind: n.kind,
          code: n.code,
          title: n.title,
          titlePrinted: n.titlePrinted,
          parentId: n.parentKey === null ? null : (ids.get(n.parentKey) as bigint),
          sortOrder: n.order,
          edition: n.edition,
          isElective: n.isElective,
          createdAt: now,
          updatedAt: now,
        })),
        skipDuplicates: true,
      })
      // A concurrent run may have inserted some of them first; count what this run wrote.
      const perLevel = new Map<string, number>()
      for (const n of batch) perLevel.set(n.level, (perLevel.get(n.level) ?? 0) + 1)
      let remaining = res.count
      for (const [level, n] of perLevel) {
        const take = Math.min(n, remaining)
        rep(level).nodes.inserted += take
        rep(level).nodes.unchanged += n - take
        remaining -= take
      }
    }
    await refresh(kind)
  }

  // TP descriptors: unique (subject, coalesce(node, 0), tp), so a re-run is a no-op.
  const haveTp = new Set(
    (await db.curriculumTpDescriptor.findMany({ where: { subjectId }, select: { nodeId: true, tp: true } })).map((t) => `${t.nodeId ?? 0}#${t.tp}`),
  )
  const freshTps: { subjectId: bigint; nodeId: bigint | null; tp: number; descriptor: string; scope: string | null; createdAt: Date }[] = []
  for (const t of extract.tps) {
    const level = t.nodeKey === null ? 'general' : (t.nodeKey.split('|')[0] as string)
    const nodeId = t.nodeKey === null ? null : ids.get(t.nodeKey)
    if (nodeId !== undefined && haveTp.has(`${nodeId ?? 0}#${t.tp}`)) {
      rep(level).tps.unchanged += 1
      continue
    }
    if (dryRun) {
      rep(level).tps.inserted += 1
      continue
    }
    if (nodeId === undefined) throw new Error(`internal: node ${t.nodeKey} has no id after insert`)
    freshTps.push({ subjectId, nodeId, tp: t.tp, descriptor: t.descriptor, scope: t.scope, createdAt: now })
    rep(level).tps.inserted += 1
  }
  for (const batch of chunks(freshTps)) await db.curriculumTpDescriptor.createMany({ data: batch, skipDuplicates: true })

  return [...reports.values()].sort((a, b) => a.level.localeCompare(b.level))
}

export interface SubjectReport {
  code: string
  name: string | null
  files: string[]
  status: 'ok' | 'failed'
  /** Why the subject was not written (nothing from it is). */
  error: string | null
  levels: LevelReport[]
  rejected: DskpRejected[]
  ignored: { file: string; level: string; unit: string; title: string }[]
  notes: string[]
  createdSubject: boolean
}

export interface LoadReport {
  dryRun: boolean
  sources: { file: string; sha256: string }[]
  subjects: SubjectReport[]
  /** Files that could not be assigned to any subject. */
  unassigned: { file: string; error: string }[]
}

export interface LoadOptions {
  dryRun: boolean
  /** Only these subjects (code, case-insensitive, or file name without `.json`). Empty = all. */
  only?: readonly string[]
  /** Create the two DSKP-only practical subjects (inactive) when absent. Off for DevOps by default. */
  createMissingSubjects?: boolean
  now: Date
}

const norm = (s: string): string => s.normalize('NFKD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/** Loads (or, with `dryRun`, counts) the sources into the database, one transaction per subject. */
export async function runDskpLoad(prisma: PrismaClient, sources: readonly DskpSource[], opts: LoadOptions): Promise<LoadReport> {
  const subjectRows = await prisma.subject.findMany({ select: { id: true, code: true, name: true } })
  const levelRows = await prisma.educationLevel.findMany({ select: { id: true, code: true } })
  const levels = new Map(levelRows.map((l) => [l.code, l.id]))
  const only = (opts.only ?? []).map((s) => s.toLowerCase().replace(/\.json$/, ''))

  const report: LoadReport = { dryRun: opts.dryRun, sources: sources.map((s) => ({ file: s.file, sha256: s.sha256 })), subjects: [], unassigned: [] }
  const groups = new Map<string, DskpSource[]>()
  for (const s of sources) {
    let code = s.subjectCode
    if (code === null && s.extract) {
      const byName = subjectRows.find((r) => norm(r.name) === norm(s.extract?.subject ?? ''))
      code = byName?.code ?? null
    }
    if (code === null) {
      report.unassigned.push({
        file: s.file,
        error: s.error ?? `no subject named "${s.extract?.subject ?? '?'}" in the subjects table and the file is not in the known list`,
      })
      continue
    }
    if (only.length > 0 && !only.includes(code.toLowerCase()) && !only.includes(s.file.replace(/\.json$/, '').toLowerCase())) continue
    groups.set(code, [...(groups.get(code) ?? []), s])
  }

  for (const [code, files] of groups) {
    const sr: SubjectReport = {
      code,
      name: subjectRows.find((r) => r.code === code)?.name ?? null,
      files: files.map((f) => f.file),
      status: 'ok',
      error: null,
      levels: [],
      rejected: [],
      ignored: [],
      notes: files.flatMap((f) => (DSKP_KNOWN_LIMITS[f.file] ? [`${f.file}: ${DSKP_KNOWN_LIMITS[f.file]}`] : [])),
      createdSubject: false,
    }
    report.subjects.push(sr)
    const bad = files.find((f) => f.error !== null || f.extract === null)
    if (bad) {
      sr.status = 'failed'
      sr.error = `${bad.file}: ${bad.error ?? 'unreadable'}`
      continue
    }
    const extracts = files.map((f) => ({ file: f.file, extract: f.extract as DskpExtract }))
    for (const { file, extract } of extracts) {
      for (const r of extract.rejected) sr.rejected.push(r)
      for (const i of extract.ignored) sr.ignored.push({ file, level: i.level, unit: i.code, title: i.title })
    }
    const merged = new Map<string, LevelReport>()
    const work = async (db: Db, subjectId: bigint) => {
      for (const { extract } of extracts) {
        const parts = await applyDskpExtract(db, { subjectId, extract, levels, now: opts.now, dryRun: opts.dryRun })
        for (const p of parts) {
          const m = merged.get(p.level)
          if (!m) merged.set(p.level, p)
          else {
            for (const k of ['inserted', 'updated', 'unchanged', 'drift'] as const) m.nodes[k] += p.nodes[k]
            m.tps.inserted += p.tps.inserted
            m.tps.unchanged += p.tps.unchanged
          }
        }
      }
    }
    try {
      let subjectId = subjectRows.find((r) => r.code === code)?.id
      if (subjectId === undefined) {
        const spec = DSKP_ONLY_SUBJECTS.find((s) => s.code === code)
        if (!opts.createMissingSubjects || !spec) {
          throw new Error(`subject code "${code}" is not in the subjects table (load the base curriculum first${spec ? ', or pass --create-missing-subjects' : ''})`)
        }
        sr.createdSubject = true
        sr.name = spec.name
        if (opts.dryRun) {
          // Nothing to compare with: every row would be new. Count on an empty subject id that matches no row.
          await work(prisma, -1n)
        } else {
          await prisma.$transaction(
            async (tx) => {
              const row = await tx.subject.create({
                data: { code: spec.code, name: spec.name, nameEn: spec.nameEn, icon: spec.icon, color: spec.color, isCore: spec.isCore, sortOrder: spec.order, isActive: spec.isActive, createdAt: opts.now, updatedAt: opts.now },
              })
              subjectId = row.id
              await work(tx, row.id)
            },
            { timeout: 120_000, maxWait: 20_000 },
          )
        }
      } else if (opts.dryRun) {
        await work(prisma, subjectId)
      } else {
        const id = subjectId
        await prisma.$transaction((tx) => work(tx, id), { timeout: 120_000, maxWait: 20_000 })
      }
      sr.levels = [...merged.values()].sort((a, b) => a.level.localeCompare(b.level))
    } catch (e) {
      sr.status = 'failed'
      sr.error = (e as Error).message.split('\n').filter((l) => l.trim() !== '').pop() ?? 'unknown error'
      sr.levels = []
    }
  }
  return report
}

const pad = (v: string | number, n: number): string => String(v).padEnd(n)
const num = (v: number, n: number): string => String(v).padStart(n)

/** Plain-text report for the terminal. */
export function formatDskpReport(r: LoadReport): string {
  const out: string[] = []
  out.push(r.dryRun ? 'DSKP load: DRY RUN (nothing is written)' : 'DSKP load: REAL RUN')
  out.push(`Source files: ${r.sources.length}`)
  for (const s of r.sources) out.push(`  ${pad(s.file, 32)} sha256 ${s.sha256 === '' ? '(unreadable)' : s.sha256}`)
  out.push('')
  out.push(`${pad('Subject', 9)}${pad('Level', 9)}${' '.repeat(7)} ${'insert'.padStart(6)}  ${'update'.padStart(6)}  same  drift |     ${'insert'.padStart(6)}  same   (nodes | TP descriptors)`)
  const total = { ni: 0, nu: 0, ns: 0, nd: 0, ti: 0, ts: 0 }
  for (const s of r.subjects) {
    if (s.status === 'failed') {
      out.push(`${pad(s.code, 9)}FAILED, nothing written: ${s.error ?? ''}`)
      continue
    }
    if (s.createdSubject) out.push(`${pad(s.code, 9)}(subject row ${r.dryRun ? 'would be' : 'was'} created, inactive)`)
    if (s.levels.length === 0) out.push(`${pad(s.code, 9)}(no Tingkatan 1-5 rows in ${s.files.join(', ')})`)
    for (const l of s.levels) {
      out.push(`${pad(s.code, 9)}${pad(l.level, 9)}${' '.repeat(7)} ${num(l.nodes.inserted, 6)}  ${num(l.nodes.updated, 6)}  ${num(l.nodes.unchanged, 4)}  ${num(l.nodes.drift, 5)} |     ${num(l.tps.inserted, 6)}  ${num(l.tps.unchanged, 4)}`)
      total.ni += l.nodes.inserted
      total.nu += l.nodes.updated
      total.ns += l.nodes.unchanged
      total.nd += l.nodes.drift
      total.ti += l.tps.inserted
      total.ts += l.tps.unchanged
    }
  }
  out.push(`${pad('TOTAL', 9)}${pad('', 9)}${' '.repeat(7)} ${num(total.ni, 6)}  ${num(total.nu, 6)}  ${num(total.ns, 4)}  ${num(total.nd, 5)} |     ${num(total.ti, 6)}  ${num(total.ts, 4)}`)
  out.push('("update" is always 0: existing nodes are never changed. "drift" = an existing node whose printed text differs from the file; left as is.)')

  const ignored = r.subjects.flatMap((s) => s.ignored.map((i) => ({ subject: s.code, ...i })))
  out.push('')
  out.push(`Ignored (not Tingkatan 1-5): ${ignored.length}`)
  for (const i of ignored) out.push(`  ${i.subject} ${i.file}: level "${i.level}" unit ${i.unit} ${i.title} (${DSKP_REASONS_MS.darjahIgnored})`)
  const rejected = r.subjects.flatMap((s) => s.rejected.map((x) => ({ code: s.code, ...x })))
  out.push(`Rejected rows (skipped, counted): ${rejected.length}`)
  for (const x of rejected) out.push(`  ${x.code} ${x.at}: ${x.reason}`)
  const notes = r.subjects.flatMap((s) => s.notes.map((n) => `${s.code} ${n}`))
  if (notes.length > 0) {
    out.push('Known limits of the extracts (loaded as printed):')
    for (const n of notes) out.push(`  ${n}`)
  }
  if (r.unassigned.length > 0) {
    out.push(`Files not assigned to a subject: ${r.unassigned.length}`)
    for (const u of r.unassigned) out.push(`  ${u.file}: ${u.error}`)
  }
  const failed = r.subjects.filter((s) => s.status === 'failed').length + r.unassigned.length
  out.push('')
  out.push(failed > 0 ? `RESULT: ${failed} subject(s)/file(s) failed (each is all-or-nothing; the others were processed).` : `RESULT: ok (${r.subjects.length} subjects).`)
  return out.join('\n')
}

/** 0 = done, 1 = at least one subject or file failed. */
export const exitCodeOf = (r: LoadReport): number => (r.subjects.some((s) => s.status === 'failed') || r.unassigned.length > 0 ? 1 : 0)
