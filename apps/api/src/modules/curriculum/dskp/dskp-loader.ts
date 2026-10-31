/**
 * Reads one DSKP extract (`docs/reference/dskp/<subject>.json`) into the generic tag tree of exam
 * schema D9: grouping -> unit -> sk -> sp, plus the performance-level (TP) descriptors. Pure: no
 * database and no file access, so the seed and the tests share it.
 *
 * Rules (printed codes and text are kept as printed; nothing is invented):
 * - A grouping is the unit's `bidang`, `theme`, `tema` or `learningArea` (Bahasa Melayu has none).
 *   It has no printed code, so its code is the slug of its title.
 * - The edition is the extract's `edition` text (a map per level for Bahasa Inggeris).
 * - TP rows: a unit's `tahapPenguasaan` belongs to the unit, or to the SK when `appliesToSK` names
 *   exactly one; an SK's own `tahapPenguasaan` belongs to the SK. A row without a `tp` number cannot
 *   be stored (tp is 1 to 6) and is counted in `skipped`. The subject's general levels have no node.
 */
import { z } from 'zod'

export type DskpNodeKind = 'grouping' | 'unit' | 'sk' | 'sp'
/**
 * AC-R1-12.3 / R1-19.3: the plain reasons of the load report are Bahasa Melayu. A rejected TP row reads
 * "Baris TP tidak disimpan: <why>"; an ignored Darjah (or other non-Tingkatan) unit reads `darjahIgnored`.
 */
export const DSKP_REASONS_MS = {
  notStored: 'Baris TP tidak disimpan:',
  noTp: 'tiada nombor TP.',
  badTp: (raw: string): string => `TP "${raw}" bukan satu nombor dari 1 hingga 6.`,
  duplicateTp: (tp: string): string => `TP ${tp} muncul dua kali pada nod yang sama.`,
  darjahIgnored: 'Dilangkau: Darjah tidak dimuatkan (hanya Tingkatan 1 hingga 5).',
} as const

/** Tingkatan 1 to 5 (R1-12); Darjah and any other level is ignored and listed. */
export type DskpLevel = 'T1' | 'T2' | 'T3' | 'T4' | 'T5'
const TINGKATAN = /^T[1-5]$/


export interface DskpNodeDraft {
  /** Unique inside one extract: `<level>|<kind>|<code>`. */
  key: string
  parentKey: string | null
  kind: DskpNodeKind
  level: DskpLevel
  code: string
  title: string
  titlePrinted: string | null
  /** 0-based position among the siblings of the same kind inside the level. */
  order: number
  edition: string
  isElective: boolean
}

export interface DskpTpDraft {
  /** Key of the unit or SK node; null = the subject's general performance levels. */
  nodeKey: string | null
  tp: number
  descriptor: string
  scope: 'unit' | 'sk' | null
}

export interface DskpExtract {
  subject: string
  nodes: DskpNodeDraft[]
  tps: DskpTpDraft[]
  /** TP rows that cannot be stored: no tp number, or a second row for the same node and tp. */
  skipped: { missingTp: number; duplicate: number }
  /** Every TP row that was not stored, with a plain reason (AC-R1-12.3). */
  rejected: DskpRejected[]
  /** Units whose level is not Tingkatan 1 to 5 (Darjah rows and the like); not loaded (AC-R1-12.2). */
  ignored: { level: string; code: string; title: string }[]
}

export interface DskpRejected {
  level: string | null
  at: string
  reason: string
}

const tpRow = z.looseObject({
  // A printed range such as "1-4" (Landskap dan Nurseri) or a missing number cannot be stored.
  tp: z.union([z.number().int(), z.string(), z.null()]).optional(),
  descriptor: z.string().min(1),
  appliesToSK: z.array(z.string()).optional(),
})

const spRow = z.looseObject({ code: z.string().min(1), text: z.string().min(1) })

const skRow = z.looseObject({
  sk: z.string().min(1),
  skTitle: z.string().min(1),
  sp: z.array(spRow),
  tahapPenguasaan: z.array(tpRow).optional(),
})

const unitRow = z.looseObject({
  level: z.string().min(1),
  code: z.string().min(1),
  title: z.string().min(1),
  titlePrinted: z.string().nullish(),
  bidang: z.string().nullish(),
  theme: z.string().nullish(),
  tema: z.string().nullish(),
  learningArea: z.string().nullish(),
  electivePackage: z.string().nullish(),
  standards: z.array(skRow),
  tahapPenguasaan: z.array(tpRow).optional(),
})

const extractFile = z.looseObject({
  subject: z.string().min(1),
  edition: z.union([z.string().min(1), z.record(z.string(), z.string().min(1))]),
  generalPerformanceLevels: z.looseObject({ levels: z.array(tpRow) }).optional(),
  generalTP: z
    .looseObject({ descriptors: z.array(z.string()).optional(), interpretation: z.array(z.string()).optional() })
    .optional(),
  units: z.array(unitRow),
})

/** `PERKAITAN DAN ALGEBRA` becomes `perkaitan-dan-algebra`. */
export function slugOf(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '')
  return slug === '' ? 'group' : slug
}

/** Throws a ZodError when the file does not have the extract shape. */
export function parseDskpExtract(input: unknown): DskpExtract {
  const file = extractFile.parse(input)
  const nodes: DskpNodeDraft[] = []
  const tps: DskpTpDraft[] = []
  const skipped = { missingTp: 0, duplicate: 0 }
  const rejected: DskpRejected[] = []
  const ignored: DskpExtract['ignored'] = []
  const taken = new Set<string>()
  const counters = new Map<string, number>()
  const nextOrder = (level: string, kind: string): number => {
    const k = `${level}|${kind}`
    const n = counters.get(k) ?? 0
    counters.set(k, n + 1)
    return n
  }
  const editionOf = (level: DskpLevel): string => {
    if (typeof file.edition === 'string') return file.edition
    const e = file.edition[level]
    if (!e) throw new Error(`DSKP extract "${file.subject}": no edition for ${level}`)
    return e
  }
  const addNode = (n: Omit<DskpNodeDraft, 'key' | 'order'>): DskpNodeDraft => {
    const key = `${n.level}|${n.kind}|${n.code}`
    if (taken.has(key)) throw new Error(`DSKP extract "${file.subject}": duplicate node ${key}`)
    taken.add(key)
    const node = { ...n, key, order: nextOrder(n.level, n.kind) }
    nodes.push(node)
    return node
  }
  const addTp = (nodeKey: string | null, scope: 'unit' | 'sk' | null, row: z.infer<typeof tpRow>, level: string | null, at: string, tpNo?: number) => {
    const raw = tpNo ?? row.tp
    const tp = typeof raw === 'number' ? raw : null
    if (tp === null || tp < 1 || tp > 6) {
      skipped.missingTp += 1
      const why = raw === undefined || raw === null ? DSKP_REASONS_MS.noTp : DSKP_REASONS_MS.badTp(String(raw))
      rejected.push({ level, at, reason: `${DSKP_REASONS_MS.notStored} ${why}` })
      return
    }
    const key = `${nodeKey ?? ''}#${tp}`
    if (taken.has(key)) {
      skipped.duplicate += 1
      rejected.push({ level, at, reason: `${DSKP_REASONS_MS.notStored} ${DSKP_REASONS_MS.duplicateTp(String(tp))}` })
      return
    }
    taken.add(key)
    tps.push({ nodeKey, tp, descriptor: row.descriptor, scope })
  }

  for (const unit of file.units) {
    if (!TINGKATAN.test(unit.level)) {
      ignored.push({ level: unit.level, code: unit.code, title: unit.title })
      continue
    }
    const level = unit.level as DskpLevel
    const edition = editionOf(level)
    const groupTitle = unit.bidang ?? unit.theme ?? unit.tema ?? unit.learningArea ?? null
    let parentKey: string | null = null
    if (groupTitle) {
      const code = slugOf(groupTitle)
      const existing = nodes.find((n) => n.key === `${level}|grouping|${code}`)
      parentKey = (existing ?? addNode({ parentKey: null, kind: 'grouping', level, code, title: groupTitle, titlePrinted: null, edition, isElective: false })).key
    }
    const unitNode = addNode({
      parentKey,
      kind: 'unit',
      level,
      code: unit.code,
      title: unit.title,
      titlePrinted: unit.titlePrinted ?? null,
      edition,
      isElective: Boolean(unit.electivePackage),
    })
    const skKeys = new Map<string, string>()
    for (const sk of unit.standards) {
      const skNode = addNode({
        parentKey: unitNode.key,
        kind: 'sk',
        level,
        code: sk.sk,
        title: sk.skTitle,
        titlePrinted: null,
        edition,
        isElective: false,
      })
      skKeys.set(sk.sk, skNode.key)
      for (const sp of sk.sp) {
        addNode({ parentKey: skNode.key, kind: 'sp', level, code: sp.code, title: sp.text, titlePrinted: null, edition, isElective: false })
      }
      for (const row of sk.tahapPenguasaan ?? []) addTp(skNode.key, 'sk', row, level, `${level} SK ${sk.sk}`)
    }
    for (const row of unit.tahapPenguasaan ?? []) {
      const only = row.appliesToSK?.length === 1 ? skKeys.get(row.appliesToSK[0] as string) : undefined
      if (only) addTp(only, 'sk', row, level, `${level} SK ${row.appliesToSK?.[0] ?? '?'}`)
      else addTp(unitNode.key, 'unit', row, level, `${level} unit ${unit.code}`)
    }
  }

  const general = file.generalPerformanceLevels?.levels
  if (general) for (const row of general) addTp(null, null, row, null, 'general performance levels')
  const texts = file.generalTP?.descriptors ?? file.generalTP?.interpretation
  if (texts) texts.forEach((descriptor, i) => addTp(null, null, { descriptor }, null, 'general TP descriptors', i + 1))

  return { subject: file.subject, nodes, tps, skipped, rejected, ignored }
}

/** The extract's nodes by key, for lookups by code and parent traversal in memory. */
export function indexNodes(nodes: readonly DskpNodeDraft[]): Map<string, DskpNodeDraft> {
  return new Map(nodes.map((n) => [n.key, n]))
}
